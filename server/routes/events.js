import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

function normalizeInstagram(raw) {
  if (!raw) return null;
  const handle = raw.trim().replace(/^@/, '').toLowerCase();
  return handle || null;
}

async function getEvent(id) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  return rows[0] || null;
}

async function getAttendee(eventId, instagram) {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM event_attendees WHERE event_id = ? AND instagram = ?',
    args: [eventId, instagram],
  });
  return rows[0] || null;
}

router.get('/', async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM events ORDER BY date ASC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

router.post('/', async (req, res) => {
  const { title, url, date, creatorInstagram } = req.body;
  if (!title || !date) {
    return res.status(400).json({ error: 'title and date are required' });
  }
  const result = await db.execute({
    sql: 'INSERT INTO events (title, url, date, creator_instagram) VALUES (?, ?, ?, ?)',
    args: [title, url || null, date, normalizeInstagram(creatorInstagram)],
  });
  res.status(201).json(await getEvent(result.lastInsertRowid));
});

router.put('/:id', async (req, res) => {
  const existing = await getEvent(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  const { title, url, date } = req.body;
  if (!title || !date) {
    return res.status(400).json({ error: 'title and date are required' });
  }
  await db.execute({
    sql: 'UPDATE events SET title = ?, url = ?, date = ? WHERE id = ?',
    args: [title, url || null, date, req.params.id],
  });
  res.json(await getEvent(req.params.id));
});

router.delete('/:id', async (req, res) => {
  const existing = await getEvent(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  await db.execute({ sql: 'DELETE FROM event_attendees WHERE event_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [req.params.id] });
  res.status(204).send();
});

router.get('/:id/attendees', async (req, res) => {
  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const { rows } = await db.execute({
    sql: 'SELECT * FROM event_attendees WHERE event_id = ? ORDER BY created_at ASC',
    args: [req.params.id],
  });
  res.json(rows);
});

router.post('/:id/attendees', async (req, res) => {
  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const instagram = normalizeInstagram(req.body.instagram);
  if (!instagram) {
    return res.status(400).json({ error: 'instagram is required' });
  }
  await db.execute({
    sql: 'INSERT OR IGNORE INTO event_attendees (event_id, instagram) VALUES (?, ?)',
    args: [req.params.id, instagram],
  });
  res.status(201).json(await getAttendee(req.params.id, instagram));
});

router.delete('/:id/attendees/:attendeeId', async (req, res) => {
  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const result = await db.execute({
    sql: 'DELETE FROM event_attendees WHERE id = ? AND event_id = ?',
    args: [req.params.attendeeId, req.params.id],
  });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Attendee not found' });
  res.status(204).send();
});

export default router;

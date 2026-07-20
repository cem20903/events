import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultLocalUrl = `file:${path.join(__dirname, 'events.db')}`;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || defaultLocalUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      date TEXT NOT NULL,
      creator_instagram TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { rows } = await db.execute('PRAGMA table_info(events)');
  const hasCreatorInstagram = rows.some((column) => column.name === 'creator_instagram');
  if (!hasCreatorInstagram) {
    await db.execute('ALTER TABLE events ADD COLUMN creator_instagram TEXT');
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS event_attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      instagram TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, instagram)
    )
  `);
}

export default db;

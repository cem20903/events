import { useEffect, useMemo, useState } from 'react';
import { getStoredInstagram, normalizeInstagram, setStoredInstagram } from '../utils/identity.js';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function toDateKey(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState(getStoredInstagram());

  const [modalDate, setModalDate] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCreatorInstagram, setFormCreatorInstagram] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [activeEvent, setActiveEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [joinInstagram, setJoinInstagram] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDate, setEditDate] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('No se pudieron cargar los eventos');
      setEvents(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const event of events) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function goToPreviousMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function openCreateModal(dateKey) {
    setModalDate(dateKey);
    setFormTitle('');
    setFormUrl('');
    setFormCreatorInstagram('');
    setError('');
  }

  function closeCreateModal() {
    setModalDate(null);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const creatorInstagram = identity || normalizeInstagram(formCreatorInstagram);
    if (!creatorInstagram) {
      setError('Indica tu Instagram para crear el evento');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          url: formUrl.trim(),
          date: modalDate,
          creatorInstagram,
        }),
      });
      if (!res.ok) throw new Error('No se pudo crear el evento');
      if (!identity) {
        setStoredInstagram(creatorInstagram);
        setIdentity(creatorInstagram);
      }
      await fetchEvents();
      closeCreateModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isOwner = Boolean(activeEvent && identity && activeEvent.creator_instagram === identity);
  const isJoined = attendees.some((a) => a.instagram === identity);

  async function openEventModal(event) {
    setActiveEvent(event);
    setAttendees([]);
    setJoinInstagram('');
    setActionError('');
    setEditTitle(event.title);
    setEditUrl(event.url || '');
    setEditDate(event.date);
    try {
      const res = await fetch(`/api/events/${event.id}/attendees`);
      if (res.ok) setAttendees(await res.json());
    } catch {
      setAttendees([]);
    }
  }

  function closeEventModal() {
    setActiveEvent(null);
    setAttendees([]);
  }

  async function handleJoin(e) {
    e?.preventDefault();
    const handle = identity || normalizeInstagram(joinInstagram);
    if (!handle) return;

    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram: handle }),
      });
      if (!res.ok) throw new Error('No se pudo unir');
      const attendee = await res.json();
      if (!identity) {
        setStoredInstagram(handle);
        setIdentity(handle);
      }
      setAttendees((prev) => [...prev, attendee]);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    const me = attendees.find((a) => a.instagram === identity);
    if (!me) return;

    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/attendees/${me.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo salir del evento');
      setAttendees((prev) => prev.filter((a) => a.id !== me.id));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveAttendee(attendeeId) {
    setActionError('');
    try {
      const res = await fetch(`/api/events/${activeEvent.id}/attendees/${attendeeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo quitar al asistente');
      setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editTitle.trim() || !editDate) return;

    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/events/${activeEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), url: editUrl.trim(), date: editDate }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el evento');
      const updated = await res.json();
      setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
      setActiveEvent(updated);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteEvent() {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/events/${activeEvent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el evento');
      setEvents((prev) => prev.filter((ev) => ev.id !== activeEvent.id));
      closeEventModal();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-slate-800 capitalize">{monthLabel}</h1>
        <div className="flex gap-2">
          <button
            onClick={goToPreviousMonth}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            &larr;
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Hoy
          </button>
          <button
            onClick={goToNextMonth}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            &rarr;
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
        {WEEKDAYS.map((day) => (
          <div key={day} className="bg-slate-100 text-center text-xs font-medium text-slate-500 py-2">
            {day}
          </div>
        ))}

        {weeks.map((week, weekIdx) =>
          week.map((day, dayIdx) => {
            if (day === null) {
              return <div key={`${weekIdx}-${dayIdx}`} className="bg-slate-50 min-h-28" />;
            }
            const dateKey = toDateKey(year, month, day);
            const dayEvents = eventsByDate[dateKey] || [];
            const isToday = dateKey === todayKey;

            return (
              <div
                key={dateKey}
                onClick={() => openCreateModal(dateKey)}
                className="bg-white min-h-28 p-2 cursor-pointer hover:bg-slate-50 flex flex-col gap-1"
              >
                <span
                  className={
                    isToday
                      ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm'
                      : 'text-sm text-slate-700'
                  }
                >
                  {day}
                </span>
                <div className="flex flex-col gap-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-800"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEventModal(event);
                        }}
                        className="flex-1 truncate text-left hover:underline"
                        title={event.title}
                      >
                        {event.title}
                      </button>
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-blue-400 hover:text-blue-600"
                          title="Ver información"
                        >
                          &#8599;
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Añadir evento &middot; {modalDate}</h2>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">URL (opcional)</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!identity && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Tu Instagram</label>
                  <input
                    type="text"
                    value={formCreatorInstagram}
                    onChange={(e) => setFormCreatorInstagram(e.target.value)}
                    placeholder="@tu_instagram"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            {isOwner ? (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Editar evento</h2>
                <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">URL</label>
                    <input
                      type="url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={handleDeleteEvent}
                      disabled={actionLoading}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Eliminar evento
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeEventModal}
                        className="px-4 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100"
                      >
                        Cerrar
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Se han unido ({attendees.length})</h3>
                  {attendees.length === 0 ? (
                    <p className="text-sm text-slate-400">Nadie se ha unido todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {attendees.map((a) => (
                        <li key={a.id} className="flex items-center justify-between text-sm">
                          <a
                            href={`https://instagram.com/${a.instagram}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            @{a.instagram}
                          </a>
                          <button
                            onClick={() => handleRemoveAttendee(a.id)}
                            className="text-xs text-slate-400 hover:text-red-500"
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">{activeEvent.title}</h2>
                {activeEvent.url && (
                  <a
                    href={activeEvent.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver información del evento
                  </a>
                )}

                <div className="mt-4">
                  {isJoined ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Ya te has unido &#9989;</span>
                      <button
                        onClick={handleLeave}
                        disabled={actionLoading}
                        className="text-sm text-slate-500 hover:text-red-500 disabled:opacity-50"
                      >
                        Salir
                      </button>
                    </div>
                  ) : identity ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-slate-600">¿Quieres unirte como @{identity}?</p>
                      <button
                        onClick={handleJoin}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Unirme
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleJoin} className="flex flex-col gap-4">
                      <p className="text-sm text-slate-600">¿Te quieres unir, dinos quién eres?</p>
                      <input
                        autoFocus
                        type="text"
                        value={joinInstagram}
                        onChange={(e) => setJoinInstagram(e.target.value)}
                        placeholder="@tu_instagram"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Unirme
                      </button>
                    </form>
                  )}
                  {actionError && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
                </div>

                <div className="mt-4 flex justify-end">
                  <button onClick={closeEventModal} className="text-sm text-slate-500 hover:underline">
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

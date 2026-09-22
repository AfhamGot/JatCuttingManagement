import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import ScheduleDialog from '../components/ScheduleDialog';
import AttendanceScanner from '../components/AttendanceScanner';
import StatusBadge from '../components/StatusBadge';
import { malaysiaDate, shiftDate, minutes, time24, prettyTime, duration, validateSchedule, canClockIn, downloadReport } from './scheduleUtils';
import './schedule.css';

export default function ScheduleWorkspace() {
  const { user } = useAuth(); const admin = user.role === 'admin';
  const [date, setDate] = useState(malaysiaDate());
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('schedule');
  const [data, setData] = useState(null); const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false); const pending = useRef(false); const loadId = useRef(0);
  const [modal, setModal] = useState(null); const [form, setForm] = useState({}); const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => Date.now()); const serverOffset = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const id = ++loadId.current;
    if (!quiet) setLoading(true);
    try {
      const result = await api.schedules(date, admin ? filter : user.id);
      if (id !== loadId.current) return;
      if (!Array.isArray(result.days)) throw new Error('Unexpected schedule response. Check that the backend update is installed.');
      serverOffset.current = Date.parse(result.server_now) - Date.now();
      setNow(Date.parse(result.server_now)); setData(result); setError('');
      if (admin && !filter) setBarbers(result.days.map(d => d.barber));
    } catch (e) { if (id === loadId.current) setError(e.message); }
    finally { if (id === loadId.current) setLoading(false); }
  }, [date, filter, admin, user.id]);
  useEffect(() => { load(); const refresh = setInterval(() => load(true), 60000); return () => { clearInterval(refresh); loadId.current++; }; }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() + serverOffset.current), 1000); return () => clearInterval(timer); }, []);
  const open = (kind, day, appointment = null) => {
    setFormError(''); setSuccess(''); setModal({ kind, day, appointment });
    setForm(kind === 'edit' ? { barber_id: day.barber.id, date, start_time: time24(day.schedule.start_time), end_time: time24(day.schedule.end_time), break_start: time24(day.schedule.break_start), break_end: time24(day.schedule.break_end), is_available: Number(day.schedule.is_available), notes: day.schedule.notes || '' }
      : kind === 'move' ? { barber_id: day.barber.id, date: appointment.appt_date, time: time24(appointment.appt_time) } : { notes: '', reason: '' });
  };
  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const run = async (operation, message, inModal = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setFormError(''); setSuccess('');
    try { await operation(); setSuccess(message); if (inModal) setModal(null); await load(true); }
    catch (e) { if (inModal) setFormError(e.message); else setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const submit = e => {
    e.preventDefault(); const { kind, day, appointment } = modal;
    if (kind === 'edit') {
      const validation = validateSchedule(form); if (validation) { setFormError(validation); return; }
      run(() => api.saveSchedule({ ...form, is_available: Number(form.is_available) }), 'Availability saved.', true);
    } else if (kind === 'move') {
      if (!form.date || !form.time) { setFormError('Choose a date and start time.'); return; }
      run(() => api.reschedule(appointment.id, form), 'Booking rescheduled.', true);
    } else if (kind === 'complete') {
      if (!form.notes.trim()) { setFormError('Describe the completed service.'); return; }
      run(() => api.updateAppointmentStatus(appointment.id, 'completed', { completion_notes: form.notes.trim() }), 'Booking completed. The daily report updates when the day is finished.', true);
    } else if (kind === 'cancel') run(() => api.updateAppointmentStatus(appointment.id, 'cancelled'), 'Booking cancelled.', true);
    else if (kind === 'finish') run(() => api.finishSchedule(day.barber.id, date), 'Day finished. Your daily report is ready.', true);
    else if (kind === 'clockout') {
      if (admin && !form.reason.trim()) { setFormError('Enter a reason for closing this clock session.'); return; }
      run(() => api.clock('clock_out', day.barber.id, form.reason), 'Clock-out recorded.', true);
    }
  };
  const days = data?.date === date ? data.days : [];
  const appointments = days.flatMap(d => d.appointments.map(a => ({ ...a, day: d })));
  const sessions = days.flatMap(d => d.attendance.map(a => ({ ...a, day: d })));
  const reports = days.filter(d => d.report);
  const current = new Date(now); const today = malaysiaDate(current);
  const worked = a => a.clock_out ? a.worked_seconds : Math.max(0, (now - Date.parse(a.clock_in.replace(' ', 'T') + '+08:00')) / 1000);
  const totalSeconds = sessions.reduce((sum, a) => sum + worked(a), 0);
  const clockLabel = current.toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const attendanceToday = !admin && tab === 'attendance';
  const title = { scan_in: 'Scan to clock in', scan_out: 'Scan to clock out', edit: 'Manage availability', move: 'Reschedule booking', complete: 'Complete booking', cancel: 'Cancel booking', finish: 'Finish day & generate report', clockout: 'Clock out', details: 'Booking details', report: 'Daily work report' };
  return <main className="main schedule-workspace">
    <div className="page-heading"><div><span className="eyebrow">10 AM – 10 PM · Malaysia time</span><h1>{admin ? 'Schedule & Attendance' : 'My Schedule'}</h1><p>{admin ? 'Plan your team’s day and track actual working hours.' : 'View your bookings and manage each appointment.'}</p></div><div className="schedule-clock"><strong>{clockLabel}</strong><span>{today} · Asia/Kuala_Lumpur</span></div></div>
    <div className="card schedule-toolbar"><label className="form-row">Date<input type="date" disabled={attendanceToday} value={date} onChange={e => { if (e.target.value) { setDate(e.target.value); setSuccess(''); } }} /></label>{admin && <label className="form-row">Barber<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">All barbers</option>{barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}<button className="btn btn-outline" onClick={() => setDate(today)}>Today</button><button className="btn btn-outline" disabled={loading || busy} onClick={() => load()}>Refresh</button></div>
    <nav hidden={attendanceToday} className="schedule-week" aria-label="Choose schedule day"><button aria-label="Previous week" onClick={() => setDate(shiftDate(date, -7))}>‹</button>{Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 3)).map(d => <button key={d} className={d === date ? 'selected' : ''} aria-current={d === date ? 'date' : undefined} onClick={() => { setDate(d); setSuccess(''); }}><small>{new Date(d + 'T12:00:00+08:00').toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short' })}</small><strong>{d.slice(8)}</strong><small>{d.slice(5, 7)}</small></button>)}<button aria-label="Next week" onClick={() => setDate(shiftDate(date, 7))}>›</button></nav>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{success && <div className="alert alert-success" role="status">{success}</div>}
    {loading ? <div className="empty-state" role="status">Loading schedules…</div> : <>
      {admin && <div className="schedule-metrics"><div><span>{admin ? 'Available barbers' : 'My availability'}</span><strong>{days.filter(d => Number(d.barber.is_active) && Number(d.schedule.is_available) && !d.report).length} / {days.length}</strong></div><div><span>Bookings on {date}</span><strong>{appointments.length}</strong></div><div><span>Worked · selected day</span><strong>{duration(totalSeconds)}</strong></div><div><span>Final reports</span><strong>{reports.length}</strong></div></div>}
      {admin && <div className="schedule-tabs" role="tablist" aria-label="Schedule sections">{[['schedule', 'Schedule'], ['attendance', 'Attendance'], ['reports', 'Reports']].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => { setTab(value); if (value === 'attendance' && !admin) setDate(today); }}>{label}</button>)}</div>}
      {!days.length && !error && <div className="card empty-state">No barbers found. Add a barber first.</div>}
      {tab === 'schedule' && <>
        {admin && <div className="schedule-day-grid">{days.map(day => <section className="card barber-day-card" key={day.barber.id}><div className="section-heading"><div><h2>{day.barber.name}</h2><p>{day.report ? 'Day finished · report saved' : !Number(day.barber.is_active) ? 'Barber account inactive' : Number(day.schedule.is_available) ? 'Available for bookings' : 'Off day'}</p></div><span className={`state-pill ${Number(day.schedule.is_available) && !day.report && Number(day.barber.is_active) ? 'active' : 'inactive'}`}>{day.report ? 'Finished' : !Number(day.barber.is_active) ? 'Inactive' : Number(day.schedule.is_available) ? 'Available' : 'Off'}</span></div>
          <div className="work-window">{prettyTime(day.schedule.start_time)} <span>—</span> {prettyTime(day.schedule.end_time)}</div><p className="schedule-muted">{day.schedule.break_start ? `Break: ${prettyTime(day.schedule.break_start)} – ${prettyTime(day.schedule.break_end)}` : 'No break scheduled'}{day.schedule.is_default ? ' · Default hours' : ''}</p>
          <div className="availability-track" aria-label={`Working hours ${prettyTime(day.schedule.start_time)} to ${prettyTime(day.schedule.end_time)}`}><div className="work-track" style={{ left: `${(minutes(day.schedule.start_time) - 600) / 720 * 100}%`, width: `${(minutes(day.schedule.end_time) - minutes(day.schedule.start_time)) / 720 * 100}%`, opacity: Number(day.schedule.is_available) && !day.report ? 1 : .25 }} />{day.schedule.break_start && <div className="break-track" style={{ left: `${(minutes(day.schedule.break_start) - 600) / 720 * 100}%`, width: `${(minutes(day.schedule.break_end) - minutes(day.schedule.break_start)) / 720 * 100}%` }} />}</div><div className="track-labels"><span>10 AM</span><span>4 PM</span><span>10 PM</span></div>
          {day.schedule.notes && <p className="schedule-note">{day.schedule.notes}</p>}<div className="schedule-actions"><button className="btn btn-outline" disabled={busy || !!day.report || date < today} onClick={() => open('edit', day)}>Manage hours</button>{day.report ? <button className="btn btn-primary" onClick={() => open('report', day)}>View report</button> : <button className="btn btn-primary" disabled={busy || date > today} onClick={() => open('finish', day)}>Finish day</button>}</div></section>)}</div>}
        <section className="card"><div className="section-heading"><div><h2>Bookings for {date}</h2><p>Confirm, start, complete or reschedule an appointment.</p></div></div><div className="table-wrap"><table><thead><tr><th>Time / duration</th><th>Customer / service</th>{admin && <th>Barber</th>}<th>Status</th><th>Manage</th></tr></thead><tbody>{appointments.map(a => <tr key={a.id}><td>{prettyTime(a.appt_time)}<small className="schedule-small">{a.duration_minutes} minutes</small></td><td><strong>{a.customer_name}</strong><small className="schedule-small">{a.service_name}</small></td>{admin && <td>{a.barber_name}</td>}<td><StatusBadge status={a.status}/></td><td><div className="schedule-actions"><button className="btn btn-small btn-outline" onClick={() => open('details', a.day, a)}>Details</button>{!a.day.report && <>{a.status === 'pending' && <button className="btn btn-small btn-primary" disabled={busy} onClick={() => run(() => api.updateAppointmentStatus(a.id, 'confirmed'), 'Booking confirmed.')}>Confirm</button>}{a.status === 'confirmed' && <button className="btn btn-small btn-primary" disabled={busy || date > today} onClick={() => run(() => api.updateAppointmentStatus(a.id, 'in_progress'), 'Booking started.')}>Start</button>}{a.status === 'in_progress' && <button className="btn btn-small btn-primary" disabled={busy} onClick={() => open('complete', a.day, a)}>Complete</button>}{['pending', 'confirmed'].includes(a.status) && <button className="btn btn-small btn-outline" disabled={busy} onClick={() => open('move', a.day, a)}>Reschedule</button>}{['pending', 'confirmed', 'in_progress'].includes(a.status) && <button className="btn btn-small btn-danger-soft" disabled={busy} onClick={() => open('cancel', a.day, a)}>Cancel</button>}</>}</div></td></tr>)}</tbody></table></div>{!appointments.length && <div className="empty-state">No bookings on this date.</div>}</section>
      </>}
      {admin && tab === 'attendance' && <>
        <p className="schedule-muted">Clock-in and clock-out use server time. Clock out for breaks; only recorded sessions count as work. Open sessions remain running until closed.</p>
        <div className="schedule-day-grid">{days.map(day => <section className="card" key={day.barber.id}><h2>{day.barber.name}</h2><p className="attendance-number">{duration(day.attendance.reduce((s, a) => s + worked(a), 0))}</p><p className="schedule-muted">Worked on {date}{day.attendance.some(a => !a.clock_out) ? ' · includes running session' : ''}</p>{day.active_clock ? <><p className="clock-running">Clocked in since {day.active_clock.clock_in} MYT</p>{day.active_clock.work_date !== today && <p className="error-text">A previous day is still open. Close it before clocking in again.</p>}<button className="btn btn-primary" disabled={busy} onClick={() => open(admin ? 'clockout' : 'scan_out', day)}>{admin ? 'Close missed clock-out' : 'Scan to clock out'}</button></> : admin ? <p className="schedule-muted">Not clocked in.</p> : <><button className="btn btn-primary" disabled={busy || !canClockIn(day, current)} onClick={() => open('scan_in', day)}>Scan to clock in</button>{!canClockIn(day, current) && <p className="schedule-muted">Select today and clock in during your available hours, outside your break.</p>}</>}</section>)}</div>
        <section className="card"><h2>Clock records · {date}</h2><div className="table-wrap"><table><thead><tr><th>Barber</th><th>Clock in (MYT)</th><th>Clock out (MYT)</th><th>Worked</th><th>Closed by / reason</th></tr></thead><tbody>{sessions.map(a => <tr key={a.id}><td>{a.day.barber.name}</td><td>{a.clock_in}</td><td>{a.clock_out || 'Running'}</td><td>{duration(worked(a))}</td><td>{a.closed_by_name || '—'}{a.close_reason && <small className="schedule-small">{a.close_reason}</small>}</td></tr>)}</tbody></table></div>{!sessions.length && <div className="empty-state">No clock records for this date.</div>}</section>
      </>}
      {admin && tab === 'reports' && <section className="card"><div className="section-heading"><div><h2>Daily work reports</h2><p>Reports are saved when you finish a day, or after closing time once all bookings and clock sessions are resolved.</p></div></div>{reports.map(day => <div className="report-list-row" key={day.barber.id}><div><strong>{day.barber.name}</strong><p>{day.report.data.summary.completed} completed bookings · {duration(day.report.data.summary.worked_seconds)} worked · RM {Number(day.report.data.summary.completed_value).toFixed(2)} booking value</p><small>Generated {day.report.generated_at} MYT</small></div><div className="schedule-actions"><button className="btn btn-outline" onClick={() => open('report', day)}>View details</button><button className="btn btn-primary" onClick={() => downloadReport(day.report)}>Download CSV</button></div></div>)}{!reports.length && <div className="empty-state">No final reports on this date. Resolve open bookings, clock out, then choose Finish day.</div>}<p className="schedule-muted">Choose another date above to review historical reports. Finalized days are locked to preserve their records.</p></section>}
    </>}
    {modal && <ScheduleDialog title={title[modal.kind]} onClose={() => { if (!busy) setModal(null); }} busy={busy}>
      {['scan_in', 'scan_out'].includes(modal.kind) ? <AttendanceScanner name={user.name} action={modal.kind === 'scan_in' ? 'clock_in' : 'clock_out'} busy={busy} error={formError} onConfirm={token => run(() => api.clock(modal.kind === 'scan_in' ? 'clock_in' : 'clock_out', user.id, '', token), 'Attendance recorded.', true)} /> : ['details', 'report'].includes(modal.kind) ? <div className="registration-body">{modal.kind === 'report' ? <ReportView report={modal.day.report}/> : <BookingDetails appointment={modal.appointment}/>}</div> : <form onSubmit={submit}>
        <div className="registration-body"><p className="schedule-muted">{modal.day.barber.name} · {date}</p>{formError && <div className="alert alert-error" role="alert">{formError}</div>}
          <fieldset className="schedule-fieldset" disabled={busy}>
          {modal.kind === 'edit' && <div className="form-grid"><label className="form-row field-wide">Availability<select name="is_available" value={form.is_available} onChange={change}><option value={1}>Available for bookings</option><option value={0}>Off day / unavailable</option></select></label><label className="form-row">Start time<input required type="time" min="10:00" max="21:59" name="start_time" value={form.start_time} onChange={change}/></label><label className="form-row">End time<input required type="time" min="10:01" max="22:00" name="end_time" value={form.end_time} onChange={change}/></label><label className="form-row">Break start (optional)<input type="time" min="10:00" max="22:00" name="break_start" value={form.break_start} onChange={change}/></label><label className="form-row">Break end (optional)<input type="time" min="10:00" max="22:00" name="break_end" value={form.break_end} onChange={change}/></label><label className="form-row field-wide">Staff note<textarea name="notes" rows={3} maxLength={255} value={form.notes} onChange={change}/></label><p className="schedule-muted field-wide">This changes {date} only. Existing bookings must still fit the new hours. Unconfigured days use 10 AM–10 PM.</p></div>}
          {modal.kind === 'move' && <><p>{modal.appointment.customer_name} · {modal.appointment.service_name} · {modal.appointment.duration_minutes} minutes</p>{admin && <label className="form-row">Barber<select name="barber_id" value={form.barber_id} onChange={change}>{barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}<label className="form-row">New date<input required type="date" min={today} name="date" value={form.date} onChange={change}/></label><label className="form-row">New start time<input required type="time" min="10:00" max="21:59" name="time" value={form.time} onChange={change}/></label><p className="schedule-muted">The whole service must fit availability and finish by 10 PM. Overlapping bookings are rejected.</p></>}
          {modal.kind === 'complete' && <><p>{modal.appointment.customer_name} · {modal.appointment.service_name}</p><label className="form-row">Completion details *<textarea required name="notes" rows={4} maxLength={5000} value={form.notes} onChange={change} placeholder="Describe the service performed and any follow-up advice."/></label></>}
          {modal.kind === 'cancel' && <p>Cancel {modal.appointment.customer_name}’s {modal.appointment.service_name} booking? It will remain in the report as cancelled.</p>}
          {modal.kind === 'finish' && <p>Finish this day and save its booking and attendance report? All bookings must be completed or cancelled, and clock sessions must be closed. This locks the day and stops new bookings for it.</p>}
          {modal.kind === 'clockout' && <><p>This records clock-out at the current server time. It does not automatically mark appointments completed.</p>{admin && <label className="form-row">Reason *<textarea required name="reason" rows={3} maxLength={255} value={form.reason} onChange={change} placeholder="Why are you closing this clock session?"/></label>}</>}
          </fieldset>
        </div><div className="registration-footer"><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setModal(null)}>Back</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : modal.kind === 'finish' ? 'Finish & generate report' : modal.kind === 'clockout' ? 'Confirm clock-out' : modal.kind === 'cancel' ? 'Confirm cancellation' : 'Save changes'}</button></div>
      </form>}
    </ScheduleDialog>}
  </main>;
}

function BookingDetails({ appointment: a }) {
  return <div>{[['Booking', `#${a.id}`], ['Customer', a.customer_name], ['Phone', a.customer_phone], ['Service', a.service_name], ['Date / time', `${a.appt_date} · ${prettyTime(a.appt_time)}`], ['Duration', `${a.duration_minutes} minutes`], ['Booked price', `RM ${Number(a.service_price).toFixed(2)}`], ['Status', a.status.replaceAll('_', ' ')], ['Customer notes', a.notes], ['Completion details', a.completion_notes], ['Completed at (MYT)', a.completed_at]].map(([label, value]) => <div className="detail-row" key={label}><span className="detail-label">{label}</span><span className="detail-value">{value || '—'}</span></div>)}</div>;
}
function ReportView({ report }) {
  const d = report.data;
  return <div className="work-report"><div className="section-heading"><div><h2>{d.barber.name}</h2><p>{d.date} · Malaysia time</p></div><button className="btn btn-primary" onClick={() => downloadReport(report)}>Download CSV</button></div><p>{duration(d.summary.worked_seconds)} worked · {d.summary.completed} completed · {d.summary.cancelled} cancelled</p><p>Completed booking value: <strong>RM {Number(d.summary.completed_value).toFixed(2)}</strong></p>{Number(d.summary.legacy_prices) > 0 && <p className="schedule-muted">{d.summary.legacy_prices} older bookings use service prices captured during the database upgrade.</p>}<p className="schedule-muted">Availability: {prettyTime(d.schedule.start_time)}–{prettyTime(d.schedule.end_time)}{d.schedule.break_start ? ` · Break ${prettyTime(d.schedule.break_start)}–${prettyTime(d.schedule.break_end)}` : ''}</p><h3>Booking details</h3>{d.appointments.map(a => <details key={a.id} className="report-booking"><summary>{prettyTime(a.appt_time)} · {a.customer_name} · {a.service_name} · {a.status.replaceAll('_', ' ')}</summary><BookingDetails appointment={a}/></details>)}{!d.appointments.length && <p>No bookings.</p>}<h3>Attendance</h3>{d.attendance.map(a => <div className="report-booking" key={a.id}><strong>{a.clock_in} → {a.clock_out}</strong><p>{duration(a.worked_seconds)} · Closed by {a.closed_by_name || 'staff'}</p>{a.close_reason && <p>{a.close_reason}</p>}</div>)}{!d.attendance.length && <p>No clock sessions recorded.</p>}<p className="schedule-muted">Saved {report.generated_at} MYT · Final snapshot</p></div>;
}

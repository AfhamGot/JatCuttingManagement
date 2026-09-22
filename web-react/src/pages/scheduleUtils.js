export function malaysiaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function shiftDate(date, amount) { const day = new Date(`${date}T12:00:00+08:00`); day.setUTCDate(day.getUTCDate() + amount); return malaysiaDate(day); }
export function minutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]); const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return NaN;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}
export function time24(value) { const m = minutes(value); return Number.isFinite(m) ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : ''; }
export function prettyTime(value) { const m = minutes(value); if (!Number.isFinite(m)) return '—'; return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'PM' : 'AM'}`; }
export function duration(seconds) { const m = Math.floor(Math.max(0, Number(seconds) || 0) / 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }
export function validateSchedule(form) {
  const start = minutes(form.start_time); const end = minutes(form.end_time);
  if (!form.date || !Number.isFinite(start) || !Number.isFinite(end) || start < 600 || end > 1320 || start >= end) return 'Choose a date and working hours between 10 AM and 10 PM. End must be after start.';
  if (form.break_start || form.break_end) {
    const a = minutes(form.break_start); const b = minutes(form.break_end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < start || b > end || a >= b) return 'Enter both break times, within your working hours.';
  }
  return '';
}
export function canClockIn(day, now) {
  const s = day.schedule;
  if (day.active_clock || day.report || !Number(day.barber.is_active) || !Number(s.is_available) || s.work_date !== malaysiaDate(now)) return false;
  const current = minutes(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now));
  return current >= minutes(s.start_time) && current < minutes(s.end_time) && (!s.break_start || current < minutes(s.break_start) || current >= minutes(s.break_end));
}
export function downloadReport(report) {
  const d = report.data;
  const rows = [['Jat Barbershop daily report'], ['Barber', d.barber.name], ['Date', d.date], ['Timezone', d.timezone], ['Generated', report.generated_at], ['Worked hours', duration(d.summary.worked_seconds)], ['Completed booking value (RM)', Number(d.summary.completed_value).toFixed(2)], ['Legacy price rows', d.summary.legacy_prices], [], ['Booking ID', 'Customer', 'Phone', 'Service', 'Start', 'Minutes', 'Status', 'Booked price RM', 'Customer notes', 'Completion notes', 'Completed at'], ...d.appointments.map(a => [a.id, a.customer_name, a.customer_phone, a.service_name, a.appt_time, a.duration_minutes, a.status, a.service_price, a.notes, a.completion_notes, a.completed_at]), [], ['Clock in', 'Clock out', 'Worked', 'Closed by', 'Reason'], ...d.attendance.map(a => [a.clock_in, a.clock_out, duration(a.worked_seconds), a.closed_by_name, a.close_reason])];
  const cell = v => { let s = String(v ?? ''); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = `jat-report-${d.date}-barber-${d.barber.id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

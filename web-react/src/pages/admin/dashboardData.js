export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const STATUS_COLORS = { pending: '#d99633', confirmed: '#3f6f91', in_progress: '#76578f', completed: '#2d8065', cancelled: '#b64c45' };
export function summarize(appointments, year) {
  const selected = appointments.filter(a => String(a.appt_date).slice(0, 4) === String(year));
  const months = MONTHS.map((label, i) => ({ label, all: 0, completed: 0, month: i + 1 }));
  const statuses = Object.fromEntries(Object.keys(STATUS_COLORS).map(s => [s, 0]));
  for (const a of selected) {
    const bucket = months[Number(a.appt_date.slice(5, 7)) - 1];
    if (bucket) { bucket.all++; if (a.status === 'completed') bucket.completed++; }
    if (a.status in statuses) statuses[a.status]++;
  }
  return { selected, months, statuses, clients: new Set(selected.map(a => a.customer_id).filter(id => id != null)).size };
}
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function timeMinutes(time) {
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return 1440;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(match[2]);
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

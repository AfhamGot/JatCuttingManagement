// Base URL of your PHP backend's /api folder.
// During local dev with XAMPP this is set to: http://localhost/backend-php/api
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/backend-php/api';

function getToken() {
  return localStorage.getItem('jat_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('jat_token', token);
  else localStorage.removeItem('jat_token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('jat_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('jat_user', JSON.stringify(user));
  else localStorage.removeItem('jat_user');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/${path}`, {
    cache: 'no-store',
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch {
    throw new Error(`The PHP API returned an invalid response for ${path.split('?')[0]}. Check Apache and the PHP error log; if updating, import the schedule migration first.`);
  }
  if (!data || typeof data !== 'object') throw new Error('The API returned empty data. Check the backend installation.');

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  profile: () => request('profile.php'),
  saveProfile: body => request('profile.php', { method: 'PUT', body }),
  admins: () => request('admins.php'),
  createAdmin: body => request('admins.php', { method: 'POST', body }),
  products: () => request('products.php'),
  saveProduct: (id, body) => request(`products.php${id ? '?id=' + id : ''}`, { method: id ? 'PUT' : 'POST', body }),
  deleteProduct: (id, version) => request(`products.php?id=${id}`, { method: 'DELETE', body: { version } }),
  schedules: (date, barberId = '') => request(`schedules.php?${new URLSearchParams({ date, ...(barberId ? { barber_id: barberId } : {}) })}`),
  saveSchedule: (body) => request('schedules.php', { method: 'POST', body: { ...body, action: 'save' } }),
  finishSchedule: (barber_id, date) => request('schedules.php', { method: 'POST', body: { barber_id, date, action: 'finish' } }),
  shopQr: () => request('attendance_qr.php', { method: 'POST', body: {} }),
  clock: (action, barber_id, reason = '', qr_token = '') => request('attendance.php', { method: 'POST', body: { action, barber_id, reason, qr_token } }),
  reschedule: (id, body) => request(`appointments.php?id=${id}`, { method: 'PUT', body: { ...body, action: 'reschedule' } }),
  login: (email, password) => request('login.php', { method: 'POST', body: { email, password } }),
  logout: () => request('logout.php', { method: 'POST' }),
  me: () => request('me.php'),

  services: (all = false) => request(`services.php${all ? '?all=1' : ''}`),
  createService: (svc) => request('services.php', { method: 'POST', body: svc }),
  updateService: (id, svc) => request(`services.php?id=${id}`, { method: 'PUT', body: svc }),
  deleteService: (id) => request(`services.php?id=${id}`, { method: 'DELETE' }),

  barbers: (all = false) => request(`barbers.php${all ? '?all=1' : ''}`),
  createBarber: (b) => request('barbers.php', { method: 'POST', body: b }),
  updateBarber: (id, b) => request(`barbers.php?id=${id}`, { method: 'PUT', body: b }),
  deleteBarber: (id) => request(`barbers.php?id=${id}`, { method: 'DELETE' }),

  appointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`appointments.php${qs ? `?${qs}` : ''}`);
  },
  // `extra` lets callers attach fields beyond status, e.g. { completion_notes: '...' }
  // when marking an appointment completed.
  updateAppointmentStatus: (id, status, extra = {}) =>
    request(`appointments.php?id=${id}`, { method: 'PUT', body: { status, ...extra } }),
};

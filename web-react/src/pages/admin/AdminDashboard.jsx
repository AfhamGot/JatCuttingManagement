import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { api } from '../../api';
import StatusBadge from '../../components/StatusBadge';
import { summarize, STATUS_COLORS, localDate, timeMinutes, csvCell } from './dashboardData';
import './dashboard.css';

function Icon({ name }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
    cut: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 12 12M8 16 20 4"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    arrow: <path d="M6 18 18 6M6 6h12v12"/>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.people}</svg>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.appointments(), api.barbers(true), api.services(true)])
      .then(([a, b, s]) => { if (!cancelled) { setData({ appointments: a.appointments || [], barbers: b.barbers || [], services: s.services || [] }); setError(''); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);
  const summary = useMemo(() => summarize(data?.appointments || [], year), [data, year]);
  const years = [...new Set([String(new Date().getFullYear()), ...(data?.appointments || []).map(a => String(a.appt_date).slice(0, 4))])].sort().reverse();
  const refresh = () => { setLoading(true); setReload(v => v + 1); };
  const exportReport = () => {
    const rows = [['Date', 'Time', 'Customer', 'Barber', 'Service', 'Current service price (RM)', 'Status'], ...summary.selected.map(a => [a.appt_date, a.appt_time, a.customer_name, a.barber_name, a.service_name, a.service_price, a.status])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `jat-bookings-${year}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upcoming = (data?.appointments || []).filter(a => ['pending', 'confirmed', 'in_progress'].includes(a.status) && a.appt_date >= localDate()).sort((a, b) => a.appt_date.localeCompare(b.appt_date) || timeMinutes(a.appt_time) - timeMinutes(b.appt_time));
  const filtered = upcoming.filter(a => [a.customer_name, a.service_name, a.barber_name].some(v => String(v || '').toLowerCase().includes(search.toLowerCase())));
  const total = summary.selected.length;
  const maximum = Math.max(1, ...summary.months.map(m => m.all));
  let offset = 0;
  const gradient = Object.entries(summary.statuses).map(([status, count]) => { const start = offset; offset += total ? count / total * 100 : 0; return `${STATUS_COLORS[status]} ${start}% ${offset}%`; }).join(',');
  const cards = [
    ['Booking clients', summary.clients, `Unique booking customers · ${year}`, 'people', 'blue', '/admin/appointments'],
    ['Services', data?.services.length ?? 0, `${data?.services.filter(s => Number(s.is_active) === 1).length ?? 0} currently active`, 'cut', 'purple', '/admin/services'],
    ['Barbers', data?.barbers.length ?? 0, `${data?.barbers.filter(b => Number(b.is_active) === 1).length ?? 0} currently active`, 'people', 'green', '/admin/barbers'],
    ['Appointments', total, `All booking statuses · ${year}`, 'calendar', 'amber', '/admin/appointments'],
  ];
  return <main className="dashboard dashboard-original">
    <header className="dash-topbar"><div className="workspace-caption"><span className="live-dot"/> MANAGEMENT WORKSPACE</div><div className="dash-user"><span className="user-avatar">{user.name?.charAt(0)}</span><div><strong>{user.name}</strong><small>Administrator</small></div></div></header>
    <div className="dash-heading"><div><span className="eyebrow">YOUR SHOP, AT A GLANCE</span><h1>Dashboard</h1><p>Welcome back. Here’s what’s happening at Jat Barbershop.</p></div><div className="dash-tools"><label className="sr-only" htmlFor="dash-year">Report year</label><select id="dash-year" value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select><button className="btn btn-outline" onClick={refresh} disabled={loading}>Refresh</button><button className="btn btn-primary" onClick={exportReport} disabled={!data || loading || !!error}><Icon name="download"/> Export report</button></div></div>
    {error && <div className="alert alert-error" role="alert">Could not load dashboard: {error} <button className="btn btn-outline" onClick={refresh}>Retry</button></div>}
    {loading ? <div className="dash-loading" role="status">Loading your shop overview…</div> : !error && data && <>
      <section className="dash-stats" aria-label="Shop overview">{cards.map(([label, value, detail, icon, color, to]) => <Link to={to} className={`dash-stat ${color}`} key={label}><div className="stat-top"><span>{label}</span><span className="stat-arrow"><Icon name="arrow"/></span></div><div className="stat-number"><span className="stat-icon"><Icon name={icon}/></span>{value}</div><p>{detail}</p><div className="stat-accent"/></Link>)}</section>
      <div className="dash-charts">
        <section className="dash-panel"><div className="panel-heading"><div><h2>Booking activity</h2><p>Monthly appointments · {year}</p></div><span className="chart-tag">{total} bookings</span></div><div className="chart-legend"><span><i style={{ background: 'var(--brand)'  }}/>All bookings</span><span><i style={{ background: 'var(--gold)'  }}/>Completed</span></div>
          <div className="bar-chart" role="img" aria-label={`Monthly bookings in ${year}. ${summary.months.map(m => `${m.label}: ${m.all} bookings, ${m.completed} completed`).join('. ')}`}>
            <div className="chart-scale"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div><div className="bar-columns">{summary.months.map(m => <div className="bar-month" key={m.label}><div className="bar-pair" title={`${m.label}: ${m.all} bookings, ${m.completed} completed`}><span style={{ height: `${m.all / maximum * 100}%` }}/><span style={{ height: `${m.completed / maximum * 100}%` }}/></div><span className="month-label">{m.label}</span></div>)}</div>
          </div>{!total && <p className="chart-empty">No bookings recorded for {year} yet.</p>}
        </section>
        <section className="dash-panel"><div className="panel-heading"><div><h2>Booking status</h2><p>Distribution across {year}</p></div></div><div className="donut" style={{ background: total ? `conic-gradient(${gradient})` : 'var(--line)' }} role="img" aria-label={`${total} total bookings; ${Object.entries(summary.statuses).map(([s, n]) => `${s.replaceAll('_', ' ')} ${n}`).join(', ')}`}><div><strong>{total}</strong><span>Total bookings</span></div></div><div className="status-legend">{Object.entries(summary.statuses).map(([s, n]) => <div key={s}><span><i style={{ background: STATUS_COLORS[s] }}/>{s.replaceAll('_', ' ')}</span><b>{n}</b><small>{total ? Math.round(n / total * 100) : 0}%</small></div>)}</div></section>
      </div>
      <section className="dash-panel upcoming-panel"><div className="panel-heading"><div><h2>Upcoming bookings</h2><p>Today and later · all years · {upcoming.length} open appointments</p></div><Link className="btn btn-outline" to="/admin/appointments">View all bookings ↗</Link></div><div className="dash-search"><Icon name="search"/><input aria-label="Search upcoming bookings" placeholder="Search customer, barber or service…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Service</th><th>Barber</th><th>Date / time</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.slice(0, 8).map(a => <tr key={a.id}><td><strong>{a.customer_name}</strong><small>{a.customer_phone || 'No phone provided'}</small></td><td>{a.service_name}</td><td>{a.barber_name}</td><td>{a.appt_date}<small>{a.appt_time}</small></td><td><StatusBadge status={a.status}/></td><td><Link to="/admin/appointments" className="table-link">Manage ↗</Link></td></tr>)}</tbody></table></div>{!filtered.length && <div className="empty-state">{search ? 'No bookings match your search.' : 'No upcoming bookings. New appointments will appear here.'}</div>}{filtered.length > 8 && <p className="table-foot">Showing 8 of {filtered.length} bookings. Open View all bookings to see the full list.</p>}</section>
      <footer className="dash-footer">Jat Barbershop <span>Overview updates when opened or refreshed · Report follows selected year</span></footer>
    </>}
  </main>;
}

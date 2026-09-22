import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import StatusBadge from '../../components/StatusBadge';
import { malaysiaDate } from '../scheduleUtils';
import useLiveAppointments from '../useLiveAppointments';
import Modal from '../../components/Modal';

const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

export default function AdminAppointments() {
  const { appointments, loading, error, setError, load, updatedAt } = useLiveAppointments();
  const [detailsId, setDetailsId] = useState(null);
  const details = appointments.find(a => a.id === detailsId);
  const [statusFilter, setStatusFilter] = useState('');
  const [barberFilter, setBarberFilter] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(() => malaysiaDate());

  useEffect(() => {
    const timer = setInterval(() => setToday(malaysiaDate()), 30000);
    return () => clearInterval(timer);
  }, []);

  const barbers = useMemo(() => {
    const booked = new Map();
    appointments.forEach(a => {
      if (a.barber_id != null) booked.set(String(a.barber_id), a.barber_name || `Barber ${a.barber_id}`);
    });
    return [...booked].sort((a, b) => a[1].localeCompare(b[1]));
  }, [appointments]);
  const selectedBookings = useMemo(() => appointments.filter(a => !barberFilter || String(a.barber_id) === barberFilter), [appointments, barberFilter]);
  const visibleBookings = selectedBookings.filter(a => (!statusFilter || a.status === statusFilter) && (!todayOnly || a.appt_date === today));

  const stats = useMemo(() => {
    return {
      total: selectedBookings.length,
      today: selectedBookings.filter((a) => a.appt_date === today).length,
      pending: selectedBookings.filter((a) => a.status === 'pending').length,
      completed: selectedBookings.filter((a) => a.status === 'completed').length,
      revenue: selectedBookings
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + Number(a.service_price), 0),
    };
  }, [selectedBookings, today]);

  const changeStatus = async (id, status) => {
    if (saving) return;
    try {
      let extra = {};
      if (status === 'completed') {
        const notes = window.prompt('Enter completion details for this booking:');
        if (!notes?.trim()) return;
        extra = { completion_notes: notes.trim() };
      }
      setSaving(true);
      await api.updateAppointmentStatus(id, status, extra);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="hero">
        <div>
          <h1>Customer Bookings</h1>
          <p>Review customer bookings and choose a barber to see their appointments.</p>
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat-card"><div className="num">{loading || error ? '—' : stats.total}</div><div className="label">Customer Bookings</div></div>
        <div className="stat-card"><div className="num">{loading || error ? '—' : stats.today}</div><div className="label">Today</div></div>
        <div className="stat-card"><div className="num">{loading || error ? '—' : stats.pending}</div><div className="label">Pending</div></div>
        <div className="stat-card"><div className="num">{loading || error ? '—' : stats.completed}</div><div className="label">Completed</div></div>
        <div className="stat-card"><div className="num">{loading || error ? '—' : `RM ${stats.revenue.toFixed(2)}`}</div><div className="label">Revenue (completed)</div></div>
      </div>

      <div className="main" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="filters">
            <label>Barber<select aria-label="Select barber" value={barberFilter} onChange={e => setBarberFilter(e.target.value)}>
              <option value="">All barbers with bookings</option>
              {barbers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></label>
            <label>Status<select aria-label="Booking status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
            </select></label>
            <label>Date<select aria-label="Booking date" value={todayOnly ? 'today' : 'all'} onChange={e => setTodayOnly(e.target.value === 'today')}>
              <option value="all">All dates</option><option value="today">Today only</option>
            </select></label>
            <button className="btn btn-outline" disabled={loading || saving} onClick={() => load()}>Refresh</button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>Totals apply to {barberFilter ? barbers.find(([id]) => id === barberFilter)?.[1] : 'all barbers'}. Today uses Malaysia time. Status and date filters narrow the booking list.</p>

          <p style={{ color: 'var(--muted)', fontSize: 12 }}>Refreshes every 15 seconds while visible. {updatedAt && `Last checked ${updatedAt.toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} MYT.`}</p>
          {error && <div className="error-text" role="alert">{error}</div>}
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : error ? null : visibleBookings.length === 0 ? (
            <div className="empty-state">No customer bookings match these filters.</div>
          ) : (
            <div className="table-wrap"><table>
              <thead>
                <tr>
                  <th>Date / Time</th><th>Customer</th><th>Barber</th><th>Service</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((a) => (
                  <tr key={a.id}>
                    <td>{a.appt_date}<br /><span style={{ color: 'var(--text-grey)' }}>{a.appt_time}</span></td>
                    <td>{a.customer_name}<br /><span style={{ color: 'var(--text-grey)' }}>{a.customer_phone}</span></td>
                    <td>{a.barber_name}</td>
                    <td>{a.service_name}<br /><span style={{ color: 'var(--text-grey)' }}>RM {Number(a.service_price).toFixed(2)}</span></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="actions-cell">
                      <button className="btn btn-outline" onClick={() => setDetailsId(a.id)}>Details</button>
                      <select aria-label={`Change status for booking ${a.id}`} disabled={saving} value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)}>
                        {[a.status, ...({ pending: ['confirmed', 'cancelled'], confirmed: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'] }[a.status] || [])].map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
      {details && <Modal title={`Booking #${details.id}`} onClose={() => setDetailsId(null)}>
        {[['Customer', details.customer_name], ['Phone', details.customer_phone], ['Selected barber', details.barber_name], ['Service', details.service_name], ['Date', details.appt_date], ['Time', details.appt_time], ['Duration', `${details.duration_minutes} minutes`], ['Price', `RM ${Number(details.service_price).toFixed(2)}`], ['Status', details.status.replaceAll('_', ' ')], ['Customer notes', details.notes], ['Completion notes', details.completion_notes], ['Completed at', details.completed_at]].map(([label,value]) => <div className="detail-row" key={label}><span className="detail-label">{label}</span><span className="detail-value" style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{value || '—'}</span></div>)}
      </Modal>}
    </>
  );
}

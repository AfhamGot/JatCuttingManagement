import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import useLiveAppointments from '../useLiveAppointments';
import { malaysiaDate } from '../scheduleUtils';

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'in_progress',
  in_progress: 'completed',
};
const NEXT_LABEL = {
  pending: 'Confirm',
  confirmed: 'Start',
  in_progress: 'Mark Completed',
};

export default function BarberAppointments() {
  const { user } = useAuth();
  const { appointments, loading, error, setError, load, updatedAt } = useLiveAppointments();

  // Appointment currently shown in the "view details" modal (booked appointment details).
  const [detailsAppt, setDetailsAppt] = useState(null);

  // Appointment currently being marked completed (completion details form).
  const [completingAppt, setCompletingAppt] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const stats = useMemo(() => {
    const today = malaysiaDate();
    return {
      total: appointments.length,
      today: appointments.filter((a) => a.appt_date === today).length,
      pending: appointments.filter((a) => a.status === 'pending').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
    };
  }, [appointments]);

  const advance = async (a) => {
    // Completing a job needs completion details first, so open that modal instead
    // of advancing immediately.
    if (NEXT_STATUS[a.status] === 'completed') {
      setCompletingAppt(a);
      setCompletionNotes('');
      setCompletionError('');
      return;
    }
    try { await api.updateAppointmentStatus(a.id, NEXT_STATUS[a.status]); load(); }
    catch (e) { setError(e.message); }
  };

  const cancel = async (a) => {
    if (!confirm('Cancel this appointment?')) return;
    try { await api.updateAppointmentStatus(a.id, 'cancelled'); load(); }
    catch (e) { setError(e.message); }
  };

  const submitCompletion = async (e) => {
    e.preventDefault();
    if (!completionNotes.trim()) {
      setCompletionError('Please describe what was done before marking this appointment complete.');
      return;
    }
    setSubmitting(true);
    setCompletionError('');
    try {
      await api.updateAppointmentStatus(completingAppt.id, 'completed', {
        completion_notes: completionNotes.trim(),
      });
      setCompletingAppt(null);
      load();
    } catch (err) {
      setCompletionError(err.message || 'Failed to save completion details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="hero">
        <div>
          <h1>Hi, {user.name.split(' ')[0]} 👋</h1>
          <p>{user.specialty || 'Your appointment schedule'}</p>
        </div>
        <Link className="btn btn-ghost" to="/barber/schedule" style={{ position: 'relative', zIndex: 2, textDecoration: 'none' }}>Manage schedule</Link>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="num">{stats.total}</div><div className="label">Customer Bookings</div></div>
        <div className="stat-card"><div className="num">{stats.today}</div><div className="label">Today</div></div>
        <div className="stat-card"><div className="num">{stats.pending}</div><div className="label">Pending</div></div>
        <div className="stat-card"><div className="num">{stats.completed}</div><div className="label">Completed</div></div>
      </div>

      <div className="main" style={{ paddingTop: 0 }}>
        <div className="card">
          <strong>My Customer Bookings</strong>
          <p>Bookings assigned to you by customers. Refreshes every 15 seconds while visible. {updatedAt && `Last checked ${updatedAt.toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })} MYT.`}</p>
          <button className="btn btn-outline" disabled={loading} onClick={() => load()}>Refresh</button>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : appointments.length === 0 ? (
            <div className="empty-state">No appointments assigned to you yet.</div>
          ) : (
            <div className="table-wrap"><table style={{ marginTop: 12 }}>
              <thead><tr><th>Date / Time</th><th>Customer</th><th>Service</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.appt_date}<br /><span style={{ color: 'var(--text-grey)' }}>{a.appt_time}</span></td>
                    <td>{a.customer_name}<br /><span style={{ color: 'var(--text-grey)' }}>{a.customer_phone}</span></td>
                    <td>{a.service_name}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="actions-cell">
                      <button className="btn btn-outline" onClick={() => setDetailsAppt(a)}>Details</button>
                      {NEXT_STATUS[a.status] && (
                        <button className="btn btn-primary" onClick={() => advance(a)}>{NEXT_LABEL[a.status]}</button>
                      )}
                      {a.status !== 'completed' && a.status !== 'cancelled' && (
                        <button className="btn btn-danger" onClick={() => cancel(a)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {/* Booked appointment details */}
      {detailsAppt && (
        <Modal title="Appointment Details" onClose={() => setDetailsAppt(null)}>
          <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><StatusBadge status={detailsAppt.status} /></span></div>
          <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{detailsAppt.appt_date}</span></div>
          <div className="detail-row"><span className="detail-label">Time</span><span className="detail-value">{detailsAppt.appt_time}</span></div>
          <div className="detail-row"><span className="detail-label">Customer</span><span className="detail-value">{detailsAppt.customer_name}</span></div>
          <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{detailsAppt.customer_phone || '-'}</span></div>
          <div className="detail-row"><span className="detail-label">Service</span><span className="detail-value">{detailsAppt.service_name}</span></div>
          <div className="detail-row"><span className="detail-label">Price</span><span className="detail-value">RM {parseFloat(detailsAppt.service_price).toFixed(2)}</span></div>
          {detailsAppt.duration_minutes != null && (
            <div className="detail-row"><span className="detail-label">Duration</span><span className="detail-value">{detailsAppt.duration_minutes} mins</span></div>
          )}
          <div className="detail-row"><span className="detail-label">Booked on</span><span className="detail-value">{detailsAppt.created_at}</span></div>
          {detailsAppt.notes && (
            <div className="detail-row"><span className="detail-label">Customer notes</span><span className="detail-value">{detailsAppt.notes}</span></div>
          )}
          {detailsAppt.completion_notes && (
            <div className="detail-row"><span className="detail-label">Completion details</span><span className="detail-value">{detailsAppt.completion_notes}</span></div>
          )}
        </Modal>
      )}

      {/* Completion details form */}
      {completingAppt && (
        <Modal
          title="Mark Appointment Completed"
          onClose={() => (submitting ? null : setCompletingAppt(null))}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setCompletingAppt(null)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" form="completion-form" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save & Complete'}
              </button>
            </>
          }
        >
          <form id="completion-form" onSubmit={submitCompletion}>
            <p style={{ marginTop: 0, color: 'var(--text-grey)', fontSize: 13 }}>
              {completingAppt.customer_name} — {completingAppt.service_name} on {completingAppt.appt_date} at {completingAppt.appt_time}
            </p>
            <div className="form-row">
              <label>What was done / notes for the customer's record *</label>
              <textarea
                rows={4}
                autoFocus
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="e.g. Fade + beard shape-up. Recommend trim again in 3 weeks."
              />
            </div>
            {completionError && <div className="error-text">{completionError}</div>}
          </form>
        </Modal>
      )}
    </>
  );
}

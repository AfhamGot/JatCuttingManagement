import { useState, useEffect } from 'react';
import { api } from '../../api';
import AddRecordForm from '../../components/AddRecordForm';

export default function AdminBarbers() {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchBarbers = async () => {
    setLoading(true);
    try {
      // Menghantar param true untuk ?all=1 supaya Admin nampak semua barber (termasuk yang inactive)
      const res = await api.barbers(true);
      const list = res?.barbers || (Array.isArray(res) ? res : []);
      setBarbers(list);
      setError('');
    } catch (err) {
      console.error('Fetch Barbers Error:', err);
      setError(err.message || 'Gagal mengambil senarai barber.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarbers();
  }, []);

  const toggleStatus = async (barber) => {
    try {
      const nextActive = Number(barber.is_active) === 1 ? 0 : 1;
      await api.updateBarber(barber.id, { is_active: nextActive });
      setSuccess(nextActive ? 'Activated successfully.' : 'Deactivated successfully.');
      fetchBarbers();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeBarber = async (barber) => {
    if (busy || !window.confirm(`Permanently delete "${barber.name}"? This cannot be undone. Records with appointments cannot be deleted; use Deactivate instead.`)) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.deleteBarber(barber.id);
      setSuccess('Deleted successfully.');
      await fetchBarbers();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="main page-stack">
      <div className="page-heading"><div><span className="eyebrow">Team</span><h1>Barber Management</h1><p>Add staff members and manage their availability.</p></div><div className="page-tools"><span className="count-pill">{barbers.length} barbers</span><button type="button" className="btn btn-primary" onClick={() => { setSuccess(''); setEditing(null); setShowForm(true); }}>+ Add Barber</button></div></div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && <div className="alert alert-success" role="status">{success}</div>}
      {showForm && <AddRecordForm kind="barber" records={barbers} initialRecord={editing} onClose={() => setShowForm(false)} onSaved={() => {
        setShowForm(false);
        setSuccess(editing ? 'Changes saved successfully.' : 'Added successfully.');
        fetchBarbers();
      }} />}

      <div className="card table-card">
        {loading ? (
          <div className="empty-state">Loading barbers...</div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Specialty</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {barbers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No barbers found.
                  </td>
                </tr>
              ) : (
                barbers.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td><td>{b.email || '-'}</td><td>{b.phone || '-'}</td><td>{b.specialty || '-'}</td><td>
                      <span className={`state-pill ${Number(b.is_active) === 1 ? 'active' : 'inactive'}`}>
                        {Number(b.is_active) === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-small btn-outline" disabled={busy} onClick={() => { setEditing(b); setSuccess(''); setShowForm(true); }}>Edit</button>
                      <button
                        onClick={() => toggleStatus(b)}
                        className="btn btn-small btn-outline"
                      >
                        {Number(b.is_active) === 1 ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        disabled={busy} onClick={() => removeBarber(b)}
                        className="btn btn-small btn-danger-soft"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

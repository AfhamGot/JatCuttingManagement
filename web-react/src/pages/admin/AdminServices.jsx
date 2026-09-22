import { useState, useEffect } from 'react';
import { api } from '../../api';
import AddRecordForm from '../../components/AddRecordForm';

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchServices = async () => {
    setLoading(true);
    try {
      // Menghantar param true untuk ?all=1 supaya Admin nampak semua service
      const res = await api.services(true);
      const list = res?.services || (Array.isArray(res) ? res : []);
      setServices(list);
      setError('');
    } catch (err) {
      console.error('Fetch Services Error:', err);
      setError(err.message || 'Gagal mengambil senarai perkhidmatan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const toggleStatus = async (service) => {
    try {
      // Guna Number() sebab PHP/PDO pulangkan is_active sebagai string "0"/"1",
      // dan string "0" adalah truthy dalam JS - punca "Activate" tak berfungsi sebelum ini.
      const nextActive = Number(service.is_active) === 1 ? 0 : 1;
      await api.updateService(service.id, { is_active: nextActive });
      setSuccess(nextActive ? 'Activated successfully.' : 'Deactivated successfully.');
      fetchServices();
    } catch (err) {
      alert(err.message);
    }
  };

  const removeService = async (service) => {
    if (busy || !window.confirm(`Permanently delete "${service.name}"? This cannot be undone. Records with appointments cannot be deleted; use Deactivate instead.`)) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api.deleteService(service.id);
      setSuccess('Deleted successfully.');
      await fetchServices();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="main page-stack">
      <div className="page-heading"><div><span className="eyebrow">Catalogue</span><h1>Service Management</h1><p>Keep your haircut menu, prices and duration up to date.</p></div><div className="page-tools"><span className="count-pill">{services.length} services</span><button type="button" className="btn btn-primary" onClick={() => { setSuccess(''); setEditing(null); setShowForm(true); }}>+ Add Service</button></div></div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && <div className="alert alert-success" role="status">{success}</div>}
      {showForm && <AddRecordForm kind="service" records={services} initialRecord={editing} onClose={() => setShowForm(false)} onSaved={() => {
        setShowForm(false);
        setSuccess(editing ? 'Changes saved successfully.' : 'Added successfully.');
        fetchServices();
      }} />}

      <div className="card table-card">
        {loading ? (
          <div className="empty-state">Loading services...</div>
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr><th>Name</th><th>Description</th><th>Price (RM)</th><th>Duration</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No services found.
                  </td>
                </tr>
              ) : (
                services.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td><td>{s.description || '-'}</td><td>RM {parseFloat(s.price).toFixed(2)}</td><td>{s.duration_minutes} mins</td><td>
                      <span className={`state-pill ${Number(s.is_active) === 1 ? 'active' : 'inactive'}`}>
                        {Number(s.is_active) === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-small btn-outline" disabled={busy} onClick={() => { setEditing(s); setSuccess(''); setShowForm(true); }}>Edit</button>
                      <button
                        onClick={() => toggleStatus(s)}
                        className="btn btn-small btn-outline"
                      >
                        {Number(s.is_active) === 1 ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-small btn-danger-soft" disabled={busy} onClick={() => removeService(s)}>Delete</button>
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

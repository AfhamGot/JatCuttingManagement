import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export default function useLiveAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const sequence = useRef(0), mounted = useRef(false), pending = useRef(false);
  const load = useCallback(async (quiet = false) => {
    if (quiet && pending.current) return;
    const id = ++sequence.current; pending.current = true;
    if (!quiet) setLoading(true);
    try {
      const data = await api.appointments();
      if (!Array.isArray(data.appointments)) throw new Error('Could not read bookings from the server. Please retry.');
      if (mounted.current && id === sequence.current) { setAppointments(data.appointments); setError(''); setUpdatedAt(new Date()); }
    } catch (e) { if (mounted.current && id === sequence.current) setError(e.message); }
    finally { if (id === sequence.current) { pending.current = false; if (mounted.current) setLoading(false); } }
  }, []);
  useEffect(() => {
    mounted.current = true; load();
    const refresh = () => { if (document.visibilityState === 'visible') load(true); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { mounted.current = false; sequence.current++; pending.current = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  return { appointments, loading, error, setError, load, updatedAt };
}

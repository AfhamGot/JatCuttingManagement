import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';
import './schedule.css';

export default function ShopQrDisplay() {
  const [code, setCode] = useState(null); const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false, timer, expiryTimer, ticker;
    async function refresh() {
      // Start measuring before request: network delay never extends displayed life.
      const started = performance.now();
      try {
        const result = await api.shopQr();
        const svg = await QRCode.toString(result.token, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
        if (disposed) return;
        const ttl = (result.expires_at - result.server_now) * 1000;
        const left = ttl - (performance.now() - started);
        if (left <= 0) throw new Error('Connection too slow. Retry to get a fresh code.');
        clearTimeout(expiryTimer); clearInterval(ticker);
        setCode('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); setError('');
        const update = () => setRemaining(Math.max(0, Math.ceil((ttl - performance.now() + started) / 1000)));
        update(); ticker = setInterval(update, 250);
        expiryTimer = setTimeout(() => { setCode(null); setRemaining(0); }, left);
        timer = setTimeout(refresh, Math.max(1000, result.refresh_after * 1000 - performance.now() + started));
      } catch (e) {
        if (disposed) return;
        setCode(null); setRemaining(0); setError(e.message); timer = setTimeout(refresh, 5000);
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') setAttempt(a => a + 1); };
    document.addEventListener('visibilitychange', onVisible); refresh();
    return () => { disposed = true; clearTimeout(timer); clearTimeout(expiryTimer); clearInterval(ticker); document.removeEventListener('visibilitychange', onVisible); };
  }, [attempt]);
  return <main className="main schedule-workspace shop-qr"><span className="eyebrow">Jat Barbershop · Staff attendance</span><h1>Shop attendance QR</h1>
    <p>Keep this screen on the shop tablet or PC. Barbers scan it from My Schedule → Attendance on their own phone.</p>
    <section className="card"><h2>Scan to clock in or out</h2>
      {code && remaining > 0 ? <img className="shop-qr-image" src={code} alt="Live shop attendance QR code"/> : <div className="empty-state">{error ? 'Code unavailable. Reconnecting…' : 'Getting a fresh code…'}</div>}
      <p aria-live="off">{code && remaining > 0 ? `Expires in ${remaining}s · refreshes automatically` : 'Do not scan an old screenshot.'}</p>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <button className="btn btn-outline" onClick={() => setAttempt(a => a + 1)}>Refresh code</button>
    </section><p className="schedule-muted">Keep this admin device supervised. Never share the code remotely.</p>
  </main>;
}

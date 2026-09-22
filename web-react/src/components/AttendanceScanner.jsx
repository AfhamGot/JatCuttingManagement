import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

export default function AttendanceScanner({ action, name, busy, error, onConfirm }) {
  const video = useRef(null);
  const [token, setToken] = useState(''); const [cameraError, setCameraError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera scanning requires HTTPS and camera permission. Open the secure staff website on your phone.'); return;
    }
    const scanner = new QrScanner(video.current, result => {
      if (disposed) return;
      if (!/^JATQR1\.[a-f0-9]{64}$/.test(result.data)) { setCameraError('This is not a Jat attendance QR code. Scan the shop display.'); return; }
      scanner.stop(); setCameraError(''); setToken(result.data);
    }, { preferredCamera: 'environment', maxScansPerSecond: 5, highlightScanRegion: true, returnDetailedScanResult: true });
    scanner.start().catch(() => { if (!disposed) setCameraError('Camera could not start. Allow camera access, close other camera apps, then retry.'); });
    return () => { disposed = true; scanner.destroy(); };
  }, [attempt]);
  const retry = () => { setToken(''); setCameraError(''); setAttempt(a => a + 1); };
  return <div className="registration-body qr-scan">
    <p>Signed in as <strong>{name}</strong>. Scan the live code on the shop tablet to {action === 'clock_in' ? 'clock in' : 'clock out'}.</p>
    <video ref={video} muted playsInline aria-label="QR scanner camera" className={token ? 'qr-video-hidden' : ''}/>
    {cameraError && <p role="alert" className="alert alert-error">{cameraError}</p>}
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    {token && <p role="status">Code scanned. Confirm promptly before it expires.</p>}
    <div className="schedule-actions">
      {token && <button className="btn btn-primary" disabled={busy} onClick={() => onConfirm(token)}>{busy ? 'Recording…' : action === 'clock_in' ? 'Confirm clock-in' : 'Confirm clock-out'}</button>}
      <button className="btn btn-outline" disabled={busy} onClick={retry}>{token ? 'Scan again' : 'Retry camera'}</button>
    </div>
  </div>;
}

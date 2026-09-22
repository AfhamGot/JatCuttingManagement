import { useEffect, useRef } from 'react';
export default function ScheduleDialog({ title, children, onClose, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="registration-dialog schedule-dialog" aria-labelledby="schedule-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="registration-heading"><h2 id="schedule-dialog-title">{title}</h2><button type="button" className="registration-close" disabled={busy} onClick={onClose} aria-label="Close">×</button></div>{children}
  </dialog>;
}

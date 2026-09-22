const LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }) {
  return (
    <span className="badge" style={{ background: `var(--status-${status})` }}>
      {LABELS[status] || status}
    </span>
  );
}

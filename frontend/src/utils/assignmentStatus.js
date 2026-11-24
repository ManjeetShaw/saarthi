// One place that turns an assignment's flags into what the UI shows, so the
// dashboard, course page, list and detail page can never disagree.

const DAY = 86400000;

// state: 'acknowledged' | 'late' | 'overdue' | 'pending'
export function getAssignmentState(a) {
  if (a.is_acknowledged) return a.is_late ? 'late' : 'acknowledged';
  if (a.is_overdue) return 'overdue';
  return 'pending';
}

export const STATE_META = {
  acknowledged: { label: 'Acknowledged', variant: 'success' },
  late: { label: 'Acknowledged late', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'error' },
  pending: { label: 'Pending', variant: 'accent' },
};

// "Due in 3 days", "Due today", "Overdue by 2 days"
export function describeDeadline(dueDate, now = Date.now()) {
  const diff = new Date(dueDate).getTime() - now;
  const days = Math.ceil(Math.abs(diff) / DAY);
  if (diff >= 0) {
    if (diff < DAY) {
      const hours = Math.max(1, Math.ceil(diff / 3600000));
      return diff < 3600000 * 2 ? 'Due within the hour' : `Due in ${hours} hours`;
    }
    return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
  }
  if (Math.abs(diff) < DAY) return 'Overdue since today';
  return days === 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`;
}

// Share of the time window (created -> due) that has already passed, 0-100.
export function timeElapsedPercent(createdAt, dueDate, now = Date.now()) {
  const start = new Date(createdAt).getTime();
  const end = new Date(dueDate).getTime();
  if (!(end > start)) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export function percentOf(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

// Secondary line under an assignment title. Finished work just shows its
// date: "Overdue by 3 days" would be wrong for something acknowledged on time.
export function deadlineLine(a, formatDate) {
  const date = formatDate(a.due_date);
  return a.is_acknowledged ? `Due ${date}` : `${describeDeadline(a.due_date)} · ${date}`;
}

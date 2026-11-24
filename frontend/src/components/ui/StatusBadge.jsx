import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import Badge from './Badge.jsx';
import { getAssignmentState, STATE_META } from '../../utils/assignmentStatus.js';

// Pass an assignment-like object ({ is_acknowledged, is_late, is_overdue })
// or an explicit `state`. Always the same wording and colour everywhere.
export default function StatusBadge({ assignment, state, size = 'md' }) {
  const resolved = state || getAssignmentState(assignment || {});
  const meta = STATE_META[resolved] || STATE_META.pending;
  const Icon = resolved === 'acknowledged' || resolved === 'late' ? Check : resolved === 'overdue' ? AlertTriangle : Clock;

  return (
    <Badge variant={meta.variant} size={size}>
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {meta.label}
    </Badge>
  );
}

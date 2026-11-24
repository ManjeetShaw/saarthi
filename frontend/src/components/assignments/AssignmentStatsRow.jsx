import React from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, BarChart3 } from 'lucide-react';
import TypeBadge from '../ui/TypeBadge.jsx';
import StackedProgress from '../ui/StackedProgress.jsx';
import { courseAccent } from '../../utils/courseTheme.js';
import { formatDate } from '../../utils/formatters.js';
import { percentOf } from '../../utils/assignmentStatus.js';

// One assignment as the professor sees it: type, deadline and the class's
// acknowledged / pending / overdue split, with edit, delete and a link to the
// detailed tracking view.
export default function AssignmentStatsRow({ assignment: a, showCourse = false, onEdit, onDelete }) {
  const pct = percentOf(a.acknowledged_count, a.total_students);
  const accent = courseAccent(a.course_id);

  return (
    <div className="bg-white rounded-2xl border border-[#e1e3e4] px-5 py-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {showCourse && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: accent.soft, color: accent.hex }}>
              {a.course_code}
            </span>
          )}
          <TypeBadge type={a.submission_type} size="sm" />
        </div>
        <p className="font-semibold text-[#191c1d] truncate">{a.title}</p>
        <p className="text-xs text-[#717973] mt-0.5">Due {formatDate(a.due_date)}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs mb-1.5">
          <span className="text-[#414844]">{a.acknowledged_count} of {a.total_students} acknowledged</span>
          <span className="font-bold text-[#191c1d]">{pct}%</span>
        </div>
        <StackedProgress acknowledged={a.acknowledged_count} pending={a.pending_count} overdue={a.overdue_count} size="sm" />
        {a.overdue_count > 0 && <p className="text-[11px] text-[#D90429] font-semibold mt-1.5">{a.overdue_count} overdue</p>}
      </div>

      <div className="flex items-center gap-1 justify-end">
        <Link
          to={`/admin/submissions?assignment=${a.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#012d1d] hover:bg-[#012d1d]/8 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" /> Track
        </Link>
        {onEdit && (
          <button type="button" onClick={() => onEdit(a)} aria-label={`Edit ${a.title}`} className="p-2 rounded-lg text-[#717973] hover:bg-[#f3f4f5] hover:text-[#191c1d] transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={() => onDelete(a)} aria-label={`Delete ${a.title}`} className="p-2 rounded-lg text-[#717973] hover:bg-[#D90429]/10 hover:text-[#D90429] transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

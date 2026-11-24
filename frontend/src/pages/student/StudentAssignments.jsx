import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import Select from '../../components/ui/Select.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import { getMyAssignmentsApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { getAssignmentState, deadlineLine } from '../../utils/assignmentStatus.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { formatDate } from '../../utils/formatters.js';
import { FileText, ChevronRight } from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'To do' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Acknowledged' },
];

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setAssignments((await getMyAssignmentsApi()) || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load your assignments.'));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const courses = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => map.set(a.course_id, `${a.course_code} · ${a.course_title}`));
    return [...map.entries()];
  }, [assignments]);

  const counts = useMemo(() => ({
    all: assignments.length,
    pending: assignments.filter((a) => getAssignmentState(a) === 'pending').length,
    overdue: assignments.filter((a) => getAssignmentState(a) === 'overdue').length,
    done: assignments.filter((a) => a.is_acknowledged).length,
  }), [assignments]);

  const visible = assignments.filter((a) => {
    if (courseId !== 'all' && String(a.course_id) !== courseId) return false;
    if (filter === 'pending') return getAssignmentState(a) === 'pending';
    if (filter === 'overdue') return getAssignmentState(a) === 'overdue';
    if (filter === 'done') return a.is_acknowledged;
    return true;
  });

  return (
    <DashboardLayout title="Assignments" subtitle="Everything across your courses">
      <div className="space-y-5 pb-12">
        <FormAlert message={error} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filter === f.id ? 'bg-[#012d1d] text-white border-[#012d1d]' : 'bg-white text-[#414844] border-[#c1c8c2] hover:bg-[#f3f4f5]'
                }`}
              >
                {f.label} <span className={filter === f.id ? 'text-white/70' : 'text-[#717973]'}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
          {courses.length > 1 && (
            <div className="w-full md:w-64">
              <Select aria-label="Filter by course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="all">All courses</option>
                {courses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-[#717973]">Loading assignments…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={assignments.length === 0 ? 'No assignments yet' : 'Nothing matches this filter'}
            message={assignments.length === 0 ? 'Assignments from your enrolled courses will appear here.' : 'Try a different filter.'}
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/student/assignments/${a.id}`}
                  className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 bg-white rounded-2xl border border-[#e1e3e4] px-5 py-4 hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-[#012d1d]"
                >
                  <span
                    className="inline-block self-start w-16 text-center text-xs font-bold py-1 rounded-lg shrink-0"
                    style={{ backgroundColor: courseAccent(a.course_id).soft, color: courseAccent(a.course_id).hex }}
                  >
                    {a.course_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#191c1d]">{a.title}</p>
                    <p className={`text-xs mt-1 ${a.is_overdue ? 'text-[#D90429] font-semibold' : 'text-[#717973]'}`}>
                      {deadlineLine(a, formatDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={a.submission_type} size="sm" />
                    <StatusBadge assignment={a} size="sm" />
                    <ChevronRight className="w-4 h-4 text-[#c1c8c2] hidden md:block" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}

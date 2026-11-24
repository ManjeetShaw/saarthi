import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import StackedProgress from '../../components/ui/StackedProgress.jsx';
import Select from '../../components/ui/Select.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import { getAllAssignmentsApi } from '../../api/assignments.js';
import { getAssignmentTrackingApi } from '../../api/submissions.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { getAssignmentState } from '../../utils/assignmentStatus.js';
import { formatDate } from '../../utils/formatters.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { Crown, ClipboardList, AlertTriangle } from 'lucide-react';

// A tracking row carries status as text; reuse the shared state logic.
const rowState = (row) => getAssignmentState({
  is_acknowledged: row.status === 'acknowledged',
  is_late: row.is_late,
  is_overdue: row.is_overdue,
});

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'pending', label: 'Pending' },
  { id: 'overdue', label: 'Overdue' },
];

export default function AdminSubmissionTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [status, setStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');

  const selectedId = searchParams.get('assignment') || (assignments[0] ? String(assignments[0].id) : '');

  useEffect(() => {
    (async () => {
      try {
        setAssignments((await getAllAssignmentsApi()) || []);
      } catch (err) {
        setError(getErrorMessage(err, 'Could not load assignments.'));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const loadTracking = useCallback(async () => {
    if (!selectedId) return;
    try {
      setIsFetching(true);
      setError('');
      setTracking(await getAssignmentTrackingApi(selectedId, status));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load submissions.'));
    } finally {
      setIsFetching(false);
    }
  }, [selectedId, status]);

  useEffect(() => { loadTracking(); }, [loadTracking]);

  const grouped = assignments.reduce((acc, a) => {
    (acc[a.course_code] = acc[a.course_code] || []).push(a);
    return acc;
  }, {});

  const a = tracking?.assignment;
  const summary = tracking?.summary;
  const isGroup = a?.submission_type === 'group';
  const counts = summary && {
    all: summary.total, acknowledged: summary.acknowledged, pending: summary.pending, overdue: summary.overdue,
  };

  return (
    <DashboardLayout title="Submissions" subtitle="See who has acknowledged each assignment">
      <div className="space-y-6 pb-12">
        <FormAlert message={error} />

        {!isLoading && assignments.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No assignments to track" message="Once you post an assignment, student progress appears here." />
        ) : (
          <>
            <div className="max-w-md">
              <Select
                label="Assignment"
                value={selectedId}
                onChange={(e) => { setStatus('all'); setSearchParams({ assignment: e.target.value }); }}
              >
                {Object.entries(grouped).map(([code, list]) => (
                  <optgroup key={code} label={code}>
                    {list.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </optgroup>
                ))}
              </Select>
            </div>

            {a && summary && (
              <>
                <div className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: courseAccent(a.course_id).hex }} />
                  <div className="p-6 grid gap-6 md:grid-cols-[1fr_20rem] items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <TypeBadge type={a.submission_type} size="sm" />
                        <span className="text-xs text-[#717973]">{a.course_code} · due {formatDate(a.due_date)}</span>
                      </div>
                      <h2 className="text-xl font-bold text-[#191c1d]">{a.title}</h2>
                      {isGroup && summary.without_group > 0 && (
                        <p className="flex items-center gap-2 text-xs text-[#b56000] mt-3">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {summary.without_group} {summary.without_group === 1 ? 'student has' : 'students have'} no group yet and cannot be acknowledged for.
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-[#414844]">{summary.acknowledged} of {summary.total} acknowledged</span>
                        <span className="text-2xl font-bold text-[#191c1d]">{summary.percent}%</span>
                      </div>
                      <StackedProgress acknowledged={summary.acknowledged} pending={summary.pending} overdue={summary.overdue} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={status === f.id}
                      onClick={() => setStatus(f.id)}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        status === f.id ? 'bg-[#012d1d] text-white border-[#012d1d]' : 'bg-white text-[#414844] border-[#c1c8c2] hover:bg-[#f3f4f5]'
                      }`}
                    >
                      {f.label} <span className={status === f.id ? 'text-white/70' : 'text-[#717973]'}>{counts[f.id]}</span>
                    </button>
                  ))}
                </div>

                <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                  {isGroup && (
                    <section aria-labelledby="by-group" className="mb-8">
                      <h3 id="by-group" className="font-bold text-[#191c1d] mb-3">Groups <span className="text-[#717973] font-medium">({tracking.groups.length})</span></h3>
                      {tracking.groups.length === 0 ? (
                        <EmptyState title="No groups match this filter" />
                      ) : (
                        <div className="bg-white rounded-2xl border border-[#e1e3e4] overflow-x-auto">
                          <table className="w-full text-sm min-w-[620px]">
                            <thead>
                              <tr className="text-left text-xs text-[#717973] border-b border-[#f3f4f5]">
                                <th className="font-medium px-5 py-3">Group</th>
                                <th className="font-medium px-3 py-3">Leader</th>
                                <th className="font-medium px-3 py-3">Members</th>
                                <th className="font-medium px-3 py-3">Status</th>
                                <th className="font-medium px-3 py-3">Acknowledged</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f3f4f5]">
                              {tracking.groups.map((g) => (
                                <tr key={g.id}>
                                  <td className="px-5 py-3 font-semibold text-[#191c1d]">{g.name}</td>
                                  <td className="px-3 py-3 text-[#414844]"><Crown className="inline w-3.5 h-3.5 text-[#FB8500] mr-1.5 -mt-0.5" />{g.leader_name}</td>
                                  <td className="px-3 py-3 text-[#414844]">{g.member_count}</td>
                                  <td className="px-3 py-3"><StatusBadge state={rowState(g)} size="sm" /></td>
                                  <td className="px-3 py-3 text-xs text-[#717973]">
                                    {g.confirmed_at ? <>{formatDate(g.confirmed_at)}<br />by {g.acknowledged_by}</> : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  )}

                  <section aria-labelledby="by-student">
                    <h3 id="by-student" className="font-bold text-[#191c1d] mb-3">Students <span className="text-[#717973] font-medium">({tracking.students.length})</span></h3>
                    {tracking.students.length === 0 ? (
                      <EmptyState title="No students match this filter" />
                    ) : (
                      <div className="bg-white rounded-2xl border border-[#e1e3e4] overflow-x-auto">
                        <table className="w-full text-sm min-w-[620px]">
                          <thead>
                            <tr className="text-left text-xs text-[#717973] border-b border-[#f3f4f5]">
                              <th className="font-medium px-5 py-3">Student</th>
                              {isGroup && <th className="font-medium px-3 py-3">Group</th>}
                              <th className="font-medium px-3 py-3">Status</th>
                              <th className="font-medium px-3 py-3">Acknowledged</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f3f4f5]">
                            {tracking.students.map((s) => (
                              <tr key={s.student_id}>
                                <td className="px-5 py-3">
                                  <p className="font-semibold text-[#191c1d]">{s.name}</p>
                                  <p className="text-xs text-[#717973]">{s.roll_no ? `${s.roll_no} · ` : ''}{s.email}</p>
                                </td>
                                {isGroup && (
                                  <td className="px-3 py-3 text-[#414844]">
                                    {s.group_name ? <>{s.group_name}{s.is_leader && <Crown className="inline w-3.5 h-3.5 text-[#FB8500] ml-1.5 -mt-0.5" aria-label="Leader" />}</> : <span className="text-[#717973]">No group</span>}
                                  </td>
                                )}
                                <td className="px-3 py-3"><StatusBadge state={rowState(s)} size="sm" /></td>
                                <td className="px-3 py-3 text-xs text-[#717973]">
                                  {s.confirmed_at ? <>{formatDate(s.confirmed_at)}{isGroup && <><br />by {s.acknowledged_by}</>}</> : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

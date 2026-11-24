import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TypeBadge from '../../components/ui/TypeBadge.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import Button from '../../components/ui/Button.jsx';
import AnimatedCheck from '../../components/ui/AnimatedCheck.jsx';
import FormAlert from '../../components/ui/FormAlert.jsx';
import AcknowledgeModal from '../../components/assignments/AcknowledgeModal.jsx';
import { getAssignmentApi } from '../../api/assignments.js';
import { getErrorMessage } from '../../utils/apiErrors.js';
import { describeDeadline, timeElapsedPercent } from '../../utils/assignmentStatus.js';
import { courseAccent } from '../../utils/courseTheme.js';
import { formatDate, getInitials } from '../../utils/formatters.js';
import { ChevronLeft, ExternalLink, Crown, Clock, Users, RefreshCw, CheckCircle2, Hourglass } from 'lucide-react';

const POLL_MS = 15000;

export default function StudentAssignmentDetail() {
  const { id: assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // True only when the status flips to acknowledged while this page is open —
  // that is when the check marks animate. A page loaded already-acknowledged
  // renders the finished state quietly.
  const [justAcknowledged, setJustAcknowledged] = useState(false);
  const wasAcknowledged = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setError('');
      const data = await getAssignmentApi(assignmentId);
      if (wasAcknowledged.current === false && data.is_acknowledged) setJustAcknowledged(true);
      wasAcknowledged.current = data.is_acknowledged;
      setAssignment(data);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err, 'Could not load this assignment.'));
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    wasAcknowledged.current = null;
    setJustAcknowledged(false);
    setIsLoading(true);
    load();
  }, [assignmentId, load]);

  // A group member waiting on the leader should see the change without
  // reloading: refresh when the tab regains focus, and poll gently.
  const waitingOnLeader = assignment && !assignment.is_acknowledged && assignment.submission_type === 'group' && !assignment.is_leader && assignment.group_id;
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && load({ silent: true });
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const timer = waitingOnLeader ? setInterval(() => load({ silent: true }), POLL_MS) : null;
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      if (timer) clearInterval(timer);
    };
  }, [load, waitingOnLeader]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load({ silent: true });
    setIsRefreshing(false);
  };

  const a = assignment;
  const accent = courseAccent(a?.course_id);
  const isGroup = a?.submission_type === 'group';
  const members = a?.members || [];
  const timePct = a ? timeElapsedPercent(a.created_at, a.due_date) : 0;

  return (
    <DashboardLayout title="Assignment" subtitle={a ? `${a.course_code} · ${a.course_title}` : ''}>
      <div className="space-y-6 pb-12">
        <Link
          to={a ? `/student/courses/${a.course_id}` : '/student/assignments'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#414844] hover:text-[#012d1d]"
        >
          <ChevronLeft className="w-4 h-4" /> {a ? a.course_title : 'Assignments'}
        </Link>

        <FormAlert message={error} />
        {isLoading && !a && !error && <p className="text-sm text-[#717973]">Loading assignment…</p>}

        {a && (
          <>
            {/* Header */}
            <div className="bg-white rounded-2xl border border-[#e1e3e4] soft-shadow overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: accent.hex }} />
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <TypeBadge type={a.submission_type} />
                  <StatusBadge assignment={a} />
                </div>
                <h2 className="text-2xl font-bold text-[#191c1d] leading-tight">{a.title}</h2>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-[#414844]">
                  <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#717973]" />{formatDate(a.due_date)} · {new Date(a.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={a.is_overdue ? 'text-[#D90429] font-semibold' : 'text-[#717973]'}>{!a.is_acknowledged && describeDeadline(a.due_date)}</span>
                  <span className="text-[#717973]">Set by {a.professor_name}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              {/* Details */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-2xl border border-[#e1e3e4] p-6">
                  <h3 className="font-bold text-[#191c1d] mb-2">Instructions</h3>
                  <p className="text-sm text-[#414844] leading-relaxed whitespace-pre-line">
                    {a.description || 'No additional instructions were provided.'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-[#e1e3e4] p-6">
                  <h3 className="font-bold text-[#191c1d] mb-1">Submission workspace</h3>
                  <p className="text-sm text-[#717973] mb-4">
                    {a.is_acknowledged
                      ? 'This submission is acknowledged. The workspace stays open if you need to refer back to it.'
                      : 'Upload your final work here, then acknowledge it in the panel so your professor knows it is ready.'}
                  </p>
                  <a
                    href={a.onedrive_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#c1c8c2] text-sm font-semibold text-[#012d1d] hover:bg-[#f3f4f5] transition-colors"
                  >
                    Open OneDrive workspace <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {!a.is_acknowledged && (
                  <div className="bg-white rounded-2xl border border-[#e1e3e4] p-6">
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="font-bold text-[#191c1d]">Time until the deadline</h3>
                      <span className={`text-sm font-semibold ${a.is_overdue ? 'text-[#D90429]' : 'text-[#414844]'}`}>{describeDeadline(a.due_date)}</span>
                    </div>
                    <ProgressBar value={timePct} color={a.is_overdue ? 'error' : timePct > 80 ? 'warning' : 'accent'} size="md" />
                  </div>
                )}
              </div>

              {/* Acknowledgment */}
              <aside className="lg:col-span-2 bg-white rounded-2xl border border-[#e1e3e4] soft-shadow p-6 lg:sticky lg:top-6" aria-live="polite">
                <h3 className="font-bold text-[#191c1d] mb-4">Acknowledgment</h3>

                {a.is_acknowledged ? (
                  <div className="flex items-center gap-4">
                    <AnimatedCheck size={56} animate={justAcknowledged} label="Acknowledged" />
                    <div>
                      <p className="font-bold text-[#2D6A4F] text-lg leading-tight">{a.is_late ? 'Acknowledged late' : 'Acknowledged'}</p>
                      <p className="text-xs text-[#717973] mt-1">
                        {formatDate(a.confirmed_at)}
                        {isGroup && a.acknowledged_by_name && <> · by {a.acknowledged_by_name}</>}
                      </p>
                    </div>
                  </div>
                ) : a.needs_group ? (
                  <div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FB8500]/10 border border-[#FB8500]/20 text-sm text-[#7a4300]">
                      <Users className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>This is a group assignment and you are not in a group for {a.course_code} yet.</p>
                    </div>
                    <Link to="/student/groups" className="inline-block mt-4 text-sm font-semibold text-[#012d1d] hover:underline">
                      Create or join a group →
                    </Link>
                  </div>
                ) : a.can_acknowledge ? (
                  <div>
                    <p className="text-sm text-[#414844]">
                      {isGroup
                        ? 'You are the group leader, so you acknowledge for everyone in the group.'
                        : 'Once your work is uploaded, acknowledge it so your professor can see it is ready.'}
                    </p>
                    <Button className="w-full mt-4" size="lg" icon={CheckCircle2} onClick={() => setIsModalOpen(true)}>
                      {isGroup ? 'Acknowledge for the group' : 'Acknowledge submission'}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-[#4361EE]/8 border border-[#4361EE]/15 text-sm text-[#2b3fa8]">
                      <Hourglass className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>
                        Waiting for <strong>{a.leader_name}</strong>, your group leader. Only the leader can acknowledge,
                        and it will show here for everyone in {a.group_name} as soon as they do.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4" icon={RefreshCw} isLoading={isRefreshing} onClick={handleRefresh}>
                      Check again
                    </Button>
                  </div>
                )}

                {/* Group roster: every member's status mirrors the group's */}
                {isGroup && members.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#f3f4f5]">
                    <div className="flex items-baseline justify-between mb-3">
                      <p className="text-sm font-semibold text-[#191c1d]">{a.group_name}</p>
                      <Link to={`/student/groups/${a.group_id}`} className="text-xs text-[#717973] hover:text-[#012d1d] hover:underline">View group</Link>
                    </div>
                    <ul className="space-y-2.5">
                      {members.map((m, i) => (
                        <li key={m.id} className="flex items-center gap-3">
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ backgroundColor: accent.soft, color: accent.hex }}
                          >
                            {getInitials(m.name)}
                          </span>
                          <span className="text-sm text-[#191c1d] truncate flex-1">
                            {m.name}
                            {m.id === a.leader_id && <Crown className="inline w-3.5 h-3.5 text-[#FB8500] ml-1.5 -mt-0.5" aria-label="Group leader" />}
                          </span>
                          {a.is_acknowledged ? (
                            <AnimatedCheck size={24} animate={justAcknowledged} delay={justAcknowledged ? 500 + i * 160 : 0} label={`${m.name} acknowledged`} />
                          ) : (
                            <span className="text-[11px] text-[#717973] font-medium">Pending</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-[#717973] mb-1.5">
                        <span>Members covered</span>
                        <span className="font-semibold text-[#191c1d]">{a.is_acknowledged ? members.length : 0} of {members.length}</span>
                      </div>
                      <ProgressBar value={a.is_acknowledged ? members.length : 0} max={members.length} color="success" size="sm" />
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      <AcknowledgeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignment={assignment}
        onAcknowledged={() => load({ silent: true })}
      />
    </DashboardLayout>
  );
}

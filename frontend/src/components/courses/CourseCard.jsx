import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Users, FileText, CalendarClock, AlertTriangle } from 'lucide-react';
import ProgressBar from '../ui/ProgressBar.jsx';
import StackedProgress from '../ui/StackedProgress.jsx';
import { courseAccent } from '../../utils/courseTheme.js';
import { formatDate } from '../../utils/formatters.js';
import { percentOf } from '../../utils/assignmentStatus.js';

// One card, two audiences. The student version shows *my* progress; the
// professor version shows the whole class. The whole card is a link, so it is
// reachable by keyboard and works with middle-click / open-in-new-tab.
export default function CourseCard({ course, to, variant = 'student' }) {
  const accent = courseAccent(course.id);
  const isStudent = variant === 'student';

  const ackPct = isStudent
    ? percentOf(course.acknowledged_count, course.assignment_count)
    : percentOf(course.acknowledged_count, course.total_slots);

  return (
    <Link
      to={to}
      className="group block bg-white rounded-2xl border border-[#e1e3e4] soft-shadow hover-lift overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#012d1d] focus-visible:ring-offset-2"
    >
      <div className="h-1.5" style={{ backgroundColor: accent.hex }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: accent.soft, color: accent.hex }}
          >
            {course.code}
          </span>
          <ArrowUpRight className="w-4 h-4 text-[#c1c8c2] group-hover:text-[#012d1d] transition-colors" />
        </div>

        <h3 className="font-bold text-lg text-[#191c1d] mt-3 leading-snug">{course.title}</h3>
        <p className="text-xs text-[#717973] mt-1 truncate">
          {isStudent ? course.professor_name : `${course.student_count} enrolled`}
        </p>

        {isStudent ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-[#414844]">
                {course.assignment_count === 0
                  ? 'No assignments yet'
                  : `${course.acknowledged_count} of ${course.assignment_count} acknowledged`}
              </span>
              {course.assignment_count > 0 && <span className="font-bold text-[#191c1d]">{ackPct}%</span>}
            </div>
            <ProgressBar value={ackPct} color={course.overdue_count > 0 ? 'warning' : 'success'} size="sm" />

            <div className="flex items-center gap-4 mt-4 text-xs">
              {course.overdue_count > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[#D90429] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {course.overdue_count} overdue
                </span>
              ) : course.next_due ? (
                <span className="inline-flex items-center gap-1.5 text-[#414844]">
                  <CalendarClock className="w-3.5 h-3.5 text-[#717973]" />
                  Next due {formatDate(course.next_due)}
                </span>
              ) : (
                <span className="text-[#717973]">Nothing due</span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-[#414844]">Class progress</span>
              <span className="font-bold text-[#191c1d]">{ackPct}%</span>
            </div>
            <StackedProgress
              acknowledged={course.acknowledged_count}
              pending={course.pending_count}
              overdue={course.overdue_count}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[#414844]">
              <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#717973]" />{course.student_count} students</span>
              <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-[#717973]" />{course.assignment_count} assignments</span>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[11px]">
              <span className="inline-flex items-center gap-1 text-[#2D6A4F] font-semibold"><i className="w-2 h-2 rounded-full bg-[#2D6A4F]" />{course.acknowledged_count} acknowledged</span>
              <span className="inline-flex items-center gap-1 text-[#4361EE] font-semibold"><i className="w-2 h-2 rounded-full bg-[#4361EE]/70" />{course.pending_count} pending</span>
              {course.overdue_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[#D90429] font-semibold"><i className="w-2 h-2 rounded-full bg-[#D90429]" />{course.overdue_count} overdue</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

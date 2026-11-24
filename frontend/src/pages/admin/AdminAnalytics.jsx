import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout.jsx';
import StatCard from '../../components/analytics/StatCard.jsx';
import CompletionBarChart from '../../components/analytics/CompletionBarChart.jsx';
import GroupPerformanceBars from '../../components/analytics/GroupPerformanceBars.jsx';
import { getOverviewAnalyticsApi } from '../../api/analytics.js';
import { GraduationCap, BookOpen, FilePlus, TrendingUp } from 'lucide-react';

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const data = await getOverviewAnalyticsApi();
        setAnalytics(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const totals = analytics?.totals || {};
  const overallCompletion = totals.total_submissions
    ? Math.round((totals.confirmed_submissions / totals.total_submissions) * 100)
    : 0;

  const completionChartData = (analytics?.perAssignment || []).map((a) => ({
    shortTitle: a.title.length > 12 ? `${a.title.slice(0, 12)}…` : a.title,
    title: `${a.course_code} · ${a.title}`,
    completion: a.target_groups ? Math.round((a.confirmed_groups / a.target_groups) * 100) : 0,
  }));

  const groupPerformanceData = (analytics?.perGroup || []).map((g) => ({
    name: `${g.name} · ${g.course_code}`,
    completion: g.total ? Math.round((g.confirmed / g.total) * 100) : 0,
  }));

  return (
    <DashboardLayout
      title="Analytics"
      subtitle="Acknowledgment rates across your courses"
    >
      <div className="space-y-6 pb-12">
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-[#e1e3e4] soft-shadow">
          <h3 className="font-bold text-base text-[#191c1d]">Performance Overview</h3>
          <p className="text-xs text-[#717973]">Live data from the submissions tracker</p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Courses"
            value={totals.total_courses ?? 0}
            subtitle={`${totals.total_groups ?? 0} student groups`}
            icon={BookOpen}
          />
          <StatCard
            title="Students"
            value={totals.total_students ?? 0}
            subtitle="Enrolled across your courses"
            icon={GraduationCap}
            variant="gold"
          />
          <StatCard
            title="Total Assignments"
            value={totals.total_assignments ?? 0}
            subtitle="Posted across your courses"
            icon={FilePlus}
            variant="accent"
          />
          <StatCard
            title="Acknowledged"
            value={`${overallCompletion}%`}
            subtitle={`${totals.confirmed_submissions ?? 0} of ${totals.total_submissions ?? 0} submissions`}
            icon={TrendingUp}
            variant="primary"
          />
        </div>

        {/* Big Chart + Group Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#e1e3e4] soft-shadow space-y-4">
            <div>
              <h3 className="font-bold text-base text-[#191c1d]">
                Assignment Completion Rate
              </h3>
              <p className="text-xs text-[#717973]">
                Share of students who have acknowledged each assignment
              </p>
            </div>
            <CompletionBarChart data={completionChartData} />
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#e1e3e4] soft-shadow space-y-4">
            <h3 className="font-bold text-base text-[#191c1d]">Group progress</h3>
            <GroupPerformanceBars groups={groupPerformanceData} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

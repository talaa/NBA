import React, { useMemo } from 'react';
import {
  Users,
  Target,
  CheckCircle2,
  Clock,
  Ban,
  TrendingUp,
  BarChart3,
  Layers,
  Building2,
  Stethoscope,
  PieChart as PieChartIcon,
  Mail,
  Video,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Recommendation, HCP, Interaction, Outcome } from '../types/database';

interface TeamOverviewProps {
  recommendations: Recommendation[];
  hcps: HCP[];
  interactions: Interaction[];
  outcomes: Outcome[];
  isLiveSupabase: boolean;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({
  recommendations,
  hcps,
  interactions,
  outcomes,
  isLiveSupabase,
}) => {
  // 1. Total HCPs being tracked
  const totalHcps = hcps.length;

  // 2. Recommendation breakdown by priority
  const priorityData = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    recommendations.forEach((r) => {
      if (counts[r.priority] !== undefined) {
        counts[r.priority]++;
      }
    });

    return [
      { name: 'High Priority', value: counts.High, color: '#e11d48', key: 'High' }, // Rose-600
      { name: 'Medium Priority', value: counts.Medium, color: '#d97706', key: 'Medium' }, // Amber-600
      { name: 'Low Priority', value: counts.Low, color: '#059669', key: 'Low' }, // Emerald-600
    ];
  }, [recommendations]);

  // 3. Recommendation status breakdown: pending / completed / dismissed
  const statusData = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let dismissed = 0;

    recommendations.forEach((r) => {
      if (r.status === 'completed') {
        completed++;
      } else if (r.status === 'dismissed') {
        dismissed++;
      } else {
        // 'active' in DB represents open/pending action
        pending++;
      }
    });

    return {
      pending,
      completed,
      dismissed,
      total: recommendations.length,
      chartData: [
        { name: 'Pending Action', count: pending, color: '#0284c7' }, // Sky-600
        { name: 'Completed', count: completed, color: '#10b981' }, // Emerald-500
        { name: 'Dismissed', count: dismissed, color: '#94a3b8' }, // Slate-400
      ],
    };
  }, [recommendations]);

  // 4. Simple table: recommended channel vs. how many recommendations use it
  const channelTableData = useMemo(() => {
    const channelMap = new Map<
      string,
      {
        channel: string;
        count: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
        totalEngagement: number;
      }
    >();

    recommendations.forEach((r) => {
      const ch = r.recommended_channel || 'Other';
      const existing = channelMap.get(ch) || {
        channel: ch,
        count: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        totalEngagement: 0,
      };

      existing.count += 1;
      existing.totalEngagement += r.predicted_engagement;
      if (r.priority === 'High') existing.highCount += 1;
      else if (r.priority === 'Medium') existing.mediumCount += 1;
      else existing.lowCount += 1;

      channelMap.set(ch, existing);
    });

    return Array.from(channelMap.values())
      .map((item) => ({
        ...item,
        avgEngagement: Math.round(item.totalEngagement / item.count),
        percentage: recommendations.length > 0 ? Math.round((item.count / recommendations.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [recommendations]);

  // Helper for channel icon
  const getChannelIcon = (channel: string) => {
    const c = channel.toLowerCase();
    if (c.includes('mail')) return <Mail className="w-4 h-4 text-sky-600 shrink-0" />;
    if (c.includes('virtual') || c.includes('video')) return <Video className="w-4 h-4 text-purple-600 shrink-0" />;
    if (c.includes('msl')) return <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />;
    return <Users className="w-4 h-4 text-teal-700 shrink-0" />;
  };

  // Additional manager stats:
  const avgEngagement = useMemo(() => {
    if (recommendations.length === 0) return 0;
    return Math.round(
      recommendations.reduce((sum, r) => sum + r.predicted_engagement, 0) / recommendations.length
    );
  }, [recommendations]);

  const completionRate = useMemo(() => {
    if (recommendations.length === 0) return 0;
    return Math.round((statusData.completed / recommendations.length) * 100);
  }, [recommendations, statusData]);

  return (
    <div className="space-y-7">
      {/* Header Banner */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Commercial Field Management & Execution Oversight</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Team Overview Dashboard
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aggregated portfolio telemetry pulled live from Supabase. Tracks field rep adoption,
              channel mix concentration, and prioritization balance across all healthcare accounts.
            </p>
          </div>

          {/* Quick Manager Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 shrink-0">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center min-w-[115px]">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total HCPs
              </span>
              <span className="text-2xl font-bold text-slate-900 tracking-tight">
                {totalHcps}
              </span>
              <span className="text-[10px] text-teal-700 block font-medium">Tracked Accounts</span>
            </div>

            <div className="bg-sky-50/60 border border-sky-200 rounded-lg p-3 text-center min-w-[115px]">
              <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider block">
                Pending Actions
              </span>
              <span className="text-2xl font-bold text-sky-800 tracking-tight">
                {statusData.pending}
              </span>
              <span className="text-[10px] text-sky-600 block font-medium">Open in Field</span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-center min-w-[115px]">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                Adoption Rate
              </span>
              <span className="text-2xl font-bold text-emerald-700 tracking-tight">
                {completionRate}%
              </span>
              <span className="text-[10px] text-emerald-600 block font-medium">{statusData.completed} Completed</span>
            </div>

            <div className="bg-teal-50/60 border border-teal-200 rounded-lg p-3 text-center min-w-[115px]">
              <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider block">
                Avg Predicted Engagement
              </span>
              <span className="text-2xl font-bold text-teal-800 tracking-tight">
                {avgEngagement}%
              </span>
              <span className="text-[10px] text-teal-600 block font-medium">Predictive Score</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2-Column Grid: Priority Breakdown & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Recommendation Breakdown by Priority (Donut & Metrics) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-teal-700" />
                <span>Recommendation Priority Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500">
                Distribution of current recommendations across priority tiers
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
              {recommendations.length} Total
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Donut Chart */}
            <div className="sm:col-span-7 h-56 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} recommendations`, name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Stat List */}
            <div className="sm:col-span-5 space-y-3">
              {priorityData.map((p) => {
                const pct = recommendations.length > 0 ? Math.round((p.value / recommendations.length) * 100) : 0;
                return (
                  <div key={p.name} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-bold text-slate-900">{p.value} ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 2: Recommendation Status Breakdown: pending / completed / dismissed */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Target className="w-4 h-4 text-teal-700" />
                <span>Recommendation Status Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500">
                Action lifecycle: pending vs. completed vs. dismissed
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              {statusData.completed} Completed
            </span>
          </div>

          {/* Bar Chart for Status */}
          <div className="h-40 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData.chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#475569" fontSize={12} width={100} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} recommendations`, 'Count']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {statusData.chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Breakdown Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-sky-800 uppercase">
                <Clock className="w-3 h-3 text-sky-600" />
                <span>Pending</span>
              </div>
              <div className="text-xl font-bold text-sky-950 mt-1">{statusData.pending}</div>
              <div className="text-[10px] text-sky-700 font-medium">
                {recommendations.length > 0 ? Math.round((statusData.pending / recommendations.length) * 100) : 0}% of Queue
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-800 uppercase">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Completed</span>
              </div>
              <div className="text-xl font-bold text-emerald-950 mt-1">{statusData.completed}</div>
              <div className="text-[10px] text-emerald-700 font-medium">
                {recommendations.length > 0 ? Math.round((statusData.completed / recommendations.length) * 100) : 0}% Field Adoption
              </div>
            </div>

            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-700 uppercase">
                <Ban className="w-3 h-3 text-slate-500" />
                <span>Dismissed</span>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{statusData.dismissed}</div>
              <div className="text-[10px] text-slate-500 font-medium">
                {recommendations.length > 0 ? Math.round((statusData.dismissed / recommendations.length) * 100) : 0}% Opt-Out
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Simple Table: Recommended Channel vs. How many recommendations use it */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-700" />
              <span>Recommended Channel Allocation</span>
            </h3>
            <p className="text-xs text-slate-500">
              Volume and predicted engagement metrics per recommended channel
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Total Channels Activated: <strong className="text-slate-800 font-semibold">{channelTableData.length}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-6">Recommended Channel</th>
                <th className="py-3.5 px-6 text-center">Recommendation Count</th>
                <th className="py-3.5 px-6 text-center">% of Total</th>
                <th className="py-3.5 px-6 text-center">Priority Distribution</th>
                <th className="py-3.5 px-6 text-right">Avg. Predicted Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {channelTableData.map((row) => (
                <tr key={row.channel} className="hover:bg-slate-50/70 transition-colors">
                  {/* Channel Name & Icon */}
                  <td className="py-4 px-6 font-semibold text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        {getChannelIcon(row.channel)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{row.channel}</div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {row.channel.includes('Email')
                            ? 'Asynchronous Digital Rep Outreach'
                            : row.channel.includes('Face') || row.channel.includes('In-Person')
                            ? 'Field Direct Representative Visit'
                            : row.channel.includes('MSL')
                            ? 'Medical Science Liaison Scientific Exchange'
                            : 'Remote Video & Digital Monograph'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Recommendation Count */}
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-900 border border-slate-200">
                      {row.count}
                    </span>
                  </td>

                  {/* Percentage Progress Bar */}
                  <td className="py-4 px-6">
                    <div className="max-w-[140px] mx-auto space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                        <span>{row.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-600 h-2 rounded-full"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Priority Distribution */}
                  <td className="py-4 px-6 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      {row.highCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {row.highCount} High
                        </span>
                      )}
                      {row.mediumCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {row.mediumCount} Med
                        </span>
                      )}
                      {row.lowCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {row.lowCount} Low
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Avg Engagement Score */}
                  <td className="py-4 px-6 text-right">
                    <div className="inline-flex items-baseline gap-1">
                      <span className="text-base font-extrabold text-teal-800">
                        {row.avgEngagement}%
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">mean</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

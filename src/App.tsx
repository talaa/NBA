import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { Recommendation, HCP, Interaction, Outcome, PriorityLevel } from './types/database';
import {
  fetchNBAData,
  getSupabaseCredentials,
  SupabaseConfig,
  recalculateRecommendation,
} from './lib/supabase';
import { Header, AppNavTab } from './components/Header';
import { HcpPriorityCard } from './components/HcpPriorityCard';
import { HcpProfile360 } from './components/HcpProfile360';
import { TeamOverview } from './components/TeamOverview';
import { TestTools } from './components/TestTools';
import { LogOutcomeModal } from './components/LogOutcomeModal';
import { DatabaseModal } from './components/DatabaseModal';

export default function App() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSupabaseCredentials());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRecalculatingGlobal, setIsRecalculatingGlobal] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Top Nav Tab: 'priorities' (Field Rep) vs 'overview' (Manager) vs 'test_tools' (Demo/Admin)
  const [activeNavTab, setActiveNavTab] = useState<AppNavTab>('priorities');

  // Screen Navigation: null = Priority List, non-null = HCP 360 Profile
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<'All' | PriorityLevel>('All');
  const [selectedTherapeuticArea, setSelectedTherapeuticArea] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [sortBy, setSortBy] = useState<'priority' | 'engagement' | 'name'>('priority');
  const [expandAllWhy, setExpandAllWhy] = useState<boolean>(false);

  // Modals
  const [activeModalRecommendation, setActiveModalRecommendation] = useState<Recommendation | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);

  // Load data function
  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setIsRefreshing(true);
    setErrorNotice(null);

    try {
      const result = await fetchNBAData();
      setRecommendations(result.recommendations);
      setHcps(result.hcps);
      setInteractions(result.interactions);
      setOutcomes(result.outcomes);
      setIsLiveSupabase(result.isLiveSupabase);
      setSupabaseConfig(getSupabaseCredentials());

      if (result.error) {
        setErrorNotice(`Note: Using seeded demo dataset. Supabase sync notice: ${result.error}`);
      }
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to fetch recommendations.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  // Recalculate recommendation for a specific HCP
  const handleRecalculateHcp = async (hcpId: string) => {
    setIsRecalculatingGlobal(true);
    setErrorNotice(null);
    try {
      const res = await recalculateRecommendation(hcpId);
      if (res.success) {
        await loadData(false);
        const name = res.result?.hcpName || 'HCP';
        setToastNotice(`Deterministic scoring engine recomputed recommendation for ${name}! Updated in Supabase.`);
      } else {
        setErrorNotice(res.error || 'Failed to recalculate recommendation.');
      }
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Recalculation error');
    } finally {
      setIsRecalculatingGlobal(false);
    }
  };

  // Recalculate recommendations across all HCPs
  const handleRecalculateAll = async () => {
    setIsRecalculatingGlobal(true);
    setErrorNotice(null);
    try {
      const res = await recalculateRecommendation();
      if (res.success) {
        await loadData(false);
        const count = res.result?.totalComputed || 12;
        setToastNotice(`Deterministic scoring engine evaluated all ${count} HCPs! Updated live in Supabase.`);
      } else {
        setErrorNotice(res.error || 'Failed to recalculate recommendations.');
      }
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : 'Recalculation error');
    } finally {
      setIsRecalculatingGlobal(false);
    }
  };

  // Selected Recommendation for 360 View
  const selectedRecommendation = useMemo(() => {
    if (!selectedRecommendationId) return null;
    return recommendations.find((r) => r.id === selectedRecommendationId) || null;
  }, [recommendations, selectedRecommendationId]);

  // Compute unique therapeutic areas
  const therapeuticAreas = useMemo(() => {
    const set = new Set<string>();
    recommendations.forEach((r) => {
      if (r.hcp?.therapeutic_area) set.add(r.hcp.therapeutic_area);
    });
    return Array.from(set).sort();
  }, [recommendations]);

  // Active vs Completed counts
  const statusCounts = useMemo(() => {
    let active = 0;
    let completed = 0;
    recommendations.forEach((r) => {
      if (r.status === 'completed') completed++;
      else active++;
    });
    return { active, completed, total: recommendations.length };
  }, [recommendations]);

  // Priority counts (computed for current status filter)
  const priorityCounts = useMemo(() => {
    const counts = { High: 0, Medium: 0, Low: 0 };
    recommendations.forEach((r) => {
      if (statusFilter === 'all' || r.status === statusFilter) {
        if (counts[r.priority] !== undefined) counts[r.priority]++;
      }
    });
    return counts;
  }, [recommendations, statusFilter]);

  // Filtered and sorted recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations
      .filter((rec) => {
        // Status filter: by default 'active' for open recommendations
        if (statusFilter !== 'all' && rec.status !== statusFilter) {
          return false;
        }

        // Priority filter
        if (selectedPriority !== 'All' && rec.priority !== selectedPriority) {
          return false;
        }

        // Therapeutic area filter
        if (
          selectedTherapeuticArea !== 'All' &&
          rec.hcp?.therapeutic_area !== selectedTherapeuticArea
        ) {
          return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = rec.hcp?.name.toLowerCase().includes(q);
          const matchSpec = rec.hcp?.specialty.toLowerCase().includes(q);
          const matchInst = rec.hcp?.institution.toLowerCase().includes(q);
          const matchAction = rec.recommended_action.toLowerCase().includes(q);
          const matchContent = rec.recommended_content.toLowerCase().includes(q);
          return matchName || matchSpec || matchInst || matchAction || matchContent;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const priorityWeights = { High: 3, Medium: 2, Low: 1 };
          const pDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
          if (pDiff !== 0) return pDiff;
          return b.predicted_engagement - a.predicted_engagement;
        }
        if (sortBy === 'engagement') {
          return b.predicted_engagement - a.predicted_engagement;
        }
        if (sortBy === 'name') {
          const nameA = a.hcp?.name || '';
          const nameB = b.hcp?.name || '';
          return nameA.localeCompare(nameB);
        }
        return 0;
      });
  }, [recommendations, statusFilter, selectedPriority, selectedTherapeuticArea, searchQuery, sortBy]);

  // Overall statistics for active recommendations
  const stats = useMemo(() => {
    const activeRecs = recommendations.filter((r) => r.status === 'active');
    const total = activeRecs.length;
    const high = activeRecs.filter((r) => r.priority === 'High').length;
    const avgEngagement =
      total > 0
        ? Math.round(
            activeRecs.reduce((sum, r) => sum + r.predicted_engagement, 0) / total
          )
        : 0;
    const loggedOutcomes = recommendations.filter((r) => r.outcome).length;

    return { total, high, avgEngagement, loggedOutcomes, completed: statusCounts.completed };
  }, [recommendations, statusCounts]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <Header
        supabaseConfig={supabaseConfig}
        isLiveSupabase={isLiveSupabase}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        onRefresh={() => loadData(false)}
        isRefreshing={isRefreshing}
        activeTab={activeNavTab}
        onTabChange={(tab: AppNavTab) => {
          setActiveNavTab(tab);
          if (tab !== 'priorities') {
            setSelectedRecommendationId(null);
          }
        }}
        openCount={statusCounts.active}
      />

      {/* SCREEN ROUTING */}
      {activeNavTab === 'test_tools' ? (
        /* SCREEN: Test Tools (Admin & Demo Audit Utility) */
        <TestTools
          hcps={hcps}
          interactions={interactions}
          recommendations={recommendations}
          onRefreshData={() => loadData(false)}
          onNavigateToHcpProfile={(hcpId) => {
            const rec = recommendations.find((r) => r.hcp_id === hcpId);
            if (rec) {
              setSelectedRecommendationId(rec.id);
              setActiveNavTab('priorities');
            }
          }}
        />
      ) : (
        /* Main Presentation Container for Priorities & Overview */
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-8 py-8 space-y-7">
          {/* Toast Notification Banner (e.g., action taken or recalculate success) */}
          {toastNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{toastNotice}</span>
              </div>
              <button
                onClick={() => setToastNotice(null)}
                className="p-1 text-emerald-700 hover:text-emerald-950 rounded hover:bg-emerald-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Notice Banner if offline or custom config */}
          {errorNotice && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{errorNotice}</span>
              </div>
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="font-bold underline text-amber-950 hover:text-amber-800 shrink-0"
              >
                Configure Supabase
              </button>
            </div>
          )}

          {activeNavTab === 'overview' ? (
            /* SCREEN 3: Team Overview Dashboard (Manager View) */
            <TeamOverview
              recommendations={recommendations}
              hcps={hcps}
              interactions={interactions}
              outcomes={outcomes}
              isLiveSupabase={isLiveSupabase}
            />
          ) : selectedRecommendation ? (
          /* SCREEN 2: HCP 360° Profile */
          <HcpProfile360
            recommendation={selectedRecommendation}
            onBack={() => setSelectedRecommendationId(null)}
            onActionTakenSuccess={(hcpName) => {
              setToastNotice(`Action successfully marked as taken! Updated recommendation for ${hcpName} to completed in Supabase.`);
              setSelectedRecommendationId(null);
              loadData(false);
            }}
            onOpenLogOutcome={(rec) => setActiveModalRecommendation(rec)}
            onRecalculate={handleRecalculateHcp}
            isRecalculating={isRecalculatingGlobal}
          />
        ) : (
          /* SCREEN 1: Today's Priority HCPs (Field Rep Queue) */
          <>
            {/* Executive Header Section */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Tuesday, September 29, 2026 · Daily Field Routing</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Today’s Priority HCPs
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Deterministic Next Best Action (NBA) queue evaluated live by rule-based channel and cadence scoring.
                    Every recommendation links back to explicit interaction history rows in Supabase.
                  </p>
                </div>

                {/* Quick KPI Cards Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 shrink-0">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center min-w-[110px]">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Open Actions
                    </span>
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {stats.total}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-medium">Daily Target</span>
                  </div>

                  <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3 text-center min-w-[110px]">
                    <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block">
                      High Priority
                    </span>
                    <span className="text-2xl font-bold text-rose-700 tracking-tight">
                      {stats.high}
                    </span>
                    <span className="text-[10px] text-rose-600 block font-medium">Urgent Today</span>
                  </div>

                  <div className="bg-teal-50/60 border border-teal-200 rounded-lg p-3 text-center min-w-[110px]">
                    <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider block">
                      Avg Predicted Engagement
                    </span>
                    <span className="text-2xl font-bold text-teal-800 tracking-tight">
                      {stats.avgEngagement}%
                    </span>
                    <span className="text-[10px] text-teal-600 block font-medium">Deterministic Score</span>
                  </div>

                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-center min-w-[110px]">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                      Completed
                    </span>
                    <span className="text-2xl font-bold text-emerald-700 tracking-tight">
                      {stats.completed}
                    </span>
                    <span className="text-[10px] text-emerald-600 block font-medium">Actions Taken</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Filter, Search & Display Controls Bar */}
            <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by physician name, specialty, or medical institution..."
                    className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* View / Sort / Recalculate Controls */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {/* Global Deterministic Recalculate Button */}
                  <button
                    onClick={handleRecalculateAll}
                    disabled={isRecalculatingGlobal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors font-bold shadow-2xs disabled:opacity-50"
                    title="Run deterministic rule engine on all 12 HCPs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRecalculatingGlobal ? 'animate-spin' : ''}`} />
                    <span>{isRecalculatingGlobal ? 'Scoring...' : 'Recalculate Scoring'}</span>
                  </button>

                  {/* Status Toggle: Open Actions vs All vs Completed */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        statusFilter === 'active'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Open Queue ({statusCounts.active})
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        statusFilter === 'completed'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Completed ({statusCounts.completed})
                    </button>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({statusCounts.total})
                    </button>
                  </div>

                  {/* Expand All "Why?" toggle */}
                  <button
                    onClick={() => setExpandAllWhy(!expandAllWhy)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors font-medium"
                  >
                    {expandAllWhy ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>Collapse "Why?"</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
                        <span>Expand "Why?"</span>
                      </>
                    )}
                  </button>

                  {/* Sort By Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'priority' | 'engagement' | 'name')}
                      className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="priority">Priority (High → Low)</option>
                      <option value="engagement">Predicted Engagement %</option>
                      <option value="name">HCP Name (A–Z)</option>
                    </select>
                  </div>

                  {/* Therapeutic Area Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Specialty:</span>
                    <select
                      value={selectedTherapeuticArea}
                      onChange={(e) => setSelectedTherapeuticArea(e.target.value)}
                      className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Specialties ({recommendations.length})</option>
                      {therapeuticAreas.map((ta) => (
                        <option key={ta} value={ta}>
                          {ta}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Interactive Priority Filter Segmented Control */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setSelectedPriority('All')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      selectedPriority === 'All'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Priorities ({priorityCounts.High + priorityCounts.Medium + priorityCounts.Low})
                  </button>

                  <button
                    onClick={() => setSelectedPriority('High')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      selectedPriority === 'High'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    High Priority ({priorityCounts.High})
                  </button>

                  <button
                    onClick={() => setSelectedPriority('Medium')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      selectedPriority === 'Medium'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Medium ({priorityCounts.Medium})
                  </button>

                  <button
                    onClick={() => setSelectedPriority('Low')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      selectedPriority === 'Low'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Low ({priorityCounts.Low})
                  </button>
                </div>

                <div className="text-xs text-slate-500 hidden sm:block">
                  Showing <span className="font-semibold text-slate-800">{filteredRecommendations.length}</span> actionable HCPs
                </div>
              </div>
            </section>

            {/* Recommendations List Container */}
            {isLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-sm font-semibold text-slate-800">
                  Loading Today's Next Best Actions...
                </div>
                <p className="text-xs text-slate-500">
                  Connecting to Supabase and scoring predicted engagement deterministically
                </p>
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Filter className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No matching HCPs found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {statusFilter === 'active' && statusCounts.active === 0
                    ? 'All recommendations have been marked as completed for today!'
                    : 'No recommendations match your current filter and search query. Reset filters to view all doctors.'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPriority('All');
                    setSelectedTherapeuticArea('All');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecommendations.map((rec) => (
                  <HcpPriorityCard
                    key={rec.id}
                    recommendation={rec}
                    onLogOutcome={(item) => setActiveModalRecommendation(item)}
                    onSelectHcp={(item) => setSelectedRecommendationId(item.id)}
                    onRecalculate={handleRecalculateHcp}
                    isExpandedByDefault={expandAllWhy}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    )}

      {/* Outcome Recording Modal */}
      <LogOutcomeModal
        recommendation={activeModalRecommendation}
        onClose={() => setActiveModalRecommendation(null)}
        onSuccess={() => loadData(false)}
      />

      {/* Supabase Connection & Seeder Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        config={supabaseConfig}
        isLiveSupabase={isLiveSupabase}
        onCredentialsUpdated={() => loadData(false)}
        hcpCount={hcps.length}
        recCount={recommendations.length}
        interactionCount={interactions.length}
        outcomeCount={outcomes.length}
      />
    </div>
  );
}

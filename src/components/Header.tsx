import React from 'react';
import { Database, CheckCircle2, CloudOff, RefreshCw, BarChart3, ListFilter, Wrench } from 'lucide-react';
import { SupabaseConfig } from '../lib/supabase';

export type AppNavTab = 'priorities' | 'overview' | 'test_tools';

interface HeaderProps {
  supabaseConfig: SupabaseConfig;
  isLiveSupabase: boolean;
  onOpenDbModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  openCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  supabaseConfig,
  isLiveSupabase,
  onOpenDbModal,
  onRefresh,
  isRefreshing,
  activeTab,
  onTabChange,
  openCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-6 py-3.5 sm:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Context */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-600 to-sky-700 flex items-center justify-center text-white shadow-sm font-semibold text-lg tracking-wider">
            NBA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Aura NBA
              </h1>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Pharma Commercial
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Healthcare Professional (HCP) Next Best Action Console
            </p>
          </div>
        </div>

        {/* Territory & Supabase Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Territory Details */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span className="font-medium text-slate-900">Territory:</span>
            <span>US-Northeast (Specialty & Oncology)</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">Rep: Jordan Miller</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh data from Supabase"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Database Connection Status Button */}
          <button
            onClick={onOpenDbModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isLiveSupabase
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : supabaseConfig.isConfigured
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100'
            }`}
          >
            {isLiveSupabase ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase Live Sync</span>
              </>
            ) : supabaseConfig.isConfigured ? (
              <>
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>Supabase Configured</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-sky-600" />
                <span>Demo Seed Mode</span>
              </>
            )}
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/70 border border-current">
              DB
            </span>
          </button>
        </div>
      </div>

      {/* Top Nav Tabs Bar */}
      <div className="border-t border-slate-200/80 bg-slate-50/60 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          {/* Tab 1: Today's Priorities */}
          <button
            onClick={() => onTabChange('priorities')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'priorities'
                ? 'border-teal-700 text-teal-900 bg-white shadow-2xs -mb-px rounded-t-md'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ListFilter className="w-4 h-4 text-teal-700" />
            <span>Today's Priorities</span>
            {openCount !== undefined && openCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                {openCount}
              </span>
            )}
          </button>

          {/* Tab 2: Team Overview */}
          <button
            onClick={() => onTabChange('overview')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-teal-700 text-teal-900 bg-white shadow-2xs -mb-px rounded-t-md'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-sky-700" />
            <span>Team Overview</span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 text-slate-700">
              Manager
            </span>
          </button>

          {/* Tab 3: Test Tools (Admin / Demo Sandbox) */}
          <button
            onClick={() => onTabChange('test_tools')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'test_tools'
                ? 'border-amber-500 text-amber-950 bg-amber-100/60 shadow-2xs -mb-px rounded-t-md'
                : 'border-transparent text-slate-600 hover:text-amber-800 hover:border-amber-300'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Test Tools</span>
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
              Demo Mode
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Server,
  Key,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Code2,
} from 'lucide-react';
import {
  SupabaseConfig,
  saveLocalSupabaseCredentials,
  clearLocalSupabaseCredentials,
  seedSupabaseDatabase,
  getSupabaseClient,
} from '../lib/supabase';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  isLiveSupabase: boolean;
  onCredentialsUpdated: () => void;
  hcpCount: number;
  recCount: number;
  interactionCount: number;
  outcomeCount: number;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  config,
  isLiveSupabase,
  onCredentialsUpdated,
  hcpCount,
  recCount,
  interactionCount,
  outcomeCount,
}) => {
  if (!isOpen) return null;

  const [inputUrl, setInputUrl] = useState(config.url || '');
  const [inputKey, setInputKey] = useState(config.anonKey || '');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'connect' | 'sql'>('connect');

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl && inputKey) {
      saveLocalSupabaseCredentials(inputUrl, inputKey);
      onCredentialsUpdated();
      setSeedResult('Credentials saved! Testing Supabase connection...');
    }
  };

  const handleClear = () => {
    clearLocalSupabaseCredentials();
    setInputUrl('');
    setInputKey('');
    onCredentialsUpdated();
    setSeedResult('Reverted to demo dataset.');
  };

  const handleRunSeed = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedSupabaseDatabase();
      if (res.success) {
        setSeedResult(
          `Successfully seeded Supabase! Inserted ${res.counts.hcps} HCPs, ${res.counts.recommendations} recommendations, ${res.counts.interactions} interactions, and ${res.counts.outcomes} outcomes.`
        );
        onCredentialsUpdated();
      } else {
        setSeedResult(`Seeding failed: ${res.error}`);
      }
    } catch (err: unknown) {
      setSeedResult(
        `Seeding error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const sqlSample = `-- 1. CREATE TABLES IN SUPABASE SQL EDITOR
CREATE TABLE IF NOT EXISTS public.hcps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    institution TEXT NOT NULL,
    location TEXT NOT NULL,
    segment TEXT NOT NULL,
    therapeutic_area TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.interactions (
    id TEXT PRIMARY KEY,
    hcp_id TEXT NOT NULL REFERENCES public.hcps(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    interaction_type TEXT NOT NULL,
    content_topic TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recommendations (
    id TEXT PRIMARY KEY,
    hcp_id TEXT NOT NULL REFERENCES public.hcps(id) ON DELETE CASCADE,
    recommended_action TEXT NOT NULL,
    recommended_channel TEXT NOT NULL,
    recommended_content TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    predicted_engagement NUMERIC(5,2) NOT NULL,
    reasons TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outcomes (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
    response TEXT NOT NULL,
    outcome_notes TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ENABLE ROW LEVEL SECURITY & ALLOW PUBLIC READ/WRITE FOR DEMO
ALTER TABLE public.hcps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon all on hcps" ON public.hcps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on interactions" ON public.interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on recommendations" ON public.recommendations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon all on outcomes" ON public.outcomes FOR ALL USING (true) WITH CHECK (true);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSample);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Supabase Database & Seed Configuration
              </h3>
              <p className="text-xs text-slate-500">
                PostgreSQL schema, real-time client sync, and seed records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('connect')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'connect'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Connection & Automatic Seeding
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-teal-600 text-teal-800 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            SQL Schema Migration
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Database Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">HCPs</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{hcpCount}</div>
              <div className="text-[10px] text-teal-700 font-medium">12 Target Doctors</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">Recommendations</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{recCount}</div>
              <div className="text-[10px] text-teal-700 font-medium">1 Active per HCP</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">Interactions</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{interactionCount}</div>
              <div className="text-[10px] text-teal-700 font-medium">4–6 Calls each</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase">Outcomes</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{outcomeCount}</div>
              <div className="text-[10px] text-emerald-700 font-medium">Logged Responses</div>
            </div>
          </div>

          {activeTab === 'connect' ? (
            <>
              {/* Status Alert Banner */}
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  isLiveSupabase
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : config.isConfigured
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                {isLiveSupabase ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Server className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {isLiveSupabase
                      ? 'Live Supabase Connection Established'
                      : config.isConfigured
                      ? 'Supabase Configured — Connecting to Tables'
                      : 'Demo Seed Dataset Active'}
                  </div>
                  <p className="mt-0.5 opacity-90 leading-relaxed">
                    {isLiveSupabase
                      ? `Successfully synced with live Supabase instance: ${config.url}. All reads and logged outcomes write directly to your database.`
                      : config.isConfigured
                      ? 'Attempting to query tables (hcps, recommendations, interactions, outcomes). Click "Seed Supabase Tables" below if they need initial data.'
                      : 'You can provide your Supabase Project URL and Anon Public Key below or via .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).'}
                  </p>
                </div>
              </div>

              {/* Credential Inputs */}
              <form onSubmit={handleSaveCredentials} className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Supabase Project Credentials
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Project URL (e.g., https://xyzcompany.supabase.co)
                  </label>
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full text-xs font-mono rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Anon Public Key (JWT)
                  </label>
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full text-xs font-mono rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {config.source === 'localStorage' && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Clear Saved Credentials
                    </button>
                  )}
                  <div className="ml-auto">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      Save & Connect
                    </button>
                  </div>
                </div>
              </form>

              {/* 1-Click Seeder */}
              <div className="p-4 bg-teal-50/50 rounded-lg border border-teal-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                      One-Click Supabase Table Seeder
                    </h4>
                    <p className="text-xs text-teal-800 mt-0.5">
                      Upserts the 12 HCPs, 57 interactions, 12 recommendations, and 3 outcomes via the API client.
                    </p>
                  </div>
                  <button
                    onClick={handleRunSeed}
                    disabled={isSeeding || !config.isConfigured}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
                    {isSeeding ? 'Seeding Tables...' : 'Seed Supabase Tables'}
                  </button>
                </div>

                {seedResult && (
                  <div className="p-3 bg-white rounded-md border border-teal-300 text-xs font-medium text-teal-900 leading-relaxed">
                    {seedResult}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* SQL Schema Viewer */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    PostgreSQL Schema & Security Rules
                  </h4>
                  <p className="text-xs text-slate-500">
                    Run in your Supabase SQL Editor if you prefer executing DDL migrations directly.
                  </p>
                </div>
                <button
                  onClick={copySqlToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy SQL Script
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
                {sqlSample}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Schema file: <code className="text-slate-700 font-semibold">/supabase/schema_and_seed.sql</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Calendar,
  Layers,
  FileText,
  User,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';
import { HCP, Interaction, Recommendation, PriorityLevel } from '../types/database';
import {
  addHcpInteraction,
  updateHcpInteraction,
  deleteHcpInteraction,
  recalculateRecommendation,
} from '../lib/supabase';
import { CHANNEL_DEFINITIONS, ChannelKey } from '../lib/scoringEngine';

interface TestToolsProps {
  hcps: HCP[];
  interactions: Interaction[];
  recommendations: Recommendation[];
  onRefreshData: () => Promise<void>;
  onNavigateToHcpProfile?: (hcpId: string) => void;
}

const STANDARD_CHANNELS = [
  'In-Person Detailing',
  'Approved Rep Email',
  'Virtual Call',
  'Symposium / Congress',
  'SMS Clinical Alert',
  'WhatsApp Secure Direct Message',
];

const STANDARD_TYPES = [
  'Product Presentation',
  'Clinical Study Review',
  'Digital Monograph',
  'Digital Case Study',
  'Scientific Exchange',
  'Sample Drop & Dialogue',
  'Follow-up Consultation',
  'Medical Information Request',
  'Advisory Panel',
];

export const TestTools: React.FC<TestToolsProps> = ({
  hcps,
  interactions,
  recommendations,
  onRefreshData,
  onNavigateToHcpProfile,
}) => {
  // Selected HCP
  const [selectedHcpId, setSelectedHcpId] = useState<string>(hcps[0]?.id || '');
  const selectedHcp = hcps.find((h) => h.id === selectedHcpId) || hcps[0];

  // Filtered interactions for selected HCP
  const hcpInteractions = interactions
    .filter((i) => i.hcp_id === selectedHcpId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  // Current active recommendation in DB
  const currentRec = recommendations.find((r) => r.hcp_id === selectedHcpId && r.status !== 'completed');

  // Recalculation output state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [computedResult, setComputedResult] = useState<any>(null);
  const [previousRecSnapshot, setPreviousRecSnapshot] = useState<Recommendation | null>(null);

  // Inline edit state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Interaction>>({});
  const [isSavingRow, setIsSavingRow] = useState(false);

  // New interaction form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newChannel, setNewChannel] = useState('Approved Rep Email');
  const [newType, setNewType] = useState('Digital Monograph');
  const [newTopic, setNewTopic] = useState('');
  const [newDate, setNewDate] = useState('2026-09-29T10:00');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync selectedHcpId if hcps list loads late
  useEffect(() => {
    if (!selectedHcpId && hcps.length > 0) {
      setSelectedHcpId(hcps[0].id);
    }
  }, [hcps, selectedHcpId]);

  // When changing HCP, reset calculation view and snapshot
  useEffect(() => {
    setComputedResult(null);
    setPreviousRecSnapshot(currentRec || null);
    setEditingRowId(null);
    setIsAddingNew(false);
  }, [selectedHcpId]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  // Start editing a row
  const handleStartEdit = (row: Interaction) => {
    setEditingRowId(row.id);
    setEditFormData({
      channel: row.channel,
      interaction_type: row.interaction_type,
      content_topic: row.content_topic,
      occurred_at: row.occurred_at.slice(0, 16),
      notes: row.notes,
    });
  };

  // Save edited row
  const handleSaveEdit = async () => {
    if (!editingRowId) return;
    setIsSavingRow(true);
    try {
      const res = await updateHcpInteraction(editingRowId, {
        channel: editFormData.channel,
        interaction_type: editFormData.interaction_type,
        content_topic: editFormData.content_topic,
        occurred_at: editFormData.occurred_at ? new Date(editFormData.occurred_at).toISOString() : new Date().toISOString(),
        notes: editFormData.notes || '',
      });

      if (res.success) {
        showFeedback('success', 'Interaction row updated in database.');
        setEditingRowId(null);
        await onRefreshData();
      } else {
        showFeedback('error', res.error || 'Failed to update row.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error saving changes.');
    } finally {
      setIsSavingRow(false);
    }
  };

  // Delete row
  const handleDeleteRow = async (id: string) => {
    if (!window.confirm('Delete this interaction row from the database?')) return;
    try {
      const res = await deleteHcpInteraction(id);
      if (res.success) {
        showFeedback('success', 'Interaction row deleted.');
        await onRefreshData();
      } else {
        showFeedback('error', res.error || 'Failed to delete row.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error deleting row.');
    }
  };

  // Add new row
  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHcpId) return;
    if (!newTopic.trim()) {
      alert('Please enter a content topic.');
      return;
    }

    setIsSubmittingNew(true);
    try {
      const res = await addHcpInteraction({
        hcp_id: selectedHcpId,
        channel: newChannel,
        interaction_type: newType,
        content_topic: newTopic.trim(),
        occurred_at: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
        notes: newNotes.trim() || 'Interaction logged via Test Tools admin console.',
      });

      if (res.success) {
        showFeedback('success', `Added new ${newChannel} interaction row to database.`);
        setNewTopic('');
        setNewNotes('');
        setIsAddingNew(false);
        await onRefreshData();
      } else {
        showFeedback('error', res.error || 'Failed to add interaction.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error adding row.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Trigger recalculate
  const handleRecalculate = async () => {
    if (!selectedHcpId) return;
    setIsRecalculating(true);
    // Snapshot current recommendation before recalculating
    setPreviousRecSnapshot(currentRec || null);

    try {
      const res = await recalculateRecommendation(selectedHcpId);
      if (res.success && res.result) {
        setComputedResult(res.result);
        showFeedback('success', `Recommendation recomputed & saved to database for ${selectedHcp?.name}!`);
        await onRefreshData();
      } else {
        showFeedback('error', res.error || 'Recalculation failed.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Recalculation error.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Preset fill helpers for quick test demo
  const fillPreset = (notesText: string, channelName?: string) => {
    setNewNotes(notesText);
    if (channelName) setNewChannel(channelName);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      {/* 1. DISTINCT YELLOW TEST MODE BANNER */}
      <div className="bg-amber-400 border-b-2 border-amber-500 text-amber-950 px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-950 text-amber-300 font-black text-sm">
              <Wrench className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest uppercase bg-amber-950 text-amber-300 px-2 py-0.5 rounded">
                  TEST MODE
                </span>
                <h2 className="text-sm font-bold tracking-tight">
                  Deterministic Scoring Audit & Rule Evaluation Sandbox
                </h2>
              </div>
              <p className="text-xs text-amber-900 mt-0.5 font-medium">
                Demo & Admin Utility — Modify database rows in real-time, trigger rule evaluation, and audit live output.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-semibold bg-amber-300/80 px-3 py-1.5 rounded-md border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></span>
            <span>Zero Generative AI / 100% Traceable Rule Engine</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-6 sm:px-8 space-y-6">
        {/* Feedback Alert Banner */}
        {feedbackBanner && (
          <div
            className={`p-3.5 rounded-lg border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <span>{feedbackBanner.message}</span>
            <button onClick={() => setFeedbackBanner(null)} className="text-current hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. HCP SELECTION HEADER */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 flex-1">
            <label htmlFor="hcp-selector" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Select Healthcare Professional to Test & Audit:</span>
            </label>
            <div className="relative">
              <select
                id="hcp-selector"
                value={selectedHcpId}
                onChange={(e) => setSelectedHcpId(e.target.value)}
                className="w-full md:max-w-lg appearance-none bg-slate-50 border border-slate-300 text-slate-900 text-sm font-semibold rounded-lg px-4 py-2.5 pr-10 hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {hcps.map((hcp) => (
                  <option key={hcp.id} value={hcp.id}>
                    {hcp.name} — {hcp.specialty} ({hcp.therapeutic_area}) [{hcp.segment}]
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 md:right-[calc(100%-theme(maxWidth.lg))] flex items-center px-3 text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Quick HCP Snapshot & Recalculate CTA */}
          <div className="flex flex-wrap items-center gap-3">
            {onNavigateToHcpProfile && selectedHcp && (
              <button
                onClick={() => onNavigateToHcpProfile(selectedHcp.id)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
                title="View complete 360 profile"
              >
                <span>View Full 360</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            <button
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg border border-amber-500 shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>{isRecalculating ? 'Recomputing Rules...' : 'Recalculate Recommendation'}</span>
            </button>
          </div>
        </div>

        {/* 3. LIVE RECALCULATION RESULT DISPLAY (BEFORE vs AFTER) */}
        {(computedResult || currentRec) && (
          <div className="bg-white rounded-xl border border-amber-300 shadow-xs overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-black">
                  ✓
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  {computedResult ? 'Live Computed Recommendation (Deterministic Output)' : 'Current Active Recommendation in Database'}
                </h3>
              </div>
              {computedResult && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
                  Saved to Supabase recommendations table
                </span>
              )}
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary Action & Channel */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Recommended Next Action
                  </span>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {computedResult ? computedResult.recommendedAction : currentRec?.recommended_action}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Recommended Channel</span>
                    <p className="text-xs font-bold text-slate-900 mt-1">
                      {computedResult ? computedResult.recommendedChannel : currentRec?.recommended_channel}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Predicted Engagement</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-black text-teal-700">
                        {computedResult ? computedResult.predictedEngagement : currentRec?.predicted_engagement}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Priority Level</span>
                    <div className="mt-1">
                      {(() => {
                        const prio = (computedResult ? computedResult.priority : currentRec?.priority) || 'Medium';
                        const colorClass =
                          prio === 'High'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : prio === 'Medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-slate-200 text-slate-800 border-slate-300';
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase border ${colorClass}`}>
                            {prio} Priority
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Specific Firing Reasons / Database Evidence */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Traceable Firing Rules & Evidence (Referencing Database Rows)
                  </span>
                  <ul className="mt-2 space-y-2">
                    {(computedResult ? computedResult.reasons : currentRec?.reasons || []).map((reason: string, idx: number) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></span>
                        <span className="leading-relaxed">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Channel Score Matrix */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  All 6 Channel Scores (Evaluated)
                </span>
                <p className="text-[11px] text-slate-500">
                  Scores calculated deterministically via engagement rate, 6-month inactivity (+10), ignored penalty (-30), and segment default (+10).
                </p>

                <div className="space-y-2 pt-1">
                  {computedResult && computedResult.channelScores ? (
                    Object.entries(computedResult.channelScores).map(([label, score]: any) => {
                      const isWinner = label === computedResult.recommendedChannel;
                      return (
                        <div
                          key={label}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                            isWinner
                              ? 'bg-amber-100/90 border-amber-300 text-amber-950 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isWinner && <span className="text-amber-600 font-black">★</span>}
                            <span>{label}</span>
                          </div>
                          <span className={`font-mono font-bold ${isWinner ? 'text-amber-950' : 'text-slate-600'}`}>
                            {score} pts
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Click "Recalculate Recommendation" to display full channel comparison matrix.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. EDITABLE INTERACTIONS TABLE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Interaction Rows for {selectedHcp?.name} ({hcpInteractions.length} records)
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  `interactions` table
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Every row here directly feeds the deterministic rule calculations (rates, fatigue, ignored penalties).
              </p>
            </div>

            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                isAddingNew
                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
            >
              {isAddingNew ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isAddingNew ? 'Close Add Form' : 'Add New Interaction'}</span>
            </button>
          </div>

          {/* Quick Add Form */}
          {isAddingNew && (
            <div className="p-5 border-b border-amber-200 bg-amber-50/40">
              <form onSubmit={handleAddRow} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-amber-700" />
                    <span>Insert New Interaction for {selectedHcp?.name}</span>
                  </h4>

                  {/* Preset test buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-semibold mr-1">Demo Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        fillPreset(
                          'Opened approved email within 15 minutes; clicked clinical trial slide deck link twice.',
                          'Approved Rep Email'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-medium"
                    >
                      + Engaged / Opened
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        fillPreset(
                          'Ignored email invitation; unopened after 5 days with no response.',
                          'Approved Rep Email'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-medium"
                    >
                      + Ignored / Unopened
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        fillPreset(
                          'Face-to-face clinic visit; reviewed trial subgroup analysis and left sample voucher.',
                          'In-Person Detailing'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300 font-medium"
                    >
                      + In-Person Touch
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Channel</label>
                    <select
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                    >
                      {STANDARD_CHANNELS.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Interaction Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                    >
                      {STANDARD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Occurred At</label>
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Content Topic</label>
                    <input
                      type="text"
                      placeholder="e.g. Phase III OS subgroup analysis..."
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      required
                      className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Field Notes (Keywords like "opened", "clicked", or "ignored" drive rule evaluations)
                  </label>
                  <textarea
                    rows={2}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Enter observation notes..."
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNew}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingNew ? 'Saving...' : 'Add Interaction to Database'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-4 w-40">Channel</th>
                  <th className="py-3 px-4 w-36">Type</th>
                  <th className="py-3 px-4">Content Topic</th>
                  <th className="py-3 px-4 w-32">Date</th>
                  <th className="py-3 px-4 min-w-[240px]">Notes</th>
                  <th className="py-3 px-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hcpInteractions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      No interactions recorded for this HCP yet. Use the form above to add one.
                    </td>
                  </tr>
                ) : (
                  hcpInteractions.map((row) => {
                    const isEditing = editingRowId === row.id;

                    if (isEditing) {
                      return (
                        <tr key={row.id} className="bg-amber-50/70 border-b border-amber-200">
                          <td className="py-2.5 px-3">
                            <select
                              value={editFormData.channel}
                              onChange={(e) => setEditFormData({ ...editFormData, channel: e.target.value })}
                              className="w-full text-xs p-1.5 bg-white border border-amber-300 rounded"
                            >
                              {STANDARD_CHANNELS.map((ch) => (
                                <option key={ch} value={ch}>
                                  {ch}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={editFormData.interaction_type || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, interaction_type: e.target.value })}
                              className="w-full text-xs p-1.5 bg-white border border-amber-300 rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={editFormData.content_topic || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, content_topic: e.target.value })}
                              className="w-full text-xs p-1.5 bg-white border border-amber-300 rounded font-medium"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="datetime-local"
                              value={editFormData.occurred_at || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, occurred_at: e.target.value })}
                              className="w-full text-xs p-1.5 bg-white border border-amber-300 rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <textarea
                              rows={2}
                              value={editFormData.notes || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                              className="w-full text-xs p-1.5 bg-white border border-amber-300 rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSavingRow}
                                title="Save changes"
                                className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingRowId(null)}
                                title="Cancel"
                                className="p-1.5 rounded bg-slate-300 text-slate-700 hover:bg-slate-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {row.channel}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {row.interaction_type}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {row.content_topic}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {row.occurred_at.split('T')[0]}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed">
                          {row.notes}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(row)}
                              className="p-1 text-slate-400 hover:text-slate-900 transition-colors"
                              title="Edit row"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Sparkles,
  Mail,
  Users,
  Video,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  ShieldCheck,
  Check,
  FileCheck,
  HelpCircle,
  Stethoscope,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Layers,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { Recommendation, Interaction } from '../types/database';
import { PriorityBadge } from './PriorityBadge';
import { markActionTaken } from '../lib/supabase';
import { LogInteractionModal } from './LogInteractionModal';

interface HcpProfile360Props {
  recommendation: Recommendation;
  onBack: () => void;
  onActionTakenSuccess: (hcpName: string) => void;
  onOpenLogOutcome: (recommendation: Recommendation) => void;
  onRecalculate: (hcpId: string) => Promise<void>;
  isRecalculating?: boolean;
}

export const HcpProfile360: React.FC<HcpProfile360Props> = ({
  recommendation,
  onBack,
  onActionTakenSuccess,
  onOpenLogOutcome,
  onRecalculate,
  isRecalculating = false,
}) => {
  const [isMarkingTaken, setIsMarkingTaken] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLogInteractionOpen, setIsLogInteractionOpen] = useState(false);
  const [recalculateSuccessMsg, setRecalculateSuccessMsg] = useState<string | null>(null);

  const hcp = recommendation.hcp;
  const outcome = recommendation.outcome;
  const interactions = recommendation.interactions || [];

  // Sort interactions chronologically (most recent first)
  const sortedInteractions = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  // Helper to render channel icon and color
  const getChannelConfig = (channel: string) => {
    const c = channel.toLowerCase();
    if (c.includes('mail')) {
      return {
        icon: <Mail className="w-4 h-4 text-sky-600" />,
        bg: 'bg-sky-50 text-sky-800 border-sky-200',
        dot: 'bg-sky-500',
      };
    }
    if (c.includes('virtual') || c.includes('video') || c.includes('call')) {
      return {
        icon: <Video className="w-4 h-4 text-purple-600" />,
        bg: 'bg-purple-50 text-purple-800 border-purple-200',
        dot: 'bg-purple-500',
      };
    }
    if (c.includes('msl')) {
      return {
        icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
        bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dot: 'bg-indigo-500',
      };
    }
    if (c.includes('symposium') || c.includes('congress') || c.includes('webinar')) {
      return {
        icon: <Award className="w-4 h-4 text-amber-600" />,
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    if (c.includes('advisory')) {
      return {
        icon: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    return {
      icon: <Users className="w-4 h-4 text-teal-700" />,
      bg: 'bg-teal-50 text-teal-800 border-teal-200',
      dot: 'bg-teal-600',
    };
  };

  const handleMarkAsTaken = async () => {
    setIsMarkingTaken(true);
    setActionError(null);
    try {
      const res = await markActionTaken(recommendation.id);
      if (res.success) {
        onActionTakenSuccess(hcp?.name || 'HCP');
      } else {
        setActionError(res.error || 'Failed to update recommendation in Supabase.');
        setIsMarkingTaken(false);
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'An error occurred while updating.');
      setIsMarkingTaken(false);
    }
  };

  const handleTriggerRecalculate = async () => {
    if (!hcp) return;
    setActionError(null);
    setRecalculateSuccessMsg(null);
    try {
      await onRecalculate(hcp.id);
      setRecalculateSuccessMsg('Recommendation recalculated live from Supabase interaction rows!');
      setTimeout(() => setRecalculateSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Recalculation error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Today's Priority HCPs</span>
        </button>

        {/* Meeting Demo Controls: Recalculate & Add Interaction */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLogInteractionOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors shadow-2xs"
            title="Log a new interaction row to test deterministic live recalculation"
          >
            <PlusCircle className="w-4 h-4 text-teal-700" />
            <span>+ Log New Interaction</span>
          </button>

          <button
            onClick={handleTriggerRecalculate}
            disabled={isRecalculating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all shadow-xs disabled:opacity-50"
            title="Run deterministic rule engine on current database rows"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate'}</span>
          </button>
        </div>
      </div>

      {recalculateSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{recalculateSuccessMsg}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* HCP Profile Header Hero Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Core Doctor Details */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {hcp?.name}
              </h1>
              <PriorityBadge priority={recommendation.priority} size="lg" />
              {recommendation.status === 'completed' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Action Completed
                </span>
              )}
            </div>

            {/* Specialty, Institution & Location Hierarchy */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-600">
              <span className="font-bold text-teal-900 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                {hcp?.specialty}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-slate-800 font-medium">
                <Building2 className="w-4 h-4 text-slate-400" />
                {hcp?.institution}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {hcp?.location}
              </span>
            </div>

            {/* Segment & Therapeutic Area Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
                {hcp?.segment}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Therapeutic Area: <strong className="text-slate-900 font-semibold">{hcp?.therapeutic_area}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Database Touches: <strong className="text-slate-900 font-semibold">{interactions.length}</strong>
              </span>
            </div>
          </div>

          {/* Quick Header Score Stat */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Predicted Engagement
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {recommendation.predicted_engagement}%
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <Calculator className="w-3 h-3" />
                Deterministic Score
              </span>
            </div>
            <div className="w-14 h-14 rounded-full border-3 border-teal-600 bg-white flex items-center justify-center font-bold text-sm text-teal-800 shadow-2xs">
              {recommendation.predicted_engagement}%
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Full Next Best Action Recommendation Card */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-teal-50/50 to-sky-50/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-600 text-white rounded-md">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Current Next Best Action (NBA)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Evaluated by deterministic omnichannel rule engine
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTriggerRecalculate}
                    disabled={isRecalculating}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRecalculating ? 'animate-spin text-teal-600' : ''}`} />
                    <span>Recalculate</span>
                  </button>
                  <PriorityBadge priority={recommendation.priority} />
                </div>
              </div>
            </div>

            {/* Recommendation Details in Full */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Plain Language Recommended Action */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Recommended Action
                </span>
                <p className="text-lg font-bold text-slate-900 leading-snug">
                  {recommendation.recommended_action}
                </p>
              </div>

              {/* Grid: Recommended Channel & Engagement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Recommended Channel
                  </span>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <div className="p-1.5 bg-white rounded-md border border-slate-200">
                      {getChannelConfig(recommendation.recommended_channel).icon}
                    </div>
                    <span>{recommendation.recommended_channel}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Predicted Engagement
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-teal-800">
                      {recommendation.predicted_engagement}%
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Engagement Likelihood
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommended Content Topic */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Selected Content Topic (Undetailed in History)
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  {recommendation.recommended_content}
                </p>
              </div>

              {/* Full Visible Reason Bullets (Never Collapsed) */}
              <div className="p-5 bg-teal-50/40 rounded-xl border border-teal-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-950">
                    <HelpCircle className="w-4 h-4 text-teal-700" />
                    <span>Why This Action? Row-Traceable Rules Fired ({recommendation.reasons.length})</span>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase bg-teal-100/70 px-2 py-0.5 rounded">
                    100% Deterministic
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-800">
                  {recommendation.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow-2xs">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed font-medium text-slate-900 pt-0.5">
                        {reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Logged Outcome Display (if present) */}
              {outcome ? (
                <div className="p-5 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Logged Engagement Outcome
                    </span>
                    <span className="text-emerald-700 font-medium text-[11px]">
                      {new Date(outcome.recorded_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-emerald-900">
                    Response: {outcome.response}
                  </div>

                  <p className="text-xs text-emerald-800 leading-relaxed bg-white/70 p-3 rounded-lg border border-emerald-200 italic">
                    "{outcome.outcome_notes}"
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 flex items-center justify-between">
                  <span>No outcome logged yet for this recommendation.</span>
                  <button
                    onClick={() => onOpenLogOutcome(recommendation)}
                    className="font-semibold text-teal-700 hover:text-teal-900 underline"
                  >
                    Log Field Outcome
                  </button>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => onOpenLogOutcome(recommendation)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <FileCheck className="w-4 h-4 text-teal-600" />
                  <span>{outcome ? 'Update Outcome Notes' : 'Log Engagement Outcome'}</span>
                </button>

                <button
                  onClick={handleMarkAsTaken}
                  disabled={isMarkingTaken || recommendation.status === 'completed'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className={`w-4 h-4 ${isMarkingTaken ? 'animate-spin' : ''}`} />
                  <span>
                    {isMarkingTaken
                      ? 'Saving to Supabase...'
                      : recommendation.status === 'completed'
                      ? 'Action Marked as Taken'
                      : 'Mark action as taken'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chronological Interaction Timeline */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Interaction Timeline</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Chronological history of all {sortedInteractions.length} touchpoints in Supabase
                </p>
              </div>
              <button
                onClick={() => setIsLogInteractionOpen(true)}
                className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200 transition-colors flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Touch</span>
              </button>
            </div>

            {/* Vertical Timeline */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 max-h-[620px] overflow-y-auto pr-1">
              {sortedInteractions.map((item) => {
                const config = getChannelConfig(item.channel);
                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center group-hover:border-teal-600 transition-colors shadow-2xs">
                      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                      {/* Header with Date and Channel */}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] border ${config.bg}`}>
                          {config.icon}
                          {item.channel}
                        </span>
                        <span className="text-slate-500 font-medium text-[11px]">
                          {new Date(item.occurred_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Interaction Type & Topic */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {item.interaction_type}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                          {item.content_topic}
                        </h4>
                      </div>

                      {/* Notes */}
                      <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded border border-slate-200/70">
                        "{item.notes}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Log Interaction Modal */}
      <LogInteractionModal
        hcp={hcp || null}
        isOpen={isLogInteractionOpen}
        onClose={() => setIsLogInteractionOpen(false)}
        onSuccess={async (id) => {
          await onRecalculate(id);
          setRecalculateSuccessMsg('New interaction logged to Supabase and recommendation recalculated live!');
          setTimeout(() => setRecalculateSuccessMsg(null), 4000);
        }}
      />
    </div>
  );
};

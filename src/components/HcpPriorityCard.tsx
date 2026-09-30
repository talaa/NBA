import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Mail,
  Users,
  Video,
  Sparkles,
  Building2,
  MapPin,
  Clock,
  History,
  FileCheck,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Recommendation } from '../types/database';
import { PriorityBadge } from './PriorityBadge';

interface HcpPriorityCardProps {
  recommendation: Recommendation;
  onLogOutcome: (recommendation: Recommendation) => void;
  onSelectHcp: (recommendation: Recommendation) => void;
  onRecalculate?: (hcpId: string) => Promise<void>;
  isExpandedByDefault?: boolean;
}

export const HcpPriorityCard: React.FC<HcpPriorityCardProps> = ({
  recommendation,
  onLogOutcome,
  onSelectHcp,
  onRecalculate,
  isExpandedByDefault = false,
}) => {
  const [isWhyOpen, setIsWhyOpen] = useState(isExpandedByDefault);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRecalculatingCard, setIsRecalculatingCard] = useState(false);

  const hcp = recommendation.hcp;
  const outcome = recommendation.outcome;
  const interactions = recommendation.interactions || [];

  // Helper for channel icon
  const getChannelIcon = (channel: string) => {
    const c = channel.toLowerCase();
    if (c.includes('mail')) {
      return <Mail className="w-4 h-4 text-sky-600 shrink-0" />;
    }
    if (c.includes('virtual') || c.includes('video')) {
      return <Video className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
    if (c.includes('msl')) {
      return <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />;
    }
    return <Users className="w-4 h-4 text-teal-700 shrink-0" />;
  };

  // Format engagement color
  const getEngagementColor = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-teal-700 bg-teal-50 border-teal-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-all overflow-hidden">
      {/* Top Banner / Card Header */}
      <div className="p-5 sm:p-6 pb-4 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left Column: HCP Core Info */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => onSelectHcp(recommendation)}
                className="text-left text-lg font-bold text-slate-900 hover:text-teal-700 transition-colors tracking-tight flex items-center gap-1.5 group"
                title="Open HCP 360° Profile"
              >
                <span>{hcp?.name || 'Healthcare Professional'}</span>
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-teal-600" />
              </button>
              <PriorityBadge priority={recommendation.priority} />
              {hcp?.segment && (
                <span className="text-xs text-slate-500 font-medium">
                  {hcp.segment}
                </span>
              )}
            </div>

            {/* Specialty & Institution Details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="font-semibold text-teal-900">{hcp?.specialty}</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {hcp?.institution}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                <MapPin className="w-3 h-3 text-slate-400" />
                {hcp?.location}
              </span>
              {hcp?.therapeutic_area && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-xs text-slate-500">
                    Area: <strong className="text-slate-700 font-medium">{hcp.therapeutic_area}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Predicted Engagement Gauge */}
          <div className="flex items-center gap-4 self-start lg:self-auto shrink-0">
            <div className="text-right">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
                Predicted Engagement
              </span>
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {recommendation.predicted_engagement}%
                </span>
                <span className="text-xs text-emerald-600 font-medium">High Engagement</span>
              </div>
            </div>

            {/* Engagement Gauge Meter */}
            <div
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm ${getEngagementColor(
                recommendation.predicted_engagement
              )}`}
              title={`Calculated engagement score: ${recommendation.predicted_engagement}%`}
            >
              {recommendation.predicted_engagement}%
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Recommended Action, Channel & Content in Plain Language */}
      <div className="p-5 sm:p-6 bg-slate-50/50 space-y-4">
        {/* Recommended Action (Primary Focus) */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            Recommended Action
          </div>
          <p className="text-base font-semibold text-slate-900 leading-snug">
            {recommendation.recommended_action}
          </p>
        </div>

        {/* 2-Column Grid: Channel & Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Channel Card */}
          <div className="md:col-span-4 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Optimal Channel
            </span>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-md">
                {getChannelIcon(recommendation.recommended_channel)}
              </div>
              <span className="text-sm font-semibold text-slate-800">
                {recommendation.recommended_channel}
              </span>
            </div>
          </div>

          {/* Recommended Content */}
          <div className="md:col-span-8 bg-white p-3.5 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Recommended Clinical Content / Topic
            </span>
            <p className="text-sm font-medium text-slate-800">
              {recommendation.recommended_content}
            </p>
          </div>
        </div>

        {/* Logged Outcome Banner (if already recorded) */}
        {outcome && (
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between font-semibold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Outcome Recorded: {outcome.response}
              </span>
              <span className="text-[11px] text-emerald-700 font-normal">
                {new Date(outcome.recorded_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-emerald-800 leading-relaxed pl-5">
              "{outcome.outcome_notes}"
            </p>
          </div>
        )}
      </div>

      {/* Expandable Section 1: "Why?" Section */}
      <div className="border-t border-slate-200">
        <button
          onClick={() => setIsWhyOpen(!isWhyOpen)}
          className="w-full px-5 sm:px-6 py-3 bg-white hover:bg-slate-50 flex items-center justify-between text-left transition-colors"
          aria-expanded={isWhyOpen}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <HelpCircle className="w-4 h-4 text-teal-600" />
            <span>Why this recommendation?</span>
            <span className="text-xs font-normal text-slate-500">
              ({recommendation.reasons.length} driving factors)
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-teal-700 font-medium">
            <span>{isWhyOpen ? 'Hide rationale' : 'View rationale'}</span>
            {isWhyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isWhyOpen && (
          <div className="px-5 sm:px-6 pb-4 pt-1 bg-teal-50/30 border-t border-teal-100">
            <div className="p-3.5 bg-white rounded-lg border border-teal-200/60 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 block mb-2">
                Algorithm & Behavioral Rationale:
              </span>
              <ul className="space-y-2 text-xs text-slate-700">
                {recommendation.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed font-medium">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Section 2: Recent Interaction History (4-6 pre-seeded interactions) */}
      <div className="border-t border-slate-200">
        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className="w-full px-5 sm:px-6 py-2.5 bg-white hover:bg-slate-50 flex items-center justify-between text-left transition-colors text-xs text-slate-600"
          aria-expanded={isHistoryOpen}
        >
          <div className="flex items-center gap-2 font-medium">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Relationship Context & Past Interactions</span>
            <span className="text-[11px] text-slate-400">
              ({interactions.length} previous logged touches)
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <span>{isHistoryOpen ? 'Collapse history' : 'Expand history'}</span>
            {isHistoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {isHistoryOpen && (
          <div className="px-5 sm:px-6 pb-4 pt-2 bg-slate-50 border-t border-slate-200 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Recent Chronological Engagements
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {interactions.map((inter) => (
                <div
                  key={inter.id}
                  className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {inter.channel} · {inter.interaction_type}
                    </span>
                    <span>
                      {new Date(inter.occurred_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900">{inter.content_topic}</div>
                  <p className="text-slate-600 text-[11px] italic">"{inter.notes}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="px-5 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Priority Rank:</span>
          <span className="font-semibold text-slate-800">
            {recommendation.priority === 'High' ? '#1 Urgent Today' : recommendation.priority === 'Medium' ? '#2 Priority This Week' : '#3 Targeted Opportunity'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRecalculate && hcp && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setIsRecalculatingCard(true);
                try {
                  await onRecalculate(hcp.id);
                } finally {
                  setIsRecalculatingCard(false);
                }
              }}
              disabled={isRecalculatingCard}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
              title="Recalculate recommendation deterministically from database rows"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculatingCard ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">{isRecalculatingCard ? 'Scoring...' : 'Recalculate'}</span>
            </button>
          )}

          <button
            onClick={() => onLogOutcome(recommendation)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {outcome ? (
              <>
                <FileCheck className="w-3.5 h-3.5 text-teal-600" />
                Update Outcome
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                Log Outcome
              </>
            )}
          </button>

          <button
            onClick={() => onSelectHcp(recommendation)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-teal-700 transition-colors shadow-xs"
          >
            <span>View 360° Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

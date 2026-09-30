import React, { useState } from 'react';
import { X, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { Recommendation } from '../types/database';
import { recordOutcome } from '../lib/supabase';

interface LogOutcomeModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RESPONSE_OPTIONS = [
  'Favorable - High Engagement & Request for Follow-up',
  'Favorable - Agreed to Trial / Adopt Protocol',
  'Neutral - Requested Medical Reprints / Dossier',
  'Neutral - Deferred to Future Meeting / Timing Not Right',
  'Unfavorable - Formulary Restriction / Competitor Preferred',
  'Unfavorable - No Clinical Need / Declined Topic',
];

export const LogOutcomeModal: React.FC<LogOutcomeModalProps> = ({
  recommendation,
  onClose,
  onSuccess,
}) => {
  if (!recommendation) return null;

  const currentOutcome = recommendation.outcome;

  const [response, setResponse] = useState<string>(
    currentOutcome?.response || RESPONSE_OPTIONS[0]
  );
  const [outcomeNotes, setOutcomeNotes] = useState<string>(
    currentOutcome?.outcome_notes || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeNotes.trim()) {
      setError('Please enter field notes describing the HCP reaction or next steps.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await recordOutcome(recommendation.id, response, outcomeNotes.trim());
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to save outcome.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {currentOutcome ? 'Update Recommendation Outcome' : 'Log Engagement Outcome'}
            </h3>
            <p className="text-xs text-slate-500">
              Recording field response for {recommendation.hcp?.name || 'HCP'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Context Recap */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div>
              <span className="font-semibold text-slate-700">Recommended Action:</span>{' '}
              {recommendation.recommended_action}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Channel & Content:</span>{' '}
              {recommendation.recommended_channel} · {recommendation.recommended_content}
            </div>
          </div>

          {/* Response Outcome Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              HCP Response / Sentiment
            </label>
            <select
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {RESPONSE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Field Rep Notes & Next Steps
            </label>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              rows={4}
              placeholder="e.g., Dr. Vance expressed strong interest in the HER2-low sub-analysis and agreed to present 2 candidate patient profiles at the upcoming tumor board..."
              className="w-full text-sm rounded-lg border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save to Supabase & Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Calendar,
  Layers,
  MessageSquare,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { HCP } from '../types/database';
import { addHcpInteraction } from '../lib/supabase';

interface LogInteractionModalProps {
  hcp: HCP | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (hcpId: string) => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({
  hcp,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !hcp) return null;

  const todayStr = '2026-09-29';
  const [channel, setChannel] = useState<string>('In-Person Detailing');
  const [interactionType, setInteractionType] = useState<string>('Product Presentation');
  const [contentTopic, setContentTopic] = useState<string>(
    'Phase III overall survival subgroup data in HER2-low metastatic breast cancer'
  );
  const [occurredAt, setOccurredAt] = useState<string>(todayStr);
  const [notes, setNotes] = useState<string>(
    'Conducted face-to-face clinic detail. Physician reviewed latest subgroup curves and requested follow-up slides.'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentTopic.trim() || !notes.trim()) {
      setErrorMessage('Please fill in both the clinical content topic and rep notes.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await addHcpInteraction({
        hcp_id: hcp.id,
        channel,
        interaction_type: interactionType,
        content_topic: contentTopic.trim(),
        occurred_at: `${occurredAt}T10:00:00+00:00`,
        notes: notes.trim(),
      });

      if (res.success) {
        onSuccess(hcp.id);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to record interaction in Supabase.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error adding interaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-teal-500 text-slate-900 rounded-md">
              <PlusCircle className="w-4 h-4 font-bold" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Log Field Interaction</h3>
              <p className="text-xs text-slate-300">
                Record new touchpoint for <strong className="text-white">{hcp.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Deterministic Scoring Trigger:</strong> Logging this interaction will add a row to Supabase and allow the scoring engine to recalculate channel fatigue penalties, cadence gaps, and topics in real time!
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Engagement Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="In-Person Detailing">In-Person Detailing</option>
                <option value="Approved Rep Email">Approved Rep Email</option>
                <option value="Virtual Call">Virtual Call / Video Detail</option>
                <option value="Symposium / Congress">Symposium / Congress</option>
                <option value="MSL Medical Exchange">MSL Medical Exchange</option>
                <option value="SMS">SMS Clinical Alert</option>
                <option value="WhatsApp">WhatsApp Message</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interaction Date
              </label>
              <input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Interaction Type
            </label>
            <select
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="Product Presentation">Product Presentation</option>
              <option value="Clinical Study Review">Clinical Study Review</option>
              <option value="Digital Monograph">Digital Monograph</option>
              <option value="Sample Drop & Dialogue">Sample Drop & Dialogue</option>
              <option value="Scientific Exchange">Scientific Exchange</option>
              <option value="Practice Support">Practice Support / Prior Auth</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Clinical Content Topic Discussed
            </label>
            <input
              type="text"
              value={contentTopic}
              onChange={(e) => setContentTopic(e.target.value)}
              placeholder="e.g. Phase III overall survival subgroup data..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rep Field Notes & Context Signals
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record physician questions, reception to data, or stated preferences..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving to Supabase...' : 'Save Interaction & Recalculate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Aura NBA: Deterministic Rule-Based Scoring Engine
 * 
 * 100% Deterministic, Auditable Rule Set (No LLM calls).
 * Every channel score and reason string is directly traceable back to specific rows in the database.
 * 
 * Scoring Rules Table:
 * - Opened/clicked/attended rate on this channel > 60%: +40
 * - Opened/clicked/attended rate on this channel 30-60%: +20
 * - Opened/clicked/attended rate on this channel < 30%: +5
 * - No interaction at all on this channel in 6 months: +10 (untested, worth a try)
 * - Two or more "ignored" outcomes in a row on this channel: -30 (actively avoid)
 * - Channel matches HCP's segment default (e.g. High Value → rep visit weighted +10): +10
 */

import { getSupabaseClient } from './supabase';
import { HCP, Interaction, Recommendation, PriorityLevel } from '../types/database';

export type ChannelKey = 'rep_visit' | 'email' | 'call' | 'webinar' | 'sms' | 'whatsapp';

export interface FiringRule {
  ruleId: string;
  ruleName: string;
  delta: number;
  evidenceRowId?: string;
  evidenceDate?: string;
  evidenceTopic?: string;
  description: string;
}

export interface ChannelScoreResult {
  channelKey: ChannelKey;
  channelLabel: string;
  score: number;
  firingRules: FiringRule[];
  interactionCount: number;
  engagedCount: number;
  engagementRate: number;
  lastTouchDate?: string;
  daysSinceLastTouch?: number;
  twoIgnoredInARow: boolean;
}

export interface ComputedRecommendationResult {
  hcpId: string;
  hcpName: string;
  recommendedAction: string;
  recommendedChannel: string;
  recommendedContent: string;
  predictedEngagement: number;
  priority: PriorityLevel;
  reasons: string[];
  channelScores: Record<string, number>;
  daysSinceLastInteraction: number;
  firingRulesSummary: string[];
  databaseUpdated: boolean;
}

// Canonical clinical topic catalog per Therapeutic Area
// The engine checks which topics the HCP has already received in `interactions.content_topic`
// and deterministically picks the highest-priority topic that has NOT yet been detailed.
const TOPIC_CATALOG_BY_TA: Record<string, string[]> = {
  Oncology: [
    'Phase III Overall Survival subgroup analysis in HER2-low refractory cohort',
    'Real-world IHC 1+ cutoffs and NGS liquid biopsy concordance',
    'Sequential bispecific antibody timing after CAR-T relapse',
    'CNS metastasis progression-free survival in brain-dominant disease',
    'Mechanisms of antibody-drug conjugate payload resistance',
    'Proactive management and CT screening protocol for drug-induced ILD',
    'Outpatient step-up dosing and cytokine release syndrome premedication',
  ],
  Cardiovascular: [
    'Post-PCI dual antiplatelet duration in high-bleeding-risk diabetic acute coronary syndrome',
    'Rapid quadruple GDMT initiation during index heart failure admission',
    'Outpatient ambulatory hemodynamic monitoring and GDMT titration algorithms',
    'ESC/ACC guideline updates on P2Y12 inhibitor monotherapy switch',
    'SGLT2i + ARNI synergistic reduction in 30-day cardiovascular mortality',
    'Inpatient titration roadmap and potassium monitoring intervals in CKD',
  ],
  Immunology: [
    '2-year radiographic progression arrest data & ACR70 durability in TNF-inadequate responders',
    'JAK inhibitor vs. biologic sequencing in enthesitis-dominant psoriatic arthritis',
    'Endoscopic and histologic mucosal healing rates in moderate-to-severe Crohn’s disease',
    'Deep transmural healing benchmarks and therapeutic drug monitoring algorithms',
    'Auto-injector device ergonomics and self-administration adherence registry',
  ],
  'Metabolic & Diabetes': [
    'Renal composite outcome preservation and eGFR slope stabilization across 25-45 spectrum',
    'Continuous glucose monitoring time-in-range kinetics with basal insulin co-administration',
    'Cardio-renal-metabolic outcome trial primary endpoint breakdown',
    'Bilingual patient titration tear-pads and lifestyle counseling aids',
  ],
  Respiratory: [
    'GOLD 2026 exacerbation reduction data stratified by blood eosinophils (>=300 vs <150 cells/uL)',
    'Inhaler device peak inspiratory flow requirements across severe COPD phenotypes',
    'Lancet Respiratory Medicine pooled meta-analysis on moderate exacerbation rates',
    'Biologic add-on therapy in T2-high severe uncontrolled asthma and nasal polyposis',
  ],
  Nephrology: [
    'Targeted-release mucosal corticosteroid: proteinuria reduction trajectory and safety',
    'Steroid-sparing alternative protocols in primary IgA nephropathy registries',
    'Kidney International 2-year proteinuria and eGFR total slope findings',
    'Practical guidelines on monitoring blood pressure and bone density without systemic glucocorticoids',
  ],
  Neurology: [
    'Caregiver burden mitigation toolkit and expedited Medicaid prior authorization roadmap',
    'Long-term cognitive developmental milestones at 36-month registry follow-up',
    'Drug-drug interaction clearance with concomitant broad-spectrum anti-epileptics',
    'Pediatric drug formulation: taste-masking oral suspension compliance',
  ],
  Dermatology: [
    'Peak pruritus numerical rating score drop within 48h and Week 16 EASI-75 response',
    '52-week durable clear skin outcomes in biologic-naive atopic dermatitis',
    'Sample closet replenishment and pediatric patient demonstration aids',
    'Steroid-phobia mitigation and barrier repair counseling guides',
  ],
  'Infectious Disease': [
    'CRE susceptibility profiles, stewardship criteria compliance, and ICU length-of-stay reduction',
    'Synergistic in-vitro kill kinetics and resistance prevention mechanisms',
    'Antimicrobial stewardship executive dossier ahead of hospital P&T committee review',
    'Rapid molecular resistance testing integration with targeted carbapenem-sparing agents',
  ],
};

export const CHANNEL_DEFINITIONS: Record<
  ChannelKey,
  { label: string; actionTemplate: (topic: string) => string }
> = {
  rep_visit: {
    label: 'Face-to-Face Meeting',
    actionTemplate: (topic) => `Conduct face-to-face detail to review ${topic}`,
  },
  email: {
    label: 'Approved Rep Email',
    actionTemplate: (topic) => `Share digital clinical monograph via rep-approved email on ${topic}`,
  },
  call: {
    label: 'Virtual Call / Video Detail',
    actionTemplate: (topic) => `Schedule concise 15-minute virtual video consultation focusing on ${topic}`,
  },
  webinar: {
    label: 'Webinar / Digital Symposium',
    actionTemplate: (topic) => `Invite HCP to regional digital symposium discussing ${topic}`,
  },
  sms: {
    label: 'SMS Clinical Alert',
    actionTemplate: (topic) => `Send concise SMS clinical bulletin link highlighting ${topic}`,
  },
  whatsapp: {
    label: 'WhatsApp Secure Direct Message',
    actionTemplate: (topic) => `Send secure messaging summary with PDF attachment covering ${topic}`,
  },
};

/**
 * Maps a raw interaction channel string to one of the 6 standard channel keys
 */
export function mapChannelToKey(channel: string): ChannelKey {
  const ch = channel.toLowerCase();
  if (ch.includes('person') || ch.includes('detail') || ch.includes('visit') || ch.includes('face') || ch.includes('f2f')) {
    return 'rep_visit';
  }
  if (ch.includes('mail')) {
    return 'email';
  }
  if (ch.includes('sms') || ch.includes('text')) {
    return 'sms';
  }
  if (ch.includes('whatsapp') || ch.includes('message')) {
    return 'whatsapp';
  }
  if (ch.includes('webinar') || ch.includes('symposium') || ch.includes('congress') || ch.includes('conference')) {
    return 'webinar';
  }
  if (ch.includes('call') || ch.includes('virtual') || ch.includes('phone')) {
    return 'call';
  }
  return 'rep_visit';
}

/**
 * Deterministically checks if an interaction outcome is considered "ignored"
 */
export function isIgnoredInteraction(item: Interaction): boolean {
  const text = `${item.notes || ''} ${item.interaction_type || ''}`.toLowerCase();
  return (
    text.includes('ignored') ||
    text.includes('unopened') ||
    text.includes('did not open') ||
    text.includes('bounced') ||
    text.includes('no response') ||
    text.includes('did not respond') ||
    text.includes('declined') ||
    text.includes('did not attend') ||
    text.includes('no-show') ||
    text.includes('refused') ||
    text.includes('unreachable') ||
    text.includes('unavailable') ||
    text.includes('cancelled')
  );
}

/**
 * Deterministically checks if an interaction was "opened / clicked / attended" (engaged)
 */
export function isEngagedInteraction(item: Interaction): boolean {
  if (isIgnoredInteraction(item)) {
    return false;
  }
  const text = `${item.notes || ''} ${item.interaction_type || ''}`.toLowerCase();
  const engagedKeywords = [
    'open',
    'opened',
    'click',
    'clicked',
    'attend',
    'attended',
    'download',
    'downloaded',
    'read',
    'completed',
    'engaged',
    'reviewed',
    'discussed',
    'agreed',
    'accepted',
    'replied',
    'favorable',
    'joined',
    'tested',
    'participated',
    'delivered',
    'shared',
    'confirmed',
    'admitted',
    'active',
    'prescribed',
  ];

  for (const kw of engagedKeywords) {
    if (text.includes(kw)) return true;
  }

  // By default in pharma CRM history, an in-person visit or scheduled call conducted
  // without an 'ignored' flag is considered an attended touchpoint.
  const ch = item.channel.toLowerCase();
  if (ch.includes('person') || ch.includes('visit') || ch.includes('detail') || ch.includes('call')) {
    return true;
  }

  return false;
}

/**
 * Resolves the HCP segment's default channel
 * e.g. High Value / KOL / Tier 1 -> rep_visit weighted +10
 */
export function getSegmentDefaultChannel(segment: string): { key: ChannelKey; label: string } {
  const s = (segment || '').toLowerCase();
  if (s.includes('digital')) {
    return { key: 'email', label: 'Approved Rep Email' };
  }
  if (s.includes('virtual') || s.includes('remote')) {
    return { key: 'call', label: 'Virtual Call / Video Detail' };
  }
  // High Value, Key Opinion Leader, High Prescriber, Rising Star default to rep_visit
  return { key: 'rep_visit', label: 'Face-to-Face Meeting' };
}

/**
 * Deterministic scoring engine for a single HCP
 */
export async function computeRecommendation(hcpId: string): Promise<ComputedRecommendationResult> {
  const client = getSupabaseClient();

  let hcp: HCP | null = null;
  let interactions: Interaction[] = [];

  // 1. Fetch HCP and their interaction history from Supabase (or fallback)
  if (client) {
    const { data: hcpData, error: hcpError } = await client
      .from('hcps')
      .select('*')
      .eq('id', hcpId)
      .single();

    if (hcpError || !hcpData) {
      throw new Error(`Failed to load HCP from Supabase: ${hcpError?.message || 'Not found'}`);
    }
    hcp = hcpData;

    const { data: interData, error: interError } = await client
      .from('interactions')
      .select('*')
      .eq('hcp_id', hcpId)
      .order('occurred_at', { ascending: false });

    if (interError) {
      throw new Error(`Failed to load interactions: ${interError.message}`);
    }
    interactions = interData || [];
  } else {
    throw new Error('Supabase client is not configured.');
  }

  if (!hcp) {
    throw new Error(`HCP with id ${hcpId} not found in database.`);
  }

  // Current simulation reference time
  const now = new Date();

  // 2. Analyze overall interaction recency
  const sortedInteractions = [...interactions].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  const lastInteraction = sortedInteractions[0];
  const daysSinceLastInteraction = lastInteraction
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastInteraction.occurred_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 999;

  // Group interactions by each of the 6 channels (sorted descending by date)
  const channelHistory: Record<ChannelKey, Interaction[]> = {
    rep_visit: [],
    email: [],
    call: [],
    webinar: [],
    sms: [],
    whatsapp: [],
  };

  interactions.forEach((item) => {
    const chKey = mapChannelToKey(item.channel);
    channelHistory[chKey].push(item);
  });

  // Ensure each channel history is sorted by occurred_at descending (most recent first)
  (Object.keys(channelHistory) as ChannelKey[]).forEach((key) => {
    channelHistory[key].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  });

  // Identify HCP segment default channel
  const segmentDefault = getSegmentDefaultChannel(hcp.segment);

  // -------------------------------------------------------------------------
  // 3. DETERMINISTIC CHANNEL SCORING (Rules Table from Design Spec)
  //
  // Baseline score: 40 points
  // Rules applied per channel:
  // 1. Opened/clicked/attended rate on this channel > 60%: +40
  // 2. Opened/clicked/attended rate on this channel 30-60%: +20
  // 3. Opened/clicked/attended rate on this channel < 30%: +5
  // 4. No interaction at all on this channel in 6 months: +10 (untested, worth a try)
  // 5. Two or more "ignored" outcomes in a row on this channel: -30 (actively avoid)
  // 6. Channel matches HCP's segment default (e.g. High Value → rep visit): +10
  // -------------------------------------------------------------------------
  const channelScores: Record<ChannelKey, ChannelScoreResult> = {
    rep_visit: {
      channelKey: 'rep_visit',
      channelLabel: CHANNEL_DEFINITIONS.rep_visit.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
    email: {
      channelKey: 'email',
      channelLabel: CHANNEL_DEFINITIONS.email.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
    call: {
      channelKey: 'call',
      channelLabel: CHANNEL_DEFINITIONS.call.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
    webinar: {
      channelKey: 'webinar',
      channelLabel: CHANNEL_DEFINITIONS.webinar.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
    sms: {
      channelKey: 'sms',
      channelLabel: CHANNEL_DEFINITIONS.sms.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
    whatsapp: {
      channelKey: 'whatsapp',
      channelLabel: CHANNEL_DEFINITIONS.whatsapp.label,
      score: 40,
      firingRules: [],
      interactionCount: 0,
      engagedCount: 0,
      engagementRate: 0,
      twoIgnoredInARow: false,
    },
  };

  const channelKeys: ChannelKey[] = ['rep_visit', 'email', 'call', 'webinar', 'sms', 'whatsapp'];

  for (const chKey of channelKeys) {
    const history = channelHistory[chKey];
    const totalCount = history.length;
    const chResult = channelScores[chKey];
    chResult.interactionCount = totalCount;

    const mostRecent = history[0];
    const daysSinceMostRecent = mostRecent
      ? Math.max(0, Math.floor((now.getTime() - new Date(mostRecent.occurred_at).getTime()) / (1000 * 60 * 60 * 24)))
      : 999;

    chResult.lastTouchDate = mostRecent ? mostRecent.occurred_at.split('T')[0] : undefined;
    chResult.daysSinceLastTouch = daysSinceMostRecent;

    // --- RULE SET EVALUATION ---

    // 1. Check engagement rate if interactions exist on this channel
    if (totalCount > 0) {
      const engagedList = history.filter(isEngagedInteraction);
      const engagedCount = engagedList.length;
      const rate = engagedCount / totalCount;
      chResult.engagedCount = engagedCount;
      chResult.engagementRate = rate;

      const ratePct = Math.round(rate * 100);
      const sampleEngaged = engagedList[0] || history[0];

      if (rate > 0.6) {
        chResult.score += 40;
        chResult.firingRules.push({
          ruleId: 'RATE_GT_60',
          ruleName: 'Opened/clicked/attended rate > 60%',
          delta: 40,
          evidenceRowId: sampleEngaged.id,
          evidenceDate: sampleEngaged.occurred_at.split('T')[0],
          evidenceTopic: sampleEngaged.content_topic,
          description: `Historical response rate on ${chResult.channelLabel} is ${ratePct}% (${engagedCount}/${totalCount} engaged). Example on ${sampleEngaged.occurred_at.split('T')[0]} ('${sampleEngaged.content_topic}') recorded active engagement: "${sampleEngaged.notes}" (+40 pts)`,
        });
      } else if (rate >= 0.3) {
        chResult.score += 20;
        chResult.firingRules.push({
          ruleId: 'RATE_30_TO_60',
          ruleName: 'Opened/clicked/attended rate 30-60%',
          delta: 20,
          evidenceRowId: sampleEngaged.id,
          evidenceDate: sampleEngaged.occurred_at.split('T')[0],
          evidenceTopic: sampleEngaged.content_topic,
          description: `Moderate response rate on ${chResult.channelLabel} of ${ratePct}% (${engagedCount}/${totalCount} engaged). Evidence on ${sampleEngaged.occurred_at.split('T')[0]} ('${sampleEngaged.content_topic}'): "${sampleEngaged.notes}" (+20 pts)`,
        });
      } else {
        chResult.score += 5;
        chResult.firingRules.push({
          ruleId: 'RATE_LT_30',
          ruleName: 'Opened/clicked/attended rate < 30%',
          delta: 5,
          evidenceRowId: sampleEngaged.id,
          evidenceDate: sampleEngaged.occurred_at.split('T')[0],
          evidenceTopic: sampleEngaged.content_topic,
          description: `Low baseline response rate on ${chResult.channelLabel} of ${ratePct}% (${engagedCount}/${totalCount} engaged), evaluated against prior touch on ${sampleEngaged.occurred_at.split('T')[0]} ('${sampleEngaged.content_topic}') (+5 pts)`,
        });
      }
    }

    // 2. Rule: No interaction at all on this channel in 6 months (+10 pts: untested, worth a try)
    // 6 months = 180 days. Fires if 0 touches ever, or last touch was > 180 days ago.
    if (totalCount === 0) {
      chResult.score += 10;
      chResult.firingRules.push({
        ruleId: 'NO_TOUCH_6_MONTHS_ZERO',
        ruleName: 'No interaction on channel in 6 months',
        delta: 10,
        description: `No recorded interactions at all on ${chResult.channelLabel} in over 6 months (untested channel for this HCP, worth a try) (+10 pts)`,
      });
    } else if (daysSinceMostRecent > 180) {
      chResult.score += 10;
      chResult.firingRules.push({
        ruleId: 'NO_TOUCH_6_MONTHS_DORMANT',
        ruleName: 'No interaction on channel in 6 months',
        delta: 10,
        evidenceRowId: mostRecent.id,
        evidenceDate: mostRecent.occurred_at.split('T')[0],
        evidenceTopic: mostRecent.content_topic,
        description: `No interactions on ${chResult.channelLabel} in ${daysSinceMostRecent} days (> 6 months since ${mostRecent.occurred_at.split('T')[0]} on '${mostRecent.content_topic}' — untested channel window, worth a try) (+10 pts)`,
      });
    }

    // 3. Rule: Two or more "ignored" outcomes in a row on this channel (-30 pts: actively avoid)
    if (totalCount >= 2) {
      const firstIsIgnored = isIgnoredInteraction(history[0]);
      const secondIsIgnored = isIgnoredInteraction(history[1]);

      if (firstIsIgnored && secondIsIgnored) {
        chResult.twoIgnoredInARow = true;
        chResult.score -= 30;
        chResult.firingRules.push({
          ruleId: 'TWO_IGNORED_IN_A_ROW',
          ruleName: 'Two or more "ignored" outcomes in a row',
          delta: -30,
          evidenceRowId: history[0].id,
          evidenceDate: history[0].occurred_at.split('T')[0],
          evidenceTopic: history[0].content_topic,
          description: `Two consecutive 'ignored' outcomes in a row on ${chResult.channelLabel}: on ${history[0].occurred_at.split('T')[0]} ('${history[0].content_topic}') and ${history[1].occurred_at.split('T')[0]} ('${history[1].content_topic}') (-30 pts, actively avoid)`,
        });
      }
    }

    // 4. Rule: Channel matches HCP's segment default (+10 pts)
    if (chKey === segmentDefault.key) {
      chResult.score += 10;
      chResult.firingRules.push({
        ruleId: 'SEGMENT_DEFAULT_MATCH',
        ruleName: "Channel matches HCP's segment default",
        delta: 10,
        description: `Channel matches HCP segment default for '${hcp.segment}' (${chResult.channelLabel} weighted +10 pts)`,
      });
    }
  }

  // -------------------------------------------------------------
  // 4. Select Winning Channel
  // -------------------------------------------------------------
  const allChannels = Object.values(channelScores);
  allChannels.sort((a, b) => b.score - a.score);
  const winningChannelResult = allChannels[0];

  // Predicted Engagement percentage (clamped between 15% and 98%)
  const predictedEngagement = Math.min(98, Math.max(15, winningChannelResult.score));

  // -------------------------------------------------------------
  // 5. Select Content Topic the HCP has NOT yet been detailed on
  // -------------------------------------------------------------
  const taCatalog = TOPIC_CATALOG_BY_TA[hcp.therapeutic_area] || TOPIC_CATALOG_BY_TA.Oncology;
  const coveredTopicsLower = interactions.map((i) => (i.content_topic || '').toLowerCase().trim());

  let selectedTopic = taCatalog.find((topic) => {
    const tLower = topic.toLowerCase();
    return !coveredTopicsLower.some((covered) => covered.includes(tLower) || tLower.includes(covered));
  });

  if (!selectedTopic) {
    selectedTopic = `Updated 2026 clinical registry follow-up: ${taCatalog[0]}`;
  }

  // Generate recommended action string
  const recommendedAction = CHANNEL_DEFINITIONS[winningChannelResult.channelKey].actionTemplate(selectedTopic);
  const recommendedChannel = winningChannelResult.channelLabel;

  // -------------------------------------------------------------
  // 6. Set Priority Deterministically
  // "High if no meaningful interaction in 45+ days AND predicted engagement > 70%,
  //  Medium if predicted engagement 40-70%, Low otherwise"
  // -------------------------------------------------------------
  let priority: PriorityLevel = 'Low';
  if (daysSinceLastInteraction >= 45 && predictedEngagement > 70) {
    priority = 'High';
  } else if (predictedEngagement >= 40 && predictedEngagement <= 70) {
    priority = 'Medium';
  } else if (predictedEngagement > 70 && daysSinceLastInteraction < 45) {
    // High engagement but engaged within 45 days falls to Medium
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  // -------------------------------------------------------------
  // 7. Build Traceable Reasons Array from Specific Rows That Fired
  // Each reason string references an actual interaction date, topic, or signal
  // -------------------------------------------------------------
  const reasons: string[] = [];

  // Add the specific firing rules from the winning channel
  winningChannelResult.firingRules.forEach((rule) => {
    reasons.push(rule.description);
  });

  // Ensure content freshness reason is explicitly cited
  reasons.push(
    `Content gap confirmed: Dr. ${hcp.name.split(' ').slice(-1)[0]} has not yet been detailed on '${selectedTopic}' across any prior recorded interaction in ${hcp.therapeutic_area}.`
  );

  // Add recency cadence and priority justification
  if (lastInteraction) {
    reasons.push(
      `${daysSinceLastInteraction >= 45 ? `No meaningful interaction in ${daysSinceLastInteraction} days (last on ${lastInteraction.occurred_at.split('T')[0]} for '${lastInteraction.content_topic}')` : `Last interaction was recent (${daysSinceLastInteraction} days ago on ${lastInteraction.occurred_at.split('T')[0]} for '${lastInteraction.content_topic}')`} combined with ${predictedEngagement}% predicted engagement establishes ${priority} Priority.`
    );
  } else {
    reasons.push(
      `Zero prior recorded interactions in database with ${predictedEngagement}% predicted engagement establishes ${priority} Priority.`
    );
  }

  // -------------------------------------------------------------
  // 8. Write into Supabase `recommendations` Table
  // Overwrites existing pending/active recommendation for this HCP
  // -------------------------------------------------------------
  let databaseUpdated = false;
  if (client) {
    try {
      const { data: existingRecs } = await client
        .from('recommendations')
        .select('id')
        .eq('hcp_id', hcpId)
        .in('status', ['active', 'pending']);

      if (existingRecs && existingRecs.length > 0) {
        const existingId = existingRecs[0].id;
        const { error: updateError } = await client
          .from('recommendations')
          .update({
            recommended_action: recommendedAction,
            recommended_channel: recommendedChannel,
            recommended_content: selectedTopic,
            priority: priority,
            predicted_engagement: predictedEngagement,
            reasons: reasons,
            status: 'active',
            created_at: new Date().toISOString(),
          })
          .eq('id', existingId);

        if (!updateError) databaseUpdated = true;
      } else {
        const { error: insertError } = await client.from('recommendations').insert({
          hcp_id: hcpId,
          recommended_action: recommendedAction,
          recommended_channel: recommendedChannel,
          recommended_content: selectedTopic,
          priority: priority,
          predicted_engagement: predictedEngagement,
          reasons: reasons,
          status: 'active',
          created_at: new Date().toISOString(),
        });

        if (!insertError) databaseUpdated = true;
      }
    } catch (e) {
      console.warn('Supabase recommendation persist notice:', e);
    }
  }

  const scoresMap: Record<string, number> = {};
  allChannels.forEach((c) => {
    scoresMap[c.channelLabel] = c.score;
  });

  return {
    hcpId,
    hcpName: hcp.name,
    recommendedAction,
    recommendedChannel,
    recommendedContent: selectedTopic,
    predictedEngagement,
    priority,
    reasons,
    channelScores: scoresMap,
    daysSinceLastInteraction,
    firingRulesSummary: winningChannelResult.firingRules.map((r) => r.ruleName),
    databaseUpdated,
  };
}

/**
 * Recomputes recommendations for ALL HCPs in Supabase
 */
export async function computeAllRecommendations(): Promise<{
  success: boolean;
  totalComputed: number;
  results: ComputedRecommendationResult[];
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data: hcps, error } = await client.from('hcps').select('id, name');
  if (error || !hcps) {
    throw new Error(`Failed to fetch HCP list: ${error?.message}`);
  }

  const results: ComputedRecommendationResult[] = [];
  for (const hcp of hcps) {
    try {
      const res = await computeRecommendation(hcp.id);
      results.push(res);
    } catch (err) {
      console.error(`Error computing recommendation for HCP ${hcp.id}:`, err);
    }
  }

  return {
    success: true,
    totalComputed: results.length,
    results,
  };
}

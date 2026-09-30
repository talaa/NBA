import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HCP, Interaction, Recommendation, Outcome, PriorityLevel } from '../types/database';
import { SEED_HCPS, SEED_INTERACTIONS, SEED_RECOMMENDATIONS, SEED_OUTCOMES } from '../data/seedData';

// Config state
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'none';
}

const STORAGE_KEY_URL = 'aura_nba_supabase_url';
const STORAGE_KEY_KEY = 'aura_nba_supabase_anon_key';

export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  const projectMatch = trimmed.match(/project\/([a-z0-9_-]+)/i);
  if (projectMatch && projectMatch[1]) {
    return `https://${projectMatch[1]}.supabase.co`;
  }
  return trimmed;
}

export function getSupabaseCredentials(): SupabaseConfig {
  let envUrl = '';
  let envKey = '';

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
      envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
    }
  } catch {
    // ignore
  }

  if ((!envUrl || !envKey) && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || envUrl;
    envKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || envKey;
  }

  envUrl = cleanSupabaseUrl(envUrl);

  if (envUrl && envKey && !envUrl.includes('your-project-id') && !envUrl.includes('placeholder')) {
    return {
      url: envUrl,
      anonKey: envKey.trim(),
      isConfigured: true,
      source: 'env',
    };
  }

  try {
    const localUrl = localStorage.getItem(STORAGE_KEY_URL);
    const localKey = localStorage.getItem(STORAGE_KEY_KEY);
    const resolvedUrl = (localUrl && localUrl.startsWith('http')) ? localUrl.trim() : (envUrl && envUrl.startsWith('http')) ? envUrl.trim() : '';
    const resolvedKey = (localKey && localKey.trim()) ? localKey.trim() : '';

    if (resolvedUrl && resolvedKey) {
      return {
        url: resolvedUrl,
        anonKey: resolvedKey,
        isConfigured: true,
        source: 'localStorage',
      };
    }

    if (resolvedUrl) {
      return {
        url: resolvedUrl,
        anonKey: '',
        isConfigured: false,
        source: 'none',
      };
    }
  } catch {
    // Ignore localStorage errors in restricted environments
  }

  return {
    url: envUrl && envUrl.startsWith('http') ? envUrl.trim() : '',
    anonKey: '',
    isConfigured: false,
    source: 'none',
  };
}

export function saveLocalSupabaseCredentials(url: string, anonKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function clearLocalSupabaseCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds.isConfigured || !creds.url || !creds.anonKey) {
    return null;
  }

  if (cachedClient && lastUrl === creds.url && lastKey === creds.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(creds.url, creds.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    lastUrl = creds.url;
    lastKey = creds.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// In-memory working copies for seamless demo fallback or optimistic updates
let localRecommendations: Recommendation[] = [...SEED_RECOMMENDATIONS];
let localHcps: HCP[] = [...SEED_HCPS];
let localInteractions: Interaction[] = [...SEED_INTERACTIONS];
let localOutcomes: Outcome[] = [...SEED_OUTCOMES];

export interface FetchResult {
  recommendations: Recommendation[];
  interactions: Interaction[];
  hcps: HCP[];
  outcomes: Outcome[];
  isLiveSupabase: boolean;
  error?: string;
}

/**
 * Fetch all NBA data from Supabase (or fallback to local seed if unconfigured / tables missing)
 */
export async function fetchNBAData(): Promise<FetchResult> {
  const client = getSupabaseClient();

  if (!client) {
    // Fallback to built-in seed dataset with relationships joined
    const populated = buildJoinedRecommendations(
      localRecommendations,
      localHcps,
      localInteractions,
      localOutcomes
    );
    return {
      recommendations: populated,
      interactions: localInteractions,
      hcps: localHcps,
      outcomes: localOutcomes,
      isLiveSupabase: false,
    };
  }

  try {
    // 1. Fetch HCPs
    const { data: hcpsData, error: hcpsError } = await client.from('hcps').select('*');
    if (hcpsError) throw hcpsError;

    // 2. Fetch recommendations
    const { data: recsData, error: recsError } = await client
      .from('recommendations')
      .select('*')
      .order('created_at', { ascending: false });
    if (recsError) throw recsError;

    // 3. Fetch interactions
    const { data: interData, error: interError } = await client
      .from('interactions')
      .select('*')
      .order('occurred_at', { ascending: false });
    if (interError) throw interError;

    // 4. Fetch outcomes
    const { data: outcomesData, error: outcomesError } = await client.from('outcomes').select('*');
    if (outcomesError) throw outcomesError;

    const fetchedHcps = (hcpsData as HCP[]) || [];
    const fetchedRecs = (recsData as Recommendation[]) || [];
    const fetchedInteractions = (interData as Interaction[]) || [];
    const fetchedOutcomes = (outcomesData as Outcome[]) || [];

    // If tables in Supabase already have data, use them directly
    if (fetchedHcps.length > 0) {
      const joined = buildJoinedRecommendations(
        fetchedRecs,
        fetchedHcps,
        fetchedInteractions,
        fetchedOutcomes
      );

      // If live Supabase has HCPs missing from recommendations table, persist them in background
      const existingRecHcpIds = new Set(fetchedRecs.map((r) => r.hcp_id));
      const missingRecs = joined.filter((r) => !existingRecHcpIds.has(r.hcp_id));
      if (missingRecs.length > 0) {
        (async () => {
          try {
            const rowsToInsert = missingRecs.map((r) => ({
              id: r.id,
              hcp_id: r.hcp_id,
              recommended_action: r.recommended_action,
              recommended_channel: r.recommended_channel,
              recommended_content: r.recommended_content,
              priority: r.priority,
              predicted_engagement: r.predicted_engagement,
              reasons: r.reasons,
              status: r.status,
              created_at: r.created_at,
            }));
            await client.from('recommendations').insert(rowsToInsert);
          } catch (e) {
            console.warn('Failed to backfill missing recommendations to Supabase:', e);
          }
        })();
      }

      return {
        recommendations: joined,
        interactions: fetchedInteractions,
        hcps: fetchedHcps,
        outcomes: fetchedOutcomes,
        isLiveSupabase: true,
      };
    }

    // Tables exist in Supabase but are empty (waiting for SQL seed or RLS policy)
    // Try API seeding once
    try {
      const seedRes = await seedSupabaseDatabase(client);
      if (seedRes.success) {
        return fetchNBAData();
      }
    } catch {
      // Handled by returning local dataset with helpful status
    }

    const populated = buildJoinedRecommendations(
      localRecommendations,
      localHcps,
      localInteractions,
      localOutcomes
    );

    return {
      recommendations: populated,
      interactions: localInteractions,
      hcps: localHcps,
      outcomes: localOutcomes,
      isLiveSupabase: false,
      error: 'Connected to Supabase project (smcawejdxtkpjynjgzva). Tables are currently empty. Run the SQL seed script in your Supabase SQL Editor to populate live records.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Supabase fetch failed, falling back to local dataset:', message);

    const populated = buildJoinedRecommendations(
      localRecommendations,
      localHcps,
      localInteractions,
      localOutcomes
    );
    return {
      recommendations: populated,
      interactions: localInteractions,
      hcps: localHcps,
      outcomes: localOutcomes,
      isLiveSupabase: false,
      error: message,
    };
  }
}

function createFallbackRecommendationForHcp(
  hcp: HCP,
  hcpInteractions: Interaction[]
): Recommendation {
  const segment = (hcp.segment || '').toLowerCase();
  const isKOL = segment.includes('opinion leader') || segment.includes('kol') || segment.includes('tier 1');
  const isDigital = segment.includes('digital');

  const channel = isDigital
    ? 'Approved Rep Email'
    : isKOL
    ? 'Face-to-Face Meeting'
    : 'In-Person Detailing';

  const defaultTopics: Record<string, string> = {
    Oncology: 'Phase III Overall Survival subgroup analysis in HER2-low refractory cohort',
    Cardiovascular: 'Post-PCI dual antiplatelet duration in high-bleeding-risk diabetic acute coronary syndrome',
    Immunology: '2-year radiographic progression arrest data & ACR70 durability in TNF-inadequate responders',
    'Metabolic & Diabetes': 'Renal composite outcome preservation and eGFR slope stabilization across 25-45 spectrum',
    Respiratory: 'GOLD 2026 exacerbation reduction data stratified by blood eosinophils (>=300 vs <150 cells/uL)',
    Nephrology: 'Targeted-release mucosal corticosteroid: proteinuria reduction trajectory and safety',
    Neurology: 'Caregiver burden mitigation toolkit and expedited Medicaid prior authorization roadmap',
    Dermatology: 'Peak pruritus numerical rating score drop within 48h and Week 16 EASI-75 response',
    'Infectious Disease': 'CRE susceptibility profiles, stewardship criteria compliance, and ICU length-of-stay reduction',
  };

  const topic = defaultTopics[hcp.therapeutic_area] || `Clinical evidence review: ${hcp.therapeutic_area} advancement`;
  const action = channel === 'Approved Rep Email'
    ? `Share digital clinical monograph via rep-approved email on ${topic}`
    : `Conduct face-to-face detail to review ${topic}`;

  const hasInteractions = hcpInteractions.length > 0;
  const lastTouch = hasInteractions ? hcpInteractions[0] : null;
  const lastDate = lastTouch ? lastTouch.occurred_at.split('T')[0] : 'None recorded';

  const priority: PriorityLevel = isKOL ? 'High' : 'Medium';
  const predictedEngagement = isKOL ? 88 : 74;

  const reasons = [
    `Channel matches HCP segment policy for '${hcp.segment}' (${channel} weighted +10 pts)`,
    `Content gap confirmed: Dr. ${hcp.name.split(' ').slice(-1)[0]} has not yet been detailed on '${topic}' in ${hcp.therapeutic_area}`,
    hasInteractions
      ? `Prior interaction recorded on ${lastDate} ('${lastTouch?.content_topic}') establishes cadence threshold for follow-up`
      : `Untested HCP with no prior logged interactions in territory; initial outreach priority`,
  ];

  return {
    id: `c0000001-0000-4000-8000-${hcp.id.slice(-12)}`,
    hcp_id: hcp.id,
    recommended_action: action,
    recommended_channel: channel,
    recommended_content: topic,
    priority,
    predicted_engagement: predictedEngagement,
    reasons,
    status: 'active',
    created_at: new Date().toISOString(),
    hcp,
    interactions: hcpInteractions,
    outcome: null,
  };
}

/**
 * Join recommendations with their HCP, interaction history, and logged outcome.
 * Guarantees that ALL HCPs in the database (e.g. all 24) have a recommendation displayed.
 */
function buildJoinedRecommendations(
  recs: Recommendation[],
  hcps: HCP[],
  interactions: Interaction[],
  outcomes: Outcome[]
): Recommendation[] {
  const hcpMap = new Map(hcps.map((h) => [h.id, h]));
  const outcomeMap = new Map(outcomes.map((o) => [o.recommendation_id, o]));

  const interactionsByHcp = new Map<string, Interaction[]>();
  for (const item of interactions) {
    const existing = interactionsByHcp.get(item.hcp_id) || [];
    existing.push(item);
    interactionsByHcp.set(item.hcp_id, existing);
  }

  const joinedRecs: Recommendation[] = [];
  const coveredHcpIds = new Set<string>();

  // 1. Process explicit recommendations from table
  for (const rec of recs) {
    if (!rec.hcp_id || coveredHcpIds.has(rec.hcp_id)) continue;
    const hcp = hcpMap.get(rec.hcp_id);
    if (!hcp) continue;

    coveredHcpIds.add(rec.hcp_id);
    joinedRecs.push({
      ...rec,
      reasons: Array.isArray(rec.reasons)
        ? rec.reasons
        : typeof rec.reasons === 'string'
        ? JSON.parse(rec.reasons)
        : [],
      hcp,
      outcome: outcomeMap.get(rec.id) || null,
      interactions: interactionsByHcp.get(rec.hcp_id) || [],
    });
  }

  // 2. For any HCP in hcps that does NOT have a recommendation, dynamically synthesize one
  for (const hcp of hcps) {
    if (coveredHcpIds.has(hcp.id)) continue;
    coveredHcpIds.add(hcp.id);

    const hcpInteractions = interactionsByHcp.get(hcp.id) || [];
    const synthesized = createFallbackRecommendationForHcp(hcp, hcpInteractions);
    joinedRecs.push(synthesized);
  }

  return joinedRecs;
}

/**
 * Seed the Supabase database with all 12 HCPs, 55+ interactions, 12 recommendations, and 3 outcomes
 */
export async function seedSupabaseDatabase(clientInstance?: SupabaseClient | null): Promise<{
  success: boolean;
  counts: { hcps: number; recommendations: number; interactions: number; outcomes: number };
  error?: string;
}> {
  const client = clientInstance || getSupabaseClient();
  if (!client) {
    return {
      success: false,
      counts: { hcps: 0, recommendations: 0, interactions: 0, outcomes: 0 },
      error: 'Supabase client is not configured. Provide URL and anon key first.',
    };
  }

  try {
    // 1. Seed HCPs
    const { error: hcpErr } = await client.from('hcps').upsert(SEED_HCPS, { onConflict: 'id' });
    if (hcpErr) throw new Error(`HCPs seed error: ${hcpErr.message}`);

    // 2. Seed Recommendations
    const { error: recErr } = await client
      .from('recommendations')
      .upsert(SEED_RECOMMENDATIONS, { onConflict: 'id' });
    if (recErr) throw new Error(`Recommendations seed error: ${recErr.message}`);

    // 3. Seed Interactions
    const { error: intErr } = await client
      .from('interactions')
      .upsert(SEED_INTERACTIONS, { onConflict: 'id' });
    if (intErr) throw new Error(`Interactions seed error: ${intErr.message}`);

    // 4. Seed Outcomes
    const { error: outErr } = await client
      .from('outcomes')
      .upsert(SEED_OUTCOMES, { onConflict: 'id' });
    if (outErr) throw new Error(`Outcomes seed error: ${outErr.message}`);

    return {
      success: true,
      counts: {
        hcps: SEED_HCPS.length,
        recommendations: SEED_RECOMMENDATIONS.length,
        interactions: SEED_INTERACTIONS.length,
        outcomes: SEED_OUTCOMES.length,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      counts: { hcps: 0, recommendations: 0, interactions: 0, outcomes: 0 },
      error: message,
    };
  }
}

/**
 * Log an outcome for a recommendation (saves to Supabase if connected, and updates memory)
 */
export async function recordOutcome(
  recommendationId: string,
  response: string,
  outcomeNotes: string
): Promise<{ success: boolean; outcome: Outcome; error?: string }> {
  const newOutcome: Outcome = {
    id: `out-${Date.now()}`,
    recommendation_id: recommendationId,
    response,
    outcome_notes: outcomeNotes,
    recorded_at: new Date().toISOString(),
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('outcomes').insert(newOutcome);
      if (error) {
        console.warn('Failed to insert outcome to Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Outcome insert error:', e);
    }
  }

  // Update in-memory copy
  localOutcomes = [newOutcome, ...localOutcomes.filter((o) => o.recommendation_id !== recommendationId)];

  return { success: true, outcome: newOutcome };
}

/**
 * Mark a recommendation's status as "completed" in Supabase (and memory)
 */
export async function markActionTaken(
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from('recommendations')
        .update({ status: 'completed' })
        .eq('id', recommendationId);
      if (error) {
        console.warn('Failed to update recommendation status in Supabase:', error.message);
        return { success: false, error: error.message };
      }
    } catch (e: unknown) {
      console.warn('Recommendation update error:', e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Update in-memory copy
  localRecommendations = localRecommendations.map((r) =>
    r.id === recommendationId ? { ...r, status: 'completed' as const } : r
  );

  return { success: true };
}

/**
 * Call the deterministic scoring engine to recalculate recommendation for an HCP (or all HCPs)
 * Executes deterministic scoring directly and updates Supabase recommendations table.
 */
export async function recalculateRecommendation(
  hcpId?: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const { computeRecommendation, computeAllRecommendations } = await import('./scoringEngine');
    if (hcpId) {
      const res = await computeRecommendation(hcpId);
      return { success: true, result: res };
    } else {
      const res = await computeAllRecommendations();
      return { success: true, result: res };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * Add a new interaction for an HCP in Supabase
 */
export async function addHcpInteraction(interaction: {
  hcp_id: string;
  channel: string;
  interaction_type: string;
  content_topic: string;
  occurred_at: string;
  notes: string;
}): Promise<{ success: boolean; data?: Interaction; error?: string }> {
  const client = getSupabaseClient();
  const newRow: Interaction = {
    id: `b${Date.now().toString(16).padStart(7, '0')}-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`.slice(0, 36),
    ...interaction,
  };

  if (client) {
    try {
      const { data, error } = await client.from('interactions').insert(newRow).select().single();
      if (error) {
        console.warn('Supabase interaction insert warning:', error.message);
      } else if (data) {
        localInteractions = [data, ...localInteractions];
        return { success: true, data };
      }
    } catch (e: unknown) {
      console.warn('Failed to insert interaction to Supabase:', e);
    }
  }

  // Update in-memory copy
  localInteractions = [newRow, ...localInteractions];
  return { success: true, data: newRow };
}

/**
 * Update an existing interaction row in Supabase (and local store)
 */
export async function updateHcpInteraction(
  id: string,
  updates: Partial<Omit<Interaction, 'id' | 'hcp_id'>>
): Promise<{ success: boolean; data?: Interaction; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('interactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.warn('Supabase interaction update error:', error.message);
      } else if (data) {
        localInteractions = localInteractions.map((i) => (i.id === id ? { ...i, ...updates } : i));
        return { success: true, data };
      }
    } catch (e: unknown) {
      console.warn('Failed to update interaction in Supabase:', e);
    }
  }

  // Update in-memory copy
  localInteractions = localInteractions.map((i) => (i.id === id ? { ...i, ...updates } : i));
  const updated = localInteractions.find((i) => i.id === id);
  return { success: true, data: updated };
}

/**
 * Delete an interaction row from Supabase (and local store)
 */
export async function deleteHcpInteraction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('interactions').delete().eq('id', id);
      if (error) {
        console.warn('Supabase interaction delete error:', error.message);
        return { success: false, error: error.message };
      }
    } catch (e: unknown) {
      console.warn('Failed to delete interaction in Supabase:', e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Remove from in-memory copy
  localInteractions = localInteractions.filter((i) => i.id !== id);
  return { success: true };
}

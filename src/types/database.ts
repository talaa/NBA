export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type RecommendationStatus = 'active' | 'completed' | 'dismissed';

export interface HCP {
  id: string;
  name: string;
  specialty: string;
  institution: string;
  location: string;
  segment: string;
  therapeutic_area: string;
}

export interface Interaction {
  id: string;
  hcp_id: string;
  channel: string;
  interaction_type: string;
  content_topic: string;
  occurred_at: string;
  notes: string;
}

export interface Recommendation {
  id: string;
  hcp_id: string;
  recommended_action: string;
  recommended_channel: string;
  recommended_content: string;
  priority: PriorityLevel;
  predicted_engagement: number; // e.g. 94
  reasons: string[];
  status: RecommendationStatus;
  created_at: string;
  // Joined relation for UI:
  hcp?: HCP;
  outcome?: Outcome | null;
  interactions?: Interaction[];
}

export interface Outcome {
  id: string;
  recommendation_id: string;
  response: string;
  outcome_notes: string;
  recorded_at: string;
}

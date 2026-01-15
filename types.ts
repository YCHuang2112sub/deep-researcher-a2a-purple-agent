
export interface AgentLog {
  role: 'Investigator' | 'Critic' | 'Presenter';
  message: string;
  timestamp: number;
}

export interface ResearchStep {
  id: string;
  title: string;
  status: 'pending' | 'searching' | 'critiquing' | 'refining' | 'completed' | 'error';
  findings?: string;
  sources?: Source[];
  feedback?: string;
  iteration?: number;
  logs: AgentLog[];
  presentationScript?: string;
  imageUrl?: string;
  researchPlan?: string;
  findingsHistory: string[];
  preferredLayout?: 'split-left' | 'split-right' | 'bottom-overlay' | 'centered';
  slideDesign?: {
    title: string;
    points: string[];
    visualPrompt: string;
    layout: string;
  };
  qualityAudit?: {
    authenticityScore: number;
    hallucinationRisk: 'low' | 'medium' | 'high';
    critique: string;
  };
}

export interface Source {
  title: string;
  uri: string;
}

export interface ResearchReport {
  summary: string;
  detailedAnalysis: string;
  keyFindings: string[];
  dataPoints: { label: string; value: number }[];
  sources: Source[];
}

export enum ResearchPhase {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  INVESTIGATING = 'INVESTIGATING',
  SYNTHESIZING = 'SYNTHESIZING',
  COMPLETED = 'COMPLETED'
}

export interface CritiqueResult {
  sufficient: boolean;
  feedback: string;
  refinedQuery?: string;
}


export interface Slide {
  id: string;
  title: string;
  bodyText: string;
  visualPrompt: string;
  layout: 'split-left' | 'split-right' | 'centered' | 'bottom-overlay';
  speakerNotes: string;
  imageUrl?: string;
}

export interface SlideDeck {
  topic: string;
  slides: Slide[];
  originalResearch: string;
}

export enum GenerationStep {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_SLIDES = 'GENERATING_SLIDES',
  PAINTING = 'PAINTING',
  COMPLETED = 'COMPLETED'
}

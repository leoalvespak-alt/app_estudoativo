export type SourceType = 'topic' | 'text' | 'git_kb';

export type QuestionFormat = 'open' | 'multiple_choice';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface KbMaterialItem {
  materialKey: string;
  sourceKey: string;
  sourceLabel: string;
  materialType: string;
  discipline: string;
  title: string;
  relativePath: string;
  rawPath: string;
  sizeBytes: number;
}

export interface KbSourceRef {
  title: string;
  discipline: string;
  sourceLabel: string;
  relativePath: string;
  origin: 'git' | 'web';
  url: string;
}

export interface QuestionOption {
  label: OptionLetter;
  text: string;
}

export interface UserProfile {
  usernameKey: string;
  displayName: string;
  createdAt?: string;
  lastActiveAt?: string;
}

export type SessionStatus =
  | 'choice_gate'
  | 'prep_class'
  | 'in_progress'
  | 'overtime'
  | 'completed';

export type Verdict = 'correct' | 'partial' | 'incorrect';

export interface SyllabusRoundPlan {
  roundNumber: number;
  title: string;
  topics: string[];
  difficultyTier: string;
  covered: boolean;
}

export interface PrepConcept {
  term: string;
  definition: string;
  keyRule: string;
}

export interface PrepClassContent {
  summary: string;
  concepts: PrepConcept[];
  studyTips: string;
  generatedAt: string;
}

export interface TrainerQuestion {
  id: string;
  format: QuestionFormat;
  prompt: string;
  questionType: string;
  subtopic: string;
  isRetest: boolean;
  targetConcept: string;
  options: QuestionOption[];
  userSelectedOption: OptionLetter | '';
  userAnswer: string;
}

export interface QuestionEvaluation {
  questionId: string;
  verdict: Verdict;
  feedback: string;
  expectedAnswer: string;
  correctOption: OptionLetter | '';
  conceptDefinition: string;
  weakPointTriggered: boolean;
}

export interface RoundRecord {
  roundNumber: number;
  isOvertime: boolean;
  difficultyLabel: string;
  questions: TrainerQuestion[];
  evaluations: QuestionEvaluation[];
  roundSummary?: string;
  submittedAt?: string;
}

export interface WeakPoint {
  id: string;
  concept: string;
  definition: string;
  missedInRound: number;
  lastTestedRound: number;
  retestCount: number;
  resolved: boolean;
}

export interface StrategicDefinition {
  term: string;
  definition: string;
}

export interface StrategicSynthesis {
  id: string;
  afterRound: number;
  title: string;
  focusSummary: string;
  keyDefinitions: StrategicDefinition[];
  adjacentInsights: string[];
  generatedAt: string;
}

export interface FinalSynthesis {
  asciiTree: string;
  closingFeedback: string;
  topicsCoveredCount: number;
  masteredWeakPointsCount: number;
  generatedAt: string;
}

export interface TrainingSession {
  id: string;
  ownerUsername: string;
  title: string;
  sourceType: SourceType;
  sourceContent: string;
  selectedKbPaths: string[];
  kbSources: KbSourceRef[];
  status: SessionStatus;
  wantsPrepClass: boolean;
  currentRound: number;
  syllabus: SyllabusRoundPlan[];
  prepClass: PrepClassContent | null;
  rounds: RoundRecord[];
  activeWeakPoints: WeakPoint[];
  strategicSyntheses: StrategicSynthesis[];
  finalSynthesis: FinalSynthesis | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryEntry {
  id: string;
  sessionId: string;
  sessionTitle: string;
  kind: 'final_tree' | 'strategic_synthesis' | 'prep_class';
  title: string;
  subtitle: string;
  createdAt: string;
  asciiTree?: string;
  closingFeedback?: string;
  strategicSynthesis?: StrategicSynthesis;
  prepClass?: PrepClassContent;
  weakPointsCount?: number;
}

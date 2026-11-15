export type SourceType = 'topic' | 'text' | 'git_kb' | 'weak_points';

export type QuestionFormat =
  | 'open'
  | 'multiple_choice'
  | 'true_false'
  | 'practical_case';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type ConfidenceLevel = 'certain' | 'unsure' | 'guess';

export type ErrorCause =
  | 'lack_of_theory'
  | 'rushed_reading'
  | 'concept_confusion'
  | 'detail_slip';

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
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
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
  retestRule?: string;
  retestSourceQuestionId?: string;
  targetConcept: string;
  options: QuestionOption[];
  userSelectedOption: OptionLetter | '';
  userAnswer: string;
  userRationale?: string;
  confidence?: ConfidenceLevel | '';
}

export interface QuestionEvaluation {
  questionId: string;
  verdict: Verdict;
  feedback: string;
  rationaleFeedback?: string;
  expectedAnswer: string;
  correctOption: OptionLetter | '';
  conceptDefinition: string;
  weakPointTriggered: boolean;
  confidenceAtSubmit?: ConfidenceLevel | '';
  isLuckyGuess?: boolean;
  isConfidentError?: boolean;
  errorCause?: ErrorCause | '';
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

export type WeakPointTrigger =
  | 'incorrect'
  | 'partial'
  | 'lucky_guess'
  | 'unsure_hit';

export interface WeakPointBankEntry {
  id: string;
  ownerUsername: string;
  discipline: string;
  concept: string;
  definition: string;
  subtopic: string;
  sourceSessionId: string;
  sourceSessionTitle: string;
  status: 'active' | 'mastered';
  lastTrigger: WeakPointTrigger;
  errorCount: number;
  guessCount: number;
  retestSuccessCount: number;
  lastErrorCause?: ErrorCause;
  errorCauseCounts?: Partial<Record<ErrorCause, number>>;
  createdAt: string;
  updatedAt: string;
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

export interface SurgicalFocusInfo {
  label: string;
  targetedConcepts: string[];
  discipline?: string;
}

export interface TrainingSession {
  id: string;
  ownerUsername: string;
  title: string;
  discipline?: string;
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
  surgicalFocus?: SurgicalFocusInfo | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComparativeTableRow {
  criterion: string;
  conceptAValue: string;
  conceptBValue: string;
  examDecisiveDiff: string;
}

export interface ComparativeTableEntry {
  id: string;
  ownerUsername: string;
  discipline: string;
  title: string;
  conceptA: string;
  conceptB: string;
  triggerReason: 'auto_confusion' | 'on_demand';
  rows: ComparativeTableRow[];
  summaryTip?: string;
  sourceSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TheorySummaryContent {
  concept: string;
  coreRule: string;
  practicalExample: string;
  commonTrap: string;
  memoryAnchor: string;
}

export interface LibraryEntry {
  id: string;
  sessionId: string;
  sessionTitle: string;
  kind:
    | 'hierarchical_tree'
    | 'comparative_table'
    | 'strategic_synthesis'
    | 'prep_class';
  title: string;
  subtitle: string;
  createdAt: string;
  asciiTree?: string;
  closingFeedback?: string;
  strategicSynthesis?: StrategicSynthesis;
  prepClass?: PrepClassContent;
  comparativeTable?: ComparativeTableEntry;
  weakPointsCount?: number;
}

import type {
  KbMaterialItem,
  KbSourceRef,
  PrepClassContent,
  QuestionEvaluation,
  RoundRecord,
  SourceType,
  StrategicSynthesis,
  SyllabusRoundPlan,
  TrainerQuestion,
  WeakPoint,
} from '../types/trainer';

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & TResponse;
  if (!response.ok) {
    throw new Error(data.error || `Erro na requisição (${response.status}).`);
  }
  return data;
}

export interface KbCatalogResponse {
  totalCount: number;
  disciplines: Array<{ name: string; count: number }>;
  items: KbMaterialItem[];
}

export async function fetchKbCatalog(params?: {
  q?: string;
  discipline?: string;
}): Promise<KbCatalogResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.discipline) search.set('discipline', params.discipline);
  const qs = search.toString();
  const response = await fetch(`/api/kb/catalog${qs ? `?${qs}` : ''}`);
  const data = (await response.json().catch(() => ({}))) as { error?: string } & KbCatalogResponse;
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao carregar catálogo do GitHub.');
  }
  return data;
}

export async function fetchKbDocumentPreview(rawPath: string): Promise<{
  rawPath: string;
  excerpt: string;
  totalLength: number;
}> {
  const response = await fetch(`/api/kb/document?path=${encodeURIComponent(rawPath)}`);
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    rawPath: string;
    excerpt: string;
    totalLength: number;
  };
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao carregar prévia do documento.');
  }
  return data;
}

export interface InitTrainerResult {
  title: string;
  syllabus: SyllabusRoundPlan[];
  prepClass: PrepClassContent | null;
  kbSources: KbSourceRef[];
}

export function initTrainerSession(params: {
  sourceType: SourceType;
  sourceContent: string;
  selectedKbPaths?: string[];
  wantsPrepClass: boolean;
}): Promise<InitTrainerResult> {
  return postJson<InitTrainerResult>('/api/trainer/init', params);
}

export interface GenerateRoundResult {
  difficultyLabel: string;
  questions: TrainerQuestion[];
  strategicSynthesis: StrategicSynthesis | null;
  kbSources: KbSourceRef[];
}

export function generateRound(params: {
  title: string;
  sourceType: SourceType;
  sourceContent: string;
  selectedKbPaths?: string[];
  currentRound: number;
  isOvertime: boolean;
  syllabus: SyllabusRoundPlan[];
  activeWeakPoints: WeakPoint[];
  recentRounds: RoundRecord[];
}): Promise<GenerateRoundResult> {
  return postJson<GenerateRoundResult>('/api/trainer/round', params);
}

export interface EvaluateRoundResult {
  evaluations: QuestionEvaluation[];
  roundSummary: string;
}

export function evaluateRound(params: {
  title: string;
  sourceContent: string;
  selectedKbPaths?: string[];
  roundNumber: number;
  isOvertime: boolean;
  questions: TrainerQuestion[];
}): Promise<EvaluateRoundResult> {
  return postJson<EvaluateRoundResult>('/api/trainer/evaluate', params);
}

export interface FinalizeTrainerResult {
  asciiTree: string;
  closingFeedback: string;
}

export function finalizeTrainerSession(params: {
  title: string;
  sourceContent: string;
  selectedKbPaths?: string[];
  syllabus: SyllabusRoundPlan[];
  rounds: RoundRecord[];
  activeWeakPoints: WeakPoint[];
}): Promise<FinalizeTrainerResult> {
  return postJson<FinalizeTrainerResult>('/api/trainer/finalize', params);
}

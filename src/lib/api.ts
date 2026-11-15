import type {
  ComparativeTableRow,
  KbMaterialItem,
  KbSourceRef,
  PrepClassContent,
  QuestionEvaluation,
  RoundRecord,
  SourceType,
  StrategicSynthesis,
  SyllabusRoundPlan,
  TheorySummaryContent,
  TrainerQuestion,
  WeakPoint,
} from '../types/trainer';

const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const DOC_PREVIEW_CACHE_TTL_MS = 20 * 60 * 1000;

export interface KbCatalogResponse {
  totalCount: number;
  disciplines: Array<{ name: string; count: number }>;
  items: KbMaterialItem[];
}

export interface KbDocumentPreviewResponse {
  rawPath: string;
  excerpt: string;
  totalLength: number;
}

const catalogResponseCache = new Map<
  string,
  { data: KbCatalogResponse; fetchedAt: number }
>();
const inflightCatalogRequests = new Map<string, Promise<KbCatalogResponse>>();

const previewResponseCache = new Map<
  string,
  { data: KbDocumentPreviewResponse; fetchedAt: number }
>();
const inflightPreviewRequests = new Map<string, Promise<KbDocumentPreviewResponse>>();

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

export async function fetchKbCatalog(params?: {
  q?: string;
  discipline?: string;
}): Promise<KbCatalogResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.discipline) search.set('discipline', params.discipline);
  const qs = search.toString();
  const cacheKey = qs || '__all__';

  const cached = catalogResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return cached.data;
  }

  const inflight = inflightCatalogRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(`/api/kb/catalog${qs ? `?${qs}` : ''}`);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      } & KbCatalogResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível carregar o catálogo da base de estudos.');
      }
      catalogResponseCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    } finally {
      inflightCatalogRequests.delete(cacheKey);
    }
  })();

  inflightCatalogRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function fetchKbDocumentPreview(
  rawPath: string
): Promise<KbDocumentPreviewResponse> {
  const cached = previewResponseCache.get(rawPath);
  if (cached && Date.now() - cached.fetchedAt < DOC_PREVIEW_CACHE_TTL_MS) {
    return cached.data;
  }

  const inflight = inflightPreviewRequests.get(rawPath);
  if (inflight) {
    return inflight;
  }

  const requestPromise = (async () => {
    try {
      const response = await fetch(`/api/kb/document?path=${encodeURIComponent(rawPath)}`);
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      } & KbDocumentPreviewResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar prévia do documento.');
      }
      previewResponseCache.set(rawPath, { data, fetchedAt: Date.now() });
      return data;
    } finally {
      inflightPreviewRequests.delete(rawPath);
    }
  })();

  inflightPreviewRequests.set(rawPath, requestPromise);
  return requestPromise;
}

export interface InitTrainerResult {
  title: string;
  discipline: string;
  syllabus: SyllabusRoundPlan[];
  prepClass: PrepClassContent | null;
  kbSources: KbSourceRef[];
}

export function initTrainerSession(params: {
  sourceType: SourceType;
  sourceContent: string;
  selectedKbPaths?: string[];
  wantsPrepClass: boolean;
  disciplineHint?: string;
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

export interface GenerateComparativeTableResult {
  title: string;
  conceptA: string;
  conceptB: string;
  summaryTip: string;
  rows: ComparativeTableRow[];
}

export function generateComparativeTable(params: {
  discipline: string;
  conceptA: string;
  conceptB?: string;
  contextNotes?: string;
}): Promise<GenerateComparativeTableResult> {
  return postJson<GenerateComparativeTableResult>('/api/trainer/comparative-table', params);
}

export function fetchTheorySummary(params: {
  discipline?: string;
  concept: string;
  subtopic?: string;
  expectedAnswer?: string;
}): Promise<TheorySummaryContent> {
  return postJson<TheorySummaryContent>('/api/trainer/theory-summary', params);
}

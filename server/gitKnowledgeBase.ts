import type { KbMaterialItem, KbSourceRef } from '../src/types/trainer.ts';

const REPO_OWNER = 'leoalvespak-alt';
const REPO_NAME = 'rota-base-conhecimento-estudos';
const REPO_BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;
const BLOB_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}`;

const MANIFEST_TTL_MS = 15 * 60 * 1000;
const DOC_TTL_MS = 30 * 60 * 1000;

interface ManifestRawItem {
  material_key: string;
  source_key: string;
  source_label: string;
  material_type: string;
  discipline: string;
  title: string;
  relative_path: string;
  size_bytes: number;
}

const STATIC_LEIS_SECAS: KbMaterialItem[] = [
  {
    materialKey: 'lei-seca-ec-132',
    sourceKey: 'planalto',
    sourceLabel: 'Legislação Seca (Planalto)',
    materialType: 'law',
    discipline: 'Reforma Tributária / Legislação Seca',
    title: 'Emenda Constitucional nº 132 (Reforma Tributária)',
    relativePath: 'leis_secas_htmls/Emenda Constitucional nº 132.html',
    rawPath: 'leis_secas_htmls/Emenda Constitucional nº 132.html',
    sizeBytes: 180000,
  },
  {
    materialKey: 'lei-seca-lcp-214',
    sourceKey: 'planalto',
    sourceLabel: 'Legislação Seca (Planalto)',
    materialType: 'law',
    discipline: 'Reforma Tributária / Legislação Seca',
    title: 'Lei Complementar nº 214 (IBS, CBS e Imposto Seletivo)',
    relativePath: 'leis_secas_htmls/Lcp 214.html',
    rawPath: 'leis_secas_htmls/Lcp 214.html',
    sizeBytes: 900000,
  },
  {
    materialKey: 'lei-seca-lcp-227',
    sourceKey: 'planalto',
    sourceLabel: 'Legislação Seca (Planalto)',
    materialType: 'law',
    discipline: 'Reforma Tributária / Legislação Seca',
    title: 'Lei Complementar nº 227',
    relativePath: 'leis_secas_htmls/Lcp 227.html',
    rawPath: 'leis_secas_htmls/Lcp 227.html',
    sizeBytes: 350000,
  },
];

let cachedCatalog: { items: KbMaterialItem[]; fetchedAt: number } | null = null;
const docCache = new Map<string, { text: string; fetchedAt: number }>();

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na',
  'nos', 'nas', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'que', 'e', 'ou',
  'ao', 'aos', 'à', 'às', 'se', 'como', 'mais', 'menos', 'nao', 'não', 'tema', 'base',
]);

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function encodeGitPath(rawPath: string): string {
  return rawPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function getKbCatalog(forceRefresh = false): Promise<KbMaterialItem[]> {
  if (
    !forceRefresh &&
    cachedCatalog &&
    Date.now() - cachedCatalog.fetchedAt < MANIFEST_TTL_MS
  ) {
    return cachedCatalog.items;
  }

  const res = await fetch(`${RAW_BASE}/_md_normalizado/materials-manifest.json`, {
    headers: { 'User-Agent': 'aistudio-build' },
  });

  if (!res.ok) {
    throw new Error(`Falha ao carregar o manifesto do GitHub (${res.status}).`);
  }

  const json = (await res.json()) as { materials?: ManifestRawItem[] };
  const mdItems: KbMaterialItem[] = (json.materials || []).map((m) => ({
    materialKey: m.material_key,
    sourceKey: m.source_key,
    sourceLabel: m.source_label,
    materialType: m.material_type,
    discipline: m.discipline,
    title: m.title,
    relativePath: m.relative_path,
    rawPath: `_md_normalizado/${m.relative_path}`,
    sizeBytes: m.size_bytes,
  }));

  const items = [...mdItems, ...STATIC_LEIS_SECAS];
  cachedCatalog = { items, fetchedAt: Date.now() };
  return items;
}

export async function fetchKbDocumentText(rawPath: string): Promise<string> {
  const cached = docCache.get(rawPath);
  if (cached && Date.now() - cached.fetchedAt < DOC_TTL_MS) {
    return cached.text;
  }

  const encoded = encodeGitPath(rawPath);
  const res = await fetch(`${RAW_BASE}/${encoded}`, {
    headers: { 'User-Agent': 'aistudio-build' },
  });
  if (!res.ok) {
    throw new Error(`Não foi possível baixar o arquivo "${rawPath}" do GitHub (${res.status}).`);
  }

  const buffer = await res.arrayBuffer();
  let rawText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (
    rawText.includes('\uFFFD') ||
    /charset\s*=\s*["']?(windows-1252|iso-8859-1)/i.test(rawText.slice(0, 2000))
  ) {
    rawText = new TextDecoder('windows-1252').decode(buffer);
  }
  const cleanText = rawPath.toLowerCase().endsWith('.html')
    ? stripHtmlToText(rawText)
    : rawText.trim();

  docCache.set(rawPath, { text: cleanText, fetchedAt: Date.now() });
  return cleanText;
}

function extractRelevantExcerpt(
  docText: string,
  queryTokens: string[],
  maxChars: number
): string {
  if (docText.length <= maxChars) {
    return docText;
  }

  // Split by markdown headings or double newlines into paragraphs/sections
  const blocks = docText.split(/\n(?=#{1,3}\s)|\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length <= 1 || queryTokens.length === 0) {
    return docText.slice(0, maxChars);
  }

  const scored = blocks.map((block, index) => {
    const norm = normalizeText(block);
    let score = index < 2 ? 2 : 0; // slight preference for opening definitions
    for (const tok of queryTokens) {
      if (norm.includes(tok)) {
        score += 3;
      }
    }
    return { index, block, score };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const chosen: Array<{ index: number; block: string }> = [];
  let totalChars = 0;
  for (const item of scored) {
    if (totalChars + item.block.length + 2 > maxChars && chosen.length > 0) {
      continue;
    }
    chosen.push({ index: item.index, block: item.block });
    totalChars += item.block.length + 2;
    if (totalChars >= maxChars) break;
  }

  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((c) => c.block).join('\n\n').slice(0, maxChars);
}

export interface RetrievedKbContext {
  contextBlock: string;
  sources: KbSourceRef[];
  coverage: 'strong' | 'partial' | 'none';
}

export async function retrieveGitKnowledge(params: {
  queryText: string;
  selectedRawPaths?: string[];
  maxTotalChars?: number;
}): Promise<RetrievedKbContext> {
  const maxTotalChars = params.maxTotalChars ?? 16000;
  let catalog: KbMaterialItem[] = [];
  try {
    catalog = await getKbCatalog();
  } catch (err) {
    console.warn('Git KB catalog unavailable:', err);
    return { contextBlock: '', sources: [], coverage: 'none' };
  }

  const queryTokens = tokenize(params.queryText);
  const normQuery = normalizeText(params.queryText);

  let selectedItems: KbMaterialItem[] = [];

  if (params.selectedRawPaths && params.selectedRawPaths.length > 0) {
    const pathSet = new Set(params.selectedRawPaths);
    selectedItems = catalog.filter(
      (item) => pathSet.has(item.rawPath) || pathSet.has(item.relativePath)
    );
  }

  // If no explicit paths selected, automatically search the Git repository by relevance
  if (selectedItems.length === 0 && queryTokens.length > 0) {
    const scoredCatalog = catalog
      .map((item) => {
        const normDiscipline = normalizeText(item.discipline);
        const normTitle = normalizeText(item.title);
        const normPath = normalizeText(item.relativePath);

        let score = 0;
        if (normQuery.includes(normDiscipline) && normDiscipline.length > 3) {
          score += 12;
        }
        if (normQuery.includes(normTitle) && normTitle.length > 3) {
          score += 15;
        }
        for (const tok of queryTokens) {
          if (normTitle.includes(tok)) score += 6;
          if (normDiscipline.includes(tok)) score += 5;
          if (normPath.includes(tok)) score += 3;
        }
        return { item, score };
      })
      .filter((entry) => entry.score >= 5)
      .sort((a, b) => b.score - a.score);

    selectedItems = scoredCatalog.slice(0, 4).map((s) => s.item);
  }

  if (selectedItems.length === 0) {
    return { contextBlock: '', sources: [], coverage: 'none' };
  }

  const perDocBudget = Math.floor(maxTotalChars / selectedItems.length);
  const fetchedDocs = await Promise.all(
    selectedItems.map(async (item) => {
      try {
        const fullText = await fetchKbDocumentText(item.rawPath);
        const excerpt = extractRelevantExcerpt(fullText, queryTokens, perDocBudget);
        return { item, excerpt };
      } catch {
        return null;
      }
    })
  );

  const validDocs = fetchedDocs.filter(
    (d): d is { item: KbMaterialItem; excerpt: string } => Boolean(d && d.excerpt.trim())
  );

  if (validDocs.length === 0) {
    return { contextBlock: '', sources: [], coverage: 'none' };
  }

  const contextBlock = validDocs
    .map(
      ({ item, excerpt }) =>
        `[DOCUMENTO GIT: ${item.title} | Disciplina: ${item.discipline} | Coleção: ${item.sourceLabel} | Arquivo: ${item.rawPath}]\n${excerpt}`
    )
    .join('\n\n---\n\n');

  const sources: KbSourceRef[] = validDocs.map(({ item }) => ({
    title: item.title,
    discipline: item.discipline,
    sourceLabel: item.sourceLabel,
    relativePath: item.rawPath,
    origin: 'git',
    url: `${BLOB_BASE}/${encodeGitPath(item.rawPath)}`,
  }));

  const coverage: 'strong' | 'partial' =
    params.selectedRawPaths && params.selectedRawPaths.length > 0
      ? 'strong'
      : validDocs.length >= 2 || contextBlock.length >= 3000
        ? 'strong'
        : 'partial';

  return { contextBlock, sources, coverage };
}

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  fetchKbDocumentText,
  getKbCatalog,
  normalizeText,
  retrieveGitKnowledge,
} from './server/gitKnowledgeBase.ts';
import type {
  ComparativeTableRow,
  KbSourceRef,
  PrepClassContent,
  QuestionEvaluation,
  QuestionFormat,
  RoundRecord,
  SourceType,
  StrategicSynthesis,
  SyllabusRoundPlan,
  TheorySummaryContent,
  TrainerQuestion,
  WeakPoint,
} from './src/types/trainer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chave GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayMs = 600 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function formatErrorMessage(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('GEMINI_API_KEY')) {
    return {
      status: 400,
      message: 'Não foi possível validar a chave da API Gemini. Verifique Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Limite de requisições da API Gemini atingido temporariamente. Aguarde alguns segundos e tente novamente.',
    };
  }
  return {
    status: 500,
    message: raw || 'Erro inesperado ao comunicar com o treinador Gemini.',
  };
}

async function fetchWebFallbackNotes(
  ai: GoogleGenAI,
  topicQuery: string,
  gitCoverage: 'strong' | 'partial' | 'none'
): Promise<{ notes: string; webSources: KbSourceRef[] }> {
  if (gitCoverage === 'strong') {
    return { notes: '', webSources: [] };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Pesquise brevemente pontos-chave atualizados para concursos sobre: "${topicQuery.slice(0, 400)}". Retorne apenas fatos objetivos, regras atuais e exceções relevantes em até 12 linhas.`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as
      | Array<{ web?: { uri?: string; title?: string } }>
      | undefined;

    const webSources: KbSourceRef[] = [];
    if (Array.isArray(chunks)) {
      const seen = new Set<string>();
      for (const ch of chunks) {
        const uri = ch.web?.uri;
        const title = ch.web?.title;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          webSources.push({
            title: title || uri,
            discipline: 'Pesquisa Web (Complemento)',
            sourceLabel: 'Google Search',
            relativePath: uri,
            origin: 'web',
            url: uri,
          });
        }
        if (webSources.length >= 3) break;
      }
    }

    return {
      notes: (response.text ?? '').trim(),
      webSources,
    };
  } catch (err) {
    console.warn('Web fallback grounding skipped:', err);
    return { notes: '', webSources: [] };
  }
}

const SYSTEM_INSTRUCTION = `Você é o "Treinador Ativo", um tutor especialista em revisão ativa e consolidação de conhecimento para concursos públicos em português brasileiro.

HIERARQUIA DE FONTES DE CONHECIMENTO (OBRIGATÓRIA):
- 1ª PRIORIDADE (PRIMÁRIA): Os documentos fornecidos da base de estudos organizada (materiais confiáveis e direcionados para concursos). Sempre baseie os conteúdos, regras, definições, perguntas, gabaritos e sínteses primariamente nesses documentos quando presentes.
- 2ª PRIORIDADE (COMPLEMENTAR): Somente no que faltar ou não estiver detalhado nos materiais primários, complemente com sua própria base jurídica/técnica e com os dados atualizados de pesquisa web fornecidos, sem contradizer o material primário.

REGRAS PEDAGÓGICAS INVIOLÁVEIS:
1. Escopo em 10 Rodadas: Dimensione todo o assunto para cobrir integralmente os subtópicos até a Rodada 10, com progressão real de dificuldade (Rodada 1 mais acessível e fundacional; Rodadas intermediárias com aplicações e comparações; Rodadas finais com exceções, pegadinhas e detalhes técnicos).
2. Alternância Pedagógica de Formatos: Em cada rodada (3 a 4 perguntas), alterne os formatos conforme a progressão do aluno:
   - "multiple_choice": múltipla escolha com 5 alternativas plausíveis (A, B, C, D, E) para discriminação fina e pegadinhas.
   - "true_false": julgamento objetivo de assertiva (Certo ou Errado, com opções fixas A: "Certo" e B: "Errado") focado em regras secas, prazos, competências e exceções.
   - "practical_case": mini-caso prático realista e enxuto de aplicação direta da regra; alterne entre resposta discursiva curta (options: []) e múltipla escolha (5 alternativas A–E).
   - "open": resposta direta aberta curta (options: []) para definições, cálculos ou comparações objetivas.
3. Cadência Pingue-Pongue: Nunca revele as respostas ou a alternativa correta junto com as perguntas.
4. Balanceamento de Conteúdo e Reteste com Novo Cenário: Cada rodada após erro ou chute DEVE retestar a mesma regra/exceção na rodada seguinte junto aos novos tópicos do plano, MAS alterando obrigatoriamente o caso concreto, nomes, números e redação das alternativas para impedir memorização visual.
5. Regra de Definição Objetiva: Sempre que mencionar termos técnicos, institutos ou conceitos que o aluno possa desconhecer (nas correções, na aula preparatória ou nas sínteses), NUNCA faça apenas uma listagem seca; forneça junto uma definição objetiva e clara do conceito.
6. Síntese Estratégica (R3, R6, R9): Ao gerar as rodadas 4, 7 ou 10 (logo após concluir R3, R6 ou R9), produza também uma Síntese Estratégica focada no que foi mais dificultoso nas últimas 3 rodadas, acrescentando informações adjacentes e definições objetivas.
7. Prorrogação (R11+): Em rodadas de prorrogação, gere perguntas curtas e exclusivas para testar e sanar os pontos fracos que permaneceram após a Rodada 10.
8. Síntese Final em Árvore Hierárquica: Deve organizar TODO o conteúdo estudado em texto/Markdown estruturado usando exclusivamente conectores Unicode limpos (├──, └──, │) divididos em 4 blocos claros: Tema Central, Subtópicos e Regras Gerais, Exceções/Prazos/Competências e Pontos de Atenção/Pegadinhas das rodadas erradas ou chutadas.
9. Clareza e Concisão: Evite blocos de texto prolixos e cansativos; seja cirúrgico, didático e direto.`;

const app = express();
app.use(express.json({ limit: '2mb' }));

// 0. GitHub Knowledge Base Catalog & Preview endpoints
app.get('/api/kb/catalog', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const discipline = typeof req.query.discipline === 'string' ? req.query.discipline : '';
    const catalog = await getKbCatalog();

    const disciplineCounts = new Map<string, number>();
    for (const item of catalog) {
      disciplineCounts.set(item.discipline, (disciplineCounts.get(item.discipline) || 0) + 1);
    }

    const disciplines = Array.from(disciplineCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const normQ = normalizeText(q.trim());
    const filtered = catalog.filter((item) => {
      if (discipline && item.discipline !== discipline) return false;
      if (!normQ) return true;
      return (
        normalizeText(item.title).includes(normQ) ||
        normalizeText(item.discipline).includes(normQ) ||
        normalizeText(item.sourceLabel).includes(normQ) ||
        normalizeText(item.relativePath).includes(normQ)
      );
    });

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      totalCount: catalog.length,
      disciplines,
      items: filtered.slice(0, 120),
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.get('/api/kb/document', async (req, res) => {
  try {
    const rawPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rawPath) {
      res.status(400).json({ error: 'Caminho do documento não informado.' });
      return;
    }
    const text = await fetchKbDocumentText(rawPath);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.json({
      rawPath,
      excerpt: text.slice(0, 4000),
      totalLength: text.length,
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 1. Initialize session: generate title, discipline, 10-round syllabus, and optional concise prep class
app.post('/api/trainer/init', async (req, res) => {
  try {
    const { sourceType, sourceContent, selectedKbPaths, wantsPrepClass, disciplineHint } = req.body as {
      sourceType: SourceType;
      sourceContent: string;
      selectedKbPaths?: string[];
      wantsPrepClass: boolean;
      disciplineHint?: string;
    };

    if (!sourceContent?.trim() && (!selectedKbPaths || selectedKbPaths.length === 0)) {
      res.status(400).json({ error: 'Informe um tema, texto base ou selecione materiais da Base de Estudos.' });
      return;
    }

    const ai = getAiClient();
    const kb = await retrieveGitKnowledge({
      queryText: sourceContent || '',
      selectedRawPaths: selectedKbPaths,
      maxTotalChars: 15000,
    });

    const webFallback = await fetchWebFallbackNotes(
      ai,
      sourceContent || kb.sources.map((s) => s.title).join(', '),
      kb.coverage
    );

    const allSources: KbSourceRef[] = [...kb.sources, ...webFallback.webSources];

    const kbDisciplineCandidate =
      disciplineHint?.trim() ||
      kb.sources.find(
        (s) => s.origin === 'git' && s.discipline && s.discipline !== 'Legislação Seca'
      )?.discipline ||
      '';

    const prompt = `Analise o escopo de estudo abaixo e crie o planejamento completo de 10 rodadas progressivas.
Tipo de entrada: ${
      sourceType === 'weak_points'
        ? 'Treino Sob Demanda — Consolidação de Pontos Fracos e Chutes por Disciplina'
        : sourceType === 'git_kb'
          ? 'Base Git Concursos (rota-base-conhecimento-estudos)'
          : sourceType === 'text'
            ? 'Texto base / anotações fornecidas pelo aluno'
            : 'Tema livre'
    }
${kbDisciplineCandidate ? `Disciplina sugerida pela base: ${kbDisciplineCandidate}` : ''}
Pedido/Tema do aluno:
"""
${sourceContent.trim()}
"""

${
  kb.contextBlock
    ? `FONTES PRIMÁRIAS DA BASE GIT (use prioritariamente este material para estruturar as 10 rodadas e a aula):\n${kb.contextBlock}`
    : 'Nenhum documento específico da Base Git foi correspondido diretamente; utilize sua base de conhecimento e o complemento web abaixo.'
}

${
  webFallback.notes
    ? `COMPLEMENTO WEB (use apenas para preencher lacunas não cobertas pela Base Git):\n${webFallback.notes}`
    : ''
}

${
  wantsPrepClass
    ? 'O aluno ESCOLHEU receber a AULA CONCISA PREPARATÓRIA antes da Rodada 1. Gere um resumo completo com o máximo de informações úteis no mínimo de palavras possível, definindo objetivamente os conceitos técnicos centrais e suas regras-chave com base primária nos documentos Git acima.'
    : 'O aluno escolheu ir direto para o treino ativo (sem aula preparatória). Não é necessário preencher o conteúdo da aula preparatória; retorne prepClass com campos vazios.'
}`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Título curto e editorial para o caderno de estudo (máx. 60 caracteres).',
              },
              discipline: {
                type: Type.STRING,
                description:
                  'Nome curto e padronizado da disciplina principal em português (ex.: Direito Tributário, Direito Administrativo, Direito Constitucional, Direito Penal, Contabilidade Geral, Auditoria, Raciocínio Lógico, Língua Portuguesa).',
              },
              syllabus: {
                type: Type.ARRAY,
                description: 'Exatamente 10 itens representando o planejamento das Rodadas 1 a 10.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    roundNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    topics: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    difficultyTier: {
                      type: Type.STRING,
                      description: 'Ex.: Base Conceitual, Aplicação Direta, Exceções e Detalhes, Alta Complexidade.',
                    },
                  },
                  required: ['roundNumber', 'title', 'topics', 'difficultyTier'],
                },
              },
              prepClass: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  concepts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        term: { type: Type.STRING },
                        definition: { type: Type.STRING },
                        keyRule: { type: Type.STRING },
                      },
                      required: ['term', 'definition', 'keyRule'],
                    },
                  },
                  studyTips: { type: Type.STRING },
                },
                required: ['summary', 'concepts', 'studyTips'],
              },
            },
            required: ['title', 'discipline', 'syllabus', 'prepClass'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      title: string;
      discipline: string;
      syllabus: Array<{
        roundNumber: number;
        title: string;
        topics: string[];
        difficultyTier: string;
      }>;
      prepClass: {
        summary: string;
        concepts: Array<{ term: string; definition: string; keyRule: string }>;
        studyTips: string;
      };
    };

    const syllabus: SyllabusRoundPlan[] = (parsed.syllabus || [])
      .slice(0, 10)
      .map((item, idx) => ({
        roundNumber: item.roundNumber || idx + 1,
        title: item.title,
        topics: item.topics || [],
        difficultyTier: item.difficultyTier || 'Progressivo',
        covered: false,
      }));

    const prepClass: PrepClassContent | null = wantsPrepClass
      ? {
          summary: parsed.prepClass.summary,
          concepts: parsed.prepClass.concepts || [],
          studyTips: parsed.prepClass.studyTips,
          generatedAt: new Date().toISOString(),
        }
      : null;

    res.json({
      title: parsed.title || sourceContent.slice(0, 50),
      discipline: (parsed.discipline || kbDisciplineCandidate || 'Conhecimentos Gerais').slice(0, 100),
      syllabus,
      prepClass,
      kbSources: allSources,
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 2. Generate a round (R1-R10 or Overtime R11+) + optional R3/R6/R9 Strategic Synthesis
app.post('/api/trainer/round', async (req, res) => {
  try {
    const {
      title,
      sourceType,
      sourceContent,
      selectedKbPaths,
      currentRound,
      isOvertime,
      syllabus,
      activeWeakPoints,
      recentRounds,
    } = req.body as {
      title: string;
      sourceType: SourceType;
      sourceContent: string;
      selectedKbPaths?: string[];
      currentRound: number;
      isOvertime: boolean;
      syllabus: SyllabusRoundPlan[];
      activeWeakPoints: WeakPoint[];
      recentRounds: RoundRecord[];
    };

    const needsStrategicSynthesis =
      !isOvertime && (currentRound === 4 || currentRound === 7 || currentRound === 10);

    const unresolvedWeakPoints = (activeWeakPoints || []).filter((wp) => !wp.resolved);
    const targetPlan = (syllabus || []).find((s) => s.roundNumber === currentRound);
    const lastThreeRounds = (recentRounds || []).slice(-3);
    const lastRound = lastThreeRounds[lastThreeRounds.length - 1];
    const immediateRetestTargets = lastRound
      ? lastRound.questions
          .map((q) => {
            const ev = lastRound.evaluations.find((e) => e.questionId === q.id);
            if (!ev) return null;
            const conf = ev.confidenceAtSubmit ?? q.confidence ?? '';
            const needsRetest =
              ev.verdict !== 'correct' || Boolean(ev.isLuckyGuess) || conf === 'guess';
            if (!needsRetest) return null;
            return {
              sourceQuestionId: q.id,
              targetConcept: q.targetConcept,
              subtopic: q.subtopic,
              previousPrompt: q.prompt,
              expectedRule: ev.expectedAnswer || ev.conceptDefinition,
              verdict: ev.verdict,
              wasGuess: Boolean(ev.isLuckyGuess) || conf === 'guess',
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : [];

    const retrievalQuery = [
      title,
      sourceContent.slice(0, 500),
      targetPlan?.title || '',
      ...(targetPlan?.topics || []),
      ...unresolvedWeakPoints.map((w) => w.concept),
    ].join(' ');

    const ai = getAiClient();
    const kb = await retrieveGitKnowledge({
      queryText: retrievalQuery,
      selectedRawPaths: selectedKbPaths,
      maxTotalChars: 14000,
    });

    const webFallback = await fetchWebFallbackNotes(
      ai,
      `${title} ${targetPlan?.title || ''} ${(targetPlan?.topics || []).join(' ')}`,
      kb.coverage
    );

    const prompt = `Gere a Rodada ${currentRound} ${isOvertime ? '(PRORROGAÇÃO — foco exclusivo nos erros pendentes)' : 'de 10'} para o treino "${title}".

Fonte informada pelo aluno (${sourceType}):
"""
${sourceContent.slice(0, 6000)}
"""

${
  kb.contextBlock
    ? `FONTES PRIMÁRIAS DA BASE DE ESTUDOS (priorize este conteúdo confiável para formular as perguntas e alternativas):\n${kb.contextBlock}`
    : ''
}

${
  webFallback.notes
    ? `COMPLEMENTO WEB (para eventual lacuna não presente na Base de Estudos):\n${webFallback.notes}`
    : ''
}

${
  isOvertime
    ? `MODO PRORROGAÇÃO: Gere entre 2 e 4 perguntas focadas EXCLUSIVAMENTE em retestar e consolidar estes pontos fracos que restaram após a Rodada 10 (varie obrigatoriamente o cenário prático e redação em relação às perguntas anteriores):
${JSON.stringify(unresolvedWeakPoints, null, 2)}`
    : `Planejamento desta rodada (tópicos novos):
${JSON.stringify(targetPlan ?? { roundNumber: currentRound, topics: [title], difficultyTier: 'Progressivo' })}

${
  immediateRetestTargets.length > 0
    ? `RETESTES IMEDIATOS OBRIGATÓRIOS NA RODADA ATUAL (erros ou acertos no chute da rodada anterior — DEVEM aparecer nesta rodada junto aos tópicos novos):
${JSON.stringify(immediateRetestTargets, null, 2)}

REGRA DE VARIAÇÃO DE CENÁRIO PARA RETESTES (OBRIGATÓRIA):
Para cada reteste acima, teste EXATAMENTE a mesma regra, exceção ou detalhe, MAS altere completamente o caso concreto, nomes, valores, situação fática e redação das alternativas para que o estudante não responda por memória visual.`
    : ''
}

Outros pontos fracos ainda não resolvidos na sessão:
${JSON.stringify(unresolvedWeakPoints, null, 2)}`
}

Histórico recente das últimas rodadas (NUNCA repita caso concreto, valores ou redação já usados):
${JSON.stringify(
  lastThreeRounds.map((r) => ({
    roundNumber: r.roundNumber,
    questions: r.questions.map((q) => ({
      prompt: q.prompt,
      format: q.format,
      targetConcept: q.targetConcept,
      verdict: r.evaluations.find((e) => e.questionId === q.id)?.verdict,
    })),
  })),
  null,
  2
)}

REGRAS DE ALTERNÂNCIA DE FORMATOS NA RODADA (3 a 4 questões no total):
Alterne os formatos de cobrança conforme a progressão na sessão:
1. "multiple_choice": 5 alternativas plausíveis e bem diferenciadas ("A", "B", "C", "D", "E"). Ideal para discriminação fina entre regras e exceções.
2. "true_false": julgamento objetivo de assertiva (Certo ou Errado) focado em prazos, competências, exceções ou texto literal de regra. Enunciado afirmativo claro para julgar como Certo ou Errado; retorne exatamente 2 opções: [{ "label": "A", "text": "Certo" }, { "label": "B", "text": "Errado" }].
3. "practical_case": mini-caso prático realista de aplicação direta da regra (2 a 4 linhas). Alterne os mini-casos entre:
   - resposta discursiva curta ("options": [])
   - múltipla escolha com 5 alternativas ("A".."E").
4. "open": pergunta direta aberta ("options": []) para definições curtas, cálculos ou diferenças diretas.

Regras para campos de reteste:
- Se a pergunta for um reteste de erro/chute anterior: defina "isRetest": true, preencha "retestRule" com a regra/tópico exato retestado (máx. 140 caracteres) e mantenha "targetConcept" alinhado ao ponto fraco.
- Se for tópico novo: defina "isRetest": false e "retestRule": "".
- NUNCA revele a resposta no enunciado nem dê dicas sobre a alternativa correta.

${
  needsStrategicSynthesis
    ? `CHECKPOINT OBRIGATÓRIO: O aluno acabou de completar a Rodada ${currentRound - 1}. Gere também "hasStrategicSynthesis": true e preencha "strategicSynthesis" com foco no que foi mais dificultoso nas últimas 3 rodadas, acrescentando informações adjacentes e definições objetivas de termos técnicos.`
    : `Não gere síntese estratégica nesta rodada ("hasStrategicSynthesis": false).`
}`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              difficultyLabel: {
                type: Type.STRING,
                description: 'Nível de dificuldade da rodada (ex: Base Conceitual, Aplicação Direta, Exceções e Detalhes, Prorrogação).',
              },
              questions: {
                type: Type.ARRAY,
                description: '3 a 4 perguntas alternando formatos (2 a 4 na prorrogação).',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    format: {
                      type: Type.STRING,
                      enum: ['multiple_choice', 'true_false', 'practical_case', 'open'],
                    },
                    prompt: { type: Type.STRING },
                    questionType: {
                      type: Type.STRING,
                      description: 'Ex: Múltipla Escolha Analítica, Certo ou Errado, Mini-caso Prático, Definição Direta.',
                    },
                    subtopic: { type: Type.STRING },
                    isRetest: { type: Type.BOOLEAN },
                    retestRule: {
                      type: Type.STRING,
                      description: 'Regra ou tópico original sendo retestado com novo cenário (ou string vazia se isRetest=false).',
                    },
                    targetConcept: {
                      type: Type.STRING,
                      description: 'Conceito exato sendo avaliado (se isRetest=true, use o conceito do ponto fraco correspondente).',
                    },
                    options: {
                      type: Type.ARRAY,
                      description: '5 opções (A–E) para multiple_choice ou practical_case objetivo; 2 opções (A=Certo, B=Errado) para true_false; [] para open ou practical_case discursivo.',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {
                            type: Type.STRING,
                            enum: ['A', 'B', 'C', 'D', 'E'],
                          },
                          text: { type: Type.STRING },
                        },
                        required: ['label', 'text'],
                      },
                    },
                  },
                  required: [
                    'format',
                    'prompt',
                    'questionType',
                    'subtopic',
                    'isRetest',
                    'retestRule',
                    'targetConcept',
                    'options',
                  ],
                },
              },
              hasStrategicSynthesis: { type: Type.BOOLEAN },
              strategicSynthesis: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  focusSummary: { type: Type.STRING },
                  keyDefinitions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        term: { type: Type.STRING },
                        definition: { type: Type.STRING },
                      },
                      required: ['term', 'definition'],
                    },
                  },
                  adjacentInsights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['title', 'focusSummary', 'keyDefinitions', 'adjacentInsights'],
              },
            },
            required: ['difficultyLabel', 'questions', 'hasStrategicSynthesis', 'strategicSynthesis'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      difficultyLabel: string;
      questions: Array<{
        format: QuestionFormat;
        prompt: string;
        questionType: string;
        subtopic: string;
        isRetest: boolean;
        retestRule?: string;
        targetConcept: string;
        options: Array<{ label: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }>;
      }>;
      hasStrategicSynthesis: boolean;
      strategicSynthesis: {
        title: string;
        focusSummary: string;
        keyDefinitions: Array<{ term: string; definition: string }>;
        adjacentInsights: string[];
      };
    };

    const questions: TrainerQuestion[] = (parsed.questions || []).map((q, idx) => {
      let normalizedFormat: QuestionFormat = q.format;
      let normalizedOptions = Array.isArray(q.options) ? q.options : [];

      if (normalizedFormat === 'true_false') {
        normalizedOptions = [
          { label: 'A', text: 'Certo' },
          { label: 'B', text: 'Errado' },
        ];
      } else if (normalizedFormat === 'multiple_choice') {
        if (normalizedOptions.length < 4) {
          normalizedFormat = 'open';
          normalizedOptions = [];
        } else {
          normalizedOptions = normalizedOptions.slice(0, 5);
        }
      } else if (normalizedFormat === 'practical_case') {
        if (normalizedOptions.length >= 4) {
          normalizedOptions = normalizedOptions.slice(0, 5);
        } else {
          normalizedOptions = [];
        }
      } else {
        normalizedFormat = 'open';
        normalizedOptions = [];
      }

      const matchedRetestTarget = q.isRetest
        ? immediateRetestTargets.find(
            (t) =>
              t.targetConcept.trim().toLowerCase() === (q.targetConcept || '').trim().toLowerCase()
          )
        : undefined;

      return {
        id: `r${currentRound}_q${idx + 1}_${Date.now()}`,
        format: normalizedFormat,
        prompt: q.prompt,
        questionType:
          q.questionType ||
          (normalizedFormat === 'true_false'
            ? 'Certo ou Errado'
            : normalizedFormat === 'practical_case'
              ? 'Mini-caso Prático'
              : normalizedFormat === 'multiple_choice'
                ? 'Múltipla Escolha'
                : 'Pergunta Direta'),
        subtopic: q.subtopic || title,
        isRetest: Boolean(q.isRetest),
        retestRule: q.isRetest ? (q.retestRule || q.targetConcept || q.subtopic || '').slice(0, 180) : undefined,
        retestSourceQuestionId: matchedRetestTarget?.sourceQuestionId,
        targetConcept: q.targetConcept || q.subtopic,
        options: normalizedOptions,
        userSelectedOption: '',
        userAnswer: '',
        userRationale: '',
      };
    });

    const strategicSynthesis: StrategicSynthesis | null =
      needsStrategicSynthesis && parsed.hasStrategicSynthesis
        ? {
            id: `syn_r${currentRound - 1}_${Date.now()}`,
            afterRound: currentRound - 1,
            title: parsed.strategicSynthesis.title || `Síntese Estratégica — Pós-Rodada ${currentRound - 1}`,
            focusSummary: parsed.strategicSynthesis.focusSummary,
            keyDefinitions: parsed.strategicSynthesis.keyDefinitions || [],
            adjacentInsights: parsed.strategicSynthesis.adjacentInsights || [],
            generatedAt: new Date().toISOString(),
          }
        : null;

    res.json({
      difficultyLabel: parsed.difficultyLabel || `Rodada ${currentRound}`,
      questions,
      strategicSynthesis,
      kbSources: [...kb.sources, ...webFallback.webSources],
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 3. Evaluate all answers submitted for the current round
app.post('/api/trainer/evaluate', async (req, res) => {
  try {
    const { title, sourceContent, selectedKbPaths, roundNumber, isOvertime, questions } = req.body as {
      title: string;
      sourceContent: string;
      selectedKbPaths?: string[];
      roundNumber: number;
      isOvertime: boolean;
      questions: TrainerQuestion[];
    };

    const retrievalQuery = [
      title,
      ...questions.map((q) => `${q.subtopic} ${q.targetConcept}`),
    ].join(' ');

    const kb = await retrieveGitKnowledge({
      queryText: retrievalQuery,
      selectedRawPaths: selectedKbPaths,
      maxTotalChars: 14000,
    });

    const ai = getAiClient();
    const webFallback = await fetchWebFallbackNotes(
      ai,
      `${title} ${questions.map((q) => q.targetConcept).join(', ')}`,
      kb.coverage
    );

    const prompt = `Avalie as respostas do aluno para a Rodada ${roundNumber} ${isOvertime ? '(Prorrogação)' : ''} do treino "${title}".

Material/Tema de referência do aluno:
"""
${sourceContent.slice(0, 6000)}
"""

${
  kb.contextBlock
    ? `FONTES PRIMÁRIAS DA BASE GIT (use primariamente este conteúdo para validar gabarito, justificativas e definições):\n${kb.contextBlock}`
    : ''
}

${
  webFallback.notes
    ? `COMPLEMENTO WEB (para lacunas):\n${webFallback.notes}`
    : ''
}

Perguntas, Respostas, Justificativas e Confiança Declarada do Aluno:
${JSON.stringify(
  questions.map((q) => ({
    questionId: q.id,
    format: q.format,
    prompt: q.prompt,
    subtopic: q.subtopic,
    targetConcept: q.targetConcept,
    isRetest: q.isRetest,
    options: q.options,
    userSelectedOption: q.userSelectedOption,
    userAnswer: q.userAnswer,
    userRationale: (q.userRationale || '').trim(),
    confidence: q.confidence || 'certain',
  })),
  null,
  2
)}

Instruções de correção:
- Para questões "multiple_choice" ou "practical_case" com opções A–E: compare "userSelectedOption" com a alternativa correta; informe "correctOption" ("A".."E"); classifique "verdict" ("correct" ou "incorrect").
- Para questões "true_false": considere "A" = Certo e "B" = Errado; informe "correctOption" ("A" ou "B"); classifique "verdict" ("correct" ou "incorrect") e explique exatamente o trecho ou exceção que torna a assertiva verdadeira ou falsa.
- Para questões "open" ou "practical_case" sem opções: preencha "correctOption" com ""; classifique "verdict" como "correct", "partial" ou "incorrect".
- AVALIAÇÃO DA JUSTIFICATIVA OPCIONAL ("userRationale"):
  - Se "userRationale" estiver preenchido, preencha "rationaleFeedback" com 1 a 2 frases comparando diretamente o raciocínio escrito pelo aluno com o fundamento oficial. ATENÇÃO ESPECIAL: se o aluno marcou a alternativa certa mas sua justificativa usar o motivo errado, alerte explicitamente em "rationaleFeedback" sobre o acerto pela razão equivocada.
  - Se "userRationale" estiver vazio, retorne "rationaleFeedback": "".
- Calibração de confiança: observe "confidence" ("certain" = Certeza, "unsure" = Dúvida, "guess" = Chute). Se acertou com "guess", reforce a explicação da regra; se errou com "certain", aponte a armadilha conceitual.
- Preencha "expectedAnswer" com a resposta completa esperada de forma concisa.
- REGRA DE DEFINIÇÃO: Em "conceptDefinition", forneça uma definição objetiva e direta do termo técnico ou conceito central tratado na questão.
- Defina "weakPointTriggered": true sempre que o verdict for "partial" ou "incorrect" OU quando acertar no "guess" (chute).
- Escreva "roundSummary" com uma síntese curta (1 a 2 frases) do desempenho nesta rodada.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evaluations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionId: { type: Type.STRING },
                    verdict: {
                      type: Type.STRING,
                      enum: ['correct', 'partial', 'incorrect'],
                    },
                    feedback: { type: Type.STRING },
                    rationaleFeedback: { type: Type.STRING },
                    expectedAnswer: { type: Type.STRING },
                    correctOption: {
                      type: Type.STRING,
                      enum: ['', 'A', 'B', 'C', 'D', 'E'],
                    },
                    conceptDefinition: { type: Type.STRING },
                    weakPointTriggered: { type: Type.BOOLEAN },
                  },
                  required: [
                    'questionId',
                    'verdict',
                    'feedback',
                    'rationaleFeedback',
                    'expectedAnswer',
                    'correctOption',
                    'conceptDefinition',
                    'weakPointTriggered',
                  ],
                },
              },
              roundSummary: { type: Type.STRING },
            },
            required: ['evaluations', 'roundSummary'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      evaluations: QuestionEvaluation[];
      roundSummary: string;
    };

    const enrichedEvaluations: QuestionEvaluation[] = (parsed.evaluations || []).map((ev) => {
      const q = questions.find((item) => item.id === ev.questionId);
      const conf = q?.confidence || '';
      const hasRationale = Boolean(q?.userRationale && q.userRationale.trim().length > 0);
      const isLuckyGuess = ev.verdict === 'correct' && conf === 'guess';
      const isConfidentError = ev.verdict !== 'correct' && conf === 'certain';
      return {
        ...ev,
        rationaleFeedback: hasRationale ? (ev.rationaleFeedback || '').trim() : '',
        confidenceAtSubmit: conf,
        isLuckyGuess,
        isConfidentError,
        weakPointTriggered: ev.verdict !== 'correct' || isLuckyGuess,
      };
    });

    res.json({
      evaluations: enrichedEvaluations,
      roundSummary: parsed.roundSummary || '',
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 4. Generate mandatory Final Structured Hierarchical Tree Synthesis
app.post('/api/trainer/finalize', async (req, res) => {
  try {
    const { title, sourceContent, selectedKbPaths, syllabus, rounds, activeWeakPoints } = req.body as {
      title: string;
      sourceContent: string;
      selectedKbPaths?: string[];
      syllabus: SyllabusRoundPlan[];
      rounds: RoundRecord[];
      activeWeakPoints: WeakPoint[];
    };

    const kb = await retrieveGitKnowledge({
      queryText: `${title} ${sourceContent.slice(0, 400)}`,
      selectedRawPaths: selectedKbPaths,
      maxTotalChars: 10000,
    });

    const ai = getAiClient();
    const compactHistory = (rounds || []).map((r) => ({
      roundNumber: r.roundNumber,
      isOvertime: r.isOvertime,
      items: r.questions.map((q) => {
        const ev = r.evaluations.find((e) => e.questionId === q.id);
        return {
          subtopic: q.subtopic,
          concept: q.targetConcept,
          format: q.format,
          verdict: ev?.verdict ?? 'unanswered',
          wasLuckyGuess: Boolean(ev?.isLuckyGuess),
          errorCause: ev?.errorCause || '',
          expected: ev?.expectedAnswer ?? '',
          definition: ev?.conceptDefinition ?? '',
        };
      }),
    }));

    const prompt = `O treino ativo sobre "${title}" foi concluído. Gere agora a SÍNTESE FINAL EM ÁRVORE HIERÁRQUICA obrigatória consolidando tudo o que foi estudado.

Escopo original:
"""
${sourceContent.slice(0, 5000)}
"""

${
  kb.contextBlock
    ? `FONTES PRIMÁRIAS DA BASE DE ESTUDOS:\n${kb.contextBlock}`
    : ''
}

Plano de tópicos:
${JSON.stringify(syllabus, null, 2)}

Histórico das rodadas e conceitos avaliados (incluindo erros, chutes e causas marcadas):
${JSON.stringify(compactHistory, null, 2)}

Pontos fracos enfrentados durante a sessão:
${JSON.stringify(activeWeakPoints, null, 2)}

REQUISITOS ESTRITOS PARA "asciiTree":
1. Use EXCLUSIVAMENTE conectores Unicode limpos: ├──, └── e │ (exatamente esses caracteres para boa leitura e indentação).
2. NÃO inclua crases/blocos markdown (\`\`\`) dentro da string asciiTree — retorne somente o texto puro da árvore.
3. Organize a árvore obrigatoriamente nesta estrutura exata em 4 blocos principais sob o título raiz:
   ${title.toUpperCase()}
   ├── 1. TEMA CENTRAL DA SESSÃO
   │   ├── ...
   │   └── ...
   ├── 2. SUBTÓPICOS PRINCIPAIS E REGRAS GERAIS
   │   ├── ...
   │   └── ...
   ├── 3. EXCEÇÕES, PRAZOS, COMPETÊNCIAS E CONDIÇÕES ESPECÍFICAS
   │   ├── ...
   │   └── ...
   └── 4. PONTOS DE ATENÇÃO E PEGADINHAS DAS RODADAS ERRADAS OU CHUTADAS
       ├── ...
       └── ...
4. Mantenha linhas concisas (preferencialmente até ~70 caracteres por linha quando possível, usando subnós │   ├── para detalhes) com alta densidade técnica e zero enrolação.
5. No bloco 4, dê destaque explícito às pegadinhas, detalhes e exceções das questões em que o aluno errou ou acertou por chute nesta sessão.

Em "closingFeedback", escreva um parecer final objetivo (2 a 4 frases) avaliando a evolução do aluno, destacando os pontos dominados e eventuais atenções finais.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              asciiTree: { type: Type.STRING },
              closingFeedback: { type: Type.STRING },
            },
            required: ['asciiTree', 'closingFeedback'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      asciiTree: string;
      closingFeedback: string;
    };

    const cleanTree = (parsed.asciiTree || '')
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    res.json({
      asciiTree: cleanTree,
      closingFeedback: parsed.closingFeedback || 'Treino concluído com síntese consolidada.',
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 5. Generate comparative table between two related/confused concepts
app.post('/api/trainer/comparative-table', async (req, res) => {
  try {
    const { discipline, conceptA, conceptB, contextNotes } = req.body as {
      discipline: string;
      conceptA: string;
      conceptB?: string;
      contextNotes?: string;
    };

    if (!conceptA?.trim()) {
      res.status(400).json({ error: 'Informe ao menos um conceito para comparar.' });
      return;
    }

    const ai = getAiClient();
    const retrievalQuery = [discipline, conceptA, conceptB || ''].filter(Boolean).join(' ');
    const kb = await retrieveGitKnowledge({
      queryText: retrievalQuery,
      maxTotalChars: 10000,
    });

    const hasExplicitConceptB =
      Boolean(conceptB?.trim()) &&
      !conceptB!.toLowerCase().startsWith('conceito correlato');

    const prompt = `Crie um QUADRO COMPARATIVO DE ALTA PRECISÃO para revisão de prova na disciplina "${discipline || 'Conhecimentos Gerais'}".

Conceito A: "${conceptA.trim()}"
${
  hasExplicitConceptB
    ? `Conceito B: "${conceptB!.trim()}"`
    : `Conceito B não informado explicitamente: identifique o conceito irmão ou instituto mais frequentemente confundido em provas com "${conceptA.trim()}" nesta disciplina e use-o como Conceito B.`
}
${contextNotes ? `Contexto de dúvidas/erros do aluno: ${contextNotes.slice(0, 1200)}` : ''}

${
  kb.contextBlock
    ? `FONTES PRIMÁRIAS DA BASE DE ESTUDOS (use como referência prioritária):\n${kb.contextBlock}`
    : ''
}

REGRAS DO QUADRO COMPARATIVO:
1. Gere entre 4 e 6 linhas de comparação realmente decisivas para acertar questões de prova (natureza jurídica/técnica, requisitos, prazos/limites, competência, exceções e efeitos).
2. Cada linha deve ter 4 campos curtos, diretos e contrastantes:
   - "criterion": Critério de comparação
   - "conceptAValue": Como funciona no Conceito A
   - "conceptBValue": Como funciona no Conceito B
   - "examDecisiveDiff": Diferença decisiva na prova (como a banca costuma trocar um pelo outro)
3. Preencha "summaryTip" com 1 a 2 frases com o macete ou critério-chave de distinção rápida.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              conceptA: { type: Type.STRING },
              conceptB: { type: Type.STRING },
              summaryTip: { type: Type.STRING },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    criterion: { type: Type.STRING },
                    conceptAValue: { type: Type.STRING },
                    conceptBValue: { type: Type.STRING },
                    examDecisiveDiff: { type: Type.STRING },
                  },
                  required: [
                    'criterion',
                    'conceptAValue',
                    'conceptBValue',
                    'examDecisiveDiff',
                  ],
                },
              },
            },
            required: ['title', 'conceptA', 'conceptB', 'summaryTip', 'rows'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      title: string;
      conceptA: string;
      conceptB: string;
      summaryTip: string;
      rows: ComparativeTableRow[];
    };

    res.json({
      title: parsed.title || `${parsed.conceptA || conceptA} × ${parsed.conceptB || conceptB || 'Conceito Correlato'}`,
      conceptA: parsed.conceptA || conceptA.trim(),
      conceptB: parsed.conceptB || conceptB?.trim() || 'Conceito Correlato',
      summaryTip: parsed.summaryTip || '',
      rows: Array.isArray(parsed.rows) ? parsed.rows.slice(0, 8) : [],
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// 6. Generate concise contextual theory explanation when student flags lack_of_theory
app.post('/api/trainer/theory-summary', async (req, res) => {
  try {
    const { discipline, concept, subtopic, expectedAnswer } = req.body as {
      discipline?: string;
      concept: string;
      subtopic?: string;
      expectedAnswer?: string;
    };

    if (!concept?.trim()) {
      res.status(400).json({ error: 'Conceito não informado.' });
      return;
    }

    const ai = getAiClient();
    const kb = await retrieveGitKnowledge({
      queryText: `${discipline || ''} ${concept} ${subtopic || ''}`,
      maxTotalChars: 9000,
    });

    const prompt = `O estudante marcou "Falta de base teórica" ao errar uma questão sobre "${concept}" (${subtopic || discipline || 'Estudo Ativo'}).
${expectedAnswer ? `Referência da questão: ${expectedAnswer.slice(0, 600)}` : ''}
${kb.contextBlock ? `FONTES PRIMÁRIAS DA BASE DE ESTUDOS:\n${kb.contextBlock}` : ''}

Produza uma explicação teórica resumida, didática e direta ao ponto para construir a base desse conceito sem textão:
- coreRule: explicação clara da regra geral e seus fundamentos em 2-4 frases.
- practicalExample: 1 exemplo prático curto aplicando a regra.
- commonTrap: a principal pegadinha ou exceção cobrada em prova.
- memoryAnchor: 1 frase curta de fixação mental.`;

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              coreRule: { type: Type.STRING },
              practicalExample: { type: Type.STRING },
              commonTrap: { type: Type.STRING },
              memoryAnchor: { type: Type.STRING },
            },
            required: ['concept', 'coreRule', 'practicalExample', 'commonTrap', 'memoryAnchor'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as TheorySummaryContent;
    res.json({
      concept: parsed.concept || concept,
      coreRule: parsed.coreRule || expectedAnswer || '',
      practicalExample: parsed.practicalExample || '',
      commonTrap: parsed.commonTrap || '',
      memoryAnchor: parsed.memoryAnchor || '',
    });
  } catch (error) {
    const formatted = formatErrorMessage(error);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Caderno Ativo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

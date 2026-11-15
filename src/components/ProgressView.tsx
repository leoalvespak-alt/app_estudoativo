import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Dices,
  HelpCircle,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  buildMergedWeakPointBank,
  computeDiagnosticAnalytics,
  computeProgressMetrics,
  ERROR_CAUSE_LABELS,
  type MergedWeakPointItem,
  type WorstTopicRankItem,
} from '../lib/progressAnalytics';
import { DisciplineAccuracyLineChart } from './DisciplineAccuracyLineChart';
import { formatShortDate } from '../lib/storage';
import type {
  ComparativeTableEntry,
  TrainingSession,
  WeakPointBankEntry,
  WeakPointTrigger,
} from '../types/trainer';

interface ProgressViewProps {
  usernameKey: string;
  sessions: TrainingSession[];
  weakPointsBank: WeakPointBankEntry[];
  comparativeTables: ComparativeTableEntry[];
  isLaunchingSurgical?: boolean;
  generatingComparativeKey?: string | null;
  onStartWeakPointsTraining: (
    discipline: string,
    items: MergedWeakPointItem[]
  ) => void;
  onLaunchSurgicalTraining: (
    disciplineFilter: string,
    worstItems: WorstTopicRankItem[]
  ) => void;
  onGenerateComparativeTable: (params: {
    discipline: string;
    conceptA: string;
    conceptB?: string;
    triggerReason: 'auto_confusion' | 'on_demand';
    contextNotes?: string;
    trackingKey: string;
  }) => void;
  onOpenComparativeTableModal: (tableId: string) => void;
  onToggleWeakPointStatus: (entry: MergedWeakPointItem) => void;
  onDeleteWeakPoint: (entry: MergedWeakPointItem) => void;
  onOpenSession: (sessionId: string) => void;
  onStartNewTraining: () => void;
}

type BankFilter = 'active' | 'guesses' | 'mastered' | 'all';

function getTriggerInfo(
  status: 'active' | 'mastered',
  trigger: WeakPointTrigger
): { label: string; colorClass: string; Icon: typeof AlertTriangle } {
  if (status === 'mastered') {
    return {
      label: 'Consolidado',
      colorClass: 'text-[#047857] dark:text-[#34D399]',
      Icon: CheckCircle2,
    };
  }
  switch (trigger) {
    case 'lucky_guess':
      return {
        label: 'Acerto por chute',
        colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
        Icon: Dices,
      };
    case 'unsure_hit':
      return {
        label: 'Acerto com dúvida',
        colorClass: 'text-[#B45309] dark:text-[#FBBF24]',
        Icon: HelpCircle,
      };
    case 'partial':
      return {
        label: 'Resposta parcial',
        colorClass: 'text-[#B45309] dark:text-[#FBBF24]',
        Icon: AlertTriangle,
      };
    default:
      return {
        label: 'Erro recorrente',
        colorClass: 'text-[#B91C1C] dark:text-[#F87171]',
        Icon: XCircle,
      };
  }
}

export function ProgressView({
  usernameKey,
  sessions,
  weakPointsBank,
  comparativeTables,
  isLaunchingSurgical = false,
  generatingComparativeKey = null,
  onStartWeakPointsTraining,
  onLaunchSurgicalTraining,
  onGenerateComparativeTable,
  onOpenComparativeTableModal,
  onToggleWeakPointStatus,
  onDeleteWeakPoint,
  onOpenSession,
  onStartNewTraining,
}: ProgressViewProps) {
  const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [trendDisciplineFilter, setTrendDisciplineFilter] = useState<string>('');
  const [showRealRetentionLine, setShowRealRetentionLine] = useState<boolean>(true);
  const [bankFilter, setBankFilter] = useState<BankFilter>('active');
  const [bankQuery, setBankQuery] = useState('');
  const [selectedWpIds, setSelectedWpIds] = useState<string[]>([]);

  const metrics = useMemo(() => computeProgressMetrics(sessions), [sessions]);
  const visibleTrends = useMemo(() => {
    if (!trendDisciplineFilter) return metrics.disciplineTrends;
    return metrics.disciplineTrends.filter(
      (t) => t.discipline === trendDisciplineFilter
    );
  }, [metrics.disciplineTrends, trendDisciplineFilter]);

  const mergedBank = useMemo(
    () => buildMergedWeakPointBank(usernameKey, weakPointsBank, sessions),
    [usernameKey, weakPointsBank, sessions]
  );

  const activeSurgicalDiscipline = selectedDiscipline || trendDisciplineFilter;

  const diagnostic = useMemo(
    () =>
      computeDiagnosticAnalytics({
        sessions,
        mergedBank,
        comparativeTables,
        disciplineFilter: activeSurgicalDiscipline || undefined,
      }),
    [sessions, mergedBank, comparativeTables, activeSurgicalDiscipline]
  );

  const surgicalTargets = useMemo(() => {
    if (diagnostic.worstTopics.length > 0) {
      return diagnostic.worstTopics.slice(0, 6);
    }
    if (activeSurgicalDiscipline) {
      const globalDiag = computeDiagnosticAnalytics({
        sessions,
        mergedBank,
        comparativeTables,
      });
      return globalDiag.worstTopics.slice(0, 6);
    }
    return [];
  }, [diagnostic.worstTopics, activeSurgicalDiscipline, sessions, mergedBank, comparativeTables]);

  const canLaunchSurgical = surgicalTargets.length > 0;

  const bankDisciplines = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();
    for (const item of mergedBank) {
      const cur = counts.get(item.discipline) || { total: 0, active: 0 };
      cur.total += 1;
      if (item.status === 'active') cur.active += 1;
      counts.set(item.discipline, cur);
    }
    return Array.from(counts.entries())
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
  }, [mergedBank]);

  const counts = useMemo(() => {
    const scoped = selectedDiscipline
      ? mergedBank.filter((item) => item.discipline === selectedDiscipline)
      : mergedBank;
    return {
      active: scoped.filter((i) => i.status === 'active').length,
      guesses: scoped.filter(
        (i) =>
          i.lastTrigger === 'lucky_guess' ||
          i.lastTrigger === 'unsure_hit' ||
          i.guessCount > 0
      ).length,
      mastered: scoped.filter((i) => i.status === 'mastered').length,
      all: scoped.length,
    };
  }, [mergedBank, selectedDiscipline]);

  const filteredBank = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    return mergedBank.filter((item) => {
      if (selectedDiscipline && item.discipline !== selectedDiscipline) return false;
      if (bankFilter === 'active' && item.status !== 'active') return false;
      if (bankFilter === 'mastered' && item.status !== 'mastered') return false;
      if (
        bankFilter === 'guesses' &&
        item.lastTrigger !== 'lucky_guess' &&
        item.lastTrigger !== 'unsure_hit' &&
        item.guessCount === 0
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.concept.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.discipline.toLowerCase().includes(q) ||
        item.subtopic.toLowerCase().includes(q)
      );
    });
  }, [mergedBank, selectedDiscipline, bankFilter, bankQuery]);

  const trainablePool = useMemo(() => {
    const selectedItems = mergedBank.filter((item) => selectedWpIds.includes(item.id));
    if (selectedItems.length > 0) {
      return selectedItems.slice(0, 10);
    }
    const activeFiltered = filteredBank.filter((item) => item.status === 'active');
    if (activeFiltered.length > 0) {
      return activeFiltered.slice(0, 8);
    }
    return filteredBank.slice(0, 8);
  }, [mergedBank, selectedWpIds, filteredBank]);

  const targetTrainingDiscipline =
    selectedDiscipline ||
    trainablePool[0]?.discipline ||
    'Revisão de Pontos Fracos';

  const toggleDisciplineExpand = (disc: string) => {
    setExpandedDisciplines((prev) => ({ ...prev, [disc]: !prev[disc] }));
  };

  const toggleWpSelection = (id: string) => {
    setSelectedWpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (sessions.length === 0 && mergedBank.length === 0) {
    return (
      <section className="max-w-[960px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-6">
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 sm:p-10 space-y-8">
          <div className="space-y-3 text-center max-w-xl mx-auto">
            <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Painel de desempenho · {usernameKey}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Progresso e Banco de Pontos Fracos
            </h1>
            <p className="reading-measure mx-auto text-[#44403C] dark:text-[#D0CAC0]">
              Ainda não há rodadas avaliadas na conta de {usernameKey}. Assim que você concluir sua primeira rodada, sua retenção real, causas de erro, evolução por disciplina e pontos fracos aparecerão estruturados aqui.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartNewTraining}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Começar primeiro treino</span>
              </button>
            </div>
          </div>

          <div aria-hidden="true" className="space-y-4 opacity-55 select-none pointer-events-none">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                'Sessões concluídas',
                'Retenção real (sem chutes)',
                'Taxa bruta de acertos',
                'Filtro de chutes',
              ].map((label) => (
                <div
                  key={label}
                  className="p-4 rounded-lg border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] space-y-1.5"
                >
                  <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">{label}</p>
                  <p className="font-mono text-xl font-semibold tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                    —%
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] space-y-3">
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Prévia: gráfico de evolução nas últimas 10 sessões
                </p>
                <div className="h-24 flex flex-col justify-between py-1">
                  <div className="border-t border-dashed border-[#E5E0D8] dark:border-[#36332E]" />
                  <div className="border-t border-dashed border-[#E5E0D8] dark:border-[#36332E]" />
                  <div className="border-t border-dashed border-[#E5E0D8] dark:border-[#36332E]" />
                  <div className="border-t border-[#D6D0C6] dark:border-[#45413B]" />
                </div>
              </div>

              <div className="p-4 rounded-lg border border-dashed border-[#D6D0C6] dark:border-[#3E3A34] bg-[#FAF8F5] dark:bg-[#1C1B19] space-y-2.5">
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Prévia: Diagnóstico de causas de erro e quadros comparativos
                </p>
                <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Certeza</span>
                  <span>·</span>
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Dúvida</span>
                  <span>·</span>
                  <Dices className="w-3.5 h-3.5" />
                  <span>Chute</span>
                </div>
                <div className="h-3 w-3/4 rounded bg-[#E5E0D8] dark:bg-[#36332E]" />
                <div className="h-3 w-1/2 rounded bg-[#E5E0D8] dark:bg-[#36332E]" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10">
      <div className="pb-5 border-b border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Registros salvos na conta de {usernameKey}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
            Progresso, Diagnóstico de Erros e Reteste Cirúrgico
          </h1>
          <p className="mt-1 reading-measure text-[#44403C] dark:text-[#D0CAC0]">
            Acompanhe sua retenção real, identifique por que você erra cada regra e dispare um treino imediato focado nos seus piores tópicos.
          </p>
        </div>

        <button
          type="button"
          disabled={!canLaunchSurgical || isLaunchingSurgical}
          onClick={() =>
            onLaunchSurgicalTraining(activeSurgicalDiscipline, surgicalTargets)
          }
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-sm font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer disabled:opacity-40 shrink-0"
        >
          {isLaunchingSurgical ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Montando treino cirúrgico...</span>
            </>
          ) : (
            <>
              <Target className="w-4 h-4" aria-hidden="true" />
              <span>Atacar pontos fracos agora</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* 1. KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-1.5">
          <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            Sessões Concluídas
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            {metrics.completedSessionsCount}
          </p>
          <p className="text-xs tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
            {metrics.activeSessionsCount} em andamento · {metrics.totalTopicsConsolidated} tópicos
          </p>
        </div>

        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#047857] dark:text-[#34D399]">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retenção Real (Sem Chutes)</span>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            {metrics.totalQuestionsEvaluated > 0 ? `${metrics.realRetentionPct}%` : '—'}
          </p>
          <p className="text-xs tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
            Em {metrics.totalQuestionsEvaluated} questões avaliadas
          </p>
        </div>

        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
            <HelpCircle className="w-3.5 h-3.5 text-[#B45309] dark:text-[#FBBF24]" aria-hidden="true" />
            <span>Taxa Bruta de Acertos</span>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            {metrics.totalQuestionsEvaluated > 0 ? `${metrics.rawAccuracyPct}%` : '—'}
          </p>
          <p className="text-xs tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
            {metrics.rawCorrectCount} acertos · {metrics.unsureHitsCount} com dúvida
          </p>
        </div>

        <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#B91C1C] dark:text-[#F87171]">
            <Dices className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Filtro de Chutes</span>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            {metrics.guessHitsCount}
          </p>
          <p className="text-xs tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
            {metrics.guessShareOfCorrectPct}% dos acertos · {metrics.confidentErrorsCount} erros com certeza
          </p>
        </div>
      </div>

      {/* 2. Error Cause Diagnosis, Worst Topics Ranking & Automatic Confusion Pairs */}
      {(diagnostic.worstTopics.length > 0 || diagnostic.totalClassified > 0) && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Diagnóstico de Causas de Erro e Tópicos Críticos
              </h2>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] mt-0.5">
                {activeSurgicalDiscipline
                  ? `Escopo filtrado em ${activeSurgicalDiscipline}.`
                  : 'Visão consolidada de todas as disciplinas.'}{' '}
                Marque a causa de cada erro ao corrigir as rodadas para refinar seu diagnóstico.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Cause Breakdown */}
            <div className="lg:col-span-5 bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Distribuição das Causas de Erro
                </h3>
                <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                  {diagnostic.totalClassified} classificado(s)
                </span>
              </div>

              {diagnostic.totalClassified === 0 ? (
                <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                  Nenhuma causa classificada ainda neste escopo. Ao errar ou acertar no chute em uma rodada, selecione entre falta de base teórica, leitura apressada, confusão entre conceitos ou esquecimento de detalhe.
                </p>
              ) : (
                <div className="space-y-3">
                  {diagnostic.causeStats.map((stat) => (
                    <div key={stat.cause} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-[#18181B] dark:text-[#EFECE6]">
                          {stat.label}
                        </span>
                        <span className="font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                          {stat.count} ({stat.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#F5F2EC] dark:bg-[#1C1B19] overflow-hidden">
                        <div
                          className="h-full bg-[#B45309] dark:bg-[#F59E0B] rounded-full transition-all"
                          style={{ width: `${Math.max(stat.count > 0 ? 6 : 0, stat.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Worst Topics Ranking */}
            <div className="lg:col-span-7 bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Ranking de Regras e Tópicos com Maior Incidência de Falha
                </h3>
                <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                  Top {Math.min(6, diagnostic.worstTopics.length)}
                </span>
              </div>

              {diagnostic.worstTopics.length === 0 ? (
                <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                  Nenhum tópico crítico acumulado neste recorte.
                </p>
              ) : (
                <ol className="space-y-2">
                  {diagnostic.worstTopics.slice(0, 6).map((item, idx) => (
                    <li
                      key={item.id}
                      className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-[#B45309] dark:text-[#F59E0B] tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-[#18181B] dark:text-[#EFECE6] truncate">
                            {item.concept}
                          </span>
                          <span className="text-[#44403C] dark:text-[#C2BCB2]">
                            · {item.discipline}
                          </span>
                        </div>
                        {item.dominantCause && (
                          <p className="text-[11px] text-[#44403C] dark:text-[#C2BCB2]">
                            Causa predominante: {ERROR_CAUSE_LABELS[item.dominantCause]}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-xs font-mono tabular-nums">
                        <span className="text-[#B91C1C] dark:text-[#F87171]">
                          {item.errorCount} erro(s)
                        </span>
                        <span className="text-[#44403C] dark:text-[#C2BCB2]">·</span>
                        <span className="text-[#92400E] dark:text-[#FBBF24]">
                          {item.guessCount} chute(s)
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* Automatic Confusion Pair Alerts */}
          {diagnostic.confusionPairs.length > 0 && (
            <div className="bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#D6D0C6] dark:border-[#36332E] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#B45309] dark:text-[#F59E0B]">
                <Columns3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Confusões conceituais detectadas automaticamente</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diagnostic.confusionPairs.map((pair) => {
                  const trackKey = `pair:${pair.id}`;
                  const isGenerating = generatingComparativeKey === trackKey;
                  return (
                    <div
                      key={pair.id}
                      className="p-4 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                          {pair.discipline} · {pair.confusionTagCount} ocorrência(s) no eixo
                        </p>
                        <p className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                          {pair.conceptA} × {pair.conceptB}
                        </p>
                      </div>

                      {pair.existingTableId ? (
                        <button
                          type="button"
                          onClick={() => onOpenComparativeTableModal(pair.existingTableId!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer shrink-0"
                        >
                          <Columns3 className="w-3.5 h-3.5 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                          <span>Abrir quadro salvo</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() =>
                            onGenerateComparativeTable({
                              discipline: pair.discipline,
                              conceptA: pair.conceptA,
                              conceptB: pair.conceptB,
                              triggerReason: 'auto_confusion',
                              trackingKey: trackKey,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              <span>Gerando quadro...</span>
                            </>
                          ) : (
                            <>
                              <Columns3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Gerar quadro comparativo</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. D3 Line Charts: Accuracy across the last 10 sessions per discipline */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Evolução da Taxa de Acerto (Últimas 10 Sessões por Disciplina)
            </h2>
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] mt-0.5">
              Passe o cursor sobre os pontos ou clique para abrir a sessão correspondente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-[#44403C] dark:text-[#C2BCB2]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#B45309] dark:bg-[#F59E0B] inline-block" aria-hidden="true" />
                <span>Taxa de acerto</span>
              </span>
              <button
                type="button"
                onClick={() => setShowRealRetentionLine((prev) => !prev)}
                aria-pressed={showRealRetentionLine}
                className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
                  showRealRetentionLine ? 'opacity-100 text-[#18181B] dark:text-[#EFECE6]' : 'opacity-60 line-through'
                }`}
              >
                <span
                  className="w-4 border-t-2 border-dashed border-[#047857] dark:border-[#34D399] inline-block"
                  aria-hidden="true"
                />
                <span>Retenção real (sem chutes)</span>
              </button>
            </div>

            {metrics.disciplineTrends.length > 1 && (
              <select
                aria-label="Filtrar gráfico por disciplina"
                value={trendDisciplineFilter}
                onChange={(e) => setTrendDisciplineFilter(e.target.value)}
                className="rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] px-3 py-1.5 text-xs font-medium text-[#18181B] dark:text-[#EFECE6] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
              >
                <option value="">
                  Todas as disciplinas ({metrics.disciplineTrends.length})
                </option>
                {metrics.disciplineTrends.map((t) => (
                  <option key={t.discipline} value={t.discipline}>
                    {t.discipline} ({t.points.length} sessões)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {visibleTrends.length === 0 ? (
          <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 text-sm text-[#44403C] dark:text-[#C2BCB2]">
            Avalie pelo menos uma rodada em qualquer sessão para visualizar os gráficos de evolução da taxa de acerto por disciplina.
          </div>
        ) : (
          <div
            className={`grid gap-5 ${
              visibleTrends.length === 1
                ? 'grid-cols-1'
                : 'grid-cols-1 lg:grid-cols-2'
            }`}
          >
            {visibleTrends.map((series) => (
              <DisciplineAccuracyLineChart
                key={series.discipline}
                series={series}
                showRealRetention={showRealRetentionLine}
                onOpenSession={onOpenSession}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Completed Sessions Syllabus Progress by Discipline */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Andamento por Disciplina (Sessões Concluídas)
            </h2>
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
              Tópicos e subtópicos consolidados exclusivamente a partir dos treinos finalizados.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
            {metrics.disciplineSummaries.length} disciplina(s)
          </span>
        </div>

        {metrics.disciplineSummaries.length === 0 ? (
          <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-6 text-sm text-[#44403C] dark:text-[#C2BCB2] flex flex-wrap items-center justify-between gap-4">
            <p className="reading-measure">
              Nenhuma sessão foi concluída até a árvore final ainda. Finalize um treino ativo para registrar o andamento programático por disciplina aqui.
            </p>
            <button
              type="button"
              onClick={onStartNewTraining}
              className="px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] cursor-pointer"
            >
              Iniciar treino
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.disciplineSummaries.map((disc) => {
              const isExpanded = Boolean(expandedDisciplines[disc.discipline]);
              return (
                <article
                  key={disc.discipline}
                  className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6] truncate">
                        {disc.discipline}
                      </h3>
                      <p className="mt-0.5 text-xs tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                        {disc.completedSessions} sessão(ões) · {disc.topicsCovered.length} tópicos · Último em {formatShortDate(disc.lastStudiedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6] inline-flex items-center gap-1 justify-end">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                        <span>{disc.realRetentionPct}% real</span>
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2]">
                        {disc.rawAccuracyPct}% bruto · {disc.guessHitsCount} chute(s)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="w-full h-2 rounded-full bg-[#F5F2EC] dark:bg-[#1C1B19] overflow-hidden relative">
                      <div
                        className="h-full bg-[#B45309]/35 dark:bg-[#F59E0B]/35 absolute left-0 top-0"
                        style={{ width: `${Math.min(100, disc.rawAccuracyPct)}%` }}
                      />
                      <div
                        className="h-full bg-[#047857] dark:bg-[#34D399] absolute left-0 top-0"
                        style={{ width: `${Math.min(100, disc.realRetentionPct)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                        <span>Com certeza ({disc.realRetentionPct}%)</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Dices className="w-3 h-3 text-[#B91C1C] dark:text-[#F87171]" aria-hidden="true" />
                        <span>Chutes ({disc.guessHitsCount})</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleDisciplineExpand(disc.discipline)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {isExpanded
                          ? 'Ocultar tópicos e sessões'
                          : 'Ver tópicos cobertos e sessões'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDiscipline(disc.discipline);
                        document
                          .getElementById('weak-points-bank-section')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer"
                    >
                      Filtrar erros desta disciplina
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] space-y-4">
                      {disc.topicsCovered.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                            Tópicos estudados nas sessões concluídas
                          </p>
                          <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                            {disc.topicsCovered.slice(0, 24).join(' · ')}
                            {disc.topicsCovered.length > 24 &&
                              ` · +${disc.topicsCovered.length - 24} tópicos`}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                          Sessões concluídas
                        </p>
                        <ul className="space-y-1.5">
                          {disc.sessions.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <button
                                type="button"
                                onClick={() => onOpenSession(s.id)}
                                className="text-left text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-2 truncate cursor-pointer"
                              >
                                {s.title}
                              </button>
                              <span className="font-mono tabular-nums text-[#44403C] dark:text-[#C2BCB2] shrink-0">
                                {s.accuracyPct}% · {formatShortDate(s.updatedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Cross-Session Weak-Point Bank by Discipline */}
      <section
        id="weak-points-bank-section"
        className="space-y-5 pt-4 border-t border-[#E5E0D8] dark:border-[#36332E]"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#EFECE6]">
              Banco de Erros e Chutes por Disciplina
            </h2>
            <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] mt-1">
              Selecione itens específicos ou dispare um reteste personalizado dos conceitos registrados aqui.
            </p>
          </div>

          <button
            type="button"
            disabled={trainablePool.length === 0}
            onClick={() =>
              onStartWeakPointsTraining(targetTrainingDiscipline, trainablePool)
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#B45309] dark:border-[#F59E0B] bg-white dark:bg-[#22201D] text-[#B45309] dark:text-[#F59E0B] text-xs sm:text-sm font-semibold hover:bg-amber-50/70 dark:hover:bg-[#282522] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>
              {selectedWpIds.length > 0
                ? `Configurar treino (${selectedWpIds.length} selecionado(s))`
                : `Configurar treino (${trainablePool.length} pontos)`}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <select
              aria-label="Filtrar banco de erros por disciplina"
              value={selectedDiscipline}
              onChange={(e) => {
                setSelectedDiscipline(e.target.value);
                setSelectedWpIds([]);
              }}
              className="w-full sm:w-auto rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] px-3 py-2 text-xs font-medium text-[#18181B] dark:text-[#EFECE6] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
            >
              <option value="">Todas as disciplinas ({mergedBank.length})</option>
              {bankDisciplines.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.active} ativos / {d.total})
                </option>
              ))}
            </select>

            <div
              role="tablist"
              aria-label="Filtrar status dos pontos fracos"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] max-w-full"
            >
              {(
                [
                  ['active', `Ativos (${counts.active})`],
                  ['guesses', `Chutes/Dúvida (${counts.guesses})`],
                  ['mastered', `Consolidados (${counts.mastered})`],
                  ['all', `Todos (${counts.all})`],
                ] as Array<[BankFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={bankFilter === key}
                  onClick={() => setBankFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    bankFilter === key
                      ? 'bg-white dark:bg-[#282522] text-[#18181B] dark:text-[#EFECE6] shadow-xs'
                      : 'text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-60">
            <Search
              className="w-3.5 h-3.5 text-[#57534E] dark:text-[#C2BCB2] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder="Buscar conceito..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#22201D] text-xs text-[#18181B] dark:text-[#EFECE6] placeholder:text-[#57534E] dark:placeholder:text-[#A8A29E] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
            />
          </div>
        </div>

        {filteredBank.length === 0 ? (
          <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-8 text-center text-sm text-[#44403C] dark:text-[#C2BCB2]">
            Nenhum ponto fraco encontrado neste filtro.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredBank.map((entry) => {
              const info = getTriggerInfo(entry.status, entry.lastTrigger);
              const StatusIcon = info.Icon;
              const isSelected = selectedWpIds.includes(entry.id);
              const trackKey = `wp:${entry.id}`;
              const isGeneratingComp = generatingComparativeKey === trackKey;

              return (
                <article
                  key={entry.id}
                  className={`bg-white dark:bg-[#22201D] border rounded-xl p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4 transition-colors ${
                    isSelected
                      ? 'border-[#B45309] dark:border-[#F59E0B]'
                      : 'border-[#E5E0D8] dark:border-[#36332E]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleWpSelection(entry.id)}
                      aria-pressed={isSelected}
                      aria-label={`Selecionar ${entry.concept} para treino`}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#B45309] dark:bg-[#F59E0B] border-[#B45309] dark:border-[#F59E0B] text-[#FAF8F5] dark:text-[#141312]'
                          : 'border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#141312]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                    </button>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#44403C] dark:text-[#C2BCB2]">
                        <span className={`inline-flex items-center gap-1 font-semibold ${info.colorClass}`}>
                          <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{info.label}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#18181B] dark:text-[#EFECE6]">
                          {entry.discipline}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {entry.errorCount} erro(s) · {entry.guessCount} chute(s)/dúvida
                        </span>
                        {entry.lastErrorCause && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#92400E] dark:text-[#FBBF24]">
                              {ERROR_CAUSE_LABELS[entry.lastErrorCause]}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-base font-semibold text-[#18181B] dark:text-[#EFECE6]">
                        {entry.concept}
                      </h3>

                      {entry.definition && (
                        <p className="text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed reading-measure">
                          {entry.definition}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isGeneratingComp}
                      onClick={() =>
                        onGenerateComparativeTable({
                          discipline: entry.discipline,
                          conceptA: entry.concept,
                          triggerReason: 'on_demand',
                          contextNotes: entry.definition || entry.subtopic,
                          trackingKey: trackKey,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingComp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          <span>Gerando...</span>
                        </>
                      ) : (
                        <>
                          <Columns3 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Comparar conceitos parecidos</span>
                        </>
                      )}
                    </button>

                    {!entry.isLegacyFromSession && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleWeakPointStatus(entry)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-[#FAF8F5] dark:bg-[#1C1B19] text-xs font-medium text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] cursor-pointer"
                        >
                          {entry.status === 'mastered' ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Reativar</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                              <span>Marcar consolidado</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWeakPoint(entry)}
                          aria-label={`Excluir ponto fraco ${entry.concept}`}
                          className="p-1.5 rounded-lg border border-[#E5E0D8] dark:border-[#36332E] text-[#44403C] dark:text-[#C2BCB2] hover:text-[#B91C1C] dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dices,
  HelpCircle,
  Play,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  buildMergedWeakPointBank,
  computeProgressMetrics,
  type MergedWeakPointItem,
} from '../lib/progressAnalytics';
import { formatShortDate } from '../lib/storage';
import type {
  TrainingSession,
  WeakPointBankEntry,
  WeakPointTrigger,
} from '../types/trainer';

interface ProgressViewProps {
  usernameKey: string;
  sessions: TrainingSession[];
  weakPointsBank: WeakPointBankEntry[];
  onStartWeakPointsTraining: (
    discipline: string,
    items: MergedWeakPointItem[]
  ) => void;
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
        colorClass: 'text-[#B45309] dark:text-[#FBBF24]',
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
  onStartWeakPointsTraining,
  onToggleWeakPointStatus,
  onDeleteWeakPoint,
  onOpenSession,
  onStartNewTraining,
}: ProgressViewProps) {
  const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('');
  const [bankFilter, setBankFilter] = useState<BankFilter>('active');
  const [bankQuery, setBankQuery] = useState('');
  const [selectedWpIds, setSelectedWpIds] = useState<string[]>([]);

  const metrics = useMemo(() => computeProgressMetrics(sessions), [sessions]);
  const mergedBank = useMemo(
    () => buildMergedWeakPointBank(usernameKey, weakPointsBank, sessions),
    [usernameKey, weakPointsBank, sessions]
  );

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
        (i) => i.lastTrigger === 'lucky_guess' || i.lastTrigger === 'unsure_hit' || i.guessCount > 0
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
      <section className="max-w-[820px] mx-auto px-4 sm:px-8 py-14">
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-8 sm:p-12 text-center space-y-4">
          <h1 className="font-display text-2xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
            Progresso e Banco de Pontos Fracos
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A8A29E] max-w-md mx-auto leading-relaxed">
            Ainda não há registros avaliados na conta{' '}
            <span className="font-mono text-[#18181B] dark:text-[#F4F2ED]">@{usernameKey}</span>.
            Ao treinar, suas taxas de retenção real, filtro de chutes, andamento por disciplina e banco de erros aparecerão aqui.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartNewTraining}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-sm font-semibold hover:bg-[#92400E] transition-colors cursor-pointer"
            >
              <span>Começar Primeiro Treino</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10">
      <div className="pb-5 border-b border-[#E5E2DC] dark:border-[#2E2C28]">
        <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
          Registros na nuvem · @{usernameKey}
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
          Progresso, Conteúdo Concluído e Banco de Erros
        </h1>
        <p className="mt-2 text-sm text-[#57534E] dark:text-[#A8A29E] max-w-3xl leading-relaxed">
          Acompanhe sua retenção real separando conhecimento consolidado de acertos por chute, veja o conteúdo já concluído por disciplina e dispare treinos sob demanda sobre seus pontos fracos.
        </p>
      </div>

      {/* 1. KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Sessões Concluídas
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
            {metrics.completedSessionsCount}
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
            {metrics.activeSessionsCount} em andamento · {metrics.totalTopicsConsolidated} tópicos
          </p>
        </div>

        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Retenção Real (Sem Chutes)
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#047857] dark:text-[#34D399]">
            {metrics.totalQuestionsEvaluated > 0 ? `${metrics.realRetentionPct}%` : '—'}
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
            Em {metrics.totalQuestionsEvaluated} questões avaliadas
          </p>
        </div>

        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Taxa Bruta de Acertos
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#18181B] dark:text-[#F4F2ED]">
            {metrics.totalQuestionsEvaluated > 0 ? `${metrics.rawAccuracyPct}%` : '—'}
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
            {metrics.rawCorrectCount} acertos totais · {metrics.unsureHitsCount} com dúvida
          </p>
        </div>

        <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-5 space-y-1">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Filtro de Chutes
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B]">
            {metrics.guessHitsCount}
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
            {metrics.guessShareOfCorrectPct}% dos acertos · {metrics.confidentErrorsCount} erros com certeza
          </p>
        </div>
      </div>

      {/* 2. Completed Sessions Syllabus Progress by Discipline */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              Andamento por Disciplina (Sessões Concluídas)
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              Tópicos e subtópicos consolidados exclusivamente a partir dos treinos finalizados.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
            {metrics.disciplineSummaries.length} disciplina(s)
          </span>
        </div>

        {metrics.disciplineSummaries.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-6 text-sm text-[#57534E] dark:text-[#A8A29E] flex flex-wrap items-center justify-between gap-4">
            <p>
              Nenhuma sessão foi concluída até a árvore final ainda. Conclua um treino ativo para registrar o andamento programático por disciplina aqui.
            </p>
            <button
              type="button"
              onClick={onStartNewTraining}
              className="px-4 py-2 rounded-lg bg-[#18181B] dark:bg-[#F4F2ED] text-[#FAF9F6] dark:text-[#111110] text-xs font-semibold cursor-pointer"
            >
              Iniciar Treino
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.disciplineSummaries.map((disc) => {
              const isExpanded = Boolean(expandedDisciplines[disc.discipline]);
              return (
                <article
                  key={disc.discipline}
                  className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#F4F2ED] truncate">
                        {disc.discipline}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#57534E] dark:text-[#A8A29E]">
                        {disc.completedSessions} sessão(ões) concluída(s) · {disc.topicsCovered.length} tópicos · Último em {formatShortDate(disc.lastStudiedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-base font-semibold tabular-nums text-[#047857] dark:text-[#34D399]">
                        {disc.realRetentionPct}% real
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E]">
                        {disc.rawAccuracyPct}% bruto · {disc.guessHitsCount} chutes
                      </p>
                    </div>
                  </div>

                  {/* Clean progress bar showing real mastery vs raw */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-[#F3F1EC] dark:bg-[#21201D] overflow-hidden relative">
                      <div
                        className="h-full bg-[#B45309]/35 dark:bg-[#F59E0B]/35 absolute left-0 top-0"
                        style={{ width: `${Math.min(100, disc.rawAccuracyPct)}%` }}
                      />
                      <div
                        className="h-full bg-[#047857] dark:bg-[#34D399] absolute left-0 top-0"
                        style={{ width: `${Math.min(100, disc.realRetentionPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleDisciplineExpand(disc.discipline)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED] cursor-pointer"
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
                      className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 cursor-pointer"
                    >
                      Filtrar erros desta disciplina
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#2E2C28] space-y-4">
                      {disc.topicsCovered.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                            Tópicos estudados nas sessões concluídas
                          </p>
                          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                            {disc.topicsCovered.slice(0, 24).join(' · ')}
                            {disc.topicsCovered.length > 24 &&
                              ` · +${disc.topicsCovered.length - 24} tópicos`}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-[#18181B] dark:text-[#F4F2ED]">
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
                                className="text-left text-[#18181B] dark:text-[#F4F2ED] hover:text-[#B45309] dark:hover:text-[#F59E0B] underline underline-offset-2 truncate cursor-pointer"
                              >
                                {s.title}
                              </button>
                              <span className="font-mono tabular-nums text-[#57534E] dark:text-[#A8A29E] shrink-0">
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

      {/* 3. Cross-Session Weak-Point Bank by Discipline */}
      <section id="weak-points-bank-section" className="space-y-5 pt-4 border-t border-[#E5E2DC] dark:border-[#2E2C28]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#18181B] dark:text-[#F4F2ED]">
              Banco de Erros e Chutes por Disciplina
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
              Conceitos errados ou acertados no chute ficam salvos aqui para reteste sob demanda até você acertá-los com certeza.
            </p>
          </div>

          <button
            type="button"
            disabled={trainablePool.length === 0}
            onClick={() =>
              onStartWeakPointsTraining(targetTrainingDiscipline, trainablePool)
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#B45309] dark:bg-[#D97706] text-white text-xs sm:text-sm font-semibold hover:bg-[#92400E] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>
              {selectedWpIds.length > 0
                ? `Treinar ${selectedWpIds.length} Selecionado(s)`
                : `Treinar Pontos Fracos (${trainablePool.length})`}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filtrar banco de erros por disciplina"
              value={selectedDiscipline}
              onChange={(e) => {
                setSelectedDiscipline(e.target.value);
                setSelectedWpIds([]);
              }}
              className="rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#1A1917] px-3 py-2 text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none"
            >
              <option value="">Todas as disciplinas ({mergedBank.length})</option>
              {bankDisciplines.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name} ({d.active} ativos / {d.total})
                </option>
              ))}
            </select>

            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F3F1EC] dark:bg-[#21201D] border border-[#E5E2DC] dark:border-[#2E2C28]">
              {(
                [
                  ['active', `Ativos (${counts.active})`],
                  ['guesses', `Chutes/Dúvida (${counts.guesses})`],
                  ['mastered', `Sanados (${counts.mastered})`],
                  ['all', `Todos (${counts.all})`],
                ] as Array<[BankFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBankFilter(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    bankFilter === key
                      ? 'bg-white dark:bg-[#111110] text-[#18181B] dark:text-[#F4F2ED] shadow-xs'
                      : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#18181B] dark:hover:text-[#F4F2ED]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
              placeholder="Buscar conceito..."
              className="pl-8 pr-3 py-2 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-white dark:bg-[#1A1917] text-xs text-[#18181B] dark:text-[#F4F2ED] placeholder:text-[#78716C] focus:border-[#B45309] dark:focus:border-[#F59E0B] focus:outline-none w-56"
            />
          </div>
        </div>

        {filteredBank.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1917] border border-[#E5E2DC] dark:border-[#2E2C28] rounded-xl p-8 text-center text-sm text-[#57534E] dark:text-[#A8A29E]">
            Nenhum ponto fraco encontrado neste filtro.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredBank.map((entry) => {
              const info = getTriggerInfo(entry.status, entry.lastTrigger);
              const StatusIcon = info.Icon;
              const isSelected = selectedWpIds.includes(entry.id);

              return (
                <article
                  key={entry.id}
                  className={`bg-white dark:bg-[#1A1917] border rounded-xl p-4 sm:p-5 flex flex-wrap items-start justify-between gap-4 transition-colors ${
                    isSelected
                      ? 'border-[#B45309] dark:border-[#F59E0B]'
                      : 'border-[#E5E2DC] dark:border-[#2E2C28]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleWpSelection(entry.id)}
                      aria-label={`Selecionar ${entry.concept} para treino`}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#B45309] dark:bg-[#D97706] border-[#B45309] dark:border-[#D97706] text-white'
                          : 'border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#141311]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                    </button>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E]">
                        <span className={`inline-flex items-center gap-1 font-semibold ${info.colorClass}`}>
                          <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{info.label}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#18181B] dark:text-[#F4F2ED]">
                          {entry.discipline}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {entry.errorCount} erro(s) · {entry.guessCount} chute(s)/dúvida
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[260px]">
                          {entry.sourceSessionTitle}
                        </span>
                      </div>

                      <h3 className="font-display text-base font-semibold text-[#18181B] dark:text-[#F4F2ED]">
                        {entry.concept}
                      </h3>

                      {entry.definition && (
                        <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                          {entry.definition}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!entry.isLegacyFromSession && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleWeakPointStatus(entry)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6D3CD] dark:border-[#3A3732] bg-[#FAF9F6] dark:bg-[#141311] text-xs font-medium text-[#18181B] dark:text-[#F4F2ED] hover:border-[#18181B] dark:hover:border-[#F4F2ED] cursor-pointer"
                        >
                          {entry.status === 'mastered' ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Reativar</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                              <span>Marcar sanado</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWeakPoint(entry)}
                          aria-label={`Excluir ponto fraco ${entry.concept}`}
                          className="p-1.5 rounded-lg border border-[#E5E2DC] dark:border-[#2E2C28] text-[#57534E] dark:text-[#A8A29E] hover:text-[#B91C1C] dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 cursor-pointer"
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

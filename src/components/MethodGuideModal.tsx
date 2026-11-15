import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  Dices,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Layers,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';

interface MethodGuideModalProps {
  isOpen: boolean;
  usernameKey?: string;
  onClose: () => void;
  onStartTour: () => void;
}

interface PracticalStep {
  number: string;
  title: string;
  summary: string;
  howTo: string;
  practicalTip: string;
}

const PRACTICAL_STEPS: PracticalStep[] = [
  {
    number: '01',
    title: 'Escolha a fonte ideal para o seu objetivo',
    summary:
      'Você pode estudar pelos materiais organizados da Base de Estudos, por um tema livre do edital ou colando seu próprio resumo.',
    howTo:
      'Na aba Base de Estudos (Concursos), filtre por disciplina e selecione até 10 leis secas ou apostilas. Se preferir digitar um tópico em Tema Livre, o sistema consulta os materiais correspondentes automaticamente e completa o que faltar.',
    practicalTip:
      'Quando estiver estudando legislação seca ou normas recentes, selecione os arquivos exatos na Base de Estudos.',
  },
  {
    number: '02',
    title: 'Decida entre Aula Prévia ou Direto às Questões',
    summary:
      'Antes da Rodada 1, você escolhe se prefere uma revisão rápida dos conceitos ou ir direto para a recordação ativa.',
    howTo:
      'Escolha a Aula Prévia concisa quando o assunto for inédito, muito técnico ou estiver parado há semanas. Escolha ir direto ao Treino Ativo quando já tiver estudado a teoria e quiser medir o que lembra sem consulta.',
    practicalTip:
      'Regra simples: assunto novo pede Aula Prévia; assunto já visto vai direto para a Rodada 1.',
  },
  {
    number: '03',
    title: 'Responda primeiro e marque sua Confiança real',
    summary:
      'Cada rodada traz questões equilibradas entre múltipla escolha (A–E) e respostas abertas, com dificuldade crescente até a Rodada 10.',
    howTo:
      'Antes de confirmar suas respostas, marque com sinceridade se respondeu com Certeza, Dúvida ou Chute. Você também pode usar os atalhos 1 a 5 para marcar alternativas e C, D ou X para confiança.',
    practicalTip:
      'Chutar e acertar sem marcar cria falsa segurança. Ao marcar Chute, você protege seu estudo e garante revisão antes da prova.',
  },
  {
    number: '04',
    title: 'Converta erros e chutes em Retestes e Sínteses',
    summary:
      'Tudo o que você erra — ou acerta no chute — volta na rodada seguinte como questão aberta para treinar a lembrança ativa.',
    howTo:
      'Leia a correção objetiva de cada questão e expanda a fundamentação completa quando quiser aprofundar. Após as rodadas 3, 6 e 9 há uma Síntese Estratégica; com 2 ou mais erros na Rodada 10 abre-se Prorrogação até limpar as pendências.',
    practicalTip:
      'Nos retestes em formato aberto, responda com suas próprias palavras sem copiar o texto.',
  },
  {
    number: '05',
    title: 'Acompanhe sua Retenção Real e zere Pontos Fracos',
    summary:
      'Seus resultados continuam úteis depois que a sessão termina: vão para o histórico e para o Banco de Erros da sua conta.',
    howTo:
      'Abra a aba Progresso para comparar sua Taxa Bruta com a Retenção Real (sem chutes), acompanhar a evolução por disciplina e lançar treinos sob demanda focados apenas nos erros ativos de uma matéria.',
    practicalTip:
      'Separe um bloco curto no fim da semana para revisar a disciplina com menor retenção na aba Progresso.',
  },
];

export function MethodGuideModal({
  isOpen,
  usernameKey,
  onClose,
  onStartTour,
}: MethodGuideModalProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const activeStep = PRACTICAL_STEPS[selectedStepIndex];

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="method-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E0D8] dark:border-[#36332E] bg-white dark:bg-[#22201D] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
              Guia do Estudante{usernameKey ? ` · @${usernameKey}` : ''}
            </p>
            <h2
              id="method-guide-title"
              className="font-display text-xl sm:text-2xl font-semibold text-[#18181B] dark:text-[#EFECE6]"
            >
              Como funciona o método de recordação ativa
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia do método"
            className="p-1.5 rounded-lg text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1">
          <p className="reading-measure text-[#44403C] dark:text-[#D0CAC0]">
            O Caderno Ativo substitui a leitura passiva por rodadas progressivas de recuperação da memória, marcação sincera de confiança e reteste imediato de erros — ancorado nos materiais e resumos organizados da sua base de estudos.
          </p>

          {/* Method Overview & Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-5 bg-[#F5F2EC] dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 flex flex-col justify-between gap-5">
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  O que é o método
                </p>
                <h3 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Recordação ativa com correção de rota em tempo real
                </h3>
                <p className="text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                  Em vez de reler páginas esperando que o conteúdo fixe, você recupera conceitos da memória em sessões de até 10 rodadas crescentes, separando domínio real de acertos por sorte.
                </p>
              </div>

              <div className="pt-4 border-t border-[#E5E0D8] dark:border-[#36332E] grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-mono text-base font-semibold text-[#18181B] dark:text-[#EFECE6] tabular-nums">
                    10 rodadas
                  </p>
                  <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                    Do básico ao caso complexo
                  </p>
                </div>
                <div>
                  <p className="font-mono text-base font-semibold text-[#18181B] dark:text-[#EFECE6] tabular-nums">
                    3 · 6 · 9
                  </p>
                  <p className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                    Sínteses estratégicas
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Por que muda o resultado
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Estudo passivo tradicional vs. Caderno Ativo
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] space-y-2">
                  <p className="text-sm font-semibold text-[#44403C] dark:text-[#C2BCB2]">
                    Leitura passiva e grifos
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                    <li>• Você reconhece o texto enquanto lê e sente que aprendeu.</li>
                    <li>• Acertos por intuição em questões parecem conhecimento firme.</li>
                    <li>• Erros ficam soltos sem plano claro do que retestar depois.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-[#F5F2EC] dark:bg-[#282522] border border-[#D6D0C6] dark:border-[#45413B] space-y-2">
                  <p className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    Ciclo do Caderno Ativo
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#18181B] dark:text-[#EFECE6] leading-relaxed">
                    <li>• Obriga a memória a formular a resposta antes de ver o gabarito.</li>
                    <li>• Separa acertos com Certeza de acertos por Dúvida ou Chute.</li>
                    <li>• Transforma toda lacuna em reteste aberto e salva no Banco de Erros.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-[#44403C] dark:text-[#C2BCB2]">
                <Target className="w-4 h-4" aria-hidden="true" />
                <span className="font-mono text-xs tabular-nums">01</span>
              </div>
              <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Retenção sem maquiagem
              </h3>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                O filtro de chutes impede que acertos por sorte inflam sua confiança e mostra seu domínio real.
              </p>
            </div>

            <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-[#44403C] dark:text-[#C2BCB2]">
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
                <span className="font-mono text-xs tabular-nums">02</span>
              </div>
              <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Ancorado na sua base
              </h3>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                As questões priorizam leis e resumos da sua base de estudos antes de complementar com pesquisa.
              </p>
            </div>

            <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-[#44403C] dark:text-[#C2BCB2]">
                <Layers className="w-4 h-4" aria-hidden="true" />
                <span className="font-mono text-xs tabular-nums">03</span>
              </div>
              <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Banco de erros por matéria
              </h3>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                Cada conceito errado ou chutado fica catalogado por disciplina para revisar sob demanda.
              </p>
            </div>

            <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-[#44403C] dark:text-[#C2BCB2]">
                <GitBranch className="w-4 h-4" aria-hidden="true" />
                <span className="font-mono text-xs tabular-nums">04</span>
              </div>
              <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                Mapas prontos ao concluir
              </h3>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                Você encerra cada sessão com Sínteses Estratégicas e uma árvore organizada na Biblioteca.
              </p>
            </div>
          </div>

          {/* 5-step Practical Walkthrough */}
          <div className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E0D8] dark:border-[#36332E] pb-4">
              <div>
                <p className="text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  Roteiro prático
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  Como conduzir um treino em 5 passos
                </h3>
              </div>
              <span className="text-xs text-[#44403C] dark:text-[#C2BCB2]">
                Selecione uma etapa
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div
                className="lg:col-span-5 space-y-2"
                role="tablist"
                aria-label="Etapas práticas do método"
              >
                {PRACTICAL_STEPS.map((step, idx) => {
                  const active = idx === selectedStepIndex;
                  return (
                    <button
                      key={step.number}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedStepIndex(idx)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors flex items-start gap-3 cursor-pointer ${
                        active
                          ? 'bg-amber-50/70 dark:bg-[#282522] border-[#B45309] dark:border-[#F59E0B] text-[#18181B] dark:text-[#EFECE6]'
                          : 'bg-[#FAF8F5] dark:bg-[#1C1B19] border-[#E5E0D8] dark:border-[#36332E] text-[#44403C] dark:text-[#C2BCB2] hover:text-[#18181B] dark:hover:text-[#EFECE6]'
                      }`}
                    >
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums mt-0.5 shrink-0 ${
                          active
                            ? 'text-[#B45309] dark:text-[#F59E0B]'
                            : 'text-[#57534E] dark:text-[#A8A29E]'
                        }`}
                      >
                        {step.number}
                      </span>
                      <span className="text-sm font-medium leading-snug">{step.title}</span>
                    </button>
                  );
                })}
              </div>

              <div
                role="tabpanel"
                className="lg:col-span-7 bg-[#F5F2EC] dark:bg-[#1C1B19] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-3.5"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-[#44403C] dark:text-[#C2BCB2]">
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  <span className="tabular-nums">Passo {activeStep.number} de 05</span>
                </div>
                <h4 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6]">
                  {activeStep.title}
                </h4>
                <p className="text-sm font-medium text-[#18181B] dark:text-[#EFECE6] leading-relaxed">
                  {activeStep.summary}
                </p>
                <p className="text-sm text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                  {activeStep.howTo}
                </p>
                <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] space-y-1">
                  <p className="text-xs font-semibold text-[#18181B] dark:text-[#EFECE6]">
                    Dica prática
                  </p>
                  <p className="text-xs text-[#44403C] dark:text-[#D0CAC0] leading-relaxed">
                    {activeStep.practicalTip}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Confidence Calibration Reference */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#047857] dark:text-[#34D399]">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Certeza</span>
              </div>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Acerto:</strong> conta como Retenção Real.{' '}
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Erro:</strong> alerta de falso domínio e sobe como prioridade.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#18181B] dark:text-[#EFECE6]">
                <HelpCircle className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B]" aria-hidden="true" />
                <span>Dúvida</span>
              </div>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Acerto:</strong> entra no banco para reforço futuro.{' '}
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Erro:</strong> vira reteste aberto na próxima rodada.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#B91C1C] dark:text-[#F87171]">
                <Dices className="w-4 h-4" aria-hidden="true" />
                <span>Chute</span>
              </div>
              <p className="text-xs text-[#44403C] dark:text-[#C2BCB2] leading-relaxed">
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Acerto:</strong> cai no Filtro de Chutes e volta em reteste aberto.{' '}
                <strong className="text-[#18181B] dark:text-[#EFECE6]">Erro:</strong> vai direto ao Banco de Erros.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E5E0D8] dark:border-[#36332E] bg-[#F5F2EC] dark:bg-[#22201D] flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#44403C] dark:text-[#C2BCB2]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
            <span>Você pode reabrir este guia quando quiser na barra superior</span>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D6D0C6] dark:border-[#45413B] bg-white dark:bg-[#1C1B19] text-xs font-semibold text-[#18181B] dark:text-[#EFECE6] hover:border-[#B45309] dark:hover:border-[#F59E0B] transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={onStartTour}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B45309] dark:bg-[#F59E0B] text-[#FAF8F5] dark:text-[#141312] text-xs font-semibold hover:bg-[#92400E] dark:hover:bg-[#FBBF24] transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fazer tour guiado pela tela</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

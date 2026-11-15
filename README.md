# Caderno Ativo — Treinador de Revisão

Aplicativo web full-stack de treino ativo e revisão guiada em 10 rodadas, com integração primária à base de conhecimento [`leoalvespak-alt/rota-base-conhecimento-estudos`](https://github.com/leoalvespak-alt/rota-base-conhecimento-estudos), complemento via busca web e persistência em nuvem no Cloud Firestore.

## Principais Recursos

- **Método de Treino Ativo (10 Rodadas + Prorrogação)**:
  - Escolha inicial obrigatória entre **Aula Concisa Preparatória** ou **Direto para o Treino Ativo**.
  - Questões mistas (resposta aberta e múltipla escolha A–E) com progressão de dificuldade, persistência em pontos fracos e **Sínteses Estratégicas** após as rodadas 3, 6 e 9.
  - Encerramento com **Síntese Ultracompacta Final** em árvore hierárquica ASCII/Unicode e **Biblioteca de Sínteses**.
- **Base de Conhecimento Primária (Git + Web)**:
  - Aba **Base Git (Concursos)** com busca, filtro por disciplina, prévia de documentos e seleção de até 10 arquivos de `rota-base-conhecimento-estudos`.
  - Consulta automática ao repositório Git mesmo em **Tema Livre**, com busca web complementar apenas quando necessário.
- **Perfis na Nuvem e Tema**:
  - Login simples sem senha por `@usuario` salvo no Cloud Firestore.
  - Alternância de tema **Sistema / Claro / Noturno**.

## Requisitos e Configuração

### Variáveis de Ambiente

Copie `.env.example` para `.env` (ou configure nos **Secrets** do Google AI Studio):

```env
GEMINI_API_KEY="sua-chave-gemini"
APP_URL="http://localhost:3000"
```

### Scripts

```bash
npm install
npm run dev      # Inicia Express + Vite na porta 3000
npm run lint     # Verificação TypeScript (tsc --noEmit)
npm run build    # Build de produção do frontend (dist/)
```

### Firebase / Firestore

A configuração pública do projeto web está em `firebase-applet-config.json` e as regras de segurança em `firestore.rules` (com esquema em `firebase-blueprint.json`).

# Especificação de Segurança do Firestore (`security_spec.md`)

## 1. Invariantes de Dados

1. Nenhum documento em `/users/{usernameKey}` pode ser listado em massa (`allow list: if false` em `/users`).
2. Todo `usernameKey` deve corresponder estritamente a `^[a-z0-9._-]{3,32}$`.
3. Toda sessão em `/users/{usernameKey}/sessions/{sessionId}` exige existência prévia de `/users/{usernameKey}` na criação (`exists(...)`) e `ownerUsername == usernameKey` imutável.
4. Campos temporais (`createdAt`, `updatedAt`, `lastActiveAt`) devem corresponder estritamente a `request.time`.
5. `createdAt`, `id` e `ownerUsername` são imutáveis após a criação.
6. Sessões em estado terminal (`status == 'completed'`) não podem sofrer alterações posteriores (`existing().status != 'completed'`).
7. Tamanhos de strings e arrays são limitados para impedir ataques de exaustão de armazenamento/banda ("Denial of Wallet").

## 2. "Dirty Dozen" Payloads Adversariais (Todos devem falhar com `PERMISSION_DENIED`)

1. `LIST /users`: tentativa de enumerar todos os nomes de usuário cadastrados.
2. `CREATE /users/ab`: `usernameKey` abaixo do mínimo de 3 caracteres.
3. `CREATE /users/User With Spaces`: `usernameKey` fora do padrão regex permitido.
4. `CREATE /users/ana` com campo extra `{ isAdmin: true }`: bloqueado por `keys().hasOnly(...)`.
5. `CREATE /users/ana` com `createdAt` forjado no cliente (diferente de `request.time`).
6. `UPDATE /users/ana` alterando `usernameKey` ou `createdAt` (violação de imutabilidade).
7. `CREATE /users/fantasma/sessions/s1` sem perfil existente em `/users/fantasma`: bloqueado por `exists(...)`.
8. `CREATE /users/ana/sessions/s1` com `ownerUsername: "bruno"`: violação de vínculo relacional.
9. `CREATE /users/ana/sessions/../../escape`: `sessionId` fora do padrão `^[a-zA-Z0-9_-]+$`.
10. `CREATE /users/ana/sessions/s1` com `sourceContent` de 50.000 caracteres (> 20.000): bloqueado por limite de tamanho.
11. `CREATE /users/ana/sessions/s1` com `status: "hacked"` ou `rounds` com > 30 itens: bloqueado por enum e limite de array.
12. `UPDATE /users/ana/sessions/s1` quando `existing().status == "completed"`: bloqueado por trava de estado terminal.

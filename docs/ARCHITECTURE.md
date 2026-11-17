# HelpBar Desktop — Arquitetura e Planejamento

> **Status:** Etapas 1–10 implementadas (janela, estados, dashboard, calendário/agenda, tarefas/notas, lembretes, tray, autostart, atalho global, posicionamento/blend, persistência SQLite, testes, instalador NSIS e **ATLAS — assistente de voz 100% local**).  
> **Ambiente:** Node.js/npm e Rust/Cargo disponíveis; execução via `npm run tauri dev` (Tauri 2 + WebView2/Build Tools no Windows). O motor de voz exige CMake e libclang na máquina de build (ver §8).

## 1. Visão arquitetural

Aplicação desktop Windows 11 construída com **Tauri 2** (shell nativo, baixo consumo, acesso a APIs do sistema) e frontend **React + TypeScript + Tailwind**.

- **Camada nativa (Rust / Tauri):** ciclo de vida da janela, posicionamento, always-on-top, tray, atalhos globais, notificações, autostart, acesso a monitores e (futuramente) comandos para SQLite/plugins.
- **Camada de UI (React):** máquina de estados da barra (compacto/expandido/foco), módulos funcionais, componentes reutilizáveis, animações e temas.
- **Camada de domínio/dados:** tipos, serviços, hooks e repositórios (SQLite via plugin/comandos) desacoplados da UI.
- **Persistência:** SQLite local (etapa 8), com migrações versionadas e acesso mediado por serviços.

Princípios: separação de responsabilidades, sem "god files", UI sem lógica de persistência direta, dados reais (sem mocks como solução final), e estabilidade/baixo consumo.

## 2. Estrutura de pastas (planejada e inicial)

```text
HelpBar Desktop/
├─ .cargo/
│  └─ config.toml              # Flags de release do whisper.cpp (MSVC /O2)
├─ docs/
│  └─ ARCHITECTURE.md
├─ src-tauri/                  # Backend nativo (Tauri/Rust)
│  ├─ capabilities/
│  │  └─ default.json
│  ├─ icons/
│  ├─ src/
│  │  ├─ lib.rs                # Setup, posicionamento, comandos/estado
│  │  ├─ main.rs               # Entry point Windows
│  │  └─ atlas.rs              # ATLAS: modelos, cpal, whisper.cpp, wake word
│  ├─ build.rs
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ src/                        # Frontend React
│  ├─ assets/
│  ├─ components/
│  │  ├─ shell/                # Barra, estados, container flutuante
│  │  ├─ ui/                   # (futuro) primitives reutilizáveis
│  │  └─ layout/               # (futuro)
│  ├─ features/                # Módulos de produto
│  │  ├─ dashboard/
│  │  ├─ calendar/
│  │  ├─ tasks/
│  │  ├─ notes/
│  │  ├─ reminders/
│  │  ├─ atlas/                # Parser/executor, feedback, provider e UI da voz
│  │  └─ settings/
│  ├─ hooks/                   # Hooks (janela, tema, hotkeys, estado UI)
│  ├─ services/                # Integração Tauri commands / repositórios
│  ├─ types/                   # Tipos e contratos de domínio
│  ├─ styles/
│  │  └─ index.css
│  ├─ App.tsx
│  └─ main.tsx
├─ index.html
├─ package.json
├─ vitest.config.ts            # Testes unitários (Vitest)
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
└─ vite.config.ts
```

## 3. Modelo de janela e estados (planejado)

- **Janela única principal (Tauri):** sem decorações, transparente, `alwaysOnTop`, sem item na taskbar, tamanho/redimensionamento controlado por estado.
- **Compacto:** cápsula baixa (ancoragem padrão topo central), mostra hora/data/indicadores; interações hover/click.
- **Expandido:** painel flutuante ancorado/posicionado conforme configuração, com dashboard/módulos e navegação; animação de abrir/fechar.
- **Foco:** modo fixado (pinned) que desabilita recolhimento automático por blur/click-fora até ação explícita.
- **Posicionamento e visual (planejado):** movimentação/arraste opcional pela tela e entre monitores, com ancoragem/ponto configuráveis, e **modo visual compacto “blend”** (estilo discreto, melhor integrado à borda/tela).
- **Transições:** controladas por uma máquina de estado no frontend + comandos Tauri para ajustar tamanho/posição/foco da janela nativa (evitar gambiarras de CSS-only para geometria real).

## 4. Integração Windows 11 (roadmap técnico)

- **Always on Top / foco / click-fora:** APIs de janela Tauri + eventos de foco/blur; regras por estado (foco pinned ignora blur).
- **System Tray:** `tray-icon` (Tauri 2) com menu (abrir, fixar, configurações, sair) e minimização para tray sem encerrar processo.
- **Inicialização automática:** plugin/autostart nativo.
- **Atalho global:** plugin global-shortcut configurável.
- **Notificações nativas:** plugin de notificação do Tauri/Windows.
- **Multi-monitor/resolução e posicionamento avançado:** detecção de monitores/áreas úteis, reposicionamento em mudanças de escala/resolução, suporte a arraste/movimentação entre telas e ancoragens/pontos configuráveis (com opção para habilitar/desabilitar).

## 5. Persistência (etapa 8)

- **SQLite** com esquema versionado (migrations): tarefas, notas, lembretes e compromissos. Preferências de janela/visual continuam em `localStorage` (configuração do dispositivo).
- Implementado com **`tauri-plugin-sql`** (`sqlite`): migrations registradas no Rust (`src-tauri/src/lib.rs`) para `sqlite:helpbar.db`. O arquivo fica no diretório de configuração do app (`%APPDATA%\com.helpbar.desktop\helpbar.db`), isolado por usuário do Windows.
- Acesso mediado por `src/services/db.ts` (abertura única do banco) e `src/services/repositories.ts` (um repositório por entidade, com mapeamento de linhas e UPSERT). A UI nunca acessa SQL diretamente.
- **`src/store/AppDataContext.tsx`** carrega tudo na inicialização e persiste cada mutação de forma otimista; fora do Tauri (browser puro) ou em falha do banco, o app continua em memória e o status aparece em Configurações.
- **`tauri-plugin-single-instance`** garante uma única instância do app, evitando múltiplos escritores no mesmo arquivo SQLite; ao abrir novamente, a janela existente é exibida e expandida.
- Todas as coleções foram unificadas: compromissos do Calendário e do dashboard usam a mesma fonte; a mini agenda destaca dias com eventos.

## 5.1 ATLAS — voz local (etapa 10)

- **Nada de nuvem nem chaves de API:** o reconhecimento de fala roda no processo do app via **`whisper-rs` / whisper.cpp** (`src-tauri/src/atlas.rs`). Nem áudio nem texto são enviados para servidores.
- **Modelos sob demanda:** `ggml-tiny-q5_1.bin` (32,1 MB, wake word) e `ggml-base-q5_1.bin` (59,7 MB, comandos), baixados do repositório oficial `ggerganov/whisper.cpp` com verificação de tamanho **e SHA-256**, gravados em `%APPDATA%\com.helpbar.desktop\atlas\models`. Não são embutidos no instalador.
- **Microfone (`cpal`):** captura no dispositivo de entrada padrão, conversão para **16 kHz mono f32** (mistura de canais + reamostragem linear) antes de alimentar o whisper. A captura só fica ativa enquanto há PTT ou wake word ligado; o microfone é liberado quando não há uso.
- **Push-to-talk:** atalho global configurável (padrão `Control+Alt+Space`, pressionar e segurar) ou botão de microfone na barra compacta/na aba ATLAS. Ao soltar, a transcrição roda em thread separada e o resultado volta por evento `atlas:final`.
- **Wake word “ATLAS” (opcional, desligada por padrão):** worker em segundo plano usa o modelo pequeno em janelas de ~2,5 s com VAD por energia; só reage a tokens isolados `atlas`/`atlus` (com tolerância a variações comuns do STT) e exige fala com duração mínima, reduzindo falsos positivos. Ao ativar, emite `atlas:status` (`wake`) e captura o comando seguinte com o modelo base.
- **Eventos Tauri:** `atlas:status` (idle/listening/processing/wake), `atlas:final`, `atlas:error`, `atlas:model-progress` e `atlas:models-changed`. Comandos: `atlas_model_status`, `atlas_runtime_status`, `atlas_download_models`, `atlas_delete_models`, `atlas_start_ptt`, `atlas_stop_ptt`, `atlas_cancel`, `atlas_set_wake_word`.
- **Interpretação (`src/features/atlas`):** parser determinístico em PT-BR (`commandParser.ts`) com datas relativas/semana/explícitas e horários falados; executor (`executor.ts`) cria tarefa, nota, lembrete ou compromisso no mesmo `AppDataContext` usado pela UI, com **desfazer** da última ação. Navegação (“abrir calendário”) também é suportada.
- **Segurança:** a v1 só cria itens e navega; **comandos destrutivos são recusados** pelo parser. O feedback é visual (barra compacta + painel ATLAS + histórico) e sonoro (sons sintetizados, sem assets).
- **Desempenho:** no hardware de referência (i5-10500H), modelos q5_1 carregam em ~0,1–0,3 s e transcrevem a ~2× tempo real com 4–8 threads. O atalho/show da HelpBar e o atalho da ATLAS são registrados separadamente (`applyHoldShortcut`), com conflito explícito bloqueado.

## 6. Planejamento por etapas

1. **Janela flutuante + posicionamento topo central (concluída):** scaffold Tauri 2 + React/TS/Tailwind, janela transparente/sem borda/always-on-top, cálculo de posição central no monitor primário considerando scale factor.
2. **Estados compacto/expandido/foco (concluída):** máquina de estados, resize/ancoragem nativa, animações, recolhimento ao perder foco e modo fixado (pin).
3. **Dashboard UI (concluída):** saudação, calendário (mini visão mensal), próximos compromissos, tarefas do dia, lembretes e notas rápidas com interação local, navegação entre módulos.
4. **Calendário e agenda (concluída):** visões mensal, semanal e diária com criação/listagem e remoção de compromissos (persistidos em SQLite e compartilhados com o dashboard).
5. **Tarefas e notas (concluída):** CRUD completo de tarefas e notas, filtros (tarefas) e organização (todas/rápidas), com notas rápidas integradas ao dashboard e aos módulos (persistidas em SQLite).
6. **Lembretes e notificações (concluída):** agendamento com data/hora, disparo em background enquanto o app roda e integração com notificações nativas (Tauri Notification plugin).
7. **Integrações Windows 11, posicionamento avançado e visual (concluída):** System Tray, inicialização automática, atalho global, comportamento de foco/minimização robusto; **multi-monitor dinâmico**; **movimentação livre da HelpBar** pela tela e entre monitores com **configuração para habilitar/desabilitar**, ancoragens/pontos salvos; **modo visual compacto “blend”** (mais integrado à tela/borda, estilo discreto).
8. **SQLite e persistência (concluída):** schema/migrations, repositórios e ligação de todos os módulos a dados reais; instância única do app.
9. **Testes e instalador (concluída):** suíte Vitest para utilitários de data/hora, calendário e atalhos; ícones completos; bundle NSIS por usuário (sem UAC) com WebView2 bootstrapper e seleção de idioma.
10. **Assistente de Voz e IA “ATLAS” (concluída na v1 local):** comandos de voz em PT-BR para criar tarefas, notas, lembretes e compromissos, abrir módulos, ativação por **push-to-talk e wake word “ATLAS”**, STT local com whisper.cpp, modelos baixados sob demanda e verificados, feedback visual/sonoro, histórico e desfazer. Interpretação determinística (sem LLM/nuvem); ações destrutivas ficam de fora da v1.

## 7. Decisões técnicas

### Etapa 1
- **Tauri 2** para footprint reduzido e acesso nativo; janela configurada como cápsula flutuante (`decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`).
- **Posicionamento no Rust:** centralização horizontal no monitor primário com `PhysicalPosition` e margem superior escalada por DPI; reposicionamento tardio curto para estabilizar layout.
- **Frontend desacoplado:** `CompactBar` como componente de shell; indicadores iniciam em 0 até integração com dados reais (sem mocks persistentes).
- **Tailwind com tema escuro/translúcido** como base do visual (glassmorphism moderado) preparado para tema claro.

### Etapa 2
- **Comando nativo `set_shell_mode`:** resize lógico (compacto 560×72, expandido/foco 760×520) e recentralização top-center no Rust para manter geometria consistente entre estados.
- **Máquina de estados no frontend (`useShellMode`):** modos `compact | expanded | focus`, sincronizados com a janela via `invoke` e foco programático ao expandir.
- **Recolhimento automático:** ao perder foco, estado `expanded` retorna a `compact`; estado `focus` (pinned) permanece até ação do usuário.
- **UI modular:** `Shell` alterna `CompactBar`/`ExpandedPanel`; painel com navegação entre módulos e animação de entrada.

### Etapa 3
- **Dashboard (`features/dashboard`)** com saudação dinâmica, mini calendário mensal, e blocos funcionais (sessão atual) para próximos compromissos, tarefas do dia, lembretes e notas rápidas.
- **Interações locais (sem persistência ainda):** adicionar/alternar/remover itens nos componentes do dashboard; dados são temporários até integração com SQLite (concluída na Etapa 8).

### Etapa 4
- **Calendário/Agenda (`features/calendar`)** com alternância entre visões **mensal, semanal e diária**, navegação por período e botão “Hoje”.
- **CRUD funcional:** formulário com validação de data (DD/MM/AAAA) e hora (HH:MM), listagem por período/dia e remoção de compromissos. Data/hora reutilizam utilitários em `src/utils/datetime.ts`. Persistência e compartilhamento via store na Etapa 8.

### Etapa 5
- **Store compartilhada (`src/store/AppDataContext.tsx`)** para tarefas, notas, lembretes e compromissos, integrada ao dashboard e aos módulos dedicados; a partir da Etapa 8 carrega e persiste em SQLite.
- **Preferências (`src/store/PreferencesContext.tsx`)**: persistidas em `localStorage` (modo visual blend, permitir mover, ancoragem, autostart e atalho global) por serem configuração do dispositivo.
- **Tarefas (`features/tasks`)**: criar, listar, editar título, concluir/reabrir, remover, filtrar (todas/ativas/concluídas) e excluir todas as concluídas com confirmação.
- **Notas (`features/notes`)**: criar notas (título opcional), listar, editar e remover; integradas ao dashboard e persistidas em SQLite.

### Etapa 6
- **Lembretes (`features/reminders`)**: agendamento com data/hora validada, listagem e remoção; dashboard exibe próximos lembretes.
- **Agendador (`hooks/useReminderScheduler`)**: verificação periódica de lembretes vencidos não notificados e marcação como notificados.
- **Notificações nativas:** integração com `tauri-plugin-notification` (Rust/capability) e `@tauri-apps/plugin-notification` (frontend), com solicitação de permissão. Dependências adicionadas em `Cargo.toml`/`package.json` (requer `npm install` e rebuild).

### Etapa 7
- **`SettingsView` integrada**; modo visual "blend" **apenas no compacto** (barra colada no topo); system tray com menu (mostrar/configurações/ocultar/sair) e fechar janela minimiza para bandeja.
- **Movimentação do compacto** via arraste customizado (`hooks/useWindowDrag`) com salvamento de posição e ancoragem (topo central/esquerda/direita). No blend o arraste é **somente horizontal (eixo X)**, com Y travado no topo do monitor; no modo default X/Y livres.
- **Autostart** (`tauri-plugin-autostart`) e **atalho global configurável** (`tauri-plugin-global-shortcut`, com gravador de combinação em `features/settings/ShortcutRecorder`): o atalho mostra/expande a barra mesmo oculta e alterna ao pressionar novamente; o tray emite evento para abrir Configurações.
- **Sair do app:** fechar a janela apenas oculta para a bandeja; o encerramento completo fica em **Configurações → Aplicativo → Sair** (com confirmação, via comando Rust `quit_app`) e no menu do tray.

### Etapa 8
- **Plugin SQL:** `tauri-plugin-sql` com feature `sqlite` (Rust) e `@tauri-apps/plugin-sql` (frontend). Database `sqlite:helpbar.db` criado/migrado no primeiro `Database.load`.
- **Migration v1 (`create_initial_tables`):** tabelas `tasks`, `notes`, `reminders` e `events` com índices de ordenação (`created_at`, `updated_at`, `due_at`, `date/start_time`). Novas evoluções de schema devem ser adicionadas como migrations incrementais (nunca editar a v1 já aplicada).
- **Capabilities:** `sql:default` (load/select/close) + `sql:allow-execute` para escritas.
- **Repositórios:** `src/services/repositories.ts` expõe `list/save/remove` por entidade e `loadSnapshot()`; IDs são UUIDs gerados no frontend; UPSERT via `ON CONFLICT(id)`.
- **Store (`AppDataContext`):** carrega o snapshot na inicialização; mutações atualizam o estado imediatamente e persistem em seguida (otimista). Refs internos evitam closures desatualizadas. Expõe `storage: { ready, persistent, error }`, exibido em Configurações.
- **Fallback:** fora do Tauri ou se o banco falhar, o app segue em memória (modo temporário) sem quebrar a UI.
- **Instância única:** `tauri-plugin-single-instance` registrado primeiro; uma segunda execução exibe/expande a janela existente e evita escrita concorrente no SQLite.
- **Unificação:** `CalendarView` e `UpcomingEvents` usam `events` do store; `MiniCalendar` marca dias com compromissos.

### Etapa 9
- **Testes:** **Vitest** (`vitest.config.ts`, ambiente `node`) cobrindo `src/utils/datetime.ts`, `src/features/calendar/dateUtils.ts` e atalhos em `src/services/globalShortcut.ts`. Comandos: `npm test` (execução única) e `npm run test:watch`.
- **Correção revelada pelos testes:** `formatTimeInput` agora reconhece entradas com `:` (ex.: colar `9:30` gera `09:30` em vez de `93:0`).
- **Ícones:** conjunto completo gerado a partir de `src-tauri/icons/source.png` (via `npx tauri icon`) — `icon.ico` multi-resolução (16/24/32/48/64/256), PNGs 32/64/128/128@2x, `icon.png`/`icon.icns` e logos Square/Store. Pastas móveis (`android`/`ios`) removidas por serem desnecessárias no Windows.
- **Bundle Windows (`tauri.conf.json`):** `targets: ["nsis"]`, publisher/copyright/categoria/descrições, instalação **por usuário** (`currentUser`, sem UAC), `startMenuFolder: "HelpBar"`, ícone do instalador, idiomas **PortugueseBR/English** com seletor, e WebView2 via `downloadBootstrapper` silencioso (instala o runtime apenas se ausente).
- **Artefatos:** `src-tauri/target/release/helpbar-desktop.exe` e instalador `src-tauri/target/release/bundle/nsis/HelpBar Desktop_0.1.0_x64-setup.exe` (~3,7 MB).
- **Observação:** MSI/WiX não é gerado por padrão; para adicioná-lo, incluir `"msi"` em `bundle.targets` (requer WiX, baixado automaticamente pelo Tauri no build).

### Etapa 10
- **Escolha do STT:** `whisper-rs` 0.16 (whisper.cpp nativo) venceu as alternativas avaliadas: Windows SpeechRecognition exige ditado na nuvem; Vosk small-pt transcreve bem, mas o grammar de wake word gerava falsos positivos em frases comuns; faster-whisper CPU era ~3,5–7× mais lento na máquina de referência. Com os flags de release corretos, whisper-rs q5_1 atinge ~2× tempo real.
- **Build do whisper.cpp:** o crate `cmake` 0.1.58 sobrescreve `CMAKE_CXX_FLAGS_RELEASE` com o gerador Visual Studio, removendo `/O2` (queda para ~0,2× tempo real). `.cargo/config.toml` reaplica `/O2 /Ob2 /DNDEBUG` para C e C++. `WHISPER_DONT_GENERATE_BINDINGS=1` não é utilizável no Windows (bindings empacotados são Linux-specific), portanto **libclang é obrigatório** no build.
- **Modelos:** baixados sob demanda do Hugging Face oficial, nunca no instalador; `tiny` para wake e `base` para comandos. SHA-256 + tamanho são validados antes de renomear o `.part` para o arquivo final.
- **Privacidade por padrão:** wake word desligada (consome microfone/CPU continuamente); push-to-talk ligado por padrão assim que os modelos existem. O microfone é desligado em idle, e o app encerra os workers no `RunEvent::ExitRequested`.
- **Parser em vez de LLM:** interpretação determinística em PT-BR mantém o app offline, previsível e auditável; cobre criação e navegação. Ações destrutivas por voz foram deliberadamente excluídas da v1, e cada criação oferece **Desfazer**.
- **Atalhos:** o atalho de abrir a HelpBar e o de push-to-talk da ATLAS usam registradores independentes; `applyHoldShortcut` usa `Pressed`/`Released` para gravar enquanto a tecla está segura e bloqueia combinações idênticas.
- **Testes:** suíte ampliada para 54 testes (22 do parser, 4 do executor, 7 de atalhos, além dos de datas); teste nativo ignorado por padrão valida o STT com um WAV pt-BR real.

## 8. Como executar (quando o toolchain estiver disponível)

Pré-requisitos: Rust (cargo/rustc), MSVC Build Tools/WebView2, Node.js/npm, **CMake** (para whisper.cpp) e **libclang** (para os bindings do whisper-rs).

```powershell
npm install
npm run tauri dev
```

**As variáveis de toolchain estão declaradas em `.cargo/config.toml`** (seção `[env]`), não apenas no ambiente do shell. O Cargo as injeta direto no build script, então o build funciona mesmo que o terminal/IDE tenha sido aberto antes de elas existirem no registro do Windows:

| Variável | Valor nesta máquina | Por quê |
|---|---|---|
| `LIBCLANG_PATH` | `%APPDATA%\Python\Python313\site-packages\clang\native` | o `bindgen` do `whisper-rs-sys` precisa do `libclang.dll` para gerar os bindings |
| `CMAKE` | `C:\Users\ADM\Tools\cmake-3.31.6-windows-x86_64\bin\cmake.exe` | o crate `cmake` aceita `CMAKE` com o caminho do executável, evitando depender do `PATH`; o cmake foi copiado de `Temp` para um local estável |

Ambas usam `force = false`: um valor já definido pelo usuário tem precedência. **Ao trocar de máquina, ajuste os dois caminhos em `.cargo/config.toml`** (o cmake portátil pode ficar em qualquer pasta, desde que `CMAKE` aponte para o `cmake.exe`). Se preferir não editar o arquivo, também é possível defini-las no shell:

```powershell
$env:LIBCLANG_PATH = "$env:APPDATA\Python\Python313\site-packages\clang\native"
$env:CMAKE = "C:\caminho\para\cmake\bin\cmake.exe"
```

Build do instalador:

```powershell
npm test
npm run tauri build
```

> Se o `cargo` não estiver no `PATH`, adicione `%USERPROFILE%\.cargo\bin` antes do build. O instalador NSIS fica em `src-tauri/target/release/bundle/nsis/`. Como fecha a janela para a bandeja, encerre o app pelo tray (**Sair**) antes de instalar uma nova versão.
>
> **Primeiro uso da ATLAS:** abra Configurações → ATLAS (ou o módulo ATLAS) e baixe os modelos de voz (~92 MB, uma única vez). O Windows pode pedir permissão de microfone na primeira gravação. Sem modelos, o botão de voz informa o que falta; o restante do aplicativo funciona normalmente.

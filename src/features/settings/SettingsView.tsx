import { useEffect, useState } from "react";
import { Database, Download, Ear, Keyboard, Loader2, LogOut, Monitor, Move, Palette, Power, Settings as SettingsIcon, Sparkles, Volume2 } from "lucide-react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { usePreferences } from "../../store/PreferencesContext";
import { useAppData } from "../../store/AppDataContext";
import { databaseLocationLabel } from "../../services/db";
import { quitApp } from "../../services/appControl";
import { useAtlas } from "../atlas/AtlasContext";
import { ShortcutRecorder } from "./ShortcutRecorder";

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/10 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleButton({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs border transition-colors disabled:opacity-50 ${
        active
          ? "bg-sky-600/80 border-sky-500/50 text-white"
          : "bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
      }`}
    >
      {active ? "Ativado" : "Desativado"}
    </button>
  );
}

export function SettingsView() {
  const { prefs, setPrefs, shortcutError } = usePreferences();
  const { storage } = useAppData();
  const {
    models,
    downloading,
    progress,
    shortcutError: atlasShortcutError,
    installModels,
  } = useAtlas();
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartBusy, setAutoStartBusy] = useState(false);
  const [autoStartError, setAutoStartError] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const clearCustomPosition = () => setPrefs({ customPosition: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await isEnabled();
        if (cancelled) return;
        setAutoStart(enabled);
        if (enabled !== prefs.launchAtStartup) {
          setPrefs({ launchAtStartup: enabled });
        }
      } catch {
        // Outside Tauri
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs.launchAtStartup, setPrefs]);

  const toggleAutoStart = async () => {
    setAutoStartBusy(true);
    setAutoStartError(null);
    try {
      if (autoStart) {
        await disable();
        setAutoStart(false);
        setPrefs({ launchAtStartup: false });
      } else {
        await enable();
        setAutoStart(true);
        setPrefs({ launchAtStartup: true });
      }
    } catch (err) {
      setAutoStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutoStartBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><SettingsIcon size={18} /> Configurações</h2>
        <p className="text-xs text-zinc-400">Preferências de visual, posicionamento e integrações com o Windows.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Palette size={13} /> Visual</div>
        <Row title="Modo visual compacto (blend)" description="Barra miniatura mais discreta e integrada ao topo da tela (não altera o painel expandido).">
          <ToggleButton
            active={prefs.visualMode === "blend"}
            onClick={() => setPrefs({ visualMode: prefs.visualMode === "blend" ? "default" : "blend" })}
          />
        </Row>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Move size={13} /> Posicionamento</div>
        <Row title="Permitir mover a barra" description="Habilita a alça de arraste no modo compacto; a posição é salva.">
          <ToggleButton active={prefs.allowMove} onClick={() => setPrefs({ allowMove: !prefs.allowMove })} />
        </Row>
        {prefs.allowMove && (
          <div className="text-[11px] text-sky-300/90 pt-1">
            Use a alça (⋮⋮) à esquerda da barra compacta. No modo blend o arraste é apenas horizontal, fixo no topo.
          </div>
        )}
        <Row title="Ancoragem" description="Ponto preferido da barra no modo compacto (quando não houver posição personalizada).">
          <select
            value={prefs.anchor}
            onChange={(e) => setPrefs({ anchor: e.target.value as any, customPosition: null })}
            className="bg-zinc-900/70 border border-white/10 rounded-md px-2 py-1.5 text-xs text-zinc-100 outline-none"
          >
            <option value="top-center">Topo central</option>
            <option value="top-left">Topo esquerdo</option>
            <option value="top-right">Topo direito</option>
          </select>
        </Row>
        <Row title="Posição personalizada" description="Ao mover, a posição do modo compacto é salva. Redefina para voltar à ancoragem.">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">
              {prefs.customPosition ? `${prefs.customPosition.x}, ${prefs.customPosition.y}` : "Usando ancoragem"}
            </span>
            <button
              type="button"
              onClick={clearCustomPosition}
              className="px-2.5 py-1.5 rounded-md text-xs border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
            >
              Redefinir
            </button>
          </div>
        </Row>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Monitor size={13} /> Windows e sistema</div>
        <Row
          title="Iniciar com o Windows"
          description="Abre a HelpBar automaticamente ao entrar no Windows (executável atual do app)."
        >
          <ToggleButton active={autoStart} onClick={() => void toggleAutoStart()} disabled={autoStartBusy} />
        </Row>
        {autoStartError && <div className="text-[11px] text-red-400 pt-1">{autoStartError}</div>}
        <Row
          title="Atalho global"
          description="Mostra/expande a HelpBar de qualquer aplicativo. Clique e pressione a combinação."
        >
          <ShortcutRecorder value={prefs.globalShortcut} onChange={(v) => setPrefs({ globalShortcut: v })} />
        </Row>
        {shortcutError && (
          <div className="text-[11px] text-red-400 pt-1">Não foi possível registrar o atalho: {shortcutError}</div>
        )}
        <div className="text-xs text-zinc-400 space-y-1 pt-2">
          <p>• System Tray ativo: fechar a janela oculta para a bandeja; use o menu do tray para mostrar, abrir configurações ou sair.</p>
          <p>• O atalho funciona mesmo com a HelpBar oculta; pressione novamente para recolher.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Sparkles size={13} /> ATLAS — assistente de voz local</div>
        <Row title="Ativar ATLAS" description="Mostra o microfone na barra e permite ditar comandos para criar tarefas, notas, lembretes e compromissos.">
          <ToggleButton active={prefs.atlasEnabled} onClick={() => setPrefs({ atlasEnabled: !prefs.atlasEnabled })} />
        </Row>
        {prefs.atlasEnabled && (
          <>
            <Row
              title="Modelos de voz"
              description="Reconhecimento local (whisper.cpp). Baixe uma vez para usar a voz; o áudio nunca é enviado para servidores."
            >
              <div className="flex flex-col items-end gap-1">
                <div className="text-[11px] text-zinc-400">
                  Base: <span className={models?.ready ? "text-emerald-300" : "text-zinc-500"}>{models?.ready ? "pronto" : "pendente"}</span>
                  {" • "}Pequeno: <span className={models?.wakeReady ? "text-emerald-300" : "text-zinc-500"}>{models?.wakeReady ? "pronto" : "pendente"}</span>
                </div>
                {downloading && (
                  <div className="w-[150px] h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-sky-500 transition-[width] duration-300" style={{ width: `${progress?.percent ?? 0}%` }} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void installModels()}
                  disabled={downloading || (models?.ready ?? false) && (models?.wakeReady ?? false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-sky-600/80 border-sky-500/50 text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {downloading ? `Baixando ${progress?.percent ?? 0}%` : "Baixar modelos"}
                </button>
              </div>
            </Row>
            <Row title="Ouvir a palavra “ATLAS”" description="Ativação contínua pelo microfone. Desligada por padrão por privacidade e consumo de CPU.">
              <ToggleButton
                active={prefs.atlasWakeWord}
                disabled={!models?.wakeReady || !models?.ready}
                onClick={() => setPrefs({ atlasWakeWord: !prefs.atlasWakeWord })}
              />
            </Row>
            <Row title="Atalho de voz (pressione e segure)" description="Segure a combinação em qualquer aplicativo para gravar; solte para transcrever e executar.">
              <ShortcutRecorder
                kind="atlas"
                value={prefs.atlasPttShortcut}
                onChange={(v) => setPrefs({ atlasPttShortcut: v })}
              />
            </Row>
            {atlasShortcutError && (
              <div className="text-[11px] text-red-400 pt-1">Não foi possível registrar o atalho da ATLAS: {atlasShortcutError}</div>
            )}
            <Row title="Sons de retorno" description="Toca um sinal curto ao ativar, concluir ou falhar um comando de voz.">
              <ToggleButton active={prefs.atlasSoundFeedback} onClick={() => setPrefs({ atlasSoundFeedback: !prefs.atlasSoundFeedback })} />
            </Row>
            <div className="text-[11px] text-zinc-500 space-y-1 pt-2">
              <p className="flex items-start gap-1.5"><Ear size={12} className="mt-0.5 shrink-0" /> O microfone só fica ativo enquanto você segura o atalho ou enquanto a palavra de ativação estiver ligada.</p>
              <p className="flex items-start gap-1.5"><Volume2 size={12} className="mt-0.5 shrink-0" /> Comandos de exclusão não são executados por voz; a ATLAS só cria itens e abre módulos.</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Database size={13} /> Dados e armazenamento</div>
        <div className="text-sm font-medium text-zinc-100">
          {!storage.ready
            ? "Abrindo banco local…"
            : storage.persistent
              ? "SQLite conectado"
              : "Modo temporário (sem banco)"}
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          {!storage.ready
            ? "Carregando dados salvos…"
            : storage.persistent
              ? "Tarefas, notas, lembretes e compromissos são gravados automaticamente e restaurados ao abrir o app."
              : "Não foi possível abrir o banco local. Os dados desta sessão não serão mantidos ao fechar."}
        </p>
        <p className="text-[11px] text-zinc-500 mt-2 break-all">
          Arquivo: <span className="text-zinc-400">{databaseLocationLabel()}</span>
        </p>
        {storage.error && (
          <div className="text-[11px] text-amber-400 mt-1 break-words">{storage.error}</div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-2"><Power size={13} /> Aplicativo</div>
        <Row
          title="Sair da HelpBar"
          description="Encerra o aplicativo por completo. Fechar/recolher a barra apenas oculta para a bandeja do Windows."
        >
          <button
            type="button"
            onClick={() => setConfirmQuit(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-red-500/10 border-red-500/30 text-red-200 hover:bg-red-500/20"
          >
            <LogOut size={13} /> Sair
          </button>
        </Row>
        {confirmQuit && (
          <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-red-100">Encerrar a HelpBar agora? Seus dados já estão salvos.</div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void quitApp()}
                className="px-2.5 py-1.5 text-xs rounded-md bg-red-600/80 hover:bg-red-600 text-white"
              >
                Sair agora
              </button>
              <button
                type="button"
                onClick={() => setConfirmQuit(false)}
                className="px-2.5 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/15 text-zinc-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <div className="text-[11px] text-zinc-500 pt-2">
          Também disponível no menu do ícone da bandeja, perto do relógio (pode estar no menu “^”).
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4 text-xs text-zinc-500 flex items-start gap-2">
        <Keyboard size={14} className="mt-0.5" />
        <div>
          <p>Dica: evite atalhos já usados pelo Windows (ex.: Win+L, Ctrl+Alt+Del). Se o sistema recusar, escolha outra combinação.</p>
        </div>
      </div>
    </div>
  );
}

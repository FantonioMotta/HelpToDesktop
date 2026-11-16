import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Ear,
  History,
  Loader2,
  Mic,
  MicOff,
  Shield,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Volume2,
} from "lucide-react";
import { useAtlas, type AtlasPhase } from "./AtlasContext";
import { usePreferences } from "../../store/PreferencesContext";
import { formatBytes } from "../../services/atlas";
import { shortcutDisplay } from "../../services/globalShortcut";

const PHASE_LABEL: Record<AtlasPhase, string> = {
  idle: "Pronta",
  listening: "Ouvindo…",
  processing: "Transcrevendo…",
  awake: "Ativada por voz",
  success: "Concluído",
  error: "Atenção",
};

const PHASE_STYLE: Record<AtlasPhase, string> = {
  idle: "bg-white/5 border-white/10 text-zinc-300",
  listening: "bg-red-500/15 border-red-500/40 text-red-200",
  processing: "bg-sky-500/15 border-sky-500/40 text-sky-200",
  awake: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
  success: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
  error: "bg-amber-500/15 border-amber-500/40 text-amber-200",
};

function Card({
  title,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  icon: typeof Mic;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs uppercase tracking-wide text-zinc-500 flex items-center gap-2">
          <Icon size={13} /> {title}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function formatWhen(epoch: number): string {
  return new Date(epoch).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AtlasView() {
  const {
    phase,
    transcript,
    feedback,
    history,
    lastUndo,
    models,
    modelsLoading,
    downloading,
    progress,
    runtime,
    shortcutError,
    available,
    startListening,
    stopListening,
    cancel,
    undoLast,
    clearHistory,
    refreshModels,
    installModels,
    removeModels,
  } = useAtlas();
  const { prefs, setPrefs } = usePreferences();

  const listening = phase === "listening";
  const baseReady = models?.ready ?? false;
  const tinyReady = models?.wakeReady ?? false;
  const allReady = baseReady && tinyReady;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles size={18} /> ATLAS
          </h2>
          <p className="text-xs text-zinc-400">
            Assistente de voz local: reconhecimento no seu computador, sem enviar áudio para a nuvem.
          </p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1.5 ${PHASE_STYLE[phase]}`}>
          {phase === "processing" && <Loader2 size={12} className="animate-spin" />}
          {phase === "listening" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
          {PHASE_LABEL[phase]}
        </span>
      </div>

      {!available && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5" />
          A voz da ATLAS só funciona no aplicativo instalado (Windows). No navegador de desenvolvimento os
          comandos de voz ficam indisponíveis.
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-800/70 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void (listening ? stopListening() : startListening())}
            disabled={!available}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
              listening
                ? "bg-red-600/80 border-red-500/50 text-white hover:bg-red-600"
                : "bg-sky-600/80 border-sky-500/50 text-white hover:bg-sky-600"
            }`}
            title={listening ? "Parar e transcrever" : "Falar um comando"}
          >
            {listening ? <Square size={15} /> : <Mic size={15} />}
            {listening ? "Parar e transcrever" : "Falar com a ATLAS"}
          </button>
          {listening && (
            <button
              type="button"
              onClick={() => void cancel()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
            >
              <MicOff size={13} /> Cancelar
            </button>
          )}
          <div className="text-[11px] text-zinc-500 ml-auto text-right">
            <div>
              Atalho: <span className="text-zinc-300">{shortcutDisplay(prefs.atlasPttShortcut) || "não definido"}</span>{" "}
              (segure para falar)
            </div>
            {prefs.atlasWakeWord && (
              <div className="text-zinc-400">
                Palavra de ativação: <span className="text-emerald-300">“ATLAS”</span>{" "}
                {tinyReady ? "ativa" : "(instale o modelo pequeno)"}
              </div>
            )}
          </div>
        </div>

        {shortcutError && (
          <div className="text-[11px] text-red-400">Não foi possível registrar o atalho da ATLAS: {shortcutError}</div>
        )}

        {(transcript || feedback) && (
          <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 space-y-1.5">
            {transcript && (
              <div className="text-xs text-zinc-400">
                Você disse: <span className="text-zinc-100">“{transcript}”</span>
              </div>
            )}
            {feedback && (
              <div
                className={`text-sm flex items-start gap-2 ${
                  feedback.tone === "error"
                    ? "text-amber-200"
                    : feedback.tone === "success"
                      ? "text-emerald-200"
                      : "text-zinc-200"
                }`}
              >
                {feedback.tone === "error" ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                ) : feedback.tone === "success" ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <Sparkles size={14} className="mt-0.5 shrink-0" />
                )}
                <span className="flex-1">{feedback.text}</span>
              </div>
            )}
            {lastUndo && (
              <button
                type="button"
                onClick={undoLast}
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
                title={lastUndo.description}
              >
                <Undo2 size={12} /> Desfazer
              </button>
            )}
          </div>
        )}

        <div className="text-[11px] text-zinc-500 leading-relaxed">
          Exemplos: “criar tarefa comprar leite”, “anotar ideia do projeto”, “lembrar de pagar a conta amanhã às 9”,
          “agendar reunião amanhã às 14h”, “abrir o calendário”. Comandos de exclusão por voz ainda não são executados.
        </div>
      </div>

      <Card
        title="Modelos de voz"
        icon={Download}
        actions={
          <div className="flex items-center gap-2">
            {allReady ? (
              <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> Instalados
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">
                {modelsLoading ? "Verificando…" : "Não instalados"}
              </span>
            )}
            <button
              type="button"
              onClick={() => void refreshModels()}
              className="text-[11px] px-2 py-1 rounded-md border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
            >
              Verificar
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          {(models?.models ?? []).map((model) => (
            <div key={model.key} className="flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-zinc-200 capitalize">
                  {model.key === "tiny" ? "Pequeno (palavra de ativação)" : "Base (comandos)"}
                </span>
                <span className="text-zinc-500 ml-2">{formatBytes(model.expectedBytes)}</span>
              </div>
              <span className={model.installed ? "text-emerald-300" : "text-zinc-500"}>
                {model.installed ? "Instalado" : "Pendente"}
              </span>
            </div>
          ))}

          {downloading && (
            <div className="pt-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                <span>
                  Baixando {progress?.key === "tiny" ? "modelo pequeno" : progress?.key === "base" ? "modelo base" : "modelos"}…
                </span>
                <span>{progress ? `${progress.percent}%` : "preparando"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progress?.percent ?? 0))}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void installModels()}
              disabled={downloading || !available || allReady}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-sky-600/80 border-sky-500/50 text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {allReady ? "Modelos instalados" : downloading ? "Baixando…" : "Baixar modelos (~92 MB)"}
            </button>
            <button
              type="button"
              onClick={() => void removeModels()}
              disabled={downloading || !available || (!baseReady && !tinyReady)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              <Trash2 size={13} /> Remover
            </button>
          </div>

          <div className="text-[11px] text-zinc-500 break-all">
            Pasta: <span className="text-zinc-400">{models?.modelsDir ?? "—"}</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Download único direto do projeto whisper.cpp (Hugging Face), com verificação SHA-256. O áudio nunca sai do
            computador.
          </div>
        </div>
      </Card>

      <Card
        title="Ativação por voz"
        icon={Ear}
        actions={
          <button
            type="button"
            onClick={() => setPrefs({ atlasWakeWord: !prefs.atlasWakeWord })}
            className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
              prefs.atlasWakeWord
                ? "bg-sky-600/80 border-sky-500/50 text-white"
                : "bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
            }`}
          >
            {prefs.atlasWakeWord ? "Ativada" : "Desativada"}
          </button>
        }
      >
        <p className="text-xs text-zinc-400">
          Dizer “ATLAS” abre o microfone e aguarda o comando. Usa o modelo pequeno em segundo plano e consome um pouco
          de CPU/bateria; por privacidade vem desativada.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Volume2 size={12} />
            Sons de retorno: {prefs.atlasSoundFeedback ? "ligados" : "desligados"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Shield size={12} />
            {runtime?.audioReady ? "Microfone pronto" : "Microfone parado (economia)"}
          </span>
          {runtime?.backend && <span className="break-all">{runtime.backend}</span>}
        </div>
        {!allReady && prefs.atlasWakeWord && (
          <div className="mt-2 text-[11px] text-amber-300">
            Instale os modelos de voz para a palavra de ativação funcionar de verdade.
          </div>
        )}
      </Card>

      <Card
        title="Histórico"
        icon={History}
        actions={
          history.length > 0 ? (
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] px-2 py-1 rounded-md border bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10"
            >
              Limpar
            </button>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum comando executado nesta sessão.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li key={entry.id} className="text-xs border-b border-white/5 last:border-b-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span>{formatWhen(entry.at)}</span>
                  <span className={entry.ok ? "text-emerald-300" : "text-amber-300"}>
                    {entry.ok ? "executado" : "não executado"}
                  </span>
                </div>
                <div className="text-zinc-300 mt-0.5">“{entry.transcript}”</div>
                <div className="text-zinc-400">{entry.message}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./db";

export type AtlasModelKey = "tiny" | "base";

export type AtlasModelInfo = {
  key: AtlasModelKey;
  fileName: string;
  installed: boolean;
  bytes: number;
  expectedBytes: number;
};

export type AtlasModelsStatus = {
  modelsDir: string;
  models: AtlasModelInfo[];
  /** Base model installed: needed for command transcription. */
  ready: boolean;
  /** Tiny model installed: needed for the wake word. */
  wakeReady: boolean;
};

export type AtlasRuntimeStatus = {
  audioReady: boolean;
  recording: boolean;
  wakeWord: boolean;
  processing: boolean;
  backend: string;
  error: string | null;
};

export type AtlasStatusEvent = {
  state: "idle" | "listening" | "processing" | "wake";
  detail?: string;
};

export type AtlasFinalEvent = { text: string };
export type AtlasErrorEvent = { message: string };

export type AtlasModelProgressEvent = {
  key: AtlasModelKey | "all";
  received: number;
  total: number;
  percent: number;
  done: boolean;
  message?: string;
};

export const EMPTY_MODELS_STATUS: AtlasModelsStatus = {
  modelsDir: "%APPDATA%\\com.helpbar.desktop\\atlas\\models",
  models: [
    {
      key: "tiny",
      fileName: "ggml-tiny-q5_1.bin",
      installed: false,
      bytes: 0,
      expectedBytes: 32_152_673,
    },
    {
      key: "base",
      fileName: "ggml-base-q5_1.bin",
      installed: false,
      bytes: 0,
      expectedBytes: 59_707_625,
    },
  ],
  ready: false,
  wakeReady: false,
};

export const EMPTY_RUNTIME_STATUS: AtlasRuntimeStatus = {
  audioReady: false,
  recording: false,
  wakeWord: false,
  processing: false,
  backend: "indisponível",
  error: null,
};

export function atlasAvailable(): boolean {
  return isTauriRuntime();
}

export const atlasApi = {
  async modelsStatus(): Promise<AtlasModelsStatus> {
    if (!atlasAvailable()) return EMPTY_MODELS_STATUS;
    return invoke<AtlasModelsStatus>("atlas_model_status");
  },

  async runtimeStatus(): Promise<AtlasRuntimeStatus> {
    if (!atlasAvailable()) return EMPTY_RUNTIME_STATUS;
    return invoke<AtlasRuntimeStatus>("atlas_runtime_status");
  },

  async downloadModels(): Promise<void> {
    if (!atlasAvailable()) throw new Error("A ATLAS só funciona no aplicativo desktop.");
    return invoke("atlas_download_models");
  },

  async deleteModels(): Promise<void> {
    if (!atlasAvailable()) throw new Error("A ATLAS só funciona no aplicativo desktop.");
    return invoke("atlas_delete_models");
  },

  async startPushToTalk(): Promise<void> {
    if (!atlasAvailable()) throw new Error("A ATLAS só funciona no aplicativo desktop.");
    return invoke("atlas_start_ptt");
  },

  async stopPushToTalk(): Promise<void> {
    if (!atlasAvailable()) throw new Error("A ATLAS só funciona no aplicativo desktop.");
    return invoke("atlas_stop_ptt");
  },

  async cancel(): Promise<void> {
    if (!atlasAvailable()) return;
    return invoke("atlas_cancel");
  },

  async setWakeWord(enabled: boolean): Promise<void> {
    if (!atlasAvailable()) return;
    return invoke("atlas_set_wake_word", { enabled });
  },
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

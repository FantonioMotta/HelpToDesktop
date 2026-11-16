use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const TARGET_RATE: u32 = 16_000;

struct ModelSpec {
    key: &'static str,
    file: &'static str,
    url: &'static str,
    size: u64,
    sha256: &'static str,
}

const MODELS: [ModelSpec; 2] = [
    ModelSpec {
        key: "tiny",
        file: "ggml-tiny-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin",
        size: 32_152_673,
        sha256: "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7",
    },
    ModelSpec {
        key: "base",
        file: "ggml-base-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
        size: 59_707_625,
        sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
    },
];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    key: String,
    file_name: String,
    installed: bool,
    bytes: u64,
    expected_bytes: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelsStatus {
    models_dir: String,
    models: Vec<ModelInfo>,
    ready: bool,
    wake_ready: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    audio_ready: bool,
    recording: bool,
    wake_word: bool,
    processing: bool,
    backend: String,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StatusEvent {
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FinalEvent {
    text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ErrorEvent {
    message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ModelProgress {
    key: String,
    received: u64,
    total: u64,
    percent: u32,
    done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

pub struct AtlasShared {
    app: AppHandle,
    models_dir: PathBuf,
    ring: Arc<Mutex<VecDeque<f32>>>,
    ptt: Arc<Mutex<Vec<f32>>>,
    ptt_active: Arc<AtomicBool>,
    wake_capture: Arc<AtomicBool>,
    audio_started: Arc<AtomicBool>,
    audio_shutdown: Arc<AtomicBool>,
    audio_ready: Arc<AtomicBool>,
    audio_error: Arc<Mutex<Option<String>>>,
    backend: Arc<Mutex<Option<String>>>,
    downloading: Arc<AtomicBool>,
    processing: Arc<AtomicBool>,
    wake_enabled: Arc<AtomicBool>,
    wake_stop: Arc<AtomicBool>,
    wake_handle: Mutex<Option<JoinHandle<()>>>,
}

pub struct AtlasState {
    shared: Arc<AtlasShared>,
}

impl AtlasState {
    /// Stops the wake-word worker and releases the microphone (used on exit).
    pub fn shutdown(&self) {
        self.shared.wake_enabled.store(false, Ordering::SeqCst);
        self.shared.wake_stop.store(true, Ordering::SeqCst);
        self.shared.ptt_active.store(false, Ordering::SeqCst);
        self.shared.audio_shutdown.store(true, Ordering::SeqCst);
        if let Ok(mut handle) = self.shared.wake_handle.lock() {
            if let Some(thread) = handle.take() {
                drop(thread);
            }
        }
    }

    pub fn new(app: AppHandle) -> Self {
        let models_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("atlas")
            .join("models");

        let shared = AtlasShared {
            app,
            models_dir,
            ring: Arc::new(Mutex::new(VecDeque::with_capacity(TARGET_RATE as usize * 8))),
            ptt: Arc::new(Mutex::new(Vec::new())),
            ptt_active: Arc::new(AtomicBool::new(false)),
            wake_capture: Arc::new(AtomicBool::new(false)),
            audio_started: Arc::new(AtomicBool::new(false)),
            audio_shutdown: Arc::new(AtomicBool::new(false)),
            audio_ready: Arc::new(AtomicBool::new(false)),
            audio_error: Arc::new(Mutex::new(None)),
            backend: Arc::new(Mutex::new(None)),
            downloading: Arc::new(AtomicBool::new(false)),
            processing: Arc::new(AtomicBool::new(false)),
            wake_enabled: Arc::new(AtomicBool::new(false)),
            wake_stop: Arc::new(AtomicBool::new(false)),
            wake_handle: Mutex::new(None),
        };

        Self {
            shared: Arc::new(shared),
        }
    }
}

fn emit_status(app: &AppHandle, state: &str, detail: Option<String>) {
    let _ = app.emit(
        "atlas:status",
        StatusEvent {
            state: state.to_string(),
            detail,
        },
    );
}

fn emit_error(app: &AppHandle, message: impl Into<String>) {
    let _ = app.emit(
        "atlas:error",
        ErrorEvent {
            message: message.into(),
        },
    );
}

fn emit_progress(app: &AppHandle, key: &str, received: u64, total: u64, done: bool, message: Option<String>) {
    let percent = if total > 0 {
        ((received as u128 * 100) / total as u128).min(100) as u32
    } else {
        0
    };
    let _ = app.emit(
        "atlas:model-progress",
        ModelProgress {
            key: key.to_string(),
            received,
            total,
            percent,
            done,
            message,
        },
    );
}

fn models_status(shared: &AtlasShared) -> ModelsStatus {
    let mut infos = Vec::new();
    for model in MODELS.iter() {
        let path = shared.models_dir.join(model.file);
        let bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        infos.push(ModelInfo {
            key: model.key.to_string(),
            file_name: model.file.to_string(),
            installed: bytes == model.size,
            bytes,
            expected_bytes: model.size,
        });
    }
    let ready = infos.iter().any(|m| m.key == "base" && m.installed);
    let wake_ready = infos.iter().any(|m| m.key == "tiny" && m.installed);
    ModelsStatus {
        models_dir: shared.models_dir.display().to_string(),
        models: infos,
        ready,
        wake_ready,
    }
}

#[tauri::command]
pub fn atlas_model_status(state: tauri::State<'_, AtlasState>) -> ModelsStatus {
    models_status(&state.shared)
}

#[tauri::command]
pub fn atlas_runtime_status(state: tauri::State<'_, AtlasState>) -> RuntimeStatus {
    let shared = &state.shared;
    let error = shared.audio_error.lock().ok().and_then(|e| e.clone());
    let backend = shared
        .backend
        .lock()
        .ok()
        .and_then(|b| b.clone())
        .unwrap_or_else(|| "microfone não iniciado".to_string());
    RuntimeStatus {
        audio_ready: shared.audio_ready.load(Ordering::SeqCst),
        recording: shared.ptt_active.load(Ordering::SeqCst),
        wake_word: shared.wake_enabled.load(Ordering::SeqCst),
        processing: shared.processing.load(Ordering::SeqCst),
        backend,
        error,
    }
}

fn model_path(shared: &AtlasShared, key: &str) -> Option<PathBuf> {
    MODELS
        .iter()
        .find(|m| m.key == key)
        .map(|m| shared.models_dir.join(m.file))
}

fn ensure_model(shared: &AtlasShared, key: &str) -> Result<PathBuf, String> {
    let path = model_path(shared, key).ok_or_else(|| format!("Modelo desconhecido: {key}"))?;
    let expected = MODELS
        .iter()
        .find(|m| m.key == key)
        .map(|m| m.size)
        .unwrap_or(0);
    let len = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if len != expected {
        return Err(format!(
            "O modelo '{key}' não está instalado. Abra a ATLAS nas configurações e baixe os modelos de voz."
        ));
    }
    Ok(path)
}

// ---------------------------------------------------------------------------
// Audio capture
// ---------------------------------------------------------------------------

struct Resampler {
    ratio: f64,
    position: f64,
    previous: f32,
    has_previous: bool,
}

impl Resampler {
    fn new(input_rate: u32) -> Self {
        Self {
            ratio: input_rate as f64 / TARGET_RATE as f64,
            position: 0.0,
            previous: 0.0,
            has_previous: false,
        }
    }

    #[inline]
    fn process(&mut self, sample: f32, out: &mut Vec<f32>) {
        if !self.has_previous {
            self.previous = sample;
            self.has_previous = true;
            self.position = 0.0;
            return;
        }
        while self.position < 1.0 {
            let value = self.previous + (sample - self.previous) * self.position as f32;
            out.push(value);
            self.position += self.ratio;
        }
        self.position -= 1.0;
        self.previous = sample;
    }
}

fn convert_samples(data: &cpal::Data, out: &mut Vec<f32>) {
    out.clear();
    match data.sample_format() {
        cpal::SampleFormat::F32 => {
            if let Some(samples) = data.as_slice::<f32>() {
                out.extend_from_slice(samples);
            }
        }
        cpal::SampleFormat::F64 => {
            if let Some(samples) = data.as_slice::<f64>() {
                out.extend(samples.iter().map(|&v| v as f32));
            }
        }
        cpal::SampleFormat::I16 => {
            if let Some(samples) = data.as_slice::<i16>() {
                out.extend(samples.iter().map(|&v| v as f32 / 32768.0));
            }
        }
        cpal::SampleFormat::U16 => {
            if let Some(samples) = data.as_slice::<u16>() {
                out.extend(samples.iter().map(|&v| (v as f32 - 32768.0) / 32768.0));
            }
        }
        cpal::SampleFormat::I32 => {
            if let Some(samples) = data.as_slice::<i32>() {
                out.extend(samples.iter().map(|&v| v as f32 / 2_147_483_648.0));
            }
        }
        cpal::SampleFormat::U32 => {
            if let Some(samples) = data.as_slice::<u32>() {
                out.extend(
                    samples
                        .iter()
                        .map(|&v| (v as f64 - 2_147_483_648.0) as f32 / 2_147_483_648.0),
                );
            }
        }
        cpal::SampleFormat::I8 => {
            if let Some(samples) = data.as_slice::<i8>() {
                out.extend(samples.iter().map(|&v| v as f32 / 128.0));
            }
        }
        cpal::SampleFormat::U8 => {
            if let Some(samples) = data.as_slice::<u8>() {
                out.extend(samples.iter().map(|&v| (v as f32 - 128.0) / 128.0));
            }
        }
        _ => {}
    }
}

fn mix_to_mono(samples: &[f32], channels: usize, out: &mut Vec<f32>) {
    out.clear();
    if channels <= 1 {
        out.extend_from_slice(samples);
        return;
    }
    for frame in samples.chunks(channels) {
        let sum: f32 = frame.iter().sum();
        out.push(sum / frame.len() as f32);
    }
}

fn push_ring(ring: &Arc<Mutex<VecDeque<f32>>>, samples: &[f32]) {
    if let Ok(mut buffer) = ring.lock() {
        buffer.extend(samples.iter().copied());
        let max = TARGET_RATE as usize * 15;
        while buffer.len() > max {
            buffer.pop_front();
        }
    }
}

fn push_ptt(ptt: &Arc<Mutex<Vec<f32>>>, samples: &[f32]) {
    if let Ok(mut buffer) = ptt.lock() {
        buffer.extend(samples.iter().copied());
        if buffer.len() > TARGET_RATE as usize * 20 {
            let excess = buffer.len() - TARGET_RATE as usize * 20;
            buffer.drain(0..excess);
        }
    }
}

fn audio_thread(shared: Arc<AtlasShared>) {
    let result = run_audio_stream(&shared);
    if let Err(error) = result {
        if let Ok(mut slot) = shared.audio_error.lock() {
            *slot = Some(error.clone());
        }
        emit_error(&shared.app, error);
    }
    shared.audio_ready.store(false, Ordering::SeqCst);
    shared.audio_started.store(false, Ordering::SeqCst);
    shared.ptt_active.store(false, Ordering::SeqCst);
    if let Ok(mut ring) = shared.ring.lock() {
        ring.clear();
    }
}

fn run_audio_stream(shared: &Arc<AtlasShared>) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "Nenhum microfone encontrado. Conecte um microfone e tente novamente.".to_string())?;
    let supported = device
        .default_input_config()
        .map_err(|e| format!("Não foi possível abrir o microfone: {e}"))?;

    let sample_format = supported.sample_format();
    let input_rate = supported.sample_rate().0;
    let channels = supported.channels() as usize;
    let config = supported.config();

    if let Ok(mut backend) = shared.backend.lock() {
        *backend = Some(format!(
            "{} • {} Hz • {} canal(is) • 16 kHz mono",
            device,
            input_rate,
            channels
        ));
    }

    let ring = Arc::clone(&shared.ring);
    let ptt = Arc::clone(&shared.ptt);
    let ptt_active = Arc::clone(&shared.ptt_active);
    let error_slot = Arc::clone(&shared.audio_error);
    let app = shared.app.clone();

    let mut converted: Vec<f32> = Vec::new();
    let mut mono: Vec<f32> = Vec::new();
    let mut resampled: Vec<f32> = Vec::new();
    let mut resampler = Resampler::new(input_rate);

    let stream = device
        .build_input_stream_raw(
            config,
            sample_format,
            move |data, _info| {
                convert_samples(data, &mut converted);
                if converted.is_empty() {
                    return;
                }
                mix_to_mono(&converted, channels, &mut mono);
                resampled.clear();
                for &sample in mono.iter() {
                    resampler.process(sample, &mut resampled);
                }
                if resampled.is_empty() {
                    return;
                }
                push_ring(&ring, &resampled);
                if ptt_active.load(Ordering::SeqCst) {
                    push_ptt(&ptt, &resampled);
                }
            },
            move |error| {
                let message = format!("Falha no microfone: {error}");
                if let Ok(mut slot) = error_slot.lock() {
                    *slot = Some(message.clone());
                }
                emit_error(&app, message);
            },
            None,
        )
        .map_err(|e| format!("Não foi possível iniciar o microfone: {e}"))?;

    stream
        .play()
        .map_err(|e| format!("Não foi possível iniciar a captura de áudio: {e}"))?;

    if let Ok(mut slot) = shared.audio_error.lock() {
        *slot = None;
    }
    shared.audio_ready.store(true, Ordering::SeqCst);

    while !shared.audio_shutdown.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(120));
    }

    drop(stream);
    Ok(())
}

fn ensure_audio(shared: &Arc<AtlasShared>) -> Result<(), String> {
    shared.audio_shutdown.store(false, Ordering::SeqCst);

    if !shared.audio_started.swap(true, Ordering::SeqCst) {
        let cloned = Arc::clone(shared);
        std::thread::Builder::new()
            .name("atlas-audio".to_string())
            .spawn(move || audio_thread(cloned))
            .map_err(|e| format!("Não foi possível criar a thread de áudio: {e}"))?;
    }

    for _ in 0..60 {
        if shared.audio_ready.load(Ordering::SeqCst) {
            return Ok(());
        }
        if let Ok(slot) = shared.audio_error.lock() {
            if let Some(error) = slot.as_ref() {
                return Err(error.clone());
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    Err("O microfone demorou para iniciar. Verifique as permissões de áudio do Windows.".to_string())
}

fn stop_audio_if_idle(shared: &Arc<AtlasShared>) {
    if shared.wake_enabled.load(Ordering::SeqCst) || shared.ptt_active.load(Ordering::SeqCst) {
        return;
    }
    shared.audio_shutdown.store(true, Ordering::SeqCst);
}

fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f32 = samples.iter().map(|s| s * s).sum();
    (sum / samples.len() as f32).sqrt()
}

fn ring_tail(ring: &Arc<Mutex<VecDeque<f32>>>, count: usize) -> Vec<f32> {
    let Ok(buffer) = ring.lock() else {
        return Vec::new();
    };
    let len = buffer.len();
    let start = len.saturating_sub(count);
    buffer.iter().skip(start).copied().collect()
}

fn take_ptt(shared: &AtlasShared) -> Vec<f32> {
    let Ok(mut buffer) = shared.ptt.lock() else {
        return Vec::new();
    };
    std::mem::take(&mut *buffer)
}

// ---------------------------------------------------------------------------
// Whisper
// ---------------------------------------------------------------------------

fn transcription_threads() -> i32 {
    let available = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    available.saturating_sub(2).clamp(2, 8) as i32
}

fn transcribe(model: &Path, audio: &[f32]) -> Result<String, String> {
    if audio.len() < TARGET_RATE as usize / 3 {
        return Ok(String::new());
    }
    let path = model
        .to_str()
        .ok_or_else(|| "Caminho de modelo inválido.".to_string())?;
    let context = WhisperContext::new_with_params(path, WhisperContextParameters::default())
        .map_err(|e| format!("Não foi possível carregar o modelo de voz: {e}"))?;
    let mut state = context
        .create_state()
        .map_err(|e| format!("Não foi possível preparar o reconhecimento: {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("pt"));
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_single_segment(false);
    params.set_n_threads(transcription_threads());

    state
        .full(params, audio)
        .map_err(|e| format!("Falha ao reconhecer a fala: {e}"))?;

    let text = (0..state.full_n_segments())
        .map(|index| {
            state
                .get_segment(index)
                .and_then(|segment| segment.to_str().ok().map(str::to_owned))
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(" ");

    Ok(text.trim().to_string())
}

fn fold_char(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        other => other,
    }
}

fn normalize_words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|part| !part.is_empty())
        .map(|part| {
            // Lower-case first so "Átlas" also collapses to "atlas".
            part.to_lowercase().chars().map(fold_char).collect()
        })
        .collect()
}

fn has_wake_word(text: &str) -> bool {
    normalize_words(text)
        .iter()
        .any(|word| matches!(word.as_str(), "atlas" | "atlus" | "atles" | "hatlas"))
}

fn capture_wake_command(shared: &Arc<AtlasShared>) -> Vec<f32> {
    if let Ok(mut buffer) = shared.ptt.lock() {
        buffer.clear();
    }
    shared.wake_capture.store(true, Ordering::SeqCst);
    shared.ptt_active.store(true, Ordering::SeqCst);

    let started = Instant::now();
    let mut heard_voice = false;
    let mut last_voice = Instant::now();

    loop {
        std::thread::sleep(Duration::from_millis(120));
        if !shared.ptt_active.load(Ordering::SeqCst) {
            break;
        }
        let (length, tail) = {
            let Ok(buffer) = shared.ptt.lock() else {
                break;
            };
            let length = buffer.len();
            let tail_start = length.saturating_sub(TARGET_RATE as usize / 5);
            let tail: Vec<f32> = buffer.range(tail_start..).copied().collect();
            (length, rms(&tail))
        };

        if tail > 0.010 {
            heard_voice = true;
            last_voice = Instant::now();
        }

        if heard_voice && length > TARGET_RATE as usize * 3 / 5 && last_voice.elapsed() > Duration::from_millis(1200) {
            break;
        }
        if !heard_voice && started.elapsed() > Duration::from_secs(5) {
            break;
        }
        if started.elapsed() > Duration::from_secs(10) {
            break;
        }
    }

    shared.ptt_active.store(false, Ordering::SeqCst);
    shared.wake_capture.store(false, Ordering::SeqCst);
    take_ptt(shared)
}

fn wake_worker(shared: Arc<AtlasShared>) {
    let tiny = match ensure_model(&shared, "tiny") {
        Ok(path) => path,
        Err(error) => {
            emit_error(&shared.app, error);
            shared.wake_enabled.store(false, Ordering::SeqCst);
            return;
        }
    };
    let base = ensure_model(&shared, "base").ok();

    if let Err(error) = ensure_audio(&shared) {
        emit_error(&shared.app, error);
        shared.wake_enabled.store(false, Ordering::SeqCst);
        return;
    }

    let mut cooldown_until = Instant::now();
    let mut last_check = Instant::now();

    while !shared.wake_stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(120));
        if shared.ptt_active.load(Ordering::SeqCst) || shared.processing.load(Ordering::SeqCst) {
            continue;
        }
        if Instant::now() < cooldown_until || last_check.elapsed() < Duration::from_millis(900) {
            continue;
        }
        last_check = Instant::now();

        let window = ring_tail(&shared.ring, TARGET_RATE as usize * 5 / 2);
        if window.len() < TARGET_RATE as usize * 4 / 5 || rms(&window) < 0.012 {
            continue;
        }

        match transcribe(&tiny, &window) {
            Ok(text) => {
                if !has_wake_word(&text) {
                    continue;
                }
                emit_status(&shared.app, "wake", None);
                emit_status(&shared.app, "listening", None);

                let capture = capture_wake_command(&shared);
                if capture.len() < TARGET_RATE as usize / 3 {
                    emit_status(&shared.app, "idle", Some("Não ouvi o comando depois de ATLAS.".to_string()));
                    cooldown_until = Instant::now() + Duration::from_millis(1200);
                    last_check = Instant::now();
                    continue;
                }

                let Some(model) = base.as_deref() else {
                    emit_error(
                        &shared.app,
                        "O modelo base não está instalado. Baixe os modelos de voz para executar comandos.",
                    );
                    cooldown_until = Instant::now() + Duration::from_millis(1200);
                    continue;
                };

                shared.processing.store(true, Ordering::SeqCst);
                emit_status(&shared.app, "processing", None);
                match transcribe(model, &capture) {
                    Ok(text) => {
                        let _ = shared.app.emit("atlas:final", FinalEvent { text });
                        emit_status(&shared.app, "idle", None);
                    }
                    Err(error) => emit_error(&shared.app, error),
                }
                shared.processing.store(false, Ordering::SeqCst);
                cooldown_until = Instant::now() + Duration::from_millis(1800);
                last_check = Instant::now();
            }
            Err(error) => {
                emit_error(&shared.app, error);
                std::thread::sleep(Duration::from_secs(2));
            }
        }
    }

    shared.audio_shutdown.store(true, Ordering::SeqCst);
    let _ = shared
        .app
        .emit("atlas:models-changed", models_status(&shared));
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn atlas_start_ptt(state: tauri::State<'_, AtlasState>) -> Result<(), String> {
    let shared = &state.shared;
    if shared.wake_capture.load(Ordering::SeqCst) {
        return Err("A ATLAS está ouvindo um comando. Aguarde terminar.".to_string());
    }
    if shared.ptt_active.load(Ordering::SeqCst) {
        return Ok(());
    }
    ensure_model(shared, "base")?;
    ensure_audio(shared)?;

    if let Ok(mut buffer) = shared.ptt.lock() {
        buffer.clear();
    }
    if let Ok(mut ring) = shared.ring.lock() {
        ring.clear();
    }
    shared.ptt_active.store(true, Ordering::SeqCst);
    emit_status(&shared.app, "listening", None);
    Ok(())
}

#[tauri::command]
pub fn atlas_stop_ptt(state: tauri::State<'_, AtlasState>) -> Result<(), String> {
    let shared = Arc::clone(&state.shared);
    if !shared.ptt_active.load(Ordering::SeqCst) {
        return Ok(());
    }
    shared.ptt_active.store(false, Ordering::SeqCst);

    let audio = take_ptt(&shared);
    if audio.len() < TARGET_RATE as usize / 2 {
        emit_status(&shared.app, "idle", Some("Áudio muito curto — segure o atalho enquanto fala.".to_string()));
        stop_audio_if_idle(&shared);
        return Ok(());
    }

    let model = ensure_model(&shared, "base")?;
    shared.processing.store(true, Ordering::SeqCst);
    emit_status(&shared.app, "processing", None);

    let app = shared.app.clone();
    std::thread::Builder::new()
        .name("atlas-transcribe".to_string())
        .spawn(move || {
            let result = transcribe(&model, &audio);
            match result {
                Ok(text) => {
                    let _ = app.emit("atlas:final", FinalEvent { text });
                    emit_status(&app, "idle", None);
                }
                Err(error) => emit_error(&app, error),
            }
            shared.processing.store(false, Ordering::SeqCst);
            stop_audio_if_idle(&shared);
        })
        .map_err(|e| format!("Não foi possível transcrever o áudio: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn atlas_cancel(state: tauri::State<'_, AtlasState>) -> Result<(), String> {
    let shared = &state.shared;
    shared.ptt_active.store(false, Ordering::SeqCst);
    if let Ok(mut buffer) = shared.ptt.lock() {
        buffer.clear();
    }
    emit_status(&shared.app, "idle", None);
    stop_audio_if_idle(shared);
    Ok(())
}

#[tauri::command]
pub fn atlas_set_wake_word(state: tauri::State<'_, AtlasState>, enabled: bool) -> Result<(), String> {
    let shared = &state.shared;

    if !enabled {
        shared.wake_enabled.store(false, Ordering::SeqCst);
        shared.wake_stop.store(true, Ordering::SeqCst);
        if let Ok(mut handle) = shared.wake_handle.lock() {
            if let Some(thread) = handle.take() {
                drop(thread);
            }
        }
        stop_audio_if_idle(shared);
        return Ok(());
    }

    ensure_model(shared, "tiny")?;
    ensure_model(shared, "base")?;

    let mut handle = shared
        .wake_handle
        .lock()
        .map_err(|_| "Estado da ATLAS indisponível.".to_string())?;
    let running = handle.as_ref().map(|h| !h.is_finished()).unwrap_or(false);
    if running {
        shared.wake_enabled.store(true, Ordering::SeqCst);
        shared.wake_stop.store(false, Ordering::SeqCst);
        return Ok(());
    }

    shared.wake_stop.store(false, Ordering::SeqCst);
    shared.wake_enabled.store(true, Ordering::SeqCst);
    let cloned = Arc::clone(shared);
    let thread = std::thread::Builder::new()
        .name("atlas-wake".to_string())
        .spawn(move || wake_worker(cloned))
        .map_err(|e| format!("Não foi possível iniciar a palavra de ativação: {e}"))?;
    *handle = Some(thread);
    Ok(())
}

// ---------------------------------------------------------------------------
// Model management
// ---------------------------------------------------------------------------

fn hex_digest(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(out, "{byte:02x}");
    }
    out
}

fn download_model(app: &AppHandle, shared: &AtlasShared, model: &ModelSpec) -> Result<(), String> {
    let path = shared.models_dir.join(model.file);
    if fs::metadata(&path).map(|m| m.len()).unwrap_or(0) == model.size {
        emit_progress(app, model.key, model.size, model.size, true, None);
        return Ok(());
    }

    let part = path.with_extension("part.bin");
    let response = ureq::get(model.url)
        .set("User-Agent", "HelpBar-Desktop/0.1 (+atlas)")
        .call()
        .map_err(|e| format!("Falha ao baixar {}: {e}", model.file))?;
    let total = response
        .header("Content-Length")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(model.size);

    let mut reader = response.into_reader();
    let mut file = File::create(&part).map_err(|e| format!("Falha ao criar o arquivo: {e}"))?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut buffer = [0u8; 64 * 1024];
    let mut last_emit = Instant::now();

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Falha durante o download: {e}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|e| format!("Falha ao gravar o modelo: {e}"))?;
        hasher.update(&buffer[..read]);
        received += read as u64;
        if last_emit.elapsed() > Duration::from_millis(200) {
            last_emit = Instant::now();
            emit_progress(app, model.key, received.min(total), total, false, None);
        }
    }

    drop(file);

    if received != model.size {
        let _ = fs::remove_file(&part);
        return Err(format!(
            "O download de {} ficou incompleto ({received} de {} bytes).",
            model.file, model.size
        ));
    }

    let digest = hex_digest(&hasher.finalize());
    if !digest.eq_ignore_ascii_case(model.sha256) {
        let _ = fs::remove_file(&part);
        return Err(format!(
            "A verificação de integridade de {} falhou. Tente baixar novamente.",
            model.file
        ));
    }

    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&part, &path).map_err(|e| format!("Falha ao finalizar o modelo: {e}"))?;
    emit_progress(app, model.key, model.size, model.size, true, None);
    Ok(())
}

#[tauri::command]
pub fn atlas_download_models(state: tauri::State<'_, AtlasState>) -> Result<(), String> {
    let shared = Arc::clone(&state.shared);
    if shared.downloading.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    if let Err(error) = fs::create_dir_all(&shared.models_dir) {
        shared.downloading.store(false, Ordering::SeqCst);
        return Err(format!("Não foi possível criar a pasta de modelos: {error}"));
    }

    let app = shared.app.clone();
    std::thread::Builder::new()
        .name("atlas-download".to_string())
        .spawn(move || {
            for model in MODELS.iter() {
                if let Err(error) = download_model(&app, &shared, model) {
                    emit_error(&app, error);
                    shared.downloading.store(false, Ordering::SeqCst);
                    let _ = app.emit("atlas:models-changed", models_status(&shared));
                    emit_progress(&app, "all", 0, 0, true, Some("Falhou".to_string()));
                    return;
                }
            }
            shared.downloading.store(false, Ordering::SeqCst);
            let _ = app.emit("atlas:models-changed", models_status(&shared));
            emit_progress(&app, "all", 1, 1, true, Some("Concluído".to_string()));
        })
        .map_err(|e| {
            shared.downloading.store(false, Ordering::SeqCst);
            format!("Não foi possível iniciar o download: {e}")
        })?;

    Ok(())
}

#[tauri::command]
pub fn atlas_delete_models(state: tauri::State<'_, AtlasState>) -> Result<(), String> {
    let shared = &state.shared;
    if shared.downloading.load(Ordering::SeqCst) {
        return Err("Aguarde o download terminar antes de remover os modelos.".to_string());
    }

    shared.wake_enabled.store(false, Ordering::SeqCst);
    shared.wake_stop.store(true, Ordering::SeqCst);

    for model in MODELS.iter() {
        let path = shared.models_dir.join(model.file);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Falha ao remover {}: {e}", model.file))?;
        }
        let part = path.with_extension("part.bin");
        if part.exists() {
            let _ = fs::remove_file(part);
        }
    }

    let _ = shared.app.emit("atlas:models-changed", models_status(shared));
    Ok(())
}

const els = {
  status: document.getElementById("status"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  fileMeta: document.getElementById("fileMeta"),
  playOriginalBtn: document.getElementById("playOriginalBtn"),
  stopBtn: document.getElementById("stopBtn"),
  rerollBtn: document.getElementById("rerollBtn"),
  replayBtn: document.getElementById("replayBtn"),
  exportBtn: document.getElementById("exportBtn"),
  phaseRange: document.getElementById("phaseRange"),
  phaseValue: document.getElementById("phaseValue"),
  fftSizeSelect: document.getElementById("fftSizeSelect"),
  fftOptions: Array.from(document.querySelectorAll(".fft-option")),
  originalWave: document.getElementById("originalWave"),
  processedWave: document.getElementById("processedWave"),
  spectrogram: document.getElementById("spectrogram"),
  originalPeak: document.getElementById("originalPeak"),
  processedPeak: document.getElementById("processedPeak"),
  seedInfo: document.getElementById("seedInfo"),
};

let audioCtx = null;
let currentSource = null;
let currentGain = null;
let masterGain = null;
let previewAudio = null;
let previewUrl = null;
let previewPlaying = false;
let original = null;
let processed = null;
let processedMeta = null;
let sampleRate = 44100;
let baseSeed = 0x54796b31;
let originalFileBaseName = "one_shot";
let busy = false;
let audioPrimed = false;

bindEvents();
updateControlLabels();
drawEmpty(els.originalWave);
drawEmpty(els.processedWave);
drawEmpty(els.spectrogram);
loadDefaultKick();

function bindEvents() {
  els.fileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file) await loadAudioFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) await loadAudioFile(file);
  });

  els.playOriginalBtn.addEventListener("click", () => playBuffer(original));
  els.replayBtn.addEventListener("click", () => playBuffer(processed));
  els.stopBtn.addEventListener("click", stopPlayback);
  els.rerollBtn.addEventListener("click", () => {
    spinSample();
  });
  els.exportBtn.addEventListener("click", exportProcessedWav);
  [els.playOriginalBtn, els.replayBtn, els.rerollBtn].forEach((button) => {
    button.addEventListener("pointerdown", unlockAudioContext);
    button.addEventListener("touchstart", unlockAudioContext, { passive: true });
  });

  els.phaseRange.addEventListener("input", updateControlLabels);
  els.fftOptions.forEach((button) => {
    button.addEventListener("click", () => {
      els.fftSizeSelect.value = button.dataset.fft;
      updateFftOptions();
      els.fftSizeSelect.dispatchEvent(new Event("change"));
    });
  });

  [els.phaseRange, els.fftSizeSelect].forEach((control) => {
    control.addEventListener("change", () => {
      if (original && processed) {
        setStatus("Parameters changed. Press Spin to resample.");
      }
    });
  });
}

function unlockAudioContext() {
  primeAudioOutput().catch((error) => {
    console.error(error);
  });
}

async function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API is unavailable.");
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.98;
    masterGain.connect(audioCtx.destination);
    ensurePreviewAudio();
    audioPrimed = false;
  }
  if (audioCtx.state !== "running") {
    await audioCtx.resume();
  }
}

async function primeAudioOutput() {
  await ensureAudioContext();
  const audio = ensurePreviewAudio();
  if (audioPrimed) return;

  const buffer = audioCtx.createBuffer(1, 2, audioCtx.sampleRate);
  buffer.getChannelData(0)[0] = 0.000001;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(masterGain);
  source.start();
  audio.muted = true;
  audio.src = makePreviewUrl(new Float32Array([0, 0]), audioCtx.sampleRate);
  await audio.play().catch(() => {});
  audio.pause();
  audio.currentTime = 0;
  audio.muted = false;
  audioPrimed = true;
}

function ensurePreviewAudio() {
  if (!previewAudio) {
    previewAudio = new Audio();
    previewAudio.preload = "auto";
    previewAudio.playsInline = true;
    previewAudio.setAttribute("playsinline", "");
    previewAudio.style.position = "fixed";
    previewAudio.style.left = "-9999px";
    previewAudio.style.width = "1px";
    previewAudio.style.height = "1px";
    previewAudio.style.opacity = "0";
    previewAudio.style.pointerEvents = "none";
    document.body.appendChild(previewAudio);
  }
  return previewAudio;
}

async function loadAudioFile(file) {
  try {
    await ensureAudioContext();
    setBusy(true);
    setStatus("Loading audio...");

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    original = mixToMono(audioBuffer);
    processed = null;
    processedMeta = null;
    sampleRate = audioBuffer.sampleRate;
    baseSeed = makeRandomSeed();
    originalFileBaseName = stripAudioExtension(file.name);

    const seconds = original.length / sampleRate;
    els.fileMeta.textContent = `${file.name} / ${seconds.toFixed(3)}s / ${sampleRate}Hz`;
    els.originalPeak.textContent = `peak ${peakAbs(original).toFixed(3)}`;
    els.processedPeak.textContent = "score --";
    els.seedInfo.textContent = "ready";

    drawWaveform(els.originalWave, original, "#ffba5a");
    drawEmpty(els.processedWave);
    drawEmpty(els.spectrogram);

    setButtons();
    setStatus("Audio loaded. Press Spin to resample phase.");
  } catch (error) {
    console.error(error);
    setStatus("Could not decode the file. Try WAV, AIFF, or another browser-supported format.");
  } finally {
    setBusy(false);
  }
}

function mixToMono(audioBuffer) {
  const out = new Float32Array(audioBuffer.length);
  const channels = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += 1) out[i] += data[i] / channels;
  }
  return out;
}

function loadDefaultKick() {
  sampleRate = 44100;
  original = createDefault808Kick(sampleRate);
  processed = null;
  processedMeta = null;
  baseSeed = makeRandomSeed();
  originalFileBaseName = "default_percussive_one_shot";

  const seconds = original.length / sampleRate;
  els.fileMeta.textContent = `Default percussive one-shot / ${seconds.toFixed(3)}s / ${sampleRate}Hz`;
  els.originalPeak.textContent = `peak ${peakAbs(original).toFixed(3)}`;
  els.processedPeak.textContent = "score --";
  els.seedInfo.textContent = "ready";

  drawWaveform(els.originalWave, original, "#ffba5a");
  drawEmpty(els.processedWave);
  drawEmpty(els.spectrogram);
  setButtons();
  setStatus("Default one-shot loaded. Press Spin.");
}

function createDefault808Kick(sr) {
  const duration = 0.28;
  const length = Math.floor(sr * duration);
  const out = new Float32Array(length);
  let phase = 0;
  let noiseState = 0x6d2b79f5;

  for (let i = 0; i < length; i += 1) {
    const t = i / sr;
    const pitch = 48 + 104 * Math.exp(-t / 0.032) + 8 * Math.exp(-t / 0.08);
    phase += (2 * Math.PI * pitch) / sr;

    const bodyEnv = Math.exp(-t / 0.115);
    const attack = 1 - Math.exp(-t / 0.0018);
    const clickEnv = Math.exp(-t / 0.004);
    const beaterEnv = Math.exp(-t / 0.018);

    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    const noise = ((noiseState >>> 0) / 4294967296) * 2 - 1;

    const body = Math.sin(phase) * bodyEnv * attack;
    const sub = Math.sin(phase * 0.5) * Math.exp(-t / 0.15) * 0.12;
    const click = Math.sin(2 * Math.PI * 1350 * t) * clickEnv * 0.16;
    const beater = noise * beaterEnv * 0.045;
    const softClip = Math.tanh((body + sub + click + beater) * 1.7);

    out[i] = softClip * 0.86;
  }

  const fadeLength = Math.floor(sr * 0.008);
  for (let i = 0; i < fadeLength; i += 1) {
    const fade = i / Math.max(1, fadeLength - 1);
    out[length - 1 - i] *= fade;
  }
  out[0] = 0;
  out[length - 1] = 0;

  return matchPeak(out, 0.92);
}

async function spinSample() {
  try {
    await primeAudioOutput().catch((error) => {
      console.error(error);
    });
    baseSeed = makeRandomSeed();
    await renderSample();
  } catch (error) {
    console.error(error);
    setStatus("Could not start the audio engine. Press Spin again.");
  }
}

async function renderSample() {
  if (!original || busy) return;

  try {
    stopPlayback();
    setBusy(true);
    processed = null;
    processedMeta = null;
    setButtons();

    if (!baseSeed) baseSeed = makeRandomSeed();

    const fftSize = Number(els.fftSizeSelect.value);
    const hopSize = fftSize / 4;
    const phaseDepth = Number(els.phaseRange.value) / 100;
    const window = makeHannWindow(fftSize);
    const originalPeak = Math.max(0.08, peakAbs(original));

    setStatus("Analyzing STFT magnitude...");
    await nextFrame();
    const analysis = analyzeStft(original, fftSize, hopSize, window);
    drawSpectrogram(els.spectrogram, analysis.magnitudes);

    setStatus("ISTFT...");
    await nextFrame();

    const signal = renderOneShotFromMagnitude({
      targetMagnitudes: analysis.magnitudes,
      originalPhases: analysis.phases,
      originalLength: original.length,
      fftSize,
      hopSize,
      window,
      phaseDepth,
      seed: baseSeed,
    });

    const zeroCrossed = alignBoundariesToZeroCrossings(signal, sampleRate);
    const normalized = matchPeak(zeroCrossed, Math.min(0.98, originalPeak));
    const score = scoreHardness(normalized, sampleRate);
    processed = normalized;
    processedMeta = {
      score,
      seed: baseSeed,
    };
    drawWaveform(els.processedWave, processed, "#ff5a38");
    els.processedPeak.textContent = `score ${score.toFixed(3)}`;
    els.seedInfo.textContent = `score ${score.toFixed(3)}`;
    setStatus("Phase resampled. Export if this take is useful.");
    await playBuffer(processed);
  } catch (error) {
    console.error(error);
    setStatus("Render failed. Try a smaller FFT size.");
  } finally {
    setBusy(false);
    setButtons();
  }
}

function renderOneShotFromMagnitude(options) {
  const {
    targetMagnitudes,
    originalPhases,
    originalLength,
    fftSize,
    hopSize,
    window,
    phaseDepth,
    seed,
  } = options;

  const phases = makeInitialPhases(originalPhases, seed, phaseDepth);
  return synthesizeStft(targetMagnitudes, phases, originalLength, fftSize, hopSize, window);
}

function alignBoundariesToZeroCrossings(signal, sr) {
  const startSearch = Math.min(signal.length - 2, Math.floor(sr * 0.008));
  const endSearch = Math.min(signal.length - 2, Math.floor(sr * 0.08));
  const start = findForwardZeroCrossing(signal, startSearch);
  const end = findBackwardZeroCrossing(signal, Math.max(0, signal.length - 1 - endSearch));

  let out = signal;
  if (start >= 0 && end > start + 8) {
    out = signal.slice(start, end + 1);
    out[0] = 0;
    out[out.length - 1] = 0;
    return out;
  }

  if (start >= 0 && start < signal.length - 8) {
    out = signal.slice(start);
    out[0] = 0;
  } else {
    out = out.slice();
  }

  const adjustedEnd = findBackwardZeroCrossing(out, Math.max(0, out.length - 1 - endSearch));
  if (adjustedEnd > 8) {
    out = out.slice(0, adjustedEnd + 1);
    out[out.length - 1] = 0;
    return out;
  }

  return applyBoundaryFade(out, sr);
}

function findForwardZeroCrossing(signal, maxIndex) {
  const limit = clamp(maxIndex, 0, signal.length - 1);
  if (Math.abs(signal[0]) < 1e-8) return 0;

  for (let i = 1; i <= limit; i += 1) {
    if (Math.abs(signal[i]) < 1e-8) return i;
    if ((signal[i - 1] < 0 && signal[i] > 0) || (signal[i - 1] > 0 && signal[i] < 0)) {
      return i;
    }
  }
  return -1;
}

function findBackwardZeroCrossing(signal, minIndex) {
  const limit = clamp(minIndex, 0, signal.length - 1);
  if (Math.abs(signal[signal.length - 1]) < 1e-8) return signal.length - 1;

  for (let i = signal.length - 1; i > limit; i -= 1) {
    if (Math.abs(signal[i]) < 1e-8) return i;
    if ((signal[i - 1] < 0 && signal[i] > 0) || (signal[i - 1] > 0 && signal[i] < 0)) {
      return i;
    }
  }
  return -1;
}

function applyBoundaryFade(signal, sr) {
  const out = signal.slice();
  const fadeLength = Math.min(out.length, Math.max(8, Math.floor(sr * 0.002)));
  for (let i = 0; i < fadeLength; i += 1) {
    const fadeIn = i / Math.max(1, fadeLength - 1);
    const fadeOut = 1 - fadeIn;
    out[i] *= fadeIn;
    out[out.length - 1 - i] *= fadeOut;
  }
  out[0] = 0;
  out[out.length - 1] = 0;
  return out;
}

function makeInitialPhases(originalPhases, seed, amount) {
  const rng = mulberry32(seed);
  return originalPhases.map((frame) => {
    const next = new Float32Array(frame.length);
    for (let k = 0; k < frame.length; k += 1) {
      if (k === 0 || k === frame.length - 1) {
        next[k] = frame[k];
        continue;
      }
      const randomPhase = rng() * Math.PI * 2 - Math.PI;
      next[k] = wrapAngle(frame[k] + wrapAngle(randomPhase - frame[k]) * amount);
    }
    return next;
  });
}

function analyzeStft(signal, fftSize, hopSize, window, frameCount = null) {
  const pad = fftSize / 2;
  const calculatedFrames =
    frameCount ?? Math.max(1, Math.ceil(signal.length / hopSize) + Math.ceil(pad / hopSize));
  const paddedLength = (calculatedFrames - 1) * hopSize + fftSize;
  const padded = new Float32Array(paddedLength);

  for (let i = 0; i < signal.length; i += 1) {
    const index = i + pad;
    if (index < padded.length) padded[index] = signal[i];
  }

  const bins = fftSize / 2 + 1;
  const magnitudes = new Array(calculatedFrames);
  const phases = new Array(calculatedFrames);

  for (let frame = 0; frame < calculatedFrames; frame += 1) {
    const start = frame * hopSize;
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);

    for (let n = 0; n < fftSize; n += 1) {
      re[n] = padded[start + n] * window[n];
    }

    fft(re, im, false);

    const mag = new Float32Array(bins);
    const phase = new Float32Array(bins);
    for (let k = 0; k < bins; k += 1) {
      mag[k] = Math.hypot(re[k], im[k]);
      phase[k] = Math.atan2(im[k], re[k]);
    }
    magnitudes[frame] = mag;
    phases[frame] = phase;
  }

  return { magnitudes, phases };
}

function synthesizeStft(magnitudes, phases, originalLength, fftSize, hopSize, window) {
  const frameCount = magnitudes.length;
  const bins = fftSize / 2 + 1;
  const pad = fftSize / 2;
  const outLength = (frameCount - 1) * hopSize + fftSize;
  const out = new Float64Array(outLength);
  const norm = new Float64Array(outLength);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    const mag = magnitudes[frame];
    const phase = phases[frame];

    for (let k = 0; k < bins; k += 1) {
      if (k === 0 || k === bins - 1) {
        re[k] = mag[k] * (Math.cos(phase[k]) < 0 ? -1 : 1);
        im[k] = 0;
      } else {
        re[k] = mag[k] * Math.cos(phase[k]);
        im[k] = mag[k] * Math.sin(phase[k]);
        re[fftSize - k] = re[k];
        im[fftSize - k] = -im[k];
      }
    }

    fft(re, im, true);

    const start = frame * hopSize;
    for (let n = 0; n < fftSize; n += 1) {
      const w = window[n];
      out[start + n] += re[n] * w;
      norm[start + n] += w * w;
    }
  }

  const result = new Float32Array(originalLength);
  for (let i = 0; i < originalLength; i += 1) {
    const index = i + pad;
    result[i] = norm[index] > 1e-10 ? out[index] / norm[index] : 0;
  }
  return result;
}

function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      const ti = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = tr;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wLenRe = Math.cos(angle);
    const wLenIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;

      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;

        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;

        const nextRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function makeHannWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

function scoreHardness(signal, sr) {
  const attackEnd = Math.min(signal.length, Math.max(1, Math.floor(sr * 0.035)));
  const bodyStart = Math.min(signal.length, Math.floor(sr * 0.045));
  const bodyEnd = Math.min(signal.length, Math.max(bodyStart + 1, Math.floor(sr * 0.22)));
  const diffEnd = Math.min(signal.length, Math.max(2, Math.floor(sr * 0.025)));
  const peakEnd = Math.min(signal.length, Math.max(1, Math.floor(sr * 0.06)));

  let attackPeak = 0;
  for (let i = 0; i < attackEnd; i += 1) attackPeak = Math.max(attackPeak, Math.abs(signal[i]));

  let bodyEnergy = 0;
  for (let i = bodyStart; i < bodyEnd; i += 1) bodyEnergy += signal[i] * signal[i];
  const bodyRms = Math.sqrt(bodyEnergy / Math.max(1, bodyEnd - bodyStart));

  let fullEnergy = 0;
  for (let i = 0; i < signal.length; i += 1) fullEnergy += signal[i] * signal[i];
  const fullRms = Math.sqrt(fullEnergy / Math.max(1, signal.length));

  let diffEnergy = 0;
  let localEnergy = 0;
  for (let i = 1; i < diffEnd; i += 1) {
    const diff = signal[i] - signal[i - 1];
    diffEnergy += diff * diff;
    localEnergy += signal[i] * signal[i];
  }
  const diffRatio = diffEnergy / (localEnergy + 1e-9);

  let peakIndex = 0;
  let peak = 0;
  for (let i = 0; i < peakEnd; i += 1) {
    const value = Math.abs(signal[i]);
    if (value > peak) {
      peak = value;
      peakIndex = i;
    }
  }
  const attackSpeed = peak / ((peakIndex + 1) / sr);

  return (
    Math.log1p(attackPeak / (bodyRms + 1e-5)) +
    0.45 * Math.log1p(diffRatio) +
    0.2 * Math.log1p(attackSpeed) +
    0.25 * Math.log1p(attackPeak / (fullRms + 1e-5))
  );
}

async function playBuffer(data) {
  if (!data) return;
  try {
    await primeAudioOutput().catch((error) => {
      console.error(error);
    });
    stopPlayback();
    await playWithAudioElement(data);
    setStatus("Playing...");
    setButtons();
  } catch (error) {
    console.error(error);
    try {
      stopPlayback();
      await playWithAudioContext(data);
      setStatus("Playing...");
      setButtons();
    } catch (fallbackError) {
      console.error(fallbackError);
      setStatus("Could not play audio. Press the button again.");
    }
  }
}

async function playWithAudioContext(data) {
  await ensureAudioContext();
  const buffer = audioCtx.createBuffer(1, data.length, sampleRate);
  buffer.copyToChannel(data, 0);
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const startAt = now + 0.006;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(1, startAt + 0.004);
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(masterGain);
  source.onended = () => {
    try {
      source.disconnect();
    } catch (error) {
      // Already disconnected.
    }
    try {
      gain.disconnect();
    } catch (error) {
      // Already disconnected.
    }
    if (currentSource === source) currentSource = null;
    if (currentGain === gain) currentGain = null;
    setButtons();
  };
  currentSource = source;
  currentGain = gain;
  source.start(startAt);
}

async function playWithAudioElement(data) {
  const audio = ensurePreviewAudio();
  previewPlaying = false;
  audio.pause();
  audio.currentTime = 0;
  audio.src = makePreviewUrl(data, sampleRate);
  audio.onended = () => {
    previewPlaying = false;
    setButtons();
  };
  await audio.play();
  previewPlaying = true;
}

function makePreviewUrl(data, sr) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const wav = encodeWav(data, sr);
  previewUrl = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  return previewUrl;
}

function stopPlayback() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  previewPlaying = false;

  const source = currentSource;
  const gain = currentGain;
  currentSource = null;
  currentGain = null;

  if (source) {
    source.onended = null;
    try {
      source.stop();
    } catch (error) {
      // The source may have already ended between clicks.
    }
    try {
      source.disconnect();
    } catch (error) {
      // Already disconnected.
    }
  }

  if (gain) {
    try {
      gain.disconnect();
    } catch (error) {
      // Already disconnected.
    }
  }
  setButtons();
}

function exportProcessedWav() {
  if (!processed) return;
  const wav = encodeWav(processed, sampleRate);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const score = processedMeta?.score ?? scoreHardness(processed, sampleRate);
  const scoreText = formatScoreForFilename(score);
  const sourceName = sanitizeFileName(originalFileBaseName || "one_shot");
  link.download = `phase_resample_${scoreText}_${sourceName}.wav`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function makeRandomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return ((Date.now() * 2654435761) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function encodeWav(samples, sr) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const value = clamp(samples[i], -1, 1);
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function drawWaveform(canvas, data, color) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const mid = height / 2;
  const peak = Math.max(0.001, peakAbs(data));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#090605";
  ctx.fillRect(0, 0, width, height);
  drawCanvasGrain(ctx, width, height);
  drawGrid(ctx, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let x = 0; x < width; x += 1) {
    const start = Math.floor((x / width) * data.length);
    const end = Math.max(start + 1, Math.floor(((x + 1) / width) * data.length));
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i += 1) {
      const value = data[i] / peak;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    ctx.moveTo(x, mid - max * (height * 0.42));
    ctx.lineTo(x, mid - min * (height * 0.42));
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,90,56,0.34)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
}

function drawSpectrogram(canvas, magnitudes) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const image = ctx.createImageData(width, height);
  const frames = magnitudes.length;
  const bins = magnitudes[0].length;

  let maxValue = 1e-9;
  for (const frame of magnitudes) {
    for (let i = 0; i < frame.length; i += 1) {
      maxValue = Math.max(maxValue, Math.log1p(frame[i] * 20));
    }
  }

  for (let y = 0; y < height; y += 1) {
    const yNorm = 1 - y / Math.max(1, height - 1);
    const bin = clamp(Math.floor(yNorm * yNorm * (bins - 1)), 0, bins - 1);
    for (let x = 0; x < width; x += 1) {
      const frame = clamp(Math.floor((x / width) * frames), 0, frames - 1);
      const value = Math.log1p(magnitudes[frame][bin] * 20) / maxValue;
      const [r, g, b] = heatColor(value);
      const offset = (y * width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function heatColor(value) {
  const v = clamp(value, 0, 1);
  const r = Math.round(20 + 230 * smoothstep(0.35, 1, v));
  const g = Math.round(34 + 195 * smoothstep(0.15, 0.85, v));
  const b = Math.round(44 + 130 * (1 - smoothstep(0.35, 1, v)) + 45 * smoothstep(0.75, 1, v));
  return [r, g, b];
}

function drawEmpty(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#090605";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCanvasGrain(ctx, canvas.width, canvas.height);
  drawGrid(ctx, canvas.width, canvas.height);
}

function drawCanvasGrain(ctx, width, height) {
  let state = (width * 73856093) ^ (height * 19349663);
  const count = Math.floor((width * height) / 210);

  for (let i = 0; i < count; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const x = Math.abs(state) % width;

    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const y = Math.abs(state) % height;

    state ^= state << 13;
    const alpha = 0.018 + (Math.abs(state) % 22) / 1000;
    ctx.fillStyle = `rgba(222, 184, 140, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = "rgba(255,186,90,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += width / 8) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += height / 4) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

function setButtons() {
  const hasOriginal = Boolean(original);
  const hasProcessed = Boolean(processed);
  els.playOriginalBtn.disabled = !hasOriginal || busy;
  els.rerollBtn.disabled = !hasOriginal || busy;
  els.replayBtn.disabled = !hasProcessed || busy;
  els.exportBtn.disabled = !hasProcessed || busy;
  els.stopBtn.disabled = !currentSource && !previewPlaying;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  setButtons();
}

function updateControlLabels() {
  const phase = Number(els.phaseRange.value);
  els.phaseValue.textContent = `${phase}%`;
  updateFftOptions();
}

function updateFftOptions() {
  els.fftOptions.forEach((button) => {
    button.classList.toggle("active", button.dataset.fft === els.fftSizeSelect.value);
  });
}

function setStatus(text) {
  els.status.textContent = text;
}

function peakAbs(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  return peak;
}

function stripAudioExtension(name) {
  return name.replace(/\.(wav|wave|aif|aiff|mp3|m4a|flac|ogg|aac)$/i, "");
}

function sanitizeFileName(name) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "one_shot";
}

function formatScoreForFilename(score) {
  if (!Number.isFinite(score)) return "0000";
  return String(Math.round(Math.max(0, score) * 1000)).padStart(4, "0");
}

function matchPeak(data, targetPeak) {
  const peak = peakAbs(data);
  if (peak < 1e-8) return data.slice();
  const gain = targetPeak / peak;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 1) out[i] = data[i] * gain;
  return out;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped <= -Math.PI) wrapped += Math.PI * 2;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  return wrapped;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

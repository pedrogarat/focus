(() => {
  const STORAGE_KEY = "focus_pomodoro_prefs_v1";
  const DEFAULT_SPOTIFY_URL = "https://open.spotify.com/playlist/0bRF8dCUmHGDR0r7Nm21OS?si=f3c6d4217371447e";

  // DOM elements — Timer
  const body = document.body;
  const ringContainer = document.querySelector(".ring-container");
  const ringProgress = document.getElementById("ringProgress");
  const heartProgress = document.getElementById("heartProgress");
  const appleProgress = document.getElementById("appleProgress");
  const basketBallProgress = document.getElementById("basketBallProgress");
  const hoopProgress = document.getElementById("hoopProgress");
  const phaseLabel = document.getElementById("phaseLabel");
  const timeDisplay = document.getElementById("timeDisplay");
  const statusHint = document.getElementById("statusHint");
  const cycleCountEl = document.getElementById("cycleCount");

  const startPauseBtn = document.getElementById("startPauseBtn");
  const startPauseText = document.getElementById("startPauseText");
  const resetBtn = document.getElementById("resetBtn");
  const skipBtn = document.getElementById("skipBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const exitFullscreenBtn = document.getElementById("exitFullscreenBtn");
  const themeButtons = document.querySelectorAll(".theme-btn");

  // DOM elements — Config
  const focusInput = document.getElementById("focusMinutes");
  const breakInput = document.getElementById("breakMinutes");
  const stepButtons = document.querySelectorAll(".step-btn");
  const bellToggle = document.getElementById("bellToggle");
  const testBellBtn = document.getElementById("testBellBtn");

  // DOM elements — Music Tabs & Sync
  const tabs = document.querySelectorAll(".tab");
  const panelLocal = document.getElementById("panelLocal");
  const panelSpotify = document.getElementById("panelSpotify");
  const syncMusicToggle = document.getElementById("syncMusicToggle");

  // DOM elements — Local Audio
  const dropZone = document.getElementById("dropZone");
  const pickFileBtn = document.getElementById("pickFileBtn");
  const audioFileInput = document.getElementById("audioFileInput");
  const trackNameEl = document.getElementById("trackName");
  const localAudio = document.getElementById("localAudio");
  const audioPlayBtn = document.getElementById("audioPlayBtn");
  const seekSlider = document.getElementById("seekSlider");
  const audioCurrentTimeEl = document.getElementById("audioCurrentTime");
  const audioDurationEl = document.getElementById("audioDuration");
  const volumeSlider = document.getElementById("volumeSlider");
  const loopToggle = document.getElementById("loopToggle");

  // DOM elements — Spotify
  const spotifyForm = document.getElementById("spotifyForm");
  const spotifyUrlInput = document.getElementById("spotifyUrlInput");
  const spotifyError = document.getElementById("spotifyError");
  const spotifyEmbedWrap = document.getElementById("spotifyEmbedWrap");

  // SVG Geometry (all shapes sweep clockwise from 12 o'clock)
  const RADIUS = 126;
  const CIRCLE_LEN = 2 * Math.PI * RADIUS;
  const HEART_LEN = heartProgress ? heartProgress.getTotalLength() : 700;
  const APPLE_LEN = appleProgress ? appleProgress.getTotalLength() : 680;
  const BASKET_BALL_LEN = 2 * Math.PI * 120;
  const HOOP_LEN = hoopProgress ? hoopProgress.getTotalLength() : 780;

  ringProgress.style.strokeDasharray = `${CIRCLE_LEN}`;
  ringProgress.style.strokeDashoffset = "0";
  if (heartProgress) {
    heartProgress.style.strokeDasharray = `${HEART_LEN}`;
    heartProgress.style.strokeDashoffset = "0";
  }
  if (appleProgress) {
    appleProgress.style.strokeDasharray = `${APPLE_LEN}`;
    appleProgress.style.strokeDashoffset = "0";
  }
  if (basketBallProgress) {
    basketBallProgress.style.strokeDasharray = `${BASKET_BALL_LEN}`;
    basketBallProgress.style.strokeDashoffset = "0";
  }
  if (hoopProgress) {
    hoopProgress.style.strokeDasharray = `${HOOP_LEN}`;
    hoopProgress.style.strokeDashoffset = "0";
  }

  // Preferences
  const defaultPrefs = {
    focusMin: 25,
    breakMin: 5,
    bellEnabled: true,
    volume: 0.7,
    loop: true,
    syncMusic: true,
    theme: "default",
    spotifyUrl: DEFAULT_SPOTIFY_URL,
  };

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const merged = { ...defaultPrefs, ...saved };
      if (!merged.spotifyUrl) {
        merged.spotifyUrl = DEFAULT_SPOTIFY_URL;
      }
      if (!["default", "kids", "basket"].includes(merged.theme)) {
        merged.theme = "default";
      }
      return merged;
    } catch {
      return { ...defaultPrefs };
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors (e.g. private mode)
    }
  }

  const prefs = loadPrefs();

  // Timer State
  let phase = "focus"; // "focus" | "break"
  let cycle = 1;
  let isRunning = false;
  let totalMs = prefs.focusMin * 60 * 1000;
  let remainingMs = totalMs;
  let endTimestamp = 0;
  let rafId = null;
  let bgIntervalId = null;

  // Music State
  let activeMusicTab = "spotify"; // "spotify" | "local"
  let spotifyIFrameAPI = null;
  let spotifyController = null;
  let pendingSpotifyParsed = null;
  let fallbackTimerId = null;

  // Web Audio API (Chime)
  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(freq, startTime, duration, gainPeak = 0.22) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function playChime(type = "break") {
    if (!prefs.bellEnabled) return;
    ensureAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    if (type === "break") {
      playTone(659.25, now, 0.9, 0.2);        // E5
      playTone(493.88, now + 0.22, 1.2, 0.18); // B4
    } else {
      playTone(523.25, now, 0.7, 0.2);        // C5
      playTone(783.99, now + 0.2, 1.1, 0.22); // G5
    }
  }

  // Formatting helpers
  function formatTimer(ms) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  // Sync Timer Play/Pause -> Active Music Player
  function syncMusicWithTimer(shouldPlay) {
    if (!prefs.syncMusic) return;

    if (activeMusicTab === "spotify") {
      if (spotifyController) {
        try {
          if (shouldPlay) {
            spotifyController.resume();
          } else {
            spotifyController.pause();
          }
        } catch {
          // Ignore if controller is not ready yet
        }
      }
    } else if (activeMusicTab === "local" && localAudio.src) {
      if (shouldPlay) {
        localAudio.play().catch(() => {});
      } else {
        localAudio.pause();
      }
    }
  }

  // Render Timer UI
  function renderTimer() {
    const formatted = formatTimer(remainingMs);
    timeDisplay.textContent = formatted;

    const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
    const elapsedRatio = 1 - fraction;

    // Negative offset sweeps the disappearing edge clockwise on all shapes
    ringProgress.style.strokeDashoffset = `${-(CIRCLE_LEN * elapsedRatio)}`;
    if (heartProgress) {
      heartProgress.style.strokeDashoffset = `${-(HEART_LEN * elapsedRatio)}`;
    }
    if (appleProgress) {
      appleProgress.style.strokeDashoffset = `${-(APPLE_LEN * elapsedRatio)}`;
    }
    if (basketBallProgress) {
      basketBallProgress.style.strokeDashoffset = `${-(BASKET_BALL_LEN * elapsedRatio)}`;
    }
    if (hoopProgress) {
      hoopProgress.style.strokeDashoffset = `${-(HOOP_LEN * elapsedRatio)}`;
    }

    const label = phase === "focus" ? "FOCUS" : "DESCANSO";
    phaseLabel.textContent = label;
    body.dataset.phase = phase;
    cycleCountEl.textContent = String(cycle);

    if (isRunning) {
      statusHint.textContent = phase === "focus" ? "En sesión de estudio" : "Tómate un respiro";
      startPauseBtn.classList.add("running");
      startPauseText.textContent = "Pausar";
      document.title = `${formatted} · ${label}`;
    } else {
      statusHint.textContent = remainingMs < totalMs ? "En pausa" : "Listo para empezar";
      startPauseBtn.classList.remove("running");
      startPauseText.textContent = remainingMs < totalMs ? "Reanudar" : "Iniciar";
      document.title = "Focus Pomodoro";
    }
  }

  function pulseRing() {
    ringContainer.classList.remove("pulse");
    void ringContainer.offsetWidth;
    ringContainer.classList.add("pulse");
  }

  function switchPhase(autoContinue = true) {
    if (phase === "focus") {
      phase = "break";
      totalMs = prefs.breakMin * 60 * 1000;
    } else {
      phase = "focus";
      cycle += 1;
      totalMs = prefs.focusMin * 60 * 1000;
    }
    remainingMs = totalMs;
    pulseRing();

    if (autoContinue) {
      endTimestamp = Date.now() + remainingMs;
      isRunning = true;
    } else {
      isRunning = false;
      stopLoops();
    }
    renderTimer();
  }

  function checkTick() {
    if (!isRunning) return;
    remainingMs = endTimestamp - Date.now();
    if (remainingMs <= 0) {
      const nextPhase = phase === "focus" ? "break" : "focus";
      playChime(nextPhase);
      switchPhase(true);
      return;
    }
    renderTimer();
  }

  function animationLoop() {
    if (!isRunning) return;
    checkTick();
    rafId = requestAnimationFrame(animationLoop);
  }

  function stopLoops() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (bgIntervalId !== null) {
      clearInterval(bgIntervalId);
      bgIntervalId = null;
    }
  }

  function startTimer() {
    if (isRunning) return;
    ensureAudioContext();
    isRunning = true;
    endTimestamp = Date.now() + remainingMs;
    renderTimer();
    syncMusicWithTimer(true);
    rafId = requestAnimationFrame(animationLoop);
    bgIntervalId = setInterval(checkTick, 250);
  }

  function pauseTimer() {
    if (!isRunning) return;
    remainingMs = Math.max(0, endTimestamp - Date.now());
    isRunning = false;
    stopLoops();
    renderTimer();
    syncMusicWithTimer(false);
  }

  function toggleTimer() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function resetCurrentPhase() {
    isRunning = false;
    stopLoops();
    totalMs = (phase === "focus" ? prefs.focusMin : prefs.breakMin) * 60 * 1000;
    remainingMs = totalMs;
    renderTimer();
    syncMusicWithTimer(false);
  }

  // Event Listeners — Timer Controls
  startPauseBtn.addEventListener("click", toggleTimer);
  resetBtn.addEventListener("click", resetCurrentPhase);
  skipBtn.addEventListener("click", () => {
    const wasRunning = isRunning;
    switchPhase(wasRunning);
  });

  // Spacebar shortcut
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      toggleTimer();
    }
  });

  // Theme Switcher
  function applyTheme(themeName, persist = true) {
    const clean = ["default", "kids", "basket"].includes(themeName) ? themeName : "default";
    body.dataset.theme = clean;
    themeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === clean);
    });
    if (persist) {
      prefs.theme = clean;
      savePrefs();
    }
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.theme, true));
  });

  // Config Inputs
  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function applyDurationChange(kind, rawValue) {
    const isFocus = kind === "focus";
    const min = 1;
    const max = isFocus ? 180 : 60;
    const parsed = parseInt(rawValue, 10);
    const clean = Number.isNaN(parsed) ? (isFocus ? prefs.focusMin : prefs.breakMin) : clamp(parsed, min, max);

    if (isFocus) {
      prefs.focusMin = clean;
      focusInput.value = String(clean);
      if (!isRunning && phase === "focus") {
        totalMs = clean * 60 * 1000;
        remainingMs = totalMs;
        renderTimer();
      }
    } else {
      prefs.breakMin = clean;
      breakInput.value = String(clean);
      if (!isRunning && phase === "break") {
        totalMs = clean * 60 * 1000;
        remainingMs = totalMs;
        renderTimer();
      }
    }
    savePrefs();
  }

  focusInput.addEventListener("change", () => applyDurationChange("focus", focusInput.value));
  breakInput.addEventListener("change", () => applyDurationChange("break", breakInput.value));

  stepButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const delta = parseInt(btn.dataset.delta, 10);
      if (targetId === "focusMinutes") {
        applyDurationChange("focus", prefs.focusMin + delta);
      } else {
        applyDurationChange("break", prefs.breakMin + delta);
      }
    });
  });

  function renderBellToggle() {
    bellToggle.classList.toggle("active", prefs.bellEnabled);
    bellToggle.setAttribute("aria-pressed", String(prefs.bellEnabled));
    bellToggle.textContent = prefs.bellEnabled ? "Activa" : "Silencio";
  }

  bellToggle.addEventListener("click", () => {
    prefs.bellEnabled = !prefs.bellEnabled;
    renderBellToggle();
    savePrefs();
  });

  testBellBtn.addEventListener("click", () => {
    const prev = prefs.bellEnabled;
    prefs.bellEnabled = true;
    playChime("break");
    prefs.bellEnabled = prev;
  });

  // Sync Toggle
  function renderSyncToggle() {
    syncMusicToggle.classList.toggle("active", prefs.syncMusic);
    syncMusicToggle.setAttribute("aria-pressed", String(prefs.syncMusic));
    syncMusicToggle.textContent = prefs.syncMusic ? "Sincronizar: Sí" : "Sincronizar: No";
  }

  syncMusicToggle.addEventListener("click", () => {
    prefs.syncMusic = !prefs.syncMusic;
    renderSyncToggle();
    savePrefs();
  });

  // Music Tabs (keep both panels mounted so playback never drops)
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      activeMusicTab = target;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      panelLocal.classList.toggle("active", target === "local");
      panelSpotify.classList.toggle("active", target === "spotify");
    });
  });

  // Local MP3 Player
  let currentObjectUrl = null;
  let isSeeking = false;

  function loadAudioFile(file) {
    if (!file) return;
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
    currentObjectUrl = URL.createObjectURL(file);
    localAudio.src = currentObjectUrl;
    localAudio.loop = prefs.loop;
    localAudio.volume = prefs.volume;

    trackNameEl.textContent = file.name;
    trackNameEl.classList.add("loaded");
    audioPlayBtn.disabled = false;
    seekSlider.disabled = false;

    localAudio.play().catch(() => {});
  }

  pickFileBtn.addEventListener("click", () => audioFileInput.click());
  audioFileInput.addEventListener("change", () => {
    if (audioFileInput.files && audioFileInput.files[0]) {
      loadAudioFile(audioFileInput.files[0]);
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      loadAudioFile(file);
    }
  });

  audioPlayBtn.addEventListener("click", () => {
    if (!localAudio.src) return;
    if (localAudio.paused) {
      localAudio.play().catch(() => {});
    } else {
      localAudio.pause();
    }
  });

  localAudio.addEventListener("play", () => audioPlayBtn.classList.add("playing"));
  localAudio.addEventListener("pause", () => audioPlayBtn.classList.remove("playing"));
  localAudio.addEventListener("ended", () => {
    if (!localAudio.loop) {
      audioPlayBtn.classList.remove("playing");
    }
  });

  localAudio.addEventListener("loadedmetadata", () => {
    seekSlider.max = String(localAudio.duration || 0);
    audioDurationEl.textContent = formatAudioTime(localAudio.duration);
  });

  localAudio.addEventListener("timeupdate", () => {
    if (!isSeeking) {
      seekSlider.value = String(localAudio.currentTime || 0);
    }
    audioCurrentTimeEl.textContent = formatAudioTime(localAudio.currentTime);
  });

  seekSlider.addEventListener("input", () => {
    isSeeking = true;
    audioCurrentTimeEl.textContent = formatAudioTime(parseFloat(seekSlider.value));
  });

  seekSlider.addEventListener("change", () => {
    localAudio.currentTime = parseFloat(seekSlider.value);
    isSeeking = false;
  });

  volumeSlider.addEventListener("input", () => {
    const vol = parseFloat(volumeSlider.value);
    localAudio.volume = vol;
    prefs.volume = vol;
    savePrefs();
  });

  function renderLoopToggle() {
    localAudio.loop = prefs.loop;
    loopToggle.classList.toggle("active", prefs.loop);
    loopToggle.setAttribute("aria-pressed", String(prefs.loop));
    loopToggle.textContent = prefs.loop ? "Bucle: Sí" : "Bucle: No";
  }

  loopToggle.addEventListener("click", () => {
    prefs.loop = !prefs.loop;
    renderLoopToggle();
    savePrefs();
  });

  // Spotify Embed via official IFrame API (with plain iframe fallback)
  function parseSpotifyInput(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const uriMatch = trimmed.match(/^spotify:(playlist|album|track|episode|show):([A-Za-z0-9]+)$/i);
    if (uriMatch) {
      const type = uriMatch[1].toLowerCase();
      const id = uriMatch[2];
      return {
        uri: `spotify:${type}:${id}`,
        embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
      };
    }

    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes("spotify.com")) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const validTypes = ["playlist", "album", "track", "episode", "show"];
      for (let i = 0; i < parts.length - 1; i++) {
        if (validTypes.includes(parts[i])) {
          const type = parts[i];
          const id = parts[i + 1];
          if (/^[A-Za-z0-9]+$/.test(id)) {
            return {
              uri: `spotify:${type}:${id}`,
              embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`,
            };
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  function mountPlainSpotifyIframe(embedUrl) {
    spotifyEmbedWrap.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.loading = "lazy";
    iframe.title = "Reproductor de Spotify";
    spotifyEmbedWrap.appendChild(iframe);
  }

  function mountSpotifyWithApi(parsed) {
    if (fallbackTimerId) {
      clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }

    if (spotifyController) {
      spotifyController.loadUri(parsed.uri);
      return;
    }

    spotifyEmbedWrap.innerHTML = '<div id="spotifyEmbedMount"></div>';
    const mountEl = document.getElementById("spotifyEmbedMount");
    spotifyIFrameAPI.createController(
      mountEl,
      {
        uri: parsed.uri,
        width: "100%",
        height: 152,
        theme: "dark",
      },
      (controller) => {
        spotifyController = controller;
      }
    );
  }

  function renderSpotifyEmbed(rawUrl, persist = true) {
    const parsed = parseSpotifyInput(rawUrl);
    if (!parsed) {
      spotifyError.textContent = "Enlace no válido. Pega una URL de playlist, álbum o canción de open.spotify.com.";
      spotifyError.hidden = false;
      return;
    }

    spotifyError.hidden = true;
    pendingSpotifyParsed = parsed;

    if (spotifyIFrameAPI) {
      mountSpotifyWithApi(parsed);
    } else {
      // Wait briefly for the official IFrame API script; fall back to plain embed if unavailable
      if (fallbackTimerId) clearTimeout(fallbackTimerId);
      fallbackTimerId = setTimeout(() => {
        if (!spotifyIFrameAPI && pendingSpotifyParsed) {
          mountPlainSpotifyIframe(pendingSpotifyParsed.embedUrl);
        }
      }, 2500);
    }

    if (persist) {
      prefs.spotifyUrl = rawUrl.trim();
      savePrefs();
    }
  }

  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    spotifyIFrameAPI = IFrameAPI;
    if (pendingSpotifyParsed) {
      mountSpotifyWithApi(pendingSpotifyParsed);
    }
  };

  spotifyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    renderSpotifyEmbed(spotifyUrlInput.value, true);
  });

  // Fullscreen Zen Mode (shape only, music keeps playing)
  function enterZenFullscreen() {
    body.classList.add("zen-fullscreen");
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function exitZenFullscreen() {
    body.classList.remove("zen-fullscreen");
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  fullscreenBtn.addEventListener("click", enterZenFullscreen);
  exitFullscreenBtn.addEventListener("click", exitZenFullscreen);

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      body.classList.remove("zen-fullscreen");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("zen-fullscreen")) {
      exitZenFullscreen();
    }
  });

  // Initial Hydration
  focusInput.value = String(prefs.focusMin);
  breakInput.value = String(prefs.breakMin);
  volumeSlider.value = String(prefs.volume);
  localAudio.volume = prefs.volume;
  applyTheme(prefs.theme, false);
  renderBellToggle();
  renderSyncToggle();
  renderLoopToggle();
  if (prefs.spotifyUrl) {
    spotifyUrlInput.value = prefs.spotifyUrl;
    renderSpotifyEmbed(prefs.spotifyUrl, false);
  }
  renderTimer();
})();

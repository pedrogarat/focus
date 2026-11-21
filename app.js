(() => {
  const STORAGE_KEY = "focus_pomodoro_prefs_v1";
  const SPOTIFY_AUTH_KEY = "focus_spotify_auth_v1";
  const SPOTIFY_VERIFIER_KEY = "focus_spotify_pkce_verifier";
  const SPOTIFY_CLIENT_ID = "cdbfa9b02472458a88725218f92650b3";
  const DEFAULT_SPOTIFY_URL = "https://open.spotify.com/playlist/0bRF8dCUmHGDR0r7Nm21OS?si=f3c6d4217371447e";
  const SPOTIFY_SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

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
  const panelSpotify = document.getElementById("panelSpotify");
  const panelYoutube = document.getElementById("panelYoutube");
  const panelLocal = document.getElementById("panelLocal");
  const musicSettingsBtn = document.getElementById("musicSettingsBtn");
  const musicSettingsPopover = document.getElementById("musicSettingsPopover");
  const syncMusicToggle = document.getElementById("syncMusicToggle");

  // DOM elements — Spotify SDK
  const spotifyConnectBox = document.getElementById("spotifyConnectBox");
  const spotifyConnectedBar = document.getElementById("spotifyConnectedBar");
  const spotifyConnectBtn = document.getElementById("spotifyConnectBtn");
  const spotifyStatusText = document.getElementById("spotifyStatusText");
  const spotifyDisconnectBtn = document.getElementById("spotifyDisconnectBtn");
  const spotifyForm = document.getElementById("spotifyForm");
  const spotifyUrlInput = document.getElementById("spotifyUrlInput");
  const spotifyCover = document.getElementById("spotifyCover");
  const spotifyTrackTitle = document.getElementById("spotifyTrackTitle");
  const spotifyTrackArtist = document.getElementById("spotifyTrackArtist");
  const spotifyPrevBtn = document.getElementById("spotifyPrevBtn");
  const spotifyPlayPauseBtn = document.getElementById("spotifyPlayPauseBtn");
  const spotifyNextBtn = document.getElementById("spotifyNextBtn");
  const spotifyVolumeSlider = document.getElementById("spotifyVolumeSlider");
  const spotifyError = document.getElementById("spotifyError");

  // DOM elements — YouTube
  const youtubeForm = document.getElementById("youtubeForm");
  const youtubeUrlInput = document.getElementById("youtubeUrlInput");
  const youtubeError = document.getElementById("youtubeError");
  const youtubePlaceholder = document.getElementById("youtubePlaceholder");

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
    activeTab: "spotify",
    spotifyClientId: "",
    spotifyUrl: DEFAULT_SPOTIFY_URL,
    youtubeUrl: "",
  };

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const merged = { ...defaultPrefs, ...saved };
      if (!merged.spotifyUrl) merged.spotifyUrl = DEFAULT_SPOTIFY_URL;
      if (!["default", "kids", "basket"].includes(merged.theme)) merged.theme = "default";
      if (!["spotify", "youtube", "local"].includes(merged.activeTab)) merged.activeTab = "spotify";
      return merged;
    } catch {
      return { ...defaultPrefs };
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
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
  let activeMusicTab = prefs.activeTab;

  // Spotify SDK State
  let spotifySdkReady = false;
  let spotifyPlayer = null;
  let spotifyDeviceId = null;
  let spotifyIsPaused = true;
  let spotifyHasTrack = false;
  let spotifyLoadedUri = "";

  // YouTube State
  let ytApiReady = false;
  let ytPlayer = null;
  let ytPlayerReady = false;
  let pendingYoutubeTarget = null;

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

  // Pause all music sources except `keepSource` so only one plays at a time
  function pauseOtherSources(keepSource) {
    if (keepSource !== "spotify" && spotifyPlayer) {
      spotifyPlayer.pause().catch(() => {});
    }
    if (keepSource !== "youtube" && ytPlayer && ytPlayerReady) {
      try {
        ytPlayer.pauseVideo();
      } catch {
        // Ignore player state errors
      }
    }
    if (keepSource !== "local" && localAudio && !localAudio.paused) {
      localAudio.pause();
    }
  }

  // Sync Timer Play/Pause -> Active Music Player
  function syncMusicWithTimer(shouldPlay) {
    if (!prefs.syncMusic) return;

    if (shouldPlay) {
      pauseOtherSources(activeMusicTab);
    }

    if (activeMusicTab === "spotify") {
      if (!spotifyPlayer || !spotifyDeviceId) return;
      if (shouldPlay) {
        if (typeof spotifyPlayer.activateElement === "function") {
          spotifyPlayer.activateElement().catch(() => {});
        }
        if (spotifyHasTrack) {
          spotifyPlayer.resume().catch(() => {});
        } else {
          playSpotifyFromInput();
        }
      } else {
        spotifyPlayer.pause().catch(() => {});
      }
    } else if (activeMusicTab === "youtube") {
      if (!ytPlayer || !ytPlayerReady) return;
      try {
        if (shouldPlay) {
          ytPlayer.playVideo();
        } else {
          ytPlayer.pauseVideo();
        }
      } catch {
        // Ignore player state errors
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

  // Music Settings Popover & Sync Toggle
  function setSettingsOpen(open) {
    musicSettingsPopover.hidden = !open;
    musicSettingsBtn.classList.toggle("open", open);
    musicSettingsBtn.setAttribute("aria-expanded", String(open));
  }

  musicSettingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSettingsOpen(musicSettingsPopover.hidden);
  });

  musicSettingsPopover.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (!musicSettingsPopover.hidden) {
      setSettingsOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !musicSettingsPopover.hidden) {
      setSettingsOpen(false);
    }
  });

  function renderSyncToggle() {
    syncMusicToggle.classList.toggle("active", prefs.syncMusic);
    syncMusicToggle.setAttribute("aria-checked", String(prefs.syncMusic));
  }

  syncMusicToggle.addEventListener("click", () => {
    prefs.syncMusic = !prefs.syncMusic;
    renderSyncToggle();
    savePrefs();
  });

  // Music Tabs
  function setActiveMusicTab(target, persist = true) {
    if (target !== activeMusicTab) {
      pauseOtherSources(target);
    }
    activeMusicTab = target;
    tabs.forEach((t) => {
      const active = t.dataset.tab === target;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
    });
    panelSpotify.classList.toggle("active", target === "spotify");
    panelYoutube.classList.toggle("active", target === "youtube");
    panelLocal.classList.toggle("active", target === "local");
    if (persist) {
      prefs.activeTab = target;
      savePrefs();
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveMusicTab(tab.dataset.tab, true));
  });

  // =========================================================================
  // SPOTIFY WEB PLAYBACK SDK (OAuth 2.0 PKCE — sin servidor)
  // =========================================================================
  function getSpotifyRedirectUri() {
    return window.location.origin + window.location.pathname;
  }

  function showSpotifyError(msg) {
    if (!msg) {
      spotifyError.hidden = true;
      spotifyError.textContent = "";
    } else {
      spotifyError.textContent = msg;
      spotifyError.hidden = false;
    }
  }

  function loadSpotifyAuth() {
    try {
      return JSON.parse(localStorage.getItem(SPOTIFY_AUTH_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSpotifyAuth(auth) {
    try {
      if (!auth) {
        localStorage.removeItem(SPOTIFY_AUTH_KEY);
      } else {
        localStorage.setItem(SPOTIFY_AUTH_KEY, JSON.stringify(auth));
      }
    } catch {
      // Ignore storage errors
    }
  }

  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (v) => chars[v % chars.length]).join("");
  }

  async function sha256Base64Url(plain) {
    const data = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  async function startSpotifyLogin() {
    if (window.location.protocol === "file:") {
      showSpotifyError("Spotify Web Playback SDK requiere abrir la app por https:// (tu enlace de GitHub Pages) o http://127.0.0.1.");
      return;
    }

    showSpotifyError("");

    const verifier = randomString(64);
    const challenge = await sha256Base64Url(verifier);
    localStorage.setItem(SPOTIFY_VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: getSpotifyRedirectUri(),
      scope: SPOTIFY_SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async function handleSpotifyCallbackIfPresent() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");

    if (err) {
      showSpotifyError(`Spotify devolvió un error: ${err}`);
      url.searchParams.delete("error");
      history.replaceState({}, document.title, url.pathname);
      return;
    }

    if (!code) return;

    const verifier = localStorage.getItem(SPOTIFY_VERIFIER_KEY);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    history.replaceState({}, document.title, url.pathname);

    if (!verifier) {
      showSpotifyError("Faltan datos de verificación PKCE. Pulsa Conectar con Spotify de nuevo.");
      return;
    }

    try {
      const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: getSpotifyRedirectUri(),
          code_verifier: verifier,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || "No se pudo obtener el token");
      }

      saveSpotifyAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in - 60) * 1000,
      });
      localStorage.removeItem(SPOTIFY_VERIFIER_KEY);
    } catch (e) {
      showSpotifyError(`Error al conectar con Spotify: ${e.message}`);
    }
  }

  async function getValidSpotifyToken() {
    const auth = loadSpotifyAuth();
    if (!auth) return null;

    if (Date.now() < auth.expires_at && auth.access_token) {
      return auth.access_token;
    }

    if (!auth.refresh_token) {
      disconnectSpotify();
      return null;
    }

    try {
      const resp = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: auth.refresh_token,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.access_token) {
        disconnectSpotify();
        return null;
      }

      const updated = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || auth.refresh_token,
        expires_at: Date.now() + (data.expires_in - 60) * 1000,
      };
      saveSpotifyAuth(updated);
      return updated.access_token;
    } catch {
      return null;
    }
  }

  function updateSpotifyAuthUI() {
    const auth = loadSpotifyAuth();
    const loggedIn = Boolean(auth && auth.access_token);
    spotifyConnectBox.hidden = loggedIn;
    spotifyConnectedBar.hidden = !loggedIn;
  }

  function disconnectSpotify() {
    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
      spotifyPlayer = null;
    }
    spotifyDeviceId = null;
    spotifyHasTrack = false;
    spotifyIsPaused = true;
    spotifyLoadedUri = "";
    saveSpotifyAuth(null);
    updateSpotifyAuthUI();
    spotifyPlayPauseBtn.classList.remove("playing");
    spotifyCover.hidden = true;
    spotifyTrackTitle.textContent = "Playlist lista";
    spotifyTrackArtist.textContent = "Pulsa Play o Iniciar crono";
  }

  function parseSpotifyUri(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const uriMatch = trimmed.match(/^spotify:(playlist|album|track|artist):([A-Za-z0-9]+)$/i);
    if (uriMatch) {
      return { type: uriMatch[1].toLowerCase(), id: uriMatch[2], uri: `spotify:${uriMatch[1].toLowerCase()}:${uriMatch[2]}` };
    }

    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes("spotify.com")) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      const validTypes = ["playlist", "album", "track", "artist"];
      for (let i = 0; i < parts.length - 1; i++) {
        if (validTypes.includes(parts[i]) && /^[A-Za-z0-9]+$/.test(parts[i + 1])) {
          const type = parts[i];
          const id = parts[i + 1];
          return { type, id, uri: `spotify:${type}:${id}` };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  async function initSpotifyPlayerIfReady() {
    if (!spotifySdkReady || spotifyPlayer) return;
    const token = await getValidSpotifyToken();
    if (!token || !window.Spotify) return;

    spotifyStatusText.textContent = "Conectando reproductor...";

    spotifyPlayer = new window.Spotify.Player({
      name: "Focus Pomodoro",
      getOAuthToken: async (cb) => {
        const freshToken = await getValidSpotifyToken();
        if (freshToken) cb(freshToken);
      },
      volume: prefs.volume,
    });

    spotifyPlayer.addListener("ready", ({ device_id }) => {
      spotifyDeviceId = device_id;
      spotifyStatusText.textContent = "Conectado · Spotify Premium";
      showSpotifyError("");
    });

    spotifyPlayer.addListener("not_ready", () => {
      spotifyStatusText.textContent = "Reproductor desconectado";
    });

    spotifyPlayer.addListener("initialization_error", ({ message }) => {
      showSpotifyError(`Error de inicialización: ${message}`);
    });

    spotifyPlayer.addListener("authentication_error", ({ message }) => {
      showSpotifyError(`Sesión caducada (${message}). Vuelve a conectar.`);
      disconnectSpotify();
    });

    spotifyPlayer.addListener("account_error", () => {
      showSpotifyError("Se necesita una cuenta Spotify Premium para reproducir con el SDK.");
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;
      spotifyIsPaused = state.paused;
      spotifyPlayPauseBtn.classList.toggle("playing", !state.paused);
      if (!state.paused) {
        pauseOtherSources("spotify");
      }

      const track = state.track_window?.current_track;
      if (track) {
        spotifyHasTrack = true;
        spotifyTrackTitle.textContent = track.name || "Sin título";
        spotifyTrackArtist.textContent = (track.artists || []).map((a) => a.name).join(", ");
        const imgUrl = track.album?.images?.[0]?.url;
        if (imgUrl) {
          spotifyCover.src = imgUrl;
          spotifyCover.hidden = false;
        }
      }
    });

    spotifyPlayer.connect();
  }

  async function playSpotifyFromInput() {
    const parsed = parseSpotifyUri(spotifyUrlInput.value);
    if (!parsed) {
      showSpotifyError("Enlace no válido. Pega una URL de playlist, álbum o canción de Spotify.");
      return;
    }

    if (!spotifyDeviceId) {
      const auth = loadSpotifyAuth();
      if (!auth || !auth.access_token) {
        showSpotifyError("Conecta tu cuenta de Spotify en el icono ⚙️.");
        setTimeout(() => setSettingsOpen(true), 0);
      } else {
        showSpotifyError("El reproductor de Spotify aún está conectando. Espera un segundo e inténtalo de nuevo.");
      }
      return;
    }

    showSpotifyError("");
    prefs.spotifyUrl = spotifyUrlInput.value.trim();
    savePrefs();

    const token = await getValidSpotifyToken();
    if (!token) {
      showSpotifyError("Vuelve a conectar tu cuenta de Spotify.");
      return;
    }

    if (spotifyPlayer && typeof spotifyPlayer.activateElement === "function") {
      await spotifyPlayer.activateElement().catch(() => {});
    }

    const payload = parsed.type === "track" ? { uris: [parsed.uri] } : { context_uri: parsed.uri };

    try {
      const resp = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${resp.status}`);
      }

      spotifyLoadedUri = parsed.uri;
      spotifyHasTrack = true;
    } catch (e) {
      showSpotifyError(`No se pudo iniciar la reproducción: ${e.message}`);
    }
  }

  window.onSpotifyWebPlaybackSDKReady = () => {
    spotifySdkReady = true;
    initSpotifyPlayerIfReady();
  };

  spotifyConnectBtn.addEventListener("click", startSpotifyLogin);
  spotifyDisconnectBtn.addEventListener("click", disconnectSpotify);
  spotifyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    playSpotifyFromInput();
  });

  spotifyPlayPauseBtn.addEventListener("click", async (e) => {
    if (!spotifyPlayer || !spotifyDeviceId) {
      const auth = loadSpotifyAuth();
      if (!auth || !auth.access_token) {
        e.stopPropagation();
        showSpotifyError("Conecta tu cuenta de Spotify en el icono ⚙️.");
        setSettingsOpen(true);
      }
      return;
    }
    if (typeof spotifyPlayer.activateElement === "function") {
      await spotifyPlayer.activateElement().catch(() => {});
    }
    const parsed = parseSpotifyUri(spotifyUrlInput.value);
    if (!spotifyHasTrack || (parsed && parsed.uri !== spotifyLoadedUri)) {
      await playSpotifyFromInput();
    } else if (spotifyIsPaused) {
      spotifyPlayer.resume().catch(() => {});
    } else {
      spotifyPlayer.pause().catch(() => {});
    }
  });

  spotifyPrevBtn.addEventListener("click", () => spotifyPlayer?.previousTrack().catch(() => {}));
  spotifyNextBtn.addEventListener("click", () => spotifyPlayer?.nextTrack().catch(() => {}));

  spotifyVolumeSlider.addEventListener("input", () => {
    const vol = parseFloat(spotifyVolumeSlider.value);
    prefs.volume = vol;
    localAudio.volume = vol;
    volumeSlider.value = String(vol);
    spotifyPlayer?.setVolume(vol).catch(() => {});
    savePrefs();
  });

  // =========================================================================
  // YOUTUBE PLAYER (YouTube IFrame Player API — playlists y vídeos)
  // =========================================================================
  function showYoutubeError(msg) {
    if (!msg) {
      youtubeError.hidden = true;
      youtubeError.textContent = "";
    } else {
      youtubeError.textContent = msg;
      youtubeError.hidden = false;
    }
  }

  function parseYoutubeInput(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "");
      if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
        return null;
      }

      const listId = url.searchParams.get("list");
      let videoId = url.searchParams.get("v");

      if (!videoId && host === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || null;
      }
      if (!videoId) {
        const parts = url.pathname.split("/").filter(Boolean);
        if ((parts[0] === "live" || parts[0] === "shorts" || parts[0] === "embed") && parts[1]) {
          videoId = parts[1];
        }
      }

      if (listId) {
        return { kind: "playlist", listId, videoId: videoId || null };
      }
      if (videoId) {
        return { kind: "video", videoId };
      }
    } catch {
      return null;
    }
    return null;
  }

  function mountOrUpdateYoutube(target, autoplay = false) {
    if (!target) return;
    if (autoplay) {
      pauseOtherSources("youtube");
    }
    pendingYoutubeTarget = target;
    youtubePlaceholder.hidden = true;

    if (!ytApiReady || !window.YT || !window.YT.Player) {
      return;
    }

    if (ytPlayer && ytPlayerReady) {
      if (target.kind === "playlist") {
        if (autoplay) {
          ytPlayer.loadPlaylist({ list: target.listId, listType: "playlist", index: 0 });
        } else {
          ytPlayer.cuePlaylist({ list: target.listId, listType: "playlist", index: 0 });
        }
      } else {
        if (autoplay) {
          ytPlayer.loadVideoById(target.videoId);
        } else {
          ytPlayer.cueVideoById(target.videoId);
        }
      }
      return;
    }

    const playerVars = {
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    };

    const config = {
      width: "100%",
      height: "196",
      playerVars,
      events: {
        onReady: () => {
          ytPlayerReady = true;
          if (pendingYoutubeTarget && pendingYoutubeTarget.kind === "playlist") {
            if (autoplay) {
              ytPlayer.loadPlaylist({ list: pendingYoutubeTarget.listId, listType: "playlist", index: 0 });
            } else {
              ytPlayer.cuePlaylist({ list: pendingYoutubeTarget.listId, listType: "playlist", index: 0 });
            }
          }
        },
        onStateChange: (event) => {
          if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
            pauseOtherSources("youtube");
          }
        },
      },
    };

    if (target.kind === "video") {
      config.videoId = target.videoId;
      if (autoplay) playerVars.autoplay = 1;
    } else if (target.videoId) {
      config.videoId = target.videoId;
      playerVars.listType = "playlist";
      playerVars.list = target.listId;
      if (autoplay) playerVars.autoplay = 1;
    } else {
      playerVars.listType = "playlist";
      playerVars.list = target.listId;
    }

    ytPlayer = new window.YT.Player("youtubePlayerMount", config);
  }

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    if (pendingYoutubeTarget) {
      mountOrUpdateYoutube(pendingYoutubeTarget, false);
    }
  };

  youtubeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const parsed = parseYoutubeInput(youtubeUrlInput.value);
    if (!parsed) {
      showYoutubeError("Enlace no válido. Pega una URL de playlist o vídeo de YouTube.");
      return;
    }
    showYoutubeError("");
    prefs.youtubeUrl = youtubeUrlInput.value.trim();
    savePrefs();
    mountOrUpdateYoutube(parsed, true);
  });

  // =========================================================================
  // LOCAL MP3 PLAYER
  // =========================================================================
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

  localAudio.addEventListener("play", () => {
    audioPlayBtn.classList.add("playing");
    pauseOtherSources("local");
  });
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
    spotifyVolumeSlider.value = String(vol);
    spotifyPlayer?.setVolume(vol).catch(() => {});
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

  // =========================================================================
  // PLAYLIST SUGGESTIONS
  // =========================================================================
  const suggestionChips = document.querySelectorAll(".suggestion-chip");
  suggestionChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const source = chip.dataset.source;
      const url = chip.dataset.url;
      if (!url) return;

      if (source === "spotify") {
        setActiveMusicTab("spotify", true);
        spotifyUrlInput.value = url;
        prefs.spotifyUrl = url;
        savePrefs();
        if (spotifyDeviceId) {
          playSpotifyFromInput();
        } else {
          showSpotifyError("");
        }
      } else if (source === "youtube") {
        setActiveMusicTab("youtube", true);
        youtubeUrlInput.value = url;
        prefs.youtubeUrl = url;
        savePrefs();
        const parsed = parseYoutubeInput(url);
        if (parsed) {
          showYoutubeError("");
          mountOrUpdateYoutube(parsed, true);
        }
      }
    });
  });

  // =========================================================================
  // FULLSCREEN ZEN MODE
  // =========================================================================
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

  // =========================================================================
  // INITIAL HYDRATION
  // =========================================================================
  async function init() {
    focusInput.value = String(prefs.focusMin);
    breakInput.value = String(prefs.breakMin);
    volumeSlider.value = String(prefs.volume);
    spotifyVolumeSlider.value = String(prefs.volume);
    localAudio.volume = prefs.volume;
    spotifyUrlInput.value = prefs.spotifyUrl;

    applyTheme(prefs.theme, false);
    setActiveMusicTab(prefs.activeTab, false);
    renderBellToggle();
    renderSyncToggle();
    renderLoopToggle();

    if (prefs.youtubeUrl) {
      youtubeUrlInput.value = prefs.youtubeUrl;
      const parsedYt = parseYoutubeInput(prefs.youtubeUrl);
      if (parsedYt) mountOrUpdateYoutube(parsedYt, false);
    }

    await handleSpotifyCallbackIfPresent();
    updateSpotifyAuthUI();
    initSpotifyPlayerIfReady();
    renderTimer();
  }

  init();
})();

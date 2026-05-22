// ============================================================
// LUMI — webcam.js
// Webcam feed, presence detection, inactivity system
// ============================================================

const LumiWebcam = (() => {
  let stream = null;
  let isActive = false;
  let inactivityTimer = null;
  let presenceInterval = null;
  let inFocusSavingMode = false;
  let lastMotionTime = Date.now();
  let previousFrame = null;
  let motionCanvas = null;
  let motionCtx = null;
  let videoEl = null;
  let cameraStarted = false;

  const $ = (id) => document.getElementById(id);

  async function startCamera() {
    if (cameraStarted) return;
    videoEl = $("webcam-video");
    if (!videoEl) return;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      isActive = true;
      cameraStarted = true;

      motionCanvas = document.createElement("canvas");
      motionCanvas.width = 80;
      motionCanvas.height = 60;
      motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true });

      startPresenceMonitoring();
      updateCameraStatus("online");
      console.log("✦ LUMI Webcam started");
    } catch (err) {
      console.warn("Webcam access denied:", err);
      updateCameraStatus("denied");
      showCameraError();
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    isActive = false;
    cameraStarted = false;
    stopPresenceMonitoring();
    updateCameraStatus("offline");
  }

  function startPresenceMonitoring() {
    presenceInterval = setInterval(checkMotion, LUMI_CONFIG.PRESENCE_CHECK_INTERVAL_MS);
    resetInactivityTimer();
  }

  function stopPresenceMonitoring() {
    if (presenceInterval) clearInterval(presenceInterval);
    if (inactivityTimer) clearTimeout(inactivityTimer);
  }

  function checkMotion() {
    if (!videoEl || !motionCtx || videoEl.readyState < 2) return;

    motionCtx.drawImage(videoEl, 0, 0, motionCanvas.width, motionCanvas.height);
    const currentFrame = motionCtx.getImageData(0, 0, motionCanvas.width, motionCanvas.height);

    if (previousFrame) {
      const motionScore = calculateMotion(previousFrame.data, currentFrame.data);
      if (motionScore > 15) {
        lastMotionTime = Date.now();
        if (inFocusSavingMode) exitFocusSavingMode();
        resetInactivityTimer();
        updateMotionIndicator(motionScore);
      }
    }
    previousFrame = currentFrame;
  }

  function calculateMotion(prev, curr) {
    let diff = 0;
    const sampleRate = 4;
    for (let i = 0; i < prev.length; i += 4 * sampleRate) {
      diff += Math.abs(prev[i]   - curr[i]);
      diff += Math.abs(prev[i+1] - curr[i+1]);
      diff += Math.abs(prev[i+2] - curr[i+2]);
    }
    return diff / (prev.length / (4 * sampleRate) * 3);
  }

  function updateMotionIndicator(score) {
    const indicator = $("motion-indicator");
    if (!indicator) return;
    const intensity = Math.min(score / 50, 1);
    indicator.style.opacity = 0.3 + intensity * 0.7;
  }

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(enterFocusSavingMode, LUMI_CONFIG.INACTIVITY_TIMEOUT_MS);
  }

  function enterFocusSavingMode() {
    if (inFocusSavingMode) return;
    inFocusSavingMode = true;
    document.body.classList.add("focus-saving-mode");
    showFocusSavingNotification();
    if (window.LumiVoice && LumiVoice.isListening()) LumiVoice.stopListening();
    if (window.LumiOrb) LumiOrb.setState("sleeping");
    updatePresenceStatus("away");
  }

  function exitFocusSavingMode() {
    if (!inFocusSavingMode) return;
    inFocusSavingMode = false;
    document.body.classList.remove("focus-saving-mode");
    hideFocusSavingNotification();
    if (window.LumiOrb) LumiOrb.setState("idle");
    updatePresenceStatus("present");

    const greetings = LUMI_CONFIG.RETURN_GREETINGS;
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    setTimeout(() => {
      if (window.LumiVoice) LumiVoice.speak(greeting);
      if (window.LumiChat) LumiChat.sendMessage(greeting);
    }, 800);
  }

  function showFocusSavingNotification() {
    const notif = $("focus-saving-notif");
    if (notif) {
      notif.innerHTML = `
        <div class="focus-notif-icon">⏾</div>
        <div class="focus-notif-text">
          <strong>LUMI detected inactivity.</strong><br>
          Entering focus-saving mode.
        </div>`;
      notif.classList.add("visible");
    }
  }

  function hideFocusSavingNotification() {
    const notif = $("focus-saving-notif");
    if (notif) notif.classList.remove("visible");
  }

  function showCameraError() {
    const panel = $("webcam-panel");
    if (panel) {
      const placeholder = panel.querySelector(".camera-placeholder");
      if (placeholder) {
        placeholder.innerHTML = `
          <div class="cam-error">
            <div style="font-size:2rem">📷</div>
            <p>Camera access denied</p>
            <small>Enable camera permissions and reload</small>
          </div>`;
      }
    }
  }

  function updateCameraStatus(status) {
    const statusEl = $("cam-status");
    if (!statusEl) return;
    const labels = {
      online:  "🟢 Camera Active",
      offline: "⚫ Camera Off",
      denied:  "🔴 Camera Denied",
    };
    statusEl.textContent = labels[status] || status;
    statusEl.className = `cam-status ${status}`;
  }

  function updatePresenceStatus(status) {
    const el = $("presence-status");
    if (!el) return;
    const labels = {
      present: "👤 User Present",
      away:    "👻 User Away",
    };
    el.textContent = labels[status] || status;
    el.className = `presence-status ${status}`;
  }

  function bindActivityEvents() {
    ["mousemove", "keydown", "click", "touchstart"].forEach((evt) => {
      document.addEventListener(evt, () => {
        lastMotionTime = Date.now();
        if (inFocusSavingMode) exitFocusSavingMode();
        if (!inFocusSavingMode) resetInactivityTimer();
      }, { passive: true });
    });
  }

  function init() {
    const startBtn = $("start-camera-btn");
    startBtn?.addEventListener("click", startCamera);

    const stopBtn = $("stop-camera-btn");
    stopBtn?.addEventListener("click", stopCamera);

    bindActivityEvents();
    setTimeout(startCamera, 1500);
    console.log("✦ LUMI Webcam module initialized");
  }

  return {
    init,
    startCamera,
    stopCamera,
    isActive: () => isActive,
    inFocusSavingMode: () => inFocusSavingMode,
    resetInactivityTimeout: resetInactivityTimer,
  };
})();

window.LumiWebcam = LumiWebcam;
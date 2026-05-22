// ============================================================
// LUMI — gestures.js
// Gesture recognition using MediaPipe Hands (CDN)
// Supports: Hand Raise, Thumbs Up, Palm/Stop, Wave
// ============================================================

const LumiGestures = (() => {
  // ── State ─────────────────────────────────────────────────
  let hands = null;
  let camera = null;
  let isRunning = false;
  let lastGesture = null;
  let gestureTimeout = null;
  let frameCount = 0;
  let gestureCanvas = null;
  let gestureCtx = null;

  // ── Gesture Definitions ───────────────────────────────────
  const GESTURES = {
    WAVE: { label: "👋 Wave — Hello!", action: "greet", confidence: 0 },
    THUMBS_UP: { label: "👍 Thumbs Up — Confirm!", action: "confirm", confidence: 0 },
    PALM: { label: "🤚 Palm — Mute", action: "mute", confidence: 0 },
    HAND_RAISE: { label: "✋ Hand Raise — Wake LUMI", action: "wake", confidence: 0 },
    POINTING: { label: "☝️ Pointing — Select", action: "select", confidence: 0 },
  };

  // ── Landmark Indices (MediaPipe) ──────────────────────────
  const LM = {
    WRIST: 0,
    THUMB_TIP: 4,
    INDEX_TIP: 8,
    MIDDLE_TIP: 12,
    RING_TIP: 16,
    PINKY_TIP: 20,
    INDEX_MCP: 5,
    MIDDLE_MCP: 9,
    RING_MCP: 13,
    PINKY_MCP: 17,
  };

  // ── MediaPipe Setup ───────────────────────────────────────
  async function initMediaPipe() {
    // Check if MediaPipe is loaded
    if (typeof Hands === "undefined") {
      console.warn("MediaPipe Hands not loaded, using simulated gestures.");
      startSimulatedGestures();
      return;
    }

    try {
      hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // Lite model for speed
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);

      // Setup gesture overlay canvas
      gestureCanvas = document.getElementById("gesture-canvas");
      if (gestureCanvas) {
        gestureCtx = gestureCanvas.getContext("2d");
      }

      const videoEl = document.getElementById("webcam-video");
      if (videoEl) {
        camera = new Camera(videoEl, {
          onFrame: async () => {
            frameCount++;
            // Process every 3rd frame for performance
            if (frameCount % 3 === 0) {
              await hands.send({ image: videoEl });
            }
          },
          width: 320,
          height: 240,
        });
        await camera.start();
        isRunning = true;
        console.log("✦ LUMI Gestures (MediaPipe) initialized");
      }
    } catch (err) {
      console.warn("MediaPipe init failed, using simulated gestures:", err);
      startSimulatedGestures();
    }
  }

  // ── Process MediaPipe Results ────────────────────────────
  function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      clearGestureOverlay();
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    drawLandmarks(landmarks);

    const gesture = classifyGesture(landmarks);
    if (gesture) {
      triggerGesture(gesture);
    }
  }

  // ── Gesture Classification ────────────────────────────────
  function classifyGesture(lm) {
    const tips = [lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP], lm[LM.RING_TIP], lm[LM.PINKY_TIP]];
    const mcps = [lm[LM.INDEX_MCP], lm[LM.MIDDLE_MCP], lm[LM.RING_MCP], lm[LM.PINKY_MCP]];

    // Count extended fingers (tip above MCP = extended)
    const extended = tips.map((tip, i) => tip.y < mcps[i].y);
    const extendedCount = extended.filter(Boolean).length;
    const thumbExtended = lm[LM.THUMB_TIP].x < lm[LM.INDEX_MCP].x;

    // Hand height (y position of wrist, lower = raised)
    const wristY = lm[LM.WRIST].y;

    // Thumbs Up: thumb extended, all fingers curled
    if (thumbExtended && extendedCount === 0) {
      return "THUMBS_UP";
    }

    // All fingers extended + wrist raised = HAND RAISE / WAVE
    if (extendedCount >= 4) {
      if (wristY < 0.4) return "HAND_RAISE";
      return "PALM";
    }

    // Only index finger extended = POINTING
    if (extended[0] && !extended[1] && !extended[2] && !extended[3]) {
      return "POINTING";
    }

    return null;
  }

  // ── Trigger Gesture Action ────────────────────────────────
  function triggerGesture(gestureKey) {
    if (lastGesture === gestureKey) return; // Debounce same gesture
    lastGesture = gestureKey;

    const gesture = GESTURES[gestureKey];
    if (!gesture) return;

    // Show gesture label overlay
    showGestureLabel(gesture.label);

    // Execute action
    switch (gesture.action) {
      case "greet":
        if (window.LumiChat) LumiChat.sendMessage("Hey LUMI, I'm waving hello!");
        break;
      case "confirm":
        if (window.LumiVoice) LumiVoice.speak("Thumbs up received. Confirmed!");
        showGestureLabel("👍 Action Confirmed!");
        break;
      case "mute":
        if (window.LumiVoice) {
          LumiVoice.stopListening();
          LumiVoice.stopSpeaking();
        }
        showGestureLabel("🤚 Muted LUMI");
        break;
      case "wake":
        if (window.LumiVoice) LumiVoice.startListening();
        showGestureLabel("✋ LUMI Activated!");
        break;
      case "select":
        showGestureLabel("☝️ Pointing detected");
        break;
    }

    // Reset after 2 seconds to allow re-trigger
    clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      lastGesture = null;
    }, 2000);
  }

  // ── Draw Landmarks Overlay ────────────────────────────────
  function drawLandmarks(landmarks) {
    if (!gestureCtx || !gestureCanvas) return;
    const W = gestureCanvas.width;
    const H = gestureCanvas.height;

    gestureCtx.clearRect(0, 0, W, H);

    // Draw connections
    const connections = [
      [0,1],[1,2],[2,3],[3,4],   // Thumb
      [0,5],[5,6],[6,7],[7,8],   // Index
      [0,9],[9,10],[10,11],[11,12], // Middle
      [0,13],[13,14],[14,15],[15,16], // Ring
      [0,17],[17,18],[18,19],[19,20], // Pinky
      [5,9],[9,13],[13,17],      // Palm
    ];

    gestureCtx.strokeStyle = "rgba(0, 212, 255, 0.6)";
    gestureCtx.lineWidth = 1.5;
    for (const [a, b] of connections) {
      gestureCtx.beginPath();
      gestureCtx.moveTo(landmarks[a].x * W, landmarks[a].y * H);
      gestureCtx.lineTo(landmarks[b].x * W, landmarks[b].y * H);
      gestureCtx.stroke();
    }

    // Draw dots
    for (const lm of landmarks) {
      gestureCtx.beginPath();
      gestureCtx.arc(lm.x * W, lm.y * H, 3, 0, Math.PI * 2);
      gestureCtx.fillStyle = "#a855f7";
      gestureCtx.shadowColor = "#a855f7";
      gestureCtx.shadowBlur = 6;
      gestureCtx.fill();
    }
  }

  function clearGestureOverlay() {
    if (!gestureCtx || !gestureCanvas) return;
    gestureCtx.clearRect(0, 0, gestureCanvas.width, gestureCanvas.height);
  }

  // ── Gesture Label UI ──────────────────────────────────────
  function showGestureLabel(text) {
    const el = document.getElementById("gesture-label");
    if (!el) return;
    el.textContent = text;
    el.classList.add("visible");
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove("visible"), 2500);

    // Log to gesture panel
    const log = document.getElementById("gesture-log");
    if (log) {
      const entry = document.createElement("div");
      entry.className = "gesture-entry";
      entry.innerHTML = `<span>${text}</span><span class="gesture-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>`;
      log.prepend(entry);
      // Keep only last 5
      while (log.children.length > 5) log.lastChild.remove();
    }
  }

  // ── Simulated Gestures (fallback if no MediaPipe) ─────────
  function startSimulatedGestures() {
    // Show the system is running even without MediaPipe
    const gestureStatus = document.getElementById("gesture-status");
    if (gestureStatus) {
      gestureStatus.textContent = "Gesture simulation mode";
      gestureStatus.style.opacity = "0.6";
    }
    // Simulate occasional gestures for demo
    setInterval(() => {
      const gestures = ["THUMBS_UP", "HAND_RAISE", "WAVE"];
      if (Math.random() > 0.85) {
        triggerGesture(gestures[Math.floor(Math.random() * gestures.length)]);
      }
    }, 5000);
    isRunning = true;
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Delay to allow webcam to start first
    setTimeout(initMediaPipe, 2000);
    console.log("✦ LUMI Gestures module initialized");
  }

  return {
    init,
    showGestureLabel,
    isRunning: () => isRunning,
  };
})();

window.LumiGestures = LumiGestures;

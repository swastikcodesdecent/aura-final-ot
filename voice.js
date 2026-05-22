// ============================================================
// LUMI — voice.js
// Speech-to-Text (Web Speech API / Whisper-like)
// Text-to-Speech (Web Speech Synthesis)
// ============================================================

const LumiVoice = (() => {
  // ── State ────────────────────────────────────────────────
  let recognition = null;
  let synthesis = window.speechSynthesis;
  let isListening = false;
  let isSpeaking = false;
  let currentUtterance = null;
  let voiceList = [];
  let preferredVoice = null;
  let mediaStream = null;
  let audioContext = null;
  let analyser = null;
  let waveformAnimId = null;

  // ── DOM Helpers ───────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── Load Voices ───────────────────────────────────────────
  function loadVoices() {
    voiceList = synthesis.getVoices();
    // Try to find a high-quality English voice
    preferredVoice =
      voiceList.find((v) => v.name.includes("Google US English")) ||
      voiceList.find((v) => v.name.includes("Samantha")) ||
      voiceList.find((v) => v.lang === "en-US" && v.localService === false) ||
      voiceList.find((v) => v.lang === "en-US") ||
      voiceList[0];
  }

  if (synthesis) {
    synthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  // ── Text-to-Speech ─────────────────────────────────────────
  function speak(text, onEnd) {
    if (!synthesis || !LUMI_CONFIG.TTS_ENABLED) return;

    // Strip markdown for cleaner TTS
    const clean = text
      .replace(/```[\s\S]*?```/g, "code block")
      .replace(/`[^`]*`/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#+\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*]\s/gm, "")
      .replace(/\n+/g, ". ")
      .trim();

    // Stop any ongoing speech
    stopSpeaking();

    currentUtterance = new SpeechSynthesisUtterance(clean);
    currentUtterance.rate = LUMI_CONFIG.TTS_RATE;
    currentUtterance.pitch = LUMI_CONFIG.TTS_PITCH;
    currentUtterance.volume = LUMI_CONFIG.TTS_VOLUME;
    if (preferredVoice) currentUtterance.voice = preferredVoice;

    currentUtterance.onstart = () => {
      isSpeaking = true;
      updateVoiceUI("speaking");
      if (window.LumiOrb) LumiOrb.setState("speaking");
    };

    currentUtterance.onend = () => {
      isSpeaking = false;
      updateVoiceUI("idle");
      if (window.LumiOrb) LumiOrb.setState("idle");
      if (onEnd) onEnd();
    };

    currentUtterance.onerror = () => {
      isSpeaking = false;
      updateVoiceUI("idle");
      if (window.LumiOrb) LumiOrb.setState("idle");
    };

    synthesis.speak(currentUtterance);
  }

  function stopSpeaking() {
    if (synthesis) synthesis.cancel();
    isSpeaking = false;
    updateVoiceUI("idle");
  }

  // ── Speech-to-Text ─────────────────────────────────────────
  function initRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("⚠️ Speech Recognition not supported in this browser.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = LUMI_CONFIG.STT_LANGUAGE;
    rec.continuous = LUMI_CONFIG.STT_CONTINUOUS;
    rec.interimResults = LUMI_CONFIG.STT_INTERIM_RESULTS;

    rec.onstart = () => {
      isListening = true;
      updateVoiceUI("listening");
      if (window.LumiOrb) LumiOrb.setState("listening");
      showInterimText("Listening...");
    };

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) showInterimText(interim);
      if (final) {
        hideInterimText();
        const input = document.getElementById("chat-input");
        if (input) input.value = final;
        // Auto-send after short delay
        setTimeout(() => LumiChat.sendMessage(final), 500);
      }
    };

    rec.onend = () => {
      isListening = false;
      updateVoiceUI("idle");
      if (window.LumiOrb && !isSpeaking) LumiOrb.setState("idle");
      hideInterimText();
    };

    rec.onerror = (e) => {
      console.warn("STT error:", e.error);
      isListening = false;
      updateVoiceUI("idle");
      hideInterimText();
    };

    return rec;
  }

  // ── Toggle Listening ──────────────────────────────────────
  function toggleListening() {
    if (isSpeaking) stopSpeaking();

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!recognition) recognition = initRecognition();
    if (!recognition) {
      alert("Speech recognition is not supported in your browser. Try Chrome.");
      return;
    }
    try {
      recognition.start();
      startMicVisualization();
    } catch (e) {
      console.warn("Recognition start error:", e);
    }
  }

  function stopListening() {
    if (recognition) recognition.stop();
    stopMicVisualization();
  }

  // ── Microphone Waveform Visualization ────────────────────
  async function startMicVisualization() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);
      drawWaveform();
    } catch (e) {
      console.warn("Mic visualization error:", e);
    }
  }

  function stopMicVisualization() {
    if (waveformAnimId) cancelAnimationFrame(waveformAnimId);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    // Clear waveform canvas
    const canvas = document.getElementById("voice-waveform");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawWaveform() {
    const canvas = document.getElementById("voice-waveform");
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const W = canvas.width;
    const H = canvas.height;

    function draw() {
      waveformAnimId = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, W, H);

      // Gradient stroke
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "#00d4ff");
      grad.addColorStop(0.5, "#a855f7");
      grad.addColorStop(1, "#00d4ff");

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = grad;
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();

      const sliceWidth = W / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * H) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    }
    draw();
  }

  // ── UI Helpers ────────────────────────────────────────────
  function updateVoiceUI(state) {
    const micBtn = document.getElementById("mic-btn");
    const voiceStatus = document.getElementById("voice-status");

    if (micBtn) {
      micBtn.className = `mic-btn ${state}`;
      micBtn.setAttribute("aria-label", state === "listening" ? "Stop listening" : "Start listening");
    }

    if (voiceStatus) {
      const states = {
        listening: "🎙️ Listening...",
        speaking: "🔊 LUMI Speaking...",
        idle: "Voice Ready",
        thinking: "⚡ Processing...",
      };
      voiceStatus.textContent = states[state] || "Voice Ready";
      voiceStatus.className = `voice-status ${state}`;
    }
  }

  function showInterimText(text) {
    const el = document.getElementById("interim-text");
    if (el) {
      el.textContent = text;
      el.style.opacity = "1";
    }
  }

  function hideInterimText() {
    const el = document.getElementById("interim-text");
    if (el) el.style.opacity = "0";
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const micBtn = document.getElementById("mic-btn");
    micBtn?.addEventListener("click", toggleListening);

    // Voice stop button
    const stopVoiceBtn = document.getElementById("stop-voice-btn");
    stopVoiceBtn?.addEventListener("click", () => {
      stopListening();
      stopSpeaking();
    });

    console.log("✦ LUMI Voice initialized");
  }

  return {
    init,
    speak,
    stopSpeaking,
    toggleListening,
    startListening,
    stopListening,
    isListening: () => isListening,
    isSpeaking: () => isSpeaking,
  };
})();

window.LumiVoice = LumiVoice;

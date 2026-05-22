// ============================================================
// LUMI — Learning Unified Machine Intelligence
// config.js — Central Configuration
// ============================================================

const LUMI_CONFIG = {
  // ── Groq API ────────────────────────────────────────────
  // Replace with your Groq API key from https://console.groq.com
  GROQ_API_KEY: "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",
  GROQ_BASE_URL: "https://api.groq.com/openai/v1/chat/completions",
  GROQ_MODEL: "llama-3.3-70b-versatile", // Latest Groq model (fast & capable)
  GROQ_MAX_TOKENS: 2048,
  GROQ_TEMPERATURE: 0.7,

  // ── AI Personality ──────────────────────────────────────
  SYSTEM_PROMPT: `You are LUMI — a highly intelligent, emotionally adaptive AI learning companion. 
You exist inside a futuristic AI operating system. You are warm, witty, encouraging, and brilliant. 
You help users learn, code, explore ideas, and grow. Respond with clarity, personality, and depth. 
Format code with proper markdown. Be concise but never shallow. 
When explaining code, break it down step by step. Add light personality where appropriate.`,

  // ── TTS Settings ────────────────────────────────────────
  TTS_ENABLED: true,
  TTS_VOICE: "Google US English", // Fallback for Web Speech API
  TTS_RATE: 1.05,
  TTS_PITCH: 1.0,
  TTS_VOLUME: 0.9,

  // ── Voice Settings ───────────────────────────────────────
  STT_LANGUAGE: "en-US",
  STT_CONTINUOUS: false,
  STT_INTERIM_RESULTS: true,

  // ── Inactivity ───────────────────────────────────────────
  INACTIVITY_TIMEOUT_MS: 12000, // 12 seconds before focus-saving mode
  PRESENCE_CHECK_INTERVAL_MS: 500,

  // ── Animation ────────────────────────────────────────────
  PARTICLE_COUNT: 60,
  ORB_PULSE_SPEED: 1800, // ms per pulse cycle

  // ── Quick Actions ────────────────────────────────────────
  QUICK_ACTIONS: [
    { label: "✦ Explain", prompt: "Please explain this concept clearly:" },
    { label: "⚡ Summarize", prompt: "Summarize this concisely:" },
    { label: "🐛 Debug", prompt: "Help me debug this code:" },
    { label: "⌨ Generate Code", prompt: "Generate clean code for:" },
    { label: "🎓 Teach Me", prompt: "Teach me step-by-step about:" },
  ],

  // ── Greetings when user returns ──────────────────────────
  RETURN_GREETINGS: [
    "Welcome back. Ready to continue?",
    "Good to see you again. Shall we pick up where we left off?",
    "LUMI online. I've been waiting for you.",
    "Presence detected. Welcome back.",
  ],

  // ── Code Languages ───────────────────────────────────────
  CODE_LANGUAGES: [
    "JavaScript", "Python", "TypeScript", "Rust",
    "Go", "C++", "Java", "HTML/CSS", "SQL", "Bash"
  ],
};

// Expose globally
window.LUMI_CONFIG = LUMI_CONFIG;

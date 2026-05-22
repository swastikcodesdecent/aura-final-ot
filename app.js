// ============================================================
// LUMI — app.js
// ============================================================

// ── AI Orb ────────────────────────────────────────────────
const LumiOrb = (() => {
  let currentState = "idle";
  let orbEl = null;
  let particleContainer = null;
  let particles = [];

  const STATES = {
    idle:      { scale: 1,    glowColor: "#00d4ff", glowIntensity: 20, pulseSpeed: 2000, label: "●  LUMI Online" },
    thinking:  { scale: 1.08, glowColor: "#f59e0b", glowIntensity: 35, pulseSpeed: 600,  label: "◌  Processing..." },
    listening: { scale: 1.12, glowColor: "#22c55e", glowIntensity: 40, pulseSpeed: 400,  label: "◉  Listening" },
    speaking:  { scale: 1.15, glowColor: "#a855f7", glowIntensity: 50, pulseSpeed: 300,  label: "◈  Speaking" },
    sleeping:  { scale: 0.85, glowColor: "#334155", glowIntensity: 5,  pulseSpeed: 4000, label: "◌  Sleeping" },
  };

  function setState(state) {
    if (!STATES[state]) return;
    currentState = state;
    const cfg = STATES[state];
    if (!orbEl) orbEl = document.getElementById("ai-orb");
    if (!orbEl) return;
    orbEl.style.setProperty("--orb-glow", cfg.glowColor);
    orbEl.style.setProperty("--orb-glow-size", cfg.glowIntensity + "px");
    orbEl.style.setProperty("--orb-scale", cfg.scale);
    orbEl.style.setProperty("--orb-pulse-speed", cfg.pulseSpeed + "ms");
    orbEl.setAttribute("data-state", state);
    const statusEl = document.getElementById("orb-status");
    if (statusEl) statusEl.textContent = cfg.label;
    updateParticleSpeed(cfg.pulseSpeed);
  }

  function createParticles() {
    particleContainer = document.getElementById("orb-particles");
    if (!particleContainer) return;
    particleContainer.innerHTML = "";
    particles = [];
    for (let i = 0; i < LUMI_CONFIG.PARTICLE_COUNT; i++) {
      const p = document.createElement("div");
      p.className = "orb-particle";
      const angle = Math.random() * Math.PI * 2;
      const radius = 55 + Math.random() * 40;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const size = 1.5 + Math.random() * 3;
      const duration = 2000 + Math.random() * 4000;
      const delay = Math.random() * 2000;
      p.style.cssText =
        "left:calc(50% + " + x + "px);top:calc(50% + " + y + "px);" +
        "width:" + size + "px;height:" + size + "px;" +
        "animation-duration:" + duration + "ms;animation-delay:" + delay + "ms;" +
        "opacity:" + (0.2 + Math.random() * 0.6) + ";";
      particleContainer.appendChild(p);
      particles.push({ el: p });
    }
  }

  function updateParticleSpeed(pulseSpeed) {
    particles.forEach(function(p) {
      p.el.style.animationDuration = (pulseSpeed * 2) + "ms";
    });
  }

  function startEyeBlink() {
    setInterval(function() {
      document.querySelectorAll(".orb-eye").forEach(function(eye) {
        eye.classList.add("blink");
        setTimeout(function() { eye.classList.remove("blink"); }, 150);
      });
    }, 3000 + Math.random() * 2000);
  }

  function init() {
    orbEl = document.getElementById("ai-orb");
    createParticles();
    startEyeBlink();
    setState("idle");
    if (orbEl) {
      orbEl.addEventListener("click", function() {
        if (window.LumiVoice) LumiVoice.toggleListening();
      });
    }
    console.log("✦ LUMI Orb initialized");
  }

  return { init: init, setState: setState, currentState: function() { return currentState; } };
})();
window.LumiOrb = LumiOrb;


// ── Navigation ─────────────────────────────────────────────
const LumiNav = (() => {
  let currentView = "chat";

  function navigate(view) {
    currentView = view;
    document.querySelectorAll(".view-panel").forEach(function(p) { p.classList.remove("active"); });
    document.querySelectorAll(".nav-item").forEach(function(n) { n.classList.remove("active"); });
    const panel = document.getElementById("view-" + view);
    if (panel) panel.classList.add("active");
    const navItem = document.querySelector('[data-view="' + view + '"]');
    if (navItem) navItem.classList.add("active");
  }

  function init() {
    document.querySelectorAll(".nav-item").forEach(function(item) {
      item.addEventListener("click", function() { navigate(item.dataset.view); });
    });
    navigate("chat");
    console.log("✦ LUMI Navigation initialized");
  }

  return { init: init, navigate: navigate, currentView: function() { return currentView; } };
})();
window.LumiNav = LumiNav;


// ── On-Demand Coding Widget ───────────────────────────────
const LumiCoding = (() => {

  var STARTERS = {
    javascript:
      "// LUMI Coding Assistant — JavaScript Mode\n" +
      "function greetUser(name) {\n" +
      "  const msg = `Hello, ${name}! Welcome to LUMI.`;\n" +
      "  console.log(msg);\n" +
      "  return msg;\n" +
      "}\n" +
      "greetUser(\"Hacker\");",
    python:
      "# LUMI Coding Assistant — Python Mode\n" +
      "def greet_user(name: str) -> str:\n" +
      "    msg = f\"Hello, {name}! Welcome to LUMI.\"\n" +
      "    print(msg)\n" +
      "    return msg\n" +
      "greet_user(\"Hacker\")",
    typescript:
      "// LUMI Coding Assistant — TypeScript Mode\n" +
      "interface User { name: string; role: string; }\n" +
      "function greetUser(user: User): string {\n" +
      "  const msg = `Hello, ${user.name}! Role: ${user.role}`;\n" +
      "  console.log(msg);\n" +
      "  return msg;\n" +
      "}\n" +
      "greetUser({ name: \"Hacker\", role: \"admin\" });"
  };

  var mountedLang = "javascript";

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildWidget(lang) {
    return (
      '<div class="inline-coding-widget" id="inline-coding-widget">' +
        '<div class="icw-header">' +
          '<div class="lang-tabs">' +
            '<button class="lang-tab ' + (lang === "javascript" ? "active" : "") + '" data-lang="javascript" onclick="LumiCoding.switchLang(\'javascript\')">JS</button>' +
            '<button class="lang-tab ' + (lang === "python"     ? "active" : "") + '" data-lang="python"     onclick="LumiCoding.switchLang(\'python\')">PY</button>' +
            '<button class="lang-tab ' + (lang === "typescript" ? "active" : "") + '" data-lang="typescript" onclick="LumiCoding.switchLang(\'typescript\')">TS</button>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-left:auto;">' +
            '<button class="code-action-btn" onclick="LumiCoding.askAI(\'explain\')">✦ Explain</button>' +
            '<button class="code-action-btn" onclick="LumiCoding.askAI(\'debug\')">🐛 Debug</button>' +
            '<button class="code-action-btn" onclick="LumiCoding.askAI(\'improve\')">⚡ Improve</button>' +
            '<button class="code-action-btn" onclick="LumiCoding.askAI(\'test\')">🧪 Test</button>' +
            '<button class="code-action-btn run-btn" onclick="LumiCoding.runCode()">▶ Run</button>' +
            '<button class="code-action-btn" onclick="LumiCoding.dismiss()" style="border-color:rgba(248,113,113,0.3);color:#f87171;">✕</button>' +
          '</div>' +
        '</div>' +
        '<div id="icw-editor" contenteditable="true" spellcheck="false" class="icw-editor">' +
          escapeHtml(STARTERS[lang] || "") +
        '</div>' +
        '<div class="icw-terminal">' +
          '<div class="terminal-header">' +
            '<span class="terminal-title">◈ TERMINAL</span>' +
            '<button class="term-clear-btn" onclick="LumiCoding.clearTerminal()">Clear</button>' +
          '</div>' +
          '<div id="icw-output"><span class="term-line term-dim">Ready. Click ▶ Run to execute.</span></div>' +
        '</div>' +
      '</div>'
    );
  }

  function mount(lang) {
    if (document.getElementById("inline-coding-widget")) {
      document.getElementById("inline-coding-widget").scrollIntoView({ behavior: "smooth" });
      return;
    }
    mountedLang = lang || "javascript";
    var container = document.getElementById("chat-messages");
    if (!container) return;
    var wrapper = document.createElement("div");
    wrapper.className = "message-wrapper assistant";
    wrapper.id = "coding-widget-wrapper";
    var time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    wrapper.innerHTML =
      '<div class="message-avatar"><div class="avatar-lumi"><span class="lumi-dot"></span></div></div>' +
      '<div class="message-body" style="max-width:90%;">' +
        '<div class="message-meta">' +
          '<span class="message-sender">LUMI</span>' +
          '<span class="message-time">' + time + '</span>' +
        '</div>' +
        buildWidget(mountedLang) +
      '</div>';
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  }

  function dismiss() {
    var w = document.getElementById("coding-widget-wrapper");
    if (w) w.remove();
  }

  function switchLang(lang) {
    mountedLang = lang;
    var editor = document.getElementById("icw-editor");
    if (editor) editor.textContent = STARTERS[lang] || "";
    document.querySelectorAll("#inline-coding-widget .lang-tab").forEach(function(t) {
      t.classList.toggle("active", t.dataset.lang === lang);
    });
  }

  function askAI(action) {
    var code = document.getElementById("icw-editor") ? document.getElementById("icw-editor").textContent : "";
    if (!code.trim()) return;
    var prompts = {
      explain: "Explain this " + mountedLang + " code step by step:\n```" + mountedLang + "\n" + code + "\n```",
      debug:   "Debug this " + mountedLang + " code and identify issues:\n```" + mountedLang + "\n" + code + "\n```",
      improve: "Suggest improvements for this " + mountedLang + " code:\n```" + mountedLang + "\n" + code + "\n```",
      test:    "Generate unit tests for this " + mountedLang + " code:\n```" + mountedLang + "\n" + code + "\n```"
    };
    LumiChat.sendMessage(prompts[action] || prompts.explain);
  }

  function runCode() {
    var code = document.getElementById("icw-editor") ? document.getElementById("icw-editor").textContent : "";
    var out  = document.getElementById("icw-output");
    if (!out) return;
    out.innerHTML = '<span class="term-line"><span class="term-prompt">$</span> Running ' + mountedLang + '...</span>';
    setTimeout(function() {
      if (mountedLang === "javascript") {
        try {
          var logs = [];
          var orig = console.log;
          console.log = function() { logs.push(Array.prototype.slice.call(arguments).join(" ")); };
          eval(code); // eslint-disable-line no-eval
          console.log = orig;
          out.innerHTML += '\n<span class="term-line term-success">' + (logs.join("\n") || "(no output)") + '</span>';
          out.innerHTML += '\n<span class="term-line term-dim">Process exited with code 0 ✓</span>';
        } catch (err) {
          out.innerHTML += '\n<span class="term-line term-error">Error: ' + err.message + '</span>';
          out.innerHTML += '\n<span class="term-line term-dim">Process exited with code 1 ✗</span>';
        }
      } else {
        out.innerHTML += '\n<span class="term-line term-success">Hello, Hacker! Welcome to LUMI.</span>';
        out.innerHTML += '\n<span class="term-line term-dim">Simulated ' + mountedLang + ' execution complete ✓</span>';
      }
      out.scrollTop = out.scrollHeight;
    }, 500);
  }

  function clearTerminal() {
    var out = document.getElementById("icw-output");
    if (out) out.innerHTML = '<span class="term-line term-dim">Terminal cleared. Ready.</span>';
  }

  var CODING_KEYWORDS = [
    /\bcode\b/i, /\bprogram\b/i, /\bscript\b/i, /\bfunction\b/i,
    /\bjavascript\b/i, /\bpython\b/i, /\btypescript\b/i, /\bdebug\b/i,
    /fix.*(bug|error|issue)/i, /generate.*(code|snippet)/i,
    /write.*(code|function|class)/i, /\bcoding\b/i, /\bimplement/i,
  ];

  function isCodingRequest(text) {
    return CODING_KEYWORDS.some(function(re) { return re.test(text); });
  }

  function detectLang(text) {
    if (/python/i.test(text)) return "python";
    if (/typescript|\.ts\b/i.test(text)) return "typescript";
    return "javascript";
  }

  return {
    mount: mount,
    dismiss: dismiss,
    switchLang: switchLang,
    askAI: askAI,
    runCode: runCode,
    clearTerminal: clearTerminal,
    isCodingRequest: isCodingRequest,
    detectLang: detectLang,
  };
})();
window.LumiCoding = LumiCoding;


// ── Background Particles ──────────────────────────────────
function initBackgroundParticles() {
  var canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  var stars = [];
  for (var i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.6 + 0.1,
    });
  }

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160, 180, 255, " + s.alpha + ")";
      ctx.fill();
      s.x += s.vx; s.y += s.vy;
      if (s.x < 0) s.x = canvas.width;
      if (s.x > canvas.width) s.x = 0;
      if (s.y < 0) s.y = canvas.height;
      if (s.y > canvas.height) s.y = 0;
    }
    requestAnimationFrame(drawStars);
  }
  drawStars();
}


// ── Toast Notifications ───────────────────────────────────
function showToast(message, type, duration) {
  type = type || "info";
  duration = duration || 3000;
  var container = document.getElementById("toast-container");
  if (!container) return;
  var toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  var icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✗" };
  toast.innerHTML = '<span class="toast-icon">' + (icons[type] || "ℹ") + '</span><span>' + message + '</span>';
  container.appendChild(toast);
  requestAnimationFrame(function() { toast.classList.add("visible"); });
  setTimeout(function() {
    toast.classList.remove("visible");
    setTimeout(function() { toast.remove(); }, 400);
  }, duration);
}
window.showToast = showToast;


// ── Chat History ──────────────────────────────────────────
function updateChatHistory() {
  var historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  var sessions = [
    { title: "Learning Python Basics", time: "2 hrs ago" },
    { title: "React Component Help",   time: "Yesterday" },
    { title: "Algorithm Study",        time: "2 days ago" },
  ];
  historyList.innerHTML = sessions.map(function(s) {
    return (
      '<div class="history-item">' +
        '<span class="history-icon">◌</span>' +
        '<div class="history-info">' +
          '<span class="history-title">' + s.title + '</span>' +
          '<span class="history-time">' + s.time + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join("");
}


// ── Main Bootstrap ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  console.log("✦ LUMI Booting...");

  LumiOrb.init();
  LumiNav.init();
  LumiChat.init();
  LumiVoice.init();
  LumiWebcam.init();
  LumiGestures.init();

  initBackgroundParticles();
  updateChatHistory();

  document.querySelectorAll(".quick-action").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var input = document.getElementById("chat-input");
      if (input) {
        input.value = btn.dataset.prompt + " ";
        input.focus();
        LumiNav.navigate("chat");
      }
    });
  });

  var clearBtn = document.getElementById("clear-chat-btn");
  if (clearBtn) clearBtn.addEventListener("click", function() {
    LumiChat.clearHistory();
    showToast("Chat cleared", "info");
  });

  var newBtn = document.getElementById("new-chat-btn");
  if (newBtn) newBtn.addEventListener("click", function() {
    LumiChat.clearHistory();
    showToast("New conversation started", "success");
  });

  setTimeout(function() {
    document.body.classList.add("lumi-ready");
    showToast("LUMI Online — Ready to assist you", "success", 4000);
  }, 500);

  console.log("✦ LUMI fully initialized");
});
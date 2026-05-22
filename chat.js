// ============================================================
// LUMI — chat.js
// Handles all AI chat interactions via Groq API
// Intercepts coding-intent messages to mount inline widget
// ============================================================

const LumiChat = (() => {
  let conversationHistory = [];
  let isGenerating = false;
  let currentMessageEl = null;

  const getEls = () => ({
    messagesContainer: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    sendBtn: document.getElementById("send-btn"),
    charCount: document.getElementById("char-count"),
    typingIndicator: document.getElementById("typing-indicator"),
  });

  // ── Markdown Renderer ─────────────────────────────────────
  function renderMarkdown(text) {
    return text
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
        const language = lang || "plaintext";
        const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="code-block">
          <div class="code-header">
            <span class="code-lang">${language}</span>
            <button class="copy-btn" onclick="LumiChat.copyCode(this)">Copy</button>
          </div>
          <pre><code class="language-${language}">${escaped}</code></pre>
        </div>`;
      })
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.*$)/gm, "<h4>$1</h4>")
      .replace(/^## (.*$)/gm, "<h3>$1</h3>")
      .replace(/^# (.*$)/gm, "<h2>$1</h2>")
      .replace(/^\s*[-*] (.+)/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/^\d+\. (.+)/gm, "<li>$1</li>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  // ── Create Message Bubble ─────────────────────────────────
  function createMessageBubble(role, content = "", streaming = false) {
    const { messagesContainer } = getEls();
    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${role}`;
    const isUser = role === "user";
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    wrapper.innerHTML = `
      <div class="message-avatar">
        ${isUser
          ? `<div class="avatar-user">U</div>`
          : `<div class="avatar-lumi"><span class="lumi-dot"></span></div>`}
      </div>
      <div class="message-body">
        <div class="message-meta">
          <span class="message-sender">${isUser ? "You" : "LUMI"}</span>
          <span class="message-time">${timestamp}</span>
        </div>
        <div class="message-bubble ${streaming ? "streaming" : ""}">
          ${isUser
            ? `<p>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
            : `<div class="ai-content">${content ? renderMarkdown(content) : ""}</div>`}
        </div>
        ${isUser ? "" : `<div class="message-actions">
          <button onclick="LumiChat.copyMessage(this)" title="Copy">⎘</button>
          <button onclick="LumiChat.speakMessage(this)" title="Speak">🔊</button>
        </div>`}
      </div>`;
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function showTypingIndicator() {
    const { typingIndicator } = getEls();
    if (typingIndicator) typingIndicator.classList.add("active");
    if (window.LumiOrb) LumiOrb.setState("thinking");
  }

  function hideTypingIndicator() {
    const { typingIndicator } = getEls();
    if (typingIndicator) typingIndicator.classList.remove("active");
  }

  function scrollToBottom() {
    const { messagesContainer } = getEls();
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ── Send Message ──────────────────────────────────────────
  async function sendMessage(userText) {
    if (!userText.trim() || isGenerating) return;
    isGenerating = true;

    const { sendBtn, chatInput } = getEls();
    if (sendBtn) sendBtn.disabled = true;
    if (chatInput) chatInput.value = "";

    conversationHistory.push({ role: "user", content: userText });
    createMessageBubble("user", userText);

    // ── Coding intent intercept ──────────────────────────
    if (window.LumiCoding && LumiCoding.isCodingRequest(userText)) {
      const lang = LumiCoding.detectLang(userText);
      LumiNav.navigate("chat");
      // Mount the inline coding widget
      LumiCoding.mount(lang);
      // Also get an AI response for explanation/context
    }

    showTypingIndicator();

    try {
      const response = await callGroqAPI(conversationHistory);
      hideTypingIndicator();

      const aiWrapper = createMessageBubble("assistant", "", true);
      currentMessageEl = aiWrapper.querySelector(".ai-content");
      await typewriterRender(currentMessageEl, response);
      aiWrapper.querySelector(".message-bubble").classList.remove("streaming");

      conversationHistory.push({ role: "assistant", content: response });

      if (LUMI_CONFIG.TTS_ENABLED && window.LumiVoice) LumiVoice.speak(response);
      if (window.LumiOrb) LumiOrb.setState("idle");
    } catch (err) {
      hideTypingIndicator();
      createMessageBubble("assistant", `⚠️ LUMI encountered an error: ${err.message}\n\nPlease check your API key in config.js`);
      if (window.LumiOrb) LumiOrb.setState("idle");
    }

    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
  }

  // ── Call Groq API ─────────────────────────────────────────
  async function callGroqAPI(messages, retries = 3) {
    const config = LUMI_CONFIG;
    const payload = {
      model: config.GROQ_MODEL,
      max_tokens: config.GROQ_MAX_TOKENS,
      temperature: config.GROQ_TEMPERATURE,
      messages: [
        { role: "system", content: config.SYSTEM_PROMPT },
        ...messages,
      ],
    };
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(config.GROQ_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.GROQ_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "No response received.";
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  // ── Typewriter Render ─────────────────────────────────────
  async function typewriterRender(el, text, speed = 8) {
    let rendered = "";
    const chars = text.split("");
    for (let i = 0; i < chars.length; i++) {
      rendered += chars[i];
      if (i % 20 === 0 || i === chars.length - 1) {
        el.innerHTML = renderMarkdown(rendered);
        scrollToBottom();
      }
      await sleep(speed);
    }
    el.innerHTML = renderMarkdown(text);
    scrollToBottom();
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function copyCode(btn) {
    const code = btn.closest(".code-block").querySelector("code").innerText;
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 2000);
    });
  }

  function copyMessage(btn) {
    const text = btn.closest(".message-body").querySelector(".ai-content").innerText;
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = "✓";
      setTimeout(() => (btn.textContent = "⎘"), 2000);
    });
  }

  function speakMessage(btn) {
    const text = btn.closest(".message-body").querySelector(".ai-content").innerText;
    if (window.LumiVoice) LumiVoice.speak(text);
  }

  function clearHistory() {
    conversationHistory = [];
    const { messagesContainer } = getEls();
    if (messagesContainer) messagesContainer.innerHTML = "";
    addWelcomeMessage();
  }

  function addWelcomeMessage() {
    createMessageBubble(
      "assistant",
      "Hello! I'm **LUMI** — your Learning Unified Machine Intelligence companion. I'm here to help you learn, code, explore, and grow.\n\nTry asking me anything, or use the quick action buttons below. I can also understand your voice! 🎙️\n\n💡 **Tip:** Ask me to write or debug code and a coding workspace will appear right here in the chat."
    );
  }

  function init() {
    const { chatInput, sendBtn, charCount } = getEls();
    chatInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(chatInput.value);
      }
    });
    chatInput?.addEventListener("input", () => {
      const len = chatInput.value.length;
      if (charCount) charCount.textContent = len;
    });
    sendBtn?.addEventListener("click", () => sendMessage(chatInput.value));
    document.querySelectorAll(".quick-action").forEach(btn => {
      btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        if (chatInput) { chatInput.value = prompt + " "; chatInput.focus(); }
      });
    });
    addWelcomeMessage();
    console.log("✦ LUMI Chat initialized");
  }

  return { init, sendMessage, clearHistory, copyCode, copyMessage, speakMessage, renderMarkdown, addWelcomeMessage };
})();

window.LumiChat = LumiChat;
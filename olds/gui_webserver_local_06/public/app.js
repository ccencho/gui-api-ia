const STORAGE_KEY = "smelpro_ai_backend_websearch_v3_project_chats_tools";
const OLD_STORAGE_KEYS = [
  "smelpro_ai_backend_websearch_v2_project_chats",
  "smelpro_ai_backend_websearch_v1",
  "smelpro_ai_demo_v1"
];

let selectedDocumentFiles = [];

let state = {
  currentProjectId: "general",
  currentChatId: "chat_general",
  settings: {
    model: "deepseek-v4-flash",
    deepThinking: false,
    useWebSearch: false,
    maxResults: 5,
    theme: "current",
    sidebarCollapsed: false,
    systemPrompt:
      "Eres un asistente técnico y comercial para Smelpro S.A.C., empresa peruana especializada en IoT industrial, inteligencia artificial, automatización, LoRaWAN, ThingsBoard, medición de agua, energía y tracking. No inventes información si no tienes contexto suficiente. Responde de forma clara, precisa y profesional."
  },
  projects: {
    general: {
      id: "general",
      name: "Proyecto General",
      currentChatId: "chat_general",
      chats: {
        chat_general: {
          id: "chat_general",
          title: "Chat principal",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    }
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadState();
});

function cacheElements() {
  els.app = document.querySelector(".app");
  els.toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  els.model = document.getElementById("model");
  els.themeSelect = document.getElementById("themeSelect");
  els.systemPrompt = document.getElementById("systemPrompt");
  els.deepThinking = document.getElementById("deepThinking");
  els.useWebSearch = document.getElementById("useWebSearch");
  els.maxResults = document.getElementById("maxResults");
  els.saveSettingsBtn = document.getElementById("saveSettingsBtn");
  els.clearChatBtn = document.getElementById("clearChatBtn");
  els.newProject = document.getElementById("newProject");
  els.createProjectBtn = document.getElementById("createProjectBtn");
  els.projectList = document.getElementById("projectList");
  els.newChat = document.getElementById("newChat");
  els.createChatBtn = document.getElementById("createChatBtn");
  els.chatList = document.getElementById("chatList");
  els.currentProjectTitle = document.getElementById("currentProjectTitle");
  els.currentChatTitle = document.getElementById("currentChatTitle");
  els.status = document.getElementById("status");
  els.chat = document.getElementById("chat");
  els.messageInput = document.getElementById("messageInput");
  els.sendBtn = document.getElementById("sendBtn");
  els.attachBtn = document.getElementById("attachBtn");
  els.documentInput = document.getElementById("documentInput");
  els.attachedFiles = document.getElementById("attachedFiles");
  els.drawerOverlay = document.getElementById("drawerOverlay");
  els.sourcesDrawer = document.getElementById("sourcesDrawer");
  els.sourcesDrawerList = document.getElementById("sourcesDrawerList");
  els.sourcesDrawerSubtitle = document.getElementById("sourcesDrawerSubtitle");
  els.closeSourcesDrawer = document.getElementById("closeSourcesDrawer");
}

function bindEvents() {
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.clearChatBtn.addEventListener("click", clearCurrentChat);
  els.createProjectBtn.addEventListener("click", createProject);
  els.createChatBtn.addEventListener("click", createChat);
  els.sendBtn.addEventListener("click", sendMessage);
  if (els.toggleSidebarBtn) els.toggleSidebarBtn.addEventListener("click", toggleSidebar);

  els.deepThinking.addEventListener("change", saveSettings);
  els.useWebSearch.addEventListener("change", saveSettings);
  els.maxResults.addEventListener("change", saveSettings);
  els.model.addEventListener("change", saveSettings);
  if (els.themeSelect) {
    els.themeSelect.addEventListener("change", () => {
      state.settings.theme = els.themeSelect.value;
      applyTheme(state.settings.theme);
      saveSettings();
    });
  }

  els.attachBtn.addEventListener("click", () => els.documentInput.click());
  els.documentInput.addEventListener("change", handleDocumentSelection);
  if (els.closeSourcesDrawer) els.closeSourcesDrawer.addEventListener("click", closeSourcesDrawer);
  if (els.drawerOverlay) els.drawerOverlay.addEventListener("click", closeSourcesDrawer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSourcesDrawer();
  });

  els.newProject.addEventListener("keydown", event => {
    if (event.key === "Enter") createProject();
  });

  els.newChat.addEventListener("keydown", event => {
    if (event.key === "Enter") createChat();
  });

  els.messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || getLegacyStateRaw();

  if (raw) {
    try {
      const savedState = JSON.parse(raw);
      state = {
        ...state,
        ...savedState,
        settings: { ...state.settings, ...(savedState.settings || {}) },
        projects: savedState.projects || state.projects
      };
    } catch (error) {
      console.error("No se pudo leer el estado local", error);
    }
  }

  migrateAndValidateState();
  hydrateSettingsForm();
  renderAll();
  setStatus("Listo");
}

function getLegacyStateRaw() {
  for (const key of OLD_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) return raw;
  }
  return null;
}

function migrateModelSettings() {
  const modelValue = String(state.settings.model || "deepseek-v4-flash");
  if (modelValue.includes("|")) {
    const [modelName, thinkingType] = modelValue.split("|");
    state.settings.model = modelName || "deepseek-v4-flash";
    state.settings.deepThinking = thinkingType === "enabled";
  }
}

function migrateAndValidateState() {
  if (!state.settings) state.settings = {};
  if (!state.projects) state.projects = {};

  migrateModelSettings();

  if (!state.projects.general) {
    state.projects.general = createProjectObject("general", "Proyecto General");
  }

  Object.values(state.projects).forEach(project => {
    if (!project.id) project.id = "project_" + Date.now();
    if (!project.name) project.name = "Proyecto sin nombre";

    if (!project.chats) {
      const defaultChatId = "chat_" + project.id;
      project.chats = {
        [defaultChatId]: {
          id: defaultChatId,
          title: "Chat principal",
          messages: Array.isArray(project.messages) ? project.messages : [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      };
      project.currentChatId = defaultChatId;
      delete project.messages;
    }

    const chatIds = Object.keys(project.chats);
    if (!chatIds.length) {
      const chat = createChatObject("Chat principal");
      project.chats[chat.id] = chat;
      project.currentChatId = chat.id;
    }

    if (!project.currentChatId || !project.chats[project.currentChatId]) {
      project.currentChatId = Object.keys(project.chats)[0];
    }

    Object.values(project.chats).forEach(chat => {
      if (!Array.isArray(chat.messages)) chat.messages = [];
      if (!chat.title) chat.title = "Chat sin título";
      if (!chat.createdAt) chat.createdAt = Date.now();
      if (!chat.updatedAt) chat.updatedAt = chat.createdAt;
    });
  });

  if (!state.currentProjectId || !state.projects[state.currentProjectId]) {
    state.currentProjectId = "general";
  }

  const project = getCurrentProject();
  state.currentChatId = project.currentChatId;

  if (!state.settings.model) state.settings.model = "deepseek-v4-flash";
  if (state.settings.deepThinking === undefined) state.settings.deepThinking = false;
  if (state.settings.useWebSearch === undefined) state.settings.useWebSearch = false;
  if (!state.settings.systemPrompt) {
    state.settings.systemPrompt =
      "Eres un asistente técnico y comercial para Smelpro. Responde de forma clara, precisa y profesional.";
  }
  if (!state.settings.maxResults) state.settings.maxResults = 5;
  if (!state.settings.theme) state.settings.theme = "current";
  if (state.settings.sidebarCollapsed === undefined) state.settings.sidebarCollapsed = false;

  saveState();
}

function hydrateSettingsForm() {
  els.model.value = state.settings.model || "deepseek-v4-flash";
  if (els.themeSelect) els.themeSelect.value = state.settings.theme || "current";
  applyTheme(state.settings.theme || "current");
  applySidebarState(Boolean(state.settings.sidebarCollapsed));
  els.systemPrompt.value = state.settings.systemPrompt || "";
  els.deepThinking.checked = Boolean(state.settings.deepThinking);
  els.useWebSearch.checked = Boolean(state.settings.useWebSearch);
  els.maxResults.value = String(state.settings.maxResults || 5);
  renderAttachedFiles();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme(theme) {
  const allowedThemes = ["current", "dark", "light"];
  const selectedTheme = allowedThemes.includes(theme) ? theme : "current";
  document.body.setAttribute("data-theme", selectedTheme);
}

function applySidebarState(collapsed) {
  if (!els.app) return;
  els.app.classList.toggle("sidebar-collapsed", Boolean(collapsed));
  if (els.toggleSidebarBtn) {
    els.toggleSidebarBtn.textContent = collapsed ? "☰" : "⇤";
    els.toggleSidebarBtn.title = collapsed ? "Mostrar panel lateral" : "Ocultar panel lateral";
  }
}

function toggleSidebar() {
  state.settings.sidebarCollapsed = !Boolean(state.settings.sidebarCollapsed);
  applySidebarState(state.settings.sidebarCollapsed);
  saveState();
}

function saveSettings() {
  state.settings.model = els.model.value;
  state.settings.theme = els.themeSelect ? els.themeSelect.value : (state.settings.theme || "current");
  applyTheme(state.settings.theme);
  state.settings.deepThinking = els.deepThinking.checked;
  state.settings.systemPrompt = els.systemPrompt.value.trim();
  state.settings.useWebSearch = els.useWebSearch.checked;
  state.settings.maxResults = Number(els.maxResults.value || 5);
  saveState();
  setStatus("Configuración guardada");
}

function createProjectObject(id, name) {
  const chat = createChatObject("Chat principal");
  return {
    id,
    name,
    currentChatId: chat.id,
    chats: {
      [chat.id]: chat
    }
  };
}

function createChatObject(title) {
  const now = Date.now();
  return {
    id: "chat_" + now + "_" + Math.random().toString(16).slice(2),
    title: title || "Nuevo chat",
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function createProject() {
  const name = els.newProject.value.trim();

  if (!name) {
    alert("Escribe un nombre para el proyecto.");
    return;
  }

  const id = "project_" + Date.now();
  state.projects[id] = createProjectObject(id, name);
  state.currentProjectId = id;
  state.currentChatId = state.projects[id].currentChatId;
  els.newProject.value = "";

  saveState();
  renderAll();
  setStatus("Proyecto creado");
}

function createChat() {
  const project = getCurrentProject();
  const typedTitle = els.newChat.value.trim();
  const title = typedTitle || "Nuevo chat";
  const chat = createChatObject(title);

  project.chats[chat.id] = chat;
  project.currentChatId = chat.id;
  state.currentChatId = chat.id;
  els.newChat.value = "";

  saveState();
  renderAll();
  setStatus("Chat creado");
  els.messageInput.focus();
}

function selectProject(id) {
  state.currentProjectId = id;
  const project = getCurrentProject();
  state.currentChatId = project.currentChatId;
  saveState();
  renderAll();
  setStatus("Proyecto seleccionado");
}

function selectChat(id) {
  const project = getCurrentProject();
  if (!project.chats[id]) return;

  project.currentChatId = id;
  state.currentChatId = id;
  saveState();
  renderAll();
  setStatus("Chat seleccionado");
}

function getCurrentProject() {
  return state.projects[state.currentProjectId] || state.projects.general;
}

function getCurrentChat() {
  const project = getCurrentProject();
  return project.chats[project.currentChatId] || Object.values(project.chats)[0];
}

function renderAll() {
  renderProjects();
  renderChats();
  renderConversation();
  renderAttachedFiles();
}

function renderProjects() {
  els.projectList.innerHTML = "";

  Object.values(state.projects).forEach(project => {
    const div = document.createElement("div");
    div.className = "project-item" + (project.id === state.currentProjectId ? " active" : "");

    const title = document.createElement("div");
    title.textContent = project.name;

    const count = document.createElement("small");
    const chatCount = Object.keys(project.chats || {}).length;
    count.textContent = chatCount + (chatCount === 1 ? " chat" : " chats");

    div.appendChild(title);
    div.appendChild(count);
    div.addEventListener("click", () => selectProject(project.id));
    els.projectList.appendChild(div);
  });
}

function renderChats() {
  const project = getCurrentProject();
  els.chatList.innerHTML = "";

  const chats = Object.values(project.chats || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  chats.forEach(chat => {
    const div = document.createElement("div");
    div.className = "chat-item" + (chat.id === project.currentChatId ? " active" : "");

    const title = document.createElement("div");
    title.className = "chat-item-title";
    title.textContent = chat.title;

    const meta = document.createElement("small");
    const messageCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
    meta.textContent = messageCount + (messageCount === 1 ? " mensaje" : " mensajes");

    div.appendChild(title);
    div.appendChild(meta);
    div.addEventListener("click", () => selectChat(chat.id));
    els.chatList.appendChild(div);
  });
}

function renderConversation() {
  const project = getCurrentProject();
  const chat = getCurrentChat();

  els.currentProjectTitle.textContent = project.name;
  els.currentChatTitle.textContent = chat.title + " · Historial guardado en localStorage";
  els.chat.innerHTML = "";

  if (!chat.messages.length) {
    const welcome = document.createElement("div");
    welcome.className = "message assistant";
    welcome.textContent =
      "Hola. Este chat está dentro del proyecto \"" + project.name + "\". Puedes crear varios chats por proyecto para separar temas, clientes, cotizaciones o pruebas.";
    els.chat.appendChild(welcome);
  }

  chat.messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "message " + msg.role;

    const content = document.createElement("div");
    content.className = "message-content";

    if (msg.role === "assistant") {
      content.innerHTML = renderMarkdown(msg.content, msg.meta?.sources || []);
      content.addEventListener("click", event => {
        const citation = event.target.closest(".citation-chip");
        if (!citation) return;
        const sourceIndex = Number(citation.dataset.sourceIndex);
        const sources = msg.meta?.sources || [];
        if (sources.length) openSourcesDrawer(sources, sourceIndex);
      });
    } else {
      content.textContent = msg.content;
    }

    div.appendChild(content);

    if (msg.role === "assistant" && msg.meta) {
      div.appendChild(createMetaBlock(msg.meta));
    }

    els.chat.appendChild(div);
  });

  els.chat.scrollTop = els.chat.scrollHeight;
}

function createMetaBlock(meta) {
  const metaDiv = document.createElement("div");
  metaDiv.className = "message-meta";

  const usage = meta.usage || {};
  const webStatus = meta.webSearchUsed ? "Sí" : "No";
  const thinkingStatus = meta.deepThinking ? "Sí" : "No";

  const summary = document.createElement("div");
  summary.className = "meta-summary-line";
  summary.textContent =
    "Modelo: " + (meta.model || "No reportado") +
    " · Pensamiento profundo: " + thinkingStatus +
    " · Tokens entrada: " + valueOrNA(usage.prompt_tokens) +
    " · Tokens salida: " + valueOrNA(usage.completion_tokens) +
    " · Tokens total: " + valueOrNA(usage.total_tokens) +
    " · Búsqueda web: " + webStatus;
  metaDiv.appendChild(summary);

  const chips = document.createElement("div");
  chips.className = "result-chips";

  if (meta.sources && meta.sources.length) {
    const sourceButton = document.createElement("button");
    sourceButton.type = "button";
    sourceButton.className = "web-result-chip";
    sourceButton.innerHTML = "🌐 <strong>" + meta.sources.length + "</strong> páginas web";
    sourceButton.title = "Ver resultados de búsqueda";
    sourceButton.addEventListener("click", () => openSourcesDrawer(meta.sources));
    chips.appendChild(sourceButton);
  }

  if (meta.documents && meta.documents.length) {
    const docButton = document.createElement("button");
    docButton.type = "button";
    docButton.className = "web-result-chip document-chip";
    docButton.innerHTML = "📄 <strong>" + meta.documents.length + "</strong> documento" + (meta.documents.length === 1 ? "" : "s");
    docButton.title = meta.documents.map(doc => doc.name).join("\n");
    chips.appendChild(docButton);
  }

  if (chips.children.length) metaDiv.appendChild(chips);

  return metaDiv;
}


function renderMarkdown(text, sources = []) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4);
      html.push("<h" + level + ">" + renderInlineMarkdown(heading[2], sources) + "</h" + level + ">");
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      html.push(renderMarkdownTable(tableLines, sources));
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^[-*•]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*•]\s+/, ""));
        index += 1;
      }
      html.push("<ul>" + items.map(item => "<li>" + renderInlineMarkdown(item, sources) + "</li>").join("") + "</ul>");
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      html.push("<ol>" + items.map(item => "<li>" + renderInlineMarkdown(item, sources) + "</li>").join("") + "</ol>");
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^-{3,}$/.test(lines[index].trim()) &&
      !/^(#{1,4})\s+/.test(lines[index].trim()) &&
      !isTableStart(lines, index) &&
      !/^[-*•]\s+/.test(lines[index].trim()) &&
      !/^\d+[.)]\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    html.push("<p>" + paragraphLines.map(part => renderInlineMarkdown(part, sources)).join("<br>") + "</p>");
  }

  return html.join("\n");
}

function isTableStart(lines, index) {
  const current = lines[index] || "";
  const next = lines[index + 1] || "";
  return current.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}

function renderMarkdownTable(tableLines, sources) {
  if (tableLines.length < 2) return "";

  const rows = tableLines
    .filter((_line, index) => index !== 1)
    .map(line => splitTableRow(line));

  if (!rows.length) return "";

  const header = rows[0];
  const bodyRows = rows.slice(1);

  const headerHtml = header.map(cell => "<th>" + renderInlineMarkdown(cell, sources) + "</th>").join("");
  const bodyHtml = bodyRows.map(row => {
    return "<tr>" + row.map(cell => "<td>" + renderInlineMarkdown(cell, sources) + "</td>").join("") + "</tr>";
  }).join("");

  return '<div class="markdown-table-wrap"><table><thead><tr>' + headerHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim());
}

function renderInlineMarkdown(text, sources = []) {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  html = html.replace(/\[(\d{1,2})\]/g, (_match, numberText) => {
    const sourceNumber = Number(numberText);
    const sourceIndex = sourceNumber - 1;
    const source = sources[sourceIndex];
    const title = source?.title ? escapeHtml(source.title) : "Fuente " + sourceNumber;
    const disabledClass = source ? "" : " disabled";
    return '<button type="button" class="citation-chip' + disabledClass + '" data-source-index="' + sourceIndex + '" title="' + title + '">' + sourceNumber + '</button>';
  });

  return html;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openSourcesDrawer(sources, selectedIndex = null) {
  if (!els.sourcesDrawer || !els.sourcesDrawerList) return;

  els.sourcesDrawerList.innerHTML = "";
  const safeSources = Array.isArray(sources) ? sources : [];

  if (els.sourcesDrawerSubtitle) {
    els.sourcesDrawerSubtitle.textContent = safeSources.length + (safeSources.length === 1 ? " fuente consultada" : " fuentes consultadas");
  }

  safeSources.forEach((source, index) => {
    const item = document.createElement("a");
    item.className = "drawer-source-item" + (index === selectedIndex ? " selected" : "");
    item.dataset.sourceIndex = String(index);
    item.href = source.url || "#";
    item.target = "_blank";
    item.rel = "noopener noreferrer";

    const number = document.createElement("div");
    number.className = "drawer-source-number";
    number.textContent = index + 1;

    const body = document.createElement("div");
    body.className = "drawer-source-body";

    const title = document.createElement("div");
    title.className = "drawer-source-title";
    title.textContent = source.title || source.url || "Fuente sin título";

    const domain = document.createElement("div");
    domain.className = "drawer-source-domain";
    domain.textContent = getDomainName(source.url || "");

    const snippet = document.createElement("div");
    snippet.className = "drawer-source-snippet";
    snippet.textContent = source.content || "Sin extracto disponible.";

    body.appendChild(title);
    body.appendChild(domain);
    body.appendChild(snippet);
    item.appendChild(number);
    item.appendChild(body);
    els.sourcesDrawerList.appendChild(item);
  });

  if (els.drawerOverlay) els.drawerOverlay.hidden = false;
  els.sourcesDrawer.classList.add("open");
  els.sourcesDrawer.setAttribute("aria-hidden", "false");

  if (selectedIndex !== null && selectedIndex !== undefined) {
    window.setTimeout(() => {
      const selected = els.sourcesDrawerList.querySelector('[data-source-index="' + selectedIndex + '"]');
      if (selected) selected.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }
}

function closeSourcesDrawer() {
  if (els.drawerOverlay) els.drawerOverlay.hidden = true;
  if (els.sourcesDrawer) {
    els.sourcesDrawer.classList.remove("open");
    els.sourcesDrawer.setAttribute("aria-hidden", "true");
  }
}

function getDomainName(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch (_error) {
    return url || "";
  }
}

function valueOrNA(value) {
  return value === undefined || value === null ? "No reportado" : value;
}

function clearCurrentChat() {
  const chat = getCurrentChat();
  if (!confirm("¿Limpiar el chat actual?")) return;

  chat.messages = [];
  chat.updatedAt = Date.now();
  saveState();
  renderAll();
  setStatus("Chat limpiado");
}

function setStatus(text) {
  els.status.textContent = text;
}

function getConversationForApi(chat) {
  return chat.messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .map(message => ({
      role: message.role,
      content: message.content
    }));
}

function updateChatTitleFromFirstMessage(chat, text) {
  const genericTitles = ["Nuevo chat", "Chat principal", "Chat sin título"];
  if (!genericTitles.includes(chat.title)) return;

  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;

  chat.title = clean.length > 42 ? clean.slice(0, 42) + "..." : clean;
}

function handleDocumentSelection(event) {
  const incomingFiles = Array.from(event.target.files || []);
  if (!incomingFiles.length) return;

  const allowedExtensions = ["txt", "md", "pdf", "docx"];
  const accepted = [];

  incomingFiles.forEach(file => {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      alert("Archivo no soportado: " + file.name + "\nUsa TXT, MD, PDF o DOCX.");
      return;
    }
    accepted.push(file);
  });

  selectedDocumentFiles = [...selectedDocumentFiles, ...accepted].slice(0, 5);
  els.documentInput.value = "";
  renderAttachedFiles();
}

function renderAttachedFiles() {
  if (!els.attachedFiles) return;

  els.attachedFiles.innerHTML = "";

  if (!selectedDocumentFiles.length) {
    els.attachedFiles.style.display = "none";
    return;
  }

  els.attachedFiles.style.display = "flex";

  selectedDocumentFiles.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";

    const name = document.createElement("span");
    name.textContent = "📄 " + file.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Quitar archivo";
    remove.addEventListener("click", () => {
      selectedDocumentFiles = selectedDocumentFiles.filter((_file, fileIndex) => fileIndex !== index);
      renderAttachedFiles();
    });

    chip.appendChild(name);
    chip.appendChild(remove);
    els.attachedFiles.appendChild(chip);
  });
}

function clearAttachedFiles() {
  selectedDocumentFiles = [];
  if (els.documentInput) els.documentInput.value = "";
  renderAttachedFiles();
}

function showProcessingIndicator() {
  if (!els.chat) return;
  removeProcessingIndicator();

  const loading = document.createElement("div");
  loading.id = "processingIndicator";
  loading.className = "message assistant loading-message";
  loading.setAttribute("aria-label", "Procesando respuesta");
  loading.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';
  els.chat.appendChild(loading);
  els.chat.scrollTop = els.chat.scrollHeight;
}

function removeProcessingIndicator() {
  const existing = document.getElementById("processingIndicator");
  if (existing) existing.remove();
}

function buildRequestBody(chat) {
  const payload = {
    model: state.settings.model,
    deepThinking: state.settings.deepThinking,
    systemPrompt: state.settings.systemPrompt,
    messages: getConversationForApi(chat),
    useWebSearch: state.settings.useWebSearch,
    maxResults: state.settings.maxResults
  };

  if (!selectedDocumentFiles.length) {
    return {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    };
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, typeof value === "string" ? value : JSON.stringify(value));
  });

  selectedDocumentFiles.forEach(file => {
    formData.append("documents", file, file.name);
  });

  return { body: formData, headers: {} };
}

async function sendMessage() {
  saveSettings();

  const text = els.messageInput.value.trim();
  if (!text) return;

  const project = getCurrentProject();
  const chat = getCurrentChat();

  updateChatTitleFromFirstMessage(chat, text);
  chat.messages.push({ role: "user", content: text });
  chat.updatedAt = Date.now();

  els.messageInput.value = "";
  saveState();
  renderAll();
  showProcessingIndicator();

  const statusParts = [];
  if (state.settings.useWebSearch) statusParts.push("buscando en internet");
  if (state.settings.deepThinking) statusParts.push("razonando con pensamiento profundo");
  if (selectedDocumentFiles.length) statusParts.push("leyendo documentos");

  setStatus(statusParts.length ? "Procesando: " + statusParts.join(", ") + "..." : "Consultando DeepSeek...");
  els.sendBtn.disabled = true;

  try {
    const request = buildRequestBody(chat);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: request.headers,
      body: request.body
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Error desconocido");
    }

    chat.messages.push({
      role: "assistant",
      content: data.answer || "No se recibió respuesta del modelo.",
      meta: {
        model: data.model,
        usage: data.usage,
        sources: data.sources || [],
        documents: data.documents || [],
        webSearchUsed: data.webSearchUsed,
        deepThinking: data.deepThinking
      }
    });

    chat.updatedAt = Date.now();
    project.currentChatId = chat.id;
    state.currentChatId = chat.id;

    clearAttachedFiles();
    saveState();
    renderAll();
    setStatus("Listo");
  } catch (error) {
    console.error(error);

    chat.messages.push({
      role: "assistant",
      content: "Error al consultar la aplicación.\n\nDetalle: " + error.message,
      meta: {
        model: "No disponible",
        usage: {},
        sources: [],
        documents: [],
        webSearchUsed: state.settings.useWebSearch,
        deepThinking: state.settings.deepThinking
      }
    });

    chat.updatedAt = Date.now();
    saveState();
    renderAll();
    setStatus("Error");
  } finally {
    removeProcessingIndicator();
    els.sendBtn.disabled = false;
    els.messageInput.focus();
  }
}

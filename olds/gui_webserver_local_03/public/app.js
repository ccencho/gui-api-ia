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

  saveState();
}

function hydrateSettingsForm() {
  els.model.value = state.settings.model || "deepseek-v4-flash";
  if (els.themeSelect) els.themeSelect.value = state.settings.theme || "current";
  applyTheme(state.settings.theme || "current");
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
    content.textContent = msg.content;
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
    " · Tokens: " + valueOrNA(usage.total_tokens) +
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

function openSourcesDrawer(sources) {
  if (!els.sourcesDrawer || !els.sourcesDrawerList) return;

  els.sourcesDrawerList.innerHTML = "";
  const safeSources = Array.isArray(sources) ? sources : [];

  if (els.sourcesDrawerSubtitle) {
    els.sourcesDrawerSubtitle.textContent = safeSources.length + (safeSources.length === 1 ? " fuente consultada" : " fuentes consultadas");
  }

  safeSources.forEach((source, index) => {
    const item = document.createElement("a");
    item.className = "drawer-source-item";
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
    els.sendBtn.disabled = false;
    els.messageInput.focus();
  }
}

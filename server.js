import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Node.js 18+ trae fetch global. Usa Node 20, 22 o 24 para evitar node-fetch.
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3010);

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const TAVILY_API_URL = "https://api.tavily.com/search";
const MAX_DOCUMENT_CHARACTERS = Number(process.env.MAX_DOCUMENT_CHARACTERS || 30000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024
  }
});

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "IA Smelpro",
    deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
    nodeVersion: process.version
  });
});

app.post("/api/chat", upload.array("documents", 5), async (req, res) => {
  try {
    const prepared = await prepareChatRequest(req);
    const deepseekStartedAt = performanceNow();
    const deepseekData = await callDeepSeek(prepared.payload);
    const completedAt = performanceNow();

    const answer =
      deepseekData?.choices?.[0]?.message?.content ||
      "No se recibió respuesta del modelo.";

    res.json({
      answer,
      model: deepseekData?.model || getModelName(prepared.body.model),
      usage: deepseekData?.usage || {},
      sources: prepared.sources,
      documents: prepared.documentsForClient,
      webSearchUsed: Boolean(prepared.body.useWebSearch),
      webSearchMode: String(prepared.body.maxResults) === "auto" ? "Automático" : "Manual",
      resolvedWebResults: Boolean(prepared.body.useWebSearch) ? prepared.resolvedWebResults : 0,
      deepThinking: Boolean(prepared.body.deepThinking),
      timings: buildTimings({
        requestStartedAt: prepared.requestStartedAt,
        webStartedAt: prepared.webStartedAt,
        webCompletedAt: prepared.webCompletedAt,
        documentsStartedAt: prepared.documentsStartedAt,
        documentsCompletedAt: prepared.documentsCompletedAt,
        deepseekStartedAt,
        firstTokenAt: null,
        completedAt
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Error interno del servidor."
    });
  }
});

app.post("/api/chat-stream", upload.array("documents", 5), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  let prepared;
  let deepseekStartedAt = null;
  let firstTokenAt = null;

  try {
    prepared = await prepareChatRequest(req, { stream: true });

    sendSse(res, "meta", {
      model: getModelName(prepared.body.model),
      sources: prepared.sources,
      documents: prepared.documentsForClient,
      webSearchUsed: Boolean(prepared.body.useWebSearch),
      webSearchMode: String(prepared.body.maxResults) === "auto" ? "Automático" : "Manual",
      resolvedWebResults: Boolean(prepared.body.useWebSearch) ? prepared.resolvedWebResults : 0,
      deepThinking: Boolean(prepared.body.deepThinking),
      timings: buildTimings({
        requestStartedAt: prepared.requestStartedAt,
        webStartedAt: prepared.webStartedAt,
        webCompletedAt: prepared.webCompletedAt,
        documentsStartedAt: prepared.documentsStartedAt,
        documentsCompletedAt: prepared.documentsCompletedAt,
        deepseekStartedAt: null,
        firstTokenAt: null,
        completedAt: performanceNow()
      })
    });

    deepseekStartedAt = performanceNow();
    let usage = {};
    let modelFromApi = getModelName(prepared.body.model);

    await streamDeepSeek(prepared.payload, {
      onDelta: chunk => {
        if (!firstTokenAt) firstTokenAt = performanceNow();
        sendSse(res, "delta", { text: chunk });
      },
      onUsage: value => {
        usage = value || {};
      },
      onModel: value => {
        if (value) modelFromApi = value;
      }
    });

    const completedAt = performanceNow();
    sendSse(res, "done", {
      model: modelFromApi,
      usage,
      sources: prepared.sources,
      documents: prepared.documentsForClient,
      webSearchUsed: Boolean(prepared.body.useWebSearch),
      webSearchMode: String(prepared.body.maxResults) === "auto" ? "Automático" : "Manual",
      resolvedWebResults: Boolean(prepared.body.useWebSearch) ? prepared.resolvedWebResults : 0,
      deepThinking: Boolean(prepared.body.deepThinking),
      timings: buildTimings({
        requestStartedAt: prepared.requestStartedAt,
        webStartedAt: prepared.webStartedAt,
        webCompletedAt: prepared.webCompletedAt,
        documentsStartedAt: prepared.documentsStartedAt,
        documentsCompletedAt: prepared.documentsCompletedAt,
        deepseekStartedAt,
        firstTokenAt,
        completedAt
      })
    });

    res.end();
  } catch (error) {
    console.error(error);
    sendSse(res, "error", {
      error: error.message || "Error interno del servidor."
    });
    res.end();
  }
});


function performanceNow() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function elapsedMs(start, end) {
  if (!start || !end) return null;
  return Math.max(0, Math.round(end - start));
}

function buildTimings({
  requestStartedAt,
  webStartedAt,
  webCompletedAt,
  documentsStartedAt,
  documentsCompletedAt,
  deepseekStartedAt,
  firstTokenAt,
  completedAt
}) {
  return {
    totalMs: elapsedMs(requestStartedAt, completedAt),
    webSearchMs: elapsedMs(webStartedAt, webCompletedAt),
    documentsMs: elapsedMs(documentsStartedAt, documentsCompletedAt),
    deepSeekMs: elapsedMs(deepseekStartedAt, completedAt),
    firstTokenMs: elapsedMs(requestStartedAt, firstTokenAt),
    generationMs: elapsedMs(firstTokenAt || deepseekStartedAt, completedAt)
  };
}

async function prepareChatRequest(req, options = {}) {
  const requestStartedAt = performanceNow();
  const body = normalizeBody(req.body || {});
  const {
    model = "deepseek-v4-flash",
    deepThinking = false,
    systemPrompt = "",
    messages = [],
    useWebSearch = false,
    maxResults = "auto"
  } = body;

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("Falta configurar DEEPSEEK_API_KEY en el archivo .env.");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("No se recibieron mensajes para enviar al modelo.");
  }

  const lastUserMessage = [...messages].reverse().find(message => message.role === "user");
  const sources = [];
  let webContext = "";
  let resolvedWebResults = 0;
  let webStartedAt = null;
  let webCompletedAt = null;

  if (useWebSearch) {
    if (!process.env.TAVILY_API_KEY) {
      throw new Error("La búsqueda web está activada, pero falta configurar TAVILY_API_KEY en el archivo .env.");
    }

    if (!lastUserMessage?.content) {
      throw new Error("No se encontró una consulta de usuario para buscar en internet.");
    }

    resolvedWebResults = resolveWebResultsCount({
      maxResults,
      userMessage: lastUserMessage.content,
      deepThinking: Boolean(deepThinking)
    });

    webStartedAt = performanceNow();
    const searchData = await searchWeb(lastUserMessage.content, resolvedWebResults);
    webCompletedAt = performanceNow();

    sources.push(...searchData.sources);
    webContext = buildWebContext(searchData.sources, searchData.searchQuery);
  }

  const documentsStartedAt = performanceNow();
  const documentData = await extractDocuments(req.files || []);
  const documentsCompletedAt = performanceNow();
  const documentContext = buildDocumentContext(documentData.documents);

  const finalMessages = buildMessages({
    systemPrompt,
    messages,
    useWebSearch,
    webContext,
    documentContext
  });

  const payload = buildDeepSeekPayload(model, Boolean(deepThinking), finalMessages, {
    stream: Boolean(options.stream)
  });

  return {
    requestStartedAt,
    webStartedAt,
    webCompletedAt,
    documentsStartedAt,
    documentsCompletedAt,
    body,
    sources,
    resolvedWebResults,
    documentsForClient: documentData.documents.map(document => ({
      name: document.name,
      type: document.type,
      characters: document.text.length
    })),
    payload
  };
}

function sendSse(res, event, data) {
  res.write("event: " + event + "\n");
  res.write("data: " + JSON.stringify(data || {}) + "\n\n");
}

async function streamDeepSeek(payload, handlers = {}) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("DeepSeek API " + response.status + ": " + text);
  }

  if (!response.body) {
    throw new Error("DeepSeek no devolvió un flujo de respuesta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n").map(line => line.trim());
      const dataLines = lines
        .filter(line => line.startsWith("data:"))
        .map(line => line.replace(/^data:\s*/, ""));

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === "[DONE]") continue;

        let chunk;
        try {
          chunk = JSON.parse(dataLine);
        } catch (_error) {
          continue;
        }

        if (chunk.model && handlers.onModel) handlers.onModel(chunk.model);
        if (chunk.usage && handlers.onUsage) handlers.onUsage(chunk.usage);

        const delta = chunk.choices?.[0]?.delta || {};
        const content = delta.content || "";

        if (content && handlers.onDelta) handlers.onDelta(content);
      }
    }
  }
}


function normalizeBody(body) {
  return {
    model: parseMaybeJson(body.model, body.model),
    deepThinking: toBoolean(parseMaybeJson(body.deepThinking, body.deepThinking)),
    systemPrompt: parseMaybeJson(body.systemPrompt, body.systemPrompt) || "",
    messages: parseMaybeJson(body.messages, []),
    useWebSearch: toBoolean(parseMaybeJson(body.useWebSearch, body.useWebSearch)),
    maxResults: parseMaybeJson(body.maxResults, "auto") || "auto"
  };
}

function parseMaybeJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      return fallback;
    }
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  return value;
}

function toBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function buildMessages({ systemPrompt, messages, useWebSearch, webContext, documentContext }) {
  let system = systemPrompt || "Eres un asistente útil.";

  system +=
    "\n\nINSTRUCCIONES GENERALES:" +
    "\n- Responde con claridad, precisión y sin inventar datos." +
    "\n- Si no tienes suficiente información, dilo de forma directa." +
    "\n- Usa Markdown limpio y ordenado: títulos con ## o ###, listas y tablas solo cuando ayuden a entender." +
    "\n- Usa negrita con moderación: solo para conceptos clave, nombres de secciones o valores importantes." +
    "\n- Evita abusar de títulos, separadores y tablas; prioriza una lectura natural tipo DeepSeek/Kimi." +
    "\n- Cuando entregues código, usa siempre bloques de código fenced con el lenguaje correspondiente, por ejemplo ```html, ```javascript o ```css. No entregues código como texto plano." +
    "\n- No uses separadores --- salvo que realmente dividan secciones importantes.";

  if (useWebSearch) {
    system +=
      "\n- La aplicación ya realizó una búsqueda web mediante Tavily." +
      "\n- Si existe CONTEXTO WEB, debes usarlo para responder la consulta del usuario." +
      "\n- No digas que no tienes acceso a internet cuando exista CONTEXTO WEB." +
      "\n- Si las fuentes web no son suficientes, son antiguas o no son relevantes, indícalo claramente antes de concluir." +
      "\n- Para datos actuales, leyes, precios, censos, versiones de software, modelos de IA, especificaciones técnicas o temas oficiales, prioriza fuentes oficiales, documentación primaria y fecha de publicación." +
      "\n- Cuando el tema sea un censo, estadística pública o información gubernamental, diferencia explícitamente entre: evento ejecutado, resultados preliminares, resultados finales publicados y proyecciones/estimaciones." +
      "\n- Si las fuentes se contradicen, explica la diferencia y no fuerces una sola conclusión sin respaldo." +
      "\n- No completes vacíos con memoria del modelo si el usuario pidió búsqueda web; usa la memoria solo como apoyo y marca la incertidumbre." +
      "\n- Cuando uses información web, cita las fuentes por número dentro del texto, por ejemplo [1], [2] o [1][3][5]." +
      "\n- Coloca las citas justo al lado de la afirmación que respaldan, no todas juntas al final." +
      "\n- Cada número de cita debe corresponder a una fuente del CONTEXTO WEB.";
  }

  if (documentContext) {
    system +=
      "\n- Si existe CONTEXTO DE DOCUMENTOS ADJUNTOS, úsalo para responder." +
      "\n- No afirmes que leíste archivos externos; solo usa el texto extraído que aparece en el contexto.";
  }

  const finalMessages = [{ role: "system", content: system }];

  if (useWebSearch && webContext) {
    finalMessages.push({
      role: "system",
      content:
        "CONTEXTO WEB OBTENIDO POR LA APLICACIÓN MEDIANTE TAVILY:\n\n" +
        webContext +
        "\n\nUsa este contexto web para responder la consulta del usuario."
    });
  }

  if (documentContext) {
    finalMessages.push({
      role: "system",
      content:
        "CONTEXTO DE DOCUMENTOS ADJUNTOS EXTRAÍDO POR LA APLICACIÓN:\n\n" +
        documentContext +
        "\n\nUsa este contexto documental cuando sea relevante para responder."
    });
  }

  const cleanedMessages = messages
    .filter(message => message && (message.role === "user" || message.role === "assistant"))
    .map(message => ({
      role: message.role,
      content: String(message.content || "")
    }));

  finalMessages.push(...cleanedMessages);
  return finalMessages;
}

function getModelName(modelValue) {
  return String(modelValue || "deepseek-v4-flash").split("|")[0];
}

function buildDeepSeekPayload(modelValue, deepThinking, messages, options = {}) {
  const modelName = getModelName(modelValue);
  const shouldStream = Boolean(options.stream);

  const payload = {
    model: modelName,
    messages,
    stream: shouldStream,
    thinking: {
      type: deepThinking ? "enabled" : "disabled"
    }
  };

  if (shouldStream) {
    payload.stream_options = {
      include_usage: true
    };
  }

  if (deepThinking) {
    payload.reasoning_effort = "high";
  } else {
    payload.temperature = 0.4;
  }

  return payload;
}

async function callDeepSeek(payload) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error("DeepSeek API " + response.status + ": " + text);
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("DeepSeek respondió con un formato no JSON: " + text);
  }
}

function resolveWebResultsCount({ maxResults, userMessage, deepThinking }) {
  if (String(maxResults) !== "auto") {
    const manualValue = Number(maxResults || 5);
    return Math.min(Math.max(manualValue, 1), 10);
  }

  const text = String(userMessage || "").toLowerCase().trim();

  const isSimpleQuestion =
    text.length < 90 &&
    /^(que es|qué es|donde|dónde|quien|quién|cuando|cuándo|define|significa|cuál es|cual es)/.test(text);

  const needsMoreSources =
    /precio|precios|costo|costos|comparar|compara|comparativo|ranking|benchmark|noticia|noticias|actual|actuales|reciente|recientes|modelo|modelos|versión|version|proveedor|mercado|perú|latam|fuentes|investiga|analiza|tendencia|tendencias|norma|ley|regulación|regulacion/.test(text);

  const isLongQuestion = text.length > 180;

  if (deepThinking && (needsMoreSources || isLongQuestion)) return 10;
  if (deepThinking) return 8;
  if (needsMoreSources || isLongQuestion) return 8;
  if (isSimpleQuestion) return 3;

  return 5;
}

function buildSearchQuery(userQuery) {
  const query = String(userQuery || "").trim();
  const lower = query.toLowerCase();
  const hints = [];

  const asksCurrentInfo = /último|ultima|actual|actuales|vigente|reciente|recientes|2024|2025|2026|hoy|ahora|precio|precios|costo|costos|noticia|noticias|versión|version|modelo|modelos|publicado|resultados/.test(lower);
  const isPeruOfficial = /perú|peru|gob\.pe|inei|censo|población|poblacion|vivienda|ministerio|estado peruano|sunat|indecopi|mtc|minem|produce/.test(lower);
  const isCensus = /censo|censos|inei|población|poblacion|vivienda|comunidades indígenas|comunidades indigenas/.test(lower);
  const isLegalOrNormative = /ley|norma|reglamento|decreto|resolución|resolucion|obligatorio|vigente|normativa|regulación|regulacion/.test(lower);
  const isTechnical = /datasheet|ficha técnica|ficha tecnica|documentación|documentacion|manual|api|modelo|versión|version|github|release|spec|especificación|especificacion/.test(lower);

  if (asksCurrentInfo) hints.push("información actualizada fecha publicación fuente reciente");
  if (isPeruOfficial) hints.push("fuente oficial Perú gob.pe");
  if (isCensus) hints.push("INEI Censos Nacionales 2025 resultados finales publicados 2017 proyecciones");
  if (isLegalOrNormative) hints.push("norma oficial vigente diario oficial gob.pe");
  if (isTechnical) hints.push("documentación oficial latest docs official");

  return [query, ...hints].filter(Boolean).join(" ");
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_error) {
    return "";
  }
}

function scoreSource(source, originalQuery) {
  const title = String(source.title || "").toLowerCase();
  const content = String(source.content || "").toLowerCase();
  const url = String(source.url || "").toLowerCase();
  const domain = getDomain(source.url);
  const query = String(originalQuery || "").toLowerCase();
  let score = Number(source.score || 0) * 10;

  const officialDomains = [
    "gob.pe",
    "inei.gob.pe",
    "datosabiertos.gob.pe",
    "aws.amazon.com",
    "docs.aws.amazon.com",
    "api-docs.deepseek.com",
    "docs.tavily.com",
    "openai.com",
    "help.openai.com",
    "anthropic.com",
    "support.anthropic.com"
  ];

  if (officialDomains.some(official => domain === official || domain.endsWith("." + official))) score += 50;
  if (/\.gov$|\.gov\./.test(domain)) score += 35;
  if (/docs\.|documentation|developer|api-docs|manual|datasheet/.test(domain + " " + title)) score += 18;

  const currentYear = new Date().getFullYear();
  const recentYears = [currentYear, currentYear - 1, currentYear - 2].map(String);
  if (recentYears.some(year => title.includes(year) || content.includes(year) || url.includes(year))) score += 12;

  if (/perú|peru|inei|censo|población|poblacion|vivienda|gobierno/.test(query)) {
    if (domain.endsWith("gob.pe") || domain.endsWith("inei.gob.pe")) score += 45;
    if (/inei|censos nacionales|gob\.pe|estado peruano/.test(title + " " + content + " " + url)) score += 20;
  }

  const queryTerms = query
    .replace(/[¿?¡!,.;:()\[\]"']/g, " ")
    .split(/\s+/)
    .filter(term => term.length > 4)
    .slice(0, 12);
  for (const term of queryTerms) {
    if (title.includes(term)) score += 3;
    if (content.includes(term)) score += 1;
  }

  const lowQualitySignals = /google traductor|traducir|translate|pinterest|facebook|tiktok|youtube|reddit|quora|foro/.test(title + " " + domain);
  if (lowQualitySignals) score -= 25;

  const veryShortContent = String(source.content || "").trim().length < 60;
  if (veryShortContent) score -= 8;

  return score;
}

async function searchWeb(query, maxResults) {
  const safeMax = Math.min(Math.max(Number(maxResults || 5), 1), 10);
  const enhancedQuery = buildSearchQuery(query);

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.TAVILY_API_KEY
    },
    body: JSON.stringify({
      query: enhancedQuery,
      search_depth: "advanced",
      max_results: safeMax,
      include_answer: false,
      include_raw_content: false
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error("Tavily API " + response.status + ": " + text);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (_error) {
    throw new Error("Tavily respondió con un formato no JSON: " + text);
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const sources = results
    .map(result => ({
      title: result.title || result.url || "Fuente sin título",
      url: result.url || "",
      content: result.content || result.snippet || "",
      publishedDate: result.published_date || result.publishedDate || "",
      domain: getDomain(result.url || ""),
      score: result.score || 0
    }))
    .filter(source => source.url)
    .map(source => ({
      ...source,
      qualityScore: scoreSource(source, query)
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, safeMax);

  return {
    searchQuery: enhancedQuery,
    sources
  };
}

function buildWebContext(sources, searchQuery = "") {
  if (!sources.length) {
    return "No se encontraron resultados web útiles para esta consulta.";
  }

  const header = [
    "Consulta enviada al buscador: " + searchQuery,
    "Nota de validación: revisa fecha, dominio y calidad de cada fuente. Prioriza fuentes oficiales/documentación primaria cuando existan."
  ].join("\n");

  const body = sources.map((source, index) => {
    return [
      "[" + (index + 1) + "] " + source.title,
      "Dominio: " + (source.domain || "No identificado"),
      "URL: " + source.url,
      source.publishedDate ? "Fecha publicada: " + source.publishedDate : "Fecha publicada: No indicada",
      "Calidad estimada: " + Math.round(source.qualityScore || 0),
      "Extracto: " + source.content
    ].join("\n");
  }).join("\n\n");

  return header + "\n\n" + body;
}

async function extractDocuments(files) {
  const documents = [];
  let remainingCharacters = MAX_DOCUMENT_CHARACTERS;

  for (const file of files) {
    if (remainingCharacters <= 0) break;

    const extracted = await extractTextFromFile(file);
    const limitedText = truncateText(extracted.text, remainingCharacters);
    remainingCharacters -= limitedText.length;

    documents.push({
      name: file.originalname,
      type: extracted.type,
      text: limitedText
    });
  }

  return { documents };
}

async function extractTextFromFile(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (extension === ".txt" || extension === ".md") {
    return {
      type: extension.replace(".", "") || "text",
      text: file.buffer.toString("utf8")
    };
  }

  if (extension === ".pdf") {
    const parsed = await pdfParse(file.buffer);
    return {
      type: "pdf",
      text: parsed.text || ""
    };
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return {
      type: "docx",
      text: result.value || ""
    };
  }

  throw new Error("Tipo de archivo no soportado: " + file.originalname + ". Usa TXT, MD, PDF o DOCX.");
}

function buildDocumentContext(documents) {
  if (!documents.length) return "";

  return documents.map((document, index) => {
    return [
      "[Documento " + (index + 1) + "] " + document.name,
      "Tipo: " + document.type,
      "Texto extraído:",
      document.text || "No se pudo extraer texto útil."
    ].join("\n");
  }).join("\n\n---\n\n");
}

function truncateText(text, maxCharacters) {
  const safeText = String(text || "").trim();
  if (safeText.length <= maxCharacters) return safeText;
  return safeText.slice(0, maxCharacters) + "\n\n[Texto truncado por límite de caracteres]";
}

app.listen(PORT, () => {
  console.log("IA Smelpro corriendo en http://localhost:" + PORT);
});

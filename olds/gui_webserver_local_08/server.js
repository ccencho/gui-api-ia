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
      return res.status(500).json({
        error: "Falta configurar DEEPSEEK_API_KEY en el archivo .env."
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "No se recibieron mensajes para enviar al modelo."
      });
    }

    const lastUserMessage = [...messages].reverse().find(message => message.role === "user");
    const sources = [];
    let webContext = "";
    let resolvedWebResults = 0;

    if (useWebSearch) {
      if (!process.env.TAVILY_API_KEY) {
        return res.status(500).json({
          error: "La búsqueda web está activada, pero falta configurar TAVILY_API_KEY en el archivo .env."
        });
      }

      if (!lastUserMessage?.content) {
        return res.status(400).json({
          error: "No se encontró una consulta de usuario para buscar en internet."
        });
      }

      resolvedWebResults = resolveWebResultsCount({
        maxResults,
        userMessage: lastUserMessage.content,
        deepThinking: Boolean(deepThinking)
      });

      const searchData = await searchWeb(lastUserMessage.content, resolvedWebResults);
      sources.push(...searchData.sources);
      webContext = buildWebContext(searchData.sources);
    }

    const documentData = await extractDocuments(req.files || []);
    const documentContext = buildDocumentContext(documentData.documents);

    const finalMessages = buildMessages({
      systemPrompt,
      messages,
      useWebSearch,
      webContext,
      documentContext
    });

    const payload = buildDeepSeekPayload(model, Boolean(deepThinking), finalMessages);
    const deepseekData = await callDeepSeek(payload);

    const answer =
      deepseekData?.choices?.[0]?.message?.content ||
      "No se recibió respuesta del modelo.";

    res.json({
      answer,
      model: deepseekData?.model || getModelName(model),
      usage: deepseekData?.usage || {},
      sources,
      documents: documentData.documents.map(document => ({
        name: document.name,
        type: document.type,
        characters: document.text.length
      })),
      webSearchUsed: Boolean(useWebSearch),
      webSearchMode: String(maxResults) === "auto" ? "Automático" : "Manual",
      resolvedWebResults: Boolean(useWebSearch) ? resolvedWebResults : 0,
      deepThinking: Boolean(deepThinking)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Error interno del servidor."
    });
  }
});

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
      "\n- Si las fuentes web no son suficientes o no son relevantes, indícalo claramente." +
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

function buildDeepSeekPayload(modelValue, deepThinking, messages) {
  const modelName = getModelName(modelValue);

  const payload = {
    model: modelName,
    messages,
    stream: false,
    thinking: {
      type: deepThinking ? "enabled" : "disabled"
    }
  };

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

async function searchWeb(query, maxResults) {
  const safeMax = Math.min(Math.max(Number(maxResults || 5), 1), 10);

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.TAVILY_API_KEY
    },
    body: JSON.stringify({
      query,
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

  return {
    sources: results.map(result => ({
      title: result.title || result.url || "Fuente sin título",
      url: result.url || "",
      content: result.content || result.snippet || ""
    })).filter(source => source.url)
  };
}

function buildWebContext(sources) {
  if (!sources.length) {
    return "No se encontraron resultados web útiles para esta consulta.";
  }

  return sources.map((source, index) => {
    return [
      "[" + (index + 1) + "] " + source.title,
      "URL: " + source.url,
      "Extracto: " + source.content
    ].join("\n");
  }).join("\n\n");
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

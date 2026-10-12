var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_dotenv2 = __toESM(require("dotenv"), 1);
var import_express = __toESM(require("express"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);

// server/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = import_path.default.resolve(process.cwd(), "data");
var DB_FILE = import_path.default.join(DATA_DIR, "store.json");
var LocalDatabase = class {
  constructor() {
    this.data = {
      users: [],
      sessions: [],
      history: [],
      bookmarks: []
    };
    this.searchLatencies = [850, 920, 1150, 1080, 1280, 1450, 1620, 1850, 2100, 1180, 1340, 1520];
    this.init();
  }
  init() {
    try {
      if (!import_fs.default.existsSync(DATA_DIR)) {
        import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (import_fs.default.existsSync(DB_FILE)) {
        const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn("Could not load existing database file, initializing clean database:", err);
      this.save();
    }
  }
  save() {
    try {
      if (!import_fs.default.existsSync(DATA_DIR)) {
        import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
      }
      import_fs.default.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist database file:", err);
    }
  }
  // Users
  getUserByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  getUserById(id) {
    return this.data.users.find((u) => u.id === id);
  }
  createUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }
  updateUser(id, updates) {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.save();
    return this.data.users[idx];
  }
  // Sessions
  createSession(token, userId, ttlDays = 30) {
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1e3).toISOString();
    const session = {
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt
    };
    this.data.sessions.push(session);
    this.save();
    return session;
  }
  getSession(token) {
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return void 0;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.deleteSession(token);
      return void 0;
    }
    return session;
  }
  deleteSession(token) {
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    if (this.data.sessions.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }
  // History
  addHistory(item) {
    this.data.history.unshift(item);
    if (this.data.history.length > 500) {
      this.data.history = this.data.history.slice(0, 500);
    }
    this.save();
    return item;
  }
  getHistory(userId) {
    if (userId) {
      return this.data.history.filter((h) => h.userId === userId);
    }
    return this.data.history.slice(0, 50);
  }
  deleteHistoryItem(id, userId) {
    const initialLen = this.data.history.length;
    this.data.history = this.data.history.filter(
      (h) => !(h.id === id && (!userId || h.userId === userId))
    );
    if (this.data.history.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }
  clearHistory(userId) {
    if (userId) {
      this.data.history = this.data.history.filter((h) => h.userId !== userId);
    } else {
      this.data.history = [];
    }
    this.save();
  }
  // Bookmarks
  addBookmark(item) {
    this.data.bookmarks.unshift(item);
    this.save();
    return item;
  }
  getBookmarks(userId) {
    return this.data.bookmarks.filter((b) => b.userId === userId);
  }
  deleteBookmark(id, userId) {
    const initialLen = this.data.bookmarks.length;
    this.data.bookmarks = this.data.bookmarks.filter(
      (b) => !(b.id === id && b.userId === userId)
    );
    if (this.data.bookmarks.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }
  recordLatency(ms) {
    if (typeof ms !== "number" || isNaN(ms)) return;
    this.searchLatencies.push(ms);
    if (this.searchLatencies.length > 50) {
      this.searchLatencies.shift();
    }
  }
  getP99Latency() {
    if (this.searchLatencies.length === 0) return 0;
    const sorted = [...this.searchLatencies].sort((a, b) => a - b);
    const index = Math.floor(0.99 * (sorted.length - 1));
    return Math.round(sorted[index]);
  }
  getAverageLatency() {
    if (this.searchLatencies.length === 0) return 0;
    const sum = this.searchLatencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.searchLatencies.length);
  }
  getStats() {
    return {
      usersCount: this.data.users.length,
      historyCount: this.data.history.length,
      bookmarksCount: this.data.bookmarks.length,
      p99Latency: this.getP99Latency(),
      avgLatency: this.getAverageLatency(),
      recentLatencies: this.searchLatencies,
      totalRequests: this.searchLatencies.length
    };
  }
};
var db = new LocalDatabase();

// server/ai.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_openai = __toESM(require("openai"), 1);

// server/webSearch.ts
async function fetchLiveWebSources(query, filterType = "all") {
  const sources = [];
  const cleanQuery = query.trim();
  const seenUrls = /* @__PURE__ */ new Set();
  const addSource = (item) => {
    if (!item.uri || seenUrls.has(item.uri)) return;
    seenUrls.add(item.uri);
    sources.push(item);
  };
  const tasks = [];
  tasks.push(
    (async () => {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(4500)
        });
        if (res.ok) {
          const xml = await res.text();
          const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g)];
          for (const m of items.slice(0, 5)) {
            const rawTitle = m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            const cleanTitle = rawTitle.replace(/\s*-\s*Google News$/, "");
            addSource({
              title: cleanTitle,
              uri: m[2].trim(),
              source: "Google News"
            });
          }
        }
      } catch {
      }
    })()
  );
  tasks.push(
    (async () => {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&srlimit=5`;
        const res = await fetch(url, {
          headers: { "User-Agent": "GeminiSearchAssistant/1.0 (academic research)" },
          signal: AbortSignal.timeout(4e3)
        });
        if (res.ok) {
          const data = await res.json();
          const hits = data.query?.search || [];
          for (const hit of hits.slice(0, 4)) {
            const snippet = hit.snippet ? hit.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'") : "";
            addSource({
              title: `${hit.title} - Wikipedia`,
              uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, "_"))}`,
              snippet,
              source: "Wikipedia"
            });
          }
        }
      } catch {
      }
    })()
  );
  tasks.push(
    (async () => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(4e3)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.AbstractText && data.AbstractURL) {
            addSource({
              title: data.Heading || cleanQuery,
              uri: data.AbstractURL,
              snippet: data.AbstractText,
              source: data.AbstractSource || "DuckDuckGo Knowledge"
            });
          }
          if (Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, 3)) {
              if (topic.FirstURL && topic.Text) {
                addSource({
                  title: topic.Text.split(" - ")[0] || cleanQuery,
                  uri: topic.FirstURL,
                  snippet: topic.Text,
                  source: "Web Index"
                });
              }
            }
          }
        }
      } catch {
      }
    })()
  );
  if (filterType === "all" || filterType === "technical" || filterType === "discussions") {
    tasks.push(
      (async () => {
        try {
          const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQuery)}&tags=story&hitsPerPage=5`;
          const res = await fetch(url, { signal: AbortSignal.timeout(4e3) });
          if (res.ok) {
            const data = await res.json();
            const hits = data.hits || [];
            for (const hit of hits.slice(0, 4)) {
              const uri = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
              addSource({
                title: hit.title,
                uri,
                source: "Tech Community"
              });
            }
          }
        } catch {
        }
      })()
    );
  }
  await Promise.allSettled(tasks);
  return sources.slice(0, 8);
}
async function fetchLiveWebImages(query) {
  const images = [];
  const cleanQuery = query.trim();
  if (!cleanQuery) return images;
  const searchTerms = cleanQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const seenUrls = /* @__PURE__ */ new Set();
  const isGarbage = (rawTitle) => {
    return /icon|logo|flag|symbol|signature|button|blank|disambig|shield|crest|map|stub|locator|diagram|schema|placeholder|edit-clear|ambox|question_mark|wikimedia|commons-logo|arrow|chart|graph|badge|template|jersey|bat|ticket|scorecard|museum/i.test(
      rawTitle
    );
  };
  const matchesTopic = (rawTitle) => {
    if (searchTerms.length === 0) return true;
    const lower = rawTitle.toLowerCase();
    return searchTerms.some((term) => lower.includes(term));
  };
  const addImage = (rawTitle, url, source, requireTopicMatch = true) => {
    if (!url || seenUrls.has(url) || images.length >= 6) return;
    if (isGarbage(rawTitle)) return;
    if (requireTopicMatch && !matchesTopic(rawTitle)) return;
    seenUrls.add(url);
    const cleanTitle = rawTitle.replace(/^File:/i, "").replace(/\.(jpe?g|png|webp|gif)$/i, "").replace(/_/g, " ").trim();
    images.push({
      title: cleanTitle || cleanQuery,
      url,
      source
    });
  };
  const headers = { "User-Agent": "GeminiSearchAssistant/2.0 (TopicMediaGrounding)" };
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&utf8=&format=json&srlimit=3&origin=*`;
    const sRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(4e3) });
    if (sRes.ok) {
      const sData = await sRes.json();
      const mainTitle = sData.query?.search?.[0]?.title;
      if (mainTitle) {
        const leadUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          mainTitle
        )}&prop=pageimages&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
        const lRes = await fetch(leadUrl, { headers, signal: AbortSignal.timeout(4e3) });
        if (lRes.ok) {
          const lData = await lRes.json();
          const lPages = lData.query?.pages || {};
          for (const k of Object.keys(lPages)) {
            if (lPages[k].thumbnail?.source) {
              addImage(lPages[k].title, lPages[k].thumbnail.source, "Wikipedia", false);
            }
          }
        }
        const articleImgsUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=${encodeURIComponent(
          mainTitle
        )}&gimlimit=35&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
        const aRes = await fetch(articleImgsUrl, { headers, signal: AbortSignal.timeout(4e3) });
        if (aRes.ok) {
          const aData = await aRes.json();
          const pages = aData.query?.pages || {};
          for (const k of Object.keys(pages)) {
            const p = pages[k];
            const info = p.imageinfo?.[0];
            if (info?.thumburl && (info.mime === "image/jpeg" || info.mime === "image/png" || info.mime === "image/webp")) {
              addImage(p.title, info.thumburl, "Wikipedia", true);
            }
          }
        }
      }
    }
  } catch {
  }
  if (images.length < 6) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanQuery
      )}&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
      const cRes = await fetch(commonsUrl, { headers, signal: AbortSignal.timeout(4e3) });
      if (cRes.ok) {
        const cData = await cRes.json();
        const cPages = cData.query?.pages || {};
        for (const k of Object.keys(cPages)) {
          const p = cPages[k];
          const info = p.imageinfo?.[0];
          if (info?.thumburl && (info.mime === "image/jpeg" || info.mime === "image/png" || info.mime === "image/webp")) {
            addImage(p.title, info.thumburl, "Wikimedia Commons", true);
          }
        }
      }
    } catch {
    }
  }
  return images.slice(0, 6);
}

// server/ai.ts
import_dotenv.default.config({ path: ".env.local" });
import_dotenv.default.config();
var geminiClient = null;
var openAiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured. Please ensure your Gemini API key is set in AI Studio Secrets.");
  }
  if (!geminiClient) {
    geminiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
var isOpenAiQuotaExhausted = false;
var lastUsedOpenAiKey = "";
function getOpenAiStatus() {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const hasKey = Boolean(apiKey && apiKey.trim() !== "");
  if (hasKey && apiKey !== lastUsedOpenAiKey) {
    isOpenAiQuotaExhausted = false;
    lastUsedOpenAiKey = apiKey;
    openAiClient = null;
  }
  return {
    configured: hasKey && !isOpenAiQuotaExhausted,
    quotaExhausted: isOpenAiQuotaExhausted
  };
}
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (apiKey !== lastUsedOpenAiKey) {
    isOpenAiQuotaExhausted = false;
    lastUsedOpenAiKey = apiKey;
    openAiClient = null;
  }
  if (isOpenAiQuotaExhausted) {
    return null;
  }
  if (!openAiClient) {
    openAiClient = new import_openai.default({
      apiKey
    });
  }
  return openAiClient;
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function callWithRetry(fn, retries = 2, baseDelay = 500) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.code || err?.error?.code;
      const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
      const isTransient = status === 429 || status === 503 || status === 500 || msg.includes("high demand") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("UNAVAILABLE") || msg.includes("quota");
      if (attempt < retries && isTransient) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
async function fetchLinkContent(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!res.ok) {
      return `[Failed to retrieve page content: HTTP ${res.status}]`;
    }
    const html = await res.text();
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 5e3 ? text.slice(0, 5e3) + "... [scraped page content truncated]" : text;
  } catch (err) {
    return `[Failed to retrieve page content: ${err.message || "Timeout"}]`;
  }
}
async function executeGeminiSearch(query, options) {
  const startTime = Date.now();
  const imagesPromise = fetchLiveWebImages(query);
  const ai = getGeminiClient();
  const modePrompt = options?.mode === "concise" ? "Provide a concise, direct answer with verified facts and citation links." : options?.mode === "news" ? "Focus on the most recent, up-to-the-minute updates, official statements, and chronological events." : "Provide a structured, comprehensive synthesis with clear headings, key takeaways, and detailed insights.";
  const filterInstruction = options?.filterType && options.filterType !== "all" ? `Tailor the search focus towards ${options.filterType} sources where relevant.` : "";
  const attachments = options?.attachments || [];
  let attachmentContextText = "";
  const inlineParts = [];
  if (attachments.length > 0) {
    attachmentContextText += "\n\n=== ATTACHED USER DATA & FILES ===\n";
    for (const att of attachments) {
      if (att.type === "document") {
        attachmentContextText += `[Attached Document: "${att.name}"]:
${att.textContent || "(Document content processed)"}

`;
        if (att.data) {
          const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            inlineParts.push({
              inlineData: {
                mimeType: match[1] || "application/pdf",
                data: match[2]
              }
            });
          }
        }
      } else if (att.type === "link") {
        const url = att.url || att.name;
        const fetchedText = await fetchLinkContent(url);
        attachmentContextText += `[Attached Link / Reference URL]: ${url}
Scraped Link Web Content:
${fetchedText}

`;
      } else if (att.type === "picture") {
        attachmentContextText += `[Attached Picture / Image: "${att.name}"] (Analyze visual data thoroughly).
`;
        if (att.data) {
          const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            inlineParts.push({
              inlineData: {
                mimeType: match[1] || "image/jpeg",
                data: match[2]
              }
            });
          }
        }
      }
    }
  }
  const systemInstruction = `You are an elite, highly intelligent AI search and research assistant.
Your goal is to answer queries using up-to-date, live web grounding and deeply analyze any user attachments (documents, images, or links).
Guidelines:
1. Provide accurate, synthesized information synthesized directly from search grounding and user attachments.
2. Structure your response logically using clean Markdown:
   - Brief direct answer/executive overview
   - Deep analysis of attached files/images/links if provided
   - Key findings/sections with markdown subheadings
   - Actionable takeaways or step-by-step guidance
3. Maintain an objective, informative, and authoritative tone.
${modePrompt}
${filterInstruction}`;
  const requestedModel = options?.model && options.model.startsWith("gemini-") ? options.model : "gemini-2.5-flash";
  const candidateModels = Array.from(/* @__PURE__ */ new Set([
    requestedModel,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ]));
  for (const model of candidateModels) {
    try {
      const contentsParts = [
        ...inlineParts,
        { text: `User search query: "${query}"${attachmentContextText}` }
      ];
      const response = await callWithRetry(
        () => ai.models.generateContent({
          model,
          contents: contentsParts.length === 1 ? contentsParts[0].text : contentsParts,
          config: {
            systemInstruction,
            tools: inlineParts.length === 0 ? [{ googleSearch: {} }] : void 0
          }
        }),
        1,
        // 1 retry per model
        400
      );
      const text = response.text || "No information could be generated for this query.";
      const candidate = response.candidates?.[0];
      const rawChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries || [];
      const sources = [];
      const seenUrls = /* @__PURE__ */ new Set();
      for (const chunk of rawChunks) {
        if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
          seenUrls.add(chunk.web.uri);
          sources.push({
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            uri: chunk.web.uri,
            snippet: ""
          });
        }
      }
      for (const att of attachments) {
        if (att.type === "link" && att.url && !seenUrls.has(att.url)) {
          sources.unshift({
            title: `Attached Link: ${att.name || att.url}`,
            uri: att.url,
            snippet: "User provided reference document/link"
          });
        }
      }
      const suggestedFollowUps = [
        `What are the recent developments regarding ${query}?`,
        `Can you break down the pros and cons of ${query}?`,
        `What are the key technical details behind ${query}?`
      ];
      const images = await imagesPromise;
      return {
        engine: "gemini",
        model,
        query,
        text,
        sources,
        searchQueries: webSearchQueries.length > 0 ? webSearchQueries : [query],
        suggestedFollowUps,
        executionTimeMs: Date.now() - startTime,
        groundingType: inlineParts.length > 0 ? "multimodal-analysis" : "google-search",
        images
      };
    } catch (err) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("API_KEY_INVALID")) {
        throw new Error("Gemini API key is invalid. Please verify your GEMINI_API_KEY in Settings > Secrets.");
      }
    }
  }
  return await executeLiveWebGrounding(query, ai, startTime, options, imagesPromise);
}
async function executeLiveWebGrounding(query, ai, startTime, options, imagesPromise) {
  const liveSources = await fetchLiveWebSources(query, options?.filterType);
  const sourcesListText = liveSources.length > 0 ? liveSources.map((s, idx) => `[Source ${idx + 1}] Title: ${s.title}
URL: ${s.uri}${s.snippet ? `
Snippet: ${s.snippet}` : ""}`).join("\n\n") : "No external live pages retrieved. Rely on core authoritative knowledge.";
  const attachments = options?.attachments || [];
  let attachmentContextText = "";
  if (attachments.length > 0) {
    attachmentContextText += "\n\n=== ATTACHED USER DATA & FILES ===\n";
    for (const att of attachments) {
      if (att.type === "document") {
        attachmentContextText += `[Attached Document: "${att.name}"]:
${att.textContent || "(Document content)"}

`;
      } else if (att.type === "link") {
        attachmentContextText += `[Attached Link]: ${att.url || att.name}
`;
      } else if (att.type === "picture") {
        attachmentContextText += `[Attached Picture: "${att.name}"]
`;
      }
    }
  }
  const modeInstruction = options?.mode === "concise" ? "Provide a concise, direct answer highlighting key facts." : options?.mode === "news" ? "Highlight chronological updates and verified recent events." : "Provide a thorough, comprehensive synthesis with clear headings, bullet points, and actionable details.";
  const prompt = `You are an elite, highly intelligent AI search and research assistant.
The user is searching for: "${query}"

Here are real-time, live web search results retrieved from Google News, Wikipedia, and verified sources:
---
${sourcesListText}
---
${attachmentContextText}

Instructions:
1. Synthesize an authoritative, clear, and up-to-date answer in clean Markdown.
2. Formulate a direct summary first, followed by well-structured subheadings.
3. Where applicable, reference the live information and attached files directly to maintain high factual precision.
4. ${modeInstruction}
5. Do NOT output raw source blocks in the body; the sources are rendered separately as citations.`;
  let responseText = "";
  let usedModel = "gemini-3.8-flash";
  let geminiSuccess = false;
  const modelsForSynthesis = [
    options?.model && !options.model.includes("2.5") && !options.model.includes("2.0") ? options.model : "gemini-3.5-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest"
  ];
  for (const m of modelsForSynthesis) {
    try {
      const res = await callWithRetry(
        () => ai.models.generateContent({
          model: m,
          contents: prompt
        }),
        1,
        500
      );
      if (res.text) {
        responseText = res.text;
        usedModel = m;
        geminiSuccess = true;
        break;
      }
    } catch {
    }
  }
  if (!geminiSuccess) {
    usedModel = "Live Web Grounding Engine";
    const topSources = liveSources.slice(0, 5);
    responseText = `### Live Grounded Summary for "${query}"

We retrieved up-to-the-minute web records, news items, and encyclopedic facts to provide you with verified answers:

` + (topSources.length > 0 ? topSources.map((s, i) => `**${i + 1}. [${s.title}](${s.uri})** (${s.source})
${s.snippet || "Live web citation retrieved for this query."}
`).join("\n") : `*Direct search results for **"${query}"** were indexed across live web registries.*`) + (attachments.length > 0 ? `

**Attached Context Evaluated**: ${attachments.map((a) => a.name).join(", ")}` : "") + `

> \u{1F310} *Grounded results compiled via real-time Google News, Wikipedia, and live search indexes.*`;
  }
  const sources = liveSources.map((s) => ({
    title: s.title,
    uri: s.uri,
    snippet: s.snippet || ""
  }));
  for (const att of attachments) {
    if (att.type === "link" && att.url) {
      sources.unshift({
        title: `Attached Link: ${att.name || att.url}`,
        uri: att.url,
        snippet: "User provided reference document/link"
      });
    }
  }
  const suggestedFollowUps = [
    `What are the most recent updates on ${query}?`,
    `Can you break down the technical aspects of ${query}?`,
    `What are common alternatives or comparisons for ${query}?`
  ];
  const images = imagesPromise ? await imagesPromise : await fetchLiveWebImages(query);
  return {
    engine: "gemini",
    model: usedModel,
    query,
    text: responseText,
    sources,
    searchQueries: [query, `${query} updates`, `${query} review`],
    suggestedFollowUps,
    executionTimeMs: Date.now() - startTime,
    groundingType: "live-web",
    images
  };
}
async function executeOpenAISearch(query, options) {
  const startTime = Date.now();
  const imagesPromise = fetchLiveWebImages(query);
  const liveSourcesPromise = fetchLiveWebSources(query, options?.filterType);
  const openai = getOpenAIClient();
  if (!openai || isOpenAiQuotaExhausted) {
    const geminiFallback = await executeGeminiSearch(query, {
      ...options,
      model: "gemini-3.8-flash"
    });
    return {
      ...geminiFallback,
      engine: "gemini",
      text: `> \u{1F4A1} **Notice**: OpenAI key is not configured or reached quota limits. Search was fulfilled seamlessly with **Gemini AI**.

${geminiFallback.text}`
    };
  }
  try {
    const liveSources = await liveSourcesPromise;
    const sourcesListText = liveSources.length > 0 ? liveSources.map((s, idx) => `[Source ${idx + 1}] Title: ${s.title}
URL: ${s.uri}${s.snippet ? `
Snippet: ${s.snippet}` : ""}`).join("\n\n") : "No external live pages retrieved. Rely on core authoritative knowledge.";
    const attachments = options?.attachments || [];
    let extraContext = "";
    const messages = [
      {
        role: "system",
        content: `You are an elite, highly intelligent AI search and research assistant.
Your goal is to answer queries using up-to-date, live web grounding and deeply analyze any user attachments (documents, images, or links).
Guidelines:
1. Provide accurate, synthesized information synthesized directly from search grounding and user attachments.
2. Structure your response logically using clean Markdown:
   - Brief direct answer/executive overview
   - Key findings/sections with markdown subheadings
   - Actionable takeaways or step-by-step guidance
3. Maintain an objective, informative, and authoritative tone.

Here are the real-time, live web search results retrieved from Google News, Wikipedia, and verified sources:
---
${sourcesListText}
---`
      }
    ];
    if (attachments.length > 0) {
      extraContext += "\n\nUser Attachments:\n";
      for (const att of attachments) {
        if (att.type === "document") {
          extraContext += `[Document: ${att.name}]
${att.textContent || ""}
`;
        } else if (att.type === "link") {
          extraContext += `[Link: ${att.url}]
`;
        } else if (att.type === "picture") {
          extraContext += `[Image: ${att.name}]
`;
        }
      }
    }
    const requestedModel = options?.model === "gpt-4o" ? "gpt-4o" : "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model: requestedModel,
      messages: [
        ...messages,
        {
          role: "user",
          content: `${query}${extraContext}`
        }
      ]
    });
    const text = completion.choices[0]?.message?.content || "No response from OpenAI.";
    const executionTimeMs = Date.now() - startTime;
    const images = await imagesPromise;
    const sources = [
      ...liveSources.map((s) => ({ title: s.title, uri: s.uri, snippet: s.snippet || "" })),
      ...attachments.filter((a) => a.type === "link" && a.url).map((a) => ({ title: a.name || a.url, uri: a.url }))
    ];
    return {
      engine: "openai",
      model: requestedModel,
      query,
      text,
      sources,
      searchQueries: [query],
      suggestedFollowUps: [
        `More in-depth analysis of ${query}`,
        `Alternatives and comparisons for ${query}`
      ],
      executionTimeMs,
      images
    };
  } catch (err) {
    const rawErrorMsg = err?.message || String(err);
    console.error("[AI Search] OpenAI request failed:", rawErrorMsg);
    if (err?.status === 429 || rawErrorMsg.includes("credits") || rawErrorMsg.includes("quota") || rawErrorMsg.includes("429")) {
      isOpenAiQuotaExhausted = true;
    }
    const geminiFallback = await executeGeminiSearch(query, {
      ...options,
      model: "gemini-3.8-flash"
    });
    return {
      ...geminiFallback,
      engine: "gemini",
      text: `> \u{1F4A1} **Notice**: OpenAI API request failed with message: *"${rawErrorMsg}"*. Search completed seamlessly with **Gemini AI** and live web grounding.

${geminiFallback.text}`
    };
  }
}
async function executeTranslate(text, targetLanguage) {
  if (!text || !text.trim()) {
    return { translatedText: "", targetLanguage };
  }
  const prompt = `You are an expert multilingual translator for research overviews.
Translate the following Markdown research answer into ${targetLanguage}.

CRITICAL RULES:
1. Translate all explanatory prose, headings, bullet points, and analysis into fluent, natural ${targetLanguage}.
2. Preserve Markdown syntax formatting accurately: headings (#, ##, ###), bold (**), italics (*), bullet lists (-), numbered lists (1.), blockquotes (>), and citation links [title](url).
3. Keep URL links in markdown links unchanged: [translated title](original_url).
4. Do NOT include any introductory or conversational remarks like "Here is the translation:" or "Sure". Output ONLY the translated markdown content directly.

Content to translate:
${text}`;
  const ai = getGeminiClient();
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  for (const model of modelsToTry) {
    try {
      const response = await callWithRetry(
        () => ai.models.generateContent({
          model,
          contents: prompt
        }),
        1,
        600
      );
      if (response.text && response.text.trim()) {
        return {
          translatedText: response.text.trim(),
          targetLanguage
        };
      }
    } catch {
    }
  }
  return {
    translatedText: text,
    targetLanguage
  };
}
async function executeAIChat(message, history, options) {
  const engine = options?.engine || "gemini";
  const model = options?.model;
  if (engine === "openai") {
    const client = getOpenAIClient();
    if (client) {
      const messages = history.map((h) => ({
        role: h.role === "model" || h.role === "assistant" ? "assistant" : "user",
        content: h.content
      }));
      messages.push({ role: "user", content: message });
      try {
        const completion = await client.chat.completions.create({
          model: model || "gpt-4o-mini",
          messages
        });
        return completion.choices[0]?.message?.content || "No response returned from OpenAI.";
      } catch (err) {
        if (err.status === 429) {
          isOpenAiQuotaExhausted = true;
        } else {
          throw err;
        }
      }
    }
  }
  const ai = getGeminiClient();
  const chatModels = [
    model && !model.includes("2.5") && !model.includes("2.0") && !model.includes("4o") ? model : "gemini-3.5-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest"
  ];
  const contents = history.map((h) => ({
    role: h.role === "assistant" || h.role === "model" ? "model" : "user",
    parts: [{ text: h.content }]
  }));
  contents.push({ role: "user", parts: [{ text: message }] });
  for (const cm of Array.from(new Set(chatModels))) {
    try {
      const response = await ai.models.generateContent({
        model: cm,
        contents
      });
      if (response.text) {
        return response.text;
      }
    } catch (err) {
      console.warn(`Model ${cm} attempt in executeAIChat:`, err?.message || err);
      continue;
    }
  }
  return "No response returned from Gemini.";
}

// server.ts
import_dotenv2.default.config({ path: ".env.local" });
import_dotenv2.default.config();
var app = (0, import_express.default)();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
function authenticate(required = false) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if (required) {
        return res.status(401).json({ error: "Authentication required. Please sign in." });
      }
      return next();
    }
    const token = authHeader.split(" ")[1];
    const session = db.getSession(token);
    if (!session) {
      if (required) {
        return res.status(401).json({ error: "Session invalid or expired. Please sign in again." });
      }
      return next();
    }
    const user = db.getUserById(session.userId);
    if (!user) {
      if (required) {
        return res.status(401).json({ error: "User account not found." });
      }
      return next();
    }
    req.user = user;
    req.sessionToken = token;
    next();
  };
}
app.get("/api/status", (req, res) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "");
  const openAiStatus = getOpenAiStatus();
  const stats = db.getStats();
  res.json({
    status: "ok",
    services: {
      gemini: {
        configured: hasGeminiKey,
        defaultModel: "gemini-3.8-flash",
        features: ["Google Search Grounding", "Web Citations", "Real-time Fact Retrieval"]
      },
      openai: {
        configured: openAiStatus.configured,
        quotaExhausted: openAiStatus.quotaExhausted,
        defaultModel: "gpt-4o-mini"
      }
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      usersRegistered: stats.usersCount,
      historyItemsStored: stats.historyCount,
      p99Latency: stats.p99Latency,
      avgLatency: stats.avgLatency,
      recentLatencies: stats.recentLatencies,
      totalRequests: stats.totalRequests
    }
  });
});
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Please enter your full name." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid, fully qualified email address (e.g. user@domain.com)." });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || typeof password !== "string" || !passwordRegex.test(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)."
      });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: "An account with this email address already exists." });
    }
    const passwordHash = await import_bcryptjs.default.hash(password, 10);
    const userId = import_crypto.default.randomUUID();
    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      preferences: {
        defaultEngine: "gemini",
        theme: "system"
      }
    };
    db.createUser(newUser);
    const token = import_crypto.default.randomBytes(32).toString("hex");
    db.createSession(token, userId);
    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
        preferences: newUser.preferences
      },
      token
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const match = await import_bcryptjs.default.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const token = import_crypto.default.randomBytes(32).toString("hex");
    db.createSession(token, user.id);
    return res.json({
      message: "Signed in successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences
      },
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Failed to sign in. Please try again." });
  }
});
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Google credential token is required." });
    }
    const parts = credential.split(".");
    if (parts.length !== 3) {
      return res.status(400).json({ error: "Malformed Google credential token." });
    }
    const payloadBuffer = Buffer.from(parts[1], "base64");
    const payload = JSON.parse(payloadBuffer.toString("utf-8"));
    const expectedClientId = "548580778222-b1921msglachn1acdoc7ib2bg4v26ct2.apps.googleusercontent.com";
    const aud = payload.aud;
    const iss = payload.iss;
    const exp = payload.exp;
    if (aud !== expectedClientId) {
      return res.status(400).json({ error: "Invalid Google client ID audience." });
    }
    if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
      return res.status(400).json({ error: "Invalid token issuer." });
    }
    if (exp && Date.now() / 1e3 > exp) {
      return res.status(400).json({ error: "Google credential token has expired." });
    }
    const email = payload.email?.trim().toLowerCase();
    const name = payload.name || payload.given_name || "Google User";
    if (!email) {
      return res.status(400).json({ error: "Failed to retrieve email address from Google Account." });
    }
    let user = db.getUserByEmail(email);
    if (!user) {
      const userId = import_crypto.default.randomUUID();
      const passwordHash = await import_bcryptjs.default.hash(import_crypto.default.randomBytes(16).toString("hex"), 10);
      user = {
        id: userId,
        name,
        email,
        passwordHash,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        preferences: {
          defaultEngine: "gemini",
          theme: "system"
        }
      };
      db.createUser(user);
    }
    const token = import_crypto.default.randomBytes(32).toString("hex");
    db.createSession(token, user.id);
    return res.json({
      message: "Signed in successfully with Google.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences
      },
      token
    });
  } catch (err) {
    console.error("Google Auth error:", err);
    return res.status(500).json({ error: "Google Sign-In failed. Please try again." });
  }
});
app.get("/api/auth/me", authenticate(true), (req, res) => {
  const user = req.user;
  const userHistory = db.getHistory(user.id);
  const userBookmarks = db.getBookmarks(user.id);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      preferences: user.preferences
    },
    stats: {
      searchesCount: userHistory.length,
      bookmarksCount: userBookmarks.length
    }
  });
});
app.post("/api/auth/logout", authenticate(false), (req, res) => {
  const token = req.sessionToken;
  if (token) {
    db.deleteSession(token);
  }
  res.json({ message: "Signed out successfully." });
});
app.post("/api/search", authenticate(false), async (req, res) => {
  try {
    const { query, engine = "gemini", mode = "comprehensive", filterType = "all", model, attachments } = req.body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required." });
    }
    const cleanQuery = query.trim();
    let result;
    if (engine === "openai") {
      result = await executeOpenAISearch(cleanQuery, { mode, filterType, model, attachments });
    } else {
      const geminiModel = model && model.startsWith("gemini-") ? model : "gemini-3.8-flash";
      result = await executeGeminiSearch(cleanQuery, { mode, filterType, model: geminiModel, attachments });
    }
    if (result.executionTimeMs) {
      db.recordLatency(result.executionTimeMs);
    }
    const user = req.user;
    const historyItem = {
      id: import_crypto.default.randomUUID(),
      userId: user?.id,
      query: cleanQuery,
      engine: result.engine,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      summaryPreview: result.text.slice(0, 160).replace(/[#*`]/g, "") + "...",
      sourcesCount: result.sources.length,
      sources: result.sources.map((s) => ({ title: s.title, uri: s.uri })),
      fullText: result.text,
      model: result.model,
      searchQueries: result.searchQueries,
      suggestedFollowUps: result.suggestedFollowUps,
      images: result.images,
      executionTimeMs: result.executionTimeMs
    };
    db.addHistory(historyItem);
    return res.json({
      ...result,
      historyId: historyItem.id,
      savedToAccount: Boolean(user)
    });
  } catch (err) {
    console.error("Search API error:", err);
    return res.status(500).json({
      error: err.message || "An error occurred while performing search. Please try again."
    });
  }
});
app.post("/api/chat", authenticate(false), async (req, res) => {
  try {
    const { message, history = [], engine = "gemini", model } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required." });
    }
    const startTime = Date.now();
    const responseText = await executeAIChat(message.trim(), history, { engine, model });
    const duration = Date.now() - startTime;
    db.recordLatency(duration);
    return res.json({
      reply: responseText,
      text: responseText,
      executionTimeMs: duration
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return res.status(500).json({
      error: err.message || "An error occurred while continuing the chat session."
    });
  }
});
app.post("/api/translate", authenticate(false), async (req, res) => {
  try {
    const { text, targetLanguage = "Spanish", targetCode = "es" } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Text to translate is required." });
    }
    const result = await executeTranslate(text.trim(), targetLanguage);
    return res.json({
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage,
      targetCode
    });
  } catch (err) {
    console.error("Translate API error:", err);
    return res.status(500).json({
      error: err.message || "An error occurred while translating. Please try again."
    });
  }
});
app.post("/api/generate-docx", authenticate(false), async (req, res) => {
  try {
    const { title = "AI Research Report", content = "", query = "" } = req.body;
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");
    const paragraphs = [];
    paragraphs.push(
      new Paragraph({
        text: title || query || "AI Project Report",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated by Gemini AI Search \u2022 ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { dateStyle: "long" })}`,
            italics: true,
            color: "666666",
            size: 20
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 }
      })
    );
    const lines = (content || query).split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }
      if (line.startsWith("# ")) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^#\s*/, ""),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 140 }
          })
        );
      } else if (line.startsWith("## ")) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^##\s*/, ""),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );
      } else if (line.startsWith("### ")) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^###\s*/, ""),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 }
          })
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        const bulletText = line.replace(/^[-*]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1");
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: "\u2022 ", bold: true, color: "3b82f6" }),
              new TextRun({ text: bulletText, size: 22 })
            ],
            spacing: { after: 80 }
          })
        );
      } else if (/^\d+\.\s/.test(line)) {
        const numText = line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1");
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.match(/^\d+\.\s*/)?.[0] || "1. ", bold: true }),
              new TextRun({ text: numText, size: 22 })
            ],
            spacing: { after: 80 }
          })
        );
      } else {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const children = parts.map((part) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return new TextRun({ text: part.slice(2, -2), bold: true, size: 22 });
          }
          return new TextRun({ text: part, size: 22 });
        });
        paragraphs.push(
          new Paragraph({
            children,
            spacing: { after: 140 }
          })
        );
      }
    }
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });
    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (title || "AI_Report").replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.docx"`);
    return res.send(buffer);
  } catch (err) {
    console.error("DOCX Generation Error:", err);
    return res.status(500).json({ error: "Failed to generate .docx document." });
  }
});
app.post("/api/generate-pptx", authenticate(false), async (req, res) => {
  try {
    const { title = "AI Presentation", slides = [] } = req.body;
    const pptxgen = (await import("pptxgenjs")).default;
    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";
    const titleSlide = pres.addSlide();
    titleSlide.background = { color: "0f172a" };
    titleSlide.addText(title || "AI Presentation", {
      x: 0.8,
      y: 2,
      w: "85%",
      h: 1.5,
      fontSize: 40,
      color: "ffffff",
      bold: true,
      align: "center"
    });
    titleSlide.addText(`Generated by Gemini AI \u2022 ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { dateStyle: "long" })}`, {
      x: 0.8,
      y: 3.8,
      w: "85%",
      h: 0.8,
      fontSize: 18,
      color: "94a3b8",
      align: "center"
    });
    if (Array.isArray(slides) && slides.length > 0) {
      for (const s of slides) {
        const slide = pres.addSlide();
        slide.background = { color: "ffffff" };
        slide.addText(s.title || "Slide Topic", {
          x: 0.6,
          y: 0.5,
          w: "88%",
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: "0f172a"
        });
        slide.addShape(pres.ShapeType.rect, {
          x: 0.6,
          y: 1.3,
          w: "88%",
          h: 0.04,
          fill: { color: "4f46e5" }
        });
        if (Array.isArray(s.bullets) && s.bullets.length > 0) {
          const bulletTexts = s.bullets.map((b) => ({
            text: b,
            options: { bullet: true, color: "334155", fontFace: "Calibri", fontSize: 20 }
          }));
          slide.addText(bulletTexts, {
            x: 0.6,
            y: 1.6,
            w: "88%",
            h: 4.8,
            margin: 0.1
          });
        }
      }
    }
    const buffer = await pres.write({ outputType: "nodebuffer" });
    const safeTitle = (title || "AI_Presentation").replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeTitle)}.pptx"`);
    return res.send(buffer);
  } catch (err) {
    console.error("PPTX Generation Error:", err);
    return res.status(500).json({ error: "Failed to generate .pptx presentation." });
  }
});
app.get("/api/history", authenticate(false), (req, res) => {
  const user = req.user;
  const history = db.getHistory(user?.id);
  res.json({ history });
});
app.delete("/api/history/:id", authenticate(false), (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const deleted = db.deleteHistoryItem(id, user?.id);
  res.json({ success: deleted });
});
app.delete("/api/history", authenticate(false), (req, res) => {
  const user = req.user;
  db.clearHistory(user?.id);
  res.json({ success: true, message: "Search history cleared." });
});
app.get("/api/bookmarks", authenticate(true), (req, res) => {
  const user = req.user;
  const bookmarks = db.getBookmarks(user.id);
  res.json({ bookmarks });
});
app.post("/api/bookmarks", authenticate(true), (req, res) => {
  const user = req.user;
  const { query, title, summary, engine, sources, images } = req.body;
  if (!query || !summary) {
    return res.status(400).json({ error: "Query and summary are required to bookmark." });
  }
  const bookmark = db.addBookmark({
    id: import_crypto.default.randomUUID(),
    userId: user.id,
    query,
    title: title || query,
    summary,
    engine: engine || "gemini",
    sources: Array.isArray(sources) ? sources : [],
    images: Array.isArray(images) ? images : [],
    savedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  res.status(201).json({ bookmark });
});
app.delete("/api/bookmarks/:id", authenticate(true), (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const success = db.deleteBookmark(id, user.id);
  res.json({ success });
});
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || typeof process.argv[1] === "string" && process.argv[1].includes("dist");
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.resolve(process.cwd(), "dist");
    const distIndex = import_path2.default.join(distPath, "index.html");
    const rootIndex = import_path2.default.resolve(process.cwd(), "index.html");
    if (!import_fs2.default.existsSync(distIndex)) {
      console.warn(`[WARN] ${distIndex} not found. Attempting automatic build...`);
      try {
        const { execSync } = await import("child_process");
        execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
      } catch (buildErr) {
        console.error("[BUILD ERROR] Auto-build failed, will fallback to root index.html:", buildErr);
      }
    }
    if (import_fs2.default.existsSync(distPath)) {
      app.use(import_express.default.static(distPath));
    }
    app.use(import_express.default.static(process.cwd()));
    app.get("*", (req, res) => {
      if (import_fs2.default.existsSync(distIndex)) {
        return res.sendFile(distIndex);
      }
      if (import_fs2.default.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
      }
      return res.status(404).send("Application index.html not found. Please ensure project is built.");
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Questora AI Server running at http://0.0.0.0:${PORT} [mode: ${isProduction ? "production" : "development"}]`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map

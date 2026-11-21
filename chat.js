const WINDOW_MS = 10 * 60 * 1000;
const buckets = new Map();

function limited(ip) {
  const now = Date.now(), max = Number(process.env.RATE_LIMIT_MAX || 20);
  const old = buckets.get(ip);
  if (!old || now - old.start > WINDOW_MS) { buckets.set(ip, { start: now, count: 1 }); return false; }
  old.count++;
  return old.count > max;
}
function sendError(res, status, message) { return res.status(status).json({ error: message }); }

export default async function handler(req, res) {
  if (req.method !== "POST") return sendError(res, 405, "Method not allowed");
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (limited(ip)) return sendError(res, 429, "Too many requests. Please wait a moment and try again.");

  const { model, messages } = req.body || {};
  if (typeof model !== "string" || !Array.isArray(messages) || messages.length < 1 || messages.length > 30)
    return sendError(res, 400, "Invalid model or message list.");
  if (messages.some(m => !["user","assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000))
    return sendError(res, 400, "Message format is invalid or too long.");
  if (messages[messages.length - 1].role !== "user")
    return sendError(res, 400, "The last message must be from the user.");

  let endpoint, apiKey, providerModel, extraHeaders = {};
  if (model.startsWith("openrouter:")) {
    providerModel = model.slice("openrouter:".length);
    if (!(providerModel.endsWith(":free") || providerModel === "openrouter/free"))
      return sendError(res, 400, "Only free OpenRouter model IDs are allowed.");
    apiKey = process.env.OPENROUTER_API_KEY;
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    extraHeaders = { "HTTP-Referer": process.env.APP_URL || "https://vercel.app", "X-Title": "NetPulse AI" };
  } else if (model.startsWith("groq:")) {
    providerModel = model.slice("groq:".length);
    const allowed = (process.env.GROQ_MODELS || "").split(",").map(x=>x.trim()).filter(Boolean);
    if (!allowed.includes(providerModel)) return sendError(res, 400, "This Groq model is not on the server allowlist.");
    apiKey = process.env.GROQ_API_KEY;
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (model.startsWith("mistral:")) {
    providerModel = model.slice("mistral:".length);
    const allowed = (process.env.MISTRAL_MODELS || "").split(",").map(x=>x.trim()).filter(Boolean);
    if (!allowed.includes(providerModel)) return sendError(res, 400, "Bu Mistral modeli sunucu izin listesinde değil.");
    apiKey = process.env.MISTRAL_API_KEY;
    endpoint = "https://api.mistral.ai/v1/chat/completions";
  } else if (model.startsWith("cloudflare:")) {
    providerModel = model.slice("cloudflare:".length);
    const allowed = (process.env.CLOUDFLARE_MODELS || "").split(",").map(x=>x.trim()).filter(Boolean);
    if (!allowed.includes(providerModel)) return sendError(res, 400, "Bu Cloudflare modeli sunucu izin listesinde değil.");
    if (!process.env.CF_ACCOUNT_ID) return sendError(res, 503, "Cloudflare Account ID yapılandırılmamış.");
    apiKey = process.env.CF_API_TOKEN;
    endpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`;
  } else {
    return sendError(res, 400, "Unsupported model provider.");
  }
  if (!apiKey) return sendError(res, 503, "The server administrator has not configured this provider yet.");

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ model: providerModel, messages, stream: true, temperature: 0.7 })
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("Provider error", upstream.status, detail.slice(0, 1000));
      return sendError(res, upstream.status === 429 ? 429 : 502,
        upstream.status === 429 ? "The provider free-tier limit has been reached. Try again later or choose another model." :
        "The model provider could not complete the request. Try another model.");
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const chunk = JSON.parse(raw);
          const text = chunk.choices?.[0]?.delta?.content;
          if (typeof text === "string" && text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch { /* ignore provider keepalive/non-JSON lines */ }
      }
    }
    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (error) {
    console.error("Chat proxy error:", error);
    if (!res.headersSent) return sendError(res, 502, "Could not connect to the AI provider.");
    res.write(`data: ${JSON.stringify({ error: "Connection interrupted." })}\n\n`);
    return res.end();
  }
}
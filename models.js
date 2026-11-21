const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const groups = [];
  try {
    const response = await fetch(OPENROUTER_MODELS, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("OpenRouter model list unavailable");
    const payload = await response.json();
    const free = (payload.data || [])
      .filter(m => m.id && (m.id.endsWith(":free") || m.id === "openrouter/free"))
      .filter(m => m.architecture?.modality !== "audio")
      .sort((a,b) => (a.name || a.id).localeCompare(b.name || b.id))
      .slice(0, 100)
      .map(m => ({ id: `openrouter:${m.id}`, name: m.name || m.id, context: m.context_length || null }));
    if (free.length) groups.push({ label: "OpenRouter · Ücretsiz modeller", models: free });
  } catch (error) {
    console.error("OpenRouter catalog:", error.message);
  }

  const envModels = (name) => (process.env[name] || "").split(",").map(x => x.trim()).filter(Boolean);
  const groqModels = envModels("GROQ_MODELS");
  if (process.env.GROQ_API_KEY && groqModels.length)
    groups.push({ label: "Groq · Yapılandırılmış modeller", models: groqModels.map(id => ({ id: `groq:${id}`, name: id })) });

  const mistralModels = envModels("MISTRAL_MODELS");
  if (process.env.MISTRAL_API_KEY && mistralModels.length)
    groups.push({ label: "Mistral · Yapılandırılmış modeller", models: mistralModels.map(id => ({ id: `mistral:${id}`, name: id })) });

  const cloudflareModels = envModels("CLOUDFLARE_MODELS");
  if (process.env.CF_API_TOKEN && process.env.CF_ACCOUNT_ID && cloudflareModels.length)
    groups.push({ label: "Cloudflare Workers AI · Yapılandırılmış modeller", models: cloudflareModels.map(id => ({ id: `cloudflare:${id}`, name: id })) });

  return res.status(200).setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600")
    .json({ groups, count: groups.reduce((n,g)=>n+g.models.length,0), note: "Free model access depends on provider quotas and availability." });
}
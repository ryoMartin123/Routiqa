// ─── Riq document writing ─────────────────────────────────
// Server-side so the API key never reaches the browser. Calls Claude when
// ANTHROPIC_API_KEY is set; otherwise returns { unavailable: true } and the
// document editor falls back to a local starter draft. No SDK — plain fetch
// to the Anthropic Messages API.

export const runtime = "nodejs";

interface WriteRequest {
  prompt: string;    // what the user asked Riq to write
  title?: string;    // document title, if any
}

const SYSTEM = [
  "You are Riq, the AI assistant inside Routiqa, a CRM for service businesses (HVAC, plumbing, roofing, electrical, restoration, property maintenance).",
  "Write the document content the user asks for — job summaries, customer letters, checklists, scopes of work, meeting notes, SOPs.",
  "Format rules (the editor parses these into blocks):",
  "- '#' or '##' at line start = a heading.",
  "- '-' at line start = a bullet item; '- [ ]' = a checklist item.",
  "- '---' alone on a line = a divider.",
  "- Blank lines separate paragraphs. No other markdown (no bold, tables, or code fences).",
  "Keep it practical and professional. Use ONLY facts the user provides — never invent prices, dates, names, or commitments.",
  "Write only the document content — no preamble or sign-off about being an AI.",
].join("\n");

export async function POST(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ unavailable: true });

  let body: WriteRequest;
  try { body = await req.json(); } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  if (!body.prompt?.trim()) return Response.json({ error: "bad request" }, { status: 400 });

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const userContent =
    (body.title ? `Document title: ${body.title}\n\n` : "") +
    `Write this: ${body.prompt.trim()}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 800, system: SYSTEM, messages: [{ role: "user", content: userContent }] }),
    });
    if (!r.ok) return Response.json({ unavailable: true, error: (await r.text()).slice(0, 300) }, { status: 200 });
    const data = await r.json();
    const text = (data?.content?.[0]?.text ?? "").trim();
    if (!text) return Response.json({ unavailable: true });
    return Response.json({ text, model });
  } catch (e) {
    return Response.json({ unavailable: true, error: String(e).slice(0, 200) }, { status: 200 });
  }
}

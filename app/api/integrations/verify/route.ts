import { NextResponse } from "next/server";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      type?: "google_places" | "ai";
      provider?: string;
      apiKey?: string;
    };
    const apiKey = String(body.apiKey || "").trim();
    if (!apiKey) return NextResponse.json({ ok: false, message: "Enter an API key first." }, { status: 400 });

    if (body.type === "google_places") {
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=coffee+in+Gurgaon&key=${encodeURIComponent(apiKey)}`);
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status === "REQUEST_DENIED") {
        return NextResponse.json({ ok: false, message: result?.error_message || `Google Places verification failed (${result?.status || response.status}).` }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: `Google Places connected. Test returned ${Array.isArray(result?.results) ? result.results.length : 0} result(s).` });
    }

    const provider = String(body.provider || "").toLowerCase();
    let response: Response;
    let result: any;
    if (provider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK." }] }),
      });
      result = await response.json().catch(() => null);
    } else if (provider === "google_gemini") {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      result = await response.json().catch(() => null);
    } else {
      const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/models" : "https://api.openai.com/v1/models";
      response = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}` } });
      result = await response.json().catch(() => null);
    }
    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        message: provider === "anthropic"
          ? `Claude verification failed: ${result?.error?.message || `HTTP ${response.status}`}.`
          : result?.error?.message || `Could not verify ${provider} credentials (${response.status}).`,
      }, { status: 400 });
    }

    const providerLabel = provider === "anthropic"
      ? "Claude"
      : provider === "google_gemini"
        ? "Google Gemini"
        : provider === "groq"
          ? "Groq"
          : "OpenAI";
    return NextResponse.json({
      ok: true,
      message: `${providerLabel} API key verified successfully.`,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Verification failed." }, { status: 500 });
  }
}

import { askClaude } from "./claudeBridge.js";
import { CHAT_PAGE_HTML } from "./chatPage.js";

interface ChatRequestBody {
  sessionId?: string;
  message?: string;
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(CHAT_PAGE_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    let body: ChatRequestBody;
    try {
      body = (await req.json()) as ChatRequestBody;
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const message = body.message?.trim();
    const sessionId = body.sessionId?.trim();
    if (!message || !sessionId) {
      return Response.json({ error: "sessionId and message are required" }, { status: 400 });
    }

    try {
      const reply = await askClaude(`web:${sessionId}`, message);
      return Response.json({ reply });
    } catch (err) {
      console.error("[server] claude bridge error:", err);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  }

  return new Response("not found", { status: 404 });
}

import { askClaude, askClaudeOnce } from "./claudeBridge.js";
import { CHAT_PAGE_HTML } from "./chatPage.js";

interface ChatRequestBody {
  sessionId?: string;
  message?: string;
}

interface VapiMessage {
  role: "system" | "user" | "assistant" | "tool" | "function";
  content: string | null;
}

interface VapiChatCompletionsBody {
  messages?: VapiMessage[];
}

function buildVoicePrompt(messages: VapiMessage[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const turns = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Arayan" : "Sen"}: ${m.content ?? ""}`)
    .join("\n");

  return [
    system && `[Sistem talimatı]\n${system}`,
    `[Bu bir telefon görüşmesi. Konuşma geçmişi]\n${turns}`,
    "Sadece arayanın en son söylediğine, sesli bir telefon görüşmesine uygun şekilde (kısa, doğal, markdown veya liste kullanmadan, düz konuşma diliyle) cevap ver. Sadece söyleyeceğin cümleyi yaz, başka açıklama ekleme.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function openAiChatCompletion(replyText: string) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "claude-code",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: replyText },
        finish_reason: "stop",
      },
    ],
  };
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

  if (req.method === "POST" && url.pathname === "/chat/completions") {
    const secret = process.env.PHONE_BRIDGE_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: VapiChatCompletionsBody;
    try {
      body = (await req.json()) as VapiChatCompletionsBody;
    } catch {
      return Response.json({ error: "invalid JSON body" }, { status: 400 });
    }

    const messages = body.messages ?? [];
    if (messages.length === 0) {
      return Response.json({ error: "messages is required" }, { status: 400 });
    }

    try {
      const reply = await askClaudeOnce(buildVoicePrompt(messages));
      return Response.json(openAiChatCompletion(reply));
    } catch (err) {
      console.error("[server] vapi bridge error:", err);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  }

  return new Response("not found", { status: 404 });
}

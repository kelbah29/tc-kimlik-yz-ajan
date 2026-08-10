import "dotenv/config";
import { Inkbox } from "@inkbox/sdk";
import { connect } from "@inkbox/sdk/tunnels/connect";
import { handleRequest } from "./server.js";

async function main() {
  const apiKey = process.env.INKBOX_WEB_API_KEY;
  const identityHandle = process.env.INKBOX_WEB_IDENTITY;
  if (!apiKey || !identityHandle) {
    throw new Error("INKBOX_WEB_API_KEY and INKBOX_WEB_IDENTITY must be set");
  }

  const inkbox = new Inkbox({ apiKey });

  const listener = await connect(inkbox, {
    name: identityHandle,
    handler: async (req, _ctx) => handleRequest(req),
  });

  console.log(`[web] listening on ${listener.publicUrl}`);
  await listener.wait();
}

main().catch((err) => {
  console.error("[web] fatal error:", err);
  process.exit(1);
});

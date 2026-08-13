import { spawn } from "node:child_process";
import { getSessionId, setSessionId } from "./sessionStore.js";

interface ClaudeResult {
  result: string;
  session_id: string;
  is_error: boolean;
}

/**
 * Runs the `claude` CLI in headless print mode for one turn of a conversation.
 * Tools are disabled (--tools "") since this endpoint is reachable by anyone
 * on the public internet via the website tunnel — no Bash/file/web access.
 */
function runClaude(message: string, resumeSessionId?: string): Promise<ClaudeResult> {
  const args = ["-p", message, "--output-format", "json", "--tools", ""];
  if (resumeSessionId) {
    args.push("--resume", resumeSessionId);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as ClaudeResult);
      } catch {
        reject(new Error(`could not parse claude output: ${stdout}`));
      }
    });

    child.on("error", reject);
  });
}

export async function askClaude(conversationKey: string, message: string): Promise<string> {
  const priorSessionId = getSessionId(conversationKey);

  let result: ClaudeResult;
  try {
    result = await runClaude(message, priorSessionId);
  } catch (err) {
    if (priorSessionId) {
      // Stale/expired session id — retry as a fresh conversation.
      result = await runClaude(message);
    } else {
      throw err;
    }
  }

  setSessionId(conversationKey, result.session_id);
  return result.result;
}

/**
 * Stateless one-shot query — no session persistence. Used by the Vapi phone
 * bridge, which resends the full call transcript as `prompt` on every turn,
 * so there's nothing to resume.
 */
export async function askClaudeOnce(prompt: string): Promise<string> {
  const result = await runClaude(prompt);
  return result.result;
}

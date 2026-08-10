import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const STORE_PATH = new URL("../data/web-sessions.json", import.meta.url).pathname;

type SessionMap = Record<string, string>;

function load(): SessionMap {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function save(map: SessionMap): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(map, null, 2));
}

export function getSessionId(conversationKey: string): string | undefined {
  return load()[conversationKey];
}

export function setSessionId(conversationKey: string, claudeSessionId: string): void {
  const map = load();
  map[conversationKey] = claudeSessionId;
  save(map);
}

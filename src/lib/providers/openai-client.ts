import "server-only";
import OpenAI from "openai";
import { requireOpenAiKey } from "@/lib/config";

let client: OpenAI | undefined;

export function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: requireOpenAiKey(), maxRetries: 2, timeout: 180_000 });
  return client;
}

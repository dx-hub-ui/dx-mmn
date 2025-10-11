import { VibeMcpClient, type VibeMcpClientOptions } from "./client";

let cachedClient: VibeMcpClient | null = null;

function resolveOptions(): VibeMcpClientOptions {
  return {
    baseUrl: process.env.VIBE_MCP_BASE_URL,
    apiToken: process.env.VIBE_MCP_API_TOKEN,
  };
}

export function getVibeMcpClient() {
  if (!cachedClient) {
    cachedClient = new VibeMcpClient(resolveOptions());
  }
  return cachedClient;
}

export function resetMcpClientCache() {
  cachedClient = null;
}

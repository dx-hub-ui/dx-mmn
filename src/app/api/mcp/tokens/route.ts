import { NextResponse } from "next/server";
import { getVibeMcpClient } from "@/lib/mcp/server";

export async function GET(request: Request) {
  const client = getVibeMcpClient();
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const category = url.searchParams.get("category");

  try {
    const tokens = await client.listTokens({ search, category });
    return NextResponse.json({ tokens });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch Vibe tokens from MCP";
    return NextResponse.json(
      {
        error: "mcp_tokens_error",
        message,
      },
      { status: 502 }
    );
  }
}

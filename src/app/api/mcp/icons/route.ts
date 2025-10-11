import { NextResponse } from "next/server";
import { getVibeMcpClient } from "@/lib/mcp/server";

export async function GET(request: Request) {
  const client = getVibeMcpClient();
  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const limitParam = url.searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit = typeof parsedLimit === "number" && Number.isFinite(parsedLimit) ? parsedLimit : undefined;
  const category = url.searchParams.get("category");

  try {
    const icons = await client.listIcons({ search, limit, category });
    return NextResponse.json({ icons });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch Vibe icons from MCP";
    return NextResponse.json(
      {
        error: "mcp_icons_error",
        message,
      },
      { status: 502 }
    );
  }
}

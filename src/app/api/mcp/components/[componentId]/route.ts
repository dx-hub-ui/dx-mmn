import { NextResponse } from "next/server";
import { getVibeMcpClient } from "@/lib/mcp/server";

export async function GET(
  request: Request,
  context: { params: { componentId: string } }
) {
  const client = getVibeMcpClient();
  const componentId = decodeURIComponent(context.params.componentId);
  const url = new URL(request.url);
  const includeExamples = url.searchParams.get("examples") === "true";

  try {
    const [metadata, examples] = await Promise.all([
      client.getComponentMetadata(componentId),
      includeExamples ? client.getComponentExamples(componentId) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      metadata,
      examples: examples ?? undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch component details from MCP";
    return NextResponse.json(
      {
        error: "mcp_component_error",
        message,
      },
      { status: 502 }
    );
  }
}

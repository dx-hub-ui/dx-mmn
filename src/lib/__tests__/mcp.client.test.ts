import { describe, expect, it, vi } from "vitest";
import { VibeMcpClient, VibeMcpError } from "../mcp/client";

function createMockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  return fetchMock as unknown as typeof fetch;
}

describe("VibeMcpClient", () => {
  it("passes tool and args to the MCP server", async () => {
    const payload = {
      success: true,
      result: [
        { id: "Button", name: "Button" },
      ],
    };
    const response = new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const fetchMock = createMockFetch(response);
    const client = new VibeMcpClient({ baseUrl: "http://localhost:9000", fetchImpl: fetchMock });

    const result = await client.listComponents({ search: "button", limit: 5 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "Button", name: "Button" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:9000/invoke", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ tool: "list-vibe-public-components", arguments: { search: "button", limit: 5 } }),
    }));
  });

  it("throws VibeMcpError when server responds with failure envelope", async () => {
    const payload = {
      success: false,
      error: { message: "unknown component" },
    };
    const response = new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const client = new VibeMcpClient({ fetchImpl: createMockFetch(response) });

    await expect(client.getComponentMetadata("Unknown")).rejects.toBeInstanceOf(VibeMcpError);
  });

  it("throws VibeMcpError when HTTP status is not ok", async () => {
    const response = new Response("oops", { status: 500 });
    const client = new VibeMcpClient({ fetchImpl: createMockFetch(response) });

    await expect(client.listIcons()).rejects.toBeInstanceOf(VibeMcpError);
  });
});

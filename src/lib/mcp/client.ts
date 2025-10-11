import { z } from "zod";

export type VibeMcpClientOptions = {
  baseUrl?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:8848";

const invocationEnvelopeSchema = z
  .object({
    success: z.boolean().optional(),
    ok: z.boolean().optional(),
    result: z.unknown().optional(),
    data: z.unknown().optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        details: z.unknown().optional(),
      })
      .optional(),
  })
  .passthrough();

const componentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  href: z.string().url().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  status: z.string().optional(),
});

const componentPropSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const componentMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  props: z.array(componentPropSchema).optional().default([]),
  accessibility: z.array(z.string()).optional().default([]),
  guidelines: z.array(z.string()).optional().default([]),
  tokens: z.array(z.string()).optional().default([]),
  status: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

const componentExampleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  code: z.string(),
  language: z.string().optional().default("tsx"),
});

const tokenSchema = z.object({
  name: z.string(),
  value: z.union([z.string(), z.number()]),
  description: z.string().optional(),
  group: z.string().optional(),
  category: z.string().optional(),
});

const iconSchema = z.object({
  name: z.string(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  svg: z.string().optional(),
  importPath: z.string().optional(),
});

export type VibeComponentSummary = z.infer<typeof componentSummarySchema>;
export type VibeComponentMetadata = z.infer<typeof componentMetadataSchema>;
export type VibeComponentExample = z.infer<typeof componentExampleSchema>;
export type VibeDesignToken = z.infer<typeof tokenSchema>;
export type VibeIcon = z.infer<typeof iconSchema>;

export class VibeMcpError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VibeMcpError";
  }
}

export class VibeMcpClient {
  private readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VibeMcpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.VIBE_MCP_BASE_URL ?? DEFAULT_BASE_URL;
    this.apiToken = options.apiToken ?? process.env.VIBE_MCP_API_TOKEN;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private resolveUrl(path: string) {
    const trimmed = path.startsWith("/") ? path.slice(1) : path;
    return `${this.baseUrl.replace(/\/$/, "")}/${trimmed}`;
  }

  private async invoke<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    const response = await this.fetchImpl(this.resolveUrl("invoke"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      },
      body: JSON.stringify({ tool, arguments: args }),
    });

    if (!response.ok) {
      throw new VibeMcpError(`MCP request failed with status ${response.status}`);
    }

    let rawPayload: unknown;
    try {
      rawPayload = await response.json();
    } catch (parseError) {
      throw new VibeMcpError("Invalid MCP response payload", parseError);
    }

    const payload = invocationEnvelopeSchema.parse(rawPayload);
    const success = payload.success ?? payload.ok ?? !payload.error;

    if (!success) {
      const message = payload.error?.message ?? `Tool \"${tool}\" invocation failed`;
      throw new VibeMcpError(message, payload.error);
    }

    const result = (payload.result ?? payload.data ?? null) as T | null;
    if (result === null) {
      throw new VibeMcpError(`Tool \"${tool}\" responded without data`);
    }

    return result;
  }

  async listComponents({
    search,
    limit,
  }: {
    search?: string | null;
    limit?: number | null;
  } = {}): Promise<VibeComponentSummary[]> {
    const args: Record<string, unknown> = {};
    if (search) args.search = search;
    if (typeof limit === "number") args.limit = Math.max(1, Math.min(limit, 100));

    const result = await this.invoke<unknown>("list-vibe-public-components", args);
    return z.array(componentSummarySchema).parse(result);
  }

  async getComponentMetadata(componentId: string): Promise<VibeComponentMetadata> {
    const result = await this.invoke<unknown>("get-vibe-component-metadata", {
      component: componentId,
    });
    return componentMetadataSchema.parse(result);
  }

  async getComponentExamples(componentId: string): Promise<VibeComponentExample[]> {
    const result = await this.invoke<unknown>("get-vibe-component-examples", {
      component: componentId,
    });
    return z.array(componentExampleSchema).parse(result);
  }

  async listTokens({
    search,
    category,
  }: {
    search?: string | null;
    category?: string | null;
  } = {}): Promise<VibeDesignToken[]> {
    const args: Record<string, unknown> = {};
    if (search) args.search = search;
    if (category) args.category = category;

    const result = await this.invoke<unknown>("list-vibe-tokens", args);
    return z.array(tokenSchema).parse(result);
  }

  async listIcons({
    search,
    limit,
    category,
  }: {
    search?: string | null;
    limit?: number | null;
    category?: string | null;
  } = {}): Promise<VibeIcon[]> {
    const args: Record<string, unknown> = {};
    if (search) args.search = search;
    if (category) args.category = category;
    if (typeof limit === "number") args.limit = Math.max(1, Math.min(limit, 150));

    const result = await this.invoke<unknown>("list-vibe-icons", args);
    return z.array(iconSchema).parse(result);
  }
}

export function createVibeMcpClient(options?: VibeMcpClientOptions) {
  return new VibeMcpClient(options);
}

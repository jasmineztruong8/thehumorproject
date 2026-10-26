import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { DEFAULT_CONFIG, clearAiConfigCache, contextFor, loadAiConfig, pickChain } = await import("@/lib/ai-config");
const { logRows } = await import("@/lib/ai-log");
const { buildCaptionRequest, buildExamplesBlock, CAPTION_SYSTEM_INSTRUCTION } = await import("@/lib/prompts");

const classic = { id: "a", slug: "classic", weight: 100 };
const examples = { id: "b", slug: "with-examples", weight: 0 };

describe("pickChain", () => {
  it("always picks the only chain with weight", () => {
    for (const r of [0, 0.5, 0.999]) expect(pickChain([classic, examples], r)).toBe(classic);
  });

  it("splits by weight", () => {
    const chains = [{ ...classic, weight: 25 }, { ...examples, weight: 75 }];
    expect(pickChain(chains, 0.2).slug).toBe("classic");
    expect(pickChain(chains, 0.3).slug).toBe("with-examples");
    expect(pickChain(chains, 0.9999).slug).toBe("with-examples");
  });

  it("falls back to the classic chain when every weight is 0", () => {
    expect(pickChain([{ ...classic, weight: 0 }, examples], 0.5)).toEqual({ ...classic, weight: 0 });
    expect(pickChain([], 0.5)).toBe(DEFAULT_CONFIG.chains[0]);
  });

  it("gives examples and terms only to the with-examples chain", () => {
    const config = { ...DEFAULT_CONFIG, context: { examples: [], terms: [{ term: "8am", definition: "early" }] } };
    expect(contextFor(classic, config)).toBeUndefined();
    expect(contextFor(examples, config)).toBe(config.context);
  });
});

describe("loadAiConfig", () => {
  // A stand-in for the Supabase client: each table returns fixed rows.
  function fakeClient(tables: Record<string, { data: unknown[] | null; error?: unknown }>) {
    return {
      from(table: string) {
        const result = { data: tables[table]?.data ?? [], error: tables[table]?.error ?? null };
        const chain: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "limit", "returns"]) chain[m] = () => chain;
        chain.then = (resolve: (v: unknown) => void) => resolve(result);
        return chain;
      },
    } as never;
  }

  it("uses active Google models in priority order and skips other providers", async () => {
    clearAiConfigCache();
    const config = await loadAiConfig(
      fakeClient({
        llm_models: {
          data: [
            { id: "1", model_id: "gemini-a", llm_providers: { slug: "google" } },
            { id: "2", model_id: "gpt-x", llm_providers: { slug: "openai" } },
          ],
        },
        prompt_chain_mix: { data: [{ weight: 100, prompt_chains: { id: "c", slug: "classic" } }] },
      }),
    );
    expect(config.models).toEqual(["gemini-a"]);
    expect(config.modelIds).toEqual({ "gemini-a": "1" });
    expect(config.chains).toEqual([{ id: "c", slug: "classic", weight: 100 }]);
  });

  it("falls back to the built-in models when none are active", async () => {
    clearAiConfigCache();
    const config = await loadAiConfig(fakeClient({ llm_models: { data: [] } }));
    expect(config.models).toEqual(DEFAULT_CONFIG.models);
    expect(config.chains).toEqual(DEFAULT_CONFIG.chains);
  });

  it("falls back to the defaults when the database fails (e.g. before the migration)", async () => {
    clearAiConfigCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const config = await loadAiConfig(fakeClient({ llm_models: { data: null, error: new Error("relation does not exist") } }));
    expect(config).toBe(DEFAULT_CONFIG);
  });
});

describe("caption prompts with examples", () => {
  it("are unchanged when there's no context", () => {
    const { systemInstruction, prompt } = buildCaptionRequest("A cat.", null);
    expect(systemInstruction).toBe(CAPTION_SYSTEM_INSTRUCTION);
    expect(prompt.startsWith("Image description:")).toBe(true);
  });

  it("are unchanged when the context is empty", () => {
    expect(buildCaptionRequest("A cat.", null, { examples: [], terms: [] })).toEqual(buildCaptionRequest("A cat.", null));
  });

  it("include examples and terms on one line each", () => {
    const block = buildExamplesBlock({
      examples: [{ image_description: "A dog\nin a hat.", caption: "fit check" }],
      terms: [{ term: "8am", definition: "too early" }],
    });
    expect(block).toContain("- A dog in a hat. → fit check");
    expect(block).toContain("- 8am: too early");
    const request = buildCaptionRequest("A cat.", "finals", { examples: [], terms: [{ term: "8am", definition: "too early" }] });
    expect(request.systemInstruction).toContain("never copy an example");
    expect(request.prompt).toMatch(/^Campus terms:[\s\S]*Image description:\nA cat\.[\s\S]*<topic>finals<\/topic>/);
    expect(request.fullPrompt).toBe(`${request.systemInstruction}\n\n---\n\n${request.prompt}`);
  });
});

describe("logRows", () => {
  const base = {
    app: "site" as const,
    userId: "u",
    kind: "caption" as const,
    chainId: "c",
    imageId: null,
    steer: "finals",
    prompt: "p",
    startedAt: Date.now() - 50,
    modelIds: { "gemini-a": "m1" },
  };

  it("records a fallback: one failed attempt then a success", () => {
    const { request, responses } = logRows({
      ...base,
      attempts: [
        { model: "gemini-a", status: "quota", httpStatus: 429, error: "quota", latencyMs: 12.7 },
        { model: "gemini-b", status: "ok", httpStatus: 200, error: null, latencyMs: 900, output: "lol" },
      ],
    });
    expect(request).toMatchObject({ status: "succeeded", error: null, steer: "finals", app: "site" });
    expect(request.duration_ms).toBeGreaterThanOrEqual(0);
    expect(responses).toEqual([
      expect.objectContaining({ attempt: 1, model: "gemini-a", llm_model_id: "m1", status: "quota", latency_ms: 13, output: null }),
      expect.objectContaining({ attempt: 2, model: "gemini-b", llm_model_id: null, status: "ok", output: "lol" }),
    ]);
  });

  it("marks a request failed when no model answered, or the answer was unusable", () => {
    expect(logRows({ ...base, attempts: [] }).request).toMatchObject({ status: "failed", error: "No model answered" });
    const empty = logRows({
      ...base,
      error: "Empty caption",
      attempts: [{ model: "gemini-a", status: "ok", httpStatus: 200, error: null, latencyMs: 5, output: "" }],
    });
    expect(empty.request).toMatchObject({ status: "failed", error: "Empty caption" });
  });

  it("keeps long text within the column limits", () => {
    const { request, responses } = logRows({
      ...base,
      prompt: "x".repeat(30000),
      error: "e".repeat(1000),
      attempts: [{ model: "m".repeat(200), status: "error", httpStatus: 400, error: "e".repeat(1000), latencyMs: 1 }],
    });
    expect(request.error).toHaveLength(500);
    expect(responses[0].prompt).toHaveLength(20000);
    expect(responses[0].model).toHaveLength(100);
    expect(responses[0].error).toHaveLength(500);
  });
});

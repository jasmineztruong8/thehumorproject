import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MODELS } from "@/lib/gemini";
import type { CaptionContext } from "@/lib/prompts";

// The AI settings an admin can change (llm_models, prompt_chain_mix,
// generation_examples, terms). Read at most once a minute per server, and if
// anything goes wrong the AI keeps working with the built-in defaults.

export type Chain = { id: string | null; slug: string; weight: number };

export type AiConfig = {
  models: string[]; // model ids to try, in order
  modelIds: Record<string, string>; // model id -> llm_models.id, for the log
  chains: Chain[];
  context: CaptionContext;
};

const CACHE_MS = 60_000;
const MAX_EXAMPLES = 5;
const MAX_TERMS = 30;

export const DEFAULT_CONFIG: AiConfig = {
  models: DEFAULT_MODELS,
  modelIds: {},
  chains: [{ id: null, slug: "classic", weight: 100 }],
  context: { examples: [], terms: [] },
};

let cached: { config: AiConfig; at: number } | null = null;

export function clearAiConfigCache() {
  cached = null;
}

// Only models from providers the code can call (Gemini) are used.
const CALLABLE_PROVIDERS = ["google"];

type ModelRow = { id: string; model_id: string; llm_providers: { slug: string } | null };
type MixRow = { weight: number; prompt_chains: { id: string; slug: string } | null };

export async function loadAiConfig(supabase: SupabaseClient): Promise<AiConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  try {
    const [models, mix, examples, terms] = await Promise.all([
      supabase
        .from("llm_models")
        .select("id, model_id, llm_providers(slug)")
        .eq("is_active", true)
        .order("priority")
        .order("created_at")
        .returns<ModelRow[]>(),
      supabase.from("prompt_chain_mix").select("weight, prompt_chains(id, slug)").returns<MixRow[]>(),
      supabase.from("generation_examples").select("image_description, caption").eq("is_active", true).limit(200),
      supabase.from("terms").select("term, definition").order("term").limit(MAX_TERMS),
    ]);
    const error = models.error ?? mix.error ?? examples.error ?? terms.error;
    if (error) throw error;

    const callable = (models.data ?? []).filter((m) => CALLABLE_PROVIDERS.includes(m.llm_providers?.slug ?? ""));
    const chains = (mix.data ?? [])
      .filter((m) => m.prompt_chains)
      .map((m) => ({ id: m.prompt_chains!.id, slug: m.prompt_chains!.slug, weight: m.weight }));

    const config: AiConfig = {
      models: callable.length ? callable.map((m) => m.model_id) : DEFAULT_MODELS,
      modelIds: Object.fromEntries(callable.map((m) => [m.model_id, m.id])),
      chains: chains.length ? chains : DEFAULT_CONFIG.chains,
      context: { examples: sample(examples.data ?? [], MAX_EXAMPLES), terms: terms.data ?? [] },
    };
    cached = { config, at: Date.now() };
    return config;
  } catch (e) {
    console.error("Loading AI config failed; using defaults", e);
    // Don't hammer the database while it's failing
    cached = { config: DEFAULT_CONFIG, at: Date.now() };
    return DEFAULT_CONFIG;
  }
}

// Picks a chain at random, in proportion to its weight. Falls back to the
// classic chain when every weight is 0.
export function pickChain(chains: Chain[], random = Math.random()): Chain {
  const total = chains.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  if (total <= 0) return chains.find((c) => c.slug === "classic") ?? DEFAULT_CONFIG.chains[0];
  let r = random * total;
  for (const chain of chains) {
    r -= Math.max(0, chain.weight);
    if (r < 0) return chain;
  }
  return chains.findLast((c) => c.weight > 0)!;
}

// The caption context a chain uses: only "with-examples" sees examples and terms.
export function contextFor(chain: Chain, config: AiConfig): CaptionContext | undefined {
  return chain.slug === "with-examples" ? config.context : undefined;
}

function sample<T>(rows: T[], n: number) {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

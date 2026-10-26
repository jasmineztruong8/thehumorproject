import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser, type Who } from "./setup";
import { CAPTION_SYSTEM_INSTRUCTION, DESCRIBE_PROMPT, EXAMPLES_INSTRUCTION } from "@/lib/prompts";

// The AI config and request log tables (migration ai_observability): only
// superadmins can see or change them, and the signup allowlist only blocks
// new accounts once it has something in it.

let db: PGlite;
let alice: { id: string };
let admin: { id: string };
let ghost: { id: string; anonymous: boolean };

const RLS_ERROR = /row-level security|permission denied/;

const CRUD_TABLES = [
  "llm_providers",
  "llm_models",
  "generation_examples",
  "terms",
  "allowed_signup_domains",
  "whitelisted_emails",
];
const ALL_TABLES = [
  ...CRUD_TABLES,
  "prompt_chains",
  "prompt_chain_steps",
  "prompt_chain_mix",
  "generation_requests",
  "llm_responses",
];

function rows(who: Who, sql: string, params: unknown[] = []) {
  return as(db, who, async (tx) => (await tx.query(sql, params)).rows);
}

function affected(who: Who, sql: string, params: unknown[] = []) {
  return as(db, who, async (tx) => (await tx.query(sql, params)).affectedRows ?? 0);
}

function denied(who: Who, sql: string, params: unknown[] = []) {
  return expect(as(db, who, (tx) => tx.query(sql, params))).rejects.toThrow(RLS_ERROR);
}

async function googleProvider() {
  const { rows } = await db.query<{ id: string }>(`select id from public.llm_providers where slug = 'google'`);
  return rows[0].id;
}

async function addRequest(userId: string, app = "site") {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.generation_requests (user_id, app, kind, status, duration_ms)
     values ($1, $2, 'caption', 'succeeded', 10) returning id`,
    [userId, app],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { name: "Alice" });
  admin = await createUser(db, { name: "Admin", superadmin: true });
  ghost = { ...(await createUser(db, { anonymous: true, superadmin: true })), anonymous: true };
});

describe("seed data", () => {
  it("matches what the code used before: Google, five Gemini models, classic chain at 100%", async () => {
    const models = await rows(admin, `select model_id from public.llm_models order by priority`);
    expect(models.map((m) => (m as { model_id: string }).model_id)).toEqual([
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-flash-lite-latest",
    ]);
    const mix = await rows(
      admin,
      `select c.slug, m.weight from public.prompt_chain_mix m join public.prompt_chains c on c.id = m.chain_id order by c.slug`,
    );
    expect(mix).toEqual([
      { slug: "classic", weight: 100 },
      { slug: "with-examples", weight: 0 },
    ]);
  });

  it("stores the same prompts as lib/prompts.ts", async () => {
    const steps = await rows(
      admin,
      `select c.slug, s.step_order, s.kind, s.system_instruction, s.prompt_template
       from public.prompt_chain_steps s join public.prompt_chains c on c.id = s.chain_id
       order by c.slug, s.step_order`,
    ) as { slug: string; step_order: number; kind: string; system_instruction: string | null; prompt_template: string }[];
    expect(steps).toHaveLength(4);
    for (const step of steps.filter((s) => s.kind === "describe")) {
      expect(step.prompt_template).toBe(DESCRIBE_PROMPT);
    }
    const caption = (slug: string) => steps.find((s) => s.slug === slug && s.kind === "caption")!;
    expect(caption("classic").system_instruction).toBe(CAPTION_SYSTEM_INSTRUCTION);
    expect(caption("with-examples").system_instruction).toBe(`${CAPTION_SYSTEM_INSTRUCTION}\n${EXAMPLES_INSTRUCTION}`);
  });
});

describe("signed-out visitors and regular users", () => {
  it("can't read any of the tables", async () => {
    for (const table of ALL_TABLES) {
      await expect(as(db, "anon", (tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(RLS_ERROR);
      expect(await rows(alice, `select * from public.${table}`), table).toEqual([]);
    }
  });

  it("can't change the AI config", async () => {
    await denied(alice, `insert into public.terms (term, definition) values ('x', 'y')`);
    await denied(alice, `insert into public.allowed_signup_domains (domain) values ('evil.com')`);
    await denied(alice, `insert into public.whitelisted_emails (email) values ('me@evil.com')`);
    await denied(alice, `insert into public.llm_providers (slug, name) values ('x', 'X')`);
    expect(await affected(alice, `update public.llm_models set is_active = false`)).toBe(0);
    expect(await affected(alice, `update public.prompt_chain_mix set weight = 0, updated_by = $1`, [alice.id])).toBe(0);
    expect(await affected(alice, `delete from public.terms`)).toBe(0);
  });

  it("can't write or fake the request log", async () => {
    await denied(
      alice,
      `insert into public.generation_requests (user_id, app, kind, status, duration_ms)
       values ($1, 'site', 'caption', 'succeeded', 1)`,
      [alice.id],
    );
    await denied(
      alice,
      `insert into public.generation_requests (user_id, app, kind, status, duration_ms)
       values ($1, 'admin', 'caption', 'succeeded', 1)`,
      [alice.id],
    );
  });
});

describe("anonymous auth users with the superadmin flag", () => {
  it("are still locked out", async () => {
    expect(await rows(ghost, `select * from public.generation_requests`)).toEqual([]);
    await denied(ghost, `insert into public.terms (term, definition) values ('x', 'y')`);
  });
});

describe("superadmins", () => {
  it("can create, read, update and delete every config table", async () => {
    const provider = await googleProvider();
    const cases: [string, string, unknown[], string][] = [
      ["llm_providers", `insert into public.llm_providers (slug, name, website) values ('openai', 'OpenAI', 'https://openai.com') returning id`, [], `name = 'Open AI'`],
      ["llm_models", `insert into public.llm_models (provider_id, model_id, name) values ($1, 'gemini-x', 'X') returning id`, [provider], `is_active = false`],
      ["generation_examples", `insert into public.generation_examples (image_description, caption) values ('a dog', 'woof') returning id`, [], `caption = 'bark'`],
      ["terms", `insert into public.terms (term, definition) values ('Butler', 'the library') returning id`, [], `definition = 'a library'`],
      ["allowed_signup_domains", `insert into public.allowed_signup_domains (domain) values ('example.edu') returning id`, [], `domain = 'example.org'`],
      ["whitelisted_emails", `insert into public.whitelisted_emails (email) values ('guest@example.com') returning id`, [], `note = 'TA'`],
    ];
    for (const [table, insert, params, change] of cases) {
      await as(db, admin, async (tx) => {
        const { rows } = await tx.query<{ id: string }>(insert, params);
        const id = rows[0].id;
        expect((await tx.query(`select * from public.${table} where id = $1`, [id])).rows, table).toHaveLength(1);
        expect((await tx.query(`update public.${table} set ${change} where id = $1`, [id])).affectedRows, table).toBe(1);
        expect((await tx.query(`delete from public.${table} where id = $1`, [id])).affectedRows, table).toBe(1);
      });
    }
  });

  it("can read prompt chains and steps but not change them", async () => {
    expect(await rows(admin, `select * from public.prompt_chains`)).toHaveLength(2);
    await denied(admin, `insert into public.prompt_chains (slug, name, description) values ('x', 'x', 'x')`);
    await denied(admin, `update public.prompt_chain_steps set prompt_template = 'hacked'`);
    await denied(admin, `delete from public.prompt_chains`);
  });

  it("can re-weight the chain mix as themselves, but not add or remove chains", async () => {
    expect(await affected(admin, `update public.prompt_chain_mix set weight = 50, updated_by = $1, updated_at = now()`, [admin.id])).toBe(2);
    await denied(admin, `update public.prompt_chain_mix set weight = 50, updated_by = $1`, [alice.id]);
    await denied(admin, `update public.prompt_chain_mix set chain_id = gen_random_uuid()`);
    await denied(admin, `delete from public.prompt_chain_mix`);
    await expect(
      as(db, admin, (tx) => tx.query(`update public.prompt_chain_mix set weight = 101, updated_by = $1`, [admin.id])),
    ).rejects.toThrow(/check constraint/);
  });

  it("can read the whole request log but not edit or delete it", async () => {
    const request = await addRequest(alice.id);
    await db.query(
      `insert into public.llm_responses (request_id, attempt, model, prompt, status, latency_ms) values ($1, 1, 'm', 'p', 'ok', 5)`,
      [request],
    );
    expect(await rows(admin, `select * from public.generation_requests where id = $1`, [request])).toHaveLength(1);
    expect(await rows(admin, `select * from public.llm_responses where request_id = $1`, [request])).toHaveLength(1);
    await denied(admin, `update public.generation_requests set status = 'failed' where id = $1`, [request]);
    await denied(admin, `delete from public.llm_responses where request_id = $1`, [request]);
  });

  it("can log their own admin-panel requests, and only those", async () => {
    await as(db, admin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.generation_requests (user_id, app, kind, status, duration_ms)
         values ($1, 'admin', 'caption', 'succeeded', 1) returning id`,
        [admin.id],
      );
      await tx.query(
        `insert into public.llm_responses (request_id, attempt, model, prompt, status, latency_ms) values ($1, 1, 'm', 'p', 'ok', 5)`,
        [rows[0].id],
      );
    });
    await denied(
      admin,
      `insert into public.generation_requests (user_id, app, kind, status, duration_ms) values ($1, 'admin', 'caption', 'succeeded', 1)`,
      [alice.id],
    );
    await denied(
      admin,
      `insert into public.generation_requests (user_id, app, kind, status, duration_ms) values ($1, 'site', 'caption', 'succeeded', 1)`,
      [admin.id],
    );
    const sitesRequest = await addRequest(alice.id);
    await denied(
      admin,
      `insert into public.llm_responses (request_id, attempt, model, prompt, status, latency_ms) values ($1, 9, 'm', 'p', 'ok', 5)`,
      [sitesRequest],
    );
  });
});

describe("config validation", () => {
  it("only accepts https websites, so a link can't run script", async () => {
    await expect(
      as(db, admin, (tx) => tx.query(`insert into public.llm_providers (slug, name, website) values ('x', 'X', 'javascript:alert(1)')`)),
    ).rejects.toThrow(/check constraint/);
  });

  it("rejects malformed domains and emails", async () => {
    for (const domain of ["Columbia.edu", "@columbia.edu", "columbia", "a b.edu"]) {
      await expect(
        as(db, admin, (tx) => tx.query(`insert into public.allowed_signup_domains (domain) values ($1)`, [domain])),
        domain,
      ).rejects.toThrow(/check constraint/);
    }
    for (const email of ["Me@x.com", "not-an-email", "a@b"]) {
      await expect(
        as(db, admin, (tx) => tx.query(`insert into public.whitelisted_emails (email) values ($1)`, [email])),
        email,
      ).rejects.toThrow(/check constraint/);
    }
  });

  it("won't delete a provider that still has models", async () => {
    await expect(
      as(db, admin, (tx) => tx.query(`delete from public.llm_providers where slug = 'google'`)),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("deleting an account", () => {
  it("deletes that user's request log", async () => {
    const carol = await createUser(db, { name: "Carol" });
    const request = await addRequest(carol.id);
    await db.query(`delete from public.profiles where id = $1`, [carol.id]);
    const { rows } = await db.query(`select 1 from public.generation_requests where id = $1`, [request]);
    expect(rows).toEqual([]);
  });
});

describe("signing up", () => {
  // Runs a sign-up (an auth.users insert, as Supabase Auth does) and rolls it back.
  async function canSignUp(email: string | null, opts: { anonymous?: boolean; domains?: string[]; emails?: string[] } = {}) {
    try {
      await db.transaction(async (tx) => {
        for (const d of opts.domains ?? []) await tx.query(`insert into public.allowed_signup_domains (domain) values ($1)`, [d]);
        for (const e of opts.emails ?? []) await tx.query(`insert into public.whitelisted_emails (email) values ($1)`, [e]);
        await tx.query(`insert into auth.users (id, email, is_anonymous) values ($1, $2, $3)`, [
          crypto.randomUUID(),
          email,
          Boolean(opts.anonymous),
        ]);
        throw new Error("ok");
      });
    } catch (e) {
      if ((e as Error).message === "ok") return true;
      if (/Sign-ups are limited/.test((e as Error).message)) return false;
      throw e;
    }
    return true;
  }

  it("is open to anyone while both lists are empty", async () => {
    expect(await canSignUp("someone@gmail.com")).toBe(true);
  });

  it("is limited to allowed domains and their subdomains once one is added", async () => {
    const domains = ["columbia.edu"];
    expect(await canSignUp("student@columbia.edu", { domains })).toBe(true);
    expect(await canSignUp("Student@Columbia.EDU", { domains })).toBe(true);
    expect(await canSignUp("prof@cs.columbia.edu", { domains })).toBe(true);
    expect(await canSignUp("someone@gmail.com", { domains })).toBe(false);
    expect(await canSignUp("trick@notcolumbia.edu", { domains })).toBe(false);
    expect(await canSignUp("trick@columbia.edu.evil.com", { domains })).toBe(false);
    expect(await canSignUp(null, { domains })).toBe(false);
  });

  it("lets whitelisted emails in from any domain", async () => {
    const opts = { domains: ["columbia.edu"], emails: ["guest@gmail.com"] };
    expect(await canSignUp("Guest@gmail.com", opts)).toBe(true);
    expect(await canSignUp("other@gmail.com", opts)).toBe(false);
    expect(await canSignUp("guest@gmail.com", { emails: ["guest@gmail.com"] })).toBe(true);
    expect(await canSignUp("other@gmail.com", { emails: ["guest@gmail.com"] })).toBe(false);
  });

  it("never blocks anonymous sign-ins or existing accounts", async () => {
    expect(await canSignUp(null, { anonymous: true, domains: ["columbia.edu"] })).toBe(true);
    await db.transaction(async (tx) => {
      await tx.query(`insert into public.allowed_signup_domains (domain) values ('columbia.edu')`);
      await tx.query(`update auth.users set email = 'changed@gmail.com' where id = $1`, [alice.id]);
      expect((await tx.query(`select 1 from public.profiles where id = $1`, [alice.id])).rows).toHaveLength(1);
      await tx.rollback();
    });
  });

  it("can't be called directly", async () => {
    await denied(alice, `select private.check_signup_allowed()`);
  });
});

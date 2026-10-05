import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// Just enough of Supabase for the migrations to run in an in-memory Postgres:
// the API roles, auth.users + auth.uid()/auth.jwt() (which read the JWT claims
// from a setting, like Supabase does), and the storage tables + foldername().
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    is_anonymous boolean not null default false
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

  -- Supabase grants the API roles full table access by default; RLS is
  -- what actually restricts them.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(import.meta.dirname, "../../supabase/migrations");

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export type Who =
  | "anon"
  | { id: string; anonymous?: boolean };

// Runs fn as an API caller (signed out, or a signed-in user) inside a
// transaction that is always rolled back, so tests never affect each other.
export async function as<T>(
  db: PGlite,
  who: Who,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T;
  const rollback = new Error("rollback");
  try {
    await db.transaction(async (tx) => {
      await setCaller(tx, who);
      result = await fn(tx);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result!;
}

// Like as(), but commits: used for test fixtures that must persist.
export async function asCommitted<T>(
  db: PGlite,
  who: Who,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setCaller(tx, who);
    return fn(tx);
  });
}

async function setCaller(tx: Transaction, who: Who) {
  if (who === "anon") {
    await tx.exec(`set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true);`);
    return;
  }
  const claims = JSON.stringify({
    sub: who.id,
    role: "authenticated",
    is_anonymous: Boolean(who.anonymous),
  });
  await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
  await tx.exec(`set local role authenticated;`);
}

// Creates an auth user (the migration's trigger creates the profile row).
export async function createUser(
  db: PGlite,
  opts: { name?: string; superadmin?: boolean; anonymous?: boolean } = {},
) {
  const id = crypto.randomUUID();
  await db.query(`insert into auth.users (id, is_anonymous) values ($1, $2)`, [
    id,
    Boolean(opts.anonymous),
  ]);
  await db.query(
    `update public.profiles set first_name = $2, last_name = 'Test', is_superadmin = $3 where id = $1`,
    [id, opts.name ?? "User", Boolean(opts.superadmin)],
  );
  return { id, anonymous: opts.anonymous };
}

export async function createImage(db: PGlite, userId: string | null) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
     values ($1, $2, $3, 'https://example.com/x.jpg', 'a cat', 'describe', 'test-model')
     returning id`,
    [userId, userId ? "upload" : "library", `${userId ?? "library"}/${crypto.randomUUID()}.jpg`],
  );
  return rows[0].id;
}

export async function createCaption(db: PGlite, imageId: string, userId: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.captions (image_id, user_id, content, prompt, model)
     values ($1, $2, 'funny', 'prompt', 'test-model') returning id`,
    [imageId, userId],
  );
  return rows[0].id;
}

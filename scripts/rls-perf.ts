// Measures how the RLS policies and indexes affect the app's hottest queries,
// using the same in-memory Postgres as the tests (nothing touches Supabase).
//
//   npm run perf:rls
//
// It loads ~1,000 users, 5,000 images, 50,000 captions and 100,000 votes,
// then times each query as a signed-in user, with and without the indexes
// the migration adds.
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../tests/db/setup";

const QUERIES: Record<string, string> = {
  "feed: newest uploads": `select id from public.images where source = 'upload' order by created_at desc limit 30`,
  "image page: ranked captions": `select id from public.captions where image_id = (select id from public.images order by created_at desc limit 1) order by score desc, created_at desc`,
  "top captions": `select id from public.captions order by score desc, created_at desc limit 30`,
  "my votes on a page": `select caption_id, value from public.caption_votes where user_id = (select auth.uid()) and caption_id in (select id from public.captions order by score desc limit 30)`,
  "my captions (rate limit + /my)": `select count(*) from public.captions where user_id = (select auth.uid()) and created_at > now() - interval '1 hour'`,
};

async function load(db: PGlite) {
  await db.exec(`
    insert into auth.users (id) select gen_random_uuid() from generate_series(1, 1000);
    insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model, created_at)
      select p.id, 'upload', p.id || '/' || g || '.jpg', 'u', 'd', 'p', 'm', now() - (g || ' minutes')::interval
      from (select id, row_number() over () rn from public.profiles) p, generate_series(1, 5) g;
    insert into public.captions (image_id, user_id, content, prompt, model, created_at)
      select i.id, (select id from public.profiles offset floor(random() * 1000) limit 1), 'ha', 'p', 'm', now() - random() * interval '30 days'
      from public.images i, generate_series(1, 10);
    insert into public.caption_votes (user_id, caption_id, value)
      select distinct on (u.id, c.id) u.id, c.id, 1
      from (select id from public.profiles order by random() limit 200) u
      cross join lateral (select id from public.captions order by random() limit 500) c;
    analyze;
  `);
}

async function time(db: PGlite, userId: string, sql: string) {
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    await db.exec("begin");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: "authenticated" })]);
    await db.exec("set local role authenticated");
    const start = performance.now();
    await db.query(sql);
    runs.push(performance.now() - start);
    await db.exec("rollback");
  }
  return runs.sort((a, b) => a - b)[2]; // median
}

async function measure(label: string, setup?: (db: PGlite) => Promise<void>) {
  const db = await createTestDb();
  await load(db);
  if (setup) await setup(db);
  const { rows } = await db.query<{ user_id: string }>(`select user_id from public.caption_votes limit 1`);
  const results: Record<string, number> = {};
  for (const [name, sql] of Object.entries(QUERIES)) results[name] = await time(db, rows[0].user_id, sql);
  return { label, results };
}

async function main() {
  const variants = [
    await measure("as shipped"),
    await measure("no extra indexes", async (db) => {
      await db.exec(`
        drop index public.images_created_at_idx, public.captions_image_id_score_idx,
          public.captions_user_id_created_at_idx, public.captions_score_idx,
          public.caption_votes_caption_id_idx, public.images_user_id_idx;
        analyze;
      `);
    }),
  ];

  console.log(`\nMedian ms per query (5 runs each)\n`);
  console.log(["query".padEnd(38), ...variants.map((v) => v.label.padStart(22))].join(""));
  for (const name of Object.keys(QUERIES)) {
    console.log([name.padEnd(38), ...variants.map((v) => v.results[name].toFixed(1).padStart(22))].join(""));
  }
}

main();

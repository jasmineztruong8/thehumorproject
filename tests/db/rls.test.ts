import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, createCaption, createImage, createTestDb, createUser, type Who } from "./setup";

// These tests replay every file in supabase/migrations against an in-memory
// Postgres and then act as signed-out visitors and signed-in users, so any
// migration that loosens (or over-tightens) a policy fails here first.

let db: PGlite;
let alice: { id: string };
let bob: { id: string };
let admin: { id: string };
let ghost: { id: string; anonymous: boolean }; // Supabase anonymous sign-in
let aliceImage: string;
let libraryImage: string;
let aliceCaption: string;
let bobCaption: string;

const RLS_ERROR = /row-level security|permission denied/;

async function count(tx: Transaction, sql: string, params: unknown[] = []) {
  const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params);
  return rows[0].n;
}

// Runs a statement as `who` and returns how many rows it touched.
function affected(who: Who, sql: string, params: unknown[] = []) {
  return as(db, who, async (tx) => (await tx.query(sql, params)).affectedRows ?? 0);
}

function denied(who: Who, sql: string, params: unknown[] = []) {
  return expect(as(db, who, (tx) => tx.query(sql, params))).rejects.toThrow(RLS_ERROR);
}

beforeAll(async () => {
  db = await createTestDb();
  alice = await createUser(db, { name: "Alice" });
  bob = await createUser(db, { name: "Bob" });
  admin = await createUser(db, { name: "Admin", superadmin: true });
  ghost = { ...(await createUser(db, { anonymous: true })), anonymous: true };
  aliceImage = await createImage(db, alice.id);
  libraryImage = await createImage(db, null);
  aliceCaption = await createCaption(db, aliceImage, alice.id);
  bobCaption = await createCaption(db, aliceImage, bob.id);
  await db.query(`insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [
    bob.id,
    aliceCaption,
  ]);
});

describe("every public table has RLS on", () => {
  it("has no table without row level security", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});

describe("signed-out visitors", () => {
  it("can read images and captions", async () => {
    await as(db, "anon", async (tx) => {
      expect(await count(tx, "select * from public.images")).toBe(2);
      expect(await count(tx, "select * from public.captions")).toBe(2);
    });
  });

  it("cannot read names or votes", async () => {
    await as(db, "anon", async (tx) => {
      expect(await count(tx, "select * from public.profiles")).toBe(0);
      expect(await count(tx, "select * from public.caption_votes")).toBe(0);
    });
  });

  it("cannot create anything", async () => {
    await denied(
      "anon",
      `insert into public.captions (image_id, user_id, content, prompt, model) values ($1, $2, 'x', 'p', 'm')`,
      [aliceImage, alice.id],
    );
    await denied(
      "anon",
      `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
       values ($1, 'upload', $2, 'u', 'd', 'p', 'm')`,
      [alice.id, `${alice.id}/a.jpg`],
    );
    await denied("anon", `insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [
      alice.id,
      bobCaption,
    ]);
  });

  it("cannot delete anything", async () => {
    expect(await affected("anon", `delete from public.captions`)).toBe(0);
    expect(await affected("anon", `delete from public.images`)).toBe(0);
    expect(await affected("anon", `delete from public.profiles`)).toBe(0);
  });
});

describe("signed-in users", () => {
  it("can read names but only their own votes", async () => {
    await as(db, alice, async (tx) => {
      expect(await count(tx, "select * from public.profiles")).toBeGreaterThanOrEqual(3);
      expect(await count(tx, "select * from public.caption_votes")).toBe(0);
    });
    await as(db, bob, async (tx) => {
      expect(await count(tx, "select * from public.caption_votes")).toBe(1);
    });
  });

  it("can upload an image and caption it as themselves", async () => {
    await as(db, bob, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
         values ($1, 'upload', $2, 'u', 'd', 'p', 'm') returning id`,
        [bob.id, `${bob.id}/new.jpg`],
      );
      await tx.query(
        `insert into public.captions (image_id, user_id, content, prompt, model) values ($1, $2, 'ha', 'p', 'm')`,
        [rows[0].id, bob.id],
      );
    });
  });

  it("can caption someone else's image and library images", async () => {
    for (const image of [aliceImage, libraryImage]) {
      expect(
        await affected(
          bob,
          `insert into public.captions (image_id, user_id, content, prompt, model) values ($1, $2, 'ha', 'p', 'm')`,
          [image, bob.id],
        ),
      ).toBe(1);
    }
  });

  it("cannot create content as someone else", async () => {
    await denied(
      bob,
      `insert into public.captions (image_id, user_id, content, prompt, model) values ($1, $2, 'x', 'p', 'm')`,
      [aliceImage, alice.id],
    );
    await denied(
      bob,
      `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
       values ($1, 'upload', $2, 'u', 'd', 'p', 'm')`,
      [alice.id, `${alice.id}/x.jpg`],
    );
    await denied(bob, `insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [
      alice.id,
      bobCaption,
    ]);
  });

  it("cannot put an upload in someone else's folder or fake a library image", async () => {
    await denied(
      bob,
      `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
       values ($1, 'upload', $2, 'u', 'd', 'p', 'm')`,
      [bob.id, `${alice.id}/sneaky.jpg`],
    );
    await denied(
      bob,
      `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model)
       values (null, 'library', 'library/fake.jpg', 'u', 'd', 'p', 'm')`,
    );
  });

  it("cannot mark their upload as added to the library", async () => {
    await denied(
      bob,
      `insert into public.images (user_id, source, storage_path, image_url, description, description_prompt, description_model, added_by)
       values ($1, 'upload', $2, 'u', 'd', 'p', 'm', $1)`,
      [bob.id, `${bob.id}/x.jpg`],
    );
  });

  it("cannot give their caption a head start", async () => {
    await denied(
      bob,
      `insert into public.captions (image_id, user_id, content, prompt, model, score) values ($1, $2, 'x', 'p', 'm', 999)`,
      [aliceImage, bob.id],
    );
  });

  it("cannot edit captions or scores, even their own", async () => {
    expect(await affected(bob, `update public.captions set score = 999, content = 'edited' where id = $1`, [bobCaption])).toBe(0);
  });

  it("cannot delete other people's content", async () => {
    expect(await affected(bob, `delete from public.captions where id = $1`, [aliceCaption])).toBe(0);
    expect(await affected(bob, `delete from public.images where id = $1`, [aliceImage])).toBe(0);
    expect(await affected(bob, `delete from public.images where id = $1`, [libraryImage])).toBe(0);
    expect(await affected(alice, `delete from public.caption_votes where user_id = $1`, [bob.id])).toBe(0);
  });

  it("can delete their own content", async () => {
    expect(await affected(bob, `delete from public.captions where id = $1`, [bobCaption])).toBe(1);
    expect(await affected(alice, `delete from public.images where id = $1`, [aliceImage])).toBe(1);
  });

  it("can edit their own name but not anyone else's", async () => {
    expect(await affected(alice, `update public.profiles set first_name = 'Al' where id = $1`, [alice.id])).toBe(1);
    expect(await affected(alice, `update public.profiles set first_name = 'Al' where id = $1`, [bob.id])).toBe(0);
  });

  it("cannot make themselves a superadmin", async () => {
    await denied(alice, `update public.profiles set is_superadmin = true where id = $1`, [alice.id]);
  });

  it("cannot create profile rows directly", async () => {
    await denied(alice, `insert into public.profiles (id) values (gen_random_uuid())`);
  });
});

describe("anonymous auth users", () => {
  it("cannot create anything", async () => {
    await denied(
      ghost,
      `insert into public.captions (image_id, user_id, content, prompt, model) values ($1, $2, 'x', 'p', 'm')`,
      [aliceImage, ghost.id],
    );
    await denied(ghost, `insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [
      ghost.id,
      bobCaption,
    ]);
  });

  it("are never superadmins, even with the flag set", async () => {
    await db.query(`update public.profiles set is_superadmin = true where id = $1`, [ghost.id]);
    try {
      expect(await affected(ghost, `delete from public.captions where id = $1`, [aliceCaption])).toBe(0);
      expect(await affected(ghost, `delete from public.profiles where id = $1`, [alice.id])).toBe(0);
    } finally {
      await db.query(`update public.profiles set is_superadmin = false where id = $1`, [ghost.id]);
    }
  });
});

describe("superadmins", () => {
  it("can delete anyone's images and captions", async () => {
    expect(await affected(admin, `delete from public.captions where id = $1`, [aliceCaption])).toBe(1);
    expect(await affected(admin, `delete from public.images where id = $1`, [aliceImage])).toBe(1);
  });

  it("cannot vote as someone else", async () => {
    await denied(admin, `insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [
      alice.id,
      bobCaption,
    ]);
  });
});

describe("library images", () => {
  it("stay when the user who added them is deleted", async () => {
    await db.query(`update public.images set added_by = $1 where id = $2`, [alice.id, libraryImage]);
    try {
      await as(db, alice, async (tx) => {
        await tx.query(`delete from public.profiles where id = $1`, [alice.id]);
        expect(await count(tx, `select * from public.images where id = $1 and added_by is null`, [libraryImage])).toBe(1);
      });
    } finally {
      await db.query(`update public.images set added_by = null where id = $1`, [libraryImage]);
    }
  });

  it("can be deleted only by a superadmin", async () => {
    expect(await affected(alice, `delete from public.images where id = $1`, [libraryImage])).toBe(0);
    expect(await affected(admin, `delete from public.images where id = $1`, [libraryImage])).toBe(1);
  });
});

describe("deleting a profile", () => {
  it("is blocked for other users", async () => {
    expect(await affected(bob, `delete from public.profiles where id = $1`, [alice.id])).toBe(0);
  });

  it("by the owner removes the login and everything they made", async () => {
    await as(db, alice, async (tx) => {
      expect((await tx.query(`delete from public.profiles where id = $1`, [alice.id])).affectedRows).toBe(1);
      await tx.exec(`reset role`);
      expect(await count(tx, `select * from auth.users where id = $1`, [alice.id])).toBe(0);
      expect(await count(tx, `select * from public.images where user_id = $1`, [alice.id])).toBe(0);
      // Bob's caption on Alice's image goes with the image...
      expect(await count(tx, `select * from public.captions where id = $1`, [bobCaption])).toBe(0);
      // ...and so do the votes on those captions
      expect(await count(tx, `select * from public.caption_votes where caption_id = $1`, [aliceCaption])).toBe(0);
      // Library images and other users are untouched
      expect(await count(tx, `select * from public.images where id = $1`, [libraryImage])).toBe(1);
      expect(await count(tx, `select * from public.profiles where id = $1`, [bob.id])).toBe(1);
    });
  });

  it("by a superadmin works for any user", async () => {
    await as(db, admin, async (tx) => {
      expect((await tx.query(`delete from public.profiles where id = $1`, [bob.id])).affectedRows).toBe(1);
      await tx.exec(`reset role`);
      expect(await count(tx, `select * from auth.users where id = $1`, [bob.id])).toBe(0);
      expect(await count(tx, `select * from public.caption_votes where user_id = $1`, [bob.id])).toBe(0);
    });
  });

  it("also happens when the auth user is deleted directly", async () => {
    await as(db, admin, async (tx) => {
      await tx.exec(`reset role`);
      await tx.query(`delete from auth.users where id = $1`, [alice.id]);
      expect(await count(tx, `select * from public.profiles where id = $1`, [alice.id])).toBe(0);
      expect(await count(tx, `select * from public.captions where user_id = $1`, [alice.id])).toBe(0);
    });
  });
});

describe("caption scores", () => {
  async function score(tx: Transaction) {
    const { rows } = await tx.query<{ score: number }>(`select score from public.captions where id = $1`, [bobCaption]);
    return rows[0].score;
  }

  it("follow votes through insert, flip and remove", async () => {
    await as(db, alice, async (tx) => {
      expect(await score(tx)).toBe(0);
      await tx.query(`insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, 1)`, [alice.id, bobCaption]);
      expect(await score(tx)).toBe(1);
      await tx.query(`update public.caption_votes set value = -1 where user_id = $1 and caption_id = $2`, [alice.id, bobCaption]);
      expect(await score(tx)).toBe(-1);
      await tx.query(`delete from public.caption_votes where user_id = $1 and caption_id = $2`, [alice.id, bobCaption]);
      expect(await score(tx)).toBe(0);
    });
  });

  it("allow only one vote per user per caption", async () => {
    await expect(
      as(db, bob, (tx) =>
        tx.query(`insert into public.caption_votes (user_id, caption_id, value) values ($1, $2, -1)`, [bob.id, aliceCaption]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("storage", () => {
  const upload = (who: Who, path: string) =>
    as(db, who, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('images', $1)`, [path]));

  it("lets users upload only into their own folder", async () => {
    await expect(upload(bob, `${bob.id}/photo.jpg`)).resolves.toBeDefined();
    await expect(upload(bob, `${alice.id}/photo.jpg`)).rejects.toThrow(RLS_ERROR);
    await expect(upload(bob, `library/photo.jpg`)).rejects.toThrow(RLS_ERROR);
    await expect(upload("anon", `${bob.id}/photo.jpg`)).rejects.toThrow(RLS_ERROR);
    await expect(upload(ghost, `${ghost.id}/photo.jpg`)).rejects.toThrow(RLS_ERROR);
  });

  it("lets owners and superadmins delete objects", async () => {
    await db.query(`insert into storage.objects (bucket_id, name) values ('images', $1), ('avatars', $2)`, [
      `${alice.id}/a.jpg`,
      `${alice.id}/profile`,
    ]);
    const del = (who: Who, bucket: string) =>
      affected(who, `delete from storage.objects where bucket_id = $1 and name like $2`, [bucket, `${alice.id}/%`]);

    expect(await del(bob, "images")).toBe(0);
    expect(await del(bob, "avatars")).toBe(0);
    expect(await del(alice, "images")).toBe(1);
    expect(await del(admin, "images")).toBe(1);
    expect(await del(admin, "avatars")).toBe(1);
  });
});

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validateBrief } from "../src/lib/security";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BRIEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_BRIEF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONCEPT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db: PGlite;

async function query(sql: string, params: unknown[] = []) {
  return db.query<Record<string, unknown>>(sql, params);
}

async function asUser<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  await db.exec("savepoint user_call");
  try {
    await db.exec(`set local role ${user ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    const result = await db.query<T>(sql, params);
    await db.exec("reset role; release savepoint user_call");
    return result.rows;
  } catch (error) {
    await db.exec("rollback to savepoint user_call; release savepoint user_call");
    throw error;
  }
}
async function enable() {
  await db.exec(`update public.pilot_config set enabled=true;
    insert into public.pilot_members(user_id,allowlisted) values('${USER}',true),('${OTHER}',true)`);
}
async function reserve(user = USER, brief = BRIEF, idx = 0) {
  const rows = await asUser<{ reservation: { reservation_id: string } }>(
    user, "select public.pilot_reserve_generation($1,$2) as reservation", [brief, idx]
  );
  return rows[0].reservation.reservation_id;
}
async function fail(id: string, user = USER) {
  return asUser(user, "select public.pilot_fail_generation($1)", [id]);
}
async function upload(id: string, user = USER, brief = BRIEF) {
  return asUser(user, "insert into storage.objects(bucket_id,name,metadata) values('concepts',$1,$2)", [
    `${user}/${brief}/${id}.png`, { mimetype: "image/png", size: 128 }
  ]);
}
async function complete(id: string, user = USER) {
  const rows = await asUser<{ concept: { id: string; image_url: string } }>(user,
    "select public.pilot_complete_generation($1,$2,$3) as concept", [id, "offline generated prompt", { model: "offline-test" }]
  );
  return rows[0].concept;
}

describe("pilot SQL migration / isolated PostgreSQL engine", { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    await db.exec(await readFile(new URL("./fixtures/pilot-schema.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202609120001_invite_only_free_pilot.sql", import.meta.url), "utf8"));
  });
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  after(async () => { await db.close(); });

  test("migration compiles and retains all historical data with private bucket constraints", async () => {
    const rows = (await db.query<{ briefs: number; concepts: number; orders: number; objects: number }>(`
      select (select count(*)::int from briefs) briefs, (select count(*)::int from concepts) concepts,
        (select count(*)::int from orders) orders, (select count(*)::int from storage.objects) objects
    `)).rows;
    assert.deepEqual(rows[0], { briefs: 2, concepts: 2, orders: 1, objects: 3 });
    const bucket = (await query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='concepts'")).rows[0];
    assert.equal(bucket.public, false);
    assert.equal(Number(bucket.file_size_limit), 8388608);
    assert.deepEqual(bucket.allowed_mime_types, ["image/png", "image/jpeg", "image/webp"]);
    assert.equal((await query("select enabled from pilot_config")).rows[0].enabled, false);
    assert.equal((await query("select count(*)::int n from pilot_members")).rows[0].n, 0);
  });

  test("anonymous and non-invited users cannot reserve; config and ownership fail closed", async () => {
    await assert.rejects(reserve(), /pilot_disabled/);
    await db.exec("update public.pilot_config set enabled=true");
    await assert.rejects(reserve(), /pilot_not_invited/);
    await db.exec(`insert into public.pilot_members(user_id,allowlisted) values('${USER}',true)`);
    await assert.rejects(reserve("", BRIEF), /permission denied/);
    await assert.rejects(reserve(USER, OTHER_BRIEF), /pilot_not_found/);
    await db.exec("update public.pilot_members set expires_at=now()-interval '1 second'");
    await assert.rejects(reserve(), /pilot_not_invited/);
    assert.equal((await query("select count(*)::int n from pilot_generation_reservations")).rows[0].n, 0);
  });

  test("no direct client config, invite, quota, concept, order or cascading brief authority", async () => {
    for (const sql of [
      "update pilot_config set enabled=true",
      `insert into pilot_members(user_id,allowlisted) values('${USER}',true)`,
      "delete from pilot_generation_reservations",
      "select * from pilot_generation_reservations",
      "update concepts set image_url='forged'",
      "delete from concepts",
      `insert into concepts(brief_id,user_id,idx) values('${BRIEF}','${USER}',1)`,
      "update orders set status='paid'",
      "delete from orders",
      `insert into orders(brief_id,user_id,amount_cents,currency,status) values('${BRIEF}','${USER}',1,'aud','paid')`,
      "delete from briefs",
      `update briefs set user_id='${OTHER}'`,
      "select public.pilot_lock_and_authorize('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"
    ]) {
      await assert.rejects(asUser(USER, sql), /permission denied/, sql);
    }
    assert.equal((await asUser(USER, "select * from orders")).length, 1);
    assert.equal((await asUser(OTHER, "select * from orders")).length, 0);
  });

  test("brief edits remain possible, privileged status and cross-owner data are forbidden", async () => {
    await asUser(USER, "update briefs set meaning='An edited meaningful story',status='submitted' where id=$1", [BRIEF]);
    await assert.rejects(asUser(USER, "update briefs set status='purchased' where id=$1", [BRIEF]), /pilot_status_forbidden/);
    await assert.rejects(asUser(USER, "update briefs set status='concepts_ready' where id=$1", [BRIEF]), /pilot_status_forbidden/);
    assert.equal((await asUser(USER, "select * from concepts")).length, 1); // excludes historical mismatch
    assert.equal((await asUser(OTHER, "select * from concepts")).length, 0);
    await db.exec("savepoint bad_owner");
    await assert.rejects(db.query(
      "insert into concepts(brief_id,user_id,idx) values($1,$2,1)", [OTHER_BRIEF, USER]
    ), /foreign key constraint/);
    await db.exec("rollback to savepoint bad_owner; release savepoint bad_owner");
  });

  test("account-save insert and allowed-field update recover a lost response using one stable UUID", async () => {
    const id = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const snapshot = {
      meaning: "A newly saved family tribute", placement: "Forearm", size_cm: "10 cm",
      style: "Fine-line", key_elements: "Olive branch", palette: "Black", reference_notes: ""
    };
    // Equivalent privilege/RLS operations to PostgREST .select(id).maybeSingle(),
    // .insert({id,user_id,...payload}).select(id), and .update(payload).select(id).
    const insert = async () => asUser(USER, `
      insert into public.briefs
        (id,user_id,status,meaning,placement,size_cm,style,key_elements,palette,reference_notes,brief)
      values($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10) returning id
    `, [id, USER, snapshot.meaning, snapshot.placement, snapshot.size_cm, snapshot.style,
      snapshot.key_elements, snapshot.palette, snapshot.reference_notes, snapshot]);
    const lookup = async () => asUser(USER,
      "select id from public.briefs where id=$1 and user_id=$2", [id, USER]);
    assert.deepEqual(await lookup(), []);
    assert.equal((await insert())[0].id, id);

    // Simulate a committed INSERT whose HTTP response was lost. A naive repeated
    // INSERT is a duplicate, but the next account-save lookup finds the same row.
    await assert.rejects(insert(), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "23505");
    assert.deepEqual(await lookup(), [{ id }]);
    const edited = { ...snapshot, meaning: "The same brief edited after a lost response" };
    const updated = await asUser(USER, `
      update public.briefs set status='draft',meaning=$3,placement=$4,size_cm=$5,
        style=$6,key_elements=$7,palette=$8,reference_notes=$9,brief=$10
      where id=$1 and user_id=$2 returning id
    `, [id, USER, edited.meaning, edited.placement, edited.size_cm, edited.style,
      edited.key_elements, edited.palette, edited.reference_notes, edited]);
    assert.deepEqual(updated, [{ id }]);
    const stored = await asUser(USER,
      "select id,user_id,status,meaning,brief from public.briefs where id=$1", [id]);
    assert.equal(stored.length, 1);
    assert.deepEqual(stored[0], { id, user_id: USER, status: "draft", meaning: edited.meaning, brief: edited });
    assert.equal((await query("select count(*)::int n from briefs")).rows[0].n, 3);
    assert.equal((await query("select count(*)::int n from pilot_generation_reservations")).rows[0].n, 0);
  });

  test("account-save cannot reassign ownership or upsert protected columns, including ID collisions", async () => {
    // PostgREST merge-duplicates includes payload id/user_id in the UPDATE set;
    // that pattern must remain forbidden rather than widening grants for it.
    await assert.rejects(asUser(USER, `
      insert into public.briefs(id,user_id,meaning) values($1,$2,'An owned brief')
      on conflict(id) do update set id=excluded.id,user_id=excluded.user_id,meaning=excluded.meaning
      returning id
    `, [BRIEF, USER]), /permission denied/);
    assert.deepEqual(await asUser(USER,
      "select id from public.briefs where id=$1 and user_id=$2", [OTHER_BRIEF, USER]), []);
    await assert.rejects(asUser(USER, `
      insert into public.briefs(id,user_id,status,meaning) values($1,$2,'draft','A colliding brief')
      returning id
    `, [OTHER_BRIEF, USER]), (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "23505");
    assert.deepEqual(await asUser(USER, `
      update public.briefs set meaning='Must not replace another persons work',status='draft'
      where id=$1 and user_id=$2 returning id
    `, [OTHER_BRIEF, USER]), []);
    const other = (await query("select user_id,meaning from briefs where id=$1", [OTHER_BRIEF])).rows[0];
    assert.equal(other.user_id, OTHER);
    assert.equal(other.meaning, "A meaningful personal journey");
    for (const privilege of ["id", "user_id"]) {
      const row = (await query(
        "select has_column_privilege('authenticated','public.briefs',$1,'UPDATE') allowed", [privilege]
      )).rows[0];
      assert.equal(row.allowed, false);
    }
  });

  test("database independently enforces required brief fields and direction bounds", async () => {
    await enable();
    for (const field of ["meaning", "placement", "size_cm", "style", "key_elements", "palette"]) {
      await db.exec("savepoint field");
      await db.exec(`update briefs set ${field}='' where id='${BRIEF}'`);
      await assert.rejects(reserve(), /pilot_invalid_brief/);
      await db.exec("rollback to savepoint field; release savepoint field");
    }
    await assert.rejects(reserve(USER, BRIEF, 3), /pilot_invalid_index/);
    await db.exec(`update briefs set meaning=repeat('m',2000),key_elements=repeat('k',2000),reference_notes=repeat('r',2000) where id='${BRIEF}'`);
    await assert.rejects(reserve(), /pilot_invalid_brief/);
  });

  test("prepare preserves artwork, uses submitted and spends nothing", async () => {
    await enable();
    await asUser(USER, "select pilot_prepare_brief($1)", [BRIEF]);
    assert.equal((await query("select status from briefs where id=$1", [BRIEF])).rows[0].status, "submitted");
    assert.equal((await query("select image_url from concepts where id=$1", [CONCEPT])).rows[0].image_url,
      `${USER}/${BRIEF}/direction-1.png`);
    assert.equal((await query("select count(*)::int n from pilot_generation_reservations")).rows[0].n, 0);
  });

  test("same-slot lease prevents duplicates; failures keep spend and existing art", async () => {
    await enable();
    const id = await reserve();
    await assert.rejects(reserve(), /pilot_busy/);
    await assert.rejects(complete(id), /pilot_image_missing/);
    await fail(id);
    await assert.rejects(complete(id), /pilot_lease/);
    assert.equal((await query("select image_url from concepts where id=$1", [CONCEPT])).rows[0].image_url,
      `${USER}/${BRIEF}/direction-1.png`);
    assert.equal((await query("select count(*)::int n from pilot_generation_reservations")).rows[0].n, 1);
    assert.notEqual(await reserve(), id);
  });

  test("rolling per-user default is six including failed work; older rows age out", async () => {
    await enable();
    for (let i = 0; i < 6; i += 1) await fail(await reserve());
    await assert.rejects(reserve(), /pilot_quota/);
    assert.equal((await query("select count(*)::int n from pilot_generation_reservations")).rows[0].n, 6);
    await db.exec("update pilot_generation_reservations set created_at=clock_timestamp()-interval '24 hours 1 second'");
    assert.ok(await reserve());
  });

  test("global rolling quota includes different users and is independent of per-user limit", async () => {
    await enable();
    await db.exec("update pilot_config set global_daily_limit=2,per_user_daily_limit=6");
    await fail(await reserve());
    await fail(await reserve(OTHER, OTHER_BRIEF), OTHER);
    await assert.rejects(reserve(), /pilot_quota/);
    await assert.rejects(reserve(OTHER, OTHER_BRIEF), /pilot_quota/);
  });

  test("expired leases can be replaced but still count against spend", async () => {
    await enable();
    const id = await reserve();
    await db.query("update pilot_generation_reservations set expires_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    const next = await reserve();
    assert.notEqual(next, id);
    assert.equal((await query("select state from pilot_generation_reservations where id=$1", [id])).rows[0].state, "expired");
    await assert.rejects(complete(id), /pilot_lease/);
  });

  test("storage guards close anonymous, foreign, unleased and wildcard-policy writes", async () => {
    await enable();
    const id = await reserve();
    for (const [user, path] of [
      ["", "demo/new.png"], [OTHER, `${USER}/${BRIEF}/${id}.png`],
      [USER, `${USER}/${BRIEF}/arbitrary.png`], [USER, `${USER}/${OTHER_BRIEF}/${id}.png`]
    ]) {
      await assert.rejects(asUser(user, "insert into storage.objects(bucket_id,name) values('concepts',$1)", [path]),
        /row-level security/);
    }
    await upload(id);
    assert.equal((await asUser(USER, "select * from storage.objects where bucket_id='concepts'")).length, 2);
    assert.equal((await asUser(OTHER, "select * from storage.objects where bucket_id='concepts'")).length, 0);
    assert.equal((await asUser("", "select * from storage.objects where bucket_id='concepts'")).length, 0);
    assert.equal((await asUser("", "select * from storage.objects where bucket_id='unrelated'")).length, 1);
    assert.equal((await asUser(USER, "update storage.objects set metadata='{}' where bucket_id='concepts' returning id")).length, 0);
    assert.equal((await asUser(USER, "delete from storage.objects where bucket_id='concepts' returning id")).length, 0);
  });

  test("successful save is atomic, replay-safe and archives rather than destroys old art", async () => {
    await enable();
    const id = await reserve();
    await upload(id);
    await assert.rejects(complete(id, OTHER), /pilot_lease/);
    const concept = await complete(id);
    assert.equal(concept.id, CONCEPT);
    assert.equal(concept.image_url, `${USER}/${BRIEF}/${id}.png`);
    assert.equal((await complete(id)).id, concept.id);
    assert.equal((await query("select count(*)::int n from pilot_concept_history")).rows[0].n, 1);
    assert.equal((await query("select count(*)::int n from concepts")).rows[0].n, 2);
    assert.equal((await query("select count(*)::int n from storage.objects")).rows[0].n, 4);
    assert.equal((await query("select previous_row->>'image_url' old from pilot_concept_history")).rows[0].old,
      `${USER}/${BRIEF}/direction-1.png`);
    for (const idx of [1, 2]) {
      const next = await reserve(USER, BRIEF, idx);
      await upload(next);
      await complete(next);
    }
    assert.equal((await query("select status from briefs where id=$1", [BRIEF])).rows[0].status, "concepts_ready");
  });

  test("kill switch blocks even in-flight completion and further storage uploads", async () => {
    await enable();
    const id = await reserve();
    await upload(id);
    await db.exec("update pilot_config set enabled=false");
    await assert.rejects(complete(id), /pilot_disabled/);
    await assert.rejects(reserve(), /pilot_disabled/);
    assert.equal((await query("select image_url from concepts where id=$1", [CONCEPT])).rows[0].image_url,
      `${USER}/${BRIEF}/direction-1.png`);
    await fail(id); // release works even while paused; charge remains
    assert.equal((await query("select state from pilot_generation_reservations where id=$1", [id])).rows[0].state, "failed");
  });

  test("SQL brief validation matches shared validation for whitespace, Unicode, controls and limits", async () => {
    const base = {
      meaning: "A meaningful family story", placement: "Forearm", size_cm: "10 cm", style: "Fine-line",
      key_elements: "Tree", palette: "Black", reference_notes: ""
    };
    const variants = [
      base, { ...base, meaning: "🙂".repeat(10) },
      { ...base, meaning: `\ufeff\u00a0${base.meaning}\u3000` },
      { ...base, placement: "\u00a0\u3000" },
      { ...base, reference_notes: "Allowed\tline\nbreak\rhere" },
      { ...base, reference_notes: "bad\u0001inside" },
      { ...base, reference_notes: "bad\u000binside" },
      { ...base, reference_notes: "bad\u007finside" },
      { ...base, reference_notes: "\u000btrimmed on edges\f" },
      { ...base, reference_notes: null },
      { ...base, placement: 123 }, { ...base, style: "s".repeat(121) },
      { ...base, meaning: "x".repeat(2000), key_elements: "y".repeat(2000), reference_notes: "z".repeat(2000) }
    ];
    for (const value of variants) {
      let expected = true;
      try { validateBrief(value); } catch { expected = false; }
      const result = (await query("select pilot_brief_is_valid($1::jsonb) valid", [JSON.stringify(value)])).rows[0].valid;
      assert.equal(result, expected, JSON.stringify(value).slice(0, 180));
    }
  });
});

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const OWNER = "11111111-1111-4111-8111-111111111111";
const PRIOR = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const OWNER_BRIEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRIEF = "33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_BRIEF = "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_BRIEF = "44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: PGlite;

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
async function reserve(user = USER, brief = BRIEF, idx = 0) {
  const rows = await asUser<{ r: { reservation_id: string } }>(user,
    "select pilot_reserve_generation($1,$2) r", [brief, idx]);
  return rows[0].r.reservation_id;
}
async function fail(id: string, user = USER) {
  return asUser(user, "select pilot_fail_generation($1)", [id]);
}
async function upload(id: string, user = USER, brief = BRIEF) {
  return asUser(user, "insert into storage.objects(bucket_id,name,metadata) values('concepts',$1,$2)", [
    `${user}/${brief}/${id}.png`, { mimetype: "image/png", size: 128 },
  ]);
}
async function complete(id: string, user = USER) {
  return (await asUser<{ c: { id: string; image_url: string } }>(user,
    "select pilot_complete_generation($1,'offline prompt','{}') c", [id]))[0].c;
}
async function entitlement(user = USER) {
  return (await asUser<{ e: { tier: string; reason: string; limit: number; remaining: number; can_generate: boolean } }>(
    user, "select pilot_generation_entitlement() e"))[0].e;
}
async function count(table: string) {
  return (await db.query<{ n: number }>(`select count(*)::int n from ${table}`)).rows[0].n;
}
async function enable() { await db.exec("update pilot_config set enabled=true,public_free_enabled=true"); }

describe("public lifetime attempt / real SQL, isolated PostgreSQL engine", { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    await db.exec(await readFile(new URL("./fixtures/pilot-schema.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202609120001_invite_only_free_pilot.sql", import.meta.url), "utf8"));
    // Actual staging quota configuration and historical failed work pre-migration.
    await db.exec(`
      update pilot_config set enabled=true,per_user_daily_limit=10,global_daily_limit=12;
      insert into pilot_members(user_id,allowlisted) values('${OWNER}',true);
      insert into auth.users(id) values('${USER}'),('${OTHER}');
      update auth.users set email=id::text || '@example.invalid',email_confirmed_at=now();
      insert into briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes)
        select '${BRIEF}','${USER}',meaning,placement,size_cm,style,key_elements,palette,reference_notes
          from briefs where id='${OWNER_BRIEF}';
      insert into briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes)
        select '${SECOND_BRIEF}','${USER}',meaning,placement,size_cm,style,key_elements,palette,reference_notes
          from briefs where id='${OWNER_BRIEF}';
      insert into briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes)
        select '${OTHER_BRIEF}','${OTHER}',meaning,placement,size_cm,style,key_elements,palette,reference_notes
          from briefs where id='${OWNER_BRIEF}';
      insert into pilot_generation_reservations(user_id,brief_id,idx,state,brief_snapshot,created_at,expires_at)
        values('${PRIOR}','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,'failed','{}',
          now()-interval '2 years',now()-interval '2 years');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609140001_public_free_lifetime_attempt.sql", import.meta.url), "utf8"));
  });
  beforeEach(async () => { await db.exec("begin"); });
  afterEach(async () => { await db.exec("rollback"); });
  after(async () => { await db.close(); });

  test("migration defaults public OFF and preserves staging owner, 10/12 quotas, lease and all history", async () => {
    const cfg = (await db.query("select enabled,public_free_enabled,per_user_daily_limit,global_daily_limit,lease_seconds from pilot_config")).rows[0];
    assert.deepEqual(cfg, { enabled: true, public_free_enabled: false, per_user_daily_limit: 10, global_daily_limit: 12, lease_seconds: 300 });
    assert.equal(await count("pilot_members"), 1);
    assert.equal(await count("concepts"), 2);
    assert.equal(await count("orders"), 1);
    assert.equal(await count("storage.objects"), 3);
    assert.equal(await count("pilot_lifetime_attempts"), 2); // old art + two-year-old failed reservation
    assert.equal((await entitlement()).reason, "not_enabled");
    await assert.rejects(reserve(), /pilot_not_invited/);
    assert.ok(await reserve(OWNER, OWNER_BRIEF)); // owner unchanged with public disabled
  });

  test("verified public user can prepare, reserve, upload, complete and read private output end to end", async () => {
    await enable();
    assert.deepEqual(await entitlement(), { tier: "public_free", reason: "available", limit: 1, remaining: 1, can_generate: true });
    await asUser(USER, "select pilot_prepare_brief($1)", [BRIEF]);
    assert.equal(await count("pilot_generation_reservations"), 1); // only historical fixture
    const id = await reserve();
    assert.equal((await entitlement()).reason, "used");
    // Consumption must not block the in-flight upload or completion.
    await upload(id);
    const concept = await complete(id);
    assert.equal(concept.image_url, `${USER}/${BRIEF}/${id}.png`);
    assert.equal((await complete(id)).id, concept.id); // idempotent read, not new generation
    assert.equal((await asUser(USER, "select * from concepts")).length, 1);
    assert.equal((await asUser(OTHER, "select * from concepts")).length, 0);
    assert.equal((await asUser(USER, "select * from storage.objects where bucket_id='concepts'")).length, 1);
    assert.equal((await asUser(OTHER, "select * from storage.objects where bucket_id='concepts'")).length, 0);
    assert.equal((await asUser("", "select * from storage.objects where bucket_id='concepts'")).length, 0);
    await assert.rejects(reserve(), /pilot_lifetime_used/);
    await assert.rejects(reserve(USER, BRIEF, 1), /pilot_lifetime_used/);
    await assert.rejects(reserve(USER, SECOND_BRIEF, 2), /pilot_lifetime_used/);
  });

  for (const state of ["reserved", "failed", "expired", "completed"]) {
    test(`${state} attempts never reset with lease expiry, rolling window, direction or brief`, async () => {
      await enable();
      const id = await reserve();
      if (state === "completed") { await upload(id); await complete(id); }
      if (state === "failed") await fail(id);
      await db.query(`update pilot_generation_reservations set state=$2,
        created_at=clock_timestamp()-interval '3 years',expires_at=clock_timestamp()-interval '2 years' where id=$1`, [id, state]);
      for (const [brief, idx] of [[BRIEF, 0], [BRIEF, 1], [SECOND_BRIEF, 2]] as const) {
        await assert.rejects(reserve(USER, brief, idx), /pilot_lifetime_used/);
      }
      assert.equal((await entitlement()).remaining, 0);
      assert.equal((await entitlement()).reason, "used");
    });
  }

  test("two-year-old failed history and pre-reservation legacy artwork both consume lifetime allowance", async () => {
    await enable();
    assert.equal((await entitlement(PRIOR)).reason, "used");
    await assert.rejects(reserve(PRIOR, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), /pilot_lifetime_used/);
    // Explicit operator removal does not mint public access for prior owner art.
    await db.exec("delete from pilot_members");
    assert.equal((await entitlement(OWNER)).reason, "used");
    await assert.rejects(reserve(OWNER, OWNER_BRIEF), /pilot_lifetime_used/);
  });

  test("clients cannot erase history, consumption, account ownership or membership; even operator archival cannot reset consumption", async () => {
    await enable();
    await fail(await reserve());
    for (const sql of [
      "delete from briefs", "delete from concepts", "delete from pilot_generation_reservations",
      "delete from pilot_lifetime_attempts", "truncate pilot_lifetime_attempts",
      "update pilot_lifetime_attempts set first_attempt_at=now()", "select * from pilot_lifetime_attempts",
      "update pilot_config set public_free_enabled=true",
      `insert into pilot_members(user_id,allowlisted) values('${USER}',true)`,
      "select pilot_generation_tier()", "select pilot_lock_and_authorize(null)",
      "update auth.users set email_confirmed_at=now()",
    ]) await assert.rejects(asUser(USER, sql), /permission denied/, sql);
    await db.exec(`delete from pilot_generation_reservations where user_id='${USER}';
      delete from briefs where id='${BRIEF}'`);
    assert.equal((await entitlement()).reason, "used");
    await assert.rejects(reserve(USER, SECOND_BRIEF), /pilot_lifetime_used/);
    assert.equal((await db.query<{ allowed: boolean }>(
      "select has_table_privilege('service_role','pilot_lifetime_attempts','DELETE') allowed")).rows[0].allowed, false);
  });

  for (const condition of [
    "email_confirmed_at=null", "email=null", "email='  '", "is_anonymous=true",
    "banned_until=clock_timestamp()+interval '1 day'",
  ]) {
    test(`database denies ${condition}, ignoring spoofed JWT verification metadata`, async () => {
      await enable();
      await db.exec(`update auth.users set ${condition} where id in ('${USER}','${OWNER}');
        select set_config('request.jwt.claims','{"email_verified":true,"user_metadata":{"email_verified":true}}',true)`);
      assert.equal((await entitlement()).reason, "unverified");
      await assert.rejects(reserve(), /pilot_email_unverified/);
      await assert.rejects(reserve(OWNER, OWNER_BRIEF), /pilot_email_unverified/);
      assert.equal(await count("pilot_generation_reservations"), 1);
    });
  }

  test("anonymous role, missing UID and nonexistent identity are denied even with public on", async () => {
    await enable();
    await assert.rejects(reserve("", BRIEF), /permission denied/);
    await assert.rejects(entitlement(""), /permission denied/);
    await asUser(USER, "select set_config('request.jwt.claim.sub','',true)");
    await assert.rejects(asUser(USER, "select set_config('request.jwt.claim.sub','',true), pilot_generation_entitlement()"), /pilot_unauthorized/);
    await assert.rejects(reserve("55555555-5555-4555-8555-555555555555"), /pilot_email_unverified/);
  });

  for (const member of ["false,null", "true,clock_timestamp()-interval '1 day'"]) {
    test(`explicit membership ${member} denies public fallback without using an attempt`, async () => {
      await enable();
      await db.exec(`insert into pilot_members(user_id,allowlisted,expires_at) values('${USER}',${member})`);
      assert.deepEqual(await entitlement(), { tier: "blocked", reason: "blocked", limit: 0, remaining: 0, can_generate: false });
      await assert.rejects(reserve(), /pilot_access_revoked/);
      assert.equal(await count("pilot_lifetime_attempts"), 2);
    });
  }

  test("active allowlisted owner retains ten rolling attempts, with failed/expired spend and same-slot leases", async () => {
    await enable();
    assert.deepEqual(await entitlement(OWNER), { tier: "allowlisted", reason: "available", limit: 10, remaining: 10, can_generate: true });
    const id = await reserve(OWNER, OWNER_BRIEF);
    await assert.rejects(reserve(OWNER, OWNER_BRIEF), /pilot_busy/);
    await db.query("update pilot_generation_reservations set expires_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    for (let i = 0; i < 9; i++) await fail(await reserve(OWNER, OWNER_BRIEF), OWNER);
    await assert.rejects(reserve(OWNER, OWNER_BRIEF), /pilot_quota/);
    assert.equal((await entitlement(OWNER)).remaining, 0);
    await db.exec(`update pilot_generation_reservations set created_at=clock_timestamp()-interval '24 hours 1 second' where user_id='${OWNER}'`);
    assert.ok(await reserve(OWNER, OWNER_BRIEF));
    assert.equal((await entitlement(OWNER)).remaining, 9);
  });

  test("global twelve rolling attempts shared across owner and public; denied requests consume nothing", async () => {
    await enable();
    for (let i = 0; i < 10; i++) await fail(await reserve(OWNER, OWNER_BRIEF), OWNER);
    await fail(await reserve());
    await fail(await reserve(OTHER, OTHER_BRIEF), OTHER);
    // Fresh account via fixture PRIOR is already used; create a fresh identity.
    const fresh = "66666666-6666-4666-8666-666666666666";
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${fresh}','fresh@example.invalid',now());
      insert into briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette)
        values('${fresh}','${fresh}','A meaningful fresh test','Forearm','10 cm','Fine-line','Tree','Black')`);
    await assert.rejects(reserve(fresh, fresh), /pilot_global_quota/);
    assert.equal(await count("pilot_generation_reservations"), 13); // twelve + old fixture
    assert.equal((await entitlement(fresh)).remaining, 1);
    assert.equal((await entitlement(fresh)).reason, "global_quota");
    await db.exec(`update pilot_generation_reservations set created_at=clock_timestamp()-interval '24 hours 1 second' where user_id='${OWNER}'`);
    assert.ok(await reserve(fresh, fresh));
    await assert.rejects(reserve(USER, SECOND_BRIEF), /pilot_lifetime_used/);
  });

  for (const change of ["update pilot_config set enabled=false", "update pilot_config set public_free_enabled=false",
    `insert into pilot_members(user_id,allowlisted) values('${USER}',false)`,
    `update auth.users set email_confirmed_at=null where id='${USER}'`]) {
    test(`in-flight public upload AND completion fail closed after ${change}`, async () => {
      await enable();
      const id = await reserve();
      await upload(id);
      await db.exec(change);
      assert.equal((await asUser<{ allowed: boolean }>(USER, "select pilot_can_upload_object($1) allowed", [`${USER}/${BRIEF}/${id}.png`]))[0].allowed, false);
      await assert.rejects(complete(id), /pilot_disabled|pilot_not_invited|pilot_access_revoked|pilot_email_unverified/);
      await fail(id); // failure release remains possible even when access revoked
      await db.exec("update pilot_config set enabled=true,public_free_enabled=true");
      assert.equal(await count("pilot_lifetime_attempts"), 3);
    });
  }

  test("public storage guards still reject forged, foreign, expired, failed, overwritten or deleted objects", async () => {
    await enable();
    const id = await reserve();
    for (const [user, brief, rid] of [[OTHER, BRIEF, id], [USER, OTHER_BRIEF, id], [USER, BRIEF, OWNER], ["", BRIEF, id]]) {
      await assert.rejects(upload(rid, user, brief), /row-level security/);
    }
    await assert.rejects(complete(id, OTHER), /pilot_lease/);
    await upload(id);
    assert.equal((await asUser(USER, "delete from storage.objects where bucket_id='concepts' returning id")).length, 0);
    assert.equal((await asUser(USER, "update storage.objects set metadata='{}' where bucket_id='concepts' returning id")).length, 0);
    await db.query("update pilot_generation_reservations set expires_at=clock_timestamp()-interval '1 second' where id=$1", [id]);
    await assert.rejects(complete(id), /pilot_lease/);
    await assert.rejects(upload(id), /row-level security/);
    await fail(id);
    await assert.rejects(complete(id), /pilot_lease/);
    assert.equal((await asUser("", "select * from storage.objects where bucket_id='unrelated'")).length, 1);
  });

  test("invalid brief/index/foreign ownership checks occur before consumption", async () => {
    await enable();
    await assert.rejects(reserve(USER, OTHER_BRIEF), /pilot_not_found/);
    await assert.rejects(reserve(USER, BRIEF, 3), /pilot_invalid_index/);
    await db.exec(`update briefs set meaning='' where id='${BRIEF}'`);
    await assert.rejects(reserve(), /pilot_invalid_brief/);
    assert.equal((await entitlement()).remaining, 1);
    assert.equal(await count("pilot_lifetime_attempts"), 2);
  });

  test("entitlement is current-caller only, read-only and never exposes PII, other usage or private data", async () => {
    await enable();
    const before = [await count("pilot_generation_reservations"), await count("pilot_lifetime_attempts")];
    const info = await entitlement();
    assert.deepEqual(Object.keys(info).sort(), ["can_generate", "limit", "reason", "remaining", "tier"]);
    assert.doesNotMatch(JSON.stringify(info), /@|user_id|brief|prompt|global_count|reservation/);
    assert.deepEqual([await count("pilot_generation_reservations"), await count("pilot_lifetime_attempts")], before);
    await assert.rejects(asUser(USER, "select pilot_generation_entitlement($1)", [OWNER]), /does not exist/);
  });
});

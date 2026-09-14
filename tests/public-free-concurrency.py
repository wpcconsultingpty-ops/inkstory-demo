"""Real multi-connection PostgreSQL tests. No provider, email or hosted DB access.

Requires local PostgreSQL and psycopg[binary]. Start an isolated cluster first:
  initdb -D /absolute/private/test-dir --auth=trust --no-locale
  postgres -D /absolute/private/test-dir -k /absolute/private/test-dir -p 55441 -h 127.0.0.1
  python tests/public-free-concurrency.py --socket-dir /absolute/private/test-dir

Only a filesystem Unix-domain socket is accepted (no remote/TCP URL or secret).
Creates and retains a uniquely named fixture database; never touches app DBs.
"""
import argparse
import concurrent.futures
import getpass
import json
import pathlib
import threading
import time
import uuid

import psycopg
from psycopg import sql

parser = argparse.ArgumentParser()
parser.add_argument("--socket-dir", required=True)
parser.add_argument("--port", type=int, default=55441)
args = parser.parse_args()
socket_dir = pathlib.Path(args.socket_dir)
assert socket_dir.is_absolute() and socket_dir.is_dir(), "Only an absolute local Unix socket directory is permitted"
assert (socket_dir / f".s.PGSQL.{args.port}").exists(), "Local PostgreSQL socket not found"
dbname = f"inkstory_public_free_test_{time.time_ns()}"
connection = dict(host=str(socket_dir), port=args.port, user=getpass.getuser(), dbname=dbname)
root = pathlib.Path(__file__).resolve().parents[1]

with psycopg.connect(**{**connection, "dbname": "postgres"}, autocommit=True) as admin:
    admin.execute(sql.SQL("create database {} template template0 encoding 'UTF8'").format(sql.Identifier(dbname)))
db = psycopg.connect(**connection, autocommit=True)
fixture = (root / "tests/fixtures/pilot-schema.sql").read_text()
for role in ("anon", "authenticated", "service_role"):
    original = f"create role {role} nologin" + (" bypassrls;" if role == "service_role" else ";")
    fixture = fixture.replace(original, f"do $$ begin if not exists(select 1 from pg_roles where rolname='{role}') then {original} end if; end $$;")
db.execute(fixture)
db.execute((root / "supabase/migrations/202609120001_invite_only_free_pilot.sql").read_text())
db.execute("update auth.users set email=id::text || '@example.invalid',email_confirmed_at=now()")
db.execute("update pilot_config set enabled=true,per_user_daily_limit=10,global_daily_limit=12")
db.execute((root / "supabase/migrations/202609140001_public_free_lifetime_attempt.sql").read_text())
db.execute("update pilot_config set public_free_enabled=true")
results = []


def account(allowlisted=False, brief_count=1):
    uid = uuid.uuid4()
    db.execute("insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())", (uid, f"{uid}@example.invalid"))
    if allowlisted:
        db.execute("insert into pilot_members(user_id,allowlisted) values(%s,true)", (uid,))
    briefs = [uuid.uuid4() for _ in range(brief_count)]
    for bid in briefs:
        db.execute("""insert into briefs(id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes)
          values(%s,%s,'A meaningful fictional story','Forearm','10 cm','Fine-line','Tree','Black','')""", (bid, uid))
    return uid, briefs


def call(uid, statement, parameters=(), barrier=None):
    try:
        with psycopg.connect(**connection) as client:
            client.execute("set local role authenticated")
            client.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(uid),))
            client.execute("set local statement_timeout='15s'")
            if barrier:
                barrier.wait(timeout=15)
            row = client.execute(statement, parameters).fetchone()
        return {"ok": True, "value": row[0] if row else None}
    except psycopg.Error as error:
        return {"ok": False, "reason": error.diag.message_primary}


def burst(work):
    barrier = threading.Barrier(len(work))
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(work)) as pool:
        futures = [pool.submit(call, uid, "select pilot_reserve_generation(%s,%s)", (bid, idx), barrier)
                   for uid, bid, idx in work]
        return [f.result(timeout=30) for f in futures]


def check(name, values, wins, expected_denials):
    assert sum(v["ok"] for v in values) == wins, (name, values)
    assert {v["reason"] for v in values if not v["ok"]} == set(expected_denials), (name, values)
    results.append({"test": name, "simultaneous_connections": len(values), "reservations": wins,
                    "denials": {reason: sum(v.get("reason") == reason for v in values) for reason in expected_denials}})


def age_reservations():
    # Fixture DB only: lifetime markers remain unchanged.
    db.execute("update pilot_generation_reservations set created_at=clock_timestamp()-interval '2 years',expires_at=clock_timestamp()-interval '1 day'")


# Same user across separate briefs AND direction slots: singleton lock serializes
# lifetime read + trigger insert, not just the existing same-slot index.
public, briefs = account(brief_count=12)
values = burst([(public, bid, i % 3) for i, bid in enumerate(briefs)])
check("one public lifetime reservation across briefs/directions", values, 1, ["pilot_lifetime_used"])
winner = next(v["value"]["reservation_id"] for v in values if v["ok"])
assert call(public, "select pilot_fail_generation(%s)", (winner,))["ok"]
age_reservations()
values = burst([(public, bid, (i + 1) % 3) for i, bid in enumerate(briefs)])
check("failed/aged attempt remains consumed during simultaneous requests", values, 0, ["pilot_lifetime_used"])

# Twenty-four different verified accounts must not exceed the existing shared 12.
fresh = [account() for _ in range(24)]
values = burst([(uid, bids[0], i % 3) for i, (uid, bids) in enumerate(fresh)])
check("global twelve across public accounts", values, 12, ["pilot_global_quota"])
assert db.execute("select count(*) from pilot_generation_reservations where created_at>clock_timestamp()-interval '24 hours'").fetchone()[0] == 12
for (uid, _), result in zip(fresh, values):
    marker = db.execute("select exists(select 1 from pilot_lifetime_attempts where user_id=%s)", (uid,)).fetchone()[0]
    assert marker is result["ok"], "Quota denial must not consume public lifetime balance"
age_reservations()

# Owner has a lifetime marker after first use but must still reach 10, not 1.
owner, owner_briefs = account(allowlisted=True, brief_count=16)
values = burst([(owner, bid, i % 3) for i, bid in enumerate(owner_briefs)])
check("active allowlisted ten rolling reservations", values, 10, ["pilot_quota"])
assert db.execute("select count(*) from pilot_lifetime_attempts where user_id=%s", (owner,)).fetchone()[0] == 1
age_reservations()

# Same direction remains a lease lock, independent of the lifetime public gate.
values = burst([(owner, owner_briefs[0], 0)] * 8)
check("allowlisted same-slot lease survives concurrent requests", values, 1, ["pilot_busy"])
age_reservations()

# Two public accounts plus ten owner requests = twelve globally, with no tier
# exemption able to bypass the shared cap.
mixed_owner, mixed_briefs = account(allowlisted=True, brief_count=10)
mixed_public = [account() for _ in range(10)]
work = [(mixed_owner, bid, i % 3) for i, bid in enumerate(mixed_briefs)]
work += [(uid, bids[0], 0) for uid, bids in mixed_public]
values = burst(work)
check("mixed owner/public share one global lock", values, 12, ["pilot_global_quota"])
assert sum(v["ok"] for v in values[:10]) <= 10
assert db.execute("select count(*) from pilot_generation_reservations where created_at>clock_timestamp()-interval '24 hours'").fetchone()[0] == 12
age_reservations()

# Hold the global row lock to prove a second connection waits, then toggle the
# switch before releasing. A waiter must re-read disabled config, not reserve
# using the snapshot it had before it waited.
waiting, bids = account()
lock = psycopg.connect(**connection)
lock.execute("select * from pilot_config where id=true for update")
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    future = pool.submit(call, waiting, "select pilot_reserve_generation(%s,0)", (bids[0],))
    for _ in range(200):
        blocked = db.execute("""select count(*) from pg_stat_activity
          where datname=%s and wait_event_type='Lock'
          and query like 'select pilot_reserve_generation%%'""", (dbname,)).fetchone()[0]
        if blocked:
            break
        time.sleep(0.01)
    assert blocked, "Concurrent request must block on global config lock"
    lock.execute("update pilot_config set public_free_enabled=false where id=true")
    lock.commit()
    value = future.result(timeout=30)
lock.close()
assert value == {"ok": False, "reason": "pilot_not_invited"}, value
results.append({"test": "waiter rechecks opt-in gate after global lock releases", "passed": True})
assert not db.execute("select exists(select 1 from pilot_lifetime_attempts where user_id=%s)", (waiting,)).fetchone()[0]

print(json.dumps({"database": dbname, "engine": db.execute("select version()").fetchone()[0],
                  "network": "local Unix socket only", "tests_passed": len(results), "results": results}, indent=2))
db.close()

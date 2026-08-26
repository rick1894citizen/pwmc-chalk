-- Chalk · Supabase schema
-- Run this once in your Supabase project's SQL Editor (Dashboard > SQL Editor > New query > paste > Run).
--
-- Design:
--   - `fixtures` holds one row per night, storing the whole fixture as JSON
--     (the exact same shape the app already keeps in localStorage), plus a
--     lightweight lock so only one scorer can write at a time.
--   - The PIN is bcrypt-hashed server-side and never appears in the app's
--     source - only these functions ever see it, and only at "claim" time.
--   - After claiming, writes use a session token (not the PIN) so scoring
--     a leg doesn't re-check the PIN on every single dart - the PIN check
--     is deliberately slow (bcrypt), the token check is a fast UUID match.
--   - Everyone can read every row (that's "follow along live"). Nobody can
--     write directly - all writes go through these functions, which enforce
--     the PIN + lock rules. Direct INSERT/UPDATE/DELETE is never granted.

create extension if not exists pgcrypto;

create table if not exists fixtures (
  id           text primary key,
  data         jsonb not null,
  updated_at   timestamptz not null default now(),
  locked_by    text,          -- display name of whoever currently holds scoring control
  locked_at    timestamptz,   -- last heartbeat; a lock older than 90s is treated as free
  locked_token uuid           -- session token proving "I'm the one who claimed this"
);

alter table fixtures enable row level security;

drop policy if exists "public read" on fixtures;
create policy "public read" on fixtures for select using (true);
-- No insert/update/delete policy is created - so even though RLS is on,
-- the anon role has no way to write to this table directly. All writes
-- happen inside the security definer functions below, which run with the
-- table owner's privileges regardless of RLS.

grant select on fixtures to anon, authenticated;

-- One shared PIN for the whole team of scorers.
create table if not exists scorer_pin (
  id       int primary key default 1,
  pin_hash text not null,
  check (id = 1)
);

-- RLS on, with *no* policies at all - so anon/authenticated get zero direct
-- access, full stop. The functions below can still read/write it because
-- they're security definer, running as the table owner, which bypasses RLS
-- regardless of policies. Nothing else needs to touch this table directly.
alter table scorer_pin enable row level security;

-- PIN is hashed here - once this runs, only the hash is stored, the
-- plaintext below never touches the database again.
insert into scorer_pin (id, pin_hash)
values (1, crypt('188094', gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;

-- Start (or fully overwrite) a fixture. Requires the PIN. Returns a session
-- token to use for every subsequent save/heartbeat/release, or null if the
-- PIN was wrong.
create or replace function start_fixture(p_id text, p_pin text, p_name text, p_data jsonb)
returns uuid
language plpgsql security definer as $$
declare
  ok  boolean;
  tok uuid;
begin
  select (pin_hash = crypt(p_pin, pin_hash)) into ok from scorer_pin where id = 1;
  if not ok then return null; end if;

  tok := gen_random_uuid();
  insert into fixtures (id, data, updated_at, locked_by, locked_at, locked_token)
  values (p_id, p_data, now(), p_name, now(), tok)
  on conflict (id) do update
    set data = excluded.data, updated_at = now(),
        locked_by = excluded.locked_by, locked_at = excluded.locked_at, locked_token = excluded.locked_token;
  return tok;
end;
$$;

-- Take over scoring on a fixture someone already started (e.g. handing the
-- phone to a different scorer, or resuming after closing the app). Requires
-- the PIN. Refuses only if someone else's lock is still "fresh" (heartbeat
-- within the last 90 seconds) - a dropped phone doesn't strand the match.
create or replace function claim_scoring(p_id text, p_pin text, p_name text)
returns uuid
language plpgsql security definer as $$
declare
  ok  boolean;
  cur record;
  tok uuid;
begin
  select (pin_hash = crypt(p_pin, pin_hash)) into ok from scorer_pin where id = 1;
  if not ok then return null; end if;

  select locked_by, locked_at into cur from fixtures where id = p_id;
  if cur.locked_by is not null and cur.locked_by <> p_name
     and cur.locked_at > now() - interval '90 seconds' then
    return null;   -- someone else is actively scoring this right now
  end if;

  tok := gen_random_uuid();
  update fixtures set locked_by = p_name, locked_at = now(), locked_token = tok where id = p_id;
  return tok;
end;
$$;

-- Save a score/edit. Cheap - no PIN check, just confirms the token matches
-- who currently holds the lock. Returns true on success, null if rejected
-- (token stale/mismatched - e.g. someone else claimed it in the meantime).
create or replace function save_fixture(p_id text, p_token uuid, p_data jsonb)
returns boolean
language sql security definer as $$
  update fixtures set data = p_data, updated_at = now(), locked_at = now()
  where id = p_id and locked_token = p_token
  returning true;
$$;

-- Call every 30s or so while actively scoring, to keep the lock fresh.
create or replace function heartbeat_scoring(p_id text, p_token uuid)
returns boolean
language sql security definer as $$
  update fixtures set locked_at = now()
  where id = p_id and locked_token = p_token
  returning true;
$$;

-- Explicitly hand back control (e.g. finishing the night).
create or replace function release_scoring(p_id text, p_token uuid)
returns void
language sql security definer as $$
  update fixtures set locked_by = null, locked_at = null, locked_token = null
  where id = p_id and locked_token = p_token;
$$;

grant execute on function start_fixture, claim_scoring, save_fixture, heartbeat_scoring, release_scoring
  to anon, authenticated;

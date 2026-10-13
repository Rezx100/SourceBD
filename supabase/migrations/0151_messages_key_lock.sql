-- 0151 — The message key is closed to visitors, and replaced (13 Oct 2026).
--
-- THE FAULT (ops/plans/data-integrity-audit.md, S1-0)
--   _messages_key() returns the key that encrypts every buyer-supplier message. 0027 and 0078 revoked
--   it "from public", but Supabase's default privileges grant EXECUTE on every new function in public
--   to anon and authenticated by name, and that grant was never taken back. Read on production,
--   13 Oct 2026: GET /rest/v1/rpc/_messages_key with the public key every browser holds answered 200
--   with the key. The messages themselves stay behind row rules, so the key alone opens nothing, but
--   the second lock was gone.
--
-- WHAT THIS DOES
--   1. Takes EXECUTE on _messages_key() away from anon, authenticated and service_role. Its five
--      callers (thread_send_message, thread_send_message_files, thread_messages, thread_list,
--      _ledger_row_change) all run as the owner and keep working.
--   2. Adds _messages_rotate_key(reason): owner-only. It makes a new key, re-encrypts every message
--      under it and stores it, in one transaction. The old key has to be treated as known.
--   3. Calls it once.
--
--   The re-encryption is one event, not an edit by each sender, so the per-row trigger on messages is
--   switched off for those updates and ONE entry, messages.key_rotated, goes into the activity record
--   with the counts and the reason. The text of a message does not change, so the fingerprints the
--   record already holds (body_sha256) still match.
--
--   A message the old key cannot open is left as it is and counted (it was already unreadable). Read on
--   production, 13 Oct 2026: 5 messages, all 5 open with the current key, and the key lives in
--   app_private_settings (app.messages_key is not set). Where the key IS set on the database as
--   app.messages_key, the function refuses: that setting wins over the table and it cannot change it.
--
-- REVERSE
--   drop function public._messages_rotate_key(text);
--   grant execute on function public._messages_key() to anon, authenticated, service_role;  -- the fault
--   The old key is not kept anywhere: the rotation is not undone, and does not need to be.

revoke all on function public._messages_key() from public, anon, authenticated, service_role;

create or replace function public._messages_rotate_key(p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_old     text;
  v_new     text := encode(gen_random_bytes(32), 'hex');
  v_plain   text;
  v_done    int := 0;
  v_left    int := 0;
  m         record;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'a key rotation needs a reason' using errcode = '22023';
  end if;
  if coalesce(length(current_setting('app.messages_key', true)), 0) >= 16 then
    raise exception 'the key is set on the database as app.messages_key, which wins over the stored one: change it there';
  end if;

  -- Nobody sends while the key changes; the trigger switch below takes this lock anyway.
  lock table public.messages in share row exclusive mode;
  v_old := public._messages_key();

  alter table public.messages disable trigger trg_messages_ledger;
  -- ponytail: one row at a time, so one unreadable message cannot stop the rest. Fine for thousands;
  -- batch it if messages ever reach millions.
  for m in select id, body_ciphertext from public.messages loop
    begin
      v_plain := pgp_sym_decrypt(m.body_ciphertext, v_old);
    exception when others then
      v_left := v_left + 1;
      continue;
    end;
    update public.messages
       set body_ciphertext = pgp_sym_encrypt(v_plain, v_new, 'cipher-algo=aes256')
     where id = m.id;
    v_done := v_done + 1;
  end loop;
  alter table public.messages enable trigger trg_messages_ledger;

  update public.app_private_settings set value = v_new, updated_at = now() where key = 'messages_key';
  if not found then
    raise exception 'no stored key to replace (app_private_settings.messages_key)';
  end if;

  perform public._ledger_write(
    'messages.key_rotated', 'messages', null,
    jsonb_build_object('reencrypted', v_done, 'unreadable_left', v_left),
    null, null, null, null, null, null, null, p_reason
  );
  return jsonb_build_object('reencrypted', v_done, 'unreadable_left', v_left);
end;
$$;

comment on function public._messages_rotate_key(text) is
  '0151: replaces the message encryption key and re-encrypts every message under the new one, in one '
  'transaction, with one messages.key_rotated entry in the activity record. Owner-only.';

revoke all on function public._messages_rotate_key(text) from public, anon, authenticated, service_role;

select public._messages_rotate_key(
  'The key could be read by any visitor through the database API (found 13 Oct 2026); closed by this migration.'
);

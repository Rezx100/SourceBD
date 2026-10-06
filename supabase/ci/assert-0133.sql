-- 0133 asserted by running it: the sender fingerprints their file once (true), the same value again is a
-- no-op (false), a different value is refused and the first one stays; the other participant and a
-- stranger are refused; a malformed value and an unknown file are refused; anon cannot call it; the
-- activity record keeps the write as a version with the two changed columns.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a133', 'buyer-0133@example.invalid',    '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b133', 'supplier-0133@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c133', 'stranger-0133@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (id, slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
  values ('00000000-0000-4000-8000-0000000a1133', 'ci-0133-knit', 'CI 0133 Knit Ltd', 'ci 0133 knit ltd', 'Dhaka', 'Dhaka', false, false,
          '00000000-0000-4000-8000-00000000b133');
insert into public.message_threads (id, buyer_id, supplier_id, subject)
  values ('00000000-0000-4000-8000-0000000b1133', '00000000-0000-4000-8000-00000000a133', '00000000-0000-4000-8000-0000000a1133', 'CI');
insert into public.thread_participants (thread_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000b1133', '00000000-0000-4000-8000-00000000a133', 'buyer'),
  ('00000000-0000-4000-8000-0000000b1133', '00000000-0000-4000-8000-00000000b133', 'supplier');
insert into public.messages (id, thread_id, sender_id, body_ciphertext, body_len)
  values ('00000000-0000-4000-8000-0000000c1133', '00000000-0000-4000-8000-0000000b1133', '00000000-0000-4000-8000-00000000a133', pgp_sym_encrypt('see file', 'k'), 8);
insert into public.message_attachments (message_id, thread_id, object_path, file_name, mime_type, size_bytes)
  values ('00000000-0000-4000-8000-0000000c1133', '00000000-0000-4000-8000-0000000b1133',
          '00000000-0000-4000-8000-0000000b1133/00000000-0000-4000-8000-00000000a133/r1/spec.pdf', 'spec.pdf', 'application/pdf', 1234);

do $$
declare
  msg   constant uuid := '00000000-0000-4000-8000-0000000c1133';
  p     constant text := '00000000-0000-4000-8000-0000000b1133/00000000-0000-4000-8000-00000000a133/r1/spec.pdf';
  sha1  constant text := repeat('a', 64);
  sha2  constant text := repeat('b', 64);
  hit   text;
  ok    boolean;
  e     record;
begin
  if has_function_privilege('anon', 'public.message_attachment_fingerprint(uuid, text, text)', 'execute') then
    raise exception 'anon can call the fingerprint';
  end if;

  -- The other participant and a stranger cannot fingerprint the sender's file.
  set local role authenticated;
  foreach hit in array array['00000000-0000-4000-8000-00000000b133', '00000000-0000-4000-8000-00000000c133'] loop
    perform set_config('request.jwt.claim.sub', hit, true);
    begin
      perform public.message_attachment_fingerprint(msg, p, sha1);
      raise exception '% fingerprinted a file that is not theirs', hit;
    exception when sqlstate '42501' then null;
    end;
  end loop;

  -- The sender: a bad value and an unknown file are refused; the right call answers true.
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a133', true);
  begin
    perform public.message_attachment_fingerprint(msg, p, 'not-hex');
    raise exception 'a malformed fingerprint was taken';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.message_attachment_fingerprint(msg, p || '.nope', sha1);
    raise exception 'an unknown file was fingerprinted';
  exception when sqlstate 'P0002' then null;
  end;
  ok := public.message_attachment_fingerprint(msg, p, sha1);
  if not ok then raise exception 'the first fingerprint answered false'; end if;
  ok := public.message_attachment_fingerprint(msg, p, sha1);
  if ok then raise exception 'the same fingerprint again answered true'; end if;
  begin
    perform public.message_attachment_fingerprint(msg, p, sha2);
    raise exception 'a different fingerprint replaced the first';
  exception when sqlstate '42501' then null;
  end;
  reset role;

  if (select sha256 from public.message_attachments where object_path = p) <> sha1
     or (select fingerprinted_at from public.message_attachments where object_path = p) is null then
    raise exception 'the fingerprint was not kept';
  end if;

  -- The record kept the write as a version.
  select * into e from public.activity_ledger
   where kind = 'message.updated' and target_table = 'message_attachments' and thread_id = '00000000-0000-4000-8000-0000000b1133'
   order by id desc limit 1;
  if e.id is null or e.actor_id <> '00000000-0000-4000-8000-00000000a133' then
    raise exception 'the fingerprint write is not in the record: %', to_jsonb(e);
  end if;
  if e.content -> 'changed' <> '["fingerprinted_at", "sha256"]'::jsonb or e.content -> 'after' ->> 'sha256' <> sha1 then
    raise exception 'the version does not show the two columns: %', e.content;
  end if;
end
$$;

rollback;

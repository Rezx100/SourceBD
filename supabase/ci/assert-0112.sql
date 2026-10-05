-- Behaviour of Messages after 0112, asserted by running it: a supplier's
-- reply shows as unread in the buyer's list and badge until the buyer marks
-- the conversation read; the list carries the last line; a buyer's message
-- with a file reads back with the file, and shows "read" once the supplier
-- has read it; a file outside the sender's folder, a missing file and a
-- stranger are refused; anon calls nothing new.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a112', 'buyer-0112@example.invalid', '{"role":"buyer"}'::jsonb),
  ('00000000-0000-4000-8000-00000000b112', 'supplier-0112@example.invalid', '{"role":"supplier"}'::jsonb),
  ('00000000-0000-4000-8000-00000000c112', 'stranger-0112@example.invalid', '{"role":"buyer"}'::jsonb)
on conflict do nothing;

insert into public.suppliers (slug, company_name, company_name_norm, city, district, is_published, is_sanctioned, claimed_by)
values ('ci-0112', 'CI 0112 Ltd', 'ci 0112 ltd', 'Dhaka', 'Dhaka', true, false, '00000000-0000-4000-8000-00000000b112')
on conflict (slug) do nothing;

do $$
declare
  buyer    constant uuid := '00000000-0000-4000-8000-00000000a112';
  supplier constant uuid := '00000000-0000-4000-8000-00000000b112';
  stranger constant uuid := '00000000-0000-4000-8000-00000000c112';
  th   uuid;
  row  jsonb;
  msgs jsonb;
  mine jsonb;
  fn   text;
  path text;
begin
  foreach fn in array array['public.thread_mark_read(uuid)', 'public.thread_unread_total()',
                            'public.thread_send_message_files(uuid, text, text[])',
                            'public.thread_list()', 'public.thread_messages(uuid, int, timestamptz)'] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'anon can execute %', fn;
    end if;
  end loop;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  th := public.thread_open((select id from public.suppliers where slug = 'ci-0112'), null, 'CI');
  perform public.thread_send_message(th, 'Hello from the buyer');

  -- The supplier replies.
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  perform public.thread_send_message(th, 'We received your RFQ.');

  -- One transaction, one now(): spread the two messages out so "last" means something.
  reset role;
  update public.messages set created_at = now() - case when sender_id = buyer then interval '10 minutes'
                                                       else interval '5 minutes' end
   where thread_id = th;
  set local role authenticated;

  perform set_config('request.jwt.claim.sub', buyer::text, true);
  row := public.thread_list()->0;
  if (row->>'unread_count')::int <> 1 or (row->>'has_reply')::boolean is not true
     or row->>'last_body' <> 'We received your RFQ.' or (row->>'last_is_self')::boolean then
    raise exception 'buyer list row %', row;
  end if;
  if public.thread_unread_total() <> 1 then
    raise exception 'unread total before reading';
  end if;
  perform public.thread_mark_read(th);
  if public.thread_unread_total() <> 0 or (public.thread_list()->0->>'unread_count')::int <> 0 then
    raise exception 'still unread after marking read';
  end if;

  -- A file: the upload is simulated as the storage API would write it.
  path := th::text || '/' || buyer::text || '/r1/Tech pack hoodie.pdf';
  reset role;
  insert into storage.objects (bucket_id, name, metadata)
  values ('message-files', path, '{"mimetype":"application/pdf","size":2100000}'::jsonb);
  insert into storage.objects (bucket_id, name, metadata)
  values ('message-files', th::text || '/' || supplier::text || '/r2/theirs.pdf', '{}'::jsonb);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', buyer::text, true);

  begin
    perform public.thread_send_message_files(th, '', array[th::text || '/' || supplier::text || '/r2/theirs.pdf']);
    raise exception 'attached another person''s file';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.thread_send_message_files(th, 'x', array[th::text || '/' || buyer::text || '/r9/missing.pdf']);
    raise exception 'attached a file that was never uploaded';
  exception when no_data_found then null;
  end;
  begin
    perform public.thread_send_message_files(th, '  ', null);
    raise exception 'sent an empty message';
  exception when invalid_parameter_value then null;
  end;

  perform public.thread_send_message_files(th, '', array[path]);
  msgs := public.thread_messages(th, 50, null);
  mine := msgs->(jsonb_array_length(msgs) - 1);
  if mine->'attachments'->0->>'file_name' <> 'Tech pack hoodie.pdf'
     or (mine->'attachments'->0->>'size_bytes')::bigint <> 2100000
     or (mine->>'read')::boolean then
    raise exception 'buyer file message %', mine;
  end if;
  if public.thread_list()->0->>'last_body' <> '' or not (public.thread_list()->0->>'last_is_self')::boolean then
    raise exception 'last line after a file-only message';
  end if;

  -- The supplier reads; the buyer's message turns read.
  perform set_config('request.jwt.claim.sub', supplier::text, true);
  perform public.thread_mark_read(th);
  perform set_config('request.jwt.claim.sub', buyer::text, true);
  msgs := public.thread_messages(th, 50, null);
  if not (msgs->(jsonb_array_length(msgs) - 1)->>'read')::boolean then
    raise exception 'not read after the supplier read it';
  end if;

  -- A stranger can do none of it.
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  begin
    perform public.thread_mark_read(th);
    raise exception 'a stranger marked the thread read';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.thread_send_message_files(th, 'hi', null);
    raise exception 'a stranger sent a message';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.message_attachments;
    raise exception 'authenticated read message_attachments';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;

-- 0085_evidence_url_hash_search_path.sql
--
-- Pin the search_path on the url_hash trigger function introduced in 0084.
--
-- Raised by the Supabase security advisor (`function_search_path_mutable`)
-- immediately after 0084 was applied. Kept as its own migration rather than
-- folded back into 0084, because 0084 is already applied in production: editing
-- an applied migration makes a freshly built database and production disagree
-- about their history even when they agree about their schema.
--
-- Milder than the SECURITY DEFINER cases the same advisor reports, since this
-- runs with invoker rights — an attacker manipulating the path would only be
-- redirecting calls made on their own behalf. But the body resolves sha256,
-- convert_to and encode at call time, and all three live in pg_catalog, which is
-- always searched. Pinning therefore costs nothing and removes the question.
--
-- Note this leaves 11 pre-existing functions with the same finding, including
-- `touch_updated_at`. Those predate this work and are out of scope here.

create or replace function public.evidence_documents_set_url_hash()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.url_hash := encode(sha256(convert_to(new.url, 'UTF8')), 'hex');
  return new;
end;
$$;

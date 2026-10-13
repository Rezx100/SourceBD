-- 0153 — Phone numbers and mailboxes filed inside an address no longer leave the database (13 Oct 2026).
--
-- THE FAULT (ops/plans/data-integrity-audit.md, S1-4)
--   The registers do not keep an address clean: "…, Dhaka, <number> Tel: <mobile>", "…, Bangladesh, Your
--   contact: <name>". Contact details are gated (0145) and the site strips them from every address it
--   draws (lib/contact-text.ts), but that runs in the app. The database handed the text as filed to anyone
--   holding the public key: suppliers.address_raw is readable by anon, and buyer_supplier_profile(),
--   buyer_supplier_facility_panel(), supplier_primary_address() and discover_suppliers() return it or the
--   register entries' addresses. Read on production, 13 Oct 2026: 82 distinct register-entry addresses and
--   3 stored company addresses carry a phone, a mailbox, a web address or a named contact.
--
-- WHAT THIS DOES
--   1. strip_contact_text(text): the database's own rule. It removes an e-mail address (also "x [at] y
--      [dot] com"), a URL or bare domain, a number after a contact label (Tel, Phone, Mob, Fax, …), a
--      Bangladeshi mobile however it is grouped, an international number, a bare run of seven digits or
--      more, and a labelled contact name ("Your contact: …", "Attn: …", "C/O …"). A text with none of
--      these comes back byte for byte. Plots, holdings and postcodes stay ("Plot # 110072", "Dhaka-1000").
--      It is deliberately blunter than the app's rule, which also reads roles and honorifics
--      ("<name>, Proprietor"): the app still runs its own over what this returns.
--   2. The register entries' addresses: every reader goes through v_supplier_addresses_direct, so that
--      name now strips. The view as it was is kept, unchanged, as v_supplier_addresses_filed (the
--      evidence in source_records is not edited), and v_supplier_addresses is re-created on the new one.
--   3. suppliers.address_raw: cleaned once (3 rows on production), and a trigger keeps it clean on every
--      write, whichever script made it.
--
--   A LATER MIGRATION THAT REDEFINES v_supplier_addresses_direct from an older copy would undo point 2.
--   Add a register's branch to v_supplier_addresses_filed instead. supabase/ci/assert-0153.sql runs
--   after every migration and fails if the name stops stripping.
--
--   Read-only trial on production, 13 Oct 2026, over 38,309 address texts: 85 distinct texts change, none
--   is emptied, none still carries a phone, mailbox or web address afterwards, and no text that carries
--   one is left untouched. 2.6 s for all of them (about 70 microseconds a text).
--
-- REVERSE
--   drop trigger if exists trg_suppliers_address_strip_contact on public.suppliers;
--   drop function if exists public.suppliers_strip_address_contact();
--   drop view public.v_supplier_addresses_direct cascade;   -- takes v_supplier_addresses and its summary
--   alter view public.v_supplier_addresses_filed rename to v_supplier_addresses_direct;
--   -- then re-create v_supplier_addresses (below) and v_supplier_address_summary, and
--   drop function public.strip_contact_text(text);
--   The three cleaned company addresses are not restored: the contact details were never meant to be there.

create or replace function public.strip_contact_text(p text)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
declare
  t text := p;
  -- A contact label, whole words only: "Tel", "Tel/Fax", "Mob", "E-mail"; never "Telihati" or "Web Tower".
  one_label constant text := '\m(?:tel|tele|telephone|phone|pho|ph|mobile|mob|cell|fax|hotline|contact|pabx|call|whatsapp|viber|imo|e-?mail|web|website)\M';
  label     constant text := one_label || '(?:[ \t]*/[ \t]*' || one_label || ')*';
  tail      constant text := '(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#-]?[ \t]*';
  -- Between the digits of one mobile number: a space, dot, dash or parenthesis, up to three of them.
  sep       constant text := '[ \t.()–—-]{0,3}';
begin
  if t is null then
    return null;
  end if;
  -- An e-mail address, "info @ abc.com" and "info [at] abc [dot] com" too.
  t := regexp_replace(t, '[\w.+-]+\s*(?:@|[\[(]\s*at\s*[\])])\s*[\w-]+(?:(?:\.|\s*[\[(]\s*dot\s*[\])]\s*)[\w-]+)+', ' ', 'gi');
  -- A URL; whatever follows "Web:", "Email:" or "Skype:" when it holds a dot; a bare domain, but not a
  -- company name that is one ("New Apparel.com Limited").
  t := regexp_replace(t, '\m(?:https?://|www\.)[^\s,;]+', ' ', 'gi');
  t := regexp_replace(t, '\m(?:e-?mail|web|website|skype)\M[ \t]*:[ \t]*[^\s,;]*\.[^\s,;]+', ' ', 'gi');
  t := regexp_replace(t, '\m[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|co|bd|cn|hk|in|uk|de|io|asia|shop|store|online|xyz)(?:\.[a-z]{2})?\M(?!\s+(?:limited|ltd)\M)/?[^\s,;]*', ' ', 'gi');
  -- A labelled contact name, to the next comma. "Attention" needs its colon or dash: "attention to detail" stays.
  t := regexp_replace(t, '(?:\m(?:your contact|contact person)\M[ \t]*:?|\mcontact(?:[ \t]+name)?[ \t]*:|\m(?:attn|attention)\M\.?[ \t]*[:–—-]|\mc/o\M)[^,\n]*', ' ', 'gi');
  -- A number after a contact label, six digits or more: "Tel No: 912 5191", "Mob-017…", "Tel/Fax: (02) 9898989".
  -- "Ph. 12" (a phase) stays.
  t := regexp_replace(t, '(?:' || label || '|\m[TMF]\M(?=[ \t]*:))' || tail || '\+?\(?\d(?:[ \t()/.,-]*\d){5,}', ' ', 'gi');
  -- A Bangladeshi mobile however it is grouped, and an international number.
  t := regexp_replace(t, '(?<![\d+])(?:\+?[ \t]?88' || sep || ')?\(?0' || sep || '1' || sep || '[3-9](?:' || sep || '\d){8}(?!\d)\)?', ' ', 'g');
  t := regexp_replace(t, '\+\d[\d \t()-]{6,}\d', ' ', 'g');
  -- A bare number: seven unbroken digits or more, six from a leading 0, or "018-238019". Never the number
  -- straight after an address label ("Plot # 110072", "Flat 1234567"); postcodes run shorter ("Dhaka-1000").
  t := regexp_replace(t, '(?<!\m(?:plot|holding|house|road|rd|block|sector|sec|flat|apt|reg|khatian|dag|mouza|ward|no)\M\.?[ \t]*[#:-]?[ \t]*)(?<![\w#-])(?:\d{7,}|0\d{5,}|0\d{1,4}-\d{5,8})(?:[ \t]*[-/][ \t]*\d{1,7})?(?![\w])', ' ', 'gi');
  -- Nothing removed: the text as filed, byte for byte.
  if t = p then
    return p;
  end if;
  -- The label left behind once its value is gone ("Web:", "E-mail :"), then the punctuation it leaves.
  t := regexp_replace(t, label || '(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#-][ \t]*(?=$|[,;\n])', ' ', 'gin');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := regexp_replace(t, '\s+([,;])', '\1', 'g');
  t := regexp_replace(t, '([,;])(?:\s*[,;])+', '\1', 'g');
  t := btrim(t, ' ,;:-/');
  return nullif(t, '');
end;
$$;

comment on function public.strip_contact_text(text) is
  '0153: a free text (an address) with the contact details filed inside it removed: e-mail, URL, phone, a '
  'labelled contact name. Unchanged when it carries none. The boundary rule; lib/contact-text.ts is the finer one.';

-- Nothing a client needs to call. The views below are read by owner-run functions; the ETL writes
-- suppliers as service_role, and the trigger function runs as its owner.
revoke all on function public.strip_contact_text(text) from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- The register entries' addresses
-- ----------------------------------------------------------------------

alter view public.v_supplier_addresses_direct rename to v_supplier_addresses_filed;

comment on view public.v_supplier_addresses_filed is
  '0153: each register entry''s address exactly as filed (contact details and all). Not for a buyer: read '
  'v_supplier_addresses_direct, which strips them. A new register''s branch is added here.';

create view public.v_supplier_addresses_direct as
select f.supplier_id,
       f.source_code,
       f.source_tier,
       f.source_ref,
       f.address_kind,
       public.strip_contact_text(f.address) as address,
       f.phone,
       f.email,
       f.fetched_at
  from public.v_supplier_addresses_filed f;

comment on view public.v_supplier_addresses_direct is
  '0153: v_supplier_addresses_filed with the contact details stripped from the address. Every reader uses this one.';

-- A view keeps reading the object it was built on, whatever that is now called: re-create the union
-- so that it reads the stripped one. The text is production''s own, unchanged.
create or replace view public.v_supplier_addresses as
 select v_supplier_addresses_direct.supplier_id,
    v_supplier_addresses_direct.source_code,
    v_supplier_addresses_direct.source_tier,
    v_supplier_addresses_direct.source_ref,
    v_supplier_addresses_direct.address_kind,
    v_supplier_addresses_direct.address,
    v_supplier_addresses_direct.phone,
    v_supplier_addresses_direct.email,
    v_supplier_addresses_direct.fetched_at
   from public.v_supplier_addresses_direct
union all
 select child.id as supplier_id,
    parent_addr.source_code,
    parent_addr.source_tier,
    (parent_addr.source_ref || '#inherited:'::text) || parent.slug as source_ref,
    parent_addr.address_kind || '_inherited'::text as address_kind,
    parent_addr.address,
    null::text as phone,
    null::text as email,
    parent_addr.fetched_at
   from public.suppliers child
     join lateral ( select public.rsc_extension_base_name(child.company_name) as base) bn on true
     join public.suppliers parent on parent.id <> child.id and lower(parent.company_name) = lower(bn.base) and parent.is_published = true
     join public.v_supplier_addresses_direct parent_addr on parent_addr.supplier_id = parent.id
  where bn.base is not null and child.is_published = true;

-- A new view takes the default grants, which hand a client role everything. No client reads these.
revoke all on public.v_supplier_addresses_direct from public, anon, authenticated;
revoke all on public.v_supplier_addresses_filed  from public, anon, authenticated;

-- ----------------------------------------------------------------------
-- The company's own address
-- ----------------------------------------------------------------------

create or replace function public.suppliers_strip_address_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.address_raw := public.strip_contact_text(new.address_raw);
  return new;
end;
$$;

revoke all on function public.suppliers_strip_address_contact() from public, anon, authenticated;

drop trigger if exists trg_suppliers_address_strip_contact on public.suppliers;
create trigger trg_suppliers_address_strip_contact
  before insert or update of address_raw on public.suppliers
  for each row execute function public.suppliers_strip_address_contact();

-- The rows that carry one today. The trigger above does the stripping; the WHERE keeps it to them.
update public.suppliers
   set address_raw = address_raw
 where address_raw is distinct from public.strip_contact_text(address_raw);

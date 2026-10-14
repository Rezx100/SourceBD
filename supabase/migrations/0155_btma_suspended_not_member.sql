-- 0155 — A BTMA entry filed under suspension no longer counts as a BTMA membership in search (14 Oct 2026).
--
-- THE FAULT (ops/plans/data-integrity-audit.md, S1-3)
--   BTMA files some mills under "Mills Under Suspension". Since 0154 the record says so beside the
--   membership, but search still treats the entry as a plain membership: the BTMA filter returns the mill,
--   the card's register tile reads "BTMA", and the match API gives "BTMA" as a reason. Read on production,
--   14 Oct 2026: 86 companies hold a suspended entry, 79 of them published on it alone. BTMA's own list of
--   7 Oct 2026 still files the same mills (ops/plans/data-integrity-audit.md has the comparison).
--
-- WHAT THIS DOES
--   The founder's call, 14 Oct 2026: the 79 stay published, labelled, and stop counting as members.
--   1. v_supplier_registry_ids_direct: `verified` on a BTMA entry is false when BTMA files it under
--      suspension. It was true on every row of every body (BKMEA's own flag is true on all 2,592 today),
--      so nothing else changes. The row itself stays: the record lists the membership with its status.
--   2. The three readers that count a membership read `verified` too: discover_v32_registries() (the
--      card's tile), discover_v32_passes() (the registry filter) and buyer_smart_match() (the match reason).
--
--   Each is edited in place, one line, from the text production holds, never from an older copy in this
--   repo (production's functions have run ahead of the files before: see 0105). Every edit must find its
--   line exactly once or the migration stops with nothing changed.
--
--   The trust score reads its own inputs (etl/scoring/runner.py, same rule) and is rewritten by the next
--   scoring pass. The record page is unchanged.
--
-- REVERSE
--   The same block with each pair's old and new text swapped.

do $$
declare
  e        record;
  def      text;
  old_text text;
begin
  -- 1. The view.
  def := pg_get_viewdef('public.v_supplier_registry_ids_direct'::regclass, true);
  old_text := $o$    true AS verified,
    'https://btmadhaka.com/'::text AS source_url$o$;
  if (length(def) - length(replace(def, old_text, ''))) / length(old_text) <> 1 then
    raise exception '0155: the BTMA branch of v_supplier_registry_ids_direct is not the text expected';
  end if;
  execute 'create or replace view public.v_supplier_registry_ids_direct as ' || replace(def, old_text,
    $n$    COALESCE(lower(btrim(sr.fields ->> 'btma_status'::text)), ''::text) <> 'suspended'::text AS verified,
    'https://btmadhaka.com/'::text AS source_url$n$);

  -- 2. The three readers.
  for e in
    select * from (values
      ('discover_v32_registries',
       $o$and vp.source_code in ('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA', 'EPB', 'RSC');$o$,
       $n$and vp.source_code in ('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA', 'EPB', 'RSC')
     and vp.verified;$n$),
      ('discover_v32_passes',
       $o$and vp.source_code = any (p_registries)$o$,
       $n$and vp.source_code = any (p_registries)
           and vp.verified$n$),
      ('buyer_smart_match',
       $o$and vp.source_code = any(v_registries)$o$,
       $n$and vp.source_code = any(v_registries)
                      and vp.verified$n$)
    ) v(fn, old_text, new_text)
  loop
    if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.fn) <> 1 then
      raise exception '0155: public.% is not one function', e.fn;
    end if;
    def := pg_get_functiondef(('public.' || e.fn)::regproc);
    if (length(def) - length(replace(def, e.old_text, ''))) / length(e.old_text) <> 1 then
      raise exception '0155: % does not hold its line exactly once', e.fn;
    end if;
    execute replace(def, e.old_text, e.new_text);
  end loop;
end $$;

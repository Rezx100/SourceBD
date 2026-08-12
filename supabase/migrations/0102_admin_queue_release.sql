-- 0102 — Review-queue release: decide must mutate buyer-visible data.
--
-- WHY
-- ---
-- /admin/queue Review only closed verification_queue rows (0062). The 1,332
-- open items from May 2026 never reached a buyer-facing destination.
-- Approve/Release now executes a classified action: attach a building to its
-- mother, merge spelling-variant duplicates, move a brand listing onto a
-- published company, publish when Tier 1–3 evidence exists, or close when
-- the company is already live on Discover.
--
-- Reject still closes without mutating. needs_human refuses approve.
--
-- REVERSE
-- -------
-- Restore admin_queue_decide / admin_queue_list from 0062_admin_queue_hub.sql
-- and drop the helpers created here.

create or replace function public._queue_edit_distance(a text, b text)
returns int
language plpgsql
immutable
as $$
declare
  la int := length(a);
  lb int := length(b);
  prev int[];
  cur int[];
  i int;
  j int;
  cost int;
begin
  if a is null or b is null then
    return 99;
  end if;
  if a = b then
    return 0;
  end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cost := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      cur := cur || least(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end;
$$;

create or replace function public._queue_compact_name(p_norm text)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(
           case
             when length(tok) > 4 and right(tok, 1) = 's' then left(tok, length(tok) - 1)
             else tok
           end,
           ''
           order by ord
         ), '')
    from unnest(regexp_split_to_array(
           regexp_replace(
             regexp_replace(lower(btrim(coalesce(p_norm, ''))), '[^a-z0-9\s]+', ' ', 'g'),
             '\s+', ' ', 'g'
           ),
           '\s+'
         ))
         with ordinality as t(tok, ord)
   where tok <> ''
     and tok not in (
       'accessories','accessory','and','bangladesh','bd','co','company',
       'industries','industry','international','limited','ltd','packaging',
       'plc','printing','private','pvt','the'
     );
$$;

create or replace function public._queue_names_same_company(a_norm text, b_norm text)
returns boolean
language plpgsql
immutable
as $$
declare
  ca text := public._queue_compact_name(a_norm);
  cb text := public._queue_compact_name(b_norm);
  dist int;
begin
  if coalesce(a_norm, '') = '' or coalesce(b_norm, '') = '' then
    return false;
  end if;
  if lower(btrim(a_norm)) = lower(btrim(b_norm)) then
    return true;
  end if;
  if (a_norm ~* '\yprinting\y') is distinct from (b_norm ~* '\yprinting\y')
     or (a_norm ~* '\ypackaging\y') is distinct from (b_norm ~* '\ypackaging\y')
     or (a_norm ~* '\ydyeing\y') is distinct from (b_norm ~* '\ydyeing\y')
     or (a_norm ~* '\yspinning\y') is distinct from (b_norm ~* '\yspinning\y')
     or (a_norm ~* '\yweaving\y') is distinct from (b_norm ~* '\yweaving\y')
     or (a_norm ~* '\ywashing\y') is distinct from (b_norm ~* '\ywashing\y')
     or (a_norm ~* '\yknitting\y') is distinct from (b_norm ~* '\yknitting\y')
     or (a_norm ~* '\yembroidery\y') is distinct from (b_norm ~* '\yembroidery\y') then
    return false;
  end if;
  if length(ca) < 10 or length(cb) < 10 then
    return false;
  end if;
  if ca = cb then
    return true;
  end if;
    dist := public._queue_edit_distance(ca, cb);
  if dist > 2 then
    return false;
  end if;
  if left(ca, 6) is distinct from left(cb, 6) then
    return false;
  end if;
  if substring(ca from '\d+$') is distinct from substring(cb from '\d+$') then
    return false;
  end if;
  if dist = 1 then
    return true;
  end if;
  return greatest(length(ca), length(cb)) >= 12
     and abs(length(ca) - length(cb)) <= 1;
end;
$$;

create or replace function public._queue_legal_stem(p_norm text)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(
           case
             when length(tok) > 4 and right(tok, 1) = 's' then left(tok, length(tok) - 1)
             else tok
           end,
           ''
           order by ord
         ), '')
    from unnest(regexp_split_to_array(
           regexp_replace(
             regexp_replace(lower(btrim(coalesce(p_norm, ''))), '[^a-z0-9\s]+', ' ', 'g'),
             '\s+', ' ', 'g'
           ),
           '\s+'
         ))
         with ordinality as t(tok, ord)
   where tok <> ''
     and tok not in (
       'and','bangladesh','bd','co','company','limited','ltd','plc',
       'private','pvt','the'
     );
$$;

-- Ltd/Limited/PLC/Pvt/spacing only. No edit-distance (brand tickets).
create or replace function public._queue_legal_form_variants(a text, b text)
returns boolean
language plpgsql
immutable
as $$
declare
  sa text;
  sb text;
begin
  if coalesce(a, '') = '' or coalesce(b, '') = '' then
    return false;
  end if;
  if lower(btrim(a)) = lower(btrim(b)) then
    return true;
  end if;
  if (a ~* '\yprinting\y') is distinct from (b ~* '\yprinting\y')
     or (a ~* '\ypackaging\y') is distinct from (b ~* '\ypackaging\y')
     or (a ~* '\ydyeing\y') is distinct from (b ~* '\ydyeing\y')
     or (a ~* '\yspinning\y') is distinct from (b ~* '\yspinning\y')
     or (a ~* '\yweaving\y') is distinct from (b ~* '\yweaving\y')
     or (a ~* '\ywashing\y') is distinct from (b ~* '\ywashing\y')
     or (a ~* '\yknitting\y') is distinct from (b ~* '\yknitting\y')
     or (a ~* '\yembroidery\y') is distinct from (b ~* '\yembroidery\y') then
    return false;
  end if;
  sa := public._queue_legal_stem(lower(a));
  sb := public._queue_legal_stem(lower(b));
  return length(sa) >= 10 and sa = sb;
end;
$$;

-- Queue-local building predicate. Must not alter rsc_extension_base_name
-- (IMMUTABLE, indexed by 0055/0056). Ports Python extension_base_name extras
-- so Review treats (U-2) / Unit-II / (Ext) as buildings, not companies.
create or replace function public._queue_is_building_shaped(p_name text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_name, '') <> ''
     and (
       public.rsc_extension_base_name(p_name) is not null
       or p_name ~* '\yunit([\s-]+[0-9]+)?\s*$'
       or p_name ~* '\(\s*[^)]*\y(?:unit|building|shed|extension)\y[^)]*\)'
       or p_name ~* '\(\s*u[\s-]*[0-9]+\s*\)+\.?\s*$'
       or p_name ~* '\s+u[\s-]+[0-9]+\.?\s*$'
       or p_name ~* '-?\s*unit[\s-]+[ivxlcdm]+\.?\s*$'
       or p_name ~* '\(\s*ext\s*\)+\.?\s*$'
       or p_name ~* '\(\s*unit[\s-]*[0-9]+\s*\)+\.?\s*$'
       or p_name ~* '\(\s*factory[\s-]*[0-9]+\s*\)+\.?\s*$'
       or p_name ~* '[-(]\s*annex(?:\s+building)?\s*\)?\.?\s*$'
       or p_name ~* '\(\s*annex(?:\s+building)?\s*\)+\.?\s*$'
       or p_name ~* '\(\s*(?:woven|sw|knit|sewing)\s+unit\s*\)+\.?\s*$'
       or p_name ~* '\s*[-(]?\s*extended\s+buildings?\s*\)?\.?\s*$'
       or p_name ~* '\s*[-(]?\s*new\s+shed\s*\)?\.?\s*$'
       or p_name ~* '\s*\[\s*(?:new\s+)?(?:building|buildings|extension)s?\s*\]+\.?\s*$'
       or p_name ~* '\s+extension\s+buildings?\.?\s*$'
       or p_name ~* '\s*-\s*extension(?:\s+\d+)?\.?\s*$'
       or p_name ~* '\w\.\s*-\s*[0-9]+\s*$'
       or p_name ~* '\s*[-(]?\s*relocated\s*\)?\.?\s*$'
       or p_name ~* '[A-Za-z]New\s+Buildings?\.?\s*$'
     );
$$;

create or replace function public._queue_building_base_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_cur text;
  v_next text;
  v_rsc text;
  v_pat text;
  i int;
begin
  if coalesce(p_name, '') = '' then
    return null;
  end if;
  v_cur := btrim(p_name);
  for i in 1..8 loop
    v_next := v_cur;
    v_rsc := public.rsc_extension_base_name(v_next);
    if v_rsc is not null then
      v_next := v_rsc;
    end if;
    foreach v_pat in array array[
      '\(\s*u[\s-]*[0-9]+\s*\)+\.?\s*$',
      '\s+u[\s-]+[0-9]+\.?\s*$',
      '-?\s*unit[\s-]+[ivxlcdm]+\.?\s*$',
      '\(\s*ext\s*\)+\.?\s*$',
      '\(\s*unit[\s-]*[0-9]+\s*\)+\.?\s*$',
      '\(\s*factory[\s-]*[0-9]+\s*\)+\.?\s*$',
      '[-(]\s*annex(?:\s+building)?\s*\)?\.?\s*$',
      '\(\s*annex(?:\s+building)?\s*\)+\.?\s*$',
      '\(\s*[^)]*\y(?:unit|building|shed|extension)\y[^)]*\)',
      '\(\s*(?:woven|sw|knit|sewing)\s+unit\s*\)+\.?\s*$',
      '\s+extension\s+buildings?\.?\s*$',
      '\s*-\s*extension(?:\s+\d+)?\.?\s*$',
      '\.\s*-\s*[0-9]+\s*$',
      '\s*[-(]?\s*relocated\s*\)?\.?\s*$',
      '\s*[-(]?\s*extended\s+buildings?\s*\)?\.?\s*$',
      '\s*[-(]?\s*new\s+shed\s*\)?\.?\s*$',
      '\s*\[\s*(?:new\s+)?(?:building|buildings|extension)s?\s*\]+\.?\s*$',
      '\s*-?\s*unit[\s-]+[0-9]+(\s*[,-]\s*[0-9]+)*\s*$'
    ] loop
      v_next := btrim(regexp_replace(v_next, v_pat, '', 'i'), ' -,');
    end loop;
    v_next := btrim(regexp_replace(
      v_next,
      '([A-Za-z])New\s+Buildings?\.?\s*$',
      '\1',
      'i'
    ));
    if v_next is not distinct from v_cur or v_next = '' then
      exit;
    end if;
    v_cur := v_next;
  end loop;
  if v_cur is not distinct from btrim(p_name) or v_cur = '' then
    return null;
  end if;
  return v_cur;
end;
$$;

create or replace function public._queue_mother_hits(p_name text)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base text;
begin
  v_base := public._queue_building_base_name(p_name);
  if v_base is null then
    return;
  end if;
  return query
    select s.id
      from public.suppliers s
     where s.is_published
       and s.facility_of is null
       and not public._queue_is_building_shaped(s.company_name)
       and (
         (
           length(public._queue_legal_stem(s.company_name_norm)) >= 10
           and public._queue_legal_stem(s.company_name_norm)
             = public._queue_legal_stem(lower(v_base))
         )
         or public._queue_names_same_company(s.company_name, v_base)
         or (
           length(public._queue_legal_stem(lower(v_base))) >= 6
           and length(public._queue_legal_stem(s.company_name_norm)) >= 6
           and left(
             public._queue_legal_stem(s.company_name_norm),
             length(public._queue_legal_stem(lower(v_base)))
           ) = public._queue_legal_stem(lower(v_base))
           and length(public._queue_legal_stem(s.company_name_norm))
             - length(public._queue_legal_stem(lower(v_base))) between 0 and 2
         )
       );
end;
$$;

create or replace function public._queue_find_mother(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int;
begin
  select count(distinct h), min(h) into v_n, v_id
    from public._queue_mother_hits(p_name) as h;
  if v_n <> 1 then
    return null;
  end if;
  return v_id;
end;
$$;

create or replace function public._queue_unique_mother(p_names text[])
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int;
begin
  select count(distinct h), min(h) into v_n, v_id
    from unnest(coalesce(p_names, '{}'::text[])) as n
    cross join lateral public._queue_mother_hits(n) as h;
  if v_n <> 1 then
    return null;
  end if;
  return v_id;
end;
$$;

create or replace function public._queue_absorb_supplier(p_winner uuid, p_loser uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_winner is null or p_loser is null or p_winner = p_loser then
    return;
  end if;

  update public.source_records sr
     set supplier_id = p_winner
   where sr.supplier_id = p_loser
     and not exists (
       select 1 from public.source_records w
        where w.supplier_id = p_winner
          and w.source_id = sr.source_id
          and w.source_ref is not distinct from sr.source_ref
     );

  update public.certifications c
     set supplier_id = p_winner
   where c.supplier_id = p_loser
     and not exists (
       select 1 from public.certifications w
        where w.supplier_id = p_winner
          and w.kind = c.kind
          and w.certificate_no is not distinct from c.certificate_no
     );

  update public.evidence_claims e
     set supplier_id = p_winner
   where e.supplier_id = p_loser;

  update public.compliance_documents d
     set supplier_id = p_winner
   where d.supplier_id = p_loser
     and not exists (
       select 1 from public.compliance_documents w
        where w.supplier_id = p_winner
          and w.doc_type = d.doc_type
          and w.sha256 = d.sha256
     );

  update public.rsc_remediation r
     set supplier_id = p_winner
   where r.supplier_id = p_loser
     and not exists (
       select 1 from public.rsc_remediation w
        where w.supplier_id = p_winner
     );

  update public.suppliers w
     set source_tags = (
           select coalesce(array(
             select distinct t
               from unnest(coalesce(w.source_tags, '{}'::text[]) || coalesce(l.source_tags, '{}'::text[])) as t
           ), '{}'::text[])
         ),
         updated_at = now()
    from public.suppliers l
   where w.id = p_winner
     and l.id = p_loser;

  update public.suppliers
     set is_published = false,
         updated_at = now()
   where id = p_loser
     and facility_of is null;
end;
$$;

create or replace function public.admin_queue_release_plan(p_queue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  q public.verification_queue%rowtype;
  child public.suppliers%rowtype;
  parent public.suppliers%rowtype;
  cert public.suppliers%rowtype;
  target public.suppliers%rowtype;
  brand public.suppliers%rowtype;
  v_parent_id uuid;
  v_child_id uuid;
  v_cert_id uuid;
  v_target_id uuid;
  v_token text;
  v_group text;
  v_match uuid;
  v_match_n int;
  v_base text;
  v_tier13 int;
  v_cert_rsc boolean;
  v_target_rsc boolean;
  v_cert_tier13 int;
  v_target_tier13 int;
  v_cert_n int;
  v_target_n int;
  v_members jsonb;
begin
  select * into q from public.verification_queue where id = p_queue_id;
  if q.id is null then
    raise exception 'queue row not found' using errcode = 'P0002';
  end if;

  if q.queue_type::text = 'group_parent_review'
     and coalesce(q.source_data->>'rule', '') = 'rsc_extension_rollup_v1' then
    v_parent_id := nullif(q.source_data->>'parent_supplier_id', '')::uuid;
    v_child_id := coalesce(nullif(q.source_data->>'extension_supplier_id', '')::uuid, q.supplier_a_id);
    select * into child from public.suppliers where id = v_child_id;
    select * into parent from public.suppliers where id = v_parent_id;
    if child.facility_of is not null and v_parent_id is not null
       and child.facility_of = v_parent_id then
      return jsonb_build_object(
        'action', 'already_attached',
        'parent_id', v_parent_id,
        'child_id', v_child_id,
        'buyer_destination', 'Already on the mother company Facilities section'
      );
    end if;
    if child.facility_of is not null and v_parent_id is not null
       and child.facility_of is distinct from v_parent_id then
      return jsonb_build_object(
        'action', 'needs_human',
        'parent_id', v_parent_id,
        'child_id', v_child_id,
        'buyer_destination', 'Attached to a different mother than this ticket names'
      );
    end if;
    if parent.id is null or parent.is_published is not true then
      return jsonb_build_object(
        'action', 'needs_human',
        'parent_id', v_parent_id,
        'child_id', v_child_id,
        'buyer_destination', 'Named mother is missing or not visible'
      );
    end if;
    if public._queue_is_building_shaped(parent.company_name) then
      v_match := public._queue_find_mother(parent.company_name);
      if v_match is not null and v_match is distinct from v_child_id then
        return jsonb_build_object(
          'action', 'attach_facility',
          'parent_id', v_match,
          'child_id', v_child_id,
          'member_ids', jsonb_build_array(v_child_id, v_parent_id),
          'buyer_destination', 'Building moves onto the mother company profile'
        );
      end if;
      return jsonb_build_object(
        'action', 'needs_human',
        'parent_id', v_parent_id,
        'child_id', v_child_id,
        'buyer_destination', 'Named mother is itself a building, not the company'
      );
    end if;
    return jsonb_build_object(
      'action', 'attach_facility',
      'parent_id', v_parent_id,
      'child_id', v_child_id,
      'buyer_destination', 'Building moves onto the mother company profile'
    );
  end if;

  if q.queue_type::text = 'group_parent_review'
     and coalesce(q.source_data->>'cluster_token', '') <> '' then
    v_token := lower(q.source_data->>'cluster_token');
    -- Token clusters are not corporate groups. Auto-labelling "euro"
    -- stamped Euro Group onto Euro Centra / D.H. Euro Hi-Tech.
    return jsonb_build_object(
      'action', 'keep_separate',
      'token', v_token,
      'buyer_destination', 'Already visible as separate companies'
    );
  end if;

    if q.queue_type::text = 'fuzzy_match_review' then
    v_cert_id := coalesce(nullif(q.source_data->>'cert_supplier_id', '')::uuid, q.supplier_a_id);
    v_target_id := nullif(q.source_data->>'target_supplier_id', '')::uuid;
    select * into cert from public.suppliers where id = v_cert_id;
    select * into target from public.suppliers where id = v_target_id;
    if cert.id is null or target.id is null then
      return jsonb_build_object(
        'action', 'needs_human',
        'winner_id', v_target_id,
        'loser_id', v_cert_id,
        'buyer_destination', 'One side of this pair is missing'
      );
    end if;
    select exists(select 1 from public.rsc_remediation r where r.supplier_id = v_cert_id)
      into v_cert_rsc;
    select exists(select 1 from public.rsc_remediation r where r.supplier_id = v_target_id)
      into v_target_rsc;
    if cert.facility_of is not null or target.facility_of is not null then
      return jsonb_build_object(
        'action', 'keep_separate',
        'winner_id', v_target_id,
        'loser_id', v_cert_id,
        'buyer_destination', 'Facility rows stay on the mother, not merged'
      );
    end if;
    if v_cert_rsc and v_target_rsc then
      return jsonb_build_object(
        'action', 'keep_separate',
        'winner_id', v_target_id,
        'loser_id', v_cert_id,
        'buyer_destination', 'Two RSC-inspected buildings stay two profiles'
      );
    end if;
    if public._queue_is_building_shaped(cert.company_name)
       or public._queue_is_building_shaped(target.company_name) then
      v_match := public._queue_unique_mother(
        array[cert.company_name, target.company_name]
      );
      if v_match is not null then
        select coalesce(jsonb_agg(x.id order by x.ord), '[]'::jsonb)
          into v_members
          from (
            select v_cert_id as id, cert.company_name as n, 1 as ord
            union all
            select v_target_id, target.company_name, 2
          ) x
         where x.id is distinct from v_match
           and public._queue_is_building_shaped(x.n);
        if jsonb_array_length(v_members) = 0 then
          return jsonb_build_object(
            'action', 'needs_human',
            'winner_id', v_target_id,
            'loser_id', v_cert_id,
            'buyer_destination', 'Building-shaped names need a register mother'
          );
        end if;
        return jsonb_build_object(
          'action', 'attach_facility',
          'parent_id', v_match,
          'child_id', (v_members->>0)::uuid,
          'member_ids', v_members,
          'buyer_destination', 'Building moves onto the mother company profile'
        );
      end if;
      return jsonb_build_object(
        'action', 'needs_human',
        'winner_id', v_target_id,
        'loser_id', v_cert_id,
        'buyer_destination', 'Building-shaped names need a register mother'
      );
    end if;
    if public._queue_names_same_company(cert.company_name, target.company_name)
       or public._queue_names_same_company(cert.company_name_norm, target.company_name_norm) then
      select count(distinct sr.source_id), count(*) into v_cert_tier13, v_cert_n
        from public.source_records sr
       where sr.supplier_id = v_cert_id
         and sr.status = 'active'
         and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert');
      select count(distinct sr.source_id), count(*) into v_target_tier13, v_target_n
        from public.source_records sr
       where sr.supplier_id = v_target_id
         and sr.status = 'active'
         and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert');
      if v_cert_tier13 > v_target_tier13
         or (v_cert_tier13 = v_target_tier13 and v_cert_n > v_target_n)
         or (
           v_cert_tier13 = v_target_tier13
           and v_cert_n = v_target_n
           and length(cert.company_name) > length(target.company_name)
         )
         or (
           v_cert_tier13 = v_target_tier13
           and v_cert_n = v_target_n
           and length(cert.company_name) = length(target.company_name)
         ) then
        return jsonb_build_object(
          'action', 'merge_into',
          'winner_id', v_cert_id,
          'loser_id', v_target_id,
          'buyer_destination', 'One company profile; cert evidence moves onto the register row'
        );
      end if;
      return jsonb_build_object(
        'action', 'merge_into',
        'winner_id', v_target_id,
        'loser_id', v_cert_id,
        'buyer_destination', 'One company profile; cert evidence moves onto the register row'
      );
    end if;
    return jsonb_build_object(
      'action', 'keep_separate',
      'winner_id', v_target_id,
      'loser_id', v_cert_id,
      'buyer_destination', 'Two different companies; both stay on Discover'
    );
  end if;

  if q.queue_type::text = 'brand_disclosure_match_review' then
    select * into brand from public.suppliers where id = q.supplier_a_id;
    if brand.facility_of is not null then
      return jsonb_build_object(
        'action', 'already_attached',
        'parent_id', brand.facility_of,
        'child_id', brand.id,
        'buyer_destination', 'Brand listing already sits on the mother Facilities section'
      );
    end if;
    if brand.is_published then
      return jsonb_build_object(
        'action', 'keep_separate',
        'winner_id', brand.id,
        'buyer_destination', 'Already visible to buyers'
      );
    end if;
    select count(*) into v_tier13
      from public.source_records sr
     where sr.supplier_id = brand.id
       and sr.status = 'active'
       and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert');
    if v_tier13 >= 1 then
      return jsonb_build_object(
        'action', 'publish',
        'winner_id', brand.id,
        'buyer_destination', 'Publish as its own company — register evidence exists'
      );
    end if;

    if not public._queue_is_building_shaped(brand.company_name) then
      select count(*) into v_match_n
        from public.suppliers s
       where s.id is distinct from brand.id
         and s.is_published
         and s.facility_of is null
         and not public._queue_is_building_shaped(s.company_name)
         and (
           s.company_name_norm = brand.company_name_norm
           or public._queue_legal_form_variants(s.company_name, brand.company_name)
         );
      if v_match_n = 1 then
        select s.id into v_match
          from public.suppliers s
         where s.id is distinct from brand.id
           and s.is_published
           and s.facility_of is null
           and not public._queue_is_building_shaped(s.company_name)
           and (
             s.company_name_norm = brand.company_name_norm
             or public._queue_legal_form_variants(s.company_name, brand.company_name)
           );
        return jsonb_build_object(
          'action', 'attach_brand',
          'winner_id', v_match,
          'loser_id', brand.id,
          'buyer_destination', 'Brand listing moves onto the existing published company'
        );
      end if;
      if v_match_n > 1 then
        return jsonb_build_object(
          'action', 'needs_human',
          'loser_id', brand.id,
          'buyer_destination', 'More than one published company could own this listing'
        );
      end if;
    end if;

    if public._queue_is_building_shaped(brand.company_name) then
      v_base := public._queue_building_base_name(brand.company_name);
      if v_base is not null then
        select count(*) into v_match_n
          from public.suppliers s
         where s.is_published
           and s.facility_of is null
           and s.id is distinct from brand.id
           and not public._queue_is_building_shaped(s.company_name)
           and public._queue_legal_form_variants(s.company_name, v_base);
        if v_match_n = 1 then
          select s.id into v_match
            from public.suppliers s
           where s.is_published
             and s.facility_of is null
             and s.id is distinct from brand.id
             and not public._queue_is_building_shaped(s.company_name)
             and public._queue_legal_form_variants(s.company_name, v_base);
          return jsonb_build_object(
            'action', 'attach_facility',
            'parent_id', v_match,
            'child_id', brand.id,
            'buyer_destination', 'Unit/building attaches to the published mother'
          );
        end if;
      end if;
    end if;

    return jsonb_build_object(
      'action', 'needs_human',
      'loser_id', brand.id,
      'buyer_destination', 'Stays hidden — brand list only, no Bangladesh register'
    );
  end if;

  return jsonb_build_object(
    'action', 'needs_human',
    'buyer_destination', 'Unknown queue type'
  );
end;
$$;

create or replace function public.admin_queue_decide(
  p_queue_id uuid,
  p_decision text,
  p_note     text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid      uuid := auth.uid();
  v_role     text;
  v_decision text := lower(coalesce(nullif(btrim(p_decision), ''), ''));
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue    public.verification_queue%rowtype;
  v_plan     jsonb;
  v_action   text;
  v_admin    public.queue_action;
  v_parent   uuid;
  v_child    uuid;
  v_winner   uuid;
  v_loser    uuid;
  v_group    text;
  v_token    text;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if p_queue_id is null then
    raise exception 'queue_id required' using errcode = '22023';
  end if;
  if v_decision not in ('approve', 'release', 'reject', 'escalate') then
    raise exception 'decision must be approve|release|reject|escalate' using errcode = '22023';
  end if;
  if v_decision = 'release' then
    v_decision := 'approve';
  end if;

  select *
    into v_queue
    from public.verification_queue
   where id = p_queue_id
   for update;

  if v_queue.id is null then
    raise exception 'queue row not found' using errcode = 'P0002';
  end if;
  if v_queue.reviewed_at is not null then
    raise exception 'queue row already decided' using errcode = 'P0002';
  end if;
  if v_queue.queue_type::text in ('cert_doc_review', 'sanctions_hit') then
    raise exception 'use the dedicated % decision flow', v_queue.queue_type::text
      using errcode = '22023';
  end if;

  v_plan := public.admin_queue_release_plan(p_queue_id);
  v_action := v_plan->>'action';

  if v_decision = 'approve' then
    if v_action = 'needs_human' then
      raise exception 'queue row needs a human destination: %', v_plan->>'buyer_destination'
        using errcode = '22023';
    end if;

    if v_action = 'attach_facility' then
      v_parent := nullif(v_plan->>'parent_id', '')::uuid;
      v_child := nullif(v_plan->>'child_id', '')::uuid;
      if v_parent is null or v_child is null then
        raise exception 'attach_facility missing parent/child' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.suppliers p
         where p.id = v_parent
           and (
             p.facility_of is not null
             or public._queue_is_building_shaped(p.company_name)
           )
      ) then
        raise exception 'refuse nested facility' using errcode = '22023';
      end if;
      update public.suppliers
         set facility_of = v_parent,
             updated_at = now()
       where id is distinct from v_parent
         and id in (
           select v_child
           union
           select nullif(x, '')::uuid
             from jsonb_array_elements_text(coalesce(v_plan->'member_ids', '[]'::jsonb)) as t(x)
            where nullif(x, '') is not null
         );
      v_admin := 'approve';
    elsif v_action = 'merge_into' then
      v_winner := nullif(v_plan->>'winner_id', '')::uuid;
      v_loser := nullif(v_plan->>'loser_id', '')::uuid;
      perform public._queue_absorb_supplier(v_winner, v_loser);
      v_admin := 'merge';
    elsif v_action = 'attach_brand' then
      v_winner := nullif(v_plan->>'winner_id', '')::uuid;
      v_loser := nullif(v_plan->>'loser_id', '')::uuid;
      perform public._queue_absorb_supplier(v_winner, v_loser);
      v_admin := 'approve';
    elsif v_action = 'publish' then
      v_winner := nullif(v_plan->>'winner_id', '')::uuid;
      update public.suppliers
         set is_published = true,
             updated_at = now()
       where id = v_winner
         and facility_of is null;
      v_admin := 'approve';
    else
      -- already_attached / keep_separate: destination is already live.
      v_admin := 'approve';
    end if;
  else
    v_admin := v_decision::public.queue_action;
  end if;

  update public.verification_queue
     set reviewed_at  = now(),
         reviewed_by  = v_uid,
         admin_action = v_admin
   where id = p_queue_id;

  insert into public.admin_audit_log (actor_id, action, target_table, target_id, patch, metadata)
  values (
    v_uid,
    'admin_queue_decide',
    'verification_queue',
    p_queue_id,
    jsonb_build_object(
      'decision', v_decision,
      'note', v_note,
      'release_action', v_action,
      'plan', v_plan
    ),
    jsonb_build_object(
      'queue_type', v_queue.queue_type::text,
      'supplier_id', v_queue.supplier_a_id,
      'supplier_b_name', v_queue.supplier_b_name
    )
  );

  return jsonb_build_object(
    'ok', true,
    'queue_id', p_queue_id,
    'queue_type', v_queue.queue_type::text,
    'decision', v_decision,
    'release_action', v_action,
    'buyer_destination', v_plan->>'buyer_destination',
    'plan', v_plan
  );
end;
$$;

comment on function public.admin_queue_decide(uuid, text, text) is
  'Admin-only verification queue decision. Approve/release executes the '
  'classified buyer-facing mutation (attach facility, merge spelling variants, '
  'move brand listings, publish when Tier 1-3 exists, or close when already '
  'live). Reject/escalate close the ticket without mutating suppliers.';

create or replace function public.admin_queue_list(
  p_type   text default null,
  p_status text default 'open',
  p_limit  int  default 50,
  p_offset int  default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_type   text := nullif(btrim(coalesce(p_type, '')), '');
  v_status text := lower(coalesce(nullif(btrim(p_status), ''), 'open'));
  v_limit  int  := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset int  := greatest(0, coalesce(p_offset, 0));
  v_out    jsonb;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'admin only';
  end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role <> 'admin' then
    raise insufficient_privilege using message = 'admin only';
  end if;
  if v_status not in ('open', 'reviewed', 'all') then
    raise exception 'status must be open|reviewed|all' using errcode = '22023';
  end if;
  if v_type is not null and not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = 'queue_type'
       and e.enumlabel = v_type
  ) then
    raise exception 'unknown queue_type %', v_type using errcode = '22023';
  end if;

  with open_by_type as (
    select q.queue_type::text as queue_type, count(*)::bigint as n
      from public.verification_queue q
     where q.reviewed_at is null
     group by q.queue_type
  ),
  filtered as (
    select
      q.id,
      q.queue_type::text as queue_type,
      q.supplier_a_id,
      q.supplier_b_name,
      q.confidence,
      q.source_data,
      q.admin_action::text as admin_action,
      q.reviewed_at,
      q.reviewed_by,
      q.created_at,
      s.slug,
      s.company_name,
      s.name_display,
      s.entity_type::text as entity_type,
      s.city,
      s.district,
      s.is_published as published,
      (
        select count(distinct sr.source_id)::int
          from public.source_records sr
         where sr.supplier_id = s.id
           and sr.source_tier in ('tier1_gov', 'tier2_industry', 'tier3_cert')
           and sr.status = 'active'
      ) as tier_coverage
    from public.verification_queue q
    left join public.suppliers s on s.id = q.supplier_a_id
   where (v_type is null or q.queue_type::text = v_type)
     and (
       v_status = 'all'
       or (v_status = 'open' and q.reviewed_at is null)
       or (v_status = 'reviewed' and q.reviewed_at is not null)
     )
  ),
  page as (
    select *
      from filtered
     order by created_at desc
     limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'by_type', coalesce((
      select jsonb_object_agg(queue_type, n order by queue_type)
        from open_by_type
    ), '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'queue_id',        p.id,
        'queue_type',      p.queue_type,
        'supplier_b_name', p.supplier_b_name,
        'confidence',      p.confidence,
        'source_data',     p.source_data,
        'admin_action',    p.admin_action,
        'reviewed_at',     p.reviewed_at,
        'reviewed_by',     p.reviewed_by,
        'created_at',      p.created_at,
        'release_action',  (x.plan->>'action'),
        'buyer_destination', (x.plan->>'buyer_destination'),
        'supplier', case when p.supplier_a_id is null then null else jsonb_build_object(
          'id',            p.supplier_a_id,
          'slug',          p.slug,
          'company_name',  p.company_name,
          'name_display',  p.name_display,
          'entity_type',   p.entity_type,
          'city',          p.city,
          'district',      p.district,
          'published',     p.published,
          'tier_coverage', p.tier_coverage
        ) end
      ) order by p.created_at desc)
      from page p
      cross join lateral (
        select public.admin_queue_release_plan(p.id) as plan
      ) x
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public._queue_edit_distance(text, text) from public;
revoke all on function public._queue_compact_name(text) from public;
revoke all on function public._queue_names_same_company(text, text) from public;
revoke all on function public._queue_legal_stem(text) from public;
revoke all on function public._queue_legal_form_variants(text, text) from public;
revoke all on function public._queue_is_building_shaped(text) from public;
revoke all on function public._queue_building_base_name(text) from public;
revoke all on function public._queue_mother_hits(text) from public;
revoke all on function public._queue_find_mother(text) from public;
revoke all on function public._queue_unique_mother(text[]) from public;
revoke all on function public._queue_absorb_supplier(uuid, uuid) from public;
revoke all on function public.admin_queue_release_plan(uuid) from public;
grant execute on function public.admin_queue_decide(uuid, text, text) to authenticated;
grant execute on function public.admin_queue_list(text, text, int, int) to authenticated;

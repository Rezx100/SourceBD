-- 0121 — review-queue decisions for records the ETL held instead of creating.
-- Spec: context/feature-specs/spec-etl-freshness.md §8.3 C2.
--
-- WHY
-- ---
-- A scheduled read must never mint a company on a near-match. From this
-- release the ETL holds such a record as a `fuzzy_match_review` row with
-- `source_data.rule = 'etl_hold_v1'` (etl/core/hold.py) instead of creating
-- it. The existing release plan reads `fuzzy_match_review` rows as two
-- existing suppliers to merge; a held record has only one, so "Release" would
-- stop at needs_human. This teaches the plan the new rule:
--   * Release = the same company. The plan answers `held_same`; the decide
--     function's existing fall-through marks the row approved. The ETL
--     replays the record onto that company within a minute.
--   * Reject = a different company. The ETL creates it and writes a
--     never-same ruling to resolution_edges, so the pair is never asked again.
-- Nothing else about the queue changes: the live plan function is renamed and
-- called unchanged for every other row.
--
-- Also: an index for the ETL's per-record "is this record already held?"
-- lookup.
--
-- Deploy order: code before migration is safe. Until this is applied, Release
-- on a held row stops at needs_human (nothing moves) and Reject works.
--
-- REVERSE
-- -------
--   drop index if exists public.idx_vq_etl_hold_record;
--   drop function if exists public.admin_queue_release_plan(uuid);
--   alter function public._admin_queue_release_plan_0102(uuid)
--     rename to admin_queue_release_plan;
--   revoke all on function public.admin_queue_release_plan(uuid)
--     from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public._admin_queue_release_plan_0102(uuid)') is null then
    alter function public.admin_queue_release_plan(uuid)
      rename to _admin_queue_release_plan_0102;
  end if;
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
  v_rule    text;
  v_target  uuid;
  v_name    text;
begin
  select q.source_data ->> 'rule', s.id, coalesce(s.name_display, s.company_name)
    into v_rule, v_target, v_name
    from public.verification_queue q
    left join public.suppliers s on s.id = q.supplier_a_id
   where q.id = p_queue_id;

  if v_rule = 'etl_hold_v1' then
    if v_target is null then
      return jsonb_build_object(
        'action', 'needs_human',
        'buyer_destination',
        'The company this was held against no longer exists. Reject to add it as a new company.'
      );
    end if;
    return jsonb_build_object(
      'action', 'held_same',
      'winner_id', v_target,
      'buyer_destination',
      format('Release if this is %s: the record joins that company. '
             'Reject if it is a different company: it is added as a new one.', v_name)
    );
  end if;

  return public._admin_queue_release_plan_0102(p_queue_id);
end;
$$;

revoke all on function public._admin_queue_release_plan_0102(uuid) from public, anon, authenticated;
revoke all on function public.admin_queue_release_plan(uuid) from public, anon, authenticated;

create index if not exists idx_vq_etl_hold_record
  on public.verification_queue ((source_data ->> 'source_code'), (source_data ->> 'source_ref'))
  where source_data ->> 'rule' = 'etl_hold_v1';

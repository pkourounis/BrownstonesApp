-- =============================================================================
-- 0048_time_off_rules.sql
-- Time-off request rules:
--   * reason is required
--   * blackout days (time_off_blackouts) can't be requested off
--   * at most 2 approved time-off per day, per location
-- Enforced in SECURITY DEFINER functions because employees can't see each
-- other's requests under RLS (needed to count the per-day cap).
-- =============================================================================

create or replace function public.request_time_off(p_start date, p_end date, p_reason text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_loc uuid; v_day date; v_cnt int;
begin
  if v_uid is null then return 'Not signed in.'; end if;
  if coalesce(trim(p_reason), '') = '' then return 'Please add a reason for your time off.'; end if;
  if p_start is null or p_end is null then return 'Pick start and end dates.'; end if;
  if p_end < p_start then return 'The end date is before the start date.'; end if;

  select primary_location_id into v_loc from public.profiles where id = v_uid;

  if v_loc is not null and exists (
    select 1 from public.time_off_blackouts b
    where b.location_id = v_loc and b.start_date <= p_end and b.end_date >= p_start
  ) then
    return 'One or more of those days are blocked for time off. Pick different dates.';
  end if;

  if v_loc is not null then
    v_day := p_start;
    while v_day <= p_end loop
      select count(distinct t.profile_id) into v_cnt
      from public.time_off_requests t
      join public.profiles p on p.id = t.profile_id
      where t.status = 'approved' and p.primary_location_id = v_loc
        and t.start_date <= v_day and t.end_date >= v_day;
      if v_cnt >= 2 then
        return 'That day already has the maximum time off approved (2). Please pick another day.';
      end if;
      v_day := v_day + 1;
    end loop;
  end if;

  insert into public.time_off_requests (profile_id, start_date, end_date, reason, status)
  values (v_uid, p_start, p_end, trim(p_reason), 'pending');
  return null;
end;
$$;

create or replace function public.set_timeoff_status(p_id uuid, p_approve boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_prof uuid; v_start date; v_end date; v_loc uuid; v_day date; v_cnt int;
begin
  if not public.is_manager_or_admin() then return 'Not authorized.'; end if;
  select profile_id, start_date, end_date into v_prof, v_start, v_end from public.time_off_requests where id = p_id;
  if v_prof is null then return 'Request not found.'; end if;
  if not (public.is_super_admin() or public.shares_location(v_prof)) then return 'Not authorized for this request.'; end if;

  if p_approve then
    select primary_location_id into v_loc from public.profiles where id = v_prof;
    if v_loc is not null then
      v_day := v_start;
      while v_day <= v_end loop
        select count(distinct t.profile_id) into v_cnt
        from public.time_off_requests t
        join public.profiles p on p.id = t.profile_id
        where t.status = 'approved' and t.id <> p_id and p.primary_location_id = v_loc
          and t.start_date <= v_day and t.end_date >= v_day;
        if v_cnt >= 2 then
          return 'That day already has 2 people approved for time off — can''t approve a third.';
        end if;
        v_day := v_day + 1;
      end loop;
    end if;
  end if;

  update public.time_off_requests
    set status = (case when p_approve then 'approved' else 'denied' end)::public.request_status,
        reviewed_by = v_uid, reviewed_at = now()
  where id = p_id;
  return null;
end;
$$;

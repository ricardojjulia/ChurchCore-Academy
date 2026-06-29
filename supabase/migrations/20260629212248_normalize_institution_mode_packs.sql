-- Normalize legacy institution mode storage after ADR 0060.
--
-- `mixed` is now a derived multi-mode summary, not a selectable mode.
-- Keep the existing columns for compatibility while ensuring stored selected
-- modes are concrete and primary_mode points at a concrete default branch.
with normalized_profiles as (
  select
    profile.tenant_id,
    coalesce(
      (
        select jsonb_agg(mode_value order by mode_order)
          from jsonb_array_elements_text(profile.supported_modes) with ordinality as selected(mode_value, mode_order)
         where mode_value <> 'mixed'
      ),
      '["college"]'::jsonb
    ) as concrete_supported_modes
    from public.academy_institution_profiles profile
)
update public.academy_institution_profiles profile
   set supported_modes = normalized.concrete_supported_modes,
       primary_mode = case
         when profile.primary_mode = 'mixed' then normalized.concrete_supported_modes ->> 0
         when exists (
           select 1
             from jsonb_array_elements_text(normalized.concrete_supported_modes) as selected(mode_value)
            where selected.mode_value = profile.primary_mode
         ) then profile.primary_mode
         else normalized.concrete_supported_modes ->> 0
       end,
       updated_at = profile.updated_at
  from normalized_profiles normalized
 where normalized.tenant_id = profile.tenant_id
   and (
     profile.primary_mode = 'mixed'
     or profile.supported_modes ? 'mixed'
     or not exists (
       select 1
         from jsonb_array_elements_text(normalized.concrete_supported_modes) as selected(mode_value)
        where selected.mode_value = profile.primary_mode
     )
   );

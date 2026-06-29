-- ================================================================
-- ASSIGNMENTS PER-ASSIGNMENT GRADING -- ADR-0054
-- ChurchCore Academy | Sprint A-4
--
-- Adds faculty assignment creation and per-assignment grade entry
-- with weighted grade computation advisory model.
--
-- SECURITY LEAD MANDATE:
-- service_role bypasses all RLS policies below. Any server process
-- using service_role must perform manual authorization checks.
-- Never expose the service_role key client-side.
-- ================================================================

-- Add new columns to academy_gradebook_assignments per ADR-0054
alter table public.academy_gradebook_assignments
  add column if not exists locked boolean not null default false,
  add column if not exists grading_type text not null default 'points'
    check (grading_type in ('points', 'pass_fail', 'rubric'));

comment on column public.academy_gradebook_assignments.locked is
  'ADR-0054: Set to true once first submission exists. Prevents max_points and weight changes.';

comment on column public.academy_gradebook_assignments.grading_type is
  'ADR-0054: Determines how assignment is graded - points, pass/fail, or rubric.';

alter table public.academy_gradebook_assignments
  alter column weight type integer using (
    case
      when weight <= 1.0 then round(weight * 100)::integer
      else round(weight)::integer
    end
  ),
  add constraint weight_range check (weight >= 0 and weight <= 100);

comment on column public.academy_gradebook_assignments.weight is
  'ADR-0054: Integer percentage (0-100). All assignment weights in a section must sum to ≤ 100.';

-- Add assignment submission grading columns per ADR-0054
alter table public.academy_gradebook_submissions
  add column if not exists grade_points numeric(8,2),
  add column if not exists pass_fail_result text
    check (pass_fail_result in ('pass', 'fail')),
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by text;

-- Add foreign key for graded_by
alter table public.academy_gradebook_submissions
  add constraint fk_submissions_graded_by
    foreign key (tenant_id, graded_by)
    references public.academy_people (tenant_id, id) on delete restrict;

comment on column public.academy_gradebook_submissions.grade_points is
  'ADR-0054: Nullable decimal - null means not yet graded.';

comment on column public.academy_gradebook_submissions.pass_fail_result is
  'ADR-0054: For pass/fail assignments - pass, fail, or null if not graded.';

comment on column public.academy_gradebook_submissions.graded_at is
  'ADR-0054: Timestamp when grade was entered by faculty.';

comment on column public.academy_gradebook_submissions.graded_by is
  'ADR-0054: Person ID of faculty member who graded.';

-- Create index for section assignment weight validation queries
create index if not exists idx_gradebook_assignments_section_weight
  on public.academy_gradebook_assignments (tenant_id, section_id, weight)
  where section_id is not null;

-- Create index for submission grade queries
create index if not exists idx_gradebook_submissions_graded
  on public.academy_gradebook_submissions (tenant_id, assignment_id, learner_person_id)
  where grade_points is not null or pass_fail_result is not null;

-- RLS policies remain unchanged - tenant isolation enforced by existing policies
-- Faculty authorization must be verified at service layer per ADR-0054

-- Add trigger to set locked flag when first submission is graded
create or replace function public.lock_assignment_on_first_grade()
returns trigger as $$
begin
  -- Only proceed if a grade is being set (not null)
  if (new.grade_points is not null or new.pass_fail_result is not null) then
    -- Lock the assignment
    update public.academy_gradebook_assignments
    set locked = true
    where tenant_id = new.tenant_id
      and id = new.assignment_id
      and not locked;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_lock_assignment_on_first_grade
  after insert or update on public.academy_gradebook_submissions
  for each row
  execute function public.lock_assignment_on_first_grade();

comment on function public.lock_assignment_on_first_grade is
  'ADR-0054: Automatically locks assignment when first grade is entered to prevent max_points/weight changes.';

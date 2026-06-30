
-- Lock the `plan` column on profiles to service_role only.
-- Authenticated users can no longer write to plan via INSERT or UPDATE.

REVOKE UPDATE (plan) ON public.profiles FROM authenticated, anon, PUBLIC;
REVOKE INSERT (plan) ON public.profiles FROM authenticated, anon, PUBLIC;

-- Re-grant column-level INSERT/UPDATE on all non-plan columns to authenticated
-- so the existing RLS policies remain functional.
GRANT INSERT (id, email, full_name, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (email, full_name, avatar_url, updated_at) ON public.profiles TO authenticated;

-- service_role keeps full access (it already bypasses column grants via GRANT ALL).
GRANT ALL ON public.profiles TO service_role;

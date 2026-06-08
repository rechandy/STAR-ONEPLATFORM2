-- ============================================================================
-- Row-Level Security (RLS) for STAR OnePlatform multi-tenancy
-- ----------------------------------------------------------------------------
-- Prisma does not manage RLS, so apply this AFTER `prisma migrate`/`db push`:
--   psql "$DATABASE_URL" -f prisma/rls.sql
--
-- The application must set the tenant on each connection/transaction:
--   SET app.current_tenant = '<tenantId>';        -- or SET LOCAL inside a tx
--
-- Every policy restricts rows to the active tenant. The Prisma migration role
-- typically owns the tables and bypasses RLS; create a separate, non-owner
-- "app" role for runtime so policies are enforced (owners are exempt unless
-- FORCE ROW LEVEL SECURITY is set, which we enable below).
-- ============================================================================

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'org', 'academic_session', 'app_user', 'user_identifier', 'org_membership',
    'course', 'class', 'enrollment', 'student_profile', 'iep_goal',
    'curriculum_objective', 'goal_progress', 'metric_event', 'certification',
    'media_engagement'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_setting('app.current_tenant', true))
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true));
    $f$, t);
  END LOOP;
END $$;

-- Example runtime role (grant least privilege; do NOT make it table owner):
--   CREATE ROLE oneplatform_app LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oneplatform_app;
--   GRANT USAGE ON SCHEMA public TO oneplatform_app;

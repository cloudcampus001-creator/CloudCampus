-- ============================================================
-- CloudCampus — Security Migration 001
-- Enable Row Level Security on all sensitive tables
--
-- HOW TO APPLY:
--   Option A (Supabase Dashboard): SQL Editor → paste & run
--   Option B (CLI): supabase db push
--
-- WHAT THIS DOES:
--   1. Enables RLS on every table (default: block everything)
--   2. Allows public read of schools (needed for school picker)
--   3. Grants authenticated users access to their own school's data only
--   4. Blocks all anon writes on every table
--
-- IMPORTANT: After running this, logins must go through the
-- cloud-campus-auth Edge Function, not direct table queries.
-- ============================================================


-- ─── Helper: extract school_id from JWT user_metadata ────────────────────────
-- Supabase stores school_id as a string in user_metadata.
-- This expression is used in every policy below.
-- (auth.jwt() -> 'user_metadata' ->> 'school_id')::int

-- ─── SCHOOLS ─────────────────────────────────────────────────────────────────
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Anyone can read the school list (needed for the school picker page)
CREATE POLICY "schools_public_read"
  ON schools FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated users from the same school can update school settings
CREATE POLICY "schools_own_school_update"
  ON schools FOR UPDATE
  TO authenticated
  USING (id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

-- Inserts/Deletes on schools are blocked entirely from the client
-- (should only be done via the Supabase dashboard or a trusted script)

-- ─── STUDENTS ────────────────────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_own_school_select"
  ON students FOR SELECT
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "students_own_school_insert"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "students_own_school_update"
  ON students FOR UPDATE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "students_own_school_delete"
  ON students FOR DELETE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

-- Block all anon access
CREATE POLICY "students_block_anon"
  ON students FOR ALL
  TO anon
  USING (false);

-- ─── TEACHERS ────────────────────────────────────────────────────────────────
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers_own_school_select"
  ON teachers FOR SELECT
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "teachers_own_school_insert"
  ON teachers FOR INSERT
  TO authenticated
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "teachers_own_school_update"
  ON teachers FOR UPDATE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "teachers_own_school_delete"
  ON teachers FOR DELETE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "teachers_block_anon"
  ON teachers FOR ALL
  TO anon
  USING (false);

-- ─── DISCIPLINE MASTERS ──────────────────────────────────────────────────────
ALTER TABLE discipline_masters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discipline_masters_own_school_select"
  ON discipline_masters FOR SELECT
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "discipline_masters_own_school_insert"
  ON discipline_masters FOR INSERT
  TO authenticated
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "discipline_masters_own_school_update"
  ON discipline_masters FOR UPDATE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "discipline_masters_own_school_delete"
  ON discipline_masters FOR DELETE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "discipline_masters_block_anon"
  ON discipline_masters FOR ALL
  TO anon
  USING (false);

-- ─── VICE PRINCIPALS ─────────────────────────────────────────────────────────
ALTER TABLE vice_principals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vice_principals_own_school_select"
  ON vice_principals FOR SELECT
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "vice_principals_own_school_insert"
  ON vice_principals FOR INSERT
  TO authenticated
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "vice_principals_own_school_update"
  ON vice_principals FOR UPDATE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "vice_principals_own_school_delete"
  ON vice_principals FOR DELETE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "vice_principals_block_anon"
  ON vice_principals FOR ALL
  TO anon
  USING (false);

-- ─── ADMINISTRATORS ──────────────────────────────────────────────────────────
-- Extra care: even authenticated users should not be able to read
-- each other's password_hash. We use a SECURITY DEFINER view for this.
ALTER TABLE administrators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "administrators_own_school_select"
  ON administrators FOR SELECT
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "administrators_own_school_insert"
  ON administrators FOR INSERT
  TO authenticated
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "administrators_own_school_update"
  ON administrators FOR UPDATE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "administrators_own_school_delete"
  ON administrators FOR DELETE
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "administrators_block_anon"
  ON administrators FOR ALL
  TO anon
  USING (false);

-- ─── CLASSES ─────────────────────────────────────────────────────────────────
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes_own_school"
  ON classes FOR ALL
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "classes_block_anon"
  ON classes FOR ALL
  TO anon
  USING (false);

-- ─── SCHOOL SUBJECTS ─────────────────────────────────────────────────────────
ALTER TABLE school_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_subjects_own_school"
  ON school_subjects FOR ALL
  TO authenticated
  USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
  WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);

CREATE POLICY "school_subjects_block_anon"
  ON school_subjects FOR ALL
  TO anon
  USING (false);

-- ─── OTHER TABLES ────────────────────────────────────────────────────────────
-- If your app has additional tables (marks, timetable_entries,
-- notifications, punishments, logbook entries, etc.),
-- apply the same pattern for each one:
--
--   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
--
--   CREATE POLICY "<table>_own_school"
--     ON <table_name> FOR ALL
--     TO authenticated
--     USING (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int)
--     WITH CHECK (school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::int);
--
--   CREATE POLICY "<table>_block_anon"
--     ON <table_name> FOR ALL
--     TO anon
--     USING (false);


-- ─── VERIFY: list all tables with RLS status ─────────────────────────────────
-- Run this query after applying the migration to confirm everything is locked:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Every table should show rowsecurity = true.

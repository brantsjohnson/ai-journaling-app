-- This function allows executing raw SQL queries from the backend
-- Run this in your Supabase SQL Editor to enable raw SQL queries

CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  rec record;
  results json[] := '{}';
  affected_rows int;
BEGIN
  -- For SELECT queries
  IF sql ILIKE 'SELECT%' THEN
    FOR rec IN EXECUTE sql
    LOOP
      results := array_append(results, row_to_json(rec));
    END LOOP;
    RETURN json_build_object('data', results);
  END IF;

  -- For INSERT/UPDATE/DELETE with RETURNING
  IF sql ILIKE '%RETURNING%' THEN
    FOR rec IN EXECUTE sql
    LOOP
      results := array_append(results, row_to_json(rec));
    END LOOP;
    RETURN json_build_object('data', results);
  END IF;

  -- For INSERT/UPDATE/DELETE without RETURNING
  EXECUTE sql;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN json_build_object('data', null, 'success', true, 'row_count', affected_rows);
END;
$$;

-- Grant execute permission to authenticated and service_role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- Test the function
SELECT exec_sql('SELECT NOW() as current_time');

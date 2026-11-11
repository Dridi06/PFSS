-- PFMS: Korrektur der Rückgabetypen in der Scout-Admin-Suche
-- Explizite Casts verhindern RETURN QUERY Typkonflikte bei varchar/enum-Spalten.

CREATE OR REPLACE FUNCTION public.pfms_admin_list_legacy_scouts(
  p_query text DEFAULT ''
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  email text,
  profile_status text,
  organization_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id::uuid,
    p.username::text,
    p.full_name::text,
    u.email::text,
    p.status::text,
    COUNT(DISTINCT m.organization_id) FILTER (WHERE m.status = 'active')::bigint
  FROM public.profiles AS p
  LEFT JOIN auth.users AS u ON u.id = p.id
  LEFT JOIN public.organization_memberships AS m
    ON m.user_id = p.id
   AND m.role = 'scout'
  WHERE (
      pg_catalog.lower(COALESCE(p.role, '')) = 'scout'
      OR m.id IS NOT NULL
    )
    AND (
      COALESCE(pg_catalog.btrim(p_query), '') = ''
      OR COALESCE(p.username, '') ILIKE '%' || pg_catalog.btrim(p_query) || '%'
      OR COALESCE(p.full_name, '') ILIKE '%' || pg_catalog.btrim(p_query) || '%'
      OR COALESCE(u.email, '') ILIKE '%' || pg_catalog.btrim(p_query) || '%'
      OR p.id::text ILIKE '%' || pg_catalog.btrim(p_query) || '%'
    )
  GROUP BY p.id, p.username, p.full_name, u.email, p.status
  ORDER BY pg_catalog.lower(COALESCE(p.username, p.full_name, u.email, ''));
END;
$$;


REVOKE ALL ON FUNCTION public.pfms_admin_list_legacy_scouts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pfms_admin_list_legacy_scouts(text) TO authenticated;

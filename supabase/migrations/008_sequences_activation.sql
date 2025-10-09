SET search_path = public, pg_temp;

ALTER TABLE public.sequences
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.v_sequence_manager
WITH (security_invoker = true)
AS
SELECT
    s.id AS sequence_id,
    s.org_id,
    s.name,
    s.status,
    s.is_active,
    s.default_target_type,
    COALESCE(av.version_number, 0) AS active_version_number,
    COALESCE(stats.steps_total, 0) AS steps_total,
    COALESCE(stats.active_enrollments, 0) AS active_enrollments,
    COALESCE(stats.completion_rate, 0)::numeric(5,2) AS completion_rate,
    stats.last_activation_at,
    s.updated_at,
    s.created_at
FROM public.sequences s
LEFT JOIN LATERAL (
    SELECT v.id, v.version_number
    FROM public.sequence_versions v
    WHERE v.sequence_id = s.id
      AND v.status = 'published'
    ORDER BY v.version_number DESC
    LIMIT 1
) av ON TRUE
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT st.id) AS steps_total,
        COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) AS active_enrollments,
        CASE
            WHEN COUNT(DISTINCT a.id) = 0 THEN 0
            ELSE ROUND(
                COALESCE(COUNT(DISTINCT CASE WHEN a.status = 'done' THEN a.id END), 0)::numeric
                / NULLIF(COUNT(DISTINCT a.id), 0)::numeric * 100,
                2
            )
        END AS completion_rate,
        MAX(e.enrolled_at) AS last_activation_at
    FROM public.sequence_versions v2
    LEFT JOIN public.sequence_steps st ON st.sequence_version_id = v2.id
    LEFT JOIN public.sequence_enrollments e ON e.sequence_id = s.id
    LEFT JOIN public.sequence_assignments a ON a.sequence_id = s.id
    WHERE v2.sequence_id = s.id
) stats ON TRUE;

COMMENT ON VIEW public.v_sequence_manager IS 'Resumo de sequências para o manager com estatísticas agregadas.';

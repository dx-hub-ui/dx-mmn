SET search_path = public, pg_temp;

-- Enums
CREATE TYPE public.sequence_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.sequence_version_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.sequence_step_type AS ENUM ('general_task', 'call_task');
CREATE TYPE public.sequence_target_type AS ENUM ('contact', 'member');
CREATE TYPE public.sequence_enrollment_status AS ENUM ('active', 'paused', 'completed', 'terminated');
CREATE TYPE public.sequence_assignment_status AS ENUM ('open', 'snoozed', 'done', 'blocked');
CREATE TYPE public.sequence_publish_strategy AS ENUM ('terminate', 'migrate');

-- Sequences
CREATE TABLE public.sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status public.sequence_status NOT NULL DEFAULT 'draft',
    default_target_type public.sequence_target_type NOT NULL DEFAULT 'contact',
    created_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    updated_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    archived_at timestamptz,
    CONSTRAINT sequences_name_not_blank CHECK (btrim(name) <> '')
);

COMMENT ON TABLE public.sequences IS 'Sequences definem o fluxo principal e apontam para a versão ativa.';
COMMENT ON COLUMN public.sequences.default_target_type IS 'Tipo principal de alvo aceito pela sequência.';

CREATE OR REPLACE FUNCTION public.touch_sequences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER sequences_updated_at
BEFORE UPDATE ON public.sequences
FOR EACH ROW
EXECUTE FUNCTION public.touch_sequences_updated_at();

-- Sequence versions
CREATE TABLE public.sequence_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version_number integer NOT NULL CHECK (version_number > 0),
    status public.sequence_version_status NOT NULL DEFAULT 'draft',
    on_publish public.sequence_publish_strategy NOT NULL DEFAULT 'terminate',
    published_at timestamptz,
    published_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    created_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    work_time_zone text NOT NULL DEFAULT 'America/Sao_Paulo',
    work_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
    work_start_time time NOT NULL DEFAULT TIME '09:00',
    work_end_time time NOT NULL DEFAULT TIME '18:00',
    cooldown_days integer NOT NULL DEFAULT 0 CHECK (cooldown_days >= 0),
    cooldown_hours integer NOT NULL DEFAULT 0 CHECK (cooldown_hours >= 0),
    window_clamp_enabled boolean NOT NULL DEFAULT true,
    notes text
);

COMMENT ON TABLE public.sequence_versions IS 'Snapshot imutável das etapas e regras publicadas de uma sequência.';
COMMENT ON COLUMN public.sequence_versions.work_days IS 'Dias úteis em formato ISO (1=segunda ... 7=domingo).';

ALTER TABLE public.sequences
ADD COLUMN active_version_id uuid REFERENCES public.sequence_versions(id);

CREATE UNIQUE INDEX sequence_versions_sequence_number_idx
ON public.sequence_versions (sequence_id, version_number);

-- Steps
CREATE TABLE public.sequence_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_version_id uuid NOT NULL REFERENCES public.sequence_versions(id) ON DELETE CASCADE,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    step_order integer NOT NULL CHECK (step_order >= 0),
    title text NOT NULL,
    short_description text,
    body jsonb,
    step_type public.sequence_step_type NOT NULL,
    assignee_mode text NOT NULL DEFAULT 'owner',
    assignee_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    due_offset_days integer NOT NULL DEFAULT 0,
    due_offset_hours integer NOT NULL DEFAULT 0,
    priority text,
    tags text[] DEFAULT ARRAY[]::text[],
    checklist jsonb,
    dependencies uuid[] DEFAULT ARRAY[]::uuid[],
    channel_hint text,
    is_active boolean NOT NULL DEFAULT true,
    pause_until_done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.sequence_steps IS 'Etapas individuais de uma versão de sequência.';
COMMENT ON COLUMN public.sequence_steps.assignee_mode IS 'Define quem será responsável pelo assignment (owner, org, custom).';

CREATE INDEX sequence_steps_version_order_idx
ON public.sequence_steps (sequence_version_id, step_order);

-- Enrollments
CREATE TABLE public.sequence_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    sequence_version_id uuid NOT NULL REFERENCES public.sequence_versions(id) ON DELETE CASCADE,
    target_type public.sequence_target_type NOT NULL,
    target_id uuid NOT NULL,
    status public.sequence_enrollment_status NOT NULL DEFAULT 'active',
    enrolled_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    paused_at timestamptz,
    resumed_at timestamptz,
    completed_at timestamptz,
    terminated_at timestamptz,
    removed_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    cooldown_until timestamptz,
    dedupe_key text NOT NULL,
    created_by_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.sequence_enrollments IS 'Inscrições de contatos ou membros em uma sequência específica.';

CREATE UNIQUE INDEX sequence_enrollments_dedupe_idx
ON public.sequence_enrollments (dedupe_key);

CREATE INDEX sequence_enrollments_target_idx
ON public.sequence_enrollments (target_type, target_id);

CREATE INDEX sequence_enrollments_status_idx
ON public.sequence_enrollments (status);

-- Assignments
CREATE TABLE public.sequence_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    sequence_version_id uuid NOT NULL REFERENCES public.sequence_versions(id) ON DELETE CASCADE,
    sequence_step_id uuid NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
    sequence_enrollment_id uuid NOT NULL REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
    assignee_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
    status public.sequence_assignment_status NOT NULL DEFAULT 'open',
    due_at timestamptz,
    snoozed_until timestamptz,
    done_at timestamptz,
    overdue_at timestamptz,
    blocked_reason text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.sequence_assignments IS 'Tarefas geradas a partir das etapas das sequências.';

CREATE INDEX sequence_assignments_assignee_due_idx
ON public.sequence_assignments (assignee_membership_id, due_at);

CREATE INDEX sequence_assignments_status_idx
ON public.sequence_assignments (status);

CREATE OR REPLACE FUNCTION public.touch_sequence_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER sequence_assignments_updated_at
BEFORE UPDATE ON public.sequence_assignments
FOR EACH ROW
EXECUTE FUNCTION public.touch_sequence_assignments_updated_at();

-- Notifications
CREATE TABLE public.sequence_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    sequence_enrollment_id uuid REFERENCES public.sequence_enrollments(id) ON DELETE CASCADE,
    sequence_assignment_id uuid REFERENCES public.sequence_assignments(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at timestamptz
);

COMMENT ON TABLE public.sequence_notifications IS 'Feed in-app com notificações relativas às sequências.';

CREATE INDEX sequence_notifications_member_idx
ON public.sequence_notifications (member_id, created_at DESC);

-- Views
CREATE OR REPLACE VIEW public.v_sequence_manager
WITH (security_invoker = true)
AS
SELECT
    s.id AS sequence_id,
    s.org_id,
    s.name,
    s.status,
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

CREATE OR REPLACE VIEW public.v_my_tasks
WITH (security_invoker = true)
AS
SELECT
    a.id AS assignment_id,
    a.org_id,
    a.sequence_id,
    a.sequence_version_id,
    a.sequence_step_id,
    a.sequence_enrollment_id,
    a.assignee_membership_id,
    a.status,
    a.due_at,
    a.snoozed_until,
    a.done_at,
    a.overdue_at,
    a.blocked_reason,
    (a.overdue_at IS NOT NULL OR (a.due_at IS NOT NULL AND a.due_at < timezone('utc'::text, now()) AND a.status <> 'done')) AS is_overdue,
    (a.snoozed_until IS NOT NULL AND a.snoozed_until > timezone('utc'::text, now())) AS is_snoozed,
    (a.status = 'blocked') AS is_blocked,
    s.name AS sequence_name,
    st.title AS step_title,
    e.target_type,
    e.target_id,
    e.status AS enrollment_status
FROM public.sequence_assignments a
JOIN public.sequences s ON s.id = a.sequence_id
JOIN public.sequence_steps st ON st.id = a.sequence_step_id
JOIN public.sequence_enrollments e ON e.id = a.sequence_enrollment_id;

COMMENT ON VIEW public.v_my_tasks IS 'Lista de assignments agrupados para o painel "Minhas Tarefas".';

-- RLS Helpers
CREATE OR REPLACE FUNCTION public.member_has_access_to_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = target_org_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
);
$$;

-- Enable RLS
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for sequences
CREATE POLICY sequences_select_org_members
ON public.sequences
FOR SELECT
USING (public.member_has_access_to_org(sequences.org_id));

CREATE POLICY sequences_insert_org_members
ON public.sequences
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequences_update_org_members
ON public.sequences
FOR UPDATE
USING (public.member_has_access_to_org(sequences.org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequences_delete_org_members
ON public.sequences
FOR DELETE
USING (public.member_has_access_to_org(sequences.org_id));

-- Policies for sequence_versions
CREATE POLICY sequence_versions_select
ON public.sequence_versions
FOR SELECT
USING (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_versions_insert
ON public.sequence_versions
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_versions_update
ON public.sequence_versions
FOR UPDATE
USING (public.member_has_access_to_org(org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_versions_delete
ON public.sequence_versions
FOR DELETE
USING (public.member_has_access_to_org(org_id));

-- Policies for steps
CREATE POLICY sequence_steps_select
ON public.sequence_steps
FOR SELECT
USING (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_steps_insert
ON public.sequence_steps
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_steps_update
ON public.sequence_steps
FOR UPDATE
USING (public.member_has_access_to_org(org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_steps_delete
ON public.sequence_steps
FOR DELETE
USING (public.member_has_access_to_org(org_id));

-- Policies for enrollments
CREATE POLICY sequence_enrollments_select
ON public.sequence_enrollments
FOR SELECT
USING (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_enrollments_insert
ON public.sequence_enrollments
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_enrollments_update
ON public.sequence_enrollments
FOR UPDATE
USING (public.member_has_access_to_org(org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_enrollments_delete
ON public.sequence_enrollments
FOR DELETE
USING (public.member_has_access_to_org(org_id));

-- Policies for assignments
CREATE POLICY sequence_assignments_select
ON public.sequence_assignments
FOR SELECT
USING (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_assignments_insert
ON public.sequence_assignments
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_assignments_update
ON public.sequence_assignments
FOR UPDATE
USING (public.member_has_access_to_org(org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_assignments_delete
ON public.sequence_assignments
FOR DELETE
USING (public.member_has_access_to_org(org_id));

-- Policies for notifications
CREATE POLICY sequence_notifications_select
ON public.sequence_notifications
FOR SELECT
USING (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_notifications_insert
ON public.sequence_notifications
FOR INSERT
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_notifications_update
ON public.sequence_notifications
FOR UPDATE
USING (public.member_has_access_to_org(org_id))
WITH CHECK (public.member_has_access_to_org(org_id));

CREATE POLICY sequence_notifications_delete
ON public.sequence_notifications
FOR DELETE
USING (public.member_has_access_to_org(org_id));

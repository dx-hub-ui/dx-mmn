SET search_path = public, pg_temp;

-- Atualiza view de Minhas Tarefas com informações adicionais de passo
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
    st.short_description AS step_short_description,
    st.priority AS step_priority,
    COALESCE(st.tags, ARRAY[]::text[]) AS step_tags,
    e.target_type,
    e.target_id,
    e.status AS enrollment_status
FROM public.sequence_assignments a
JOIN public.sequences s ON s.id = a.sequence_id
JOIN public.sequence_steps st ON st.id = a.sequence_step_id
JOIN public.sequence_enrollments e ON e.id = a.sequence_enrollment_id;

COMMENT ON VIEW public.v_my_tasks IS 'Lista de assignments agrupados para o painel "Minhas Tarefas".';

-- Notificações automáticas ao pausar, retomar ou concluir inscrições
CREATE OR REPLACE FUNCTION public.handle_sequence_enrollment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_member uuid;
BEGIN
    target_member := COALESCE(NEW.created_by_membership_id, OLD.created_by_membership_id);

    IF target_member IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'paused' AND OLD.status IS DISTINCT FROM 'paused' THEN
            INSERT INTO public.sequence_notifications (org_id, sequence_id, sequence_enrollment_id, member_id, event_type, payload)
            VALUES (NEW.org_id, NEW.sequence_id, NEW.id, target_member, 'sequence_paused', jsonb_build_object('status', NEW.status));
        ELSIF NEW.status = 'active' AND OLD.status = 'paused' THEN
            INSERT INTO public.sequence_notifications (org_id, sequence_id, sequence_enrollment_id, member_id, event_type, payload)
            VALUES (NEW.org_id, NEW.sequence_id, NEW.id, target_member, 'sequence_resumed', jsonb_build_object('status', NEW.status));
        ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
            INSERT INTO public.sequence_notifications (org_id, sequence_id, sequence_enrollment_id, member_id, event_type, payload)
            VALUES (NEW.org_id, NEW.sequence_id, NEW.id, target_member, 'sequence_completed', jsonb_build_object('completed_at', NEW.completed_at));
        ELSIF NEW.status = 'terminated' AND OLD.status IS DISTINCT FROM 'terminated' THEN
            INSERT INTO public.sequence_notifications (org_id, sequence_id, sequence_enrollment_id, member_id, event_type, payload)
            VALUES (NEW.org_id, NEW.sequence_id, NEW.id, target_member, 'sequence_removed', jsonb_build_object('status', NEW.status));
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sequence_enrollment_status_notifications ON public.sequence_enrollments;

CREATE TRIGGER sequence_enrollment_status_notifications
AFTER UPDATE ON public.sequence_enrollments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.handle_sequence_enrollment_status();

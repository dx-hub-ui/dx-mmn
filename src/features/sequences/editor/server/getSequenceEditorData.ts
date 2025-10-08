import { createSupabaseServerClient } from "@/lib/supabase/server";
import { composeSequenceEditorData } from "../normalize";
import type {
  SequenceEditorData,
  SequenceEnrollmentRow,
  SequenceRow,
  SequenceStepRow,
  SequenceVersionRow,
} from "../types";

export async function getSequenceEditorData(sequenceId: string): Promise<SequenceEditorData> {
  const supabase = createSupabaseServerClient();

  const [sequenceResult, versionsResult] = await Promise.all([
    supabase
      .from("sequences")
      .select(
        "id, org_id, name, description, status, default_target_type, active_version_id, created_at, updated_at"
      )
      .eq("id", sequenceId)
      .maybeSingle(),
    supabase
      .from("sequence_versions")
      .select(
        "id, sequence_id, org_id, version_number, status, on_publish, work_time_zone, work_days, work_start_time, work_end_time, cooldown_days, cooldown_hours, window_clamp_enabled, notes, created_at, published_at"
      )
      .eq("sequence_id", sequenceId)
      .order("version_number", { ascending: false }),
  ]);

  if (sequenceResult.error) {
    throw sequenceResult.error;
  }

  if (!sequenceResult.data) {
    throw new Error("Sequência não encontrada");
  }

  if (versionsResult.error) {
    throw versionsResult.error;
  }

  const versions = (versionsResult.data ?? []) as SequenceVersionRow[];
  const sequence = sequenceResult.data as SequenceRow;

  const draftVersion = versions.find((version) => version.status === "draft") ?? versions.at(0) ?? null;

  const [stepsResult, enrollmentsResult] = await Promise.all([
    draftVersion
      ? supabase
          .from("sequence_steps")
          .select(
            "id, sequence_version_id, org_id, step_order, title, short_description, body, step_type, assignee_mode, assignee_membership_id, due_offset_days, due_offset_hours, priority, tags, checklist, dependencies, channel_hint, is_active, pause_until_done, created_at"
          )
          .eq("sequence_version_id", draftVersion.id)
          .order("step_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("sequence_enrollments")
      .select(
        "id, org_id, sequence_id, sequence_version_id, target_type, target_id, status, enrolled_at, paused_at, resumed_at, completed_at, terminated_at, cooldown_until, dedupe_key"
      )
      .eq("sequence_id", sequenceId)
      .order("enrolled_at", { ascending: false }),
  ]);

  if (stepsResult.error) {
    throw stepsResult.error;
  }

  if (enrollmentsResult.error) {
    throw enrollmentsResult.error;
  }

  const steps = (stepsResult.data ?? []) as SequenceStepRow[];
  const enrollments = (enrollmentsResult.data ?? []) as SequenceEnrollmentRow[];

  return composeSequenceEditorData({ sequence, versions, steps, enrollments });
}

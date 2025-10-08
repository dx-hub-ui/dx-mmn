import { redirect } from "next/navigation";
import { createSequenceDraftAction } from "../actions";

export default async function SequenceNewPage() {
  const { sequenceId } = await createSequenceDraftAction();
  redirect(`/sequences/${sequenceId}?criada=1`);
}

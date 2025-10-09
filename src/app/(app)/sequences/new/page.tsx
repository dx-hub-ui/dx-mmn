import { redirect } from "next/navigation";
export default async function SequenceNewPage() {
  redirect("/sequences?nova=1");
}

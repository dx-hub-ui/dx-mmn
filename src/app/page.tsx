import { redirect } from "next/navigation";
import SignInPage from "./sign-in/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();

  let session = initialSession;

  if (!session) {
    const { data } = await supabase.auth.refreshSession();
    session = data?.session ?? null;
  }

  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignInPage />;
}

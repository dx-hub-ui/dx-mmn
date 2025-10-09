import { redirect } from "next/navigation";
import SignInPage from "./sign-in/page";
import SupabaseConfigNotice from "@/components/supabase/SupabaseConfigNotice";
import { isSupabaseConfigurationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (isSupabaseConfigurationError(error)) {
      return <SupabaseConfigNotice featureLabel="o fluxo de autenticação" documentationPath="docs/dev_setup_crm.md" />;
    }
    throw error;
  }

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

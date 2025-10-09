export class SupabaseConfigurationError extends Error {
  constructor(message = "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas.") {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

export function isSupabaseConfigurationError(error: unknown): error is SupabaseConfigurationError {
  return error instanceof SupabaseConfigurationError;
}

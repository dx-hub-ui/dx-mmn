import { NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadAvatarBlob } from "@/lib/blob";
import { trackServerEvent } from "@/lib/telemetry.server";
import { ThemePreference, themePreferenceFromString } from "@/lib/theme";

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_LOCALE_LENGTH = 24;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_BIO_LENGTH = 600;
const MAX_URL_LENGTH = 2048;
const AVATAR_MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const PHONE_PATTERN = /^[0-9+()\s.-]{0,}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,}([_-][A-Za-z0-9]+)*$/;

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

type FieldErrors = Partial<Record<
  | "display_name"
  | "first_name"
  | "last_name"
  | "phone"
  | "locale"
  | "timezone"
  | "bio"
  | "avatar"
  | "avatar_url"
  | "theme_preference",
  string
>>;

type UpdateProfilePayload = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  locale?: string | null;
  timezone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

type ParsedPayload = {
  payload: UpdateProfilePayload;
  themeInput?: string | null;
  avatarFile?: File | null;
};

type MembershipSummary = {
  id: string | null;
  organization_id: string | null;
};

type ProfileRow = {
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

type UserProfileResponse = {
  user_id: string;
  email: string | null;
  org_id: string | null;
  member_id: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  locale: string | null;
  timezone: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_preference: ThemePreference | null;
};

function normalizeStringValue(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return undefined as unknown as null;
  }

  return String(value);
}

function validateString(
  value: string | null,
  { required, maxLength, pattern }: { required?: boolean; maxLength: number; pattern?: RegExp }
): { value: string | null; error?: string } {
  if (value === null) {
    if (required) {
      return { value: null, error: "Campo obrigatório" };
    }
    return { value: null };
  }

  if (value === undefined) {
    return { value: undefined as unknown as null };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    if (required) {
      return { value: null, error: "Campo obrigatório" };
    }
    return { value: null };
  }

  if (trimmed.length > maxLength) {
    return { value: trimmed, error: `Máximo de ${maxLength} caracteres` };
  }

  if (pattern && !pattern.test(trimmed)) {
    return { value: trimmed, error: "Valor inválido" };
  }

  return { value: trimmed };
}

function validatePayload(
  payload: UpdateProfilePayload,
  themeInput?: string | null
): { sanitized: UpdateProfilePayload & { theme_preference?: ThemePreference | null }; errors: FieldErrors } {
  const sanitized: UpdateProfilePayload & { theme_preference?: ThemePreference | null } = {};
  const errors: FieldErrors = {};

  if (payload.display_name !== undefined) {
    const { value, error } = validateString(payload.display_name, { required: true, maxLength: MAX_NAME_LENGTH });
    if (error) {
      errors.display_name = error;
    } else {
      sanitized.display_name = value;
    }
  }

  if (payload.first_name !== undefined) {
    const { value, error } = validateString(payload.first_name, { maxLength: MAX_NAME_LENGTH });
    if (error) {
      errors.first_name = error;
    } else {
      sanitized.first_name = value;
    }
  }

  if (payload.last_name !== undefined) {
    const { value, error } = validateString(payload.last_name, { maxLength: MAX_NAME_LENGTH });
    if (error) {
      errors.last_name = error;
    } else {
      sanitized.last_name = value;
    }
  }

  if (payload.phone !== undefined) {
    const { value, error } = validateString(payload.phone, { maxLength: MAX_PHONE_LENGTH, pattern: PHONE_PATTERN });
    if (error) {
      errors.phone = error;
    } else {
      sanitized.phone = value;
    }
  }

  if (payload.locale !== undefined) {
    const { value, error } = validateString(payload.locale, {
      maxLength: MAX_LOCALE_LENGTH,
      pattern: LOCALE_PATTERN,
    });
    if (error) {
      errors.locale = error;
    } else {
      sanitized.locale = value?.toLowerCase() ?? null;
    }
  }

  if (payload.timezone !== undefined) {
    const { value, error } = validateString(payload.timezone, { maxLength: MAX_TIMEZONE_LENGTH });
    if (error) {
      errors.timezone = error;
    } else {
      sanitized.timezone = value;
    }
  }

  if (payload.bio !== undefined) {
    const { value, error } = validateString(payload.bio, { maxLength: MAX_BIO_LENGTH });
    if (error) {
      errors.bio = error;
    } else {
      sanitized.bio = value;
    }
  }

  if (payload.avatar_url !== undefined) {
    const { value, error } = validateString(payload.avatar_url, { maxLength: MAX_URL_LENGTH });
    if (error) {
      errors.avatar_url = error;
    } else {
      sanitized.avatar_url = value;
    }
  }

  if (themeInput !== undefined) {
    if (themeInput === null) {
      sanitized.theme_preference = null;
    } else {
      const normalized = themePreferenceFromString(themeInput);
      if (!normalized) {
        errors.theme_preference = "Tema inválido";
      } else {
        sanitized.theme_preference = normalized;
      }
    }
  }

  return { sanitized, errors };
}

function parseJsonPayload(body: Record<string, unknown>): ParsedPayload {
  const payload: UpdateProfilePayload = {};
  let themeInput: string | null | undefined;

  if (Object.prototype.hasOwnProperty.call(body, "display_name")) {
    payload.display_name = normalizeStringValue(body.display_name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "first_name")) {
    payload.first_name = normalizeStringValue(body.first_name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "last_name")) {
    payload.last_name = normalizeStringValue(body.last_name);
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    payload.phone = normalizeStringValue(body.phone);
  }
  if (Object.prototype.hasOwnProperty.call(body, "locale")) {
    payload.locale = normalizeStringValue(body.locale);
  }
  if (Object.prototype.hasOwnProperty.call(body, "timezone")) {
    payload.timezone = normalizeStringValue(body.timezone);
  }
  if (Object.prototype.hasOwnProperty.call(body, "bio")) {
    payload.bio = normalizeStringValue(body.bio);
  }
  if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
    payload.avatar_url = normalizeStringValue(body.avatar_url);
  }
  if (Object.prototype.hasOwnProperty.call(body, "theme_preference")) {
    const raw = body.theme_preference;
    themeInput = typeof raw === "string" ? raw : raw === null ? null : String(raw);
  }

  return { payload, themeInput };
}

async function parseRequest(request: Request): Promise<ParsedPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return parseJsonPayload(body);
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload: UpdateProfilePayload = {};
    let themeInput: string | null | undefined;
    let avatarFile: File | null = null;

    const entries: Array<keyof UpdateProfilePayload> = [
      "display_name",
      "first_name",
      "last_name",
      "phone",
      "locale",
      "timezone",
      "bio",
      "avatar_url",
    ];

    entries.forEach((key) => {
      if (!formData.has(key)) {
        return;
      }
      const entry = formData.get(key);
      if (entry instanceof File) {
        return;
      }
      payload[key] = entry === null ? null : entry;
    });

    if (formData.has("theme_preference")) {
      const raw = formData.get("theme_preference");
      themeInput = typeof raw === "string" ? raw : raw === null ? null : String(raw);
    }

    const avatarEntry = formData.get("avatar");
    if (avatarEntry instanceof File && avatarEntry.size > 0) {
      avatarFile = avatarEntry;
    }

    return { payload, themeInput, avatarFile };
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return parseJsonPayload(body);
}

async function getActiveMembership(supabase: SupabaseClient, userId: string): Promise<MembershipSummary> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id, organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return {
    id: data?.id ?? null,
    organization_id: data?.organization_id ?? null,
  };
}

function buildProfileResponse({
  userId,
  email,
  row,
  membership,
}: {
  userId: string;
  email: string | null;
  row: ProfileRow | null;
  membership: MembershipSummary;
}): UserProfileResponse {
  const meta = (row?.raw_user_meta_data ?? {}) as Record<string, unknown>;
  const theme = themePreferenceFromString(meta?.theme_preference);

  return {
    user_id: userId,
    email: row?.email ?? email,
    org_id: membership.organization_id,
    member_id: membership.id,
    display_name: (meta.display_name as string | undefined) ?? null,
    first_name: (meta.first_name as string | undefined) ?? null,
    last_name: (meta.last_name as string | undefined) ?? null,
    phone: (meta.phone as string | undefined) ?? null,
    locale: (meta.locale as string | undefined) ?? null,
    timezone: (meta.timezone as string | undefined) ?? null,
    bio: (meta.bio as string | undefined) ?? null,
    avatar_url: (meta.avatar_url as string | undefined) ?? null,
    theme_preference: theme,
  };
}

function validationErrorResponse(errors: FieldErrors) {
  return NextResponse.json({ errors }, { status: 400 });
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const [{ data: profileRow, error: profileError }, membership] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, raw_user_meta_data")
        .eq("id", user.id)
        .maybeSingle(),
      getActiveMembership(supabase, user.id),
    ]);

    if (profileError && profileError.code !== "PGRST116") {
      throw profileError;
    }

    const profile = buildProfileResponse({
      userId: user.id,
      email: user.email ?? null,
      row: profileRow ?? null,
      membership,
    });

    return NextResponse.json(
      { profile },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    captureException(error);
    return NextResponse.json({ error: "Falha ao carregar perfil" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const parsed = await parseRequest(request);
    const { sanitized, errors } = validatePayload(parsed.payload, parsed.themeInput);

    const avatarFile = parsed.avatarFile ?? null;

    if (avatarFile) {
      if (!ALLOWED_AVATAR_TYPES.has(avatarFile.type)) {
        errors.avatar = "Formato não suportado";
      } else if (avatarFile.size > AVATAR_MAX_SIZE) {
        errors.avatar = "Arquivo deve ter até 4 MB";
      }
    }

    if (Object.keys(errors).length > 0) {
      return validationErrorResponse(errors);
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("email, raw_user_meta_data")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      throw profileError;
    }

    const existingMeta = (profileRow?.raw_user_meta_data ?? {}) as Record<string, unknown>;
    const updatedMeta: Record<string, unknown> = { ...existingMeta };

    if (avatarFile) {
      try {
        await trackServerEvent("avatar/upload_start", {
          size: avatarFile.size,
          type: avatarFile.type,
          userId: user.id,
        });

        const uploadedUrl = await uploadAvatarBlob(avatarFile, {
          userId: user.id,
          contentType: avatarFile.type,
          fileName: avatarFile.name,
        });

        sanitized.avatar_url = uploadedUrl;
        updatedMeta.avatar_url = uploadedUrl;

        await trackServerEvent("avatar/upload_success", {
          size: avatarFile.size,
          type: avatarFile.type,
          userId: user.id,
        });
      } catch (error) {
        await trackServerEvent("avatar/upload_error", {
          userId: user.id,
          message: error instanceof Error ? error.message : "unknown",
        });
        throw error;
      }
    }

    (Object.keys(sanitized) as Array<keyof typeof sanitized>).forEach((key) => {
      if (key === "avatar_url" && avatarFile) {
        return;
      }
      const value = sanitized[key];
      if (value !== undefined) {
        updatedMeta[key] = value;
      }
    });

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ raw_user_meta_data: updatedMeta })
      .eq("id", user.id);

    if (updateError) {
      await trackServerEvent("profile/save_error", {
        userId: user.id,
        message: updateError.message,
      });
      throw updateError;
    }

    await trackServerEvent("profile/save_success", { userId: user.id });

    const membership = await getActiveMembership(supabase, user.id);
    const profile = buildProfileResponse({
      userId: user.id,
      email: user.email ?? null,
      row: { email: profileRow?.email ?? null, raw_user_meta_data: updatedMeta },
      membership,
    });

    return NextResponse.json(
      { profile },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    captureException(error);
    return NextResponse.json({ error: "Falha ao atualizar perfil" }, { status: 500 });
  }
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  TabsContext,
  Text,
  TextArea,
  TextField,
} from "@vibe/core";
import { captureException } from "@sentry/nextjs";
import type { ThemePreference } from "@/lib/theme";
import { trackEvent } from "@/lib/telemetry";
import styles from "./account-modal.module.css";

export type UserProfile = {
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

type AccountModalProps = {
  open: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
};

type FormState = {
  display_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  locale: string;
  timezone: string;
  bio: string;
};

type FormErrors = Partial<FormState> & { avatar?: string };

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function getInitials(profile: UserProfile | null) {
  const source = profile?.display_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  if (!source) {
    return (profile?.email ?? "").slice(0, 2).toUpperCase();
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default function AccountModal({ open, profile, onClose, onProfileUpdated }: AccountModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<FormState>({
    display_name: "",
    first_name: "",
    last_name: "",
    phone: "",
    locale: "",
    timezone: "",
    bio: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(0);
    setErrors({});
    setSubmitError(null);
    setAvatarFile(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        phone: profile.phone ?? "",
        locale: profile.locale ?? "",
        timezone: profile.timezone ?? "",
        bio: profile.bio ?? "",
      });
      setAvatarPreview(profile.avatar_url ?? null);
    } else {
      setForm({
        display_name: "",
        first_name: "",
        last_name: "",
        phone: "",
        locale: "",
        timezone: "",
        bio: "",
      });
      setAvatarPreview(null);
    }
  }, [open, profile]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const initials = useMemo(() => getInitials(profile), [profile]);

  const handleFieldChange = useCallback(<K extends keyof FormState>(field: K, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleAvatarPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, avatar: "Formato não suportado" }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, avatar: "Arquivo deve ter até 4 MB" }));
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setAvatarPreview(previewUrl);
    setAvatarFile(file);
    setErrors((prev) => ({ ...prev, avatar: undefined }));
    trackEvent("avatar/upload_start", { size: file.size, type: file.type });
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setAvatarPreview(null);
    setAvatarFile(null);
    setErrors((prev) => ({ ...prev, avatar: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!profile) {
        return;
      }

      setSaving(true);
      setSubmitError(null);
      const formData = new FormData();
      formData.append("display_name", form.display_name);
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("phone", form.phone);
      formData.append("locale", form.locale);
      formData.append("timezone", form.timezone);
      formData.append("bio", form.bio);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }
      if (!avatarFile && avatarPreview === null && profile.avatar_url) {
        formData.append("avatar_url", "");
      }

      try {
        const response = await fetch("/api/user/profile", {
          method: "PUT",
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 400) {
            const data = (await response.json().catch(() => ({}))) as { errors?: Record<string, string> };
            const fieldErrors: FormErrors = {};
            if (data?.errors) {
              Object.entries(data.errors).forEach(([key, value]) => {
                if (typeof value === "string") {
                  if (key === "avatar") {
                    fieldErrors.avatar = value;
                  } else if (key in form) {
                    fieldErrors[key as keyof FormState] = value;
                  }
                }
              });
            }
            setErrors((prev) => ({ ...prev, ...fieldErrors }));
            setSubmitError(null);
            trackEvent("profile/save_error", { reason: "validation" });
            return;
          }

          const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorBody.error ?? "Não foi possível salvar o perfil");
        }

        const data = (await response.json()) as { profile: UserProfile };
        if (avatarFile) {
          trackEvent("avatar/upload_success", { size: avatarFile.size, type: avatarFile.type });
        }
        trackEvent("profile/save_success", { userId: data.profile.user_id });
        onProfileUpdated(data.profile);
        setErrors({});
        setAvatarFile(null);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        onClose();
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)));
        const message = error instanceof Error ? error.message : "Não foi possível salvar o perfil";
        if (avatarFile) {
          trackEvent("avatar/upload_error", { message });
        }
        setSubmitError(message);
        trackEvent("profile/save_error", { message });
      } finally {
        setSaving(false);
      }
    },
    [avatarFile, avatarPreview, form, onClose, onProfileUpdated, profile]
  );

  const disableSave = !form.display_name.trim() || saving;

  return (
    <Modal id="account-modal" show={open} onClose={onClose} width="720px" contentSpacing>
      <ModalHeader title="Minha conta" />
      <ModalContent className="content_modal">
          <div className={styles.root}>
            <TabsContext activeTabId={activeTab}>
              <TabList>
                <Tab value={0} active={activeTab === 0} onClick={() => setActiveTab(0)}>
                  Visão geral
                </Tab>
                <Tab value={1} active={activeTab === 1} onClick={() => setActiveTab(1)}>
                  Perfil
                </Tab>
              </TabList>
              <TabPanels activeTabId={activeTab}>
                <TabPanel index={0}>
                  <div className={styles.overviewGrid}>
                    <TextField title="ID do usuário" value={profile?.user_id ?? ""} readonly />
                    <TextField title="ID da organização" value={profile?.org_id ?? ""} readonly />
                    <TextField title="ID do membro" value={profile?.member_id ?? ""} readonly />
                    <TextField title="E-mail" value={profile?.email ?? ""} readonly />
                  </div>
                </TabPanel>
                <TabPanel index={1}>
                  <form
                    className={styles.formGrid}
                    onSubmit={handleSubmit}
                    aria-label="Editar perfil"
                    noValidate
                  >
                    <div className={`${styles.avatarRow} ${styles.fullWidth}`}>
                      <Avatar
                        src={avatarPreview ?? undefined}
                        text={avatarPreview ? undefined : initials}
                        customSize={64}
                        ariaLabel="Avatar do usuário"
                      />
                      <div className={styles.avatarActions}>
                        <Button
                          kind={Button.kinds.SECONDARY}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={saving}
                        >
                          Alterar avatar
                        </Button>
                        <Button
                          kind={Button.kinds.TERTIARY}
                          onClick={handleRemoveAvatar}
                          disabled={saving || (!avatarFile && !avatarPreview)}
                        >
                          Remover avatar
                        </Button>
                        <input
                          ref={fileInputRef}
                          className={styles.hiddenInput}
                          type="file"
                          accept={ACCEPTED_TYPES.join(",")}
                          onChange={handleAvatarPick}
                        />
                        {errors.avatar ? <span className={styles.errorText}>{errors.avatar}</span> : null}
                      </div>
                    </div>

                    <TextField
                      title="Nome exibido"
                      value={form.display_name}
                      required
                      onChange={(value) => handleFieldChange("display_name", value)}
                      disabled={saving}
                      validation={
                        errors.display_name
                          ? { status: "error", text: errors.display_name }
                          : undefined
                      }
                    />
                    <TextField
                      title="Nome"
                      value={form.first_name}
                      onChange={(value) => handleFieldChange("first_name", value)}
                      disabled={saving}
                      validation={
                        errors.first_name ? { status: "error", text: errors.first_name } : undefined
                      }
                    />
                    <TextField
                      title="Sobrenome"
                      value={form.last_name}
                      onChange={(value) => handleFieldChange("last_name", value)}
                      disabled={saving}
                      validation={
                        errors.last_name ? { status: "error", text: errors.last_name } : undefined
                      }
                    />
                    <TextField
                      title="Telefone"
                      value={form.phone}
                      onChange={(value) => handleFieldChange("phone", value)}
                      disabled={saving}
                      validation={errors.phone ? { status: "error", text: errors.phone } : undefined}
                    />
                    <TextField
                      title="Locale"
                      value={form.locale}
                      placeholder="ex: pt-BR"
                      onChange={(value) => handleFieldChange("locale", value)}
                      disabled={saving}
                      validation={errors.locale ? { status: "error", text: errors.locale } : undefined}
                    />
                    <TextField
                      title="Fuso horário"
                      value={form.timezone}
                      placeholder="ex: America/Sao_Paulo"
                      onChange={(value) => handleFieldChange("timezone", value)}
                      disabled={saving}
                      validation={
                        errors.timezone ? { status: "error", text: errors.timezone } : undefined
                      }
                    />
                    <TextArea
                      className={styles.fullWidth}
                      label="Bio"
                      value={form.bio}
                      onChange={(event) => handleFieldChange("bio", event.target.value)}
                      disabled={saving}
                      error={Boolean(errors.bio)}
                      helpText={errors.bio}
                      rows={4}
                    />
                  </form>
                </TabPanel>
              </TabPanels>
            </TabsContext>
            {submitError ? <Text className={styles.feedback}>{submitError}</Text> : null}
          </div>
      </ModalContent>
      <ModalFooter>
        <div className={styles.footerActions}>
          <Button kind={Button.kinds.SECONDARY} onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            kind={Button.kinds.PRIMARY}
            onClick={handleSubmit}
            disabled={disableSave}
            loading={saving}
          >
            Salvar
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

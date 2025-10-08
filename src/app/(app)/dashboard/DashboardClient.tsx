"use client";

import { Divider, Flex, Text } from "@vibe/core";
import styles from "./dashboard.module.css";

type DashboardUser = {
  id: string;
  email: string | null;
  fullName: string | null;
};

type DashboardMembership = {
  id: string;
  role: "org" | "leader" | "rep";
  status: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
  } | null;
  createdAt: string;
};

type DashboardClientProps = {
  user: DashboardUser;
  memberships: DashboardMembership[];
  membershipsError?: string | null;
};

const roleDescriptions: Record<DashboardMembership["role"], string> = {
  org: "Administrador da organização",
  leader: "Líder de equipe",
  rep: "Representante",
};

export default function DashboardClient({
  user,
  memberships,
  membershipsError,
}: DashboardClientProps) {
  const displayName = user.fullName?.trim() || user.email || "Usuário sem nome";

  return (
    <section className={styles.page} aria-labelledby="dashboard-title">
      <header className={styles.pageHeader}>
        <Flex direction={Flex.directions.COLUMN} gap={8}>
          <Text id="dashboard-title" type={Text.types.TEXT1} weight={Text.weights.BOLD}>
            Visão geral da conta
          </Text>
          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
            Revise seus dados básicos e as organizações às quais você tem acesso.
          </Text>
        </Flex>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.cards}>
          <article className={styles.card} aria-labelledby="session-title">
            <Flex direction={Flex.directions.COLUMN} gap={12}>
              <Text id="session-title" type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                Informações da sessão
              </Text>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Dados básicos da conta autenticada no momento.
              </Text>
            </Flex>

            <Divider />

            <div className={styles.cardSection}>
              <Flex direction={Flex.directions.COLUMN} gap={4}>
                <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                  Nome exibido
                </Text>
                <Text type={Text.types.TEXT2}>{displayName}</Text>
              </Flex>

              <Flex direction={Flex.directions.COLUMN} gap={4}>
                <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                  Email
                </Text>
                <Text type={Text.types.TEXT2}>{user.email ?? "—"}</Text>
              </Flex>

              <Flex direction={Flex.directions.COLUMN} gap={4}>
                <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                  Identificador do usuário
                </Text>
                <Text type={Text.types.TEXT2} className={styles.userId}>
                  {user.id}
                </Text>
              </Flex>
            </div>
          </article>

          <article className={styles.card} aria-labelledby="memberships-title">
            <Flex direction={Flex.directions.COLUMN} gap={12}>
              <Text id="memberships-title" type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                Acessos por organização
              </Text>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Use esta lista para validar as permissões ativas de cada papel.
              </Text>
            </Flex>

            <Divider />

            {membershipsError ? (
              <div className={styles.errorState} role="status">
                <Text type={Text.types.TEXT3} color={Text.colors.NEGATIVE}>
                  {membershipsError}
                </Text>
              </div>
            ) : memberships.length === 0 ? (
              <div className={styles.emptyState}>
                <Text type={Text.types.TEXT3}>
                  Nenhuma organização vinculada ao seu usuário. Solicite um convite para começar.
                </Text>
              </div>
            ) : (
              <ul className={styles.membershipList}>
                {memberships.map((membership) => {
                  const organizationName = membership.organization?.name ?? "Organização removida";
                  const organizationSlug = membership.organization?.slug ?? "—";
                  const organizationCountry = membership.organization?.country ?? "Não informado";
                  const roleLabel = roleDescriptions[membership.role];

                  return (
                    <li key={membership.id} className={styles.membershipItem}>
                      <div className={styles.membershipHeader}>
                        <Text type={Text.types.TEXT2} weight={Text.weights.MEDIUM}>
                          {organizationName}
                        </Text>
                        <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
                          {roleLabel}
                        </Text>
                      </div>

                      <div className={styles.metaGrid}>
                        <span>Slug: {organizationSlug}</span>
                        <span>País: {organizationCountry}</span>
                        <span>Status do vínculo: {membership.status}</span>
                        <span>Entrou em: {new Date(membership.createdAt).toLocaleString()}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

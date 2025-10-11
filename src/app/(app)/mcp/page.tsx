"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button, Flex, Loader, Text, TextField } from "@vibe/core";
import { trackEvent } from "@/lib/telemetry";
import styles from "./mcp.module.css";

type ComponentsResponse = {
  components: Array<{
    id: string;
    name: string;
    description?: string;
    href?: string;
    tags?: string[];
    category?: string;
    status?: string;
  }>;
};

type ComponentDetailsResponse = {
  metadata: {
    id: string;
    name: string;
    description?: string;
    props?: Array<{
      name: string;
      type?: string;
      required?: boolean;
      description?: string;
      defaultValue?: string | number | boolean;
    }>;
    accessibility?: string[];
    guidelines?: string[];
    tokens?: string[];
    status?: string;
    sourceUrl?: string;
  };
  examples?: Array<{
    title: string;
    description?: string;
    code: string;
    language?: string;
  }>;
};

type TokensResponse = {
  tokens: Array<{
    name: string;
    value: string | number;
    description?: string;
    group?: string;
    category?: string;
  }>;
};

type IconsResponse = {
  icons: Array<{
    name: string;
    svg?: string;
    importPath?: string;
    tags?: string[];
    category?: string;
  }>;
};

const fetcher = async <T,>(input: string): Promise<T> => {
  const response = await fetch(input);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request to ${input} failed`);
  }
  return (await response.json()) as T;
};

export default function McpWorkspacePage() {
  const [componentInput, setComponentInput] = useState("");
  const [componentQuery, setComponentQuery] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [tokenQuery, setTokenQuery] = useState("");

  const [iconInput, setIconInput] = useState("");
  const [iconQuery, setIconQuery] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setComponentQuery(componentInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [componentInput]);

  useEffect(() => {
    const handle = setTimeout(() => setTokenQuery(tokenInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [tokenInput]);

  useEffect(() => {
    const handle = setTimeout(() => setIconQuery(iconInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [iconInput]);

  const componentUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (componentQuery) params.set("search", componentQuery);
    params.set("limit", "30");
    const query = params.toString();
    return `/api/mcp/components${query ? `?${query}` : ""}`;
  }, [componentQuery]);

  const tokensUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (tokenQuery) params.set("search", tokenQuery);
    const query = params.toString();
    return `/api/mcp/tokens${query ? `?${query}` : ""}`;
  }, [tokenQuery]);

  const iconsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (iconQuery) params.set("search", iconQuery);
    params.set("limit", "24");
    const query = params.toString();
    return `/api/mcp/icons${query ? `?${query}` : ""}`;
  }, [iconQuery]);

  const {
    data: componentsData,
    error: componentsError,
    isLoading: componentsLoading,
  } = useSWR<ComponentsResponse>(componentUrl, fetcher, { keepPreviousData: true });

  const components = componentsData?.components ?? [];

  useEffect(() => {
    if (components.length === 0) {
      return;
    }
    if (!selectedComponentId || !components.some((item) => item.id === selectedComponentId)) {
      setSelectedComponentId(components[0].id);
    }
  }, [components, selectedComponentId]);

  const componentDetailsUrl = useMemo(() => {
    if (!selectedComponentId) return null;
    return `/api/mcp/components/${encodeURIComponent(selectedComponentId)}?examples=true`;
  }, [selectedComponentId]);

  const {
    data: componentDetails,
    error: componentDetailsError,
    isLoading: componentDetailsLoading,
  } = useSWR<ComponentDetailsResponse>(componentDetailsUrl, fetcher, {
    keepPreviousData: true,
  });

  const { data: tokensData, error: tokensError, isLoading: tokensLoading } = useSWR<TokensResponse>(
    tokensUrl,
    fetcher,
    { keepPreviousData: true }
  );

  const tokens = tokensData?.tokens ?? [];

  const { data: iconsData, error: iconsError, isLoading: iconsLoading } = useSWR<IconsResponse>(
    iconsUrl,
    fetcher,
    { keepPreviousData: true }
  );

  const icons = iconsData?.icons ?? [];

  const handleSelectComponent = useCallback((componentId: string) => {
    setSelectedComponentId(componentId);
    trackEvent("mcp.component_selected", { componentId });
  }, []);

  const selectedMetadata = componentDetails?.metadata;
  const selectedExamples = componentDetails?.examples ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Text type={Text.types.TEXT1} weight={Text.weights.BOLD} id="mcp-title">
            Vibe MCP workspace
          </Text>
          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
            Pesquise componentes, tokens e ícones oficiais diretamente da fonte do Design System sem sair do CRM.
            Execute migrações guiadas pelo MCP e mantenha o código alinhado aos padrões do Monday.
          </Text>
        </div>
      </header>

      <section className={styles.body} aria-labelledby="mcp-title">
        <article className={styles.section} aria-labelledby="components-title">
          <div className={styles.sectionHeader}>
            <Flex direction={Flex.directions.COLUMN} gap={4}>
              <Text id="components-title" type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                Catálogo de componentes
              </Text>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Navegue pelo inventário oficial e abra detalhes, props e exemplos em tempo real.
              </Text>
            </Flex>
          </div>

          <div className={styles.filters}>
            <TextField
              title="Buscar componentes"
              placeholder="ex: Dropdown, People, Timeline"
              value={componentInput}
              onChange={setComponentInput}
            />
          </div>

          {componentsLoading ? (
            <Flex justify={Flex.justify.CENTER} align={Flex.align.CENTER}>
              <Loader size={Loader.sizes.SMALL} />
            </Flex>
          ) : componentsError ? (
            <div className={styles.errorState} role="alert">
              <Text type={Text.types.TEXT3}>Erro: {componentsError.message}</Text>
            </div>
          ) : components.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <Text type={Text.types.TEXT3}>
                Nenhum componente retornado para a busca atual. Ajuste o filtro ou confira a configuração do MCP.
              </Text>
            </div>
          ) : (
            <div className={styles.list}>
              {components.map((component) => {
                const isSelected = component.id === selectedComponentId;
                return (
                  <button
                    type="button"
                    key={component.id}
                    className={styles.componentCard}
                    data-selected={isSelected ? "true" : undefined}
                    onClick={() => handleSelectComponent(component.id)}
                  >
                    <Flex justify={Flex.justify.SPACE_BETWEEN} align={Flex.align.CENTER}>
                      <Text type={Text.types.TEXT2} weight={Text.weights.MEDIUM}>
                        {component.name}
                      </Text>
                      {component.status ? (
                        <span className={styles.badge}>{component.status}</span>
                      ) : null}
                    </Flex>
                    {component.description ? (
                      <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                        {component.description}
                      </Text>
                    ) : null}
                    <div className={styles.componentMeta}>
                      {component.tags?.length ? (
                        <div className={styles.badgeList}>
                          {component.tags.map((tag) => (
                            <span key={tag} className={styles.badge}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {component.href ? (
                        <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                          {component.href}
                        </Text>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles.section} aria-live="polite">
            {componentDetailsLoading && !componentDetails ? (
              <Flex justify={Flex.justify.CENTER} align={Flex.align.CENTER}>
                <Loader size={Loader.sizes.SMALL} />
              </Flex>
            ) : componentDetailsError ? (
              <div className={styles.errorState} role="alert">
                <Text type={Text.types.TEXT3}>Falha ao carregar detalhes: {componentDetailsError.message}</Text>
              </div>
            ) : selectedMetadata ? (
              <Flex direction={Flex.directions.COLUMN} gap={16}>
                <Flex direction={Flex.directions.COLUMN} gap={4}>
                  <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                    {selectedMetadata.name}
                  </Text>
                  {selectedMetadata.description ? (
                    <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                      {selectedMetadata.description}
                    </Text>
                  ) : null}
                </Flex>

                {selectedMetadata.tokens?.length ? (
                  <div>
                    <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
                      Tokens relacionados
                    </Text>
                    <div className={styles.badgeList}>
                      {selectedMetadata.tokens.map((token) => (
                        <span key={token} className={styles.badge}>
                          {token}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedMetadata.props?.length ? (
                  <div>
                    <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
                      Props principais
                    </Text>
                    <div className={styles.propList}>
                      {selectedMetadata.props.map((prop) => (
                        <div key={prop.name} className={styles.propItem}>
                          <Text type={Text.types.TEXT3} weight={Text.weights.MEDIUM}>
                            {prop.name}
                            {prop.required ? " *" : ""}
                          </Text>
                          {prop.type ? (
                            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                              Tipo: {prop.type}
                            </Text>
                          ) : null}
                          {prop.defaultValue !== undefined ? (
                            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                              Default: {String(prop.defaultValue)}
                            </Text>
                          ) : null}
                          {prop.description ? (
                            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                              {prop.description}
                            </Text>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedMetadata.guidelines?.length ? (
                  <div>
                    <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
                      Diretrizes de uso
                    </Text>
                    <ul className={styles.list}>
                      {selectedMetadata.guidelines.map((item) => (
                        <li key={item}>
                          <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                            {item}
                          </Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {selectedExamples.length ? (
                  <div>
                    <Text type={Text.types.TEXT3} weight={Text.weights.BOLD}>
                      Exemplos oficiais
                    </Text>
                    <div className={styles.list}>
                      {selectedExamples.map((example) => (
                        <div key={example.title} className={styles.componentCard}>
                          <Flex direction={Flex.directions.COLUMN} gap={4}>
                            <Text type={Text.types.TEXT3} weight={Text.weights.MEDIUM}>
                              {example.title}
                            </Text>
                            {example.description ? (
                              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                                {example.description}
                              </Text>
                            ) : null}
                          </Flex>
                          <pre className={styles.codeBlock}>
                            <code>{example.code}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className={styles.footerActions}>
                  {selectedMetadata.sourceUrl ? (
                    <Button
                      kind={Button.kinds.SECONDARY}
                      size={Button.sizes.SMALL}
                      onClick={() => window.open(selectedMetadata.sourceUrl!, "_blank", "noopener")}
                    >
                      Abrir documentação
                    </Button>
                  ) : null}
                  <Button
                    kind={Button.kinds.PRIMARY}
                    size={Button.sizes.SMALL}
                    onClick={() => trackEvent("mcp.component_metadata_viewed", { componentId: selectedMetadata.id })}
                  >
                    Registrar leitura
                  </Button>
                </div>
              </Flex>
            ) : (
              <div className={styles.emptyState} role="status">
                <Text type={Text.types.TEXT3}>Selecione um componente para visualizar os detalhes.</Text>
              </div>
            )}
          </div>
        </article>

        <article className={styles.section} aria-labelledby="tokens-title">
          <div className={styles.sectionHeader}>
            <Flex direction={Flex.directions.COLUMN} gap={4}>
              <Text id="tokens-title" type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                Tokens de design
              </Text>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Consulte valores atualizados para aplicar espaçamentos, cores e tipografia.
              </Text>
            </Flex>
          </div>

          <div className={styles.filters}>
            <TextField
              title="Filtrar tokens"
              placeholder="ex: color/primary, space/xxl"
              value={tokenInput}
              onChange={setTokenInput}
            />
          </div>

          {tokensLoading ? (
            <Flex justify={Flex.justify.CENTER} align={Flex.align.CENTER}>
              <Loader size={Loader.sizes.SMALL} />
            </Flex>
          ) : tokensError ? (
            <div className={styles.errorState} role="alert">
              <Text type={Text.types.TEXT3}>Erro ao carregar tokens: {tokensError.message}</Text>
            </div>
          ) : tokens.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <Text type={Text.types.TEXT3}>
                Nenhum token encontrado. Ajuste o termo de busca ou verifique o MCP.
              </Text>
            </div>
          ) : (
            <div className={styles.tokenGrid}>
              {tokens.map((token) => (
                <div key={token.name} className={styles.tokenCard}>
                  <Text type={Text.types.TEXT3} weight={Text.weights.MEDIUM}>
                    {token.name}
                  </Text>
                  <div className={styles.tokenPreview}>
                    <span>{token.value}</span>
                    {token.category ? <span>{token.category}</span> : null}
                  </div>
                  {token.description ? (
                    <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                      {token.description}
                    </Text>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className={styles.section} aria-labelledby="icons-title">
          <div className={styles.sectionHeader}>
            <Flex direction={Flex.directions.COLUMN} gap={4}>
              <Text id="icons-title" type={Text.types.TEXT2} weight={Text.weights.BOLD}>
                Biblioteca de ícones
              </Text>
              <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                Explore os ícones públicos do Vibe com tags e caminhos de import.
              </Text>
            </Flex>
          </div>

          <div className={styles.filters}>
            <TextField
              title="Buscar ícones"
              placeholder="ex: automation, arrow, status"
              value={iconInput}
              onChange={setIconInput}
            />
          </div>

          {iconsLoading ? (
            <Flex justify={Flex.justify.CENTER} align={Flex.align.CENTER}>
              <Loader size={Loader.sizes.SMALL} />
            </Flex>
          ) : iconsError ? (
            <div className={styles.errorState} role="alert">
              <Text type={Text.types.TEXT3}>Erro ao carregar ícones: {iconsError.message}</Text>
            </div>
          ) : icons.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <Text type={Text.types.TEXT3}>Nenhum ícone encontrado para o filtro atual.</Text>
            </div>
          ) : (
            <div className={styles.iconGrid}>
              {icons.map((icon) => (
                <div key={icon.name} className={styles.iconCard}>
                  <div className={styles.iconPreview} aria-hidden>
                    {icon.svg ? (
                      <span dangerouslySetInnerHTML={{ __html: icon.svg }} />
                    ) : (
                      <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                        Sem preview
                      </Text>
                    )}
                  </div>
                  <Text type={Text.types.TEXT3} weight={Text.weights.MEDIUM}>
                    {icon.name}
                  </Text>
                  {icon.importPath ? (
                    <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                      {icon.importPath}
                    </Text>
                  ) : null}
                  {icon.tags?.length ? (
                    <div className={styles.badgeList}>
                      {icon.tags.map((tag) => (
                        <span key={tag} className={styles.badge}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

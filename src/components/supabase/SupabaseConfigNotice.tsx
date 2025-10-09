import Link from "next/link";

export default function SupabaseConfigNotice({
  featureLabel,
  documentationPath = "docs/dev_setup_crm.md",
}: {
  featureLabel: string;
  documentationPath?: string;
}) {
  return (
    <section className="page" aria-labelledby="supabase-config-heading">
      <header className="pageHeader">
        <h1 id="supabase-config-heading">Configuração do Supabase necessária</h1>
        <p>
          Não foi possível carregar {featureLabel} porque as variáveis
          <code> NEXT_PUBLIC_SUPABASE_URL </code>
          e
          <code> NEXT_PUBLIC_SUPABASE_ANON_KEY </code>
          não estão definidas neste ambiente.
        </p>
      </header>
      <div className="card">
        <p>
          Para continuar, defina ambas as variáveis no arquivo <code>.env.local</code>
          e reinicie o servidor. Consulte a documentação de setup para obter os
          valores gerados pelo <code>supabase start</code>.
        </p>
        <ul>
          <li>
            Copie <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            do dashboard do projeto Supabase ou do arquivo <code>.supabase/.env</code>.
          </li>
          <li>Reinicie o servidor com <code>pnpm dev</code> após salvar o arquivo.</li>
          <li>
            Verifique o passo a passo em {" "}
            <Link href={`/${documentationPath}`}>{documentationPath}</Link>.
          </li>
        </ul>
      </div>
    </section>
  );
}

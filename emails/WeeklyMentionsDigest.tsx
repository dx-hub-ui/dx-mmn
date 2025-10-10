import * as React from "react";

type WeeklyMentionsDigestProps = {
  name: string;
  timezone: string;
  totalMentions: number;
  sections: {
    label: string;
    items: {
      id: string;
      title: string | null;
      snippet: string | null;
      link: string | null;
      actorName: string;
      createdAt: string;
    }[];
  }[];
};

function formatDate(timestamp: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }
}

export function WeeklyMentionsDigest({ name, timezone, totalMentions, sections }: WeeklyMentionsDigestProps) {
  return (
    <>
      <p style={{ fontSize: "16px", margin: "0 0 16px" }}>Olá {name},</p>
      <p style={{ fontSize: "16px", margin: "0 0 24px" }}>
        Aqui vai um resumo das {totalMentions === 1 ? "menção" : "menções"} em que você foi citado(a) nos últimos 7 dias.
        Use este e-mail para voltar rapidamente às conversas importantes.
      </p>
      {sections.map((section) => (
        <table
          key={section.label}
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "collapse", marginBottom: "24px" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  padding: "12px 16px",
                  backgroundColor: "#F0F3FF",
                  borderRadius: "12px 12px 0 0",
                }}
              >
                {section.label}
              </td>
            </tr>
            {section.items.map((item, index) => (
              <tr key={item.id}>
                <td
                  style={{
                    padding: "16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #E3E8FF",
                    borderTop: index === 0 ? "none" : "1px solid #E3E8FF",
                  }}
                >
                  <p style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>{item.title ?? "Atualização"}</p>
                  <p style={{ fontSize: "14px", color: "#4E5983", margin: "0 0 8px" }}>
                    {item.actorName} · {formatDate(item.createdAt, timezone)}
                  </p>
                  {item.snippet ? (
                    <p style={{ fontSize: "15px", margin: "0 0 12px", lineHeight: 1.5 }}>{item.snippet}</p>
                  ) : null}
                  {item.link ? (
                    <a
                      href={item.link}
                      style={{
                        display: "inline-block",
                        padding: "10px 18px",
                        fontSize: "14px",
                        color: "#ffffff",
                        backgroundColor: "#005DF2",
                        borderRadius: "8px",
                        textDecoration: "none",
                      }}
                    >
                      Abrir conversa
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <p style={{ fontSize: "14px", color: "#4E5983", marginTop: "24px" }}>
        Este resumo é enviado considerando o fuso horário <strong>{timezone}</strong>. Gerencie suas preferências no painel de
        notificações sempre que quiser.
      </p>
    </>
  );
}

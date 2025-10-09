import React, { type ReactNode } from "react";

export type TransactionalLayoutProps = {
  heading: string;
  previewText?: string;
  children: ReactNode;
};

export function TransactionalLayout({ heading, previewText, children }: TransactionalLayoutProps) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {previewText ? (
          <title>{previewText}</title>
        ) : (
          <title>{heading}</title>
        )}
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#f5f7fb", fontFamily: "Inter, Arial, sans-serif" }}>
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ padding: "32px 0", backgroundColor: "#f5f7fb" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "32px",
                    boxShadow: "0 6px 24px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <tbody>
                    <tr>
                      <td>
                        <h1 style={{ fontSize: "24px", marginBottom: "16px", color: "#1f2937" }}>{heading}</h1>
                        <div style={{ fontSize: "16px", lineHeight: "1.6", color: "#4b5563" }}>{children}</div>
                        <p style={{ marginTop: "32px", fontSize: "14px", color: "#9ca3af" }}>
                          — Equipe DX Hub
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

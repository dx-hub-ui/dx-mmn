export function normalizeSnoozeInput(raw: string): string {
  if (!raw) {
    throw new Error("Informe uma data e hora válidas para adiar a tarefa.");
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Não foi possível interpretar a data informada.");
  }

  const now = new Date();
  if (date <= now) {
    throw new Error("Escolha um horário futuro para adiar a tarefa.");
  }

  return date.toISOString();
}

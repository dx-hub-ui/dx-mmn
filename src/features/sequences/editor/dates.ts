export type WorkWindowConfig = {
  timeZone: string;
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
  clampEnabled: boolean;
};

function parseTime(value: string): { hours: number; minutes: number } {
  const [hours = "0", minutes = "0"] = value.split(":");
  return { hours: Number.parseInt(hours, 10) || 0, minutes: Number.parseInt(minutes, 10) || 0 };
}

function getIsoWeekDay(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function calculateDueDate(
  enrolledAtIso: string,
  offsetDays: number,
  offsetHours: number,
  config: WorkWindowConfig
): string {
  const dueDate = new Date(enrolledAtIso);

  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("data de inscrição inválida");
  }

  dueDate.setUTCDate(dueDate.getUTCDate() + offsetDays);
  dueDate.setUTCHours(dueDate.getUTCHours() + offsetHours);

  if (!config.clampEnabled) {
    return dueDate.toISOString();
  }

  const allowedDays = config.workDays.length > 0 ? config.workDays : [1, 2, 3, 4, 5];
  const start = parseTime(config.workStartTime);
  const end = parseTime(config.workEndTime);
  const endTotalMinutes = end.hours * 60 + end.minutes;
  const startTotalMinutes = start.hours * 60 + start.minutes;

  const clampToStart = () => {
    dueDate.setUTCHours(start.hours, start.minutes, 0, 0);
  };

  const moveToNextAllowedDay = () => {
    do {
      dueDate.setUTCDate(dueDate.getUTCDate() + 1);
    } while (!allowedDays.includes(getIsoWeekDay(dueDate)));
    clampToStart();
  };

  if (!allowedDays.includes(getIsoWeekDay(dueDate))) {
    clampToStart();
    moveToNextAllowedDay();
  }

  const currentMinutes = dueDate.getUTCHours() * 60 + dueDate.getUTCMinutes();

  if (currentMinutes < startTotalMinutes) {
    clampToStart();
  } else if (currentMinutes > endTotalMinutes) {
    moveToNextAllowedDay();
  }

  return dueDate.toISOString();
}

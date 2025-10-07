const DDI_BR = "+55";

export type PhoneNormalizationSuccess = {
  success: true;
  e164: string;
  nationalNumber: string;
  areaCode: string;
};

export type PhoneNormalizationError = {
  success: false;
  reason:
    | "required"
    | "too_short"
    | "too_long"
    | "invalid_area"
    | "invalid_pattern";
};

const VALID_AREA_CODES = new Set([
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "21",
  "22",
  "24",
  "27",
  "28",
  "31",
  "32",
  "33",
  "34",
  "35",
  "37",
  "38",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "51",
  "53",
  "54",
  "55",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "71",
  "73",
  "74",
  "75",
  "77",
  "79",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
]);

function stripPlus55(value: string): string {
  if (value.startsWith("+")) {
    return value.slice(1);
  }
  return value;
}

export function normalizeBrazilPhone(value: string | null | undefined):
  | PhoneNormalizationSuccess
  | PhoneNormalizationError {
  if (!value) {
    return { success: false, reason: "required" };
  }

  const digits = stripPlus55(value).replace(/\D+/g, "");

  if (!digits) {
    return { success: false, reason: "required" };
  }

  let national = digits;
  if (national.startsWith("55") && national.length > 11) {
    national = national.slice(2);
  }

  if (national.length < 10) {
    return { success: false, reason: "too_short" };
  }

  if (national.length > 11) {
    return { success: false, reason: "too_long" };
  }

  const areaCode = national.slice(0, 2);
  const subscriber = national.slice(2);

  if (!VALID_AREA_CODES.has(areaCode)) {
    return { success: false, reason: "invalid_area" };
  }

  const mobilePattern = /^9\d{8}$/;
  const landlinePattern = /^\d{8}$/;

  if (subscriber.length === 9) {
    if (!mobilePattern.test(subscriber)) {
      return { success: false, reason: "invalid_pattern" };
    }
  } else if (subscriber.length === 8) {
    if (!landlinePattern.test(subscriber)) {
      return { success: false, reason: "invalid_pattern" };
    }
  } else {
    return { success: false, reason: "invalid_pattern" };
  }

  const e164 = `${DDI_BR}${areaCode}${subscriber}`;

  return {
    success: true,
    e164: `+${e164.replace(/^\+?/, "")}`,
    nationalNumber: `${areaCode}${subscriber}`,
    areaCode,
  };
}

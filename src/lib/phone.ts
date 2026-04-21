export function normalizeEthiopianPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "").trim();

  if (!digits) return "";

  if (digits.startsWith("+251")) {
    return `+251${digits.slice(4).replace(/\D/g, "")}`;
  }

  if (digits.startsWith("251")) {
    return `+${digits.replace(/\D/g, "")}`;
  }

  const local = digits.replace(/\D/g, "").replace(/^0/, "");
  if (!local) return "";

  return `+251${local}`;
}

export function maskPhone(phone: string): string {
  const normalized = normalizeEthiopianPhone(phone);
  if (normalized.length < 6) return normalized;

  return `${normalized.slice(0, 5)} ••• ••${normalized.slice(-2)}`;
}

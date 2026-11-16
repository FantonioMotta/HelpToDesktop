export function formatTimeInput(raw: string): string {
  // Keep values that already contain a separator (e.g. pasted "9:30") coherent.
  const colon = raw.indexOf(":");
  if (colon >= 0) {
    const hours = raw.slice(0, colon).replace(/\D/g, "").slice(0, 2);
    const minutes = raw.slice(colon + 1).replace(/\D/g, "").slice(0, 2);
    if (!minutes) return hours.length === 2 ? `${hours}:` : hours;
    return `${hours.padStart(2, "0")}:${minutes}`;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function normalizeTime(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  let h = 0;
  let m = 0;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
  }
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isValidDateBR(value: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return false;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
}

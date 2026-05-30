// ─── Phone ────────────────────────────────────────────────

/** Auto-format a phone string to (xxx) xxx-xxxx as the user types.
 *  Strips all non-digits and caps at 10 digits, so invalid characters
 *  simply cannot be entered. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3)  return `(${digits}`;
  if (digits.length <= 6)  return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Returns an error string if the phone is present but not a full 10-digit US number. */
export function validatePhone(value: string): string | null {
  if (!value.trim()) return null; // optional — caller adds "required" check separately
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return "Enter a valid 10-digit phone number";
  return null;
}

// ─── Email ────────────────────────────────────────────────

/** Returns an error string if the email is present but malformed. */
export function validateEmail(value: string): string | null {
  if (!value.trim()) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(value.trim())) return "Enter a valid email address";
  return null;
}

// ─── Generic ──────────────────────────────────────────────

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  return null;
}

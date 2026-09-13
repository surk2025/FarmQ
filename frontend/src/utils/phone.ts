/**
 * Canonical phone number normalization utility for FarmQ
 * Converts any valid Indian mobile format into the canonical format: +91XXXXXXXXXX
 */

export const normalizePhoneNumber = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  // Strip leading country tags like "IN" or "IND"
  const stripped = trimmed.replace(/^(IN|IND)\b/i, '').trim();
  let digits = stripped.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  // Fallback if exactly 10 digits
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return digits ? `+91${digits}` : '';
};

export const extract10DigitPhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  const stripped = trimmed.replace(/^(IN|IND)\b/i, '').trim();
  let digits = stripped.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
};

export const formatPhoneForDisplay = (phone: string): string => {
  const digits = extract10DigitPhone(phone);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
};

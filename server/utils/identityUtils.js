const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function normalizeEmail(email) {
  if (email === undefined || email === null) return "";
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return EMAIL_REGEX.test(normalized);
}

function normalizeIndianPhone(phone) {
  if (phone === undefined || phone === null) return "";

  let normalized = String(phone).trim();
  normalized = normalized.replace(/[\s\-().]/g, "");

  if (normalized.startsWith("+")) {
    normalized = normalized.substring(1);
  }

  if (normalized.startsWith("91") && normalized.length === 12) {
    normalized = normalized.substring(2);
  } else if (normalized.startsWith("0") && normalized.length === 11) {
    normalized = normalized.substring(1);
  }

  return normalized.trim();
}

function isValidIndianPhone(phone) {
  const normalized = normalizeIndianPhone(phone);
  return INDIAN_MOBILE_REGEX.test(normalized);
}

function validateAndNormalizeIdentity({ email, phone, requireBoth = true }) {
  const errors = [];

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizeIndianPhone(phone);

  if (requireBoth || email !== undefined) {
    if (!normalizedEmail) {
      errors.push("Email is required");
    } else if (!isValidEmail(normalizedEmail)) {
      errors.push("Please enter a valid email address");
    }
  }

  if (requireBoth || phone !== undefined) {
    if (!normalizedPhone) {
      errors.push("Phone number is required");
    } else if (!isValidIndianPhone(normalizedPhone)) {
      errors.push("Please enter a valid 10-digit Indian mobile number");
    }
  }

  return {
    normalizedEmail,
    normalizedPhone,
    errors,
  };
}

module.exports = {
  EMAIL_REGEX,
  INDIAN_MOBILE_REGEX,
  normalizeEmail,
  isValidEmail,
  normalizeIndianPhone,
  isValidIndianPhone,
  validateAndNormalizeIdentity,
};

// A small validation toolkit. Handlers throw ValidationError and the central
// error middleware turns it into a clean 400 response.
export class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
  }
}

export function requireText(value, label, { max }) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${label} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }

  return trimmed;
}

export function optionalText(value, label, { max, fallback = "" }) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const trimmed = value.trim();

  if (trimmed.length > max) {
    throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  }

  return trimmed;
}

export function requireEmail(value) {
  const email = requireText(value, "Email", { max: 200 }).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Enter a valid email address.");
  }

  return email;
}

export function requirePassword(value) {
  if (typeof value !== "string" || value.length < 8) {
    throw new ValidationError("Password must be at least 8 characters.");
  }

  if (value.length > 200) {
    throw new ValidationError("Password must be 200 characters or fewer.");
  }

  return value;
}

export function oneOf(value, label, allowed, fallback) {
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new ValidationError(`${label} must be one of: ${allowed.join(", ")}.`);
}

export function requirePositiveNumber(value, label) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`${label} must be a number greater than zero.`);
  }

  return parsed;
}

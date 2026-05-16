import bcrypt from "bcryptjs";

const SESSION_COOKIE = "ridebook_session";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days
const HASH_ROUNDS = 12;

// In production this must be supplied via the environment. The dev fallback
// keeps local development simple but is intentionally not secret.
export const sessionSecret =
  process.env.SESSION_SECRET || "ridebook-dev-secret-change-me";

export function hashPassword(password) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(password, passwordHash);
}

export function setSessionCookie(response, memberId) {
  response.cookie(SESSION_COOKIE, memberId, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE
  });
}

export function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE);
}

export function readSession(request) {
  return request.signedCookies?.[SESSION_COOKIE] || null;
}

// Roster listings are public, so never leak credentials or contact details.
export function toPublicMember(member) {
  if (!member) {
    return null;
  }

  const { passwordHash, email, ...publicFields } = member;
  return publicFields;
}

// The signed-in member is allowed to see their own email but never the hash.
export function toPrivateMember(member) {
  if (!member) {
    return null;
  }

  const { passwordHash, ...privateFields } = member;
  return privateFields;
}

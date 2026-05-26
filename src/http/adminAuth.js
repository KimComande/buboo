import crypto from "node:crypto";

const adminCookieName = "buboo_admin_session";
const adminSessionMaxAgeSeconds = 60 * 60 * 12;

export function configuredAdminPath() {
  return normalizePath(process.env.ADMIN_PATH ?? "/buboo-ops-local");
}

export function verifyAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD ?? "local-admin";
  return timingSafeEqualString(String(password ?? ""), expected);
}

export function createAdminCookie() {
  const issuedAt = String(Date.now());
  const value = `${issuedAt}.${signAdminSession(issuedAt)}`;
  return [
    `${adminCookieName}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${adminSessionMaxAgeSeconds}`,
    process.env.COOKIE_SECURE === "true" ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function isAdminAuthenticated(request) {
  const session = parseCookies(request.headers.get("cookie") ?? "")[adminCookieName];
  if (!session) return false;

  const [issuedAt, signature] = session.split(".");
  if (!issuedAt || !signature) return false;
  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) return false;
  if (Date.now() - issuedAtNumber > adminSessionMaxAgeSeconds * 1000) return false;

  return timingSafeEqualString(signature, signAdminSession(issuedAt));
}

export function isBearerAuthorized(request, expectedSecret = process.env.CRON_SECRET ?? "") {
  if (!expectedSecret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  return timingSafeEqualString(authorization.slice(prefix.length), expectedSecret);
}

function signAdminSession(issuedAt) {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "local-admin")
    .update(issuedAt)
    .digest("hex");
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), part.slice(index + 1)];
      }),
  );
}

function normalizePath(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "/") return "/buboo-ops-local";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

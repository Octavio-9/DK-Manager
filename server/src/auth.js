import jwt from "jsonwebtoken";

const TOKEN_COOKIE = "dk_token";
const isProduction = process.env.NODE_ENV === "production";

export function signAuthToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });
}

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[TOKEN_COOKIE];
    if (!token) return res.status(401).json({ error: "Non authentifié" });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET manquant" });
    req.auth = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ error: "Session invalide" });
  }
}

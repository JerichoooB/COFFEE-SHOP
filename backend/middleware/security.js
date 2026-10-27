import jwt from "jsonwebtoken";
export const cookieName = "brewhaven_session";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
export function issueSession(res, user, secret) {
  res.cookie(
    cookieName,
    jwt.sign({ sub: user.id, version: user.session_version ?? 0 }, secret, {
      expiresIn: "7d",
      issuer: "brew-haven",
      audience: "brew-haven-web",
    }),
    cookieOptions,
  );
}
export function auth(db, secret) {
  return async (req, res, next) => {
    try {
      const token = req.cookies[cookieName];
      if (!token)
        return res.status(401).json({ error: "Please sign in to continue." });
      let payload;
      try {
        payload = jwt.verify(token, secret, {
          issuer: "brew-haven",
          audience: "brew-haven-web",
          algorithms: ["HS256"],
        });
      } catch {
        return res
          .status(401)
          .json({ error: "Your session has expired. Please sign in again." });
      }
      const r = await db.query(
        "SELECT id,full_name,email,role,session_version FROM users WHERE id=$1",
        [payload.sub],
      );
      if (!r.rows[0])
        return res.status(401).json({ error: "Please sign in again." });
      if ((payload.version ?? 0) !== (r.rows[0].session_version ?? 0))
        return res
          .status(401)
          .json({
            error: "Your account security changed. Please sign in again.",
          });
      req.user = r.rows[0];
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function admin(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Administrator access is required." });
  next();
}
export function originGuard(origin) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.get("origin") !== origin)
      return res.status(403).json({ error: "Request origin is not allowed." });
    next();
  };
}

export function publicUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
  };
}

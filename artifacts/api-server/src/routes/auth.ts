import { Router, type IRouter } from "express";
import { eq, and, isNull, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import type { PublicUser } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter, forgotPasswordRateLimiter } from "../middleware/rate-limit";
import { sendPasswordResetEmail } from "../lib/mailer";

const router: IRouter = Router();

function sanitizeUser(u: typeof usersTable.$inferSelect): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}

/**
 * Return the trusted frontend origin for password-reset links.
 *
 * Only uses values that are set at deployment time by the operator or the
 * Replit platform — never request-derived headers. Using the Host header
 * would allow an attacker to supply a malicious domain and receive the
 * reset token in the emailed link.
 *
 * Returns null when no trusted origin is configured so the caller can
 * skip email delivery rather than send a manipulable link.
 */
function getTrustedAppUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return null;
}

// ── Login ─────────────────────────────────────────────────────────────────────

// POST /api/auth/login
router.post("/auth/login", loginRateLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()))
    .limit(1);

  if (!user) {
    // Constant-time compare to prevent user enumeration
    await bcrypt.compare(password, "$2b$10$invalidhashpadding000000000000000000");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Update last login timestamp
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // Persist session
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userName = user.name;
  req.session.userEmail = user.email;

  res.json(sanitizeUser(user));
});

// ── Logout ────────────────────────────────────────────────────────────────────

// POST /api/auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("autflow.sid");
    res.json({ success: true });
  });
});

// ── Current user ──────────────────────────────────────────────────────────────

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json(sanitizeUser(user));
});

// ── Register ──────────────────────────────────────────────────────────────────

// POST /api/auth/register (owner-only after first user created)
router.post("/auth/register", requireAuth, async (req, res): Promise<void> => {
  if (req.session.userRole !== "owner") {
    res.status(403).json({ error: "Only owners can create new users" });
    return;
  }

  const { name, email, password, role } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const validRole = role === "owner" ? "owner" : "member";

  const [newUser] = await db
    .insert(usersTable)
    .values({ name: String(name).trim(), email: normalizedEmail, passwordHash, role: validRole })
    .returning();

  res.status(201).json(sanitizeUser(newUser));
});

// ── Change own password ───────────────────────────────────────────────────────

// PATCH /api/auth/password — change own password (requires current password)
router.patch("/auth/password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new passwords are required" });
    return;
  }
  if (String(newPassword).length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

// ── Update profile ────────────────────────────────────────────────────────────

// PATCH /api/auth/profile — update own name/email
router.patch("/auth/profile", requireAuth, async (req, res): Promise<void> => {
  const { name, email } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (name) updates.name = String(name).trim();
  if (email) updates.email = String(email).toLowerCase().trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.session.userId!))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Keep session in sync
  if (updates.name) req.session.userName = updated.name;
  if (updates.email) req.session.userEmail = updated.email;

  res.json(sanitizeUser(updated));
});

// ── Password reset — Forgot password ─────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 *
 * Accepts an email address. Always returns 200 regardless of whether the
 * email exists — this prevents user enumeration attacks.
 *
 * If the email belongs to a user:
 *  1. Invalidates any existing unused tokens for that user.
 *  2. Generates a new cryptographically secure token (64-char hex).
 *  3. Stores the token with a 1-hour expiry.
 *  4. Sends a password reset email.
 */
router.post(
  "/auth/forgot-password",
  forgotPasswordRateLimiter,
  async (req, res): Promise<void> => {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Always respond with 200 — do not reveal whether the email exists
    res.json({ success: true });

    // Fire-and-forget: find user and send email (errors are only logged)
    try {
      const normalizedEmail = String(email).toLowerCase().trim();
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, normalizedEmail))
        .limit(1);

      if (!user) return; // No such user — silently exit

      // Invalidate all existing unused tokens for this user
      await db
        .delete(passwordResetTokensTable)
        .where(
          and(
            eq(passwordResetTokensTable.userId, user.id),
            isNull(passwordResetTokensTable.usedAt)
          )
        );

      // Generate a secure token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      const appUrl = getTrustedAppUrl();
      if (!appUrl) {
        console.warn(
          "[forgot-password] No trusted app URL configured (set APP_URL or ensure REPLIT_DEV_DOMAIN is present). " +
          "Reset email not sent to avoid sending an attacker-influenced link. " +
          `Token for ${user.email}: ${token}`
        );
        return;
      }

      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).log?.error(err, "forgot-password: failed to send reset email");
      console.error("[forgot-password] Failed to send reset email:", err);
    }
  }
);

// ── Password reset — Validate token ──────────────────────────────────────────

/**
 * GET /api/auth/reset-password/validate?token=<token>
 *
 * Checks whether a reset token is valid (exists, not expired, not used).
 * Returns { valid: boolean, reason?: string }
 */
router.get("/auth/reset-password/validate", async (req, res): Promise<void> => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    res.json({ valid: false, reason: "No token provided." });
    return;
  }

  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token))
    .limit(1);

  if (!record) {
    res.json({ valid: false, reason: "This reset link is invalid." });
    return;
  }

  if (record.usedAt) {
    res.json({ valid: false, reason: "This reset link has already been used." });
    return;
  }

  if (record.expiresAt < new Date()) {
    res.json({ valid: false, reason: "This reset link has expired. Please request a new one." });
    return;
  }

  res.json({ valid: true });
});

// ── Password reset — Consume token ───────────────────────────────────────────

/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 *
 * Verifies the token, updates the user's password, marks the token as used,
 * and invalidates all existing tokens for the user.
 */
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body ?? {};

  if (!token || !password) {
    res.status(400).json({ error: "Token and new password are required" });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, String(token)))
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "This reset link is invalid." });
    return;
  }

  if (record.usedAt) {
    res.status(410).json({ error: "This reset link has already been used." });
    return;
  }

  if (record.expiresAt < new Date()) {
    res.status(410).json({
      error: "This reset link has expired. Please request a new one.",
    });
    return;
  }

  // Fetch the user
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, record.userId))
    .limit(1);

  if (!user) {
    res.status(400).json({ error: "User not found." });
    return;
  }

  // Update the password
  const passwordHash = await bcrypt.hash(String(password), 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));

  // Mark this token as used and invalidate all other unused tokens for the user
  const now = new Date();
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: now })
    .where(eq(passwordResetTokensTable.token, String(token)));

  // Clean up remaining unused tokens for this user
  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.id, 0) // always-true condition for type compatibility
      )
    );

  res.json({ success: true });
});

export default router;

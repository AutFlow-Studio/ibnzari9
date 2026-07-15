/**
 * Email delivery via Resend.
 *
 * Requires RESEND_API_KEY (injected by the Replit Resend connector).
 * Falls back to console logging when the key is not set — useful in dev
 * without an active Resend connection.
 *
 * FROM_EMAIL overrides the sender address (must be a verified domain in Resend).
 * Defaults to Resend's shared testing address for immediate out-of-box use.
 */
import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL ?? "AutFlow Studio <onboarding@resend.dev>";

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const client = getResend();

  if (!client) {
    // Dev fallback: log the link so the flow can still be tested
    console.warn("[mailer] RESEND_API_KEY is not set — password reset email not sent.");
    console.warn(`[mailer] Reset URL for ${to}: ${resetUrl}`);
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;border:1px solid #27272a;padding:40px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:#7c3aed;border-radius:12px;margin-bottom:16px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                  <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                  <path d="M12 3v6"/>
                </svg>
              </div>
              <p style="margin:0;font-size:20px;font-weight:700;color:#fafafa;">AutFlow Studio</p>
              <p style="margin:4px 0 0;font-size:13px;color:#71717a;">Agency Owner Operating System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding-bottom:24px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#fafafa;">Reset your password</h1>
              <p style="margin:0 0 8px;font-size:15px;color:#a1a1aa;line-height:1.6;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.6;">
                We received a request to reset the password for your account.
                Click the button below to set a new password. This link expires in <strong style="color:#d4d4d8;">1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding-top:24px;border-top:1px solid #27272a;">
              <p style="margin:0 0 8px;font-size:13px;color:#52525b;">If the button doesn't work, copy and paste this URL into your browser:</p>
              <p style="margin:0;font-size:12px;color:#7c3aed;word-break:break-all;">${resetUrl}</p>
            </td>
          </tr>
          <!-- Security note -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:13px;color:#52525b;line-height:1.5;">
                If you didn't request a password reset, you can safely ignore this email —
                your password won't change unless you click the link above.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await client.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your AutFlow Studio password",
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

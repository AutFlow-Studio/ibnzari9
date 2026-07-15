import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireOwner } from "../middleware/auth";

const router: IRouter = Router();

// Destructive reset endpoint: truncates all business data so the app can be
// re-seeded from scratch.
//
// Safety gates (ALL must pass before any SQL runs):
//   1. ENABLE_RESET_ENDPOINT env var must equal exactly "true".
//      This must never be set in production deployments.
//   2. Caller must have the "owner" role (requireOwner middleware).
//   3. Request body must contain confirmationPhrase === "DELETE ALL DATA".
//
// Returns 404 when the env flag is absent so the endpoint is invisible to
// scanners in production environments.
router.post("/admin/reset", requireOwner, async (req, res): Promise<void> => {
  // Gate 1: env flag — endpoint is invisible unless explicitly enabled.
  if (process.env.ENABLE_RESET_ENDPOINT !== "true") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Gate 2: typed confirmation phrase — prevents accidental API calls.
  const { confirmationPhrase } = req.body as { confirmationPhrase?: string };
  if (confirmationPhrase !== "DELETE ALL DATA") {
    res.status(422).json({
      error: "Confirmation phrase does not match. Send { confirmationPhrase: \"DELETE ALL DATA\" }.",
    });
    return;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      activity,
      deliverables,
      documents,
      meetings,
      notes,
      payments,
      tasks,
      projects,
      clients
    RESTART IDENTITY CASCADE
  `);

  res.json({ success: true });
});

export default router;

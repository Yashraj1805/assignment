/**
 * Shared (safe) exports that can be imported by both client and server code.
 *
 * Keep this file free of server-only logic so it can be bundled into the client.
 */

export type LessonStyle = "text" | "visual" | "quiz";

// Decision policy identifier shown in the UI for auditability and iteration.
export const DECISION_POLICY_VERSION = "v1.3.0 — confidence-weighted";


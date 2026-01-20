"use server";

/**
 * Server-only reasoning actions.
 *
 * SECURITY: This file ensures all decision logic stays on the server.
 * Client components receive only computed outputs, never the reasoning weights,
 * scoring functions, or calibration logic.
 *
 * This prevents:
 * - Reverse engineering of decision weights
 * - Client-side manipulation of policy logic
 * - Exposure of internal scoring mechanisms
 */

import {
  buildExplainability,
  buildTutorInsight,
  type ExplainInput,
} from "./explain";

import type { LessonStyle } from "./shared";

/**
 * Server action: compute explainability output from user signals.
 * All reasoning happens server-side; client receives only the result.
 */
export async function computeExplainability(
  input: ExplainInput
): Promise<{
  decision: string;
  nextStyle: LessonStyle;
  reasons: string[];
  decisionTrace: string;
}> {
  return buildExplainability(input);
}

/**
 * Server action: generate tutor insight from user signals.
 * All reasoning happens server-side; client receives only the result.
 */
export async function computeTutorInsight(input: ExplainInput): Promise<string> {
  return buildTutorInsight(input);
}

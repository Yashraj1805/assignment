/**
 * SECURITY: Server-only reasoning engine.
 *
 * This module contains all decision logic, weights, and scoring functions.
 * It MUST NOT be imported by client components. Use lib/actions.ts instead.
 *
 * Protected elements:
 * - Weighted scoring algorithm (weights, normalization functions)
 * - Confidence calibration logic
 * - Knowledge signal detection patterns
 * - Decision tie-breaking rules
 *
 * This file is server-only because it's only imported by lib/actions.ts (which has "use server").
 * Next.js will tree-shake this from client bundles automatically.
 */

import { DECISION_POLICY_VERSION, type LessonStyle } from "./shared";

export type ExplainInput = {
  topic: string;
  priorKnowledge: string;
  confidence: number; // 1-5
  delta: number;
  startingStyle: LessonStyle;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(s: string) {
  return (s || "").trim();
}

function detectKnowledgeSignals(priorKnowledgeRaw: string) {
  const priorKnowledge = normalize(priorKnowledgeRaw);
  const lower = priorKnowledge.toLowerCase();

  const mentionsAdvanced =
    lower.includes("advanced") ||
    lower.includes("advance") ||
    lower.includes("expert") ||
    lower.includes("comfortable") ||
    lower.includes("strong");

  const mentionsBeginner =
    lower.includes("beginner") ||
    lower.includes("new") ||
    lower.includes("never") ||
    lower.includes("not much") ||
    lower.includes("basic") ||
    lower.includes("little");

  const mentionsExamples =
    lower.includes("example") ||
    lower.includes("practice") ||
    lower.includes("exercise") ||
    lower.includes("problem") ||
    lower.includes("quiz");

  const mentionsVisual =
    lower.includes("diagram") ||
    lower.includes("visual") ||
    lower.includes("chart") ||
    lower.includes("graph") ||
    lower.includes("picture");

  const isEmpty = priorKnowledge.length === 0;

  return {
    priorKnowledge,
    isEmpty,
    mentionsAdvanced,
    mentionsBeginner,
    mentionsExamples,
    mentionsVisual,
  };
}

function confidenceLabel(confidence: number) {
  const c = clamp(confidence, 1, 5);
  if (c <= 2) return "low";
  if (c === 3) return "medium";
  return "high";
}

function confidenceScore(confidence: number) {
  // Normalize confidence (1–5) to 0–1 for weighting.
  const c = clamp(confidence, 1, 5);
  return (c - 1) / 4;
}

function deltaBand(delta: number) {
  if (delta < 20) return "small";
  if (delta < 40) return "moderate";
  return "large";
}

function deltaScore(delta: number) {
  // Normalize delta to 0–1 for weighting (clamped for stability).
  // This demo uses a bounded range to avoid extreme inputs dominating.
  return clamp(delta / 60, 0, 1);
}

function styleLabel(style: LessonStyle) {
  switch (style) {
    case "visual":
      return "visual explanations";
    case "text":
      return "step-by-step text explanations";
    case "quiz":
      return "guided quizzes";
  }
}

function nextStepPreview(style: LessonStyle, topic: string) {
  const t = normalize(topic) || "this topic";
  switch (style) {
    case "visual":
      return `Next up: a visual walkthrough of ${t} using simple diagrams and annotated examples.`;
    case "text":
      return `Next up: a clear, structured explanation of ${t}, with short checkpoints to confirm understanding.`;
    case "quiz":
      return `Next up: short quiz-style prompts on ${t} so you can apply the idea and spot gaps quickly.`;
  }
}

function knowledgeLabel(priorKnowledgeRaw: string) {
  const k = detectKnowledgeSignals(priorKnowledgeRaw);
  if (k.isEmpty) return "unknown";
  if (k.mentionsAdvanced && !k.mentionsBeginner) return "advanced";
  if (k.mentionsBeginner && !k.mentionsAdvanced) return "beginner";
  return "mixed";
}

function detectCalibration(confidence: number, delta: number) {
  // Confidence calibration is about alignment between self-report and observed delta.
  // - Overconfidence: high confidence but low learning delta (signals mismatch; add guidance/checks)
  // - Underconfidence: low confidence but high learning delta (signals mismatch; move to practice sooner)
  const confBand = confidenceLabel(confidence);
  const dBand = deltaBand(delta);

  const isOverconfident = confBand === "high" && dBand === "small";
  const isUnderconfident = confBand === "low" && dBand === "large";

  return { confBand, dBand, isOverconfident, isUnderconfident };
}

function decideNextStyle(input: ExplainInput): {
  nextStyle: LessonStyle;
  scores: Record<LessonStyle, number>;
  contributions: Record<"delta" | "confidence" | "priorKnowledge" | "startingStyle", number>;
} {
  /**
   * Weighted signal scoring (deterministic, explainable)
   *
   * We compute a small score for each candidate style and choose the max:
   * - delta (weight 0.45): drives guidance vs. practice intensity
   * - confidence (weight 0.35): adjusts guidance vs. challenge
   * - prior knowledge (weight 0.15): adjusts scaffolding needs
   * - starting style bias (weight 0.05): reduces churn when signals are borderline
   *
   * The weights are intentionally simple, stable, and easy to audit.
   */

  const weights = {
    delta: 0.45,
    confidence: 0.35,
    priorKnowledge: 0.15,
    startingStyle: 0.05,
  } as const;

  const confN = confidenceScore(input.confidence); // 0..1
  const deltaN = deltaScore(input.delta); // 0..1
  const kLabel = knowledgeLabel(input.priorKnowledge);
  const calibration = detectCalibration(input.confidence, input.delta);

  // Base scores start at 0; we add weighted evidence.
  const scores: Record<LessonStyle, number> = { visual: 0, text: 0, quiz: 0 };

  // Delta signal: low delta -> guidance (visual/text); high delta -> practice (quiz).
  scores.visual += weights.delta * (1 - deltaN);
  scores.text += weights.delta * (1 - Math.abs(deltaN - 0.5) * 2); // peaks at mid deltas
  scores.quiz += weights.delta * deltaN;

  // Confidence signal: low confidence -> guidance; high confidence -> practice.
  scores.visual += weights.confidence * (1 - confN);
  scores.text += weights.confidence * (1 - Math.abs(confN - 0.5) * 2);
  scores.quiz += weights.confidence * confN;

  // Prior knowledge signal: beginner/unknown -> guidance; advanced -> practice; mixed -> text.
  if (kLabel === "advanced") {
    scores.quiz += weights.priorKnowledge * 1;
  } else if (kLabel === "beginner" || kLabel === "unknown") {
    scores.visual += weights.priorKnowledge * 1;
  } else {
    scores.text += weights.priorKnowledge * 1;
  }

  // Starting style bias: mild preference to reduce churn.
  scores[input.startingStyle] += weights.startingStyle;

  // Confidence calibration: when confidence and delta disagree, dampen extremes.
  // This makes the system feel less “hardcoded” and more safety-oriented.
  if (calibration.isOverconfident) {
    // High confidence but low delta: move away from quiz and toward explanation.
    scores.quiz -= 0.08;
    scores.text += 0.05;
    scores.visual += 0.03;
  }
  if (calibration.isUnderconfident) {
    // Low confidence but high delta: encourage earlier practice.
    scores.quiz += 0.07;
    scores.text -= 0.04;
    scores.visual -= 0.03;
  }

  // Deterministic tie-break: prefer text, then visual, then quiz for stability.
  const ordered: LessonStyle[] = ["text", "visual", "quiz"];
  let nextStyle: LessonStyle = ordered[0];
  for (const s of ordered) {
    if (scores[s] > scores[nextStyle]) nextStyle = s;
  }

  // Aggregate “influence” magnitudes for UI. These are stable scalars, not probabilities.
  const contributions = {
    delta: weights.delta * (Math.abs(deltaN - 0.5) + 0.25),
    confidence: weights.confidence * (Math.abs(confN - 0.5) + 0.25),
    priorKnowledge: weights.priorKnowledge * (kLabel === "mixed" ? 0.6 : 1),
    startingStyle: weights.startingStyle,
  };

  return { nextStyle, scores, contributions };
}

function decisionTitle(style: LessonStyle) {
  switch (style) {
    case "visual":
      return "Increase guidance with visuals";
    case "text":
      return "Keep a steady, structured explanation";
    case "quiz":
      return "Shift toward practice with quizzes";
  }
}

export function buildExplainability(
  input: ExplainInput
): {
  decision: string;
  nextStyle: LessonStyle;
  reasons: string[];
  decisionTrace: string;
} {
  const topic = normalize(input.topic) || "the topic";
  const conf = clamp(input.confidence, 1, 5);
  const confBand = confidenceLabel(conf);
  const dBand = deltaBand(input.delta);
  const k = detectKnowledgeSignals(input.priorKnowledge);

  const styleDecision = decideNextStyle(input);
  const nextStyle = styleDecision.nextStyle;
  const decision = decisionTitle(nextStyle);
  const calibration = detectCalibration(conf, input.delta);

  const reasons: string[] = [];

  reasons.push(
    `Based on your confidence level (${conf}/5, ${confBand}), the system adjusted guidance vs. practice.`
  );

  if (k.isEmpty) {
    reasons.push(
      `Because your prior knowledge response was brief, the system assumed we should validate foundations before moving fast.`
    );
  } else if (k.mentionsAdvanced && !k.mentionsBeginner) {
    reasons.push(
      `Because your prior knowledge indicates familiarity (“${k.priorKnowledge}”), the system inferred you can handle less repetition.`
    );
  } else if (k.mentionsBeginner && !k.mentionsAdvanced) {
    reasons.push(
      `Because your prior knowledge indicates you’re early in the topic (“${k.priorKnowledge}”), the system inferred you’ll benefit from clearer scaffolding.`
    );
  } else {
    reasons.push(
      `Because your prior knowledge indicates mixed familiarity (“${k.priorKnowledge}”), the system inferred we should balance explanation with checks.`
    );
  }

  reasons.push(
    `The system inferred that your learning delta (+${input.delta}) is ${dBand}, which determines how strongly it adapts the format.`
  );

  if (calibration.isOverconfident) {
    reasons.push(
      `Confidence calibration: your confidence reads as high, but the learning delta is small. The system treated this as a signal to add explanation before more practice.`
    );
  }
  if (calibration.isUnderconfident) {
    reasons.push(
      `Confidence calibration: your confidence reads as low, but the learning delta is large. The system treated this as a signal to introduce practice earlier than your self-report suggests.`
    );
  }

  if (nextStyle === "visual" && k.mentionsVisual) {
    reasons.push(
      `You mentioned visual learning cues, so the system prioritized diagrams to reduce cognitive load for ${topic}.`
    );
  }

  if (nextStyle === "quiz" && (k.mentionsExamples || confBand === "high")) {
    reasons.push(
      `Because you signaled readiness for practice, the system moved toward application-focused questions rather than more explanation.`
    );
  }

  const kLabel = knowledgeLabel(input.priorKnowledge);
  const topSignals = (Object.entries(styleDecision.contributions) as Array<
    [keyof typeof styleDecision.contributions, number]
  >)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 2)
    .join(",");

  const decisionTrace = `policy=${DECISION_POLICY_VERSION} • start=${input.startingStyle} → next=${nextStyle} • conf=${conf}/5(${confBand}) • knowledge=${kLabel} • delta=+${input.delta}(${dBand}) • top=${topSignals}`;

  return { decision, nextStyle, reasons, decisionTrace };
}

export function buildTutorInsight(input: ExplainInput): string {
  const topic = normalize(input.topic) || "this topic";
  const conf = clamp(input.confidence, 1, 5);
  const dBand = deltaBand(input.delta);
  const k = detectKnowledgeSignals(input.priorKnowledge);
  const styleDecision = decideNextStyle(input);
  const style = styleDecision.nextStyle;
  const calibration = detectCalibration(conf, input.delta);

  const knowledgeTier: "unknown" | "beginner" | "intermediate" | "advanced" =
    k.isEmpty
      ? "unknown"
      : k.mentionsAdvanced && !k.mentionsBeginner
      ? "advanced"
      : k.mentionsBeginner && !k.mentionsAdvanced
      ? "beginner"
      : "intermediate";

  const opener =
    dBand === "large"
      ? `You made a strong jump on ${topic}.`
      : dBand === "moderate"
      ? `You’re building momentum on ${topic}.`
      : `You’re getting started on ${topic}, and the signals are useful already.`;

  const knowledgeLine =
    knowledgeTier === "unknown"
      ? `Prior knowledge: I didn’t get much detail, so I’ll confirm the basics first.`
      : knowledgeTier === "advanced"
      ? `Prior knowledge: you seem advanced (“${k.priorKnowledge}”). I’ll skip definitions and focus on edge-cases + application.`
      : knowledgeTier === "beginner"
      ? `Prior knowledge: you seem beginner (“${k.priorKnowledge}”). I’ll go step-by-step with simple examples.`
      : `Prior knowledge: you seem mixed (“${k.priorKnowledge}”). I’ll keep it concise and use quick checks to locate gaps.`;

  const confidenceLine =
    conf === 1
      ? `Confidence: ${conf}/5 (very low). We’ll go slowly, with lots of worked examples and “why” explanations.`
      : conf === 2
      ? `Confidence: ${conf}/5 (low). We’ll use smaller steps and frequent checks so you don’t get stuck.`
      : conf === 3
      ? `Confidence: ${conf}/5 (medium). We’ll keep a steady pace with checkpoints in common confusion spots.`
      : conf === 4
      ? `Confidence: ${conf}/5 (high). We’ll move faster and switch to practice sooner.`
      : `Confidence: ${conf}/5 (very high). Expect challenge questions and fewer hints.`;

  const calibrationLine = calibration.isOverconfident
    ? `Calibration note: your confidence is high, but the learning delta is small. I’ll slow the ramp and make the model explicit before adding more practice.`
    : calibration.isUnderconfident
    ? `Calibration note: your confidence is low, but the learning delta is large. You’re performing stronger than you’re rating yourself—so we’ll introduce practice a bit earlier.`
    : `Calibration note: your confidence and learning delta appear aligned.`;

  const profileLine = `Profile: knowledge=${knowledgeTier} • confidence=${conf}/5 • delta=+${input.delta} (${dBand}).`;

  const adaptationLine =
    style === "visual"
      ? `Because your learning delta was +${input.delta}, the system chose ${styleLabel(
          style
        )} to make the mental model click before you grind problems.`
      : style === "text"
      ? `Because your learning delta was +${input.delta}, the system chose ${styleLabel(
          style
        )} so you can build consistency without changing formats mid-stream.`
      : `Because your learning delta was +${input.delta}, the system chose ${styleLabel(
          style
        )}—that’s the fastest way to expose what’s solid vs. what needs review.`;

  const nudge =
    style === "quiz"
      ? `Tip: if you miss a question, don’t push through—pause and explain the “why” in one sentence first.`
      : style === "visual"
      ? `Tip: as you watch the diagram, narrate each step out loud once. That’s where understanding becomes durable.`
      : `Tip: after each section, write a 1-line summary in your own words. That’s the quickest comprehension check.`;

  const planLines: string[] = [];
  // Step 1: pick an explanation depth based on knowledge + confidence.
  if (knowledgeTier === "beginner") {
    planLines.push(
      conf <= 2
        ? `Plan: start with 2–3 ultra-simple examples, then you do 1 guided example with hints.`
        : `Plan: start with 1–2 simple examples, then you do 2 short practice checks.`
    );
  } else if (knowledgeTier === "advanced") {
    planLines.push(
      conf >= 4
        ? `Plan: jump straight to challenge problems and edge-cases; we’ll only revisit basics if a miss repeats.`
        : `Plan: do 1 compact refresher, then shift quickly into practice and targeted fixes.`
    );
  } else if (knowledgeTier === "intermediate") {
    planLines.push(
      conf <= 2
        ? `Plan: do a quick refresher of the core model, then 2 small checks to rebuild confidence.`
        : `Plan: do a quick recap, then practice with short checkpoints to find weak spots.`
    );
  } else {
    planLines.push(
      conf <= 2
        ? `Plan: I’ll confirm basics with a few quick questions, then we’ll build up slowly.`
        : `Plan: I’ll start with a short baseline check, then adapt depth based on what you get right.`
    );
  }

  // Step 2: a concrete micro-task tuned by confidence.
  planLines.push(
    conf <= 2
      ? `Micro-task: after each step, answer “what does this mean?” in 1 sentence (no pressure on speed).`
      : conf === 3
      ? `Micro-task: after each section, do 1 quick check question before moving on.`
      : `Micro-task: do 3 rapid-fire checks; if you miss one, explain the mistake in 1 sentence and continue.`
  );

  const close = nextStepPreview(style, topic);

  return [
    opener,
    profileLine,
    knowledgeLine,
    confidenceLine,
    calibrationLine,
    adaptationLine,
    ...planLines,
    nudge,
    close,
  ].join("\n");
}


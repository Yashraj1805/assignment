"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  buildExplainability,
  buildTutorInsight,
  DECISION_POLICY_VERSION,
  type LessonStyle,
} from "@/lib/explain";

function ResultPageInner() {
  const params = useSearchParams();

  const topic = params.get("topic") || "the topic";
  const style = (params.get("style") || "text") as LessonStyle;

  // ---- Mock learning scores (demo purpose) ----
  const knowledge = params.get("knowledge") || "Basic";
const confidence = Number(params.get("confidence") || 3);

// ---- Heuristic Pre-score Calculation ----
let preScore = 20;

if (knowledge.toLowerCase().includes("advance")) {
  preScore += 20;
}

preScore += confidence * 6;

if (preScore > 70) preScore = 70;

  const postScore = 70;
  const delta = postScore - preScore;

  // ---- Deterministic explainable adaptation engine ----
  const explainInput = {
    topic,
    priorKnowledge: knowledge,
    confidence,
    delta,
    startingStyle: style,
  } as const;

  const explainability = buildExplainability(explainInput);
  const tutorMessage = buildTutorInsight(explainInput);

  const decision = explainability.decision;
  const nextStyle = explainability.nextStyle;

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-2">Learning Analysis</h1>
      <p className="text-sm text-gray-300 mb-6 max-w-3xl">
        System reasoning, rendered transparently. Signals: <b>prior knowledge</b>, <b>confidence</b>, and <b>learning delta</b>. No external AI or APIs.
      </p>

      <div className="space-y-2 mb-6">
        <p>
          <b>Topic:</b> {topic}
        </p>
        <p className="text-sm text-gray-400">
          Starting style signal: <b>{style}</b> (the engine may override based on inputs)
        </p>
        <p className="text-xs text-gray-500">
          Decision Policy: <b>{DECISION_POLICY_VERSION}</b>
        </p>
        <p>
          <b>Pre-Lesson Score:</b> {preScore}
        </p>
        <p>
          <b>Post-Lesson Score:</b> {postScore}
        </p>
        <p className="text-green-400">
          <b>Learning Delta:</b> +{delta}
        </p>
        <p className="text-xs text-gray-500">
          Learning delta is the adaptation strength: smaller deltas add guidance; larger deltas shift toward practice.
        </p>
      </div>

      {/* Adaptive Decision */}
      <div className="p-6 border border-gray-700 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Adaptive Decision
        </h2>
        <p className="mb-2">{decision}</p>
        <p className="text-sm text-gray-400">
          Next lesson style: <b>{nextStyle}</b>
        </p>

        <p className="mt-3 text-sm text-gray-400">
          Deterministic update from your signals. Adjust confidence or prior knowledge to see the rationale shift.
        </p>
      </div>

      {/* Explainability Layer */}
      <div className="p-6 bg-gray-900 border border-gray-700 rounded mb-6">
        <h3 className="font-semibold mb-3">Explainability Layer (Why this adaptation?)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Signal interpretations: confidence = <b>{confidence <= 2 ? "Low" : confidence === 3 ? "Medium" : "High"}</b>,{" "}
          delta = <b>{delta < 20 ? "Small" : delta < 40 ? "Moderate" : "Large"}</b>,{" "}
          prior knowledge = <b>{knowledge.toLowerCase().includes("advance") ? "Advanced-leaning" : knowledge.toLowerCase().includes("basic") ? "Beginner-leaning" : "Mixed/unknown"}</b>
        </p>
        <ul className="space-y-2 text-sm text-gray-300 list-disc pl-5">
          {explainability.reasons.map((r: string, idx: number) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-300">
          <b>Most influential signals:</b>{" "}
          {explainability.decisionTrace.includes("top=")
            ? explainability.decisionTrace.split("top=")[1].split("•")[0].trim()
            : "—"}
        </p>
        <p className="mt-4 text-xs text-gray-500">{explainability.decisionTrace}</p>
      </div>

      {/* AI Tutor Insight */}
      <div className="p-6 bg-gray-900 border border-gray-700 rounded">
        <h3 className="font-semibold mb-3">Tutor Insight</h3>
        <pre className="whitespace-pre-wrap text-sm text-gray-300">
          {tutorMessage}
        </pre>
      </div>

      {/* Next lesson preview */}
      <div className="mt-6 text-sm text-gray-400">
        <b>Next Lesson Preview:</b>{" "}
        {nextStyle === "visual"
          ? `Next: a visual walkthrough of ${topic} with concise diagrams and annotations to lock in the model.`
          : nextStyle === "text"
          ? `Next: a structured, step-by-step explanation of ${topic} with short checkpoints.`
          : `Next: short quiz-style prompts on ${topic} to apply concepts and surface gaps.`}
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black text-white p-10" />}>
      <ResultPageInner />
    </Suspense>
  );
}

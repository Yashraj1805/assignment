"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function LessonPageInner() {
  const params = useSearchParams();
  const router = useRouter();

  const age = params.get("age") || "";
  const topic = params.get("topic") || "";
  const style = params.get("style") || "text";

  // Questions + answers
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(["", ""]);

  // Generate probe questions dynamically
  useEffect(() => {
    if (!topic) return;

    setQuestions([
      `Briefly describe what you already know about ${topic}.`,
      `Rate your confidence with ${topic} (1-5).`
    ]);
  }, [topic]);

  // Submit pre-learning probe
  const submitProbe = () => {
    const knowledge = answers[0] || "Basic";
    const confidence = Number(answers[1]) || 3;

    router.push(
      `/result?age=${age}&topic=${encodeURIComponent(
        topic
      )}&style=${style}&knowledge=${encodeURIComponent(
        knowledge
      )}&confidence=${confidence}`
    );
  };

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-2xl font-bold mb-2">Pre-Learning Signals</h1>
      <p className="text-sm text-gray-300 mb-6 max-w-2xl">
        Provide two signals. The system adapts the lesson format deterministically and discloses its reasoning.
      </p>
      <div className="mb-6 text-xs text-gray-500 space-y-1">
        <p>
          <b className="text-gray-400">Prior knowledge</b> → sets scaffolding (more context vs. less repetition)
        </p>
        <p>
          <b className="text-gray-400">Confidence</b> → shifts guidance vs. practice (lower = more guidance)
        </p>
      </div>

      {questions.map((q, idx) => (
        <div key={idx} className="mb-6">
          <p className="mb-2">{q}</p>
          <input
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded"
            placeholder={
              idx === 0 ? "e.g. Basic / Advanced / Some grounding" : "Confidence 1-5"
            }
            onChange={(e) => {
              const copy = [...answers];
              copy[idx] = e.target.value;
              setAnswers(copy);
            }}
          />
          {idx === 1 ? (
            <p className="mt-2 text-xs text-gray-500">
              Confidence is a control knob: lower adds guidance; higher shifts toward practice.
            </p>
          ) : null}
        </div>
      ))}

      <button
        onClick={submitProbe}
        className="bg-white text-black px-6 py-3 rounded font-semibold"
      >
        Continue to Adaptive Result
      </button>
    </main>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black text-white p-10" />}>
      <LessonPageInner />
    </Suspense>
  );
}

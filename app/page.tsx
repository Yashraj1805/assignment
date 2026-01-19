"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [age, setAge] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("visual");

  const startLearning = () => {
    if (!age || !topic) return;
    router.push(
      `/lesson?age=${age}&topic=${encodeURIComponent(topic)}&style=${style}`
    );
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center">
          Adaptive Learning System (Deterministic)
        </h1>
        <p className="text-sm text-gray-300 text-center">
          A reasoning engine that adapts lesson format from your signals and surfaces its logic.
        </p>
        <p className="text-xs text-gray-500 text-center">
          Signals: topic, prior knowledge, confidence, learning delta. No external AI or APIs.
        </p>

        <input
          type="number"
          placeholder="Learner age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
        />

        <input
          type="text"
          placeholder="Topic signal (e.g. Algebra basics)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
        />

        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
        >
          <option value="visual">Visual</option>
          <option value="text">Text</option>
          <option value="quiz">Quiz</option>
        </select>
        <p className="text-xs text-gray-500">
          Starting preference only. The system adapts deterministically after the pre-learning check.
        </p>

        <button
          onClick={startLearning}
          className="w-full bg-white text-black py-3 rounded font-semibold"
        >
          Begin Adaptive Session
        </button>
      </div>
    </main>
  );
}

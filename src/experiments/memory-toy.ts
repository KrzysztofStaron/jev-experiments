/**
 * Simple toy memory experiment (smoke test for Jev integration).
 * Kept for backward compatibility - use longmemeval for real benchmarking.
 */

import { batchEvaluateSessionRelevance } from "../lib/jev.js";

const TOY_SESSIONS = [
  "User: What's the capital of France? Assistant: The capital of France is Paris.",
  "User: Tell me about quantum physics. Assistant: Quantum physics studies subatomic particles...",
  "User: What's the weather like? Assistant: I don't have real-time weather data.",
  "User: Who painted the Mona Lisa? Assistant: Leonardo da Vinci painted the Mona Lisa.",
];

const TOY_QUERY = "What is the capital of France?";

async function runToyMemoryExperiment() {
  console.log("🧪 Running toy memory experiment (smoke test)");
  console.log(`\nQuery: ${TOY_QUERY}\n`);

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log("⚠️  Skipping live Jev call (no API key). Use .env for live test.\n");
    console.log("Mock result: session 0 = relevant, others = not relevant");
    return;
  }

  try {
    const relevance = await batchEvaluateSessionRelevance(TOY_QUERY, TOY_SESSIONS);
    
    console.log("Relevance scores:");
    TOY_SESSIONS.forEach((session, i) => {
      const relevant = relevance[i];
      console.log(`  [${relevant ? "✓" : "✗"}] Session ${i}: ${session.slice(0, 60)}...`);
    });

    const keptCount = relevance.filter(Boolean).length;
    console.log(`\n✅ Kept ${keptCount}/${TOY_SESSIONS.length} sessions`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

runToyMemoryExperiment();

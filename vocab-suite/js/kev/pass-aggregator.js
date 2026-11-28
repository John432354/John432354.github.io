/**
 * 3-Pass Kev Verification Orchestrator & Calibrated Probability Averager
 *
 * Runs 3 distinct Kev forward passes on the user's answer vs the stored answer
 * and computes their averaged calibrated validity probability (`averaged_prob`).
 */

import { buildPass1Semantic } from './prompt-pass-1-semantic.js';
import { buildPass2Entailment } from './prompt-pass-2-entailment.js';
import { buildPass3Debiased } from './prompt-pass-3-debiased.js';

export async function verifyAnswerThreePasses(
  kevEngine,
  payload,
  { threshold = 0.52, temperature = 1.0, onPassResult = null } = {}
) {
  const userTrimmed = String(payload.userAnswer ?? '').trim();
  if (!userTrimmed) {
    return {
      isValid: false,
      averageProbability: 0,
      threshold,
      totalLatencyMs: 0,
      passes: [],
      reason: 'Empty answer submitted.',
    };
  }

  const passSpecs = [
    buildPass1Semantic(payload),
    buildPass2Entailment(payload),
    buildPass3Debiased(payload),
  ];

  const passResults = [];
  const overallStart = performance.now();

  for (const spec of passSpecs) {
    const passStart = performance.now();
    const res = await kevEngine.runSingleQuestion({
      state: spec.state,
      instructions: spec.instructions,
      options: spec.options,
      temperature,
    });
    const latencyMs = Math.round(performance.now() - passStart);
    const validProbability = Number(res.probsArray[spec.positiveIndex] ?? 0);

    const record = {
      passNumber: spec.passNumber,
      passId: spec.passId,
      passLabel: spec.passLabel,
      validProbability,
      passedIndividually: validProbability >= 0.5,
      latencyMs,
      winner: res.winner,
      rawLogits: res.rawLogits,
    };

    passResults.push(record);
    if (typeof onPassResult === 'function') {
      onPassResult(record);
    }
  }

  const sumProb = passResults.reduce((acc, p) => acc + p.validProbability, 0);
  const averageProbability = sumProb / passResults.length;
  const isValid = averageProbability >= threshold;
  const totalLatencyMs = Math.round(performance.now() - overallStart);

  return {
    isValid,
    averageProbability,
    threshold,
    totalLatencyMs,
    passes: passResults,
    modelId: kevEngine.runtime?.modelId || 'onnx-community/kev-0.6b-ONNX',
    device: kevEngine.runtime?.device || 'wasm',
    dtype: kevEngine.runtime?.dtype || 'q4',
  };
}

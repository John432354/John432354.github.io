/**
 * Kev Pointer-Head Logit Readout & Calibrated Softmax
 *
 * The ONNX Kev graph computes the scaled dot-product pointer score at each
 * option's `</opt>` token against its question's `<decide>` token.
 * Applying temperature-scaled softmax across a question's `</opt>` scores
 * yields the calibrated option probability distribution.
 */

export function calibratedSoftmax(logits, temperature = 1.0) {
  if (!Array.isArray(logits) || logits.length === 0) return [];
  const temp = Math.max(1e-6, Number(temperature) || 1.0);
  const maxLogit = Math.max(...logits);
  const exps = logits.map((val) => Math.exp((val - maxLogit) / temp));
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1;
  return exps.map((v) => v / sum);
}

export function decodePointerBranch({ logitsArray, endPositions, optionLabels, temperature = 1.0 }) {
  const rawLogits = endPositions.map((idx) => Number(logitsArray[idx] ?? 0));
  const probs = calibratedSoftmax(rawLogits, temperature);

  let topIndex = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[topIndex]) topIndex = i;
  }

  const distribution = {};
  optionLabels.forEach((label, idx) => {
    distribution[label] = probs[idx];
  });

  return {
    winner: optionLabels[topIndex],
    winnerIndex: topIndex,
    confidence: probs[topIndex],
    probabilities: distribution,
    probsArray: probs,
    rawLogits,
  };
}

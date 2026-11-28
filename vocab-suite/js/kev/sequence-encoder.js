/**
 * Kev Sequence Branch Encoder
 *
 * Packs a state token array and one or more typed question branches into a
 * single sequence:
 *   <state> state_ids <q> instr_ids <opt> opt_0 </opt> <opt> opt_1 </opt> <decide>
 *
 * Returns `inputIds` and the exact `</opt>` readout indices (`optionEndPositions`)
 * for each question branch.
 */

export function resolveDelimiterIds(kevConfig, encodeRawTokenFn) {
  const ids = kevConfig?.delimiter_ids ?? {};
  const strs = kevConfig?.delimiters ?? {};

  const pick = (key, fallbackStr, fallbackId) => {
    if (typeof ids[key] === 'number') return ids[key];
    const tokenText = typeof strs[key] === 'string' ? strs[key] : fallbackStr;
    if (typeof encodeRawTokenFn === 'function') {
      const encoded = encodeRawTokenFn(tokenText);
      if (encoded.length === 1) return encoded[0];
    }
    return fallbackId;
  };

  return {
    state: pick('state', '<|fim_prefix|>', 151659),
    question: pick('question', '<|fim_middle|>', 151660),
    optionStart: pick('option_start', '<|box_start|>', 151648),
    optionEnd: pick('option_end', '<|box_end|>', 151649),
    decide: pick('decide', '<|fim_suffix|>', 151661),
  };
}

export function packKevSequence({
  stateTokenIds,
  questionBranches,
  delimiters,
  maxStateTokens = 1024,
  maxBranchTokens = 4096,
}) {
  const builtBranches = questionBranches.map((q) => {
    const branch = [delimiters.question, ...q.instructionIds];
    const endOffsets = [];

    for (const optIds of q.optionTokenIds) {
      branch.push(delimiters.optionStart, ...optIds, delimiters.optionEnd);
      endOffsets.push(branch.length - 1);
    }
    branch.push(delimiters.decide);
    return { branch, endOffsets };
  });

  const longestBranch = Math.max(...builtBranches.map((b) => b.branch.length), 0);
  const availableForState = Math.max(16, maxBranchTokens - 1 - longestBranch);
  const clippedState = stateTokenIds.slice(0, Math.min(maxStateTokens, availableForState));

  const inputIds = [delimiters.state, ...clippedState];
  const optionEndGroups = [];

  for (const { branch, endOffsets } of builtBranches) {
    const baseOffset = inputIds.length;
    inputIds.push(...branch);
    optionEndGroups.push(endOffsets.map((offset) => baseOffset + offset));
  }

  return {
    inputIds,
    optionEndGroups,
    stateTokenCount: clippedState.length,
  };
}

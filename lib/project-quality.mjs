export function calculateAcceptanceScore(outputs, totalAgents = 9) {
  const list = Array.isArray(outputs) ? outputs : [];
  if (!list.length) return 0;
  const average = list.reduce((sum, item) => sum + Math.max(0, Math.min(100, Number(item?.confidence) || 0)), 0) / list.length;
  const complete = list.filter(item => item?.status === 'complete').length;
  return Math.round(Math.min(100, average * 0.75 + (complete / totalAgents) * 25));
}

export function selectImprovementIndices(outputs, target = 85, maxAgents = 2) {
  const list = Array.isArray(outputs) ? outputs : [];
  if (calculateAcceptanceScore(list) >= target) return [];
  return list
    .map((item, index) => ({ index, confidence: Number(item?.confidence) || 0, degraded: item?.status === 'degraded' ? 1 : 0 }))
    .sort((a, b) => b.degraded - a.degraded || a.confidence - b.confidence || a.index - b.index)
    .slice(0, Math.max(1, maxAgents))
    .map(item => item.index);
}

export function mergeImprovedOutputs(original, replacements) {
  const next = [...original];
  for (const replacement of replacements || []) {
    const index = next.findIndex(item => item?.agentId === replacement?.agentId);
    if (index === -1) continue;
    const current = next[index];
    const currentConfidence = Number(current?.confidence) || 0;
    const nextConfidence = Number(replacement?.confidence) || 0;
    if (replacement?.status === 'complete' && (current?.status !== 'complete' || nextConfidence > currentConfidence)) next[index] = replacement;
  }
  return next;
}

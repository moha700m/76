// Pure, framework-agnostic orchestration logic for the post-waves finalize/preview pipeline.
// Extracted so it can be unit-tested under node:test without importing the React TSX component.
// Studio.tsx implements the same contract (single finalize owner, mandatory re-read, bounded
// polling, 409/offline => wait-then-reread, idempotent site-preview, never re-run a wave at 9/9).

export function isConflictOrOffline(err) {
  const record = err && typeof err === 'object' ? err : {};
  const response = record.response && typeof record.response === 'object' ? record.response : null;
  const status = Number((response && response.status) || record.status || 0);
  return status === 409 || status === 0 || status === 504 || status >= 500;
}

// A project is fully finalized only when all nine outputs are saved, synthesis exists and progress is 100.
export function isFinalized(project) {
  return Boolean(project) && Array.isArray(project.agentOutputs) && project.agentOutputs.length === 9
    && Boolean(project.synthesis) && project.progress === 100;
}

// Never re-run a wave once nine outputs are saved.
export function shouldRunWave(project) {
  if (!project || !Array.isArray(project.agentOutputs)) return true;
  return project.agentOutputs.length < 9;
}

// Site-preview should be built exactly once: only when synthesis exists, no previewPath yet,
// and this project+run key has not already been attempted.
export function shouldBuildPreview(project, attemptedKeys) {
  if (!project || !project.synthesis || project.previewPath) return false;
  const key = previewKey(project);
  return !attemptedKeys.has(key);
}

export function previewKey(project) {
  return `${project.id}:${project.currentRunId || 'saved'}`;
}

// Merge a freshly re-read saved snapshot onto the current project WITHOUT losing forward progress.
// A late or stale re-read (e.g. a snapshot taken before the preview was persisted) must never wipe
// a synthesis or previewPath we already have, nor roll progress/status backwards.
export function mergeSavedSnapshot(current, snapshot) {
  if (!snapshot) return current;
  if (!current) return snapshot;
  const currentProgress = Number(current.progress) || 0;
  const snapshotProgress = Number(snapshot.progress) || 0;
  return {
    ...current,
    ...snapshot,
    synthesis: snapshot.synthesis || current.synthesis,
    previewPath: snapshot.previewPath || current.previewPath,
    progress: Math.max(currentProgress, snapshotProgress),
    // Never downgrade status to an older one when the snapshot is behind the current project.
    status: snapshotProgress >= currentProgress ? snapshot.status : current.status
  };
}

// Bounded polling that re-reads the saved project until finalized or the budget elapses.
// Injected deps make it fully testable: fetchSnapshot(id) -> project|null, sleep(ms), now().
export async function pollUntilFinalized(projectId, deps) {
  const fetchSnapshot = deps.fetchSnapshot;
  const sleep = deps.sleep || (() => Promise.resolve());
  const now = deps.now || (() => Date.now());
  const budgetMs = typeof deps.budgetMs === 'number' ? deps.budgetMs : 60000;
  const onProject = deps.onProject || (() => {});
  const deadline = now() + budgetMs;
  let latest = null;
  let delay = deps.initialDelayMs || 1500;
  while (now() < deadline) {
    const snapshot = await fetchSnapshot(projectId);
    if (snapshot) { latest = snapshot; onProject(snapshot); if (isFinalized(snapshot)) return snapshot; }
    await sleep(delay);
    delay = Math.min(delay + 1000, 5000);
  }
  return latest;
}

// Orchestrates the automatic pipeline after the agent waves have run.
// finalize is NOT called here: runCwcWaves is the single finalize owner, so by the time this runs
// the waves helper has already attempted synthesis. This function only reconciles saved state,
// polls if needed, and builds the preview once. Returns the final reconciled project.
export async function reconcileAfterWaves(afterWaves, deps) {
  const fetchSnapshot = deps.fetchSnapshot;
  const buildPreview = deps.buildPreview;
  const onProject = deps.onProject || (() => {});
  const attemptedKeys = deps.attemptedKeys || new Set();

  let project = afterWaves;

  // Never re-run a wave at 9/9. If not finalized yet, re-read then poll (409/offline => wait-then-reread).
  if (project.agentOutputs.length === 9 && !isFinalized(project)) {
    const snapshot = await fetchSnapshot(project.id);
    if (snapshot) { project = snapshot; onProject(snapshot); }
    if (!isFinalized(project)) {
      const finalized = await pollUntilFinalized(project.id, { ...deps, attemptedKeys });
      if (finalized) project = finalized;
    }
  }

  // Build the site preview exactly once.
  if (shouldBuildPreview(project, attemptedKeys)) {
    const key = previewKey(project);
    attemptedKeys.add(key);
    try {
      const built = await buildPreview(project.id);
      if (built) { project = built; onProject(built); }
    } catch (err) {
      // Conflict / dropped response is not failure: re-read saved project. If still no preview, allow retry later.
      const snapshot = await fetchSnapshot(project.id);
      if (snapshot && snapshot.previewPath) { project = snapshot; onProject(snapshot); }
      else if (isConflictOrOffline(err)) { attemptedKeys.delete(key); }
    }
  }

  // Mandatory final re-read so previewPath / progress / status reflect saved truth.
  const finalSnapshot = await fetchSnapshot(project.id);
  if (finalSnapshot) { project = mergeSavedSnapshot(project, finalSnapshot); onProject(project); }
  return project;
}

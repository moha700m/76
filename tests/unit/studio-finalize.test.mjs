import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFinalized,
  shouldRunWave,
  shouldBuildPreview,
  previewKey,
  isConflictOrOffline,
  pollUntilFinalized,
  reconcileAfterWaves,
  mergeSavedSnapshot
} from '../../src/finalize-orchestration.mjs';

function project(overrides = {}) {
  return {
    id: 'proj-123456',
    currentRunId: 'run-abcdef',
    agentOutputs: Array.from({ length: overrides.agents ?? 9 }, (_, i) => ({ agentId: 'a' + i })),
    synthesis: overrides.synthesis ?? null,
    progress: overrides.progress ?? 88,
    previewPath: overrides.previewPath,
    status: overrides.status ?? 'running'
  };
}

const finalized = () => project({ agents: 9, synthesis: { executiveSummary: 'x' }, progress: 100, status: 'review' });

test('isFinalized requires 9/9 + synthesis + progress 100', () => {
  assert.equal(isFinalized(project({ agents: 9, synthesis: null, progress: 88 })), false);
  assert.equal(isFinalized(project({ agents: 9, synthesis: { a: 1 }, progress: 95 })), false);
  assert.equal(isFinalized(finalized()), true);
});

test('never re-run a wave once 9/9 outputs are saved', () => {
  assert.equal(shouldRunWave(project({ agents: 6 })), true);
  assert.equal(shouldRunWave(project({ agents: 9, synthesis: null, progress: 88 })), false);
  assert.equal(shouldRunWave(finalized()), false);
});

test('409 / dropped / 5xx responses are treated as conflict-or-offline (wait then re-read)', () => {
  assert.equal(isConflictOrOffline({ response: { status: 409 } }), true);
  assert.equal(isConflictOrOffline({ status: 0 }), true);
  assert.equal(isConflictOrOffline({ response: { status: 504 } }), true);
  assert.equal(isConflictOrOffline({ response: { status: 500 } }), true);
  assert.equal(isConflictOrOffline({ response: { status: 404 } }), false);
});

test('site-preview builds exactly once (idempotency by id + runId)', () => {
  const keys = new Set();
  const p = project({ agents: 9, synthesis: { a: 1 }, progress: 100 });
  assert.equal(shouldBuildPreview(p, keys), true);
  keys.add(previewKey(p));
  assert.equal(shouldBuildPreview(p, keys), false);
  // already has a preview path -> never rebuild
  assert.equal(shouldBuildPreview(project({ synthesis: { a: 1 }, previewPath: '#/preview/t' }), new Set()), false);
});

test('409 during finalize -> polling re-reads saved project and reaches 9/9 + progress 100', async () => {
  const snapshots = [
    project({ agents: 9, synthesis: null, progress: 95 }),   // still finalizing
    project({ agents: 9, synthesis: null, progress: 95 }),   // still finalizing
    finalized()                                              // saved result appears
  ];
  let call = 0;
  const seen = [];
  const result = await pollUntilFinalized('proj-123456', {
    fetchSnapshot: async () => snapshots[Math.min(call++, snapshots.length - 1)],
    sleep: async () => {},
    now: (() => { let t = 0; return () => (t += 1000); })(),
    budgetMs: 10000,
    onProject: p => seen.push(p.progress)
  });
  assert.ok(isFinalized(result));
  assert.equal(result.progress, 100);
  assert.ok(seen.includes(100));
});

test('server success with dropped response does NOT re-run wave3; reconcile re-reads to finalized', async () => {
  // afterWaves came back stale (no synthesis), but the server had actually saved everything.
  const afterWaves = project({ agents: 9, synthesis: null, progress: 88 });
  let waveRuns = 0;
  const built = [];
  const finalP = finalized();
  const result = await reconcileAfterWaves(afterWaves, {
    fetchSnapshot: async () => finalP,          // saved truth: already finalized
    buildPreview: async () => { built.push('build'); return { ...finalP, previewPath: '#/preview/x', progress: 100 }; },
    sleep: async () => {},
    now: () => Date.now(),
    onProject: () => {},
    runWave: () => { waveRuns++; }              // must never be called
  });
  assert.equal(waveRuns, 0, 'wave must not be re-run');
  assert.equal(shouldRunWave(result), false);
  assert.ok(result.previewPath, 'previewPath present after reconcile');
});

test('full path: reconcile reaches 9/9 -> progress 100 -> single previewPath', async () => {
  const finalNoPreview = finalized();
  const finalWithPreview = { ...finalNoPreview, previewPath: '#/preview/final' };
  let fetchCall = 0;
  let buildCalls = 0;
  const result = await reconcileAfterWaves(finalNoPreview, {
    fetchSnapshot: async () => (buildCalls === 0 ? finalNoPreview : finalWithPreview),
    buildPreview: async () => { buildCalls++; return finalWithPreview; },
    sleep: async () => {},
    now: () => Date.now(),
    onProject: () => {}
  });
  assert.equal(result.agentOutputs.length, 9);
  assert.equal(result.progress, 100);
  assert.equal(result.previewPath, '#/preview/final');
  assert.equal(buildCalls, 1, 'preview built exactly once');
});

test('preview build conflict re-reads saved project instead of failing', async () => {
  const finalNoPreview = finalized();
  const finalWithPreview = { ...finalNoPreview, previewPath: '#/preview/recovered' };
  const result = await reconcileAfterWaves(finalNoPreview, {
    fetchSnapshot: async () => finalWithPreview,   // saved snapshot already has the preview
    buildPreview: async () => { const e = new Error('conflict'); e.response = { status: 409 }; throw e; },
    sleep: async () => {},
    now: () => Date.now(),
    onProject: () => {}
  });
  assert.equal(result.previewPath, '#/preview/recovered');
});


test('mergeSavedSnapshot keeps a freshly built previewPath when a stale re-read lacks it', () => {
  const withPreview = project({ agents: 9, synthesis: { a: 1 }, progress: 100, status: 'review', previewPath: '#/preview/new' });
  const stale = project({ agents: 9, synthesis: { a: 1 }, progress: 100, status: 'review' }); // no previewPath
  const merged = mergeSavedSnapshot(withPreview, stale);
  assert.equal(merged.previewPath, '#/preview/new', 'a stale snapshot must not wipe the built previewPath');
  assert.ok(merged.synthesis, 'synthesis preserved');
});

test('mergeSavedSnapshot never rolls progress or status backwards', () => {
  const current = project({ agents: 9, synthesis: { a: 1 }, progress: 100, status: 'review', previewPath: '#/preview/x' });
  const behind = project({ agents: 9, synthesis: null, progress: 88, status: 'running' });
  const merged = mergeSavedSnapshot(current, behind);
  assert.equal(merged.progress, 100, 'progress must be the max, never lowered');
  assert.equal(merged.status, 'review', 'status must not downgrade to an older, less-advanced state');
  assert.equal(merged.previewPath, '#/preview/x', 'previewPath preserved');
  assert.ok(merged.synthesis, 'synthesis preserved against a null snapshot');
});

test('mergeSavedSnapshot adopts a more-advanced snapshot status and progress', () => {
  const current = project({ agents: 9, synthesis: null, progress: 88, status: 'running' });
  const ahead = project({ agents: 9, synthesis: { a: 1 }, progress: 100, status: 'review', previewPath: '#/preview/y' });
  const merged = mergeSavedSnapshot(current, ahead);
  assert.equal(merged.progress, 100);
  assert.equal(merged.status, 'review');
  assert.equal(merged.previewPath, '#/preview/y');
});

test('reconcile: a stale final re-read does NOT wipe the previewPath returned by site-preview', async () => {
  const finalNoPreview = finalized();                                   // 9/9, synthesis, progress 100, no preview
  const staleNoPreview = finalized();                                   // late snapshot, still no previewPath
  const built = { ...finalNoPreview, previewPath: '#/preview/built' };
  let buildCalls = 0;
  const result = await reconcileAfterWaves(finalNoPreview, {
    fetchSnapshot: async () => staleNoPreview,   // every re-read is stale (missing the just-built preview)
    buildPreview: async () => { buildCalls++; return built; },
    sleep: async () => {},
    now: () => Date.now(),
    onProject: () => {}
  });
  assert.equal(buildCalls, 1, 'preview built exactly once');
  assert.equal(result.previewPath, '#/preview/built', 'built previewPath survives a stale final re-read');
  assert.equal(result.progress, 100);
});

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FixedPromptWalEvent } from '../fixed-prompt-controller.js';
import {
  promptStructuralSmokeReport,
  renderPromptStructuralSmokeMarkdown,
} from '../prompt-structural-smoke.js';

describe('prompt structural smoke report', () => {
  test('passes after ten unattended discard decisions under budget', () => {
    const events: FixedPromptWalEvent[] = [];
    for (let index = 1; index <= 10; index += 1) {
      events.push(decisionEvent(`round-${index}`, 'discard', 'held_in_within_noise'));
      events.push(completedEvent(`round-${index}`, `task-${index}`, 0.1));
    }

    const report = promptStructuralSmokeReport({
      events,
      minimumRounds: 10,
      costCeilingUsd: 30,
    });

    assert.equal(report.status, 'pass');
    assert.equal(report.observedRounds, 10);
    assert.equal(report.decisions.keep, 0);
    assert.equal(report.decisions.discard, 10);
    assert.equal(report.totalCostUsd, 1);
    assert.deepEqual(report.failures, []);

    const markdown = renderPromptStructuralSmokeMarkdown(report);
    assert.match(markdown, /# Prompt Structural Smoke/);
    assert.match(markdown, /- status: pass/);
    assert.match(markdown, /- rounds: 10 \/ 10/);
    assert.match(markdown, /- cost_usd: 1 \/ 30/);
  });

  test('fails when structural smoke evidence is incomplete or unsafe', () => {
    const events: FixedPromptWalEvent[] = [];
    for (let index = 1; index <= 8; index += 1) {
      events.push(decisionEvent(`round-${index}`, 'discard', 'held_in_within_noise'));
      events.push(completedEvent(`round-${index}`, `task-${index}`, 4));
    }
    events.push(decisionEvent('round-9', 'discard', 'reward_hack_quarantined'));
    events.push(completedEvent('round-9', 'task-9', 4));
    events.push(plumbingFailedEvent('round-9', 'task-9'));

    const report = promptStructuralSmokeReport({
      events,
      minimumRounds: 10,
      costCeilingUsd: 30,
    });

    assert.equal(report.status, 'fail');
    assert.deepEqual(report.failures, [
      'minimum_rounds_not_met',
      'cost_ceiling_exceeded',
      'plumbing_failures_present',
      'reward_hack_quarantine_present',
    ]);
    assert.equal(report.observedRounds, 9);
    assert.equal(report.totalCostUsd, 37);

    const markdown = renderPromptStructuralSmokeMarkdown(report);
    assert.match(markdown, /## failures/);
    assert.match(markdown, /- cost_ceiling_exceeded/);
  });
});

function decisionEvent(
  roundId: string,
  decision: 'keep' | 'discard',
  reason: string,
): FixedPromptWalEvent {
  return {
    schemaVersion: 1,
    type: 'prompt_candidate_decided',
    id: `decision-${roundId}`,
    ts: 1,
    runId: 'run-1',
    roundId,
    decision,
    reason,
    candidateCommitSha: `candidate-${roundId}`,
    previousLastKeptCommitSha: 'kept-0',
    lastKeptCommitSha: decision === 'keep' ? `candidate-${roundId}` : 'kept-0',
    previousHeldInReferencePassEligibleRate: 0.5,
    heldInReferencePassEligibleRate: 0.5,
    originalCommitSha: 'original-0',
    originalHeldOutPassEligibleRate: 0.5,
    heldInPassRateNoiseBand: 0.05,
    heldOutPassRateNoiseBand: 0.05,
    metrics: {},
  };
}

function completedEvent(roundId: string, taskId: string, costUsd: number): FixedPromptWalEvent {
  return {
    schemaVersion: 1,
    type: 'task_completed',
    id: `task-${roundId}-${taskId}`,
    ts: 1,
    runId: 'run-1',
    roundId,
    taskId,
    status: 'completed',
    passed: false,
    scored: true,
    eligible: true,
    tokenSummary: { input: 1, output: 1, reasoning: 0, total: 2, costUsd },
    steps: 1,
    durationMs: 10,
    runtimeEventsPath: `/logs/${roundId}/${taskId}.jsonl`,
    harbor: { reward: 0 },
  };
}

function plumbingFailedEvent(roundId: string, taskId: string): FixedPromptWalEvent {
  return {
    schemaVersion: 1,
    type: 'task_plumbing_failed',
    id: `plumbing-${roundId}-${taskId}`,
    ts: 1,
    runId: 'run-1',
    roundId,
    taskId,
    status: 'plumbing_failed',
    passed: false,
    scored: false,
    eligible: false,
    errorClass: 'prompt_hash_mismatch',
    error: 'prompt hash mismatch',
    tokenSummary: { input: 1, output: 1, reasoning: 0, total: 2, costUsd: 1 },
    steps: 1,
    durationMs: 10,
    runtimeEventsPath: `/logs/${roundId}/${taskId}.jsonl`,
    harbor: { reward: 0 },
  };
}

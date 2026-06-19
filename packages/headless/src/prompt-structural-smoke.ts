import type { FixedPromptTaskWalEvent, FixedPromptWalEvent } from './fixed-prompt-controller.js';

export type PromptStructuralSmokeFailure =
  | 'minimum_rounds_not_met'
  | 'cost_ceiling_exceeded'
  | 'plumbing_failures_present'
  | 'reward_hack_quarantine_present';

export interface PromptStructuralSmokeReportInput {
  events: readonly FixedPromptWalEvent[];
  minimumRounds?: number;
  costCeilingUsd?: number;
}

export interface PromptStructuralSmokeReport {
  schemaVersion: 'maka.prompt_structural_smoke.v1';
  status: 'pass' | 'fail';
  minimumRounds: number;
  observedRounds: number;
  decisions: {
    keep: number;
    discard: number;
  };
  taskEvents: {
    completed: number;
    infraFailed: number;
    plumbingFailed: number;
  };
  quarantineCount: number;
  totalCostUsd: number;
  costCeilingUsd?: number;
  failures: PromptStructuralSmokeFailure[];
}

export function promptStructuralSmokeReport(
  input: PromptStructuralSmokeReportInput,
): PromptStructuralSmokeReport {
  const minimumRounds = input.minimumRounds ?? 10;
  const decisionEvents = input.events.filter((event) => event.type === 'prompt_candidate_decided');
  const taskEvents = input.events.filter(isTaskWalEvent);
  const observedRounds = new Set(decisionEvents.map((event) => event.roundId)).size;
  const quarantineCount = decisionEvents.filter((event) => isQuarantineReason(event.reason)).length;
  const totalCostUsd = roundCost(sum(taskEvents.map((event) => (
    event.type !== 'task_infra_failed' ? event.tokenSummary.costUsd : 0
  ))));
  const failures: PromptStructuralSmokeFailure[] = [];
  if (observedRounds < minimumRounds) failures.push('minimum_rounds_not_met');
  if (input.costCeilingUsd !== undefined && totalCostUsd > input.costCeilingUsd) {
    failures.push('cost_ceiling_exceeded');
  }
  if (taskEvents.some((event) => event.type === 'task_plumbing_failed')) {
    failures.push('plumbing_failures_present');
  }
  if (quarantineCount > 0) failures.push('reward_hack_quarantine_present');

  return {
    schemaVersion: 'maka.prompt_structural_smoke.v1',
    status: failures.length === 0 ? 'pass' : 'fail',
    minimumRounds,
    observedRounds,
    decisions: {
      keep: decisionEvents.filter((event) => event.decision === 'keep').length,
      discard: decisionEvents.filter((event) => event.decision === 'discard').length,
    },
    taskEvents: {
      completed: taskEvents.filter((event) => event.type === 'task_completed').length,
      infraFailed: taskEvents.filter((event) => event.type === 'task_infra_failed').length,
      plumbingFailed: taskEvents.filter((event) => event.type === 'task_plumbing_failed').length,
    },
    quarantineCount,
    totalCostUsd,
    ...(input.costCeilingUsd !== undefined ? { costCeilingUsd: input.costCeilingUsd } : {}),
    failures,
  };
}

export function renderPromptStructuralSmokeMarkdown(report: PromptStructuralSmokeReport): string {
  const lines = [
    '# Prompt Structural Smoke',
    '',
    `- status: ${report.status}`,
    `- rounds: ${report.observedRounds} / ${report.minimumRounds}`,
    `- decisions: keep=${report.decisions.keep}, discard=${report.decisions.discard}`,
    `- task_events: ${taskEventsSummary(report)}`,
    `- reward_hack_quarantine: ${report.quarantineCount}`,
    `- cost_usd: ${report.totalCostUsd}${costCeilingSuffix(report)}`,
    '',
  ];
  if (report.failures.length > 0) {
    lines.push('## failures', '', ...report.failures.map((failure) => `- ${failure}`), '');
  }
  return `${lines.join('\n')}\n`;
}

function isTaskWalEvent(event: FixedPromptWalEvent): event is FixedPromptTaskWalEvent {
  return event.type === 'task_completed'
    || event.type === 'task_infra_failed'
    || event.type === 'task_plumbing_failed';
}

function isQuarantineReason(reason: string): boolean {
  return reason.includes('quarantine') || reason.includes('reward_hack');
}

function taskEventsSummary(report: PromptStructuralSmokeReport): string {
  return [
    `completed=${report.taskEvents.completed}`,
    `infra_failed=${report.taskEvents.infraFailed}`,
    `plumbing_failed=${report.taskEvents.plumbingFailed}`,
  ].join(', ');
}

function costCeilingSuffix(report: PromptStructuralSmokeReport): string {
  return report.costCeilingUsd === undefined ? '' : ` / ${report.costCeilingUsd}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

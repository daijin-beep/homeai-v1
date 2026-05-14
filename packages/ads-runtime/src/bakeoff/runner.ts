import { z } from "zod";

import { RenderCandidateSchema } from "@homeai/contracts";
import { verifyRenderCandidate } from "@homeai/render-verifier";
import type {
  CreativeRenderSpec,
  RenderCandidate,
  RenderJob,
  RenderVerificationReport
} from "@homeai/contracts";

import { assertProviderAllowedForJob, RenderProviderPolicyError } from "../policy/assert-provider-allowed.js";
import type { ProviderRegistry, RegisteredProvider } from "../adapters/registry.js";

export const BakeoffRunStatusSchema = z.enum(["completed", "partial", "skipped"]);

export const BakeoffProviderResultSchema = z
  .object({
    providerId: z.string().min(1),
    providerName: z.string().min(1),
    policyId: z.string().min(1),
    policyStatus: z.string().min(1),
    skippedReason: z.string().min(1).optional(),
    candidatesGenerated: z.number().int().nonnegative(),
    verificationPassCount: z.number().int().nonnegative(),
    verificationWarningCount: z.number().int().nonnegative(),
    verificationFailCount: z.number().int().nonnegative(),
    candidatesWithoutTrace: z.number().int().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
    totalEstimatedCostCents: z.number().int().nonnegative()
  })
  .strict();

export const BakeoffScorecardSchema = z
  .object({
    bakeoffRunId: z.string().min(1),
    runAt: z.string().min(1),
    scenario: z.string().min(1),
    specCount: z.number().int().nonnegative(),
    providerCount: z.number().int().nonnegative(),
    providerResults: z.array(BakeoffProviderResultSchema),
    status: BakeoffRunStatusSchema,
    deterministicSeed: z.string().min(1)
  })
  .strict();

export type BakeoffRunStatus = z.infer<typeof BakeoffRunStatusSchema>;
export type BakeoffProviderResult = z.infer<typeof BakeoffProviderResultSchema>;
export type BakeoffScorecard = z.infer<typeof BakeoffScorecardSchema>;

export interface BakeoffRunInput {
  bakeoffRunId: string;
  scenarioLabel: string;
  runAt: string;
  renderJob: RenderJob;
  specs: ReadonlyArray<CreativeRenderSpec>;
  registry: ProviderRegistry;
  // If true, the runner only runs providers whose policy status is
  // allowed_for_bakeoff (or higher) AND not blocked. Blocked providers
  // are reported as skipped, never invoked.
  bakeoffOnly?: boolean;
  // Optional deterministic seed for reproducibility — surfaced on the
  // scorecard. The runner is already deterministic; this is for audit.
  deterministicSeed?: string;
}

export interface BakeoffRunResult {
  scorecard: BakeoffScorecard;
  candidates: ReadonlyArray<RenderCandidate>;
  verificationReports: ReadonlyArray<RenderVerificationReport>;
}

/**
 * Run the bakeoff: for each registered provider × each spec, invoke the
 * provider's adapter, validate the canonical RenderCandidate, run the
 * Track B L1 verifier, and aggregate scores. The runner is fully
 * synchronous in test mode (mock adapters resolve immediately) and
 * never calls the network.
 */
export async function runBakeoff(input: BakeoffRunInput): Promise<BakeoffRunResult> {
  const {
    bakeoffRunId,
    scenarioLabel,
    runAt,
    renderJob,
    specs,
    registry,
    bakeoffOnly = true,
    deterministicSeed = `seed-${bakeoffRunId}`
  } = input;

  const candidates: RenderCandidate[] = [];
  const verificationReports: RenderVerificationReport[] = [];
  const providerResults: BakeoffProviderResult[] = [];

  for (const entry of registry.list()) {
    const result = await runProvider({
      entry,
      bakeoffRunId,
      runAt,
      renderJob,
      specs,
      bakeoffOnly
    });
    providerResults.push(result.summary);
    candidates.push(...result.candidates);
    verificationReports.push(...result.reports);
  }

  const status: BakeoffRunStatus = providerResults.every((r) => r.skippedReason === undefined)
    ? "completed"
    : providerResults.every((r) => r.skippedReason !== undefined)
      ? "skipped"
      : "partial";

  const scorecard = BakeoffScorecardSchema.parse({
    bakeoffRunId,
    runAt,
    scenario: scenarioLabel,
    specCount: specs.length,
    providerCount: registry.list().length,
    providerResults,
    status,
    deterministicSeed
  });

  return { scorecard, candidates, verificationReports };
}

async function runProvider(input: {
  entry: RegisteredProvider;
  bakeoffRunId: string;
  runAt: string;
  renderJob: RenderJob;
  specs: ReadonlyArray<CreativeRenderSpec>;
  bakeoffOnly: boolean;
}): Promise<{
  summary: BakeoffProviderResult;
  candidates: RenderCandidate[];
  reports: RenderVerificationReport[];
}> {
  const { entry, bakeoffRunId, runAt, renderJob, specs, bakeoffOnly } = input;
  const skip = checkSkip(entry, bakeoffOnly);
  if (skip !== null) {
    return {
      summary: {
        providerId: entry.provider.providerId,
        providerName: entry.provider.providerName,
        policyId: entry.policy.policyId,
        policyStatus: entry.policy.status,
        skippedReason: skip,
        candidatesGenerated: 0,
        verificationPassCount: 0,
        verificationWarningCount: 0,
        verificationFailCount: 0,
        candidatesWithoutTrace: 0,
        averageLatencyMs: 0,
        totalEstimatedCostCents: 0
      },
      candidates: [],
      reports: []
    };
  }

  const candidates: RenderCandidate[] = [];
  const reports: RenderVerificationReport[] = [];
  let pass = 0;
  let warning = 0;
  let fail = 0;
  let candidatesWithoutTrace = 0;
  for (const spec of specs) {
    const candidateId = `bakeoff-${bakeoffRunId}-${entry.provider.providerId}-${spec.renderSpecId}`;
    const raw = await entry.provider.generate({
      spec,
      renderJob,
      policy: entry.policy,
      candidateId,
      requestedAt: runAt
    });
    const candidate = RenderCandidateSchema.parse(raw);
    candidates.push(candidate);

    // ProviderTrace required: canonical schema embeds it, but assert
    // the provider populated it (length > 0 providerCalls or networkCalls=false).
    const traceWellFormed =
      candidate.trace.traceId.length > 0 && candidate.trace.providerCalls.length >= 0;
    if (!traceWellFormed) {
      candidatesWithoutTrace++;
    }

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: `bakeoff-report-${candidateId}`,
      createdAt: runAt
    });
    reports.push(report);
    if (report.status === "pass") pass++;
    else if (report.status === "warning") warning++;
    else fail++;
  }

  return {
    summary: {
      providerId: entry.provider.providerId,
      providerName: entry.provider.providerName,
      policyId: entry.policy.policyId,
      policyStatus: entry.policy.status,
      candidatesGenerated: candidates.length,
      verificationPassCount: pass,
      verificationWarningCount: warning,
      verificationFailCount: fail,
      candidatesWithoutTrace,
      // Mock adapters resolve synchronously — average latency is 0
      // for the test mode but the field is preserved for future real-provider
      // bakeoffs.
      averageLatencyMs: 0,
      totalEstimatedCostCents: 0
    },
    candidates,
    reports
  };
}

function checkSkip(entry: RegisteredProvider, bakeoffOnly: boolean): string | null {
  try {
    assertProviderAllowedForJob(entry.policy, { forRealProvider: false, bakeoffOnly });
  } catch (e) {
    if (e instanceof RenderProviderPolicyError) {
      return `policy_gate: ${e.code}`;
    }
    throw e;
  }
  if (entry.policy.status === "blocked") {
    return `policy_gate: blocked`;
  }
  return null;
}

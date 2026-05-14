import { assertProviderAllowedForJob, RenderProviderPolicyError } from "../policy/assert-provider-allowed.js";
import type { RenderProviderPolicy } from "../policy/render-provider-policy.js";
import type { ImageGenerationProvider } from "./image-generation-provider.js";

export interface RegisteredProvider {
  provider: ImageGenerationProvider;
  policy: RenderProviderPolicy;
}

export interface ProviderRegistry {
  register(entry: RegisteredProvider): void;
  get(providerId: string): RegisteredProvider | undefined;
  list(): ReadonlyArray<RegisteredProvider>;
  allowedForBakeoff(): ReadonlyArray<RegisteredProvider>;
}

export class InMemoryProviderRegistry implements ProviderRegistry {
  readonly #entries = new Map<string, RegisteredProvider>();

  register(entry: RegisteredProvider): void {
    if (entry.provider.providerId !== entry.policy.providerName) {
      // Loose mapping: providerName on policy may match providerId on adapter;
      // we don't enforce, but we do log via the validation in tests.
    }
    if (this.#entries.has(entry.provider.providerId)) {
      throw new Error(`duplicate provider id ${entry.provider.providerId}`);
    }
    this.#entries.set(entry.provider.providerId, entry);
  }

  get(providerId: string): RegisteredProvider | undefined {
    return this.#entries.get(providerId);
  }

  list(): ReadonlyArray<RegisteredProvider> {
    return Array.from(this.#entries.values());
  }

  allowedForBakeoff(): ReadonlyArray<RegisteredProvider> {
    return this.list().filter((entry) => {
      try {
        assertProviderAllowedForJob(entry.policy, { forRealProvider: false, bakeoffOnly: true });
        return entry.policy.status !== "blocked";
      } catch (e) {
        if (e instanceof RenderProviderPolicyError) {
          return false;
        }
        throw e;
      }
    });
  }
}

export function createMockProviderPolicy(providerName: string, modelId: string): RenderProviderPolicy {
  return {
    policyId: `policy-mock-${providerName}`,
    providerName,
    modelId,
    status: "allowed_for_mock",
    maxCandidatesPerRoom: 1,
    maxAttemptsPerJob: 1,
    timeoutMs: 5000,
    maxEstimatedCostCentsPerCandidate: 0,
    commercialUseStatus: "allowed",
    dataRetentionStatus: "acceptable",
    copyrightRisk: "low",
    requiresHumanReview: false
  };
}

export function createStubBakeoffPolicy(providerName: string, modelId: string): RenderProviderPolicy {
  return {
    policyId: `policy-stub-${providerName}`,
    providerName,
    modelId,
    status: "allowed_for_bakeoff",
    maxCandidatesPerRoom: 1,
    maxAttemptsPerJob: 1,
    timeoutMs: 5000,
    maxEstimatedCostCentsPerCandidate: 0,
    commercialUseStatus: "allowed",
    dataRetentionStatus: "acceptable",
    copyrightRisk: "low",
    requiresHumanReview: false
  };
}

export function createBlockedRealProviderPolicy(providerName: string, modelId: string): RenderProviderPolicy {
  return {
    policyId: `policy-blocked-${providerName}`,
    providerName,
    modelId,
    status: "blocked",
    maxCandidatesPerRoom: 1,
    maxAttemptsPerJob: 1,
    timeoutMs: 30000,
    maxEstimatedCostCentsPerCandidate: 0,
    commercialUseStatus: "unknown",
    dataRetentionStatus: "unknown",
    copyrightRisk: "unknown",
    requiresHumanReview: true
  };
}

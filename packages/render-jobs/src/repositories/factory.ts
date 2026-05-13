import {
  InMemoryProviderTraceRepository,
  InMemoryRenderCandidateRepository,
  InMemoryRenderJobRepository,
  InMemoryRenderVerificationRepository
} from "./in-memory.js";
import type { AdsRepositorySet } from "./interfaces.js";

export function createInMemoryAdsRepositories(): AdsRepositorySet {
  return {
    jobs: new InMemoryRenderJobRepository(),
    candidates: new InMemoryRenderCandidateRepository(),
    verifications: new InMemoryRenderVerificationRepository(),
    providerTraces: new InMemoryProviderTraceRepository()
  };
}

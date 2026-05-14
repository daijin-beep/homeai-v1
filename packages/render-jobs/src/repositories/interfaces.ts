import type { ProviderTrace } from "@homeai/image-adapter";
import type { RenderVerificationReport } from "@homeai/render-verifier";

import type { RenderCandidate } from "../contracts/render-candidate.js";
import type { RenderJob, RenderJobStatus } from "../contracts/render-job.js";

export interface RenderJobListFilter {
  schemeId?: string;
  roomId?: string;
  status?: RenderJobStatus;
}

export interface RenderJobRepository {
  create(job: RenderJob): RenderJob;
  get(renderJobId: string): RenderJob | undefined;
  update(job: RenderJob): RenderJob;
  list(filter?: RenderJobListFilter): RenderJob[];
}

export interface RenderCandidateListFilter {
  renderJobId?: string;
  renderSpecId?: string;
  roomId?: string;
}

export interface RenderCandidateRepository {
  create(candidate: RenderCandidate): RenderCandidate;
  get(candidateId: string): RenderCandidate | undefined;
  list(filter?: RenderCandidateListFilter): RenderCandidate[];
}

export interface RenderVerificationRepository {
  create(report: RenderVerificationReport): RenderVerificationReport;
  getLatestByCandidate(candidateId: string): RenderVerificationReport | undefined;
}

export interface ProviderTraceListFilter {
  renderJobId?: string;
  candidateId?: string;
}

export interface ProviderTraceRepository {
  create(trace: ProviderTrace, link: { renderJobId: string; candidateId?: string }): ProviderTrace;
  get(traceId: string): ProviderTrace | undefined;
  list(filter?: ProviderTraceListFilter): ProviderTrace[];
}

export interface AdsRepositorySet {
  jobs: RenderJobRepository;
  candidates: RenderCandidateRepository;
  verifications: RenderVerificationRepository;
  providerTraces: ProviderTraceRepository;
}

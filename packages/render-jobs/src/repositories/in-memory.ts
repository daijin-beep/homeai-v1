import { ProviderTraceSchema, type ProviderTrace } from "@homeai/image-adapter";
import { RenderVerificationReportSchema, type RenderVerificationReport } from "@homeai/render-verifier";

import { RenderCandidateSchema, type RenderCandidate } from "../contracts/render-candidate.js";
import { RenderJobSchema, type RenderJob } from "../contracts/render-job.js";
import { RenderJobNotFoundError } from "../errors/job-errors.js";
import type {
  ProviderTraceListFilter,
  ProviderTraceRepository,
  RenderCandidateListFilter,
  RenderCandidateRepository,
  RenderJobListFilter,
  RenderJobRepository,
  RenderVerificationRepository
} from "./interfaces.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryRenderJobRepository implements RenderJobRepository {
  readonly #jobs = new Map<string, RenderJob>();

  create(job: RenderJob): RenderJob {
    const parsed = RenderJobSchema.parse(clone(job));
    if (this.#jobs.has(parsed.renderJobId)) {
      throw new Error(`Duplicate renderJobId ${parsed.renderJobId}`);
    }
    this.#jobs.set(parsed.renderJobId, clone(parsed));
    return clone(parsed);
  }

  get(renderJobId: string): RenderJob | undefined {
    const job = this.#jobs.get(renderJobId);
    return job === undefined ? undefined : clone(job);
  }

  update(job: RenderJob): RenderJob {
    const parsed = RenderJobSchema.parse(clone(job));
    if (!this.#jobs.has(parsed.renderJobId)) {
      throw new RenderJobNotFoundError(parsed.renderJobId);
    }
    this.#jobs.set(parsed.renderJobId, clone(parsed));
    return clone(parsed);
  }

  list(filter?: RenderJobListFilter): RenderJob[] {
    const rows = Array.from(this.#jobs.values());
    return rows
      .filter((job) =>
        (filter?.schemeId === undefined || job.schemeId === filter.schemeId) &&
        (filter?.roomId === undefined || job.roomId === filter.roomId) &&
        (filter?.status === undefined || job.status === filter.status)
      )
      .map(clone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemoryRenderCandidateRepository implements RenderCandidateRepository {
  readonly #candidates = new Map<string, RenderCandidate>();

  create(candidate: RenderCandidate): RenderCandidate {
    const parsed = RenderCandidateSchema.parse(clone(candidate));
    if (this.#candidates.has(parsed.candidateId)) {
      throw new Error(`Duplicate candidateId ${parsed.candidateId}`);
    }
    this.#candidates.set(parsed.candidateId, clone(parsed));
    return clone(parsed);
  }

  get(candidateId: string): RenderCandidate | undefined {
    const c = this.#candidates.get(candidateId);
    return c === undefined ? undefined : clone(c);
  }

  list(filter?: RenderCandidateListFilter): RenderCandidate[] {
    return Array.from(this.#candidates.values())
      .filter((c) =>
        (filter?.renderJobId === undefined || c.renderJobId === filter.renderJobId) &&
        (filter?.renderSpecId === undefined || c.renderSpecId === filter.renderSpecId) &&
        (filter?.roomId === undefined || c.roomId === filter.roomId)
      )
      .map(clone)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export class InMemoryRenderVerificationRepository implements RenderVerificationRepository {
  readonly #reports: RenderVerificationReport[] = [];

  create(report: RenderVerificationReport): RenderVerificationReport {
    const parsed = RenderVerificationReportSchema.parse(clone(report));
    this.#reports.push(clone(parsed));
    return clone(parsed);
  }

  getLatestByCandidate(candidateId: string): RenderVerificationReport | undefined {
    const matches = this.#reports.filter((r) => r.candidateId === candidateId);
    if (matches.length === 0) {
      return undefined;
    }
    matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = matches[0];
    return latest === undefined ? undefined : clone(latest);
  }
}

export class InMemoryProviderTraceRepository implements ProviderTraceRepository {
  readonly #traces = new Map<string, ProviderTrace>();
  readonly #linksByJob = new Map<string, Set<string>>();
  readonly #linksByCandidate = new Map<string, Set<string>>();

  create(trace: ProviderTrace, link: { renderJobId: string; candidateId?: string }): ProviderTrace {
    const parsed = ProviderTraceSchema.parse(clone(trace));
    this.#traces.set(parsed.traceId, clone(parsed));
    const jobLinks = this.#linksByJob.get(link.renderJobId) ?? new Set<string>();
    jobLinks.add(parsed.traceId);
    this.#linksByJob.set(link.renderJobId, jobLinks);
    if (link.candidateId !== undefined) {
      const cLinks = this.#linksByCandidate.get(link.candidateId) ?? new Set<string>();
      cLinks.add(parsed.traceId);
      this.#linksByCandidate.set(link.candidateId, cLinks);
    }
    return clone(parsed);
  }

  get(traceId: string): ProviderTrace | undefined {
    const t = this.#traces.get(traceId);
    return t === undefined ? undefined : clone(t);
  }

  list(filter?: ProviderTraceListFilter): ProviderTrace[] {
    let ids: string[];
    if (filter?.renderJobId !== undefined) {
      ids = Array.from(this.#linksByJob.get(filter.renderJobId) ?? []);
    } else if (filter?.candidateId !== undefined) {
      ids = Array.from(this.#linksByCandidate.get(filter.candidateId) ?? []);
    } else {
      ids = Array.from(this.#traces.keys());
    }
    return ids
      .map((id) => this.#traces.get(id))
      .filter((t): t is ProviderTrace => t !== undefined)
      .map(clone)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
}

import { createHash } from "node:crypto";

import type { CreativeRenderSpecConsumer } from "@homeai/ads-render";

import {
  type ImageGenerationInput,
  type ImageGenerationProvider,
  type ImageGenerationResult,
  type ImageProviderCapabilities,
  type ProviderCostEstimate
} from "../contracts/image-generation-provider.js";
import type { ProviderTrace } from "../contracts/provider-trace.js";
import type { RenderProviderPolicy, RenderProviderPolicySnapshot } from "../contracts/render-provider-policy.js";

export type MockImageAdapterMode = "normal" | "timeout" | "malformed" | "storage_fail";

export interface MockImageAdapterOptions {
  clock?: { now(): string };
  mode?: MockImageAdapterMode;
}

const ADAPTER_VERSION = "0.1.0";

export class MockImageAdapter implements ImageGenerationProvider {
  readonly providerName = "mock";
  readonly providerModel = "mock-deterministic-v1";
  readonly adapterVersion = ADAPTER_VERSION;
  readonly #clock: { now(): string };
  readonly #mode: MockImageAdapterMode;

  constructor(options: MockImageAdapterOptions = {}) {
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
    this.#mode = options.mode ?? "normal";
  }

  capabilities(): ImageProviderCapabilities {
    return {
      supportsControlRender: true,
      supportsDepth: true,
      supportsSemanticMask: true,
      supportsLineMap: true,
      supportsLockedGeometryMask: true,
      supportsAnchorLayoutMask: true,
      maxCandidatesPerRequest: 1
    };
  }

  estimateCost(_input: ImageGenerationInput): Promise<ProviderCostEstimate> {
    return Promise.resolve({ estimatedCostCents: 0, currency: "USD" });
  }

  generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    if (this.#mode === "timeout") {
      return Promise.reject(new MockImageAdapterError("timeout", "Mock provider simulated timeout"));
    }
    if (this.#mode === "storage_fail") {
      return Promise.reject(
        new MockImageAdapterError("storage_failed", "Mock provider simulated storage failure")
      );
    }
    const { spec, policy } = input;
    const startedAt = this.#clock.now();
    const completedAt = this.#clock.now();
    const baseTrace = this.#buildTrace(spec, policy, startedAt, completedAt);

    if (this.#mode === "malformed") {
      // Intentionally invalid result: empty imageUrl. Caller must reject.
      const malformed: ImageGenerationResult = {
        imageUrl: "",
        providerTrace: { ...baseTrace, errorCode: "malformed" }
      };
      return Promise.resolve(malformed);
    }

    const imageUrl = deterministicSvgDataUri(spec);
    const outputAssetHash = sha256(imageUrl);
    return Promise.resolve({
      imageUrl,
      providerTrace: { ...baseTrace, outputAssetHash }
    });
  }

  #buildTrace(
    spec: CreativeRenderSpecConsumer,
    policy: RenderProviderPolicy,
    startedAt: string,
    completedAt: string
  ): ProviderTrace {
    return {
      traceId: "trace_" + sha256("trace:" + spec.renderSpecId + ":" + startedAt).slice(0, 24),
      providerName: this.providerName,
      providerModel: this.providerModel,
      adapterVersion: this.adapterVersion,
      startedAt,
      completedAt,
      latencyMs: 0,
      estimatedCostCents: 0,
      inputAssetHashes: Object.values(spec.inputs).map((url) => sha256(url)),
      policySnapshot: snapshotPolicy(policy),
      safetyStatus: "not_checked"
    };
  }
}

export class MockImageAdapterError extends Error {
  override readonly name = "MockImageAdapterError";
  readonly code: "timeout" | "storage_failed";
  constructor(code: "timeout" | "storage_failed", message: string) {
    super(message);
    this.code = code;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicSvgDataUri(spec: CreativeRenderSpecConsumer): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">` +
    `<rect width="100%" height="100%" fill="#1a2233"/>` +
    `<text x="50%" y="40%" fill="#e8eaed" font-family="monospace" font-size="14" text-anchor="middle">MOCK RENDER</text>` +
    `<text x="50%" y="55%" fill="#9aa0a6" font-family="monospace" font-size="11" text-anchor="middle">${escapeSvg(
      spec.renderSpecId
    )}</text>` +
    `<text x="50%" y="70%" fill="#9aa0a6" font-family="monospace" font-size="11" text-anchor="middle">${escapeSvg(
      spec.roomId
    )} / ${escapeSvg(spec.cameraId)}</text>` +
    `</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>]/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;"));
}

function snapshotPolicy(policy: RenderProviderPolicy): RenderProviderPolicySnapshot {
  return { ...policy };
}

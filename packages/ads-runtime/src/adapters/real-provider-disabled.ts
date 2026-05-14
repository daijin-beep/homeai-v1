import type {
  ImageGenerationInput,
  ImageGenerationProvider
} from "./image-generation-provider.js";
import {
  evaluateRealProviderSpikeGate,
  type RealProviderSpikeGateInput,
  type RealProviderSpikeGateResult
} from "../policy/real-provider-spike-gate.js";

/**
 * Disabled-by-default scaffold for a future real-provider adapter.
 *
 * Per recovery task card §10, every gate must pass before a real provider
 * is allowed to run. As of this commit:
 *   - no provider credentials are present
 *   - Kim has not signed ADS-OI-006 (cost cap / allowlist / version)
 *   - Kim has not signed ADS-OI-007 (commercial-use / copyright)
 *   - Cost & Compliance Settings remains "待 Kim 填"
 *
 * Therefore `generate()` always throws. The constructor accepts the gate
 * context so callers can serialize a structured "why it's disabled"
 * report for the blocked-report file.
 */
export class RealProviderDisabledError extends Error {
  override readonly name = "RealProviderDisabledError";
  readonly gateResult: RealProviderSpikeGateResult;
  constructor(message: string, gateResult: RealProviderSpikeGateResult) {
    super(message);
    this.gateResult = gateResult;
  }
}

export interface DisabledRealProviderAdapterOptions {
  providerId: string;
  providerName: string;
  modelId: string;
  adapterVersion?: string;
  gate: RealProviderSpikeGateInput;
}

export class DisabledRealProviderAdapter implements ImageGenerationProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind = "external_adapter_placeholder" as const;
  readonly modelId: string;
  readonly adapterVersion: string;
  readonly #gate: RealProviderSpikeGateInput;

  constructor(options: DisabledRealProviderAdapterOptions) {
    this.providerId = options.providerId;
    this.providerName = options.providerName;
    this.modelId = options.modelId;
    this.adapterVersion = options.adapterVersion ?? "0.0.0-disabled";
    this.#gate = options.gate;
  }

  /**
   * Re-evaluate gate state on every call. The disabled scaffold refuses
   * to run unless every check in the spike gate passes. There is no
   * "force" override and no network call regardless of input.
   */
  generate(_input: ImageGenerationInput): Promise<never> {
    const result = evaluateRealProviderSpikeGate(this.#gate);
    if (result.allRequiredGatesPassed) {
      // Defensive: even if every gate passes, this scaffold must not
      // perform a real call. The actual adapter lands in a future
      // commit once Kim approves and credentials are wired.
      return Promise.reject(
        new RealProviderDisabledError(
          "real provider gate passed but adapter implementation is not present yet",
          result
        )
      );
    }
    return Promise.reject(
      new RealProviderDisabledError(
        `real provider is disabled; blocking gates: ${result.blockingReasons.join("; ")}`,
        result
      )
    );
  }

  /**
   * Snapshot for the blocked-report file / dev page.
   */
  describeGate(): RealProviderSpikeGateResult {
    return evaluateRealProviderSpikeGate(this.#gate);
  }
}

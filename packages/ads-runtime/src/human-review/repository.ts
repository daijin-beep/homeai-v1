import {
  HumanReviewDecisionRecordSchema,
  HumanReviewItemSchema,
  type HumanReviewDecisionRecord,
  type HumanReviewItem
} from "./contract.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface HumanReviewQueueFilter {
  status?: HumanReviewItem["status"];
  schemeId?: string;
  roomId?: string;
}

export interface HumanReviewRepository {
  enqueue(item: HumanReviewItem): HumanReviewItem;
  get(reviewItemId: string): HumanReviewItem | undefined;
  list(filter?: HumanReviewQueueFilter): HumanReviewItem[];
  recordDecision(decision: HumanReviewDecisionRecord, nextStatus: HumanReviewItem["status"]): {
    item: HumanReviewItem;
    decision: HumanReviewDecisionRecord;
  };
  decisionsForItem(reviewItemId: string): HumanReviewDecisionRecord[];
}

export class InMemoryHumanReviewRepository implements HumanReviewRepository {
  readonly #items = new Map<string, HumanReviewItem>();
  readonly #decisions = new Map<string, HumanReviewDecisionRecord[]>();

  enqueue(item: HumanReviewItem): HumanReviewItem {
    const parsed = HumanReviewItemSchema.parse(clone(item));
    if (this.#items.has(parsed.reviewItemId)) {
      throw new Error(`duplicate human review item ${parsed.reviewItemId}`);
    }
    this.#items.set(parsed.reviewItemId, clone(parsed));
    return clone(parsed);
  }

  get(reviewItemId: string): HumanReviewItem | undefined {
    const item = this.#items.get(reviewItemId);
    return item === undefined ? undefined : clone(item);
  }

  list(filter?: HumanReviewQueueFilter): HumanReviewItem[] {
    return Array.from(this.#items.values())
      .filter(
        (item) =>
          (filter?.status === undefined || item.status === filter.status) &&
          (filter?.schemeId === undefined || item.schemeId === filter.schemeId) &&
          (filter?.roomId === undefined || item.roomId === filter.roomId)
      )
      .map(clone)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }

  recordDecision(
    decision: HumanReviewDecisionRecord,
    nextStatus: HumanReviewItem["status"]
  ): { item: HumanReviewItem; decision: HumanReviewDecisionRecord } {
    const parsedDecision = HumanReviewDecisionRecordSchema.parse(clone(decision));
    const existing = this.#items.get(parsedDecision.reviewItemId);
    if (existing === undefined) {
      throw new Error(`review item ${parsedDecision.reviewItemId} not found`);
    }
    if (existing.geometryHash !== parsedDecision.snapshot.geometryHash) {
      throw new Error(
        `geometryHash drift: review item ${existing.reviewItemId} expected ${existing.geometryHash} but decision snapshot has ${parsedDecision.snapshot.geometryHash}`
      );
    }
    const updated: HumanReviewItem = { ...existing, status: nextStatus };
    this.#items.set(updated.reviewItemId, clone(updated));
    const list = this.#decisions.get(parsedDecision.reviewItemId) ?? [];
    list.push(clone(parsedDecision));
    this.#decisions.set(parsedDecision.reviewItemId, list);
    return { item: clone(updated), decision: clone(parsedDecision) };
  }

  decisionsForItem(reviewItemId: string): HumanReviewDecisionRecord[] {
    const list = this.#decisions.get(reviewItemId) ?? [];
    return list.map(clone);
  }
}

export function createInMemoryHumanReviewRepository(): HumanReviewRepository {
  return new InMemoryHumanReviewRepository();
}

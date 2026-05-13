import {
  GeometryHashComparisonSchema,
  P1InvalidationSummarySchema,
  PreservedNonGeometryStateSchema,
  type CanonicalFloorplanRevision,
  type GeometryDependencyRecord,
  type GeometryHash,
  type GeometryHashComparison,
  type P1InvalidationSummary,
  type PreservedNonGeometryState
} from "@homeai/contracts";
import type { GeometryDependencyRepository, SceneContractRepository } from "./repositories.js";

export const GEOMETRY_DEPENDENT_ARTIFACT_TYPES = [
  "SceneContract",
  "WhiteModel",
  "ControlScene",
  "RoomAffordanceGraph",
  "AnchorPlan",
  "CameraPlan",
  "CreativeRenderSpec",
  "RenderJob",
  "RenderCandidate",
  "RenderVerificationReport",
  "RoomGallery",
  "SchemeLiteContract",
  "RoomSchemeLite",
  "SkuFitResult"
] as const;

export function compareGeometryHash(
  previousGeometryHash: GeometryHash | undefined,
  newGeometryHash: GeometryHash | undefined
): GeometryHashComparison {
  return GeometryHashComparisonSchema.parse({
    changed: previousGeometryHash !== undefined && newGeometryHash !== undefined && previousGeometryHash !== newGeometryHash,
    ...(previousGeometryHash === undefined ? {} : { previousGeometryHash }),
    ...(newGeometryHash === undefined ? {} : { newGeometryHash })
  });
}

export function listGeometryDependentArtifacts(
  repository: GeometryDependencyRepository,
  input: { geometryHash?: GeometryHash; canonicalRevisionId?: string }
): GeometryDependencyRecord[] {
  if (input.canonicalRevisionId !== undefined) {
    return repository.listByCanonicalRevisionId(input.canonicalRevisionId);
  }
  if (input.geometryHash !== undefined) {
    return repository.listByGeometryHash(input.geometryHash);
  }
  return [];
}

export function invalidateArtifactsForNewRevision(
  repositories: {
    geometryDependencies: GeometryDependencyRepository;
    sceneContracts: SceneContractRepository;
  },
  input: {
    previousCanonicalRevision?: CanonicalFloorplanRevision;
    newCanonicalRevision: CanonicalFloorplanRevision;
    invalidatedAt: string;
  }
): P1InvalidationSummary {
  const previousHash = input.previousCanonicalRevision?.geometryHash;
  const newHash = input.newCanonicalRevision.geometryHash;
  const comparison = compareGeometryHash(previousHash, newHash);
  if (!comparison.changed || input.previousCanonicalRevision === undefined) {
    return returnInvalidationSummary({
      comparison,
      invalidatedDependencyIds: [],
      archivedDependencyIds: []
    });
  }

  const dependencies = repositories.geometryDependencies
    .listByCanonicalRevisionId(input.previousCanonicalRevision.canonicalRevisionId)
    .filter((record) => record.active);
  const invalidatedDependencyIds: string[] = [];
  const archivedDependencyIds: string[] = [];

  for (const dependency of dependencies) {
    const invalidated = repositories.geometryDependencies.markInvalidated(
      dependency.dependencyId,
      input.invalidatedAt
    );
    invalidatedDependencyIds.push(invalidated.dependencyId);
    if (dependency.artifactType === "SceneContract") {
      repositories.sceneContracts.archiveSceneContract(dependency.artifactId, input.invalidatedAt);
      const archived = repositories.geometryDependencies.markArchived(dependency.dependencyId, input.invalidatedAt);
      archivedDependencyIds.push(archived.dependencyId);
    }
  }

  return returnInvalidationSummary({
    comparison,
    invalidatedDependencyIds,
    archivedDependencyIds
  });
}

export function preserveNonGeometryPreferences(): PreservedNonGeometryState {
  return PreservedNonGeometryStateSchema.parse({
    uploadedSourceAsset: true,
    parseJobHistory: true,
    userAccount: true,
    designBriefText: true,
    stylePreference: true,
    budgetPreference: true,
    eventAuditLog: true,
    paymentRecords: true,
    previousPaidDeliverableAccess: true
  });
}

export function returnInvalidationSummary(input: {
  comparison: GeometryHashComparison;
  invalidatedDependencyIds: string[];
  archivedDependencyIds?: string[];
}): P1InvalidationSummary {
  return P1InvalidationSummarySchema.parse({
    changed: input.comparison.changed,
    ...(input.comparison.previousGeometryHash === undefined
      ? {}
      : { previousGeometryHash: input.comparison.previousGeometryHash }),
    ...(input.comparison.newGeometryHash === undefined
      ? {}
      : { newGeometryHash: input.comparison.newGeometryHash }),
    invalidatedDependencyIds: [...input.invalidatedDependencyIds].sort(),
    archivedDependencyIds: [...(input.archivedDependencyIds ?? [])].sort(),
    preserved: preserveNonGeometryPreferences()
  });
}

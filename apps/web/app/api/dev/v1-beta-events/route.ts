import {
  buildV1BetaEventDebugFixture,
  createInMemoryV1BetaEventRepository,
  type V1BetaEventRepository,
  v1BetaEventFixtureTimestamp,
} from "@homeai/analytics";
import {
  V1BetaEventDebugPayloadSchema,
  V1BetaEventIntakeRequestSchema,
} from "@homeai/contracts";

let repository: V1BetaEventRepository | undefined;

export async function GET() {
  if (isDevRouteDisabled()) {
    return notFoundResponse();
  }

  const activeRepository = getRepository();
  return Response.json(
    V1BetaEventDebugPayloadSchema.parse({
      ok: true,
      events: activeRepository.list(),
      summary: activeRepository.summarize(),
      generatedAt: v1BetaEventFixtureTimestamp,
    }),
  );
}

export async function POST(request: Request) {
  if (isDevRouteDisabled()) {
    return notFoundResponse();
  }

  try {
    const body = await request.json();
    const parsed =
      V1BetaEventIntakeRequestSchema.parse(body);
    return Response.json(
      getRepository().recordMany(parsed),
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown V1 Beta event intake error",
      },
      { status: 400 },
    );
  }
}

export function resetV1BetaEventDevRepositoryForTests(): void {
  repository = undefined;
}

function getRepository(): V1BetaEventRepository {
  if (repository === undefined) {
    repository = createInMemoryV1BetaEventRepository(
      buildV1BetaEventDebugFixture().events,
    );
  }
  return repository;
}

function isDevRouteDisabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEV_ROUTES !== "true"
  );
}

function notFoundResponse(): Response {
  return Response.json(
    { ok: false, error: "Not found" },
    { status: 404 },
  );
}

import { z } from "zod";
import { IdSchema, MetadataSchema, TimestampSchema } from "./common.js";

export const ErrorSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const ErrorModuleSchema = z.enum([
  "upload",
  "parse",
  "space_truth",
  "scene",
  "camera",
  "render",
  "sku",
  "lead"
]);

export const REQUIRED_ERROR_CODES = [
  "UPLOAD_UNSUPPORTED_FORMAT",
  "UPLOAD_TOO_LARGE",
  "IMAGE_TOO_LOW_RESOLUTION",
  "PARSE_PROVIDER_TIMEOUT",
  "PARSE_PROVIDER_MALFORMED_OUTPUT",
  "SCALE_UNKNOWN",
  "LOW_CONFIDENCE_ROOM_BOUNDARY",
  "TOPOLOGY_INVALID",
  "OPENING_UNCONFIRMED",
  "SPACE_TRUTH_SCORE_TOO_LOW",
  "SCENE_CONTRACT_INVALID",
  "CAMERA_PLAN_FAILED",
  "CAMERA_INTERSECTS_WALL",
  "RENDER_PROVIDER_FAILED",
  "RENDER_CONSTRAINT_VIOLATION",
  "ROOM_RENDER_INCOMPLETE",
  "SKU_SIZE_MISMATCH",
  "SKU_PROVIDER_EMPTY",
  "LEAD_EVENT_INVALID",
  "PII_CAPTURE_BLOCKED"
] as const;

export const ErrorCodeSchema = z.enum(REQUIRED_ERROR_CODES);

export const ErrorDefinitionSchema = z
  .object({
    code: ErrorCodeSchema,
    module: ErrorModuleSchema,
    severity: ErrorSeveritySchema,
    blocking: z.boolean(),
    userFixable: z.boolean(),
    defaultMessage: z.string().min(1)
  })
  .strict();

export const ERROR_DEFINITIONS = [
  {
    code: "UPLOAD_UNSUPPORTED_FORMAT",
    module: "upload",
    severity: "error",
    blocking: true,
    userFixable: true,
    defaultMessage: "Upload format is not supported."
  },
  {
    code: "UPLOAD_TOO_LARGE",
    module: "upload",
    severity: "error",
    blocking: true,
    userFixable: true,
    defaultMessage: "Uploaded file is too large."
  },
  {
    code: "IMAGE_TOO_LOW_RESOLUTION",
    module: "upload",
    severity: "error",
    blocking: true,
    userFixable: true,
    defaultMessage: "Floorplan image resolution is too low."
  },
  {
    code: "PARSE_PROVIDER_TIMEOUT",
    module: "parse",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Floorplan provider timed out."
  },
  {
    code: "PARSE_PROVIDER_MALFORMED_OUTPUT",
    module: "parse",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Floorplan provider returned malformed output."
  },
  {
    code: "SCALE_UNKNOWN",
    module: "space_truth",
    severity: "error",
    blocking: true,
    userFixable: true,
    defaultMessage: "Floorplan scale is unknown."
  },
  {
    code: "LOW_CONFIDENCE_ROOM_BOUNDARY",
    module: "space_truth",
    severity: "warning",
    blocking: false,
    userFixable: true,
    defaultMessage: "A room boundary has low confidence."
  },
  {
    code: "TOPOLOGY_INVALID",
    module: "space_truth",
    severity: "critical",
    blocking: true,
    userFixable: true,
    defaultMessage: "Floorplan topology is invalid."
  },
  {
    code: "OPENING_UNCONFIRMED",
    module: "space_truth",
    severity: "warning",
    blocking: false,
    userFixable: true,
    defaultMessage: "A door or window opening needs confirmation."
  },
  {
    code: "SPACE_TRUTH_SCORE_TOO_LOW",
    module: "space_truth",
    severity: "error",
    blocking: true,
    userFixable: true,
    defaultMessage: "Space truth score is below the required threshold."
  },
  {
    code: "SCENE_CONTRACT_INVALID",
    module: "scene",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Scene contract failed validation."
  },
  {
    code: "CAMERA_PLAN_FAILED",
    module: "camera",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Camera planning failed."
  },
  {
    code: "CAMERA_INTERSECTS_WALL",
    module: "camera",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Camera path intersects a wall."
  },
  {
    code: "RENDER_PROVIDER_FAILED",
    module: "render",
    severity: "error",
    blocking: false,
    userFixable: false,
    defaultMessage: "Render provider failed."
  },
  {
    code: "RENDER_CONSTRAINT_VIOLATION",
    module: "render",
    severity: "critical",
    blocking: true,
    userFixable: false,
    defaultMessage: "Render output violated geometry constraints."
  },
  {
    code: "ROOM_RENDER_INCOMPLETE",
    module: "render",
    severity: "warning",
    blocking: false,
    userFixable: false,
    defaultMessage: "Room render coverage is incomplete."
  },
  {
    code: "SKU_SIZE_MISMATCH",
    module: "sku",
    severity: "warning",
    blocking: false,
    userFixable: false,
    defaultMessage: "SKU size does not satisfy room constraints."
  },
  {
    code: "SKU_PROVIDER_EMPTY",
    module: "sku",
    severity: "warning",
    blocking: false,
    userFixable: false,
    defaultMessage: "SKU provider returned no candidates."
  },
  {
    code: "LEAD_EVENT_INVALID",
    module: "lead",
    severity: "error",
    blocking: true,
    userFixable: false,
    defaultMessage: "Lead event payload is invalid."
  },
  {
    code: "PII_CAPTURE_BLOCKED",
    module: "lead",
    severity: "critical",
    blocking: true,
    userFixable: false,
    defaultMessage: "Lead event metadata contains unnecessary PII."
  }
] as const satisfies readonly z.infer<typeof ErrorDefinitionSchema>[];

export const ERROR_CODES = ERROR_DEFINITIONS.map((definition) => definition.code);

export const AppErrorSchema = z
  .object({
    id: IdSchema.optional(),
    code: ErrorCodeSchema,
    module: ErrorModuleSchema,
    severity: ErrorSeveritySchema,
    message: z.string().min(1),
    blocking: z.boolean(),
    userFixable: z.boolean(),
    details: MetadataSchema.optional(),
    createdAt: TimestampSchema.optional()
  })
  .strict();

export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;
export type ErrorModule = z.infer<typeof ErrorModuleSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorDefinition = z.infer<typeof ErrorDefinitionSchema>;
export type AppError = z.infer<typeof AppErrorSchema>;

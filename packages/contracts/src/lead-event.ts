import { z } from "zod";
import { IdSchema, JsonPrimitiveSchema, TimestampSchema } from "./common.js";

export const LeadEventTypeSchema = z.enum([
  "floorplan_uploaded",
  "space_confirmed",
  "white_model_viewed",
  "room_render_viewed",
  "product_view",
  "product_click",
  "product_save",
  "alternative_click",
  "contact_request",
  "style_regenerate",
  "room_regenerate"
]);

const blockedPiiMetadataKeys = new Set([
  "email",
  "phone",
  "phoneNumber",
  "fullName",
  "name",
  "address",
  "streetAddress",
  "idCard"
]);

export const LeadEventMetadataSchema = z
  .record(z.string(), JsonPrimitiveSchema)
  .superRefine((metadata, context) => {
    for (const key of Object.keys(metadata)) {
      if (blockedPiiMetadataKeys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `LeadEvent metadata must not include unnecessary PII key: ${key}`,
          path: [key]
        });
      }
    }
  });

export const LeadEventSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    eventType: LeadEventTypeSchema,
    source: z.string().min(1),
    roomId: IdSchema.optional(),
    recommendationId: IdSchema.optional(),
    productId: IdSchema.optional(),
    metadata: LeadEventMetadataSchema.optional(),
    createdAt: TimestampSchema
  })
  .strict();

export type LeadEventType = z.infer<typeof LeadEventTypeSchema>;
export type LeadEvent = z.infer<typeof LeadEventSchema>;

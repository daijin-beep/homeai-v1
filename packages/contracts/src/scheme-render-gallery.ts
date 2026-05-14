import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { P1RoomTypeSchema, GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { GalleryEligibilityStatusSchema } from "./render-gallery-eligibility.js";

export const RoomRenderStatusSchema = z.enum([
  "not_started",
  "pending",
  "has_eligible_render",
  "human_review_required",
  "failed",
  "missing_coverage"
]);

export const RenderCandidateCardViewModelSchema = z
  .object({
    renderCandidateId: IdSchema,
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: GeometryHashSchema,
    verificationReportId: IdSchema,
    imageUrl: z.string().min(1),
    thumbnailUrl: z.string().min(1).optional(),
    artifactHash: z.string().min(1),
    status: z.literal("eligible"),
    reasons: z.array(z.string().min(1)),
    createdAt: TimestampSchema
  })
  .strict();

export const RenderCandidateBlockSummarySchema = z
  .object({
    renderCandidateId: IdSchema,
    renderSpecId: IdSchema.optional(),
    roomId: IdSchema,
    cameraId: IdSchema.optional(),
    geometryHash: GeometryHashSchema.optional(),
    verificationReportId: IdSchema.optional(),
    status: GalleryEligibilityStatusSchema.exclude(["eligible"]),
    reasons: z.array(z.string().min(1))
  })
  .strict();

export const RoomRenderGalleryViewModelSchema = z
  .object({
    roomId: IdSchema,
    roomDisplayName: z.string().min(1),
    roomType: P1RoomTypeSchema,
    renderStatus: RoomRenderStatusSchema,
    eligibleCandidateCount: z.number().int().nonnegative(),
    blockedCandidateCount: z.number().int().nonnegative(),
    warningCandidateCount: z.number().int().nonnegative(),
    eligibleCandidates: z.array(RenderCandidateCardViewModelSchema),
    blockedCandidates: z.array(RenderCandidateBlockSummarySchema),
    warningCandidates: z.array(RenderCandidateBlockSummarySchema),
    issues: z.array(z.string().min(1))
  })
  .strict()
  .superRefine((room, ctx) => {
    if (room.eligibleCandidateCount !== room.eligibleCandidates.length) {
      ctx.addIssue({
        code: "custom",
        message: "eligibleCandidateCount must match eligibleCandidates",
        path: ["eligibleCandidateCount"]
      });
    }
    if (room.blockedCandidateCount !== room.blockedCandidates.length) {
      ctx.addIssue({
        code: "custom",
        message: "blockedCandidateCount must match blockedCandidates",
        path: ["blockedCandidateCount"]
      });
    }
    if (room.warningCandidateCount !== room.warningCandidates.length) {
      ctx.addIssue({
        code: "custom",
        message: "warningCandidateCount must match warningCandidates",
        path: ["warningCandidateCount"]
      });
    }
  });

export const SchemeRenderGallerySummarySchema = z
  .object({
    totalRooms: z.number().int().nonnegative(),
    roomsWithEligibleRender: z.number().int().nonnegative(),
    roomsNeedingHumanReview: z.number().int().nonnegative(),
    roomsFailed: z.number().int().nonnegative(),
    roomsMissingCoverage: z.number().int().nonnegative(),
    eligibleCandidateCount: z.number().int().nonnegative(),
    blockedCandidateCount: z.number().int().nonnegative(),
    warningCandidateCount: z.number().int().nonnegative(),
    status: z.enum(["pass", "warning", "fail"])
  })
  .strict();

export const SchemeRenderGalleryViewModelSchema = z
  .object({
    version: z.literal("0.1"),
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    summary: SchemeRenderGallerySummarySchema,
    rooms: z.array(RoomRenderGalleryViewModelSchema),
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((gallery, ctx) => {
    const totalRooms = gallery.rooms.length;
    if (gallery.summary.totalRooms !== totalRooms) {
      ctx.addIssue({ code: "custom", message: "summary totalRooms must match rooms", path: ["summary", "totalRooms"] });
    }

    const eligibleRooms = gallery.rooms.filter((room) => room.renderStatus === "has_eligible_render").length;
    const reviewRooms = gallery.rooms.filter((room) => room.renderStatus === "human_review_required").length;
    const failedRooms = gallery.rooms.filter((room) => room.renderStatus === "failed").length;
    const missingRooms = gallery.rooms.filter((room) => room.renderStatus === "missing_coverage").length;
    if (
      gallery.summary.roomsWithEligibleRender !== eligibleRooms ||
      gallery.summary.roomsNeedingHumanReview !== reviewRooms ||
      gallery.summary.roomsFailed !== failedRooms ||
      gallery.summary.roomsMissingCoverage !== missingRooms
    ) {
      ctx.addIssue({ code: "custom", message: "summary room status counts must match rooms", path: ["summary"] });
    }
  });

export type RoomRenderStatus = z.infer<typeof RoomRenderStatusSchema>;
export type RenderCandidateCardViewModel = z.infer<typeof RenderCandidateCardViewModelSchema>;
export type RenderCandidateBlockSummary = z.infer<typeof RenderCandidateBlockSummarySchema>;
export type RoomRenderGalleryViewModel = z.infer<typeof RoomRenderGalleryViewModelSchema>;
export type SchemeRenderGallerySummary = z.infer<typeof SchemeRenderGallerySummarySchema>;
export type SchemeRenderGalleryViewModel = z.infer<typeof SchemeRenderGalleryViewModelSchema>;

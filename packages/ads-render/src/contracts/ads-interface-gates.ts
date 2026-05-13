import { z } from "zod";

export const CreativeRenderSpecStatusSchema = z.enum(["draft", "proposed", "freeze_candidate", "frozen", "deprecated"]);

export const GalleryAdmissionPolicyStatusSchema = z.enum(["pending", "approved"]);

export const ProviderPolicyStatusSchema = z.enum(["pending", "approved"]);

export const AdsInterfaceGatesSchema = z
  .object({
    creativeRenderSpecStatus: CreativeRenderSpecStatusSchema,
    galleryAdmissionPolicyStatus: GalleryAdmissionPolicyStatusSchema,
    providerPolicyStatus: ProviderPolicyStatusSchema,
    realProviderAllowed: z.boolean(),
    mockProviderAllowed: z.boolean(),
    capturedAt: z.string().datetime({ offset: true })
  })
  .strict();

export type AdsInterfaceGates = z.infer<typeof AdsInterfaceGatesSchema>;

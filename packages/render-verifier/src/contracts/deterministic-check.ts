import { z } from "zod";

export const DeterministicCheckStatusSchema = z.enum(["pass", "warning", "fail", "unsupported"]);

export const DeterministicCheckSchema = z
  .object({
    checkId: z.string().min(1),
    name: z.string().min(1),
    status: DeterministicCheckStatusSchema,
    score: z.number().min(0).max(1).optional(),
    message: z.string().optional(),
    expected: z.unknown().optional(),
    actual: z.unknown().optional()
  })
  .strict();

export type DeterministicCheck = z.infer<typeof DeterministicCheckSchema>;

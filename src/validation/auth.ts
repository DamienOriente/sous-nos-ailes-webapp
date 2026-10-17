import { z } from "zod";
import { emailSchema } from "@/validation/common";

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Mot de passe requis." }).max(200),
  next: z.string().max(300).optional(),
});

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
});

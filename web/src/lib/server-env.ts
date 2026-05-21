import { z } from "zod";

const webServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  AUTH_SECRET: z.string().default(""),
});

export function getWebServerEnv() {
  return webServerEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    AUTH_SECRET: process.env.AUTH_SECRET ?? "",
  });
}

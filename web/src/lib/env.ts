import { z } from "zod";

const webPublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
});

export const webEnv = webPublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
});

export const isWebSupabaseConfigured = Boolean(
  webEnv.NEXT_PUBLIC_SUPABASE_URL && webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

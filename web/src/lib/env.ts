import { z } from "zod";

const webPublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  NEXT_PUBLIC_APPLE_APP_URL: z.string().default(""),
  NEXT_PUBLIC_GOOGLE_PLAY_URL: z.string().default(""),
  NEXT_PUBLIC_SCHOOL_INQUIRY_URL: z.string().default(""),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default(""),
});

export const webEnv = webPublicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  NEXT_PUBLIC_APPLE_APP_URL: process.env.NEXT_PUBLIC_APPLE_APP_URL ?? "",
  NEXT_PUBLIC_GOOGLE_PLAY_URL: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL ?? "",
  NEXT_PUBLIC_SCHOOL_INQUIRY_URL:
    process.env.NEXT_PUBLIC_SCHOOL_INQUIRY_URL ?? "",
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
});

export const isWebSupabaseConfigured = Boolean(
  webEnv.NEXT_PUBLIC_SUPABASE_URL && webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";

type EmailPasswordAuthInput = {
  email: string;
  password: string;
};

type EmailPasswordSignUpInput = EmailPasswordAuthInput & {
  fullName: string;
};

export type EmailPasswordSignUpResult = {
  needsEmailConfirmation: boolean;
};

export async function signInWithEmailPassword(
  input: EmailPasswordAuthInput
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { error } = await client.auth.signInWithPassword({
    email: normalizeEmail(input.email),
    password: input.password,
  });

  if (error) {
    throw error;
  }
}

export async function signUpWithEmailPassword(
  input: EmailPasswordSignUpInput
): Promise<EmailPasswordSignUpResult> {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email: normalizeEmail(input.email),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
      },
    },
  });

  if (error) {
    throw error;
  }

  return {
    needsEmailConfirmation: Boolean(data.user && !data.session),
  };
}

export function getEmailPasswordAuthErrorMessage(error: unknown) {
  const message = extractAuthErrorMessage(error);

  if (!message) {
    return "Unknown authentication error.";
  }

  if (/invalid login credentials/i.test(message)) {
    return "Invalid email or password.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Confirm your email first, then sign in.";
  }

  if (/already registered/i.test(message)) {
    return "This email is already registered. Try signing in instead.";
  }

  if (/password should be at least/i.test(message)) {
    return "Password is too short for Supabase policy.";
  }

  return message;
}

function extractAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

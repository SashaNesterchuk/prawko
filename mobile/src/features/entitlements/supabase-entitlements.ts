import { type AppFeature } from "@prawko/config";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import {
  createEmptyFeatureEntitlements,
  type SchoolAccessState,
} from "../../state/entitlements";

type RemoteFeatureEntitlementRow = {
  ends_at: string | null;
  feature_key: AppFeature;
  school_code_id: string | null;
  school_id: string | null;
  school_membership_id: string | null;
  source_type: "manual" | "purchase" | "school_code" | "trial";
  starts_at: string;
  status: "active" | "expired" | "revoked" | "scheduled";
};

type RemoteSchoolMembershipRow = {
  ends_at: string | null;
  id: string;
  school_code_id: string | null;
  school_id: string;
  schools:
    | {
        display_name: string;
      }
    | Array<{
        display_name: string;
      }>
    | null;
  started_at: string;
  status: "active" | "expired" | "revoked";
};

type RedeemSchoolCodeRow = {
  access_ends_at: string | null;
  access_starts_at: string;
  granted_features: AppFeature[];
  school_code_id: string;
  school_id: string;
  school_membership_id: string;
  school_name: string;
  was_already_member: boolean;
};

export type RemoteEntitlementSnapshot = {
  featureEntitlements: ReturnType<typeof createEmptyFeatureEntitlements>;
  schoolAccess: SchoolAccessState | null;
};

export type SchoolCodeRedemptionResult = {
  accessEndsAt: string | null;
  accessStartsAt: string;
  grantedFeatures: AppFeature[];
  schoolCodeId: string;
  schoolId: string;
  schoolMembershipId: string;
  schoolName: string;
  wasAlreadyMember: boolean;
};

export async function fetchRemoteEntitlementSnapshot(): Promise<RemoteEntitlementSnapshot> {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const now = Date.now();
  const [
    { data: entitlementData, error: entitlementError },
    { data: membershipData, error: membershipError },
  ] = await Promise.all([
    client
      .from("feature_entitlements")
      .select(
        "feature_key, source_type, school_id, school_membership_id, school_code_id, starts_at, ends_at, status"
      ),
    client
      .from("school_memberships")
      .select(
        "id, school_id, school_code_id, started_at, ends_at, status, schools(display_name)"
      )
      .order("created_at", { ascending: false }),
  ]);

  if (entitlementError) {
    throw entitlementError;
  }

  if (membershipError) {
    throw membershipError;
  }

  const featureEntitlements = createEmptyFeatureEntitlements();
  const entitlementRows =
    (((entitlementData ?? []) as unknown) as RemoteFeatureEntitlementRow[])
      .filter((row) => isEntitlementActive(row, now));

  for (const row of entitlementRows) {
    featureEntitlements[row.feature_key] = true;
  }

  const schoolMembershipRows =
    (((membershipData ?? []) as unknown) as RemoteSchoolMembershipRow[])
      .filter((row) => isMembershipActive(row, now));
  const activeSchoolMembership = schoolMembershipRows[0] ?? null;
  const schoolFeatureRows = activeSchoolMembership
    ? entitlementRows.filter(
        (row) =>
          row.source_type === "school_code" &&
          row.school_membership_id === activeSchoolMembership.id
      )
    : [];

  return {
    featureEntitlements,
    schoolAccess:
      activeSchoolMembership && schoolFeatureRows.length > 0
        ? {
            accessEndsAt: activeSchoolMembership.ends_at,
            accessStartsAt: activeSchoolMembership.started_at,
            grantedFeatures: schoolFeatureRows.map((row) => row.feature_key),
            schoolCodeId: activeSchoolMembership.school_code_id,
            schoolId: activeSchoolMembership.school_id,
            schoolMembershipId: activeSchoolMembership.id,
            schoolName: getSchoolName(activeSchoolMembership.schools),
          }
        : null,
  };
}

export async function redeemSchoolCode(
  schoolCode: string
): Promise<SchoolCodeRedemptionResult> {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const normalizedCode = normalizeSchoolCode(schoolCode);

  if (!normalizedCode) {
    throw new Error("School code is required.");
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("redeem_school_code", {
    p_code: normalizedCode,
  });

  if (error) {
    throw error;
  }

  const row = (((data ?? []) as unknown) as RedeemSchoolCodeRow[])[0];

  if (!row) {
    throw new Error("School code redeem returned an empty response.");
  }

  return {
    accessEndsAt: row.access_ends_at,
    accessStartsAt: row.access_starts_at,
    grantedFeatures: row.granted_features ?? [],
    schoolCodeId: row.school_code_id,
    schoolId: row.school_id,
    schoolMembershipId: row.school_membership_id,
    schoolName: row.school_name,
    wasAlreadyMember: row.was_already_member,
  };
}

export function getSchoolCodeRedeemErrorMessage(error: unknown) {
  const message = getErrorMessage(error);

  if (!message) {
    return "The school code could not be redeemed.";
  }

  if (/authentication required/i.test(message)) {
    return "Sign in first to redeem a school code.";
  }

  if (/school code is required/i.test(message)) {
    return "Enter a school code first.";
  }

  if (/school code not found/i.test(message)) {
    return "This school code was not found.";
  }

  if (/not active yet/i.test(message)) {
    return "This school code is not active yet.";
  }

  if (/expired/i.test(message)) {
    return "This school code has expired.";
  }

  if (/not active/i.test(message)) {
    return "This school code is not active.";
  }

  if (/redemption limit reached/i.test(message)) {
    return "This school code has no seats left.";
  }

  if (/school is not available/i.test(message)) {
    return "This driving school is not available right now.";
  }

  return message;
}

export function normalizeSchoolCode(value: string) {
  return value.trim().toUpperCase();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getSchoolName(
  schools: RemoteSchoolMembershipRow["schools"]
): string | null {
  if (Array.isArray(schools)) {
    return schools[0]?.display_name ?? null;
  }

  return schools?.display_name ?? null;
}

function isEntitlementActive(row: RemoteFeatureEntitlementRow, now: number) {
  const startsAt = new Date(row.starts_at).getTime();
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;

  return (
    row.status === "active" &&
    Number.isFinite(startsAt) &&
    startsAt <= now &&
    (endsAt === null || !Number.isFinite(endsAt) || endsAt >= now)
  );
}

function isMembershipActive(row: RemoteSchoolMembershipRow, now: number) {
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;

  return row.status === "active" && (endsAt === null || endsAt >= now);
}

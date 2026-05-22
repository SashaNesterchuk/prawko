import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { getAdminAuthReadiness } from "./admin-auth";
import { getWebServerEnv } from "./server-env";
import { getWebSupabaseAdminClient } from "./supabase-admin";

type DashboardMetric = {
  detail: string;
  label: string;
  value: string;
};

type DashboardError = {
  area: string;
  message: string;
};

type RecentProfile = {
  createdAt: string;
  currentCategory: string;
  fullName: string | null;
  id: string;
  interfaceLocale: string;
  onboardingCompleted: boolean;
};

type RecentEntitlement = {
  createdAt: string;
  endsAt: string | null;
  featureKey: string;
  schoolCodeId: string | null;
  schoolId: string | null;
  schoolName: string | null;
  startsAt: string;
  status: string;
  userId: string;
};

type RecentAiMessage = {
  content: string;
  conversationId: string;
  createdAt: string;
  fallbackUsed: boolean;
  inputTokens: number | null;
  latencyMs: number | null;
  messageKind: string;
  model: string | null;
  outputTokens: number | null;
  provider: string | null;
  questionId: string | null;
  userId: string;
};

type RecentAppErrorLog = {
  area: string;
  authMode: string | null;
  createdAt: string;
  errorCode: string | null;
  errorName: string | null;
  eventName: string;
  message: string;
  platform: string | null;
  severity: string;
  source: string;
  userId: string | null;
};

type SchoolRow = {
  city: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  isActive: boolean;
  slug: string;
  supportedLocales: string[];
};

type SchoolCodeRow = {
  code: string;
  createdAt: string;
  grantedFeatures: string[];
  grantsDays: number;
  id: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  schoolId: string;
  schoolName: string | null;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
};

type SchoolMembershipRow = {
  createdAt: string;
  endsAt: string | null;
  role: string;
  schoolId: string;
  schoolName: string | null;
  startedAt: string;
  status: string;
  userId: string;
};

type SchoolSummaryRow = {
  activeCodes: number;
  activeMembers: number;
  city: string | null;
  displayName: string;
  id: string;
  isActive: boolean;
  redeemedSeats: number;
  slug: string;
  supportedLocales: string[];
  totalCodes: number;
};

type ImportCheckpoint = {
  metrics: DashboardMetric[];
  path: string;
  status: "error" | "ok" | "warning";
  title: string;
  updatedAt: string | null;
};

type ValidationWarning = {
  code: string;
  message: string;
  questionSourceId: string | null;
  severity: string;
  sourceRowNumber: number | null;
};

type DatabaseComparison = {
  categoryBQuestions: number | null;
  questionsWithMedia: number | null;
  remoteActiveQuestions: number | null;
};

const syncReportSchema = z.object({
  batchCount: z.number(),
  batchSize: z.number(),
  dryRun: z.boolean(),
  failedRows: z.number(),
  failures: z
    .array(
      z.object({
        batchNumber: z.number(),
        error: z.string(),
        rowCount: z.number(),
      })
    )
    .default([]),
  inputPath: z.string(),
  processedRows: z.number(),
  syncedRows: z.number(),
  totalRows: z.number(),
});

const buildReportSchema = z.object({
  createdAssets: z.number(),
  createdPosters: z.number(),
  dryRun: z.boolean(),
  failedJobs: z.number(),
  processedJobs: z.number(),
  skippedJobs: z.number(),
});

const uploadReportSchema = z.object({
  dryRun: z.boolean(),
  failedObjects: z.number(),
  objects: z
    .array(
      z.object({
        bucket: z.string(),
        error: z.string().nullable(),
        localPath: z.string(),
        storagePath: z.string(),
        uploaded: z.boolean(),
      })
    )
    .default([]),
  uploadedObjects: z.number(),
});

const normalizedSummarySchema = z.object({
  categoryBQuestions: z.number(),
  issues: z.object({
    errors: z.number(),
    warnings: z.number(),
  }),
  totalMediaBuildJobs: z.number(),
  totalMediaEntries: z.number(),
  totalMediaReferences: z.number(),
  totalQuestions: z.number(),
});

const validationReportSchema = z.array(
  z.object({
    code: z.string(),
    message: z.string(),
    questionSourceId: z.string().optional(),
    severity: z.string(),
    sourceRowNumber: z.number().optional(),
  })
);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(currentDir, "../../..");
const REPORT_FILES = {
  buildReport: {
    absolutePath: path.join(
      REPO_ROOT,
      "data/questions/delivery/generated/build-report.json"
    ),
    path: "data/questions/delivery/generated/build-report.json",
  },
  normalizedSummary: {
    absolutePath: path.join(
      REPO_ROOT,
      "data/questions/normalized/generated/summary.json"
    ),
    path: "data/questions/normalized/generated/summary.json",
  },
  syncReport: {
    absolutePath: path.join(
      REPO_ROOT,
      "data/questions/exports/generated/supabase.questions.sync-report.json"
    ),
    path: "data/questions/exports/generated/supabase.questions.sync-report.json",
  },
  uploadReport: {
    absolutePath: path.join(
      REPO_ROOT,
      "data/questions/delivery/generated/upload-report.json"
    ),
    path: "data/questions/delivery/generated/upload-report.json",
  },
  validationReport: {
    absolutePath: path.join(
      REPO_ROOT,
      "data/questions/normalized/generated/validation-report.json"
    ),
    path: "data/questions/normalized/generated/validation-report.json",
  },
} as const;

export async function getAdminOverviewData() {
  const errors: DashboardError[] = [];
  const configuration = getAdminConfigurationStatus();

  if (!configuration.databaseConfigured) {
    return {
      configuration,
      errors,
      metrics: [
        createMetric(
          "Admin auth",
          configuration.authConfigured ? "Ready" : "Missing",
          configuration.authConfigured
            ? "Cookie session and admin gate can be used."
            : `Missing: ${configuration.authMissing.join(", ")}`
        ),
        createMetric(
          "Admin database",
          "Unavailable",
          "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for live overview data."
        ),
      ],
      recentAppErrorLogs: [] as RecentAppErrorLog[],
      recentAssistantMessages: [] as RecentAiMessage[],
      recentProfiles: [] as RecentProfile[],
      recentSchoolEntitlements: [] as RecentEntitlement[],
    };
  }

  const client = getWebSupabaseAdminClient();
  const last7DaysIso = daysAgoIso(7);

  const [
    totalProfiles,
    onboardingCompleted,
    totalStudyPlans,
    activeStudyPlans,
    recentAttempts,
    totalSchools,
    activeSchoolCodes,
    activeEntitlements,
    assistantMessagesLast7Days,
    appErrorsLast7Days,
    recentProfilesResponse,
    recentEntitlementsResponse,
    recentAiMessagesResponse,
    recentAppErrorLogsResponse,
  ] = await Promise.all([
    readCount(
      "profiles_total",
      client.from("profiles").select("*", { count: "exact", head: true })
    ),
    readCount(
      "profiles_onboarded",
      client
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("onboarding_completed", true)
    ),
    readCount(
      "study_plans_total",
      client.from("study_plans").select("*", { count: "exact", head: true })
    ),
    readCount(
      "study_plans_active",
      client
        .from("study_plans")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
    ),
    readCount(
      "question_attempts_last_7_days",
      client
        .from("question_attempts")
        .select("*", { count: "exact", head: true })
        .gte("answered_at", last7DaysIso)
    ),
    readCount(
      "schools_total",
      client.from("schools").select("*", { count: "exact", head: true })
    ),
    readCount(
      "school_codes_active",
      client
        .from("school_codes")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
    ),
    readCount(
      "feature_entitlements_active",
      client
        .from("feature_entitlements")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
    ),
    readCount(
      "ai_messages_assistant_last_7_days",
      client
        .from("ai_messages")
        .select("*", { count: "exact", head: true })
        .eq("message_role", "assistant")
        .gte("created_at", last7DaysIso)
    ),
    readCount(
      "app_error_logs_last_7_days",
      client
        .from("app_error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last7DaysIso)
    ),
    client
      .from("profiles")
      .select(
        "id, full_name, interface_locale, current_category, onboarding_completed, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(8),
    client
      .from("feature_entitlements")
      .select(
        "user_id, feature_key, status, school_id, school_code_id, starts_at, ends_at, created_at"
      )
      .eq("source_type", "school_code")
      .order("created_at", { ascending: false })
      .limit(8),
    client
      .from("ai_messages")
      .select(
        "user_id, question_id, conversation_id, message_kind, provider, model, content, input_tokens, output_tokens, latency_ms, metadata, created_at"
      )
      .eq("message_role", "assistant")
      .order("created_at", { ascending: false })
      .limit(12),
    client
      .from("app_error_logs")
      .select(
        "user_id, source, area, event_name, severity, message, error_name, error_code, auth_mode, platform, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  captureError(errors, totalProfiles);
  captureError(errors, onboardingCompleted);
  captureError(errors, totalStudyPlans);
  captureError(errors, activeStudyPlans);
  captureError(errors, recentAttempts);
  captureError(errors, totalSchools);
  captureError(errors, activeSchoolCodes);
  captureError(errors, activeEntitlements);
  captureError(errors, assistantMessagesLast7Days);
  captureError(errors, appErrorsLast7Days);

  const recentProfiles = unwrapRows<RecentProfile>(
    "profiles_recent",
    recentProfilesResponse,
    errors,
    (row) => ({
      createdAt: stringValue(row.created_at),
      currentCategory: stringValue(row.current_category),
      fullName: nullableStringValue(row.full_name),
      id: stringValue(row.id),
      interfaceLocale: stringValue(row.interface_locale),
      onboardingCompleted: Boolean(row.onboarding_completed),
    })
  );

  const recentEntitlements = unwrapRows<RecentEntitlement>(
    "feature_entitlements_recent",
    recentEntitlementsResponse,
    errors,
    (row) => ({
      createdAt: stringValue(row.created_at),
      endsAt: nullableStringValue(row.ends_at),
      featureKey: stringValue(row.feature_key),
      schoolCodeId: nullableStringValue(row.school_code_id),
      schoolId: nullableStringValue(row.school_id),
      schoolName: null,
      startsAt: stringValue(row.starts_at),
      status: stringValue(row.status),
      userId: stringValue(row.user_id),
    })
  );

  const schoolNameById = await getSchoolNamesById(
    recentEntitlements.map((row) => row.schoolId),
    errors
  );

  const recentAssistantMessages = unwrapRows<RecentAiMessage>(
    "ai_messages_recent",
    recentAiMessagesResponse,
    errors,
    (row) => ({
      content: stringValue(row.content),
      conversationId: stringValue(row.conversation_id),
      createdAt: stringValue(row.created_at),
      fallbackUsed: Boolean(getJsonObject(row.metadata)?.fallbackUsed),
      inputTokens: nullableNumberValue(row.input_tokens),
      latencyMs: nullableNumberValue(row.latency_ms),
      messageKind: stringValue(row.message_kind),
      model: nullableStringValue(row.model),
      outputTokens: nullableNumberValue(row.output_tokens),
      provider: nullableStringValue(row.provider),
      questionId: nullableStringValue(row.question_id),
      userId: stringValue(row.user_id),
    })
  );

  const recentAppErrorLogs = unwrapRows<RecentAppErrorLog>(
    "app_error_logs_recent",
    recentAppErrorLogsResponse,
    errors,
    (row) => ({
      area: stringValue(row.area),
      authMode: nullableStringValue(row.auth_mode),
      createdAt: stringValue(row.created_at),
      errorCode: nullableStringValue(row.error_code),
      errorName: nullableStringValue(row.error_name),
      eventName: stringValue(row.event_name),
      message: stringValue(row.message),
      platform: nullableStringValue(row.platform),
      severity: stringValue(row.severity),
      source: stringValue(row.source),
      userId: nullableStringValue(row.user_id),
    })
  );

  return {
    configuration,
    errors,
    metrics: [
      createMetric(
        "Users",
        formatCount(totalProfiles.value),
        "Profiles already created in Supabase."
      ),
      createMetric(
        "Onboarding complete",
        formatCount(onboardingCompleted.value),
        "Users who finished the onboarding flow."
      ),
      createMetric(
        "Study plans",
        formatCount(totalStudyPlans.value),
        `${formatCount(activeStudyPlans.value)} currently active.`
      ),
      createMetric(
        "Attempts (7d)",
        formatCount(recentAttempts.value),
        "Question answers logged over the last seven days."
      ),
      createMetric(
        "Schools",
        formatCount(totalSchools.value),
        `${formatCount(activeSchoolCodes.value)} active codes live right now.`
      ),
      createMetric(
        "Active entitlements",
        formatCount(activeEntitlements.value),
        "Paid or school-granted access windows currently active."
      ),
      createMetric(
        "AI assistant messages (7d)",
        formatCount(assistantMessagesLast7Days.value),
        "Visible assistant responses stored in ai_messages."
      ),
      createMetric(
        "App errors (7d)",
        formatCount(appErrorsLast7Days.value),
        "Client, admin, and edge-function issues persisted to app_error_logs."
      ),
    ],
    recentAppErrorLogs,
    recentAssistantMessages,
    recentProfiles,
    recentSchoolEntitlements: recentEntitlements.map((row) => ({
      ...row,
      schoolName: row.schoolId ? schoolNameById.get(row.schoolId) ?? null : null,
    })),
  };
}

export async function getAdminSchoolCodeData() {
  const errors: DashboardError[] = [];
  const configuration = getAdminConfigurationStatus();

  if (!configuration.databaseConfigured) {
    return {
      codeRows: [] as SchoolCodeRow[],
      configuration,
      errors,
      memberships: [] as SchoolMembershipRow[],
      metrics: [
        createMetric(
          "Admin database",
          "Unavailable",
          "Set service-role env to manage schools and codes from web."
        ),
      ],
      schools: [] as SchoolRow[],
      schoolSummaries: [] as SchoolSummaryRow[],
    };
  }

  const client = getWebSupabaseAdminClient();

  const [schoolsResponse, schoolCodesResponse, membershipsResponse] = await Promise.all([
    client
      .from("schools")
      .select(
        "id, slug, display_name, city, supported_locales, is_active, created_at"
      )
      .order("created_at", { ascending: false }),
    client
      .from("school_codes")
      .select(
        "id, school_id, code, status, max_redemptions, redeemed_count, grants_days, granted_features, valid_from, valid_until, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("school_memberships")
      .select(
        "school_id, user_id, role, status, started_at, ends_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const schools = unwrapRows<SchoolRow>(
    "schools",
    schoolsResponse,
    errors,
    (row) => ({
      city: nullableStringValue(row.city),
      createdAt: stringValue(row.created_at),
      displayName: stringValue(row.display_name),
      id: stringValue(row.id),
      isActive: Boolean(row.is_active),
      slug: stringValue(row.slug),
      supportedLocales: stringArrayValue(row.supported_locales),
    })
  );
  const schoolNameById = new Map(schools.map((row) => [row.id, row.displayName]));
  const codeRows = unwrapRows<SchoolCodeRow>(
    "school_codes",
    schoolCodesResponse,
    errors,
    (row) => ({
      code: stringValue(row.code),
      createdAt: stringValue(row.created_at),
      grantedFeatures: stringArrayValue(row.granted_features),
      grantsDays: numberValue(row.grants_days),
      id: stringValue(row.id),
      maxRedemptions: nullableNumberValue(row.max_redemptions),
      redeemedCount: numberValue(row.redeemed_count),
      schoolId: stringValue(row.school_id),
      schoolName: schoolNameById.get(stringValue(row.school_id)) ?? null,
      status: stringValue(row.status),
      validFrom: nullableStringValue(row.valid_from),
      validUntil: nullableStringValue(row.valid_until),
    })
  );
  const memberships = unwrapRows<SchoolMembershipRow>(
    "school_memberships",
    membershipsResponse,
    errors,
    (row) => ({
      createdAt: stringValue(row.created_at),
      endsAt: nullableStringValue(row.ends_at),
      role: stringValue(row.role),
      schoolId: stringValue(row.school_id),
      schoolName: schoolNameById.get(stringValue(row.school_id)) ?? null,
      startedAt: stringValue(row.started_at),
      status: stringValue(row.status),
      userId: stringValue(row.user_id),
    })
  );

  const schoolSummaries = schools.map((school) => {
    const matchingCodes = codeRows.filter((row) => row.schoolId === school.id);
    const matchingMemberships = memberships.filter((row) => row.schoolId === school.id);

    return {
      activeCodes: matchingCodes.filter((row) => row.status === "active").length,
      activeMembers: matchingMemberships.filter((row) => row.status === "active").length,
      city: school.city,
      displayName: school.displayName,
      id: school.id,
      isActive: school.isActive,
      redeemedSeats: matchingCodes.reduce(
        (total, row) => total + row.redeemedCount,
        0
      ),
      slug: school.slug,
      supportedLocales: school.supportedLocales,
      totalCodes: matchingCodes.length,
    };
  });

  return {
    codeRows,
    configuration,
    errors,
    memberships,
    metrics: [
      createMetric(
        "Schools",
        formatCount(schools.length),
        `${formatCount(
          schoolSummaries.filter((row) => row.isActive).length
        )} marked active.`
      ),
      createMetric(
        "Codes",
        formatCount(codeRows.length),
        `${formatCount(
          codeRows.filter((row) => row.status === "active").length
        )} active / ${formatCount(
          codeRows.reduce((total, row) => total + row.redeemedCount, 0)
        )} redeemed seats.`
      ),
      createMetric(
        "Memberships",
        formatCount(memberships.length),
        `${formatCount(
          memberships.filter((row) => row.status === "active").length
        )} active students right now.`
      ),
    ],
    schools,
    schoolSummaries,
  };
}

export async function getAdminImportHealthData() {
  const errors: DashboardError[] = [];
  const configuration = getAdminConfigurationStatus();
  const [summaryReport, syncReport, buildReport, uploadReport, validationReport] =
    await Promise.all([
      readOptionalJsonReport(REPORT_FILES.normalizedSummary, normalizedSummarySchema),
      readOptionalJsonReport(REPORT_FILES.syncReport, syncReportSchema),
      readOptionalJsonReport(REPORT_FILES.buildReport, buildReportSchema),
      readOptionalJsonReport(REPORT_FILES.uploadReport, uploadReportSchema),
      readOptionalJsonReport(REPORT_FILES.validationReport, validationReportSchema),
    ]);

  if (summaryReport.error) {
    errors.push({
      area: "normalized_summary",
      message: summaryReport.error,
    });
  }
  if (syncReport.error) {
    errors.push({
      area: "sync_report",
      message: syncReport.error,
    });
  }
  if (buildReport.error) {
    errors.push({
      area: "build_report",
      message: buildReport.error,
    });
  }
  if (uploadReport.error) {
    errors.push({
      area: "upload_report",
      message: uploadReport.error,
    });
  }
  if (validationReport.error) {
    errors.push({
      area: "validation_report",
      message: validationReport.error,
    });
  }

  const databaseComparison = await getImportDatabaseComparison(errors);
  const validationWarnings = (validationReport.data ?? []).slice(0, 12).map((row) => ({
    code: row.code,
    message: row.message,
    questionSourceId: row.questionSourceId ?? null,
    severity: row.severity,
    sourceRowNumber: row.sourceRowNumber ?? null,
  }));

  const checkpoints: ImportCheckpoint[] = [
    {
      metrics: [
        createMetric(
          "Questions",
          formatCount(summaryReport.data?.categoryBQuestions ?? null),
          `Warnings: ${formatCount(summaryReport.data?.issues.warnings ?? null)}`
        ),
        createMetric(
          "Media jobs",
          formatCount(summaryReport.data?.totalMediaBuildJobs ?? null),
          `References: ${formatCount(summaryReport.data?.totalMediaReferences ?? null)}`
        ),
      ],
      path: summaryReport.path,
      status:
        (summaryReport.data?.issues.errors ?? 0) > 0
          ? "error"
          : (summaryReport.data?.issues.warnings ?? 0) > 0
            ? "warning"
            : "ok",
      title: "Normalized summary",
      updatedAt: summaryReport.updatedAt,
    },
    {
      metrics: [
        createMetric(
          "Synced rows",
          formatCount(syncReport.data?.syncedRows ?? null),
          `Failed rows: ${formatCount(syncReport.data?.failedRows ?? null)}`
        ),
        createMetric(
          "Batches",
          formatCount(syncReport.data?.batchCount ?? null),
          `Batch size: ${formatCount(syncReport.data?.batchSize ?? null)}`
        ),
      ],
      path: syncReport.path,
      status: (syncReport.data?.failedRows ?? 0) > 0 ? "error" : "ok",
      title: "Supabase question sync",
      updatedAt: syncReport.updatedAt,
    },
    {
      metrics: [
        createMetric(
          "Processed jobs",
          formatCount(buildReport.data?.processedJobs ?? null),
          `Failed jobs: ${formatCount(buildReport.data?.failedJobs ?? null)}`
        ),
        createMetric(
          "Posters",
          formatCount(buildReport.data?.createdPosters ?? null),
          `Skipped: ${formatCount(buildReport.data?.skippedJobs ?? null)}`
        ),
      ],
      path: buildReport.path,
      status: (buildReport.data?.failedJobs ?? 0) > 0 ? "error" : "ok",
      title: "Delivery build",
      updatedAt: buildReport.updatedAt,
    },
    {
      metrics: [
        createMetric(
          "Uploaded objects",
          formatCount(uploadReport.data?.uploadedObjects ?? null),
          `Failed uploads: ${formatCount(uploadReport.data?.failedObjects ?? null)}`
        ),
        createMetric(
          "Upload mode",
          uploadReport.data?.dryRun ? "Dry run" : "Live",
          "Reads the latest upload report from disk."
        ),
      ],
      path: uploadReport.path,
      status: (uploadReport.data?.failedObjects ?? 0) > 0 ? "error" : "ok",
      title: "Storage upload",
      updatedAt: uploadReport.updatedAt,
    },
  ];

  return {
    checkpoints,
    configuration,
    databaseComparison,
    errors,
    metrics: [
      createMetric(
        "Category B export",
        formatCount(summaryReport.data?.categoryBQuestions ?? null),
        `Remote active rows: ${formatCount(databaseComparison.remoteActiveQuestions)}`
      ),
      createMetric(
        "Warnings",
        formatCount(summaryReport.data?.issues.warnings ?? null),
        `Validation entries sampled below: ${formatCount(validationWarnings.length)}`
      ),
      createMetric(
        "Uploaded media",
        formatCount(uploadReport.data?.uploadedObjects ?? null),
        `Questions with media in DB: ${formatCount(databaseComparison.questionsWithMedia)}`
      ),
    ],
    validationWarnings,
  };
}

export async function getAdminAiReviewData() {
  const errors: DashboardError[] = [];
  const configuration = getAdminConfigurationStatus();

  if (!configuration.databaseConfigured) {
    return {
      configuration,
      errors,
      fallbackMessages: [] as RecentAiMessage[],
      metrics: [
        createMetric(
          "Admin database",
          "Unavailable",
          "Set service-role env to inspect ai_messages from web."
        ),
      ],
      providerMetrics: [] as DashboardMetric[],
      recentAssistantMessages: [] as RecentAiMessage[],
    };
  }

  const client = getWebSupabaseAdminClient();
  const last7DaysIso = daysAgoIso(7);

  const [totalAiMessages, assistantLast7Days, recentAssistantMessagesResponse] =
    await Promise.all([
      readCount(
        "ai_messages_total",
        client.from("ai_messages").select("*", { count: "exact", head: true })
      ),
      readCount(
        "ai_messages_assistant_last_7_days",
        client
          .from("ai_messages")
          .select("*", { count: "exact", head: true })
          .eq("message_role", "assistant")
          .gte("created_at", last7DaysIso)
      ),
      client
        .from("ai_messages")
        .select(
          "user_id, question_id, conversation_id, message_kind, provider, model, content, input_tokens, output_tokens, latency_ms, metadata, created_at"
        )
        .eq("message_role", "assistant")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

  captureError(errors, totalAiMessages);
  captureError(errors, assistantLast7Days);

  const recentAssistantMessages = unwrapRows<RecentAiMessage>(
    "ai_messages_review_recent",
    recentAssistantMessagesResponse,
    errors,
    (row) => ({
      content: stringValue(row.content),
      conversationId: stringValue(row.conversation_id),
      createdAt: stringValue(row.created_at),
      fallbackUsed: Boolean(getJsonObject(row.metadata)?.fallbackUsed),
      inputTokens: nullableNumberValue(row.input_tokens),
      latencyMs: nullableNumberValue(row.latency_ms),
      messageKind: stringValue(row.message_kind),
      model: nullableStringValue(row.model),
      outputTokens: nullableNumberValue(row.output_tokens),
      provider: nullableStringValue(row.provider),
      questionId: nullableStringValue(row.question_id),
      userId: stringValue(row.user_id),
    })
  );

  const fallbackMessages = recentAssistantMessages.filter((row) => row.fallbackUsed);
  const averageLatency = average(
    recentAssistantMessages
      .map((row) => row.latencyMs)
      .filter((value): value is number => value !== null)
  );
  const providerBreakdown = buildProviderBreakdown(recentAssistantMessages);

  return {
    configuration,
    errors,
    fallbackMessages,
    metrics: [
      createMetric(
        "All AI messages",
        formatCount(totalAiMessages.value),
        "Visible and internal ai_messages stored in Supabase."
      ),
      createMetric(
        "Assistant messages (7d)",
        formatCount(assistantLast7Days.value),
        "Recent assistant-side output volume."
      ),
      createMetric(
        "Fallbacks in sample",
        formatCount(fallbackMessages.length),
        "Recent assistant messages marked with fallbackUsed=true."
      ),
      createMetric(
        "Average latency",
        averageLatency === null ? "Unavailable" : `${averageLatency} ms`,
        "Calculated from the most recent assistant sample."
      ),
    ],
    providerMetrics: providerBreakdown,
    recentAssistantMessages,
  };
}

export function formatAdminDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatAdminList(values: string[]) {
  return values.length ? values.join(", ") : "—";
}

export function truncateAdminText(value: string, maxLength = 140) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function getAdminConfigurationStatus() {
  const env = getWebServerEnv();
  const authReadiness = getAdminAuthReadiness();

  return {
    authConfigured: authReadiness.isConfigured,
    authMissing: authReadiness.missing,
    databaseConfigured: Boolean(
      env.NEXT_PUBLIC_SUPABASE_URL.trim() && env.SUPABASE_SERVICE_ROLE_KEY.trim()
    ),
  };
}

async function getImportDatabaseComparison(errors: DashboardError[]) {
  const configuration = getAdminConfigurationStatus();

  if (!configuration.databaseConfigured) {
    return {
      categoryBQuestions: null,
      questionsWithMedia: null,
      remoteActiveQuestions: null,
    };
  }

  const client = getWebSupabaseAdminClient();
  const [remoteActiveQuestions, categoryBQuestions, questionsWithMedia] =
    await Promise.all([
      readCount(
        "questions_active_total",
        client.from("questions").select("*", { count: "exact", head: true }).eq("is_active", true)
      ),
      readCount(
        "questions_active_category_b",
        client
          .from("questions")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .contains("categories", ["B"])
      ),
      readCount(
        "questions_with_media",
        client
          .from("questions")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("has_media", true)
      ),
    ]);

  captureError(errors, remoteActiveQuestions);
  captureError(errors, categoryBQuestions);
  captureError(errors, questionsWithMedia);

  return {
    categoryBQuestions: categoryBQuestions.value,
    questionsWithMedia: questionsWithMedia.value,
    remoteActiveQuestions: remoteActiveQuestions.value,
  };
}

async function getSchoolNamesById(
  schoolIds: Array<string | null>,
  errors: DashboardError[]
) {
  const filteredIds = Array.from(
    new Set(schoolIds.filter((value): value is string => Boolean(value)))
  );

  if (!filteredIds.length || !getAdminConfigurationStatus().databaseConfigured) {
    return new Map<string, string>();
  }

  const { data, error } = await getWebSupabaseAdminClient()
    .from("schools")
    .select("id, display_name")
    .in("id", filteredIds);

  if (error) {
    errors.push({
      area: "schools_lookup",
      message: error.message,
    });
    return new Map<string, string>();
  }

  return new Map(
    (data ?? []).map((row) => [
      stringValue((row as Record<string, unknown>).id),
      stringValue((row as Record<string, unknown>).display_name),
    ])
  );
}

async function readOptionalJsonReport<T>(
  file: {
    absolutePath: string;
    path: string;
  },
  schema: z.ZodType<T>
) {
  try {
    const [raw, stats] = await Promise.all([
      fs.readFile(file.absolutePath, "utf8"),
      fs.stat(file.absolutePath),
    ]);

    return {
      data: schema.parse(JSON.parse(raw)),
      error: null,
      path: file.path,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown report error.",
      path: file.path,
      updatedAt: null,
    };
  }
}

async function readCount(
  area: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
) {
  try {
    const { count, error } = await query;
    return {
      area,
      error: error?.message ?? null,
      value: error ? null : (count ?? 0),
    };
  } catch (error) {
    return {
      area,
      error: error instanceof Error ? error.message : "Unknown count error.",
      value: null,
    };
  }
}

function captureError(
  errors: DashboardError[],
  result: { area: string; error: string | null }
) {
  if (!result.error) {
    return;
  }

  errors.push({
    area: result.area,
    message: result.error,
  });
}

function unwrapRows<T>(
  area: string,
  response: {
    data: unknown[] | null;
    error: { message: string } | null;
  },
  errors: DashboardError[],
  mapRow: (row: Record<string, unknown>) => T
) {
  if (response.error) {
    errors.push({
      area,
      message: response.error.message,
    });
    return [] as T[];
  }

  return (response.data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

function buildProviderBreakdown(messages: RecentAiMessage[]) {
  const counts = new Map<string, number>();

  for (const message of messages) {
    const key = message.provider ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([provider, count]) =>
      createMetric(provider, formatCount(count), "Assistant messages in recent sample.")
    );
}

function createMetric(label: string, value: string, detail: string): DashboardMetric {
  return {
    detail,
    label,
    value,
  };
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-GB").format(value);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

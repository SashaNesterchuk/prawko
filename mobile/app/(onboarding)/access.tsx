import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import {
  isMobileSupabaseConfigured,
  isMockAuthEnabled,
} from "../../src/config/env";
import {
  fetchRemoteEntitlementSnapshot,
  getSchoolCodeRedeemErrorMessage,
  normalizeSchoolCode,
  redeemSchoolCode,
} from "../../src/features/entitlements/supabase-entitlements";
import {
  getEmailPasswordAuthErrorMessage,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "../../src/features/auth/email-password-auth";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import { useEntitlementStore } from "../../src/state/entitlements";
import { useCurrentUser, useAppShellStore } from "../../src/state/app-shell";

type AccessAuthMode = "sign_in" | "sign_up";
type AuthFeedbackState = {
  kind: "error" | "success";
  message: string;
} | null;

const PASSWORD_MIN_LENGTH = 6;

export default function AccessScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { captureError } = useErrorLogger();
  const styles = useStyles();
  const currentUser = useCurrentUser();
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const signInMock = useAppShellStore((state) => state.signInMock);
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const hydrateRemoteEntitlements = useEntitlementStore(
    (state) => state.hydrateRemoteEntitlements
  );
  const setEntitlementStatus = useEntitlementStore(
    (state) => state.setEntitlementStatus
  );
  const [authMode, setAuthMode] = useState<AccessAuthMode>("sign_in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authFeedback, setAuthFeedback] = useState<AuthFeedbackState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser) {
    return (
      <Redirect
        href={onboardingCompleted ? "/(tabs)" : "/(onboarding)/preview"}
      />
    );
  }

  const isSignUp = authMode === "sign_up";
  const isSubmitDisabled =
    isSubmitting ||
    !isMobileSupabaseConfigured ||
    !email.trim() ||
    !password ||
    (isSignUp && !fullName.trim());

  const continueWithMock = () => {
    if (!isMockAuthEnabled) {
      return;
    }

    setAuthFeedback(null);
    signInMock();
  };

  const switchAuthMode = (nextMode: AccessAuthMode) => {
    if (nextMode === authMode || isSubmitting) {
      return;
    }

    setAuthMode(nextMode);
    setAuthFeedback(null);
  };

  const handleFullNameChange = (value: string) => {
    setFullName(value);
    setAuthFeedback(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setAuthFeedback(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setAuthFeedback(null);
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();

    if (!isMobileSupabaseConfigured) {
      setAuthFeedback({
        kind: "error",
        message: t("onboarding.auth.envMissing"),
      });
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setAuthFeedback({
        kind: "error",
        message: t("onboarding.auth.invalidEmail"),
      });
      return;
    }

    if (!password) {
      setAuthFeedback({
        kind: "error",
        message: t("onboarding.auth.missingFields"),
      });
      return;
    }

    if (isSignUp && !normalizedFullName) {
      setAuthFeedback({
        kind: "error",
        message: t("onboarding.auth.fullNameRequired"),
      });
      return;
    }

    if (isSignUp && password.length < PASSWORD_MIN_LENGTH) {
      setAuthFeedback({
        kind: "error",
        message: t("onboarding.auth.passwordTooShort", {
          min: PASSWORD_MIN_LENGTH,
        }),
      });
      return;
    }

    setIsSubmitting(true);
    setAuthFeedback(null);

    try {
      if (isSignUp) {
        const result = await signUpWithEmailPassword({
          email: normalizedEmail,
          password,
          fullName: normalizedFullName,
        });

        if (result.needsEmailConfirmation) {
          setAuthMode("sign_in");
          setPassword("");
          setAuthFeedback({
            kind: "success",
            message: t("onboarding.auth.confirmationPending", {
              email: normalizedEmail,
            }),
          });
        } else {
          await redeemPendingSchoolCode();
        }
      } else {
        await signInWithEmailPassword({
          email: normalizedEmail,
          password,
        });

        await redeemPendingSchoolCode();
      }
    } catch (error) {
      const message = getEmailPasswordAuthErrorMessage(error);

      captureError({
        area: "auth",
        error,
        eventName: "auth_submit_failed",
        message: isSignUp
          ? "Email/password sign-up failed."
          : "Email/password sign-in failed.",
        metadata: {
          auth_action: isSignUp ? "sign_up" : "sign_in",
        },
      });
      setAuthFeedback({
        kind: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const redeemPendingSchoolCode = async () => {
    const pendingSchoolCode = normalizeSchoolCode(studyPlanSetup.schoolCode);

    if (!pendingSchoolCode || !isMobileSupabaseConfigured) {
      return;
    }

    setEntitlementStatus("loading");
    track("school_code_redeem_started", {
      auth_mode: "supabase",
      code_length: pendingSchoolCode.length,
      source: "access_auto_redeem",
    });

    try {
      const redemption = await redeemSchoolCode(pendingSchoolCode);
      const snapshot = await fetchRemoteEntitlementSnapshot();

      hydrateRemoteEntitlements(snapshot);
      track("school_code_redeemed", {
        granted_features_count: redemption.grantedFeatures.length,
        source: "access_auto_redeem",
        was_already_member: redemption.wasAlreadyMember,
      });
    } catch (error) {
      const message = getSchoolCodeRedeemErrorMessage(error);

      captureError({
        area: "school_access",
        error,
        eventName: "school_code_auto_redeem_failed",
        message: "Failed to auto-redeem the pending school code after auth.",
        metadata: {
          code_length: pendingSchoolCode.length,
          source: "access_auto_redeem",
        },
      });
      setEntitlementStatus("ready");
      track("school_code_redeem_failed", {
        auth_mode: "supabase",
        message,
        source: "access_auto_redeem",
      });
    }
  };

  return (
    <AppScreen
      title={t("onboarding.accessTitle")}
      subtitle={t(
        isMockAuthEnabled
          ? "onboarding.accessSubtitle"
          : "onboarding.accessSubtitleNoMock"
      )}
      footer={
        <View style={styles.footerStack}>
          <AppButton
            variant="ghost"
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={styles.cardStack}>
        <AppCard accent={isMobileSupabaseConfigured}>
          <CText style={styles.eyebrow}>{t("profile.environment")}</CText>
          <CText style={styles.cardTitle}>{t("profile.supabaseStatus")}</CText>
          <CText style={styles.cardBody}>
            {isMobileSupabaseConfigured
              ? t("common.configured")
              : t("common.missing")}
          </CText>
          <CText style={styles.helperText}>
            {isMobileSupabaseConfigured
              ? t("onboarding.auth.envReady")
              : t("onboarding.auth.envMissing")}
          </CText>
        </AppCard>

        <AppCard accent={isMobileSupabaseConfigured}>
          <CText style={styles.eyebrow}>{t("onboarding.auth.eyebrow")}</CText>
          <CText style={styles.cardTitle}>{t("onboarding.auth.title")}</CText>
          <CText style={styles.cardBody}>{t("onboarding.auth.subtitle")}</CText>
          {studyPlanSetup.schoolCode ? (
            <CText style={styles.helperText}>
              {t("onboarding.previewSchoolCode", {
                code: studyPlanSetup.schoolCode,
              })}
            </CText>
          ) : null}

          <View style={styles.modeRow}>
            <ModeChip
              active={authMode === "sign_in"}
              label={t("onboarding.auth.modes.signIn")}
              onPress={() => switchAuthMode("sign_in")}
            />
            <ModeChip
              active={authMode === "sign_up"}
              label={t("onboarding.auth.modes.signUp")}
              onPress={() => switchAuthMode("sign_up")}
            />
          </View>

          <View style={styles.formStack}>
            {isSignUp ? (
              <AppTextInput
                autoCapitalize="words"
                autoComplete="name"
                editable={!isSubmitting}
                label={t("onboarding.auth.fullNameLabel")}
                onChangeText={handleFullNameChange}
                placeholder={t("onboarding.auth.fullNamePlaceholder")}
                textContentType="name"
                value={fullName}
              />
            ) : null}

            <AppTextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              keyboardType="email-address"
              label={t("onboarding.auth.emailLabel")}
              onChangeText={handleEmailChange}
              placeholder={t("onboarding.auth.emailPlaceholder")}
              textContentType="emailAddress"
              value={email}
            />

            <AppTextInput
              autoCapitalize="none"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              editable={!isSubmitting}
              label={t("onboarding.auth.passwordLabel")}
              onChangeText={handlePasswordChange}
              placeholder={t("onboarding.auth.passwordPlaceholder")}
              secureTextEntry
              textContentType={isSignUp ? "newPassword" : "password"}
              value={password}
            />
          </View>

          <CText style={styles.helperText}>
            {isSignUp
              ? t("onboarding.auth.signUpHint")
              : t("onboarding.auth.signInHint")}
          </CText>

          {authFeedback ? (
            <View
              style={[
                styles.statusCard,
                authFeedback.kind === "error"
                  ? styles.statusError
                  : styles.statusSuccess,
              ]}
            >
              <CText
                style={[
                  styles.statusText,
                  authFeedback.kind === "error"
                    ? styles.statusErrorText
                    : styles.statusSuccessText,
                ]}
              >
                {authFeedback.message}
              </CText>
            </View>
          ) : null}

          <View style={styles.actionStack}>
            <AppButton
              disabled={isSubmitDisabled}
              label={t(
                isSubmitting
                  ? isSignUp
                    ? "onboarding.auth.ctaSignUpLoading"
                    : "onboarding.auth.ctaSignInLoading"
                  : isSignUp
                    ? "onboarding.auth.ctaSignUp"
                    : "onboarding.auth.ctaSignIn"
              )}
              onPress={() => void handleSubmit()}
            />
            <AppButton
              disabled={isSubmitting}
              label={t(
                isSignUp
                  ? "onboarding.auth.switchToSignIn"
                  : "onboarding.auth.switchToSignUp"
              )}
              onPress={() =>
                switchAuthMode(isSignUp ? "sign_in" : "sign_up")
              }
              variant="ghost"
            />
          </View>
        </AppCard>

        {isMockAuthEnabled ? (
          <AppCard>
            <CText style={styles.cardTitle}>{t("onboarding.mockAccessTitle")}</CText>
            <CText style={styles.cardBody}>
              {t("onboarding.mockAccessSubtitle")}
            </CText>
            <View style={styles.mockAction}>
              <AppButton
                disabled={isSubmitting}
                label={t("onboarding.continueWithMock")}
                onPress={continueWithMock}
                variant="secondary"
              />
            </View>
          </AppCard>
        ) : null}

        <AppCard accent>
          <CText style={styles.eyebrow}>{t("onboarding.planSummaryLabel")}</CText>
          <CText style={styles.planLine}>
            {t("onboarding.planSummaryDays", {
              days: studyPlanSetup.daysUntilExam ?? 0,
            })}
          </CText>
          <CText style={styles.planLine}>
            {t("onboarding.planSummaryMinutes", {
              minutes: studyPlanSetup.minutesPerDay ?? 0,
            })}
          </CText>
          <CText style={styles.planLine}>
            {t("onboarding.planSummaryLevel", {
              level: studyPlanSetup.level
                ? t(`levels.${studyPlanSetup.level}.label`)
                : t("common.missing"),
            })}
          </CText>
        </AppCard>
      </View>
    </AppScreen>
  );
}

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.modeChip,
        active ? styles.modeChipActive : null,
      ]}
    >
      <CText
        style={[
          styles.modeChipLabel,
          active ? styles.modeChipLabelActive : null,
        ]}
      >
        {label}
      </CText>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    cardStack: {
      gap: spacing.exact(12),
    },
    actionStack: {
      gap: spacing.exact(10),
      marginTop: spacing.exact(16),
    },
    cardBody: {
      color: colors.textSecondary,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: responsiveFont(18),
      fontFamily: getFontFamily("bold"),
      marginBottom: spacing.exact(4),
    },
    eyebrow: {
      color: colors.textSecondary,
      fontSize: responsiveFont(13),
      fontFamily: getFontFamily("bold"),
      marginBottom: spacing.exact(6),
      textTransform: "uppercase",
    },
    formStack: {
      gap: spacing.exact(12),
      marginTop: spacing.exact(16),
    },
    helperText: {
      color: colors.textMuted,
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      marginTop: spacing.exact(12),
    },
    mockAction: {
      marginTop: spacing.exact(14),
    },
    modeChip: {
      backgroundColor: colors.cardMuted,
      borderColor: colors.borderSoft,
      borderRadius: radius.pill,
      borderWidth: 1,
      flex: 1,
      minHeight: spacing.exact(44),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.exact(14),
    },
    modeChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modeChipLabel: {
      color: colors.textPrimary,
      fontSize: responsiveFont(14),
      fontFamily: getFontFamily("bold"),
    },
    modeChipLabelActive: {
      color: colors.onAccent,
    },
    modeRow: {
      flexDirection: "row",
      gap: spacing.exact(10),
      marginTop: spacing.exact(16),
    },
    planLine: {
      color: colors.textPrimary,
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(24),
    },
    statusCard: {
      borderRadius: radius.large,
      borderWidth: 1,
      marginTop: spacing.exact(16),
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(12),
    },
    statusError: {
      backgroundColor: colors.statusErrorSurface,
      borderColor: colors.statusErrorBorder,
    },
    statusErrorText: {
      color: colors.statusErrorBorder,
    },
    statusSuccess: {
      backgroundColor: colors.statusSuccessSurface,
      borderColor: colors.statusSuccessBorder,
    },
    statusSuccessText: {
      color: colors.statusSuccessBorder,
    },
    statusText: {
      fontSize: responsiveFont(14),
      fontFamily: getFontFamily("semiBold"),
      lineHeight: responsiveFont(22),
    },
  }));
}

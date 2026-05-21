import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { isMobileSupabaseConfigured } from "../../src/config/env";
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
import { useTheme } from "../../src/providers/ThemeProvider";
import { useEntitlementStore } from "../../src/state/entitlements";
import { useCurrentUser, useAppShellStore } from "../../src/state/app-shell";

type AccessAuthMode = "sign_in" | "sign_up";
type AuthFeedbackState = {
  kind: "error" | "success";
  message: string;
} | null;

const PASSWORD_MIN_LENGTH = 6;
const STATUS_COLORS = {
  errorBorder: "#C2826B",
  errorSurface: "#F7E7DF",
  successBorder: "#5D8A80",
  successSurface: "#E6F2EC",
};

export default function AccessScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);
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
    setAuthFeedback(null);
    signInMock();
    Toast.show({
      type: "success",
      text1: t("toasts.mockSessionStartedTitle"),
      text2: t("toasts.mockSessionStartedSubtitle"),
    });
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
          Toast.show({
            type: "success",
            text1: t("toasts.authConfirmationTitle"),
            text2: t("toasts.authConfirmationSubtitle", {
              email: normalizedEmail,
            }),
          });
        } else {
          Toast.show({
            type: "success",
            text1: t("toasts.authSignedUpTitle"),
            text2: t("toasts.authSignedUpSubtitle"),
          });
          await redeemPendingSchoolCode();
        }
      } else {
        await signInWithEmailPassword({
          email: normalizedEmail,
          password,
        });

        Toast.show({
          type: "success",
          text1: t("toasts.authSignedInTitle"),
          text2: t("toasts.authSignedInSubtitle"),
        });
        await redeemPendingSchoolCode();
      }
    } catch (error) {
      const message = getEmailPasswordAuthErrorMessage(error);

      setAuthFeedback({
        kind: "error",
        message,
      });
      Toast.show({
        type: "error",
        text1: t("toasts.authFailedTitle"),
        text2: message,
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

    try {
      const redemption = await redeemSchoolCode(pendingSchoolCode);
      const snapshot = await fetchRemoteEntitlementSnapshot();

      hydrateRemoteEntitlements(snapshot);
      Toast.show({
        type: "success",
        text1: t("toasts.schoolCodeRedeemedTitle"),
        text2: t(
          redemption.wasAlreadyMember
            ? "toasts.schoolCodeAlreadyActiveSubtitle"
            : "toasts.schoolCodeRedeemedSubtitle",
          {
            school: redemption.schoolName,
          }
        ),
      });
    } catch (error) {
      const message = getSchoolCodeRedeemErrorMessage(error);

      setEntitlementStatus("ready");
      Toast.show({
        type: "error",
        text1: t("toasts.schoolCodeRedeemFailedTitle"),
        text2: message,
      });
    }
  };

  return (
    <AppScreen
      title={t("onboarding.accessTitle")}
      subtitle={t("onboarding.accessSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            variant="ghost"
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <AppCard accent={isMobileSupabaseConfigured}>
          <Text style={styles.eyebrow}>{t("profile.environment")}</Text>
          <Text style={styles.cardTitle}>{t("profile.supabaseStatus")}</Text>
          <Text style={styles.cardBody}>
            {isMobileSupabaseConfigured
              ? t("common.configured")
              : t("common.missing")}
          </Text>
          <Text style={styles.helperText}>
            {isMobileSupabaseConfigured
              ? t("onboarding.auth.envReady")
              : t("onboarding.auth.envMissing")}
          </Text>
        </AppCard>

        <AppCard accent={isMobileSupabaseConfigured}>
          <Text style={styles.eyebrow}>{t("onboarding.auth.eyebrow")}</Text>
          <Text style={styles.cardTitle}>{t("onboarding.auth.title")}</Text>
          <Text style={styles.cardBody}>{t("onboarding.auth.subtitle")}</Text>
          {studyPlanSetup.schoolCode ? (
            <Text style={styles.helperText}>
              {t("onboarding.previewSchoolCode", {
                code: studyPlanSetup.schoolCode,
              })}
            </Text>
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

          <Text style={styles.helperText}>
            {isSignUp
              ? t("onboarding.auth.signUpHint")
              : t("onboarding.auth.signInHint")}
          </Text>

          {authFeedback ? (
            <View
              style={[
                styles.statusCard,
                authFeedback.kind === "error"
                  ? styles.statusError
                  : styles.statusSuccess,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  authFeedback.kind === "error"
                    ? styles.statusErrorText
                    : styles.statusSuccessText,
                ]}
              >
                {authFeedback.message}
              </Text>
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

        <AppCard>
          <Text style={styles.cardTitle}>{t("onboarding.mockAccessTitle")}</Text>
          <Text style={styles.cardBody}>{t("onboarding.mockAccessSubtitle")}</Text>
          <View style={styles.mockAction}>
            <AppButton
              disabled={isSubmitting}
              label={t("onboarding.continueWithMock")}
              onPress={continueWithMock}
              variant="secondary"
            />
          </View>
        </AppCard>

        <AppCard accent>
          <Text style={styles.eyebrow}>{t("onboarding.planSummaryLabel")}</Text>
          <Text style={styles.planLine}>
            {t("onboarding.planSummaryDays", {
              days: studyPlanSetup.daysUntilExam ?? 0,
            })}
          </Text>
          <Text style={styles.planLine}>
            {t("onboarding.planSummaryMinutes", {
              minutes: studyPlanSetup.minutesPerDay ?? 0,
            })}
          </Text>
          <Text style={styles.planLine}>
            {t("onboarding.planSummaryLevel", {
              level: studyPlanSetup.level
                ? t(`levels.${studyPlanSetup.level}.label`)
                : t("common.missing"),
            })}
          </Text>
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
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.modeChip,
        active ? styles.modeChipActive : null,
      ]}
    >
      <Text
        style={[
          styles.modeChipLabel,
          active ? styles.modeChipLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    actionStack: {
      gap: 10,
      marginTop: 16,
    },
    cardBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    cardTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    eyebrow: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 6,
      textTransform: "uppercase",
    },
    formStack: {
      gap: 12,
      marginTop: 16,
    },
    helperText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },
    mockAction: {
      marginTop: 14,
    },
    modeChip: {
      backgroundColor: theme.colors.cardMuted,
      borderColor: theme.colors.borderSoft,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    modeChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    modeChipLabel: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    modeChipLabelActive: {
      color: theme.colors.onAccent,
    },
    modeRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    planLine: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      lineHeight: 24,
    },
    statusCard: {
      borderRadius: theme.radius.large,
      borderWidth: 1,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    statusError: {
      backgroundColor: STATUS_COLORS.errorSurface,
      borderColor: STATUS_COLORS.errorBorder,
    },
    statusErrorText: {
      color: STATUS_COLORS.errorBorder,
    },
    statusSuccess: {
      backgroundColor: STATUS_COLORS.successSurface,
      borderColor: STATUS_COLORS.successBorder,
    },
    statusSuccessText: {
      color: STATUS_COLORS.successBorder,
    },
    statusText: {
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 22,
    },
  });

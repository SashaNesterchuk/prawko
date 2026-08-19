import { Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "../icons";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { getRoadSignById } from "../../features/road-signs/catalog";
import {
  getSignDisplayName,
} from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";

type SignPlatePopupProps = {
  signId: string | null;
  visible: boolean;
  onClose: () => void;
};

export function SignPlatePopup({
  signId,
  visible,
  onClose,
}: SignPlatePopupProps) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const styles = useStyles();
  const sign = signId ? getRoadSignById(signId) : undefined;
  const displayName = sign
    ? getSignDisplayName(sign.id, i18n.language, sign.code)
    : "";

  if (!sign) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.card}
          testID="sign-plate-popup"
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <CText style={styles.code}>{sign.code}</CText>
            <View style={styles.imageWrap}>
              <SignImage sign={sign} size={80} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon color={theme.colors.ink2} name="close" size={24} />
            </Pressable>
          </View>

          <CText style={styles.name}>
            {`${sign.code}. ${displayName}`}
          </CText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.overlayBackdrop,
    },
    card: {
      width: "100%",
      borderRadius: radius.xxxl,
      padding: spacing.xl,
      backgroundColor: colors.paper,
      shadowColor: colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: spacing.exact(32),
      shadowOffset: { width: 0, height: spacing.exact(26) },
      elevation: 12,
      gap: spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    code: {
      flex: 1,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.ink2,
    },
    imageWrap: {
      width: spacing.exact(80),
      height: spacing.exact(80),
      alignItems: "center",
      justifyContent: "center",
    },
    closeButton: {
      flex: 1,
      alignItems: "flex-end",
    },
    name: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      textAlign: "center",
      color: colors.ink,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}

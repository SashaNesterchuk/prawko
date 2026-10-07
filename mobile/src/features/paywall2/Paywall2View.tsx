import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCountryConfig } from "../../countries/use-country";
import { pluralKey } from "../../i18n/plural";
import { CText, useResponsiveStyles } from "../../portable-ui";
import {
  Paywall2ExamPreview,
  Paywall2MistakesPreview,
  Paywall2PhoneMock,
  Paywall2TrapPreview,
} from "./Paywall2Mocks";
import { paywall2Palette as palette } from "./palette";
import type { Paywall2Plan, Paywall2PlanId } from "./plans";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type TFn = ReturnType<typeof useTranslation>["t"];

export type Paywall2Offer =
  | {
      kind: "lifetime";
      /** Localized store price; null until the store offering has loaded. */
      price: string | null;
    }
  | {
      kind: "plans";
      plans: Paywall2Plan[];
      /** One selection shared by the top selector, the final selector and the sticky bar. */
      selectedPlanId: Paywall2PlanId;
      onSelectPlan: (id: Paywall2PlanId, placement: "offer" | "final") => void;
    };

export type Paywall2ViewProps = {
  offer: Paywall2Offer;
  hasPlusAccess: boolean;
  purchaseBusy: boolean;
  restoreBusy: boolean;
  testID?: string;
  purchaseDisabled: boolean;
  feedback: string | null;
  onClose: () => void;
  onUnlock: () => void;
  onRestore: () => void;
  onContinue: () => void;
};

const APP_ICON = require("../../../assets/images/icon.png");
const SCREEN_PADDING = 20;
const HEADER_ROW_HEIGHT = 56;
const HEADER_FADE_HEIGHT = 18;
const STICKY_BAR_HEIGHT = 58;
const CARD_GAP = 14;

export function Paywall2View(props: Paywall2ViewProps) {
  const { t, i18n } = useTranslation();
  const brand = useCountryConfig().brandName;
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const phoneWidth = Math.min(176, Math.round(width * 0.42));
  const cardWidth = Math.round(Math.min(300, width * 0.72));
  const heroTitleSize = width < 360 ? 28 : 32;
  const headerHeight = insets.top + HEADER_ROW_HEIGHT;

  const offerTopRef = useRef(0);
  const ctaBottomRef = useRef(Number.POSITIVE_INFINITY);
  const [stickyVisible, setStickyVisible] = useState(false);
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const showSticky = !props.hasPlusAccess;
  const stickyBottomPadding = Math.max(insets.bottom, 12);
  const contentBottomPadding = showSticky
    ? STICKY_BAR_HEIGHT + stickyBottomPadding + 20
    : insets.bottom + 24;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Once shown, the sticky bar stays until the paywall closes.
    if (stickyVisible) return;
    if (event.nativeEvent.contentOffset.y < offerTopRef.current + ctaBottomRef.current) return;
    setStickyVisible(true);
    Animated.timing(stickyAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const { offer } = props;
  const selectedPlan = offer.kind === "plans"
    ? offer.plans.find((plan) => plan.id === offer.selectedPlanId) ?? offer.plans[0]
    : null;
  const quarterPlan = offer.kind === "plans"
    ? offer.plans.find((plan) => plan.id === "quarter") ?? null
    : null;
  const lifetimePrice = offer.kind === "lifetime" ? offer.price : null;
  const purchaseLabel = props.hasPlusAccess
    ? t("paywall2.activeCta")
    : selectedPlan
      ? planCtaLabel(t, i18n.language, selectedPlan)
      : t("paywall2.cta");

  const heroFeatures: { key: string; icon: IconName; label: string }[] = [
    { key: "exam", icon: "file-document-outline", label: t("paywall2.heroFeatureExam") },
    { key: "mistakes", icon: "restore", label: t("paywall2.heroFeatureMistakes") },
    { key: "traps", icon: "alert-outline", label: t("paywall2.heroFeatureTraps") },
  ];
  const finalFeatureRows: { key: string; icon: IconName; label: string }[][] = [
    [
      { key: "exam", icon: "file-document-outline", label: t("paywall2.featureExam") },
      { key: "mistakes", icon: "restore", label: t("paywall2.featureMistakes") },
      { key: "traps", icon: "alert-outline", label: t("paywall2.featureTraps") },
    ],
    [
      { key: "smart", icon: "chart-bar", label: t("paywall2.featureSmart") },
      { key: "offline", icon: "wifi", label: t("paywall2.featureOffline") },
    ],
  ];
  const cards = [
    { key: "exam", preview: <Paywall2ExamPreview />, title: t("paywall2.cardExamTitle"), body: t("paywall2.cardExamBody") },
    { key: "mistakes", preview: <Paywall2MistakesPreview />, title: t("paywall2.cardMistakesTitle"), body: t("paywall2.cardMistakesBody", { brand }) },
    { key: "traps", preview: <Paywall2TrapPreview />, title: t("paywall2.cardTrapsTitle"), body: t("paywall2.cardTrapsBody") },
  ];

  return (
    <View style={styles.root} testID={props.testID ?? "screen-paywall2"}>
      <LinearGradient
        colors={[palette.backgroundGlow, palette.background]}
        locations={[0, 0.45]}
        style={[styles.glow, { top: headerHeight }]}
      />

      <View style={[styles.header, { height: headerHeight, paddingTop: insets.top }]}>
        <View style={styles.brand}>
          <Image accessibilityIgnoresInvertColors source={APP_ICON} style={styles.brandIcon} />
          <CText bold style={styles.brandLabel}>{brand}</CText>
        </View>
        <Pressable
          accessibilityLabel={t("common.close")}
          accessibilityRole="button"
          hitSlop={12}
          onPress={props.onClose}
          style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
          testID="paywall2-close"
        >
          <MaterialCommunityIcons color={palette.text} name="close" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="paywall2-scroll"
      >
        <View>
          <CText
            adjustsFontSizeToFit
            bold
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: heroTitleSize + 4 }]}
          >
            {t("paywall2.heroTitleLead")}
          </CText>
          <CText
            adjustsFontSizeToFit
            bold
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.heroTitle, styles.accent, { fontSize: heroTitleSize, lineHeight: heroTitleSize + 4 }]}
          >
            {t("paywall2.heroTitleAccent")}
          </CText>
        </View>

        <View style={[styles.hero, { minHeight: phoneWidth * 2.05 * 0.6 }]}>
          <View
            pointerEvents="none"
            style={[styles.heroPhone, { right: -phoneWidth * 0.18 }]}
          >
            <Paywall2PhoneMock width={phoneWidth} />
          </View>
          <View style={[styles.heroColumn, { paddingRight: phoneWidth * 0.86 }]}>
            <CText style={styles.heroSubtitle}>{t("paywall2.heroSubtitle")}</CText>
            <View style={styles.heroFeatures}>
              {heroFeatures.map((feature) => (
                <View key={feature.key} style={styles.heroFeature}>
                  <IconRing icon={feature.icon} size={44} />
                  <CText
                    adjustsFontSizeToFit
                    center
                    minimumFontScale={0.85}
                    numberOfLines={3}
                    semiBold
                    style={styles.heroFeatureLabel}
                  >
                    {feature.label}
                  </CText>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View
          onLayout={(event: LayoutChangeEvent) => {
            offerTopRef.current = event.nativeEvent.layout.y;
          }}
          style={styles.offerCard}
          testID="paywall2-offer"
        >
          <LinearGradient
            colors={["rgba(94,234,122,0.16)", "rgba(94,234,122,0.03)"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.fill}
          />
          {props.hasPlusAccess ? (
            <View style={styles.activeRow}>
              <MaterialCommunityIcons color={palette.gold} name="crown" size={28} />
              <CText bold style={styles.activeTitle}>{t("paywall2.activeTitle")}</CText>
            </View>
          ) : offer.kind === "plans" ? (
            <>
              <View>
                <CText bold style={styles.plansTitle}>{t("paywall2.plansTitle")}</CText>
                <CText style={styles.plansSubtitle}>{t("paywall2.plansSubtitle")}</CText>
              </View>
              <PlanSelector
                onSelect={(id) => offer.onSelectPlan(id, "offer")}
                plans={offer.plans}
                selectedId={offer.selectedPlanId}
                testIDPrefix="paywall2-plan"
              />
            </>
          ) : (
            <>
              <View style={styles.badgeRow}>
                <MaterialCommunityIcons color={palette.gold} name="crown" size={20} />
                <CText bold style={styles.badgeLabel}>
                  {t("paywall2.offerBadge").toUpperCase()}
                </CText>
              </View>
              <View style={styles.offerRow}>
                <View style={styles.offerPrice}>
                  <PriceLabel placeholderWidth={112} price={lifetimePrice} style={styles.price} />
                  <CText style={styles.priceCaption}>{t("paywall2.offerOneTime")}</CText>
                </View>
                <View style={styles.offerChecks}>
                  <CheckLine label={t("paywall2.offerNoSubscription")} />
                  <CheckLine label={t("paywall2.offerNoRenewal")} />
                </View>
              </View>
            </>
          )}
          <View
            onLayout={(event: LayoutChangeEvent) => {
              const { y, height } = event.nativeEvent.layout;
              ctaBottomRef.current = y + height;
            }}
          >
            <PrimaryCta
              busy={props.purchaseBusy}
              disabled={!props.hasPlusAccess && props.purchaseDisabled}
              label={purchaseLabel}
              onPress={props.hasPlusAccess ? props.onContinue : props.onUnlock}
              testID="paywall2-cta"
            />
          </View>
          {props.feedback ? (
            <CText center style={styles.feedback} testID="paywall2-feedback">
              {props.feedback}
            </CText>
          ) : selectedPlan && !props.hasPlusAccess ? (
            <PlanTerms plan={selectedPlan} testID="paywall2-terms" />
          ) : null}
        </View>

        <SectionTitle
          accent={t("paywall2.smarterTitleAccent")}
          lead={t("paywall2.smarterTitleLead")}
        />
        <ScrollView
          contentContainerStyle={styles.carousel}
          decelerationRate="fast"
          disableIntervalMomentum
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={cardWidth + CARD_GAP}
          style={styles.bleed}
          testID="paywall2-carousel"
        >
          {cards.map((card) => (
            <View key={card.key} style={[styles.card, styles.benefitCard, { width: cardWidth }]}>
              {card.preview}
              <CText bold numberOfLines={2} style={styles.cardTitle}>{card.title}</CText>
              <CText numberOfLines={3} style={styles.cardBody}>{card.body}</CText>
            </View>
          ))}
        </ScrollView>

        <CText bold style={styles.sectionTitle}>{t("paywall2.compareTitle")}</CText>
        <ComparisonTable />
        {offer.kind === "plans" ? (
          quarterPlan ? (
            <View style={[styles.card, styles.priceBanner]} testID="paywall2-value">
              <MaterialCommunityIcons color={palette.gold} name="crown" size={22} />
              <View style={styles.priceBannerText}>
                <CText bold style={styles.valueTitle}>{t("paywall2.valueTitle")}</CText>
                <CText bold style={styles.priceBannerTitle}>
                  {quarterPlan.trialDays > 0
                    ? t("paywall2.valueOfferTrial", {
                        period: t(PLAN_LABEL_KEYS.quarter),
                        trial: trialLabel(t, i18n.language, quarterPlan.trialDays),
                      })
                    : t("paywall2.valueOffer", { period: t(PLAN_LABEL_KEYS.quarter) })}
                </CText>
                <CText style={styles.priceBannerBody}>{t("paywall2.valueBody")}</CText>
              </View>
            </View>
          ) : null
        ) : (
          <View style={[styles.card, styles.priceBanner]}>
            <MaterialCommunityIcons color={palette.gold} name="crown" size={22} />
            <View style={styles.priceBannerText}>
              <CText bold style={styles.priceBannerTitle}>
                {lifetimePrice ? `${t("paywall2.comparePriceTitle", { price: lifetimePrice })} ` : null}
                <CText bold style={[styles.priceBannerTitle, styles.gold]}>
                  {t("paywall2.comparePriceSubtitle")}
                </CText>
              </CText>
              <CText style={styles.priceBannerBody}>{t("paywall2.comparePriceBody")}</CText>
            </View>
          </View>
        )}

        <CText bold style={styles.sectionTitle}>{t("paywall2.reviewTitle")}</CText>
        <CText style={styles.sectionBody}>{t("paywall2.reviewBody")}</CText>
        <View style={[styles.card, styles.topics]}>
          <TopicBar color={palette.green} icon="sign-direction" label={t("paywall2.topicSigns")} value={82} />
          <TopicBar color={palette.gold} icon="call-split" label={t("paywall2.topicPriority")} value={61} />
          <TopicBar color={palette.green} icon="car-multiple" label={t("paywall2.topicSituations")} value={74} />
        </View>

        <CText bold style={styles.sectionTitle}>{t("paywall2.faqTitle")}</CText>
        <Faq subscription={offer.kind === "plans"} />

        <View style={[styles.card, styles.finalCard]}>
          <View style={styles.finalTitleRow}>
            <MaterialCommunityIcons color={palette.gold} name="crown" size={28} />
            <CText bold style={styles.finalTitle}>
              {t(offer.kind === "plans" ? "paywall2.finalPlansTitle" : "paywall2.finalTitle")}
            </CText>
          </View>
          <CText center style={styles.finalBody}>
            {t(offer.kind === "plans" ? "paywall2.finalPlansBody" : "paywall2.finalBody", { brand })}
          </CText>
          <View style={styles.finalFeatures}>
            {finalFeatureRows.map((row, index) => (
              <View key={index} style={styles.finalFeatureRow}>
                {row.map((feature) => (
                  <View key={feature.key} style={styles.finalFeature}>
                    <IconRing icon={feature.icon} size={38} />
                    <CText center numberOfLines={2} style={styles.finalFeatureLabel}>
                      {feature.label}
                    </CText>
                  </View>
                ))}
              </View>
            ))}
          </View>
          {props.hasPlusAccess ? null : offer.kind === "plans" ? (
            <PlanSelector
              compact
              onSelect={(id) => offer.onSelectPlan(id, "final")}
              plans={offer.plans}
              selectedId={offer.selectedPlanId}
              testIDPrefix="paywall2-final-plan"
            />
          ) : (
            <View style={styles.finalPrice}>
              <PriceLabel placeholderWidth={112} price={lifetimePrice} style={styles.finalPriceValue} />
              <CText style={styles.priceCaption}>{t("paywall2.offerOneTime")}</CText>
            </View>
          )}
          <PrimaryCta
            busy={props.purchaseBusy}
            disabled={!props.hasPlusAccess && props.purchaseDisabled}
            label={purchaseLabel}
            onPress={props.hasPlusAccess ? props.onContinue : props.onUnlock}
            testID="paywall2-final-cta"
          />
          {props.feedback ? (
            <CText center style={styles.feedback}>{props.feedback}</CText>
          ) : props.hasPlusAccess ? null : selectedPlan ? (
            <PlanTerms plan={selectedPlan} />
          ) : (
            <CText center style={styles.finalNote}>{t("paywall2.finalNote")}</CText>
          )}
          {!props.hasPlusAccess ? (
            <Pressable
              accessibilityRole="button"
              disabled={props.restoreBusy}
              hitSlop={8}
              onPress={props.onRestore}
              style={({ pressed }) => [styles.restore, pressed ? styles.pressed : null]}
              testID="paywall2-restore"
            >
              <CText style={styles.restoreLabel}>
                {t(props.restoreBusy ? "paywall2.restoring" : "paywall2.restore")}
              </CText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <LinearGradient
        colors={[palette.backgroundGlow, "rgba(11,58,34,0)"]}
        pointerEvents="none"
        style={[styles.headerFade, { top: headerHeight }]}
      />

      {showSticky ? (
        <Animated.View
          pointerEvents={stickyVisible ? "box-none" : "none"}
          style={[
            styles.sticky,
            { paddingBottom: stickyBottomPadding },
            {
              opacity: stickyAnim,
              transform: [{ translateY: stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
            },
          ]}
        >
          <View style={styles.stickyInner}>
            <MaterialCommunityIcons color={palette.gold} name="crown" size={20} />
            <View style={styles.stickyText}>
              {selectedPlan?.id === "quarter" ? (
                <>
                  <View style={styles.stickyPlanRow}>
                    <CText numberOfLines={1} style={styles.stickyCaption}>
                      {t(PLAN_LABEL_KEYS.quarter)}
                    </CText>
                    <CText bold numberOfLines={1} style={styles.stickyBadge}>
                      {t("paywall2.planBestValue").toUpperCase()}
                    </CText>
                  </View>
                  <PriceLabel placeholderWidth={72} price={selectedPlan.price} style={styles.stickyPrice} />
                </>
              ) : selectedPlan ? (
                <CText bold numberOfLines={1} style={styles.stickyPlanInline} testID="paywall2-sticky-plan">
                  {t(PLAN_LABEL_KEYS[selectedPlan.id])}
                  {selectedPlan.price ? (
                    <CText bold style={[styles.stickyPlanInline, styles.gold]}>{` · ${selectedPlan.price}`}</CText>
                  ) : null}
                </CText>
              ) : (
                <>
                  <CText numberOfLines={1} style={styles.stickyCaption}>{t("paywall2.offerBadge")}</CText>
                  <PriceLabel placeholderWidth={72} price={lifetimePrice} style={styles.stickyPrice} />
                </>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={props.purchaseDisabled}
              onPress={props.onUnlock}
              style={({ pressed }) => [styles.stickyCta, pressed ? styles.pressed : null]}
              testID="paywall2-sticky-cta"
            >
              {props.purchaseBusy ? (
                <ActivityIndicator color={palette.ctaText} size="small" />
              ) : (
                <>
                  <CText bold numberOfLines={1} style={styles.stickyCtaLabel}>
                    {selectedPlan
                      ? selectedPlan.trialDays > 0
                        ? trialLabel(t, i18n.language, selectedPlan.trialDays)
                        : t("paywall2.stickyUnlock")
                      : t("paywall2.cta")}
                  </CText>
                  <MaterialCommunityIcons color={palette.ctaText} name="arrow-right" size={16} />
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function PriceLabel({
  placeholderWidth,
  price,
  style,
}: {
  placeholderWidth: number;
  price: string | null;
  style: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  if (!price) {
    // Same line box as the real price, so the store price swaps in without a height jump.
    return (
      <View style={[styles.pricePlaceholderBox, { minWidth: placeholderWidth }]}>
        <CText bold style={style}>{"\u00A0"}</CText>
        <View style={[styles.pricePlaceholder, { width: placeholderWidth }]} />
      </View>
    );
  }
  return (
    <CText adjustsFontSizeToFit bold minimumFontScale={0.7} numberOfLines={1} style={style}>
      {price}
    </CText>
  );
}

const PLAN_LABEL_KEYS: Record<Paywall2PlanId, string> = {
  week: "paywall2.planWeek",
  month: "paywall2.planMonth",
  quarter: "paywall2.planQuarter",
};

function trialLabel(t: TFn, language: string, days: number) {
  return t(pluralKey("paywall2.planTrial", days, language), { count: days });
}

function planCtaLabel(t: TFn, language: string, plan: Paywall2Plan) {
  return plan.trialDays > 0
    ? t(pluralKey("paywall2.ctaTrial", plan.trialDays, language), { count: plan.trialDays })
    : t("paywall2.ctaNoTrial");
}

function PlanTerms({ plan, testID }: { plan: Paywall2Plan; testID?: string }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const period = t(PLAN_LABEL_KEYS[plan.id]);
  // Keeps one line reserved while the store price loads.
  const text = !plan.price
    ? "\u00A0"
    : plan.trialDays > 0
      ? t("paywall2.termsTrial", { price: plan.price, period })
      : t("paywall2.termsNoTrial", { price: plan.price, period });
  return (
    <CText center style={styles.planTerms} testID={testID}>
      {text}
    </CText>
  );
}

function PlanSelector({
  compact = false,
  onSelect,
  plans,
  selectedId,
  testIDPrefix,
}: {
  compact?: boolean;
  onSelect: (id: Paywall2PlanId) => void;
  plans: Paywall2Plan[];
  selectedId: Paywall2PlanId;
  testIDPrefix: string;
}) {
  const { t, i18n } = useTranslation();
  const styles = useStyles();

  return (
    <View accessibilityRole="radiogroup" style={compact ? styles.planListCompact : styles.planList}>
      {plans.map((plan) => {
        const selected = plan.id === selectedId;
        const best = plan.id === "quarter";
        const trial = plan.trialDays > 0
          ? trialLabel(t, i18n.language, plan.trialDays)
          : t("paywall2.planNoTrial");
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={plan.id}
            onPress={() => onSelect(plan.id)}
            style={({ pressed }) => [
              styles.planRow,
              compact ? styles.planRowCompact : null,
              best && !compact ? styles.planRowBest : null,
              best ? styles.planRowBestIdle : null,
              selected ? styles.planRowSelected : null,
              pressed ? styles.pressed : null,
            ]}
            testID={`${testIDPrefix}-${plan.id}`}
          >
            {best && !compact ? (
              <View style={styles.planBadge}>
                <MaterialCommunityIcons color={palette.gold} name="crown" size={13} />
                <CText bold style={styles.planBadgeLabel}>{t("paywall2.planBestValue").toUpperCase()}</CText>
              </View>
            ) : null}
            <View style={styles.planMain}>
              <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={styles.planText}>
                <CText bold numberOfLines={1} style={best && !compact ? styles.planPeriodBest : styles.planPeriod}>
                  {t(PLAN_LABEL_KEYS[plan.id])}
                </CText>
                {compact ? (
                  best ? (
                    <CText bold numberOfLines={1} style={styles.planBadgeInline}>
                      {t("paywall2.planBestValue").toUpperCase()}
                    </CText>
                  ) : null
                ) : (
                  <CText
                    numberOfLines={1}
                    style={[styles.planTrial, plan.trialDays > 0 ? styles.accent : null]}
                  >
                    {trial}
                  </CText>
                )}
              </View>
              <View style={styles.planPriceBox}>
                <PriceLabel
                  placeholderWidth={64}
                  price={plan.price}
                  style={[
                    best && !compact ? styles.planPriceBest : styles.planPrice,
                    selected ? styles.gold : null,
                  ]}
                />
                {compact && plan.trialDays > 0 ? (
                  <CText numberOfLines={1} style={[styles.planTrial, styles.accent]}>{trial}</CText>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionTitle({ accent, lead }: { accent: string; lead: string }) {
  const styles = useStyles();
  return (
    <CText bold style={styles.sectionTitle}>
      {lead}{" "}
      <CText bold style={[styles.sectionTitle, styles.accent]}>{accent}</CText>
    </CText>
  );
}

function IconRing({ icon, size }: { icon: IconName; size: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.iconRing, { width: size, height: size, borderRadius: size / 2 }]}>
      <MaterialCommunityIcons color={palette.green} name={icon} size={size * 0.5} />
    </View>
  );
}

function CheckLine({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.checkLine}>
      <MaterialCommunityIcons color={palette.green} name="check" size={18} />
      <CText style={styles.checkLabel}>{label}</CText>
    </View>
  );
}

function PrimaryCta({
  busy,
  disabled,
  label,
  onPress,
  testID,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        disabled ? styles.ctaDisabled : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <LinearGradient colors={[palette.ctaStart, palette.ctaEnd]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={styles.fill} />
      {busy ? (
        <ActivityIndicator color={palette.ctaText} />
      ) : (
        <CText bold style={styles.ctaLabel}>{label}</CText>
      )}
    </Pressable>
  );
}

function TopicBar({ color, icon, label, value }: { color: string; icon: IconName; label: string; value: number }) {
  const styles = useStyles();
  return (
    <View style={styles.topicRow}>
      <MaterialCommunityIcons color={color} name={icon} size={20} />
      <CText numberOfLines={1} style={styles.topicLabel}>{label}</CText>
      <View style={styles.topicTrack}>
        <View style={[styles.topicFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <CText style={styles.topicValue}>{value}%</CText>
    </View>
  );
}

function ComparisonTable() {
  const { t } = useTranslation();
  const styles = useStyles();
  const rows = [
    { key: "trainer", label: t("paywall2.rowTrainer"), free: true },
    { key: "exam", label: t("paywall2.rowExam"), free: false },
    { key: "mistakes", label: t("paywall2.rowMistakes"), free: false },
    { key: "traps", label: t("paywall2.rowTraps"), free: false },
    { key: "smart", label: t("paywall2.rowSmart"), free: false },
    { key: "offline", label: t("paywall2.rowOffline"), free: false },
  ];

  return (
    <View style={[styles.card, styles.table]} testID="paywall2-comparison">
      <View style={[styles.tableRow, styles.tableHeadRow]}>
        <View style={styles.tableLabelCell} />
        <View style={styles.tableFreeCell}>
          <CText semiBold style={styles.tableHead}>{t("paywall2.columnFree")}</CText>
        </View>
        <View style={[styles.tablePremiumCell, styles.tablePremiumHead]}>
          <MaterialCommunityIcons color={palette.gold} name="crown" size={14} />
          <CText bold style={[styles.tableHead, styles.gold]}>{t("paywall2.columnPremium")}</CText>
        </View>
      </View>
      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        return (
          <View key={row.key} style={[styles.tableRow, styles.tableBodyRow, styles.tableRowDivider]}>
            <View style={styles.tableLabelCell}>
              <CText numberOfLines={2} style={styles.tableLabel}>{row.label}</CText>
            </View>
            <View style={styles.tableFreeCell}>
              <MaterialCommunityIcons
                color={row.free ? palette.green : palette.red}
                name={row.free ? "check" : "close"}
                size={18}
              />
            </View>
            <View style={[styles.tablePremiumCell, last ? styles.tablePremiumFoot : null]}>
              <MaterialCommunityIcons color={palette.green} name="check" size={18} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Faq({ subscription }: { subscription: boolean }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const items = [
    {
      key: "subscription",
      q: t("paywall2.faqSubscriptionQuestion"),
      a: t(subscription ? "paywall2.faqPlansSubscriptionAnswer" : "paywall2.faqSubscriptionAnswer"),
    },
    { key: "content", q: t("paywall2.faqContentQuestion"), a: t("paywall2.faqContentAnswer") },
    { key: "offline", q: t("paywall2.faqOfflineQuestion"), a: t("paywall2.faqOfflineAnswer") },
    { key: "restore", q: t("paywall2.faqRestoreQuestion"), a: t("paywall2.faqRestoreAnswer") },
  ];

  return (
    <View style={[styles.card, styles.faq]}>
      {items.map((item, index) => {
        const open = openKey === item.key;
        return (
          <FaqItem
            answer={item.a}
            divider={index > 0}
            key={item.key}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpenKey(open ? null : item.key);
            }}
            open={open}
            question={item.q}
            testID={`paywall2-faq-${item.key}`}
          />
        );
      })}
    </View>
  );
}

function FaqItem(props: {
  answer: string;
  divider: boolean;
  onPress: () => void;
  open: boolean;
  question: string;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <View style={props.divider ? styles.faqDivider : null}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: props.open }}
        onPress={props.onPress}
        style={({ pressed }) => [styles.faqRow, pressed ? styles.pressed : null]}
        testID={props.testID}
      >
        <CText numberOfLines={2} style={styles.faqQuestion}>{props.question}</CText>
        <MaterialCommunityIcons color={palette.text} name={props.open ? "minus" : "plus"} size={20} />
      </Pressable>
      {props.open ? (
        <CText style={styles.faqAnswer} testID={`${props.testID}-answer`}>{props.answer}</CText>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ responsiveFont, spacing }) => ({
    root: {
      flex: 1,
      backgroundColor: palette.background,
    },
    glow: {
      position: "absolute",
      left: 0,
      right: 0,
      height: spacing.exact(720),
    },
    fill: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    header: {
      zIndex: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.backgroundGlow,
    },
    headerFade: {
      position: "absolute",
      left: 0,
      right: 0,
      height: spacing.exact(HEADER_FADE_HEIGHT),
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingTop: spacing.exact(HEADER_FADE_HEIGHT),
      paddingHorizontal: spacing.exact(SCREEN_PADDING),
      gap: spacing.exact(16),
    },
    pressed: {
      opacity: 0.8,
    },
    accent: {
      color: palette.green,
    },
    gold: {
      color: palette.gold,
    },
    close: {
      position: "absolute",
      left: spacing.exact(SCREEN_PADDING - 8),
      bottom: spacing.exact((HEADER_ROW_HEIGHT - 36) / 2),
      width: spacing.exact(36),
      height: spacing.exact(36),
      borderRadius: spacing.exact(18),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(4,18,11,0.55)",
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
    },
    brandIcon: {
      width: spacing.exact(28),
      height: spacing.exact(28),
      borderRadius: spacing.exact(7),
    },
    brandLabel: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(26),
      color: palette.text,
    },
    heroTitle: {
      color: palette.text,
    },
    hero: {
      marginTop: -spacing.exact(4),
    },
    heroPhone: {
      position: "absolute",
      top: 0,
    },
    heroColumn: {
      gap: spacing.exact(14),
    },
    heroSubtitle: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(21),
      color: palette.textMuted,
    },
    heroFeatures: {
      flexDirection: "row",
      gap: spacing.exact(6),
    },
    heroFeature: {
      flex: 1,
      alignItems: "center",
      gap: spacing.exact(6),
    },
    heroFeatureLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(14),
      color: palette.text,
    },
    iconRing: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.iconRing,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    card: {
      borderRadius: spacing.exact(18),
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    offerCard: {
      overflow: "hidden",
      zIndex: 2,
      gap: spacing.exact(10),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(14),
      borderRadius: spacing.exact(22),
      borderWidth: 1,
      borderColor: palette.greenBorder,
      backgroundColor: "#071A10",
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
    },
    badgeLabel: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      letterSpacing: 0.6,
      color: palette.gold,
    },
    offerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(12),
    },
    offerPrice: {
      flex: 1,
    },
    price: {
      fontSize: responsiveFont(30),
      lineHeight: responsiveFont(36),
      color: palette.gold,
    },
    pricePlaceholderBox: {
      justifyContent: "center",
    },
    pricePlaceholder: {
      position: "absolute",
      left: 0,
      height: "60%",
      borderRadius: spacing.exact(6),
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    priceCaption: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    offerChecks: {
      gap: spacing.exact(6),
    },
    checkLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(6),
    },
    checkLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.text,
    },
    plansTitle: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(26),
      color: palette.text,
    },
    plansSubtitle: {
      marginTop: spacing.exact(2),
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(19),
      color: palette.textMuted,
    },
    planList: {
      gap: spacing.exact(8),
    },
    planListCompact: {
      gap: spacing.exact(6),
    },
    planRow: {
      gap: spacing.exact(6),
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(10),
      borderRadius: spacing.exact(16),
      borderWidth: 2,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
    },
    planRowCompact: {
      paddingVertical: spacing.exact(8),
      borderRadius: spacing.exact(14),
    },
    planRowBest: {
      paddingTop: spacing.exact(12),
      paddingBottom: spacing.exact(14),
    },
    planRowBestIdle: {
      borderColor: palette.greenBorder,
    },
    planRowSelected: {
      borderColor: palette.green,
      backgroundColor: palette.greenSoft,
    },
    planBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(5),
    },
    planBadgeLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(14),
      letterSpacing: 0.6,
      color: palette.gold,
    },
    planBadgeInline: {
      fontSize: responsiveFont(10),
      lineHeight: responsiveFont(13),
      letterSpacing: 0.5,
      color: palette.gold,
    },
    planMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(12),
    },
    radio: {
      width: spacing.exact(20),
      height: spacing.exact(20),
      borderRadius: spacing.exact(10),
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: palette.green,
    },
    radioDot: {
      width: spacing.exact(10),
      height: spacing.exact(10),
      borderRadius: spacing.exact(5),
      backgroundColor: palette.green,
    },
    planText: {
      flex: 1,
    },
    planPeriod: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(21),
      color: palette.text,
    },
    planPeriodBest: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(23),
      color: palette.text,
    },
    planTrial: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(17),
      color: palette.textMuted,
    },
    planPriceBox: {
      alignItems: "flex-end",
    },
    planPrice: {
      fontSize: responsiveFont(17),
      lineHeight: responsiveFont(22),
      color: palette.text,
    },
    planPriceBest: {
      fontSize: responsiveFont(22),
      lineHeight: responsiveFont(28),
      color: palette.text,
    },
    planTerms: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    valueTitle: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(20),
      color: palette.text,
    },
    activeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(10),
    },
    activeTitle: {
      flex: 1,
      fontSize: responsiveFont(22),
      lineHeight: responsiveFont(28),
      color: palette.text,
    },
    cta: {
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(52),
      paddingHorizontal: spacing.exact(20),
      borderRadius: spacing.exact(26),
    },
    ctaDisabled: {
      opacity: 0.55,
    },
    ctaLabel: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(24),
      color: palette.ctaText,
    },
    feedback: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.amber,
    },
    sectionTitle: {
      marginTop: spacing.exact(16),
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(30),
      color: palette.text,
    },
    sectionBody: {
      marginTop: -spacing.exact(6),
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(21),
      color: palette.textMuted,
    },
    bleed: {
      marginHorizontal: -spacing.exact(SCREEN_PADDING),
    },
    carousel: {
      paddingHorizontal: spacing.exact(SCREEN_PADDING),
      gap: spacing.exact(CARD_GAP),
    },
    benefitCard: {
      padding: spacing.exact(14),
      gap: spacing.exact(8),
    },
    cardTitle: {
      marginTop: spacing.exact(4),
      minHeight: responsiveFont(42),
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(21),
      color: palette.text,
    },
    cardBody: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    topics: {
      gap: spacing.exact(12),
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(14),
    },
    topicRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(10),
    },
    topicLabel: {
      width: "36%",
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.text,
    },
    topicTrack: {
      flex: 1,
      height: spacing.exact(8),
      borderRadius: spacing.exact(4),
      overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.1)",
    },
    topicFill: {
      height: "100%",
      borderRadius: spacing.exact(4),
    },
    topicValue: {
      width: spacing.exact(40),
      textAlign: "right",
      fontVariant: ["tabular-nums"],
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    table: {
      paddingHorizontal: spacing.exact(12),
      paddingTop: spacing.exact(8),
      paddingBottom: spacing.exact(12),
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "stretch",
    },
    tableHeadRow: {
      height: spacing.exact(40),
    },
    tableBodyRow: {
      height: spacing.exact(46),
    },
    tableRowDivider: {
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.05)",
    },
    tableLabelCell: {
      flex: 1,
      justifyContent: "center",
      paddingRight: spacing.exact(8),
    },
    tableFreeCell: {
      width: spacing.exact(64),
      alignItems: "center",
      justifyContent: "center",
    },
    tablePremiumCell: {
      width: spacing.exact(104),
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.exact(4),
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: "rgba(94,234,122,0.28)",
      backgroundColor: palette.greenSoft,
    },
    tablePremiumHead: {
      borderTopWidth: 1,
      borderTopLeftRadius: spacing.exact(12),
      borderTopRightRadius: spacing.exact(12),
    },
    tablePremiumFoot: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: spacing.exact(12),
      borderBottomRightRadius: spacing.exact(12),
    },
    tableHead: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.text,
    },
    tableLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    priceBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(12),
      paddingHorizontal: spacing.exact(14),
      paddingVertical: spacing.exact(8),
      marginTop: -spacing.exact(6),
    },
    priceBannerText: {
      flex: 1,
      gap: spacing.exact(2),
    },
    priceBannerTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(21),
      color: palette.gold,
    },
    priceBannerBody: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    faq: {
      paddingHorizontal: spacing.exact(16),
    },
    faqDivider: {
      borderTopWidth: 1,
      borderTopColor: palette.divider,
    },
    faqRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(12),
      minHeight: spacing.exact(54),
      paddingVertical: spacing.exact(8),
    },
    faqQuestion: {
      flex: 1,
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(21),
      color: palette.text,
    },
    faqAnswer: {
      paddingBottom: spacing.exact(14),
      paddingRight: spacing.exact(24),
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.textMuted,
    },
    finalCard: {
      marginTop: spacing.exact(16),
      gap: spacing.exact(14),
      padding: spacing.exact(18),
      borderColor: palette.greenBorder,
    },
    finalTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(10),
    },
    finalTitle: {
      flexShrink: 1,
      fontSize: responsiveFont(22),
      lineHeight: responsiveFont(28),
      color: palette.text,
    },
    finalBody: {
      marginTop: -spacing.exact(6),
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.textMuted,
    },
    finalFeatures: {
      gap: spacing.exact(14),
    },
    finalFeatureRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.exact(12),
    },
    finalFeature: {
      width: "30%",
      alignItems: "center",
      gap: spacing.exact(6),
    },
    finalFeatureLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(15),
      color: palette.text,
    },
    finalPrice: {
      alignItems: "center",
    },
    finalPriceValue: {
      fontSize: responsiveFont(30),
      lineHeight: responsiveFont(36),
      color: palette.gold,
    },
    finalNote: {
      marginTop: -spacing.exact(4),
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: palette.textMuted,
    },
    restore: {
      alignSelf: "center",
      paddingVertical: spacing.exact(4),
    },
    restoreLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.textMuted,
      textDecorationLine: "underline",
    },
    sticky: {
      position: "absolute",
      zIndex: 10,
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.exact(12),
      paddingTop: spacing.exact(8),
      backgroundColor: "rgba(4,18,11,0.88)",
      borderTopWidth: 1,
      borderTopColor: palette.divider,
    },
    stickyInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
      paddingLeft: spacing.exact(14),
      paddingRight: spacing.exact(6),
      paddingVertical: spacing.exact(4),
      borderRadius: spacing.exact(26),
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.cardStrong,
    },
    stickyText: {
      flex: 1,
    },
    stickyCaption: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(15),
      color: palette.textMuted,
    },
    stickyPlanRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(6),
    },
    stickyBadge: {
      flexShrink: 1,
      fontSize: responsiveFont(9),
      lineHeight: responsiveFont(12),
      letterSpacing: 0.4,
      color: palette.gold,
    },
    stickyPlanInline: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(20),
      color: palette.text,
    },
    stickyPrice: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(20),
      color: palette.gold,
    },
    stickyCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      minHeight: spacing.exact(40),
      paddingHorizontal: spacing.exact(14),
      borderRadius: spacing.exact(20),
      backgroundColor: palette.ctaStart,
    },
    stickyCtaLabel: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: palette.ctaText,
    },
  }));
}

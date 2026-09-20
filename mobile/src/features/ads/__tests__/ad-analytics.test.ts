import {
  AD_PLACEMENTS,
  buildAdImpressionRevenueProperties,
  buildAdRevenueEvent,
  getAdPlacement,
  getRevenuePrecisionLabel,
  resolveAdNetwork,
  toFiniteNumber,
} from "../ad-analytics";

describe("ad impression revenue", () => {
  it("maps placement from trigger and signs routes", () => {
    expect(
      getAdPlacement({ trigger: "after_practice_session_complete" })
    ).toBe(AD_PLACEMENTS.afterTraining);
    expect(getAdPlacement({ trigger: "after_question_answer" })).toBe(
      AD_PLACEMENTS.trainingQuestions
    );
    expect(getAdPlacement({ trigger: "after_exam_complete" })).toBe(
      AD_PLACEMENTS.afterExam
    );
    expect(getAdPlacement({ trigger: "exam_restart" })).toBe(
      AD_PLACEMENTS.afterExam
    );
    expect(
      getAdPlacement({
        pathname: "/signs/category/A/test",
        trigger: "after_practice_session_complete",
      })
    ).toBe(AD_PLACEMENTS.signTest);
    expect(getAdPlacement({ trigger: "app_resume" })).toBe(AD_PLACEMENTS.other);
  });

  it("prefers the winning ad source name for ad_network", () => {
    expect(
      resolveAdNetwork({
        adNetwork: "Meta Audience Network",
        responseInfo: {
          loadedAdapterResponse: { adSourceName: "ignored" },
        },
      })
    ).toBe("Meta Audience Network");
    expect(
      resolveAdNetwork({
        responseInfo: {
          loadedAdapterResponse: {
            adSourceName: "AdMob Network",
            adapterClassName: "GADMAdapterGoogleAdMobAds",
          },
        },
      })
    ).toBe("AdMob Network");
    expect(
      resolveAdNetwork({
        responseInfo: {
          adapterClassName: "GADMAdapterGoogleAdMobAds",
        },
      })
    ).toBe("GADMAdapterGoogleAdMobAds");
    expect(resolveAdNetwork({})).toBe("unknown");
  });

  it("uses the SDK paid value and does not invent eCPM", () => {
    expect(
      buildAdRevenueEvent({
        adUnitId: "ca-app-pub-test/interstitial",
        paid: {
          currency: "USD",
          precision: 3,
          value: 0.0025,
          adNetwork: "AdMob Network",
        },
        placement: AD_PLACEMENTS.afterTraining,
      })
    ).toEqual({
      adFormat: "interstitial",
      adNetwork: "AdMob Network",
      adUnitId: "ca-app-pub-test/interstitial",
      currency: "USD",
      placement: AD_PLACEMENTS.afterTraining,
      precision: "precise",
      revenue: 0.0025,
    });
  });

  it("accepts iOS decimal strings and drops invalid revenue", () => {
    expect(toFiniteNumber("0.004")).toBe(0.004);
    expect(
      buildAdRevenueEvent({
        adUnitId: "unit",
        paid: { currency: "USD", precision: 1, value: "not-a-number" },
        placement: AD_PLACEMENTS.other,
      })
    ).toBeNull();
    expect(
      buildAdRevenueEvent({
        adUnitId: "unit",
        paid: { currency: "USD", precision: 1, value: -0.01 },
        placement: AD_PLACEMENTS.other,
      })
    ).toBeNull();
  });

  it("emits the PostHog property contract", () => {
    expect(
      buildAdImpressionRevenueProperties({
        adFormat: "interstitial",
        adNetwork: "AdMob Network",
        adUnitId: "ca-app-pub-test/interstitial",
        currency: "USD",
        placement: AD_PLACEMENTS.afterExam,
        precision: "estimated",
        revenue: 0.01,
      })
    ).toEqual({
      ad_format: "interstitial",
      ad_network: "AdMob Network",
      ad_unit_id: "ca-app-pub-test/interstitial",
      currency: "USD",
      placement: "after_exam",
      revenue: 0.01,
      revenue_precision: "estimated",
    });
  });

  it("labels revenue precision from the SDK enum", () => {
    expect(getRevenuePrecisionLabel(1)).toBe(
      "estimated"
    );
    expect(getRevenuePrecisionLabel("PRECISE")).toBe("precise");
    expect(getRevenuePrecisionLabel(null)).toBe("unknown");
  });
});

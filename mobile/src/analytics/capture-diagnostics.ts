const counters = { capture: 0, screen: 0, identify: 0, payload: 0 };

export function recordAnalyticsFailure(kind: keyof typeof counters) {
  counters[kind] += 1;
}

export function getAnalyticsDiagnosticsProperties() {
  return {
    analytics_capture_error_count: counters.capture,
    analytics_screen_error_count: counters.screen,
    analytics_identify_error_count: counters.identify,
    analytics_invalid_payload_count: counters.payload,
    analytics_diagnostic_scope: "js_runtime",
    analytics_delivery_status: "not_verified",
  };
}

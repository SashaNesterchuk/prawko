import { PropsWithChildren, createContext, useContext } from "react";

type AnalyticsTrackPayload = Record<string, string | number | boolean | null>;

type AnalyticsContextValue = {
  isConfigured: boolean;
  track: (event: string, payload?: AnalyticsTrackPayload) => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  isConfigured: false,
  track: () => undefined,
});

export function AnalyticsProvider({ children }: PropsWithChildren) {
  return (
    <AnalyticsContext.Provider
      value={{
        isConfigured: false,
        track: () => undefined,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

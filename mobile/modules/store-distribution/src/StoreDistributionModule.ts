import { requireOptionalNativeModule } from "expo";

type StoreDistributionNativeModule = {
  isTestFlight?: boolean;
};

const native =
  requireOptionalNativeModule<StoreDistributionNativeModule>("StoreDistribution");

export const isTestFlightInstall = native?.isTestFlight === true;

import ExpoModulesCore

public class StoreDistributionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StoreDistribution")

    // TestFlight uses a sandbox App Store receipt. App Store production uses `receipt`.
    Constant("isTestFlight") {
      Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }
  }
}

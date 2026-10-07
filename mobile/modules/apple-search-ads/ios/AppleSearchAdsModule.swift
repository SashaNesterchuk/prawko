import AdServices
import ExpoModulesCore

public class AppleSearchAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleSearchAds")

    // Apple's token is valid for 24 hours. Callers cache it and exchange it
    // from the server. This method does not contact Apple.
    AsyncFunction("getAttributionToken") { () throws -> String in
      try AAAttribution.attributionToken()
    }
  }
}

// Metro resolves this alias to the active app variant. This is deliberately an
// asset-level boundary: importing Czech signs cannot make them part of Prawko.
export {
  getSignAssetComponent,
  getSignRasterSource,
  signAssets,
} from "@app-road-sign-assets";

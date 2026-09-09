import type { CountryCode } from "@prawko/config";
import type { RoadSignCatalogDefinition } from "../features/road-signs/content/variant-catalog";

import { roadSignCatalog as czCatalog } from "../../variants/czech/road-sign-catalog";
import {
  getSignDescription as getCzSignDescription,
  getSignDisplayName as getCzSignDisplayName,
  getSignMetadata as getCzSignMetadata,
  getSignPracticeContent as getCzSignPracticeContent,
  getSignPractices as getCzSignPractices,
  getSignSearchText as getCzSignSearchText,
  getPrimarySignPractice as getCzPrimarySignPractice,
  hasSignMetadata as hasCzSignMetadata,
  hasSignPracticeContent as hasCzSignPracticeContent,
  listPracticeSignIds as listCzPracticeSignIds,
  matchesSignSearch as matchesCzSignSearch,
} from "../../variants/czech/road-sign-content";
import {
  getSignAssetComponent as getCzSignAssetComponent,
  getSignRasterSource as getCzSignRasterSource,
  signAssets as czSignAssets,
} from "../../variants/czech/road-sign-assets";
import { roadSignCatalog as plCatalog } from "../../variants/prawko/road-sign-catalog";
import {
  getSignDescription as getPlSignDescription,
  getSignDisplayName as getPlSignDisplayName,
  getSignMetadata as getPlSignMetadata,
  getSignPracticeContent as getPlSignPracticeContent,
  getSignPractices as getPlSignPractices,
  getSignSearchText as getPlSignSearchText,
  getPrimarySignPractice as getPlPrimarySignPractice,
  hasSignMetadata as hasPlSignMetadata,
  hasSignPracticeContent as hasPlSignPracticeContent,
  listPracticeSignIds as listPlPracticeSignIds,
  matchesSignSearch as matchesPlSignSearch,
} from "../../variants/prawko/road-sign-content";
import {
  getSignAssetComponent as getPlSignAssetComponent,
  getSignRasterSource as getPlSignRasterSource,
  signAssets as plSignAssets,
} from "../../variants/prawko/road-sign-assets";

const catalogs = {
  PL: plCatalog,
  CZ: czCatalog,
} as const;

const content = {
  PL: {
    getSignDescription: getPlSignDescription,
    getSignDisplayName: getPlSignDisplayName,
    getSignMetadata: getPlSignMetadata,
    getSignPracticeContent: getPlSignPracticeContent,
    getSignPractices: getPlSignPractices,
    getSignSearchText: getPlSignSearchText,
    getPrimarySignPractice: getPlPrimarySignPractice,
    hasSignMetadata: hasPlSignMetadata,
    hasSignPracticeContent: hasPlSignPracticeContent,
    listPracticeSignIds: listPlPracticeSignIds,
    matchesSignSearch: matchesPlSignSearch,
  },
  CZ: {
    getSignDescription: getCzSignDescription,
    getSignDisplayName: getCzSignDisplayName,
    getSignMetadata: getCzSignMetadata,
    getSignPracticeContent: getCzSignPracticeContent,
    getSignPractices: getCzSignPractices,
    getSignSearchText: getCzSignSearchText,
    getPrimarySignPractice: getCzPrimarySignPractice,
    hasSignMetadata: hasCzSignMetadata,
    hasSignPracticeContent: hasCzSignPracticeContent,
    listPracticeSignIds: listCzPracticeSignIds,
    matchesSignSearch: matchesCzSignSearch,
  },
} as const;

const assets = {
  PL: {
    getSignAssetComponent: getPlSignAssetComponent,
    getSignRasterSource: getPlSignRasterSource,
    signAssets: plSignAssets,
  },
  CZ: {
    getSignAssetComponent: getCzSignAssetComponent,
    getSignRasterSource: getCzSignRasterSource,
    signAssets: czSignAssets,
  },
} as const;

const EMPTY_CATALOG: RoadSignCatalogDefinition = {
  categories: [],
  signs: [],
};

const EMPTY_CONTENT = {
  getSignDescription: () => undefined,
  getSignDisplayName: (_signId: string, _locale: string, fallbackCode?: string) =>
    fallbackCode ?? "",
  getSignMetadata: () => undefined,
  getSignPracticeContent: () => undefined,
  getSignPractices: () => [],
  getSignSearchText: () => "",
  getPrimarySignPractice: () => undefined,
  hasSignMetadata: () => false,
  hasSignPracticeContent: () => false,
  listPracticeSignIds: () => [],
  matchesSignSearch: () => false,
} as const;

const EMPTY_ASSETS = {
  getSignAssetComponent: () => undefined,
  getSignRasterSource: () => undefined,
  signAssets: {},
} as const;

export function getRoadSignCatalogForCountry(country: CountryCode) {
  if (country === "PL" || country === "CZ") {
    return catalogs[country];
  }

  return EMPTY_CATALOG;
}

export function getRoadSignContentForCountry(country: CountryCode) {
  if (country === "PL" || country === "CZ") {
    return content[country];
  }

  return EMPTY_CONTENT;
}

export function getRoadSignAssetsForCountry(country: CountryCode) {
  if (country === "PL" || country === "CZ") {
    return assets[country];
  }

  return EMPTY_ASSETS;
}

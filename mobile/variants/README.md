# Country content modules

Road-sign catalogues and assets for Poland and Czechia live here and are imported together at runtime through `src/countries/road-signs.ts`. Exam country is persisted app state, not a Metro alias or `APP_VARIANT`.

Greece files are an unused content stub. Adding a country later means a `CountryConfig` entry plus these content modules — not a second app id.

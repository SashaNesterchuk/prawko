import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const mobileRoot = path.resolve(__dirname, "..");
const assetDir = path.resolve(mobileRoot, "assets/pl-road-signs-wikimedia");
const metadataOutputPath = path.resolve(
  repoRoot,
  "data/pl-road-signs-wikimedia/metadata.generated.json"
);
const assetRegistryOutputPath = path.resolve(
  mobileRoot,
  "src/features/road-signs/content/generatedSignAssets.ts"
);
const rasterRegistryOutputPath = path.resolve(
  mobileRoot,
  "src/features/road-signs/content/generatedRasterSignAssets.ts"
);
const dlakierowcyMetadataPath = path.resolve(
  repoRoot,
  "data/pl-road-signs-wikimedia/dlakierowcy.metadata.json"
);
const i18nMetadataPath = path.resolve(
  repoRoot,
  "data/pl-road-signs-wikimedia/metadata.i18n.json"
);
const officialPdfPath = "/tmp/prawko-du-2019-2311.pdf";
const officialPdfTextPath = "/tmp/prawko-du-2019-2311.txt";
const sourceCacheDir = "/tmp/prawko-road-sign-source";

const SOURCE_PAGE_URLS = {
  A: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-ostrzegawcze",
  B: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-zakazu",
  C: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-nakazu",
  D: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-informacyjne",
  F: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-uzupelniajace",
  G: "https://www.prawo-jazdy-360.pl/znaki-drogowe/znaki-drogowe-dodatkowe",
  T: "https://www.prawo-jazdy-360.pl/znaki-drogowe/tabliczki-do-znakow-drogowych",
};

const SOURCE_ALIASES = {
  "B-15-2.0m": "B-15",
  "B-16-3.1m": "B-16",
  "B-16-3.2m": "B-16",
  "B-16-3.4m": "B-16",
  "B-16-3.5m": "B-16",
  "B-17-6m": "B-17",
  "B-18-3.5t": "B-18",
  "B-18-7t": "B-18",
  "B-19-10t": "B-19",
  "B-33-50": "B-33",
  "B-34-50": "B-34",
  "B-43-30": "B-43",
  "B-44-30": "B-44",
  "C-14-30": "C-14",
  "C-15-30": "C-15",
  "C-17-2": "C-17",
  "D-51aa": "D-51a",
  "D-51ab": "D-51a",
  "F-3a": "F-3",
  "F-3b": "F-3",
  "F-3c": "F-3",
  "F-6a": "F-6",
  "F-11d": "F-11",
  "F-12a": "F-12",
  "F-13a": "F-13",
  "F-15a": "F-15",
  "T-14a": "T-14",
  "T-14b": "T-14",
  "T-14c": "T-14",
  "T-14d": "T-14",
  "T-16a": "T-16",
  "T-18a": "T-18",
  "T-18b": "T-18",
  "T-18c": "T-18",
  "T-28a": "T-28",
  "T-30a": "T-30",
  "T-30b": "T-30",
  "T-30c": "T-30",
  "T-30d": "T-30",
  "T-30e": "T-30",
  "T-30f": "T-30",
  "T-30g": "T-30",
  "T-30h": "T-30",
  "T-30i": "T-30",
  "T-31a": "T-31",
  "T-31b": "T-31",
  "T-31c": "T-31",
  "T-31d": "T-31",
  "T-31e": "T-31",
  "B-3-4": "B-3",
  "B-3-4-10": "B-3",
  "B-5-6t": "B-5",
  "B-5-12t": "B-5",
  "B-6-8": "B-6",
  "B-6-8-9": "B-6",
  "B-7-5t": "B-7",
  "B-9-12": "B-9",
  "B-13-14": "B-13",
  "B-35a": "B-35",
  "B-35b": "B-35",
  "B-35c": "B-35",
  "C-13-16": "C-13",
  "C-13-16a": "C-13",
  "C-13-16b": "C-13",
  "D-4c": "D-4a",
  "D-19a": "D-19",
  "D-20a": "D-20",
  "D-34b": "D-34",
  "D-34b_(alternative)": "D-34",
  "D-48a": "D-48",
  "F-14d": "F-14a",
  "F-14e": "F-14a",
  "F-14f": "F-14a",
};

// Dz.U. 2019 poz. 2310 § 84. The PDF text extract sometimes splits these lines.
const OFFICIAL_COPY_OVERRIDES = {
  "W-3": {
    name: "klasa obciążenia mostu o ruchu jednokierunkowym dla pojazdów kołowych i gąsienicowych",
    description:
      "klasa obciążenia mostu o ruchu jednokierunkowym dla pojazdów kołowych i gąsienicowych",
  },
  "W-5": {
    description:
      "klasa obciążenia mostu o ruchu dwukierunkowym dla pojazdów gąsienicowych",
  },
};

function parseSignCode(filename) {
  return filename.replace(/^PL_road_sign_/, "").replace(/\.(svg|png|jpe?g)$/i, "");
}

function parseCategoryId(signId) {
  return signId.split("-")[0];
}

function compareSignCodes(left, right) {
  const leftParts = left.split("-");
  const rightParts = right.split("-");

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);

    if (
      !Number.isNaN(leftNumber) &&
      !Number.isNaN(rightNumber) &&
      leftPart !== "" &&
      rightPart !== ""
    ) {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      continue;
    }

    const result = leftPart.localeCompare(rightPart, "pl", {
      numeric: true,
      sensitivity: "base",
    });

    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

function normalizeWhitespace(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ");
}

function normalizeSourceText(value) {
  return normalizeWhitespace(stripHtml(String(value ?? "")));
}

function flattenObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenObjects(item, output);
    }
    return output;
  }

  if (value && typeof value === "object") {
    output.push(value);

    for (const nestedValue of Object.values(value)) {
      flattenObjects(nestedValue, output);
    }
  }

  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferCodeFromImageUrl(imageUrl) {
  if (typeof imageUrl !== "string") {
    return undefined;
  }

  const basename = imageUrl.split("/").pop() ?? "";
  const match = basename.match(/^([A-Z]-\d+(?:[a-z])?(?:-\d+(?:[a-z])?)?)/);
  return match?.[1];
}

function parseDefinedTerm(term, fallbackCategoryId) {
  const rawName = normalizeSourceText(term.name);
  const rawDescription = normalizeSourceText(term.description);
  const rawImageCode = inferCodeFromImageUrl(term.image);
  const nameMatch = rawName.match(/^([A-Z]-[A-Za-z0-9_.()-]+)\s*[–-]\s*(.+)$/u);
  const codeOnlyMatch = rawName.match(/^([A-Z]-[A-Za-z0-9_.()-]+)$/u);
  const signId = nameMatch?.[1] ?? codeOnlyMatch?.[1] ?? rawImageCode;

  if (!signId) {
    return undefined;
  }

  const parsedName = normalizeWhitespace(nameMatch?.[2] ?? "");
  const name = parsedName || rawDescription || signId;
  const description = rawDescription || parsedName || signId;

  return {
    id: signId,
    categoryId: fallbackCategoryId ?? parseCategoryId(signId),
    name,
    description,
    source: "prawo-jazdy-360",
    sourceCode: signId,
    matchedVia: "source-exact",
  };
}

function fetchUrl(url) {
  return execFileSync("curl", ["-sS", url], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

function getSourceCachePath(categoryId) {
  return path.join(sourceCacheDir, `${categoryId}.html`);
}

function collectDlakierowcyMetadata() {
  if (!fs.existsSync(dlakierowcyMetadataPath)) {
    return new Map();
  }

  const raw = JSON.parse(fs.readFileSync(dlakierowcyMetadataPath, "utf8"));
  const entries = new Map();

  for (const [signId, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    entries.set(signId, {
      id: signId,
      categoryId: entry.categoryId ?? parseCategoryId(signId),
      name: normalizeSourceText(entry.name ?? signId),
      description: normalizeSourceText(entry.description ?? entry.name ?? signId),
      source: "dlakierowcy",
      sourceCode: entry.sourceCode ?? signId,
      matchedVia: "source-exact",
    });
  }

  return entries;
}

function collectSourceMetadata() {
  const sourceEntries = new Map();
  fs.mkdirSync(sourceCacheDir, { recursive: true });

  for (const [categoryId, url] of Object.entries(SOURCE_PAGE_URLS)) {
    const cachePath = getSourceCachePath(categoryId);
    let html;

    if (fs.existsSync(cachePath)) {
      html = fs.readFileSync(cachePath, "utf8");
    } else {
      html = fetchUrl(url);
      fs.writeFileSync(cachePath, html);
    }
    const matches = Array.from(
      html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      )
    );

    for (const match of matches) {
      const jsonText = match[1]?.trim();

      if (!jsonText) {
        continue;
      }

      let parsed;

      try {
        parsed = JSON.parse(jsonText);
      } catch (error) {
        continue;
      }

      const objects = flattenObjects(parsed);

      for (const object of objects) {
        const type = object?.["@type"] ?? object?.type;

        if (type !== "DefinedTerm") {
          continue;
        }

        const entry = parseDefinedTerm(object, categoryId);

        if (!entry) {
          continue;
        }

        sourceEntries.set(entry.id, entry);
      }
    }
  }

  return sourceEntries;
}

function normalizeOfficialLine(value) {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(/\u000c/g, " ")
      .replace(/^\s*–\s*$/, "")
  );
}

function isOfficialNoiseLine(line) {
  return (
    line === "" ||
    line === "Dziennik Ustaw" ||
    /^Poz\.\s+\d+/.test(line) ||
    /^–\s*\d+\s*–$/.test(line) ||
    /^﻿$/.test(line)
  );
}

function findNextMeaningfulLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = normalizeOfficialLine(lines[index]);

    if (!isOfficialNoiseLine(line)) {
      return { index, line };
    }
  }

  return undefined;
}

function looksLikeOfficialDescription(line, code) {
  return (
    line.includes(code) ||
    /^(?:Znak|Tabliczka|tabliczkę|tabliczka)\b/.test(line) ||
    /(stosuje się|umieszcza się|oznaczającą|oznaczający|wskazującą|wskazujący|jeżeli|gdy)\b/i.test(
      line
    )
  );
}

function findOfficialCodeLine(lines, code) {
  const escapedCode = escapeRegExp(code);
  const preferredPatterns = [
    new RegExp(
      `^(?!Rys\\.)(?:Znak|Tabliczka|tabliczkę|tabliczka)\\s+${escapedCode}(?:\\s|$|„)`
    ),
    new RegExp(`^(?!Rys\\.)${escapedCode}\\s+„`),
    new RegExp(`Rys\\.[^.]+\\.\\s+(?:Znak|Tabliczka)\\s+${escapedCode}(?:\\s|$)`),
    new RegExp(`\\b${escapedCode}\\b`),
  ];

  for (const pattern of preferredPatterns) {
    const index = lines.findIndex(
      (line) => pattern.test(line) && !line.includes("Konstrukcja")
    );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function collectOfficialDescription(lines, code, startIndex) {
  const collected = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = normalizeOfficialLine(lines[index]);

    if (isOfficialNoiseLine(line)) {
      if (collected.length > 0) {
        const nextMeaningful = findNextMeaningfulLine(lines, index + 1);

        if (!nextMeaningful || /^Rys\./.test(nextMeaningful.line)) {
          break;
        }
      }
      continue;
    }

    if (collected.length > 0 && /^Rys\./.test(line)) {
      break;
    }

    if (collected.length > 0 && /^\d+\.\d+/.test(line)) {
      break;
    }

    if (collected.length === 0 && /^Rys\./.test(line)) {
      continue;
    }

    if (collected.length > 0 && /^–\s*$/.test(line)) {
      break;
    }

    collected.push(line.replace(/^–\s*/, ""));

    const joined = normalizeWhitespace(collected.join(" "));
    const nextMeaningful = findNextMeaningfulLine(lines, index + 1);

    if (/^[A-Z]-[A-Za-z0-9_.()-]+\s+„[^”]+”/.test(collected[0]) && joined.endsWith(",")) {
      break;
    }

    if (joined.endsWith(".")) {
      break;
    }

    if (
      joined.endsWith(",") &&
      (!nextMeaningful ||
        /^Rys\./.test(nextMeaningful.line) ||
        /^–\s*$/.test(nextMeaningful.line))
    ) {
      break;
    }

    if (joined.length >= 320) {
      break;
    }
  }

  return normalizeWhitespace(collected.join(" "));
}

function trimOfficialDescription(value) {
  const trimmed = value.replace(/,\s*$/, "").trim();
  const firstSentenceMatch = trimmed.match(/^(.+?\.)\s+/);

  if (firstSentenceMatch) {
    return firstSentenceMatch[1].trim();
  }

  return trimmed;
}

function cleanupOfficialDescription(code, rawText) {
  const escapedCode = escapeRegExp(code);
  let value = normalizeWhitespace(rawText);

  value = value
    .replace(
      new RegExp(
        `^(?:Znak|Tabliczka|tabliczkę|tabliczka)\\s+${escapedCode}\\s+„[^”]+”\\s*\\([^)]*\\)\\s*`,
        "u"
      ),
      ""
    )
    .replace(
      new RegExp(
        `^(?:Znak|Tabliczka|tabliczkę|tabliczka)\\s+${escapedCode}\\s*\\([^)]*\\)\\s*`,
        "u"
      ),
      ""
    )
    .replace(
      new RegExp(`^${escapedCode}\\s+„[^”]+”\\s*\\([^)]*\\)\\s*`, "u"),
      ""
    );

  return trimOfficialDescription(value);
}

function extractOfficialMetadata(lines, code) {
  const index = findOfficialCodeLine(lines, code);

  if (index === -1) {
    return undefined;
  }

  const line = normalizeOfficialLine(lines[index]);
  const extractQuotedName = (value) =>
    normalizeWhitespace(
      value.match(/(?:^| )(?:Znak|Tabliczka)?\s*[A-Z]-[A-Za-z0-9_.()-]+\s+„([^”]+)”/u)?.[1] ??
        value.match(/^[A-Z]-[A-Za-z0-9_.()-]+\s+„([^”]+)”/u)?.[1] ??
        ""
    );
  let quotedName = extractQuotedName(line);
  let descriptionIndex = index;

  if (
    /^Rys\./.test(line) ||
    !looksLikeOfficialDescription(line, code) ||
    (quotedName && cleanupOfficialDescription(code, line) === "")
  ) {
    const nextDescriptionLine = findNextMeaningfulLine(lines, index + 1);

    if (nextDescriptionLine && looksLikeOfficialDescription(nextDescriptionLine.line, code)) {
      descriptionIndex = nextDescriptionLine.index;
    }
  }

  if (!quotedName && descriptionIndex !== index) {
    quotedName = extractQuotedName(normalizeOfficialLine(lines[descriptionIndex]));
  }

  const rawDescription = collectOfficialDescription(lines, code, descriptionIndex);
  const description = cleanupOfficialDescription(code, rawDescription) || quotedName;

  if (!description) {
    return undefined;
  }

  return {
    id: code,
    categoryId: parseCategoryId(code),
    name: quotedName || undefined,
    description,
    source: "eli.gov.pl",
    sourceCode: code,
    matchedVia: "official-exact",
  };
}

function ensureOfficialPdf() {
  if (fs.existsSync(officialPdfPath) && fs.statSync(officialPdfPath).size > 5_000_000) {
    return;
  }

  execFileSync(
    "curl",
    [
      "-sS",
      "-L",
      "https://eli.gov.pl/api/acts/DU/2019/2311/text.pdf",
      "-o",
      officialPdfPath,
    ],
    { maxBuffer: 50 * 1024 * 1024 }
  );
}

function loadOfficialLines() {
  ensureOfficialPdf();

  if (!fs.existsSync(officialPdfTextPath)) {
    const text = execFileSync("pdftotext", [officialPdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
    fs.writeFileSync(officialPdfTextPath, text);
  }

  return fs
    .readFileSync(officialPdfTextPath, "utf8")
    .split(/\r?\n/)
    .map((line) => normalizeOfficialLine(line));
}

function parseNumber(value) {
  return Number.parseFloat(String(value).replace(/[^\d.]/g, ""));
}

function ensureViewBox(content) {
  if (/viewBox=/i.test(content)) {
    return content;
  }

  const widthMatch = content.match(/\bwidth="([^"]+)"/i);
  const heightMatch = content.match(/\bheight="([^"]+)"/i);

  if (!widthMatch || !heightMatch) {
    return content;
  }

  const width = parseNumber(widthMatch[1]);
  const height = parseNumber(heightMatch[1]);

  if (!width || !height) {
    return content;
  }

  return content.replace(
    /<svg\b([^>]*)>/i,
    `<svg$1 viewBox="0 0 ${width} ${height}">`
  );
}

function normalizeRoadSignSvgs(files) {
  let changed = 0;

  for (const file of files.filter((entry) => entry.endsWith(".svg"))) {
    const filePath = path.join(assetDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const normalized = ensureViewBox(content);

    if (normalized !== content) {
      fs.writeFileSync(filePath, normalized);
      changed += 1;
    }
  }

  if (changed > 0) {
    console.log(`Added viewBox to ${changed} road-sign SVG files`);
  }
}

function generateAssetRegistry(files) {
  const entries = files
    .filter((file) => file.endsWith(".svg"))
    .map((file) => ({
      file,
      signId: parseSignCode(file),
    }))
    .sort((left, right) => compareSignCodes(left.signId, right.signId))
    .map((entry, index) => ({
      ...entry,
      importName: `PlRoadSignAsset${index}`,
    }));

  const importLines = entries.map(
    (entry) =>
      `import ${entry.importName} from "../../../../assets/pl-road-signs-wikimedia/${entry.file}";`
  );
  const unionLines = entries.map((entry) => `  | "${entry.signId}"`).join("\n");
  const registryLines = entries.map(
    (entry) => `  "${entry.signId}": ${entry.importName},`
  );

  const output = `/* eslint-disable import/no-unresolved */
/* This file is generated by scripts/generate-road-signs-content.mjs */

import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

${importLines.join("\n")}

export type SignAssetKey =
${unionLines};

export const generatedSignAssets: Record<SignAssetKey, ComponentType<SvgProps>> = {
${registryLines.join("\n")}
};
`;

  fs.mkdirSync(path.dirname(assetRegistryOutputPath), { recursive: true });
  fs.writeFileSync(assetRegistryOutputPath, output);
}

function generateRasterAssetRegistry(files) {
  const entries = files
    .filter((file) => /\.(png|jpe?g)$/i.test(file))
    .map((file) => ({
      file,
      signId: parseSignCode(file),
    }))
    .sort((left, right) => compareSignCodes(left.signId, right.signId));

  const registryLines = entries.map(
    (entry) =>
      `  "${entry.signId}": require("../../../../assets/pl-road-signs-wikimedia/${entry.file}"),`
  );

  const output = `/* eslint-disable import/no-unresolved */
/* This file is generated by scripts/generate-road-signs-content.mjs */

import type { ImageSourcePropType } from "react-native";

export const generatedRasterSignAssets: Record<string, ImageSourcePropType> = {
${registryLines.join("\n")}
};
`;

  fs.mkdirSync(path.dirname(rasterRegistryOutputPath), { recursive: true });
  fs.writeFileSync(rasterRegistryOutputPath, output);
}

function buildMetadata(files) {
  const signIds = files
    .filter((file) => /\.(svg|png|jpe?g)$/i.test(file))
    .map((file) => parseSignCode(file))
    .sort(compareSignCodes);
  const dlakierowcyEntries = collectDlakierowcyMetadata();
  const sourceEntries = collectSourceMetadata();
  let officialLines;

  try {
    officialLines = loadOfficialLines();
  } catch (error) {
    console.warn("Skipping official fallback metadata:", error.message);
  }

  const metadataBySignId = {};
  const missing = [];

  for (const signId of signIds) {
    const aliasCode = SOURCE_ALIASES[signId];
    const sourceExact =
      dlakierowcyEntries.get(signId) ?? sourceEntries.get(signId);
    const sourceAlias = aliasCode
      ? dlakierowcyEntries.get(aliasCode) ?? sourceEntries.get(aliasCode)
      : undefined;
    const officialExact = officialLines
      ? extractOfficialMetadata(officialLines, signId)
      : undefined;

    if (sourceExact) {
      metadataBySignId[signId] = sourceExact;
      continue;
    }

    if (officialExact) {
      metadataBySignId[signId] = {
        id: signId,
        categoryId: parseCategoryId(signId),
        name: officialExact.name || sourceAlias?.name || signId,
        description: officialExact.description || sourceAlias?.description || signId,
        source: officialExact.source,
        sourceCode: officialExact.sourceCode,
        matchedVia: sourceAlias
          ? "official-exact-with-source-alias-name"
          : officialExact.matchedVia,
      };
      continue;
    }

    if (sourceAlias) {
      metadataBySignId[signId] = {
        ...sourceAlias,
        id: signId,
        categoryId: parseCategoryId(signId),
        sourceCode: sourceAlias.id,
        matchedVia: "source-alias",
      };
      continue;
    }

    missing.push(signId);
  }

  const previousMetadata = loadPreviousMetadata();
  const stillMissing = [];

  for (const signId of missing) {
    if (previousMetadata[signId]) {
      metadataBySignId[signId] = previousMetadata[signId];
      continue;
    }

    stillMissing.push(signId);
  }

  applyOfficialCopyOverrides(metadataBySignId);

  return {
    metadataBySignId,
    missing: stillMissing,
    counts: {
      totalLocalSigns: signIds.length,
      withMetadata: Object.keys(metadataBySignId).length,
      missing: stillMissing.length,
    },
  };
}

function applyOfficialCopyOverrides(metadataBySignId) {
  for (const [signId, override] of Object.entries(OFFICIAL_COPY_OVERRIDES)) {
    const entry = metadataBySignId[signId];
    if (!entry) {
      continue;
    }

    metadataBySignId[signId] = {
      ...entry,
      name: override.name ?? polishText(entry.name),
      description: override.description ?? polishText(entry.description),
    };
  }
}

function loadPreviousMetadata() {
  if (!fs.existsSync(metadataOutputPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(metadataOutputPath, "utf8"));
  } catch {
    return {};
  }
}

function polishText(value) {
  if (value && typeof value === "object" && typeof value.pl === "string") {
    return value.pl;
  }

  return String(value ?? "");
}

function loadI18nMetadata() {
  if (!fs.existsSync(i18nMetadataPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(i18nMetadataPath, "utf8"));
  } catch {
    return {};
  }
}

function localizeField(polish, translated) {
  return {
    pl: polish,
    ua: translated?.ua || polish,
    en: translated?.en || polish,
  };
}

function localizeMetadata(metadataBySignId) {
  const i18n = loadI18nMetadata();
  const localized = {};

  for (const [signId, entry] of Object.entries(metadataBySignId)) {
    const namePl = polishText(entry.name);
    const descriptionPl = polishText(entry.description);
    const translated =
      i18n[signId] ?? i18n[entry.sourceCode] ?? {};

    localized[signId] = {
      ...entry,
      name: localizeField(namePl, translated.name),
      description: localizeField(descriptionPl, translated.description),
    };
  }

  return localized;
}

function writeMetadataFile(metadataBySignId) {
  const sortedEntries = Object.entries(metadataBySignId).sort(([left], [right]) =>
    compareSignCodes(left, right)
  );
  const sortedObject = Object.fromEntries(sortedEntries);

  fs.mkdirSync(path.dirname(metadataOutputPath), { recursive: true });
  fs.writeFileSync(metadataOutputPath, `${JSON.stringify(sortedObject, null, 2)}\n`);
}

function listRoadSignFiles() {
  return fs
    .readdirSync(assetDir)
    .filter(
      (file) =>
        file.startsWith("PL_road_sign_") && /\.(svg|png|jpe?g)$/i.test(file)
    )
    .sort((left, right) => compareSignCodes(parseSignCode(left), parseSignCode(right)));
}

function main() {
  const files = listRoadSignFiles();

  normalizeRoadSignSvgs(files);
  generateAssetRegistry(files);
  generateRasterAssetRegistry(files);

  const { metadataBySignId, missing, counts } = buildMetadata(files);
  writeMetadataFile(localizeMetadata(metadataBySignId));

  console.log(
    `Generated ${counts.withMetadata}/${counts.totalLocalSigns} road-sign metadata entries`
  );

  if (missing.length > 0) {
    console.log(`Metadata fallback remains for ${missing.length} signs:`);
    console.log(missing.join(", "));
  }
}

main();

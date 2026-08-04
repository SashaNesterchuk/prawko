import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const manifestPath = path.resolve(
  repoRoot,
  "data/questions/delivery/generated/delivery-manifest.json"
);
const outputPath = path.resolve(
  repoRoot,
  "mobile/src/features/offline/generated-asset-size-map.json"
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sizeMap = {};

for (const entry of manifest) {
  if (
    entry?.storageBucket &&
    entry?.storagePath &&
    typeof entry.outputSizeBytes === "number" &&
    Number.isFinite(entry.outputSizeBytes)
  ) {
    sizeMap[`${entry.storageBucket}/${entry.storagePath}`] =
      entry.outputSizeBytes;
  }

  if (
    entry?.posterStorageBucket &&
    entry?.posterStoragePath &&
    typeof entry.posterSizeBytes === "number" &&
    Number.isFinite(entry.posterSizeBytes)
  ) {
    sizeMap[`${entry.posterStorageBucket}/${entry.posterStoragePath}`] =
      entry.posterSizeBytes;
  }
}

const sortedEntries = Object.entries(sizeMap).sort(([left], [right]) =>
  left.localeCompare(right)
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(Object.fromEntries(sortedEntries), null, 2)}\n`,
  "utf8"
);

console.log(
  `Generated ${sortedEntries.length} offline asset sizes at ${path.relative(
    repoRoot,
    outputPath
  )}.`
);

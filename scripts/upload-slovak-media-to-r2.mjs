#!/usr/bin/env node

/** Upload the locally prepared flat Slovak image tree to its own R2 bucket. */
import { createHash, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = path.join(
  repoRoot,
  "data",
  "sk-questions-vodicak",
  "slovak-media-prod"
);
const dryRun = process.argv.includes("--dry-run");
const concurrency = 4;

function parseEnv(contents) {
  return Object.fromEntries(
    contents.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) return [];
      const [, key, rawValue] = match;
      return [[key, rawValue.replace(/^(['"])(.*)\1$/, "$2")]];
    })
  );
}

const env = {
  ...parseEnv(await readFile(path.join(repoRoot, ".env.local"), "utf8")),
  ...process.env,
};
const bucket = env.R2_BUCKET;
const endpoint = env.R2_ENDPOINT ?? env.ENDPOINT;
const accessKeyId = env.ACCESS_KEY_ID;
const secretAccessKey = env.SECRET_ACCESS_KEY;

if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "Missing R2_BUCKET, R2_ENDPOINT, ACCESS_KEY_ID, or SECRET_ACCESS_KEY in .env.local."
  );
}

if (bucket !== "slovak-media-prod") {
  throw new Error(`Refusing to upload Slovak media to unexpected bucket "${bucket}".`);
}

const endpointUrl = new URL(endpoint);

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function timestamp() {
  const value = new Date();
  const amzDate = value.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function signedRequest(method, objectPath, body, contentType) {
  const payloadHash = hash(body ?? "");
  const { amzDate, dateStamp } = timestamp();
  const canonicalUri = `/${[bucket, ...objectPath.split("/")]
    .map(encodeURIComponent)
    .join("/")}`;
  const headers = {
    host: endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(contentType ? { "content-type": contentType } : {}),
  };
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames
    .map((key) => `${key}:${headers[key]}\n`)
    .join("");
  const signedHeaders = headerNames.join(";");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hash(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");

  return {
    url: new URL(canonicalUri, endpointUrl).toString(),
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    })
  );
  return nested.flat();
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function request(method, objectPath, body, type) {
  const signed = signedRequest(method, objectPath, body, type);
  return fetch(signed.url, { method, headers: signed.headers, body });
}

const files = (await listFiles(sourceRoot)).sort();
let cursor = 0;
let uploaded = 0;
let skipped = 0;
let failed = 0;
let uploadedBytes = 0;
const failures = [];

async function uploadOne(filePath) {
  const objectPath = path.relative(sourceRoot, filePath).split(path.sep).join("/");
  const head = await request("HEAD", objectPath);
  if (head.status === 200) return { skipped: true, bytes: 0 };
  if (head.status !== 404) {
    throw new Error(`${objectPath}: preflight returned HTTP ${head.status}`);
  }
  if (dryRun) return { skipped: false, bytes: 0 };

  const body = await readFile(filePath);
  const put = await request("PUT", objectPath, body, contentType(filePath));
  if (put.status === 412) return { skipped: true, bytes: 0 };
  if (!put.ok) throw new Error(`${objectPath}: upload returned HTTP ${put.status}`);
  return { skipped: false, bytes: body.length };
}

async function worker() {
  while (cursor < files.length) {
    const filePath = files[cursor++];
    try {
      const result = await uploadOne(filePath);
      if (result.skipped) skipped += 1;
      else uploaded += 1;
      uploadedBytes += result.bytes;
    } catch (error) {
      failed += 1;
      failures.push(error instanceof Error ? error.message : String(error));
    }
    const processed = uploaded + skipped + failed;
    if (processed % 25 === 0 || processed === files.length) {
      console.log(`Processed ${processed}/${files.length}; uploaded=${uploaded}; skipped=${skipped}; failed=${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

const summary = { bucket, sourceRoot, dryRun, uploaded, skipped, failed, uploadedBytes, failures };
console.log(JSON.stringify(summary, null, 2));
if (failed > 0) process.exitCode = 1;

#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const envPath = path.join(workspaceRoot, ".env.local");
const sourceRoot = path.resolve(
  process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1])
    ?? path.join(workspaceRoot, "czech-etesty-questions-2026-08-19", "czech-media-prod")
);
const dryRun = process.argv.includes("--dry-run");
const bucket = process.env.R2_BUCKET ?? "czech-media-prod";
const concurrency = 4;

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    return [[key, value]];
  }));
}

const env = { ...parseEnv(await readFile(envPath, "utf8")), ...process.env };
const accessKeyId = env.ACCESS_KEY_ID;
const secretAccessKey = env.SECRET_ACCESS_KEY;
const endpoint = env.R2_ENDPOINT ?? env.ENDPOINT ?? env.ENPOINT;

if (!accessKeyId || !secretAccessKey || !endpoint) {
  throw new Error("Missing ACCESS_KEY_ID, SECRET_ACCESS_KEY, or ENPOINT/R2_ENDPOINT in the workspace .env.local.");
}

const endpointUrl = new URL(endpoint);
const region = "auto";
const service = "s3";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function timestamp() {
  const value = new Date();
  const date = value.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: date, dateStamp: date.slice(0, 8) };
}

function canonicalObjectPath(objectPath) {
  return `/${[bucket, ...objectPath.split("/")].map(encodeURIComponent).join("/")}`;
}

function sign(method, objectPath, body, contentType, extraHeaders = {}) {
  const payloadHash = hash(body ?? "");
  const { amzDate, dateStamp } = timestamp();
  const canonicalUri = canonicalObjectPath(objectPath);
  const headers = {
    host: endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
    ...(contentType ? { "content-type": contentType } : {}),
  };
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((key) => `${key}:${headers[key]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hash(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return {
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    url: new URL(canonicalUri, endpointUrl).toString(),
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const children = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  }));
  return children.flat();
}

function contentType(filePath) {
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

async function request(method, objectPath, body, type, extraHeaders) {
  const signed = sign(method, objectPath, body, type, extraHeaders);
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
  if (head.status !== 404) throw new Error(`${objectPath}: preflight returned HTTP ${head.status}`);
  if (dryRun) return { skipped: false, bytes: 0 };

  const body = await readFile(filePath);
  const put = await request("PUT", objectPath, body, contentType(filePath), { "if-none-match": "*" });
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
    if (processed % 20 === 0 || processed === files.length) {
      console.log(`Processed ${processed}/${files.length}; uploaded=${uploaded}; skipped=${skipped}; failed=${failed}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
if (failed > 0) {
  console.error(JSON.stringify({ bucket, sourceRoot, dryRun, uploaded, skipped, failed, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ bucket, sourceRoot, dryRun, uploaded, skipped, failed, uploadedBytes }, null, 2));
}

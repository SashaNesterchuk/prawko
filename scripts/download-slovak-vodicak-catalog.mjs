#!/usr/bin/env node

/**
 * Creates a local, provenance-preserving snapshot of Vodičák's public Slovak
 * question catalogue and its publicly referenced question media.  Vodičák is
 * an enumeration mirror, not the canonical source: the exported rows retain
 * both the mirror URL and its stated MINV SR attribution.  This script never
 * connects to Supabase or any other database.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, normalize } from "node:path";

const baseUrl = "https://vodicak.app";
const catalogueUrl = `${baseUrl}/otazky`;
const destinationRoot = new URL("../data/sk-questions-vodicak/", import.meta.url).pathname;
const sourceRoot = join(destinationRoot, "source");
const mediaRoot = join(destinationRoot, "media");
const downloadedAt = new Date().toISOString();

function decodeHtml(value) {
  return value
    .replace(/<!--\s*-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function mediaPaths(cardHtml) {
  const paths = new Set();
  for (const match of cardHtml.matchAll(/src="\/_next\/image\?url=([^&"]+)/g)) {
    const path = decodeURIComponent(decodeHtml(match[1]));
    if (path.startsWith("/questions/")) paths.add(path);
  }
  for (const match of cardHtml.matchAll(/src="(\/questions\/[^"?]+)"/g)) paths.add(match[1]);
  return [...paths].sort();
}

function parseQuestions(html) {
  const questions = [];
  const cardPattern = /<a class="group block[^>]*href="([^"?]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const card of html.matchAll(cardPattern)) {
    const [, href, cardHtml] = card;
    const badges = [...cardHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((match) => decodeHtml(match[1]));
    const questionMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const answers = [...cardHtml.matchAll(/<li class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)].map((match) => ({
      text: decodeHtml(match[2]),
      correct: match[1].includes("bg-green-50"),
    }));
    const number = Number.parseInt((badges.find((badge) => badge.startsWith("#")) ?? "").slice(1), 10);
    const points = Number.parseInt(badges.find((badge) => /\bbod\.$/u.test(badge)) ?? "", 10);
    const question = questionMatch ? decodeHtml(questionMatch[1]) : "";

    if (!Number.isInteger(number) || !question || answers.length !== 3 || answers.filter((answer) => answer.correct).length !== 1) {
      throw new Error(`Unable to parse complete question card at ${href}`);
    }

    const optionTexts = answers.map((answer) => answer.text);
    questions.push({
      sourceId: String(number),
      licenceCategory: null,
      licenceGroups: null,
      licenceGroupsStatus: "not_exposed_on_catalogue_card",
      block: badges[0] ?? null,
      points: Number.isInteger(points) ? points : null,
      questionSk: question,
      answers: optionTexts.map((text, index) => ({ key: ["A", "B", "C"][index], text })),
      correctAnswerKey: ["A", "B", "C"][answers.findIndex((answer) => answer.correct)],
      imageSourcePaths: mediaPaths(cardHtml),
      sourceHash: createHash("sha256").update(JSON.stringify({ question, optionTexts, points, href })).digest("hex"),
      source: {
        type: "third_party_enumeration_mirror",
        mirror: "Vodičák",
        mirrorUrl: `${baseUrl}${href}`,
        indexUrl: catalogueUrl,
        mirrorClaimsAuthority: "Ministry of Interior of the Slovak Republic (MV SR)",
        canonicalAuthorityUrl: "https://www.minv.sk/?elektronicke-testy",
      },
    });
  }

  questions.sort((left, right) => Number(left.sourceId) - Number(right.sourceId));
  if (questions.length !== 1416) throw new Error(`Expected 1416 catalogue cards, got ${questions.length}`);
  if (new Set(questions.map((question) => question.sourceId)).size !== questions.length) throw new Error("Duplicate source IDs found.");
  return questions;
}

function safeLocalMediaPath(remotePath) {
  const decoded = decodeURIComponent(remotePath).replace(/^\/+/, "");
  const local = normalize(join(mediaRoot, decoded));
  if (!local.startsWith(`${mediaRoot}/`)) throw new Error(`Unsafe media path: ${remotePath}`);
  return local;
}

async function fetchChecked(url) {
  const response = await fetch(url, { headers: { "user-agent": "Prawko local source audit/1.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

async function downloadMedia(paths) {
  const queue = [...paths];
  const rows = [];
  const workerCount = 2;
  async function worker() {
    while (queue.length > 0) {
      const remotePath = queue.shift();
      const url = `${baseUrl}${remotePath}`;
      const localPath = safeLocalMediaPath(remotePath);
      try {
        const response = await fetchChecked(url);
        const bytes = Buffer.from(await response.arrayBuffer());
        await mkdir(dirname(localPath), { recursive: true });
        await writeFile(localPath, bytes);
        rows.push({
          status: "downloaded",
          sourcePath: remotePath,
          sourceUrl: url,
          localPath: localPath.slice(destinationRoot.length + 1),
          bytes: bytes.length,
          contentType: response.headers.get("content-type"),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      } catch (error) {
        // The catalogue itself currently references some missing public files.
        // Keep those paths in the manifest instead of silently dropping media.
        rows.push({
          status: "unavailable_at_snapshot",
          sourcePath: remotePath,
          sourceUrl: url,
          error: error.message,
        });
      }
    }
  }
  await Promise.all(Array.from({ length: workerCount }, worker));
  return rows.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

await mkdir(sourceRoot, { recursive: true });
const catalogueResponse = await fetchChecked(catalogueUrl);
const catalogueHtml = await catalogueResponse.text();
const questions = parseQuestions(catalogueHtml);
const allMediaPaths = new Set(questions.flatMap((question) => question.imageSourcePaths));

await writeFile(join(sourceRoot, "vodicak-otazky.html"), catalogueHtml);
await writeFile(join(destinationRoot, "questions.vodicak.sk.json"), `${JSON.stringify({
  country: "SK", language: "sk", snapshotAt: downloadedAt, questionCount: questions.length,
  provenance: "third_party_enumeration_mirror; verify against MV SR before production use",
  questions,
}, null, 2)}\n`);

const media = await downloadMedia(allMediaPaths);
await writeFile(join(destinationRoot, "manifest.json"), `${JSON.stringify({
  country: "SK",
  snapshotAt: downloadedAt,
  source: { name: "Vodičák", indexUrl: catalogueUrl, type: "third_party_enumeration_mirror" },
  canonicalVerification: "https://www.minv.sk/?elektronicke-testy",
  questionCount: questions.length,
  questionMediaCount: media.filter((item) => item.status === "downloaded").length,
  questionMediaUnavailableCount: media.filter((item) => item.status !== "downloaded").length,
  questionsFile: "questions.vodicak.sk.json",
  sourceHtmlFile: "source/vodicak-otazky.html",
  media,
  databaseTouched: false,
}, null, 2)}\n`);

console.log(JSON.stringify({
  questions: questions.length,
  mediaDownloaded: media.filter((item) => item.status === "downloaded").length,
  mediaUnavailableAtSnapshot: media.filter((item) => item.status !== "downloaded").length,
  destinationRoot,
}, null, 2));

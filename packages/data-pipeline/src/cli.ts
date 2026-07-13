import path from "node:path";

import { mediaBuildJobSchema } from "@prawko/schemas";

import { EXPORTS_GENERATED_DIR, NORMALIZED_GENERATED_DIR } from "./constants";
import type { PipelineOptions } from "./types";
import { runInspect, runPipeline, runValidate } from "./pipeline";
import { executeMediaBuild, uploadBuiltMedia } from "./media-build";
import {
  prepareNormalizedQuestionTopics,
  syncNormalizedQuestionTopicsToSupabase,
} from "./question-topic-sync";
import { syncQuestionsToSupabase } from "./question-sync";
import { clearQuestionMediaStorage } from "./storage-clear";
import { pathExists, readJsonFile, resolveRepoPath } from "./utils";

function hasPipelineSourceOverrides(options: PipelineOptions): boolean {
  return Boolean(
    options.xlsxPath ??
      options.sheetName ??
      options.mediaDir ??
      options.aliasesPath ??
      options.deliveryDir
  );
}

async function resolveGeneratedQuestionExportPath(
  inputPath?: string
): Promise<string | null> {
  const candidatePath = resolveRepoPath(
    inputPath ??
      path.join(EXPORTS_GENERATED_DIR, "supabase.questions.category-b.json")
  );

  return (await pathExists(candidatePath)) ? candidatePath : null;
}

async function loadGeneratedMediaBuildPlan(
  inputPath?: string
) {
  const candidatePath = resolveRepoPath(
    inputPath ?? path.join(NORMALIZED_GENERATED_DIR, "media-build-plan.json")
  );

  if (!(await pathExists(candidatePath))) {
    return null;
  }

  return mediaBuildJobSchema
    .array()
    .parse(await readJsonFile(candidatePath));
}

function parseArgs(argv: string[]): { command: string; options: PipelineOptions } {
  const [command = "pipeline", ...rest] = argv;
  const options: PipelineOptions = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === "--xlsx") {
      options.xlsxPath = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--sheet") {
      options.sheetName = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--media-dir") {
      options.mediaDir = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--aliases") {
      options.aliasesPath = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--delivery-dir") {
      options.deliveryDir = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--input") {
      options.inputPath = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--topic-catalog") {
      options.topicCatalogPath = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--topic-assignments") {
      options.topicAssignmentsPath = rest[index + 1];
      index += 1;
      continue;
    }

    if (token === "--fail-on-warnings") {
      options.failOnWarnings = true;
      continue;
    }

    if (token === "--skip-existing") {
      options.skipExisting = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--limit") {
      const rawValue = Number.parseInt(rest[index + 1] ?? "", 10);
      if (Number.isFinite(rawValue) && rawValue > 0) {
        options.limit = rawValue;
      }
      index += 1;
      continue;
    }

    if (token === "--batch-size") {
      const rawValue = Number.parseInt(rest[index + 1] ?? "", 10);
      if (Number.isFinite(rawValue) && rawValue > 0) {
        options.batchSize = rawValue;
      }
      index += 1;
    }
  }

  return { command, options };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "pipeline") {
    const result = await runPipeline(options);
    console.log(JSON.stringify(result.summary, null, 2));
    return;
  }

  if (command === "inspect") {
    const result = await runInspect(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "validate") {
    const result = await runValidate();
    console.log(JSON.stringify(result.summary, null, 2));
    return;
  }

  if (command === "media:audit") {
    const result = await runPipeline(options);
    console.log(
      JSON.stringify(
        {
          totalMediaEntries: result.summary.totalMediaEntries,
          totalMediaReferences: result.summary.totalMediaReferences,
          totalMediaBuildJobs: result.summary.totalMediaBuildJobs,
          issues: result.summary.issues,
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "media:build") {
    const pipelineResult = await runPipeline(options);
    const result = await executeMediaBuild(pipelineResult.mediaBuildPlan, options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "media:upload") {
    const mediaBuildPlan =
      hasPipelineSourceOverrides(options)
        ? (await runPipeline(options)).mediaBuildPlan
        : ((await loadGeneratedMediaBuildPlan(options.inputPath)) ??
          (await runPipeline(options)).mediaBuildPlan);
    const result = await uploadBuiltMedia(mediaBuildPlan, options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "storage:clear") {
    const result = await clearQuestionMediaStorage({
      dryRun: Boolean(options.dryRun),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "questions:sync") {
    if (!options.inputPath && !hasPipelineSourceOverrides(options)) {
      options.inputPath = await resolveGeneratedQuestionExportPath() ?? undefined;
    }

    if (!options.inputPath) {
      await runPipeline(options);
    }
    const result = await syncQuestionsToSupabase(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "question-topics:prepare") {
    const result = await prepareNormalizedQuestionTopics(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "question-topics:sync") {
    const result = await syncNormalizedQuestionTopicsToSupabase(options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(
    `Unknown command "${command}". Use one of: pipeline, inspect, validate, media:audit, media:build, media:upload, storage:clear, questions:sync, question-topics:prepare, question-topics:sync.`
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

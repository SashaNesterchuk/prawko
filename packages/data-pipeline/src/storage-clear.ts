import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_STORAGE_BUCKET_IDS } from "@prawko/config";

import { loadLocalEnvFiles } from "./env";

const LIST_PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;
const STORAGE_PREFIXES = ["primary", "question", "answer", "poster"] as const;

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Expected SUPABASE_SERVICE_ROLE_KEY and a Supabase URL in env files."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function listObjectPaths(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    for (const entry of data) {
      if (entry.id) {
        paths.push(prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }

    if (data.length < LIST_PAGE_SIZE) {
      break;
    }

    offset += LIST_PAGE_SIZE;
  }

  return paths;
}

async function listBucketObjectPaths(
  supabase: SupabaseClient,
  bucket: string
): Promise<string[]> {
  const paths: string[] = [];

  for (const prefix of STORAGE_PREFIXES) {
    paths.push(...(await listObjectPaths(supabase, bucket, prefix)));
  }

  return paths;
}

export type StorageClearResult = {
  buckets: Array<{
    bucket: string;
    listedObjects: number;
    deletedObjects: number;
    failedObjects: number;
  }>;
  totalListedObjects: number;
  totalDeletedObjects: number;
  totalFailedObjects: number;
  dryRun: boolean;
};

export async function clearQuestionMediaStorage(options: {
  dryRun?: boolean;
  buckets?: string[];
} = {}): Promise<StorageClearResult> {
  await loadLocalEnvFiles();

  const supabase = getSupabaseAdminClient();
  const buckets = options.buckets ?? [...MEDIA_STORAGE_BUCKET_IDS];
  const dryRun = Boolean(options.dryRun);

  const bucketResults: StorageClearResult["buckets"] = [];
  let totalListedObjects = 0;
  let totalDeletedObjects = 0;
  let totalFailedObjects = 0;

  for (const bucket of buckets) {
    const objectPaths = await listBucketObjectPaths(supabase, bucket);
    totalListedObjects += objectPaths.length;

    let deletedObjects = 0;
    let failedObjects = 0;

    if (!dryRun) {
      for (let index = 0; index < objectPaths.length; index += DELETE_BATCH_SIZE) {
        const batch = objectPaths.slice(index, index + DELETE_BATCH_SIZE);
        const { error } = await supabase.storage.from(bucket).remove(batch);

        if (error) {
          failedObjects += batch.length;
          continue;
        }

        deletedObjects += batch.length;
      }
    }

    totalDeletedObjects += deletedObjects;
    totalFailedObjects += failedObjects;

    bucketResults.push({
      bucket,
      listedObjects: objectPaths.length,
      deletedObjects,
      failedObjects,
    });
  }

  return {
    buckets: bucketResults,
    totalListedObjects,
    totalDeletedObjects,
    totalFailedObjects,
    dryRun,
  };
}

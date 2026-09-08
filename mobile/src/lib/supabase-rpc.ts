type RpcErrorLike = {
  code?: string;
};

type RpcResponse<TData> = {
  data: TData;
  error: RpcErrorLike | null;
};

export function isMissingRpcOverloadError(
  error: RpcErrorLike | null | undefined
): boolean {
  return error?.code === "PGRST202";
}

export function withoutQuestionSetKey<T extends { p_question_set_key?: unknown }>(
  params: T
): Omit<T, "p_question_set_key"> {
  const { p_question_set_key: _omitted, ...rest } = params;
  return rest;
}

/**
 * PostgREST matches RPC overloads by the JSON keys in the body.
 * Remote DBs that have not applied `question_set` scoping still expose the
 * previous signatures, so a `p_question_set_key` argument 404s as PGRST202.
 */
export async function invokeRpcWithQuestionSetFallback<
  TParams extends { p_question_set_key: string },
  TData,
>(
  invoke: (
    params: TParams | Omit<TParams, "p_question_set_key">
  ) => PromiseLike<RpcResponse<TData>>,
  params: TParams
): Promise<RpcResponse<TData>> {
  const first = await invoke(params);
  if (!isMissingRpcOverloadError(first.error)) {
    return first;
  }

  return invoke(withoutQuestionSetKey(params));
}

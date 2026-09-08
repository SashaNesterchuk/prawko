import {
  invokeRpcWithQuestionSetFallback,
  isMissingRpcOverloadError,
  withoutQuestionSetKey,
} from "../supabase-rpc";

describe("supabase RPC question-set fallback", () => {
  it("detects PostgREST missing-overload errors", () => {
    expect(isMissingRpcOverloadError({ code: "PGRST202" })).toBe(true);
    expect(isMissingRpcOverloadError({ code: "PGRST116" })).toBe(false);
    expect(isMissingRpcOverloadError(null)).toBe(false);
  });

  it("strips only the question-set argument", () => {
    expect(
      withoutQuestionSetKey({
        p_exam_date: "2026-09-28",
        p_question_set_key: "cz-v1-current",
        p_title: "Plan",
      })
    ).toEqual({
      p_exam_date: "2026-09-28",
      p_title: "Plan",
    });
  });

  it("returns the first result when the scoped signature exists", async () => {
    const invoke = jest.fn(async (params: Record<string, unknown>) => ({
      data: params,
      error: null,
    }));

    const params = {
      p_exam_date: "2026-09-28",
      p_question_set_key: "cz-v1-current",
    };

    await expect(
      invokeRpcWithQuestionSetFallback(invoke, params)
    ).resolves.toEqual({
      data: params,
      error: null,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(params);
  });

  it("retries without p_question_set_key after PGRST202", async () => {
    const invoke = jest.fn(async (params: Record<string, unknown>) => {
      if ("p_question_set_key" in params) {
        return {
          data: null,
          error: { code: "PGRST202" },
        };
      }

      return {
        data: "plan-id",
        error: null,
      };
    });

    await expect(
      invokeRpcWithQuestionSetFallback(invoke, {
        p_exam_date: "2026-09-28",
        p_question_set_key: "cz-v1-current",
        p_title: "Plan",
      })
    ).resolves.toEqual({
      data: "plan-id",
      error: null,
    });
    expect(invoke).toHaveBeenNthCalledWith(1, {
      p_exam_date: "2026-09-28",
      p_question_set_key: "cz-v1-current",
      p_title: "Plan",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, {
      p_exam_date: "2026-09-28",
      p_title: "Plan",
    });
  });

  it("does not retry unrelated RPC errors", async () => {
    const error = { code: "42501", message: "not allowed" };
    const invoke = jest.fn(async () => ({
      data: null,
      error,
    }));

    await expect(
      invokeRpcWithQuestionSetFallback(invoke, {
        p_question_set_key: "pl-v2-current",
      })
    ).resolves.toEqual({ data: null, error });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

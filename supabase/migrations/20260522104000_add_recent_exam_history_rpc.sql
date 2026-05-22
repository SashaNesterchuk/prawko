create or replace function public.list_recent_exam_sessions(
  p_limit integer default 5
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  update public.exam_sessions
  set
    status = 'expired',
    finished_at = coalesce(finished_at, expires_at, v_now),
    metadata = metadata || jsonb_build_object(
      'expired_at',
      v_now
    ),
    updated_at = v_now
  where user_id = v_user_id
    and status = 'active'
    and mode in ('exam', 'mini_test', 'exam_tomorrow')
    and expires_at is not null
    and expires_at <= v_now;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        s.id,
        'mode',
        s.mode,
        'status',
        s.status,
        'sessionLocale',
        s.session_locale,
        'currentCategory',
        s.current_category,
        'currentQuestionIndex',
        s.current_question_index,
        'totalQuestionsTarget',
        s.total_questions_target,
        'totalQuestionsAnswered',
        s.total_questions_answered,
        'totalPointsTarget',
        s.total_points_target,
        'passPoints',
        s.pass_points,
        'scorePoints',
        s.score_points,
        'correctAnswersCount',
        s.correct_answers_count,
        'wrongAnswersCount',
        s.wrong_answers_count,
        'passed',
        s.passed,
        'startedAt',
        s.started_at,
        'finishedAt',
        s.finished_at,
        'expiresAt',
        s.expires_at,
        'remainingSeconds',
        null,
        'studyPlanId',
        s.study_plan_id,
        'metadata',
        s.metadata
      )
      order by coalesce(s.finished_at, s.started_at) desc, s.started_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.exam_sessions
    where user_id = v_user_id
      and mode in ('exam', 'mini_test', 'exam_tomorrow')
      and status <> 'active'
    order by coalesce(finished_at, started_at) desc, started_at desc
    limit v_limit
  ) s;

  return v_result;
end;
$$;

grant execute on function public.list_recent_exam_sessions(
  integer
) to authenticated;

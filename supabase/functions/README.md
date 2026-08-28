# Supabase functions

Current function status:

1. `question-chat`
   - provider-agnostic adapter entrypoint
   - user auth check
   - resolves the question from `questions_v2` via `questionSetKey` + source id
   - overlays `question_ai_explanations_v2` and `question_ai_contexts_v2` into the prompt
   - assistant/user logging into `ai_messages.question_id` (`questions_v2.id`)
   - pre-generated explanation response path when provider keys are missing

Suggested next functions:

1. `generate-question-explanations`
2. `redeem-school-code`

# Supabase migrations

Current migration order:

1. `20260520150000_create_core_learning_tables.sql`
2. `20260520151000_enable_core_rls_and_profile_bootstrap.sql`
3. `20260520152000_create_learning_state_and_plan_breakdown.sql`
4. `20260520153000_add_learning_state_functions_and_policies.sql`
5. `20260520154000_patch_learning_and_plan_progress_functions.sql`
6. `20260520155000_create_exam_bookmark_and_ai_tables.sql`
7. `20260520156000_create_school_access_and_entitlements.sql`
8. `20260520157000_enable_new_domain_policies_and_functions.sql`
9. `20260520158000_add_media_delivery_buckets.sql`
10. `20260520159000_add_question_delivery_asset_columns.sql`
11. `20260521173000_add_exam_simulator_rpc.sql`

Notes:

1. The first four migrations establish the core learning model.
2. `20260520154000` patches two edge cases in day progress recomputation.
3. `20260520155000` adds exam sessions, bookmarks, and AI logs.
4. `20260520156000` adds the B2B access layer and entitlement model.
5. `20260520157000` wires triggers, RLS, helper functions, and storage buckets.
6. `20260520158000` adds poster and PJM storage buckets for delivery media.
7. `20260520159000` adds denormalized delivery asset JSON columns on `questions`.
8. `20260521173000` adds the first real exam simulator RPC surface for start, answer, snapshot, and end-session flows.

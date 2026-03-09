# Passkey Backend Review

## Findings

1. `backend/src/Services/PasskeyService.php` was still willing to derive a passkey user handle from `user.id` or a fabricated `user-<id>` fallback when `uuid` was absent. That cut against the UUID-first rollout requirement and risked forcing clients to compensate for missing backend identity data.
2. `backend/src/Services/PasskeyService.php` returned `401 PASSKEY_NOT_FOUND` for an unknown credential during `/auth/passkey/login/verify`, while `backend/openapi.json` documented missing challenge/user/passkey cases as `404`.
3. `backend/database/migrations/20260309_add_passkey_tables.sql` defined `user_passkeys.transports` as `json`, while `backend/database/localhost.sql` and the SQLite integration schema modeled it as text/longtext. That was unnecessary schema drift in a rollout-sensitive area.

## Changes Made

- Enforced a persisted, valid UUID for passkey identity handling in `backend/src/Services/PasskeyService.php`. Registration now refuses to create user handles from non-UUID fallbacks, identifier-based login options reject accounts lacking a valid UUID, and login verify also refuses to mint a passkey login payload for a user without a valid UUID.
- Changed unknown-credential handling in `backend/src/Services/PasskeyService.php` from `401` to `404` so backend behavior matches the declared OpenAPI contract.
- Added focused regression coverage in `backend/tests/Unit/Services/PasskeyServiceTest.php` for `USER_UUID_REQUIRED` and `PASSKEY_NOT_FOUND`.
- Aligned `backend/database/migrations/20260309_add_passkey_tables.sql` with the checked-in schema shape by changing `user_passkeys.transports` to `longtext`.
- Updated `backend/openapi.json` to document the new `409` UUID-gate responses on the affected passkey endpoints.

## Remaining Risks

- Existing accounts without a valid persisted UUID will now get `409 USER_UUID_REQUIRED` on passkey registration and some passkey login paths. That is the safer staged-rollout behavior, but it means UUID backfill remains an operational prerequisite before broader enablement.
- I validated `backend/openapi.json` as syntactically valid JSON, but I did not run the optional OpenAPI compliance scripts in this pass.
- This review was intentionally limited to `backend` / `database` / `openapi` / tests. The branch still contains separate frontend passkey changes that deserve their own final sanity check before merge.

## Commit-Readiness Verdict

Backend passkey rollout changes are materially closer to commit-ready after the fixes above. Within the requested backend/database/OpenAPI/test scope, I do not see another high-confidence blocker; the main remaining requirement is ensuring UUID backfill assumptions are satisfied for any accounts expected to use passkeys in this rollout.

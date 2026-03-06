# Taste Map v1 - Rollout Plan (0/10/50/100)

## Scope
- Onboarding + profile UX (`/taste/onboarding`, `/taste/profile`).
- Inference recompute + hypotheses feedback loop.
- Personalized ranking explainability in discovery cards/details.
- Admin monitoring for Taste Map health (`/api/admin/metrics/taste-map`).

## Feature Flags / Envs
- Backend:
  - `TASTE_MAP_V1_ENABLED`
  - `TASTE_INFERENCE_V1_ENABLED`
  - `TASTE_MAP_RANKING_V1_ENABLED`
  - `TASTE_INFERENCE_NIGHTLY_HOUR_UTC`
- Frontend:
  - `VITE_TASTE_MAP_V1_ENABLED`

## Stage 0% (dark launch)
- Flags:
  - `TASTE_MAP_V1_ENABLED=0`
  - `TASTE_INFERENCE_V1_ENABLED=0`
  - `TASTE_MAP_RANKING_V1_ENABLED=0`
  - `VITE_TASTE_MAP_V1_ENABLED=0`
- Goals:
  - Verify migrations and API compatibility in prod infra.
  - Verify admin endpoint `/api/admin/metrics/taste-map` returns valid payload.
  - Baseline metrics and alerts stay green (no false positives).

## Stage 10% (internal + trusted beta)
- Flags:
  - `TASTE_MAP_V1_ENABLED=1`
  - `TASTE_INFERENCE_V1_ENABLED=1`
  - `TASTE_MAP_RANKING_V1_ENABLED=0`
  - `VITE_TASTE_MAP_V1_ENABLED=1` only for beta web build.
- Audience:
  - Internal team + trusted contributors.
- Exit criteria:
  - `onboarding_completion_rate >= 45%`
  - `inference_failure_rate < 5%`
  - `inference_latency_p95_ms < 2800`
  - `taste_api_error` without growth trend for 72h.

## Stage 50% (broad beta)
- Flags:
  - Keep onboarding/profile/inference on.
  - Enable ranking gradually:
    - `TASTE_MAP_RANKING_V1_ENABLED=1` for 50% shard.
- Monitoring focus:
  - Compare discovery CTR/route open and retention vs control.
  - Track drift in dismiss/confirm ratio.
  - Ensure no latency regression in `/api/cafes`.
- Exit criteria:
  - No sustained `risk` alert for 7 days.
  - No major support incidents on onboarding/profile flow.

## Stage 100% (full release)
- Flags:
  - `TASTE_MAP_V1_ENABLED=1`
  - `TASTE_INFERENCE_V1_ENABLED=1`
  - `TASTE_MAP_RANKING_V1_ENABLED=1`
  - `VITE_TASTE_MAP_V1_ENABLED=1`
- Actions:
  - Publish release notes for users/moderators.
  - Start post-release review of open questions from runbook.

## Go-live Checklist
- [ ] DB migrations applied (`000035`, `000036`, `000037`) in prod.
- [ ] Backend flags set per rollout stage.
- [ ] Frontend flag set per rollout stage.
- [ ] `/api/admin/metrics/taste-map` reachable for admin role.
- [ ] `taste_onboarding_started/completed` events visible in `product_metrics_events`.
- [ ] `taste_hypothesis_shown/confirmed/dismissed` events visible.
- [ ] `taste_profile_recomputed` events visible from inference runs.
- [ ] Alert channels configured for:
  - API errors (`taste_api_errors`)
  - inference failures (`taste_inference_failures`)
  - inference latency (`taste_inference_latency`)
- [ ] Smoke path passed:
  - registration -> onboarding -> profile -> dismiss -> discovery explainability.

## Rollback Plan (feature flags first)
1. Disable ranking only (fastest containment):
   - `TASTE_MAP_RANKING_V1_ENABLED=0`
2. Disable inference workers if failures/latency spike:
   - `TASTE_INFERENCE_V1_ENABLED=0`
3. Hide Taste Map UI if UX/API unstable:
   - `VITE_TASTE_MAP_V1_ENABLED=0`
4. Fully disable backend taste endpoints:
   - `TASTE_MAP_V1_ENABLED=0`
5. Keep metrics ingestion enabled for incident investigation.

## Operational Notes
- Rollback does not require DB rollback; schema is backward-compatible for off state.
- During incident, prefer stage rollback (100 -> 50 -> 10 -> 0) instead of hard stop when possible.
- Re-enable only after 24h stable window and alert-free trend.

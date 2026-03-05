package taste

const (
	sqlInsertOnboardingSession = `insert into public.taste_onboarding_sessions (
	user_id,
	version,
	status
) values (
	$1::uuid,
	$2::text,
	$3::text
)
returning
	id::text,
	user_id::text,
	version,
	status,
	answers_json,
	started_at,
	completed_at,
	created_at,
	updated_at`

	sqlCompleteOnboardingSession = `update public.taste_onboarding_sessions
set
	status = $3::text,
	answers_json = $4::jsonb,
	completed_at = $5::timestamptz,
	updated_at = now()
where id = $1::uuid
  and user_id = $2::uuid
  and status = 'started'
returning
	id::text,
	user_id::text,
	version,
	status,
	answers_json,
	started_at,
	completed_at,
	created_at,
	updated_at`

	sqlSelectUserTasteProfile = `select
	user_id::text,
	active_onboarding_version,
	inference_version,
	base_map_completed_at,
	last_recomputed_at,
	metadata,
	created_at,
	updated_at
from public.user_taste_profile
where user_id = $1::uuid`

	sqlUpsertUserTasteProfile = `insert into public.user_taste_profile (
	user_id,
	active_onboarding_version,
	inference_version,
	base_map_completed_at,
	last_recomputed_at,
	metadata
) values (
	$1::uuid,
	$2::text,
	$3::text,
	$4::timestamptz,
	$5::timestamptz,
	$6::jsonb
)
on conflict (user_id) do update set
	active_onboarding_version = excluded.active_onboarding_version,
	inference_version = excluded.inference_version,
	base_map_completed_at = excluded.base_map_completed_at,
	last_recomputed_at = excluded.last_recomputed_at,
	metadata = excluded.metadata,
	updated_at = now()
returning
	user_id::text,
	active_onboarding_version,
	inference_version,
	base_map_completed_at,
	last_recomputed_at,
	metadata,
	created_at,
	updated_at`

	sqlUpsertUserTasteTag = `insert into public.user_taste_tags (
	user_id,
	taste_code,
	polarity,
	score,
	confidence,
	source,
	status,
	cooldown_until,
	reason_json
) values (
	$1::uuid,
	$2::text,
	$3::text,
	$4::numeric,
	$5::numeric,
	$6::text,
	$7::text,
	$8::timestamptz,
	$9::jsonb
)
on conflict (user_id, taste_code, polarity) do update set
	score = excluded.score,
	confidence = excluded.confidence,
	source = excluded.source,
	status = excluded.status,
	cooldown_until = excluded.cooldown_until,
	reason_json = excluded.reason_json,
	updated_at = now()
returning
	id::text,
	user_id::text,
	taste_code,
	polarity,
	score::double precision,
	confidence::double precision,
	source,
	status,
	cooldown_until,
	reason_json,
	created_at,
	updated_at`

	sqlInsertTasteHypothesis = `insert into public.taste_hypotheses (
	user_id,
	taste_code,
	polarity,
	score,
	confidence,
	reason_json,
	status,
	dismiss_count,
	cooldown_until
) values (
	$1::uuid,
	$2::text,
	$3::text,
	$4::numeric,
	$5::numeric,
	$6::jsonb,
	$7::text,
	$8::int,
	$9::timestamptz
)
returning
	id::text,
	user_id::text,
	taste_code,
	polarity,
	score::double precision,
	confidence::double precision,
	reason_json,
	status,
	dismiss_count,
	cooldown_until,
	created_at,
	updated_at`

	sqlUpdateTasteHypothesisStatus = `update public.taste_hypotheses
set
	status = $3::text,
	dismiss_count = $4::int,
	cooldown_until = $5::timestamptz,
	reason_json = $6::jsonb,
	updated_at = now()
where id = $1::uuid
  and user_id = $2::uuid
returning
	id::text,
	user_id::text,
	taste_code,
	polarity,
	score::double precision,
	confidence::double precision,
	reason_json,
	status,
	dismiss_count,
	cooldown_until,
	created_at,
	updated_at`

	sqlInsertInferenceRun = `insert into public.taste_inference_runs (
	user_id,
	trigger,
	version,
	input_snapshot_json,
	output_snapshot_json,
	changed_tags_count,
	duration_ms,
	status,
	error_text
) values (
	$1::uuid,
	$2::text,
	$3::text,
	$4::jsonb,
	$5::jsonb,
	$6::int,
	$7::int,
	$8::text,
	$9::text
)
returning
	id::text,
	user_id::text,
	trigger,
	version,
	input_snapshot_json,
	output_snapshot_json,
	changed_tags_count,
	duration_ms,
	status,
	error_text,
	created_at`

	sqlSelectActiveUserTasteTagsJSON = `select coalesce(
	jsonb_agg(
		jsonb_build_object(
			'id', id::text,
			'user_id', user_id::text,
			'taste_code', taste_code,
			'polarity', polarity,
			'score', score::double precision,
			'confidence', confidence::double precision,
			'source', source,
			'status', status,
			'cooldown_until', cooldown_until,
			'reason_json', reason_json,
			'created_at', created_at,
			'updated_at', updated_at
		)
		order by confidence desc, updated_at desc
	),
	'[]'::jsonb
)
from public.user_taste_tags
where user_id = $1::uuid
  and status = 'active'`

	sqlSelectActionableTasteHypothesesJSON = `select coalesce(
	jsonb_agg(
		jsonb_build_object(
			'id', id::text,
			'user_id', user_id::text,
			'taste_code', taste_code,
			'polarity', polarity,
			'score', score::double precision,
			'confidence', confidence::double precision,
			'reason_json', reason_json,
			'status', status,
			'dismiss_count', dismiss_count,
			'cooldown_until', cooldown_until,
			'created_at', created_at,
			'updated_at', updated_at
		)
		order by updated_at desc
	),
	'[]'::jsonb
)
from public.taste_hypotheses
where user_id = $1::uuid
  and status = 'new'
  and (cooldown_until is null or cooldown_until <= now())`

	sqlSelectTasteHypothesisByID = `select
	id::text,
	user_id::text,
	taste_code,
	polarity,
	score::double precision,
	confidence::double precision,
	reason_json,
	status,
	dismiss_count,
	cooldown_until,
	created_at,
	updated_at
from public.taste_hypotheses
where id = $1::uuid
  and user_id = $2::uuid`
)

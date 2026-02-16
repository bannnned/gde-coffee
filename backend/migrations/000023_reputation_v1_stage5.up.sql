-- Backfill reputation_events so historical actions participate in v1 reputation.
-- ON CONFLICT keeps migration idempotent and safe for repeated deploys.

insert into public.reputation_events (user_id, event_type, points, source_type, source_id, metadata, created_at)
select
	r.user_id,
	'helpful_received',
	greatest(1, round(2.0 * hv.weight)::int),
	'helpful_vote',
	hv.id::text,
	jsonb_build_object('weight', hv.weight),
	hv.created_at
from public.helpful_votes hv
join public.reviews r on r.id = hv.review_id
on conflict (user_id, event_type, source_type, source_id) do nothing;

insert into public.reputation_events (user_id, event_type, points, source_type, source_id, metadata, created_at)
select
	vv.user_id,
	'visit_verified',
	case
		when vv.confidence = 'low' then 1
		when vv.confidence in ('medium', 'high') then 3
		else 0
	end,
	'visit_verification',
	vv.id::text,
	jsonb_build_object(
		'confidence', vv.confidence,
		'dwell_seconds', vv.dwell_seconds
	),
	coalesce(vv.verified_at, vv.updated_at, vv.created_at)
from public.visit_verifications vv
where vv.confidence in ('low', 'medium', 'high')
on conflict (user_id, event_type, source_type, source_id) do nothing;

insert into public.reputation_events (user_id, event_type, points, source_type, source_id, metadata, created_at)
select
	r.user_id,
	'abuse_confirmed',
	-25,
	'abuse_report',
	ar.id::text,
	jsonb_build_object('reason', ar.reason),
	coalesce(ar.confirmed_at, ar.updated_at, ar.created_at)
from public.abuse_reports ar
join public.reviews r on r.id = ar.review_id
where ar.status = 'confirmed'
on conflict (user_id, event_type, source_type, source_id) do nothing;

insert into public.reputation_events (user_id, event_type, points, source_type, source_id, metadata, created_at)
select
	ms.author_user_id,
	case
		when ms.entity_type = 'cafe' and ms.action_type = 'create' then 'cafe_create_approved'
		else 'data_update_approved'
	end,
	case
		when ms.entity_type = 'cafe' and ms.action_type = 'create' then 8
		else 4
	end,
	'moderation_submission',
	ms.id::text,
	jsonb_build_object(
		'entity_type', ms.entity_type,
		'action_type', ms.action_type,
		'target_id', ms.target_id
	),
	coalesce(ms.decided_at, ms.updated_at, ms.created_at)
from public.moderation_submissions ms
where ms.status = 'approved'
  and (
	(ms.entity_type = 'cafe' and ms.action_type = 'create')
	or ms.entity_type in ('cafe_description', 'cafe_photo', 'menu_photo')
  )
on conflict (user_id, event_type, source_type, source_id) do nothing;

insert into public.reputation_events (user_id, event_type, points, source_type, source_id, metadata, created_at)
select
	r.user_id,
	'review_removed_violation',
	-15,
	'review_moderation',
	r.id::text,
	jsonb_build_object('reason', 'abuse_backfill'),
	coalesce(max(ar.confirmed_at), r.updated_at, r.created_at)
from public.reviews r
join public.abuse_reports ar on ar.review_id = r.id and ar.status = 'confirmed'
where r.status = 'removed'
group by r.id, r.user_id, r.updated_at, r.created_at
on conflict (user_id, event_type, source_type, source_id) do nothing;

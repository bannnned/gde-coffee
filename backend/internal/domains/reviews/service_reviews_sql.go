package reviews

import "time"

const (
	minReviewSummaryLength = 60
	defaultReviewListLimit = 20

	sqlCheckCafeExists    = `select exists(select 1 from cafes where id = $1::uuid)`
	sqlSelectDrinkByID    = `select id, name from drinks where id = $1 and is_active = true`
	sqlSelectDrinkByAlias = `select id, name
   from drinks
  where is_active = true
    and (
      name = $1
      or $1 = any(aliases)
    )
  order by popularity_rank asc, name asc
  limit 1`
	sqlUpsertUnknownDrinkFormat = `insert into drink_unknown_formats (
	name,
	mentions_count,
	first_seen_at,
	last_seen_at,
	last_user_id,
	status,
	updated_at
)
values ($1, 1, now(), now(), $2::uuid, 'new', now())
on conflict (name)
do update set
	mentions_count = drink_unknown_formats.mentions_count + 1,
	last_seen_at = now(),
	last_user_id = excluded.last_user_id,
	status = case
		when drink_unknown_formats.status = 'ignored' then 'new'
		else drink_unknown_formats.status
	end,
	updated_at = now()`

	sqlSelectReviewByUserCafeForUpdate = `select id::text, status
   from reviews
  where user_id = $1::uuid and cafe_id = $2::uuid
  for update`

	sqlInsertReview = `insert into reviews (user_id, cafe_id, rating, summary, status)
 values ($1::uuid, $2::uuid, $3, $4, 'published')
 returning id::text, updated_at`

	sqlSelectReviewForUpdateByID = `select
	r.id::text,
	r.user_id::text,
	r.cafe_id::text,
	r.rating,
	r.summary,
	coalesce(ra.drink_id, '') as drink_id,
	coalesce(ra.drink_name, '') as drink_name,
	coalesce(ra.taste_tags, '{}'::text[])
from reviews r
left join review_attributes ra on ra.review_id = r.id
where r.id = $1::uuid and r.status = 'published'
for update`

	sqlUpdateReview = `update reviews
    set rating = $2,
        summary = $3,
        status = 'published',
        updated_at = now()
  where id = $1::uuid
  returning updated_at`

	sqlUpsertReviewAttributes = `insert into review_attributes (
	review_id,
	drink_id,
	drink_name,
	taste_tags,
	summary_length,
	summary_fingerprint,
	photo_count
)
values ($1::uuid, $2, $3, $4::text[], $5, $6, $7)
on conflict (review_id)
do update set
	drink_id = excluded.drink_id,
	drink_name = excluded.drink_name,
	taste_tags = excluded.taste_tags,
	summary_length = excluded.summary_length,
	summary_fingerprint = excluded.summary_fingerprint,
	photo_count = excluded.photo_count,
	updated_at = now()`

	sqlDeleteReviewPhotos = `delete from review_photos where review_id = $1::uuid`

	sqlInsertReviewPhoto = `insert into review_photos (review_id, photo_url, position)
 values ($1::uuid, $2, $3)`

	sqlSelectReviewPhotos = `select photo_url
   from review_photos
  where review_id = $1::uuid
  order by position asc`

	sqlExistsDuplicateSummary = `select exists(
	select 1
	  from review_attributes ra
	  join reviews r on r.id = ra.review_id
	 where r.user_id = $1::uuid
	   and r.status = 'published'
	   and ra.summary_fingerprint = $2
	   and ($3 = '' or r.id <> $3::uuid)
)`
)

const sqlListCafeReviewsBase = `select
	r.id::text,
	r.user_id::text,
	coalesce(nullif(trim(u.display_name), ''), 'Участник') as author_name,
	r.rating,
	r.summary,
	coalesce(nullif(ra.drink_id, ''), coalesce(ra.drink_name, '')) as drink_id,
	coalesce(nullif(trim(d.name), ''), coalesce(nullif(ra.drink_name, ''), coalesce(ra.drink_id, ''))) as drink_name,
	coalesce(ra.taste_tags, '{}'::text[]) as taste_tags,
	coalesce(ra.photo_count, 0) as photo_count,
	coalesce(hs.helpful_votes, 0) as helpful_votes,
	coalesce(hs.helpful_score, 0)::float8 as helpful_score,
	coalesce(vv.confidence, 'none') as visit_confidence,
	coalesce(vv.verified_at is not null and vv.confidence in ('low', 'medium', 'high'), false) as visit_verified,
	coalesce((
		select count(*)
		  from abuse_reports ar
		 where ar.review_id = r.id and ar.status = 'confirmed'
	), 0) as confirmed_reports,
	r.created_at,
	r.updated_at,
	coalesce((
		select array_agg(rp.photo_url order by rp.position asc)
		  from review_photos rp
		 where rp.review_id = r.id
	), '{}'::text[]) as photos
from reviews r
join users u on u.id = r.user_id
left join review_attributes ra on ra.review_id = r.id
left join drinks d on d.id = ra.drink_id
left join visit_verifications vv on vv.review_id = r.id
left join lateral (
	select
		count(*) as helpful_votes,
		coalesce(sum(hv.weight), 0) as helpful_score
	  from helpful_votes hv
	 where hv.review_id = r.id
) hs on true
where r.cafe_id = $1::uuid
  and r.status = 'published'
`

var reviewSortOrderClause = map[string]string{
	"new":      "order by r.created_at desc, r.id desc",
	"helpful":  "order by hs.helpful_score desc, hs.helpful_votes desc, r.created_at desc, r.id desc",
	"verified": "order by visit_verified desc, hs.helpful_score desc, hs.helpful_votes desc, r.created_at desc, r.id desc",
}

type cafeReviewState struct {
	ReviewID   string
	UserID     string
	CafeID     string
	Rating     int
	Summary    string
	DrinkID    string
	DrinkName  string
	TasteTags  []string
	Photos     []string
	UpdatedAt  time.Time
	CreatedAt  time.Time
	Status     string
	HasReview  bool
	PhotoCount int
}

type resolvedDrink struct {
	ID   string
	Name string
}

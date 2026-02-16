delete from public.reputation_events
where (event_type = 'helpful_received' and source_type = 'helpful_vote')
   or (event_type = 'visit_verified' and source_type = 'visit_verification')
   or (event_type = 'abuse_confirmed' and source_type = 'abuse_report')
   or (event_type = 'data_update_approved' and source_type = 'moderation_submission')
   or (event_type = 'cafe_create_approved' and source_type = 'moderation_submission')
   or (event_type = 'review_removed_violation' and source_type = 'review_moderation');

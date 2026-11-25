alter table public.asi_video_event_tags
 add column if not exists detection_provider text,
 add column if not exists detection_model_version text,
 add column if not exists detection_confidence numeric,
 add column if not exists detection_metadata jsonb not null default '{}'::jsonb;
alter table public.asi_video_event_tags drop constraint if exists asi_video_event_detection_confidence_check;
alter table public.asi_video_event_tags add constraint asi_video_event_detection_confidence_check check(detection_confidence is null or(detection_confidence>=0 and detection_confidence<=1));
alter table public.asi_video_event_tags drop constraint if exists asi_video_event_detection_metadata_check;
alter table public.asi_video_event_tags add constraint asi_video_event_detection_metadata_check check(jsonb_typeof(detection_metadata)='object');
create index if not exists asi_model_reviews_model_version_idx on public.asi_model_reviews(model_version_id);
create index if not exists asi_video_event_detection_provider_idx on public.asi_video_event_tags(detection_provider) where detection_provider is not null;

-- Schedule cron job to fetch locations for ongoing trips every 15 minutes
SELECT cron.schedule(
  'fetch-ongoing-trip-locations',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ofjgwusjzgjkfwumzwwy.supabase.co/functions/v1/start-trip/fetch-all-locations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mamd3dXNqemdqa2Z3dW16d3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NzAwMDMsImV4cCI6MjA4MjE0NjAwM30.GAOnSnMS0IwvSZu0kbt9VKaNYVC8xhTRs65mxWdqTQc"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
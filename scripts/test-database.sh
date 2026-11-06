#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="saboia-db-test-$$"
cleanup() { docker rm -f "$container" >/dev/null; }
trap cleanup EXIT
docker run --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
cat tests/db-bootstrap.sql supabase/migrations/*.sql | docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/request-reminders.sql

# Fenomen LMS and trial ENT

FastAPI/PostgreSQL backend and Next.js frontend. Development and production use
separate Compose files and separate environment files.

## Development

Copy `.env.example` to `.env`, configure local credentials, then:

```sh
docker compose up --build -d
```

Frontend: http://localhost:3001. API: http://localhost:8000. Existing volumes are
not disposable: never use `down -v` unless their data is intentionally expendable.

## Production

Follow [production runbook](docs/production.md). Use only the standalone
`docker-compose.production.yml`, with `.env.production` created privately on the
server. It exposes 80/443, obtains HTTPS, isolates DB/API ports and does not pass
backend secrets to frontend. Images and production Python dependencies are
pinned. Review and update pinned versions deliberately with audit/build/tests.

## Verification

```sh
# In backend/ with installed dependencies and a disposable PostgreSQL:
python -m unittest tests.test_ent_rules tests.test_quiz_docx -v
python -m unittest tests.test_ent_integration tests.test_ent_seed -v
RUN_RELEASE_TESTS=1 python -m unittest tests.test_release -v
```

ReleaseTests require DATABASE_URL pointing to the hostname `auditdb` and create
an isolated schema per case. They must not run on the real application database.
Use a dedicated disposable PostgreSQL container and read-only source mount.
Frontend `pnpm build` includes the TypeScript check; `pnpm audit --prod` checks
the pnpm lockfile actually used by Docker.

See [release fixes](docs/release-fixes.md) for the audit findings and validation
boundaries, and [ENT rules](docs/ent-rules.md) for scoring and browser telemetry.

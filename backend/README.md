# ARCHFORGE backend

Node 22 + TypeScript + Express API for the ArchForge workspace foundation. Supabase Auth is the only authentication system; the service role key is server-only.

## Development

```sh
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

The API is available at `http://localhost:4000/api/v1`. Run `pnpm test`, `pnpm typecheck`, and `pnpm build` before deployment. Configure the Supabase project URL and keys in `.env`; apply `supabase/migrations/0001_foundation.sql` through `supabase/migrations/0005_platform_operations.sql` to the Supabase project.

## Architecture engine

Architecture versions, normalized nodes and edges, snapshots, and timeline events are exposed under `/api/v1/projects/:projectId/architecture`. Published versions and their child records are immutable. Duplicate, restore, comparison, snapshot, and explanation endpoints preserve project authorization through the existing project membership middleware.

AI integration is provider-agnostic through `AIProvider`. `ArchitectureGeneratorService` always validates provider output with the generated architecture Zod schema; no random AI prose is parsed. Supply a concrete provider at composition time for generation or explanations. Unit tests use mocked providers and never call an external AI API.

Repository intelligence accepts GitHub URLs through `RepositoryProvider`; GitLab and Bitbucket can be added as adapters. Analysis excludes `.env*`, credentials, private keys, tokens, `.git`, `node_modules`, `dist`, `build`, and coverage files. The normalized analysis records detected technologies, code structure, APIs, authentication, infrastructure, dependencies, health metrics, and commit SHA. Dependency graphs expose fan-in, fan-out, and cycle candidates. Drift scoring is deterministic: `score = max(0, round(100 - (driftItems / max(1, expectedNodes + expectedEdges)) * 100))`; AI may explain findings but cannot change the score. Private GitHub access accepts only a credential reference; inject a server-side secret-manager resolver into `GitHubRepositoryProvider`, never a raw token or OAuth secret.

Long-running analysis is represented by `repository-analysis`, `dependency-analysis`, and `drift-analysis` BullMQ queues. `createRepositoryAnalysisWorker()` provides the worker boundary; the database analysis status remains the source of truth for queued, running, completed, and failed states.

## Engineering intelligence

The playground endpoints live at `/api/v1/projects/:projectId/playground`. Simulation and impact analysis operate on JSON projections and never modify an architecture version. Only `/playground/:simulationId/apply` creates a new version and graph; the base version remains historical. Metrics are labeled estimated, heuristic, and simulation-based.

Documentation is version-linked at `/documentation`; generated documents become outdated after a newer architecture version is created, while manually edited documents are protected from silent regeneration. `/design-review` returns findings with component evidence, `/story` provides a structured project narrative, and `/insights` aggregates architecture, repository, drift, documentation, and simulation health.

The `ai_runs` table tracks generation lifecycle, operation, latency, and non-sensitive metadata. BullMQ queues are available for AI generation, documentation generation, design review, and story generation; Supabase Realtime publishes playground and AI-run state changes for frontend progress displays.

## Production operations

`/health` is a liveness endpoint with database and Redis component status; `/ready` returns `503` until both dependencies respond. Exports run through `export-generation`, upload to private `project-exports`, and return signed URLs only after project authorization. `project-assets` and `avatars` are private by default. OpenAPI is available at `/api/docs`. The Dockerfile uses a Node 22 multi-stage build and `docker-compose.yml` runs the backend with Redis and PostgreSQL for local integration work. `pnpm db:migrate` applies every numbered migration transactionally and records applied versions in `schema_migrations`.

OAuth providers are prepared in Supabase Auth configuration. Password reset and verification email flows remain owned by Supabase Auth and the frontend.
# vrunner

Local branch runner for Docker Compose app demos.

`vrunner` watches configured app repositories, lists their remote branches, and lets you launch, pause, resume, or stop a branch-specific Compose instance. Running branches keep their assigned ports and are relaunched when the remote branch moves.

## Quick Start

Use Node.js 24 or newer and npm 11.12.1, matching the vecs repo toolchain.

```sh
npm install
npm start
```

Then open `http://127.0.0.1:5050`.

## Config

Edit `config.json` to add apps. Each app points at a git repository and a Compose file inside that repository.

The default config launches the `vecs` demo from `git@github.com:vworlds/vecs.git` using `ci/docker-compose.yaml`.

Ports are assigned from the configured pools and injected as environment variables into a generated `.env` file per running branch.

## Commands

```sh
npm run dev       # TypeScript dev server with hot reload
npm run dev:web   # Vite dev server for the frontend (proxy to backend on :5050)
npm run build     # Build the Vue frontend and compile the backend
npm run lint      # ESLint
npm run test      # Vitest
npm run typecheck # vue-tsc and tsc
npm run serve     # Run the compiled server without rebuilding
```

The frontend is a Vue 3 + naive-ui single-page app. Source lives in `web/`, Vite builds it to `dist/public/`, and Express serves that directory. Run `npm run dev:web` alongside `npm run dev` for frontend hot module replacement during development.

Runtime data lives in `./data/` and is ignored by git.

# vrunner

Local branch runner for Docker Compose app demos.

`vrunner` watches configured app repositories, lists their remote branches, and lets you launch, pause, resume, or stop a branch-specific Compose instance. Running branches keep their assigned ports and are relaunched when the remote branch moves.

## Quick Start

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
npm run dev     # TypeScript dev server, rebuilds browser TS first
npm run build   # Compile backend TS and browser TS
npm run serve   # Run the compiled server without rebuilding
```

Runtime data lives in `./data/` and is ignored by git.

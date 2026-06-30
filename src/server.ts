import express, { type Request } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { Runtime } from "./runtime.js";
import { StateStore } from "./state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = await loadConfig();
const stateStore = new StateStore(config.dataDir);
await stateStore.load();

const runtime = new Runtime(config, stateStore);
await runtime.start();

const app = express();
app.use(express.json());
app.use(
  "/vendor/fontawesome",
  express.static(path.join(__dirname, "..", "node_modules", "@fortawesome", "fontawesome-free"))
);
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/apps", (_req, res) => {
  res.json(runtime.snapshot());
});

app.post("/api/refresh", async (_req, res, next) => {
  try {
    await runtime.refreshBranches({ restartRunning: true });
    res.json(runtime.snapshot());
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/launch", async (req, res, next) => {
  try {
    const result = await runtime.launch(req.params.appId, requireBranch(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/pause", async (req, res, next) => {
  try {
    const result = await runtime.pause(req.params.appId, requireBranch(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/resume", async (req, res, next) => {
  try {
    const result = await runtime.resume(req.params.appId, requireBranch(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/apps/:appId/shutdown", async (req, res, next) => {
  try {
    const result = await runtime.shutdown(req.params.appId, requireBranch(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/apps/:appId/logs", async (req, res, next) => {
  try {
    const branch = req.query.branch;
    if (!branch || typeof branch !== "string") {
      throw new Error("branch query parameter is required");
    }
    const logs = await runtime.logs(req.params.appId, branch);
    res.type("text/plain").send(logs);
  } catch (error) {
    next(error);
  }
});

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
);

app.listen(config.server.port, config.server.host, () => {
  console.log(`vrunner listening on http://${config.server.host}:${config.server.port}`);
});

function requireBranch(req: Request): string {
  const branch = req.body?.branch;
  if (!branch || typeof branch !== "string") {
    throw new Error("request body must include branch");
  }
  return branch;
}

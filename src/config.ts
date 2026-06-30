import { readFile } from "node:fs/promises";
import path from "node:path";

export type PortProtocol = "tcp" | "udp";

export interface PortPool {
  start: number;
  end: number;
}

export interface AppPortConfig {
  env: string;
  protocol: PortProtocol;
  url?: boolean;
}

export interface AppConfig {
  id: string;
  name: string;
  repo: string;
  composeFile: string;
  env: Record<string, string>;
  ports: AppPortConfig[];
  urlProtocol: string;
}

export interface VRunnerConfig {
  configPath: string;
  dataDir: string;
  server: {
    host: string;
    port: number;
    publicHost: string;
  };
  poll: {
    intervalSeconds: number;
  };
  ports: Record<PortProtocol, PortPool>;
  apps: AppConfig[];
}

interface RawAppPortConfig {
  env?: string;
  protocol?: PortProtocol;
  url?: boolean;
}

interface RawAppConfig {
  id?: string;
  name?: string;
  repo?: string;
  composeFile?: string;
  env?: Record<string, string>;
  ports?: RawAppPortConfig[];
  urlProtocol?: string;
}

interface RawConfig {
  dataDir?: string;
  server?: Partial<VRunnerConfig["server"]>;
  poll?: Partial<VRunnerConfig["poll"]>;
  ports?: Partial<Record<PortProtocol, Partial<PortPool>>>;
  apps?: RawAppConfig[];
}

export async function loadConfig(): Promise<VRunnerConfig> {
  const configPath = path.resolve(process.env.VRUNNER_CONFIG ?? "config.json");
  const raw = JSON.parse(await readFile(configPath, "utf8")) as RawConfig;
  const rawApps = raw.apps;

  if (!Array.isArray(rawApps) || rawApps.length === 0) {
    throw new Error("config.json must define at least one app in apps[]");
  }

  const ids = new Set<string>();
  const apps = rawApps.map((rawApp): AppConfig => {
    if (!rawApp.id || !/^[a-zA-Z0-9_-]+$/.test(rawApp.id)) {
      throw new Error("each app needs an id containing only letters, numbers, _ or -");
    }
    if (ids.has(rawApp.id)) {
      throw new Error(`duplicate app id: ${rawApp.id}`);
    }
    ids.add(rawApp.id);
    if (!rawApp.repo) {
      throw new Error(`app ${rawApp.id} needs repo`);
    }
    if (!rawApp.composeFile) {
      throw new Error(`app ${rawApp.id} needs composeFile`);
    }
    if (!Array.isArray(rawApp.ports) || rawApp.ports.length === 0) {
      throw new Error(`app ${rawApp.id} needs ports[]`);
    }

    const env = rawApp.env ?? {};
    const ports = rawApp.ports.map((port): AppPortConfig => {
      if (!port.env) {
        throw new Error(`app ${rawApp.id} has a port without env`);
      }
      const protocol = port.protocol ?? "tcp";
      if (!["tcp", "udp"].includes(protocol)) {
        throw new Error(`app ${rawApp.id} port ${port.env} has invalid protocol`);
      }
      return { env: port.env, protocol, url: port.url };
    });

    return {
      id: rawApp.id,
      name: rawApp.name ?? rawApp.id,
      repo: rawApp.repo,
      composeFile: rawApp.composeFile,
      env,
      ports,
      urlProtocol: rawApp.urlProtocol ?? env.VECS_PROTOCOL ?? "http",
    };
  });

  return {
    configPath,
    dataDir: path.resolve(raw.dataDir ?? "data"),
    server: {
      host: "127.0.0.1",
      port: 5050,
      publicHost: "localhost",
      ...(raw.server ?? {}),
    },
    poll: {
      intervalSeconds: 45,
      ...(raw.poll ?? {}),
    },
    ports: {
      tcp: { start: 18000, end: 18999, ...(raw.ports?.tcp ?? {}) },
      udp: { start: 19000, end: 19999, ...(raw.ports?.udp ?? {}) },
    },
    apps,
  };
}

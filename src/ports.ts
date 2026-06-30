import type { AppConfig, PortProtocol, VRunnerConfig } from "./config.js";
import type { StateStore } from "./state.js";

export class PortAllocator {
  constructor(
    private readonly config: VRunnerConfig,
    private readonly stateStore: StateStore
  ) {}

  allocate(app: AppConfig): Record<string, number> {
    const used = this.usedPorts();
    const allocations: Record<string, number> = {};

    for (const request of app.ports) {
      const protocol = request.protocol;
      const pool = this.config.ports[protocol];

      let selected: number | undefined;
      for (let port = pool.start; port <= pool.end; port += 1) {
        if (!used[protocol].has(port)) {
          selected = port;
          used[protocol].add(port);
          break;
        }
      }

      if (!selected) {
        throw new Error(`no free ${protocol} ports left in ${pool.start}-${pool.end}`);
      }

      allocations[request.env] = selected;
    }

    return allocations;
  }

  private usedPorts(): Record<PortProtocol, Set<number>> {
    const used: Record<PortProtocol, Set<number>> = { tcp: new Set(), udp: new Set() };

    for (const instance of Object.values(this.stateStore.instances)) {
      for (const [envName, port] of Object.entries(instance.ports)) {
        const request = this.findPortRequest(instance.appId, envName);
        const protocol = request?.protocol ?? "tcp";
        used[protocol].add(port);
      }
    }

    return used;
  }

  private findPortRequest(appId: string, envName: string) {
    const app = this.config.apps.find((candidate) => candidate.id === appId);
    return app?.ports.find((port) => port.env === envName);
  }
}

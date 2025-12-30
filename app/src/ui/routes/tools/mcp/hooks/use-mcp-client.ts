import { McpClient, type McpClientConfig } from "jsonv-ts/mcp";
import { useBknd } from "ui/client/bknd";

const clients = new Map<string, McpClient>();

export function getClient(opts: McpClientConfig) {
   if (!clients.has(JSON.stringify(opts))) {
      clients.set(JSON.stringify(opts), new McpClient(opts));
   }
   return clients.get(JSON.stringify(opts))!;
}

export function useMcpClient() {
   const { config } = useBknd();
   return getClient({ url: window.location.origin + config.server.mcp.path });
}

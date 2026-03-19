import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface MCPConfig {
  serverUrl: string;
  name: string;
}

export class MCPManager {
  private clients: Map<string, Client> = new Map();

  async connect(config: MCPConfig) {
    const transport = new SSEClientTransport(new URL(config.serverUrl));
    const client = new Client(
      { name: "AuraIDE-Client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    
    this.clients.set(config.name, client);
    return client;
  }

  async listTools(clientName: string) {
    const client = this.clients.get(clientName);
    if (!client) throw new Error("Client not found");
    return await client.listTools();
  }

  async callTool(clientName: string, toolName: string, args: any) {
    const client = this.clients.get(clientName);
    if (!client) throw new Error("Client not found");
    return await client.callTool({ name: toolName, arguments: args });
  }
}

export const mcpManager = new MCPManager();

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { Command, Child } from "@tauri-apps/plugin-shell";

export interface MCPConfig {
  serverUrl: string; // Used for SSE URL or STDIO Command
  name: string;
  type: 'sse' | 'stdio';
  env?: Record<string, string>;
}

export class TauriStdioTransport implements Transport {
  private child?: Child;
  private commandStr: string;
  private env?: Record<string, string>;
  private buffer: string = '';

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onlog?: (log: string) => void;

  constructor(commandStr: string, env?: Record<string, string>) {
    this.commandStr = commandStr;
    this.env = env;
  }

  async start(): Promise<void> {
    const isWindows = navigator.platform.toLowerCase().includes('win');
    let cmdArgs = [this.commandStr];
    let cmdName = 'cmd';

    if (isWindows) {
      cmdArgs = ['/c', this.commandStr];
    } else {
      cmdName = 'sh';
      cmdArgs = ['-c', this.commandStr];
    }

    // Command.create requires the capability defined in your default.json
    // We expect 'cmd' and 'sh' to be allowed
    const command = Command.create(cmdName, cmdArgs, { env: this.env });
    
    command.on('close', () => {
      this.onlog?.(`[Process Closed]`);
      this.onclose?.()
    });
    command.on('error', err => {
      this.onlog?.(`[Process Error] ${err}`);
      this.onerror?.(new Error(err))
    });

    command.stdout.on('data', line => {
      this.buffer += line;
      let newlines = this.buffer.split('\n');
      this.buffer = newlines.pop() || '';
      for (const completeLine of newlines) {
        const trimmed = completeLine.trim();
        if (!trimmed) continue;
        try {
          const message = JSON.parse(trimmed) as JSONRPCMessage;
          this.onmessage?.(message);
        } catch (e) {
          console.warn("[MCP Transport Parse Error]", e, trimmed);
        }
      }
    });

    command.stderr.on('data', line => {
      console.log(`[MCP ${this.commandStr}] STDERR:`, line);
      this.onlog?.(line);
    });

    this.child = await command.spawn();
    this.onlog?.(`[Process Spawned] PID: ${this.child.pid}`);
  }

  async close(): Promise<void> {
    if (this.child) {
      await this.child.kill();
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.child) throw new Error("Transport not started");
    const jsonStr = JSON.stringify(message) + '\n';
    await this.child.write(jsonStr);
  }
}

export class MCPManager {
  private clients: Map<string, { client: Client, tools: any[], logs: string[] }> = new Map();

  async connect(config: MCPConfig) {
    let transport: Transport;
    const sessionLogs: string[] = [];
    
    if (config.type === 'stdio') {
      const stdioTransport = new TauriStdioTransport(config.serverUrl, config.env);
      stdioTransport.onlog = (log) => {
        sessionLogs.push(log);
        // keep only last 1000 lines
        if (sessionLogs.length > 1000) sessionLogs.shift();
      };
      transport = stdioTransport;
    } else {
      transport = new SSEClientTransport(new URL(config.serverUrl));
    }

    const client = new Client(
      { name: "AuraIDE-Client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    
    // Auto-fetch tools after connecting
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools || [];
    
    this.clients.set(config.name, { client, tools, logs: sessionLogs });
    return tools;
  }

  getTools(clientName: string) {
    const session = this.clients.get(clientName);
    return session ? session.tools : [];
  }

  getLogs(clientName: string): string[] {
    const session = this.clients.get(clientName);
    return session ? session.logs : [];
  }

  async callTool(clientName: string, toolName: string, args: any) {
    const session = this.clients.get(clientName);
    if (!session?.client) throw new Error("Client not found");
    return await session.client.callTool({ name: toolName, arguments: args });
  }
}

export const mcpManager = new MCPManager();

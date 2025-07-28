import type { WebSocket } from 'ws';
import type { ContainerSession, Message, SessionStats } from './types.js';

/**
 * SessionManager handles WebSocket connections organized by container ID.
 * Supports multiple clients watching the same container with broadcast functionality.
 */
export class SessionManager {
  private connections: Map<string, Set<WebSocket>>;
  private connectionMetadata: Map<
    WebSocket,
    { containerID: string; clientID: string; connectedAt: Date }
  >;

  constructor() {
    this.connections = new Map();
    this.connectionMetadata = new Map();
  }

  /**
   * Add a WebSocket connection for a specific container
   */
  addConnection(containerID: string, ws: WebSocket, clientID?: string): void {
    if (!this.connections.has(containerID)) {
      this.connections.set(containerID, new Set());
    }

    const containerConnections = this.connections.get(containerID);
    if (!containerConnections) {
      throw new Error(`Container ${containerID} not found in connections map`);
    }
    containerConnections.add(ws);

    this.connectionMetadata.set(ws, {
      containerID,
      clientID: clientID || this.generateClientID(),
      connectedAt: new Date(),
    });

    ws.on('close', () => {
      this.removeConnection(ws);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for container ${containerID}:`, error);
      this.removeConnection(ws);
    });

    console.log(
      `Added connection for container ${containerID}. Total connections: ${containerConnections.size}`
    );
  }

  /**
   * Remove a WebSocket connection and clean up
   */
  removeConnection(ws: WebSocket): void {
    const metadata = this.connectionMetadata.get(ws);
    if (!metadata) {
      return;
    }

    const { containerID } = metadata;
    const containerConnections = this.connections.get(containerID);

    if (containerConnections) {
      containerConnections.delete(ws);

      if (containerConnections.size === 0) {
        this.connections.delete(containerID);
        console.log(`Removed container ${containerID} (no more connections)`);
      } else {
        console.log(
          `Removed connection from container ${containerID}. Remaining: ${containerConnections.size}`
        );
      }
    }

    this.connectionMetadata.delete(ws);
  }

  /**
   * Broadcast a message to all connections watching a specific container
   */
  broadcast(containerID: string, message: Message): void {
    const containerConnections = this.connections.get(containerID);
    if (!containerConnections || containerConnections.size === 0) {
      return;
    }

    const messageString = JSON.stringify(message);
    const deadConnections: WebSocket[] = [];

    for (const ws of containerConnections) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(messageString);
        } catch (error) {
          console.error(`Failed to send message to connection:`, error);
          deadConnections.push(ws);
        }
      } else {
        deadConnections.push(ws);
      }
    }

    for (const ws of deadConnections) {
      this.removeConnection(ws);
    }

    console.log(
      `Broadcasted message to ${containerConnections.size - deadConnections.length} connections for container ${containerID}`
    );
  }

  /**
   * Get all active container IDs that have connections
   */
  getActiveContainers(): string[] {
    return Array.from(this.connections.keys()).filter((containerID) => {
      const connections = this.connections.get(containerID);
      return connections && connections.size > 0;
    });
  }

  /**
   * Get the number of connections for a specific container
   */
  getConnectionCount(containerID: string): number {
    const connections = this.connections.get(containerID);
    return connections ? connections.size : 0;
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const connectionsPerContainer: Record<string, number> = {};
    let totalConnections = 0;

    for (const [containerID, connections] of this.connections) {
      const count = connections.size;
      connectionsPerContainer[containerID] = count;
      totalConnections += count;
    }

    return {
      totalConnections,
      activeContainers: this.connections.size,
      connectionsPerContainer,
    };
  }

  /**
   * Get detailed information about container sessions
   */
  getContainerSessions(): ContainerSession[] {
    const sessions: ContainerSession[] = [];

    for (const [containerID, connections] of this.connections) {
      if (connections.size > 0) {
        let earliestConnection = new Date();
        let latestActivity = new Date(0);

        for (const ws of connections) {
          const metadata = this.connectionMetadata.get(ws);
          if (metadata) {
            if (metadata.connectedAt < earliestConnection) {
              earliestConnection = metadata.connectedAt;
            }
            if (metadata.connectedAt > latestActivity) {
              latestActivity = metadata.connectedAt;
            }
          }
        }

        sessions.push({
          containerID,
          connections: new Set(connections),
          createdAt: earliestConnection,
          lastActivity: latestActivity,
        });
      }
    }

    return sessions;
  }

  /**
   * Close all connections for a specific container
   */
  closeContainer(containerID: string): void {
    const containerConnections = this.connections.get(containerID);
    if (!containerConnections) {
      return;
    }

    for (const ws of containerConnections) {
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Container session ended');
      }
    }

    this.connections.delete(containerID);
    console.log(`Closed all connections for container ${containerID}`);
  }

  /**
   * Close all connections and clean up
   */
  shutdown(): void {
    console.log('SessionManager shutting down...');

    for (const [_, connections] of this.connections) {
      for (const ws of connections) {
        if (ws.readyState === ws.OPEN) {
          ws.close(1000, 'Server shutting down');
        }
      }
    }

    this.connections.clear();
    this.connectionMetadata.clear();
    console.log('SessionManager shutdown complete');
  }

  /**
   * Generate a unique client ID
   */
  private generateClientID(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

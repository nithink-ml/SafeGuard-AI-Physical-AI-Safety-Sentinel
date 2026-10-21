/**
 * Resilient WebSocket Streaming Client
 * Connects to /ws with heartbeat ping, auto-reconnection, and typed event dispatching.
 */

import { WebSocketTelemetryMessage } from '../types/telemetry';

type MessageCallback = (message: WebSocketTelemetryMessage) => void;
type StatusCallback = (connected: boolean) => void;

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export class WebSocketService {
  private url: string;
  private ws: WebSocket | null = null;
  private messageListeners: Set<MessageCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private isExplicitlyClosed = false;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private reconnectAttempts = 0;

  constructor(url: string = WS_BASE_URL) {
    this.url = url;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketTelemetryMessage = JSON.parse(event.data);
          this.notifyMessage(data);
        } catch (err) {
          console.warn('WS message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.notifyStatus(false);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.notifyStatus(false);
        this.ws?.close();
      };
    } catch {
      this.notifyStatus(false);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  public send(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
    }
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.isConnected());
    return () => this.statusListeners.delete(callback);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ action: 'PING' });
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    // Exponential backoff: 1s, 2s, 4s, capped at 10s
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 10000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private notifyMessage(msg: WebSocketTelemetryMessage): void {
    for (const listener of this.messageListeners) {
      listener(msg);
    }
  }

  private notifyStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      listener(connected);
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;

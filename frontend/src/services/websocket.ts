import { createWebSocket } from "./api";

type MessageHandler = (event: MessageEvent) => void;
type StatusHandler = (connected: boolean) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelay: number;
  private readonly onMessage: MessageHandler;
  private readonly onStatusChange: StatusHandler;
  private shouldReconnect = true;

  constructor(
    onMessage: MessageHandler,
    onStatusChange: StatusHandler,
    reconnectDelay = 2000
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.reconnectDelay = reconnectDelay;
  }

  connect(): void {
    this.shouldReconnect = true;
    this._connect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _connect(): void {
    try {
      const ws = createWebSocket();
      this.ws = ws;

      ws.onopen = () => this.onStatusChange(true);

      ws.onmessage = (event) => this.onMessage(event);

      ws.onclose = () => {
        this.onStatusChange(false);
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(
            () => this._connect(),
            this.reconnectDelay
          );
        }
      };

      ws.onerror = () => ws.close();
    } catch {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(
          () => this._connect(),
          this.reconnectDelay
        );
      }
    }
  }
}

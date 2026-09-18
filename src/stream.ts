/**
 * Real-time WebSocket streaming client for Robinhood Chain (chain id 4663).
 *
 * Wraps the connect → token → subscribe → event loop with auto-reconnect,
 * heartbeat liveness, and typed events, so consumers never hand-roll
 * connection management. The stream token is fetched on every (re)connect;
 * stream tokens never expire (since 2026-08-27), so there is no refresh
 * timer — a `4001` close means the token was rotated or the subscription
 * lapsed, and the reconnect simply mints again. Obtain one via `client.stream.connect()`.
 *
 * Works in Node (global `WebSocket` on Node 22+, else lazily imports the
 * optional `ws` package) and the browser (native WebSocket). Zero required deps.
 */

/** Robinhood Chain channels you can subscribe to. */
export type StreamChannel =
  | "rhc:kol_trades"          // live KOL tape — PRO+
  | "rhc:dex_trades"          // full DEX firehose — ULTRA+
  | "rhc:copytrade:signals"   // your copy-trade rule fires — PRO+, user-scoped
  | "rhc:price_alert:events"  // your price-alert dips/recoveries — PRO+, user-scoped, ~15s polled
  | "rhc:kol:coordination"    // your coordination-rule fires — PRO+, user-scoped
  | "rhc:kol:first_touches"   // first tracked-KOL buy per token — PRO+, broadcast
  /**
   * @deprecated `rhc:trades` was never a real server channel — 0.4.0 subscribers
   * got a `channels_rejected` warning and silence. The server now accepts it as
   * an alias of `rhc:dex_trades` (and acks it under that name). Subscribe to
   * `rhc:dex_trades` instead; this literal will be removed in a future major.
   */
  | "rhc:trades";

/** Event names delivered on those channels. */
export type StreamEventName =
  | "rhc:kol_trade"            // on rhc:kol_trades
  | "rhc:dex_trade"            // on rhc:dex_trades (also what the deprecated rhc:trades alias delivers)
  | "rhc:copytrade:signal"     // on rhc:copytrade:signals
  | "rhc:price_alert:dip"      // on rhc:price_alert:events
  | "rhc:price_alert:recovery" // on rhc:price_alert:events
  | "rhc:kol:coordination"     // on rhc:kol:coordination
  | "rhc:kol:first_touch";     // on rhc:kol:first_touches

/** Lifecycle events you can also listen for. */
export type StreamLifecycleEvent = "open" | "close" | "reconnect" | "subscribed" | "heartbeat" | "warning" | "error";

/**
 * A server `type: "warning"` frame, surfaced as the `"warning"` lifecycle
 * event. The one warning the server sends today is `code: "channels_rejected"`
 * — the channels it refused (unknown or tier-gated), each with a reason, plus
 * the full list of channels it accepts. 0.4.0 dropped these frames on the
 * floor, which made a rejected subscribe look like a healthy-but-silent stream.
 */
export interface StreamWarning {
  /** Machine-readable code, e.g. `"channels_rejected"`. */
  code?: string;
  /** Channels the server refused, each with a human-readable reason. */
  rejected?: Array<{ channel: string; reason: string }>;
  /** Every channel the server accepts. */
  valid_channels?: string[];
  /** Optional human-readable message (not sent on every warning). */
  message?: string;
  /** Server timestamp (ms). */
  ts?: number;
}

export interface StreamEvent<T = unknown> {
  channel: StreamChannel;
  event: StreamEventName;
  data: T;
  ts: number;
}

/** Minimal stream-token shape the client needs (token + ws_url). */
export interface StreamTokenLike {
  token: string;
  ws_url: string;
}

export interface StreamClientOptions {
  /**
   * Returns the stream token (wired by client.stream.connect()). Called on
   * every (re)connect; tokens never expire, so it is never called on a timer.
   */
  getToken: () => Promise<StreamTokenLike>;
  /** Reconnect automatically on drop (default: true). */
  autoReconnect?: boolean;
  /** Max reconnect backoff in ms (default: 30000). */
  maxBackoffMs?: number;
  /** Reconnect if no server heartbeat arrives within this window (default: 90000). */
  heartbeatTimeoutMs?: number;
  /** Override the WebSocket implementation (e.g. inject `ws` explicitly). */
  WebSocketImpl?: unknown;
}

type Listener = (data: unknown, evt?: StreamEvent) => void;

interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

async function resolveWebSocket(override?: unknown): Promise<new (url: string) => WebSocketLike> {
  if (override) return override as never;
  // Prefer the `ws` package in Node: it exposes terminate() for an immediate
  // socket teardown, so close() lets short-lived processes exit. The global
  // (undici) WebSocket on Node 22+ keeps its TLS socket open after close() —
  // it has no terminate() and no reachable socket handle — which hangs the
  // event loop. In the browser this import rejects and we fall back to the
  // platform's native WebSocket.
  try {
    const mod = (await import("ws" as string)) as { default?: unknown; WebSocket?: unknown };
    const impl = mod.default ?? mod.WebSocket;
    if (impl) return impl as never;
  } catch {
    /* not Node, or `ws` not installed — fall back to the platform WebSocket */
  }
  const g = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (g) return g as never;
  throw new Error(
    "No WebSocket implementation available. On Node < 22, install `ws` (npm i ws) or pass { WebSocketImpl }.",
  );
}

const OPEN = 1;

export class RobinhoodStream {
  private opts: Required<Omit<StreamClientOptions, "WebSocketImpl">> & Pick<StreamClientOptions, "WebSocketImpl">;
  private ws: WebSocketLike | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private desired = { channels: new Set<StreamChannel>(), filters: {} as Record<string, unknown> };
  private closedByUser = false;
  private attempt = 0;
  private hbTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;

  constructor(opts: StreamClientOptions) {
    this.opts = {
      getToken: opts.getToken,
      autoReconnect: opts.autoReconnect ?? true,
      maxBackoffMs: opts.maxBackoffMs ?? 30_000,
      heartbeatTimeoutMs: opts.heartbeatTimeoutMs ?? 90_000,
      WebSocketImpl: opts.WebSocketImpl,
    };
  }

  /** Register a handler. Use an event name, `"*"` for every event, or a lifecycle event. */
  on(event: "warning", fn: (warning: StreamWarning, evt?: StreamEvent) => void): this;
  on(event: StreamEventName | StreamLifecycleEvent | "*", fn: Listener): this;
  on(
    event: StreamEventName | StreamLifecycleEvent | "*",
    fn: Listener | ((warning: StreamWarning, evt?: StreamEvent) => void),
  ): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener);
    return this;
  }

  /** Remove a handler (or all handlers for an event when `fn` is omitted). */
  off(event: string, fn?: Listener): this {
    if (!fn) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(fn);
    return this;
  }

  private emit(event: string, data: unknown, evt?: StreamEvent): void {
    const set = this.listeners.get(event);
    if (set) for (const fn of set) { try { fn(data, evt); } catch { /* user handler */ } }
  }

  /** Subscribe to one or more channels (connects on first call). Optional server-side filters. */
  subscribe(channels: StreamChannel[], filters?: Record<string, unknown>): this {
    for (const c of channels) this.desired.channels.add(c);
    if (filters) this.desired.filters = { ...this.desired.filters, ...filters };
    if (this.ws && this.ws.readyState === OPEN) this.sendSubscribe();
    else void this.connect();
    return this;
  }

  /** Stop receiving the given channels. */
  unsubscribe(channels: StreamChannel[]): this {
    for (const c of channels) this.desired.channels.delete(c);
    if (this.ws && this.ws.readyState === OPEN) {
      this.ws.send(JSON.stringify({ type: "unsubscribe", channels }));
    }
    return this;
  }

  /** Open the connection (also called implicitly by subscribe). */
  async connect(): Promise<void> {
    if (this.connecting || (this.ws && this.ws.readyState === OPEN)) return;
    this.closedByUser = false;
    this.connecting = true;
    try {
      const [WS, token] = await Promise.all([
        resolveWebSocket(this.opts.WebSocketImpl),
        this.opts.getToken(),
      ]);
      // close() may have run while we were awaiting the token. It can only null
      // out the socket that exists when it is called, so opening this one now
      // would leave a live socket and heartbeat timer behind a close() the
      // caller has already made. Honour the close instead.
      if (this.closedByUser) return;
      const url = `${token.ws_url}?token=${encodeURIComponent(token.token)}`;
      const ws = new WS(url);
      this.ws = ws;

      ws.onopen = () => {
        this.attempt = 0;
        this.resetHeartbeat();
        if (this.desired.channels.size > 0) this.sendSubscribe();
        this.emit("open", undefined);
      };
      ws.onmessage = (ev) => this.handleMessage(ev.data);
      ws.onerror = (err) => this.emit("error", err instanceof Error ? err : new Error("WebSocket error"));
      ws.onclose = (ev) => {
        this.clearHeartbeat();
        this.ws = null;
        this.emit("close", { code: ev?.code, reason: ev?.reason });
        if (!this.closedByUser && this.opts.autoReconnect) this.scheduleReconnect();
      };
    } catch (err) {
      this.emit("error", err);
      if (!this.closedByUser && this.opts.autoReconnect) this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  /** Close the connection and stop reconnecting. */
  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.clearHeartbeat();
    const sock = this.ws as (WebSocketLike & { terminate?: () => void }) | null;
    this.ws = null;
    try {
      // `ws` package: terminate() destroys the underlying socket immediately so
      // the process can exit. Native/undici WebSocket has no terminate() — fall
      // back to a graceful close().
      if (typeof sock?.terminate === "function") sock.terminate();
      else sock?.close(1000, "client closed");
    } catch { /* ignore */ }
  }

  private sendSubscribe(): void {
    const channels = Array.from(this.desired.channels);
    if (channels.length === 0) return;
    const msg: Record<string, unknown> = { type: "subscribe", channels };
    if (Object.keys(this.desired.filters).length > 0) msg.filters = this.desired.filters;
    this.ws?.send(JSON.stringify(msg));
  }

  private handleMessage(raw: unknown): void {
    let msg: Record<string, unknown>;
    try {
      const text = typeof raw === "string" ? raw : String(raw);
      msg = JSON.parse(text);
    } catch {
      this.emit("error", new Error("Failed to parse stream message"));
      return;
    }
    if (msg.type === "heartbeat") { this.resetHeartbeat(); this.emit("heartbeat", msg.ts); return; }
    if (msg.type === "connected") { return; }
    if (msg.type === "subscribed") { this.emit("subscribed", msg.channels); return; }
    if (msg.type === "warning") {
      // e.g. { code: "channels_rejected", rejected: [{channel, reason}], valid_channels }
      // — never swallow a server warning; a rejected subscribe must not look
      // like a healthy-but-silent stream (the 0.4.0 bug).
      this.emit("warning", msg as StreamWarning);
      return;
    }
    if (msg.channel && msg.event) {
      const evt = msg as unknown as StreamEvent;
      this.emit(evt.event, evt.data, evt);
      this.emit("*", evt.data, evt);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const base = Math.min(1000 * 2 ** this.attempt, this.opts.maxBackoffMs);
    const delay = base / 2 + Math.floor((base / 2) * Math.random());
    this.attempt++;
    this.emit("reconnect", { attempt: this.attempt, delayMs: delay });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private resetHeartbeat(): void {
    this.clearHeartbeat();
    this.hbTimer = setTimeout(() => {
      try { this.ws?.close(4000, "heartbeat timeout"); } catch { /* ignore */ }
    }, this.opts.heartbeatTimeoutMs);
  }

  private clearHeartbeat(): void {
    if (this.hbTimer) { clearTimeout(this.hbTimer); this.hbTimer = null; }
  }
}

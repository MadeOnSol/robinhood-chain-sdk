// ─────────────────────────────────────────────────────────────────────────────
// robinhood-chain-sdk
// Official TypeScript SDK for the Robinhood Chain (chain id 4663) API.
// EVM-native on-chain trading intelligence — 0x addresses, eth_amount, tx_hash.
// Zero dependencies — uses native fetch (Node ≥ 18).
// ─────────────────────────────────────────────────────────────────────────────

import { RobinhoodStream } from "./stream.js";
import type { StreamClientOptions } from "./stream.js";
import { VERSION } from "./version.js";

export { RobinhoodStream } from "./stream.js";
export type {
  StreamClientOptions,
  StreamChannel,
  StreamEventName,
  StreamEvent,
  StreamLifecycleEvent,
  StreamWarning,
  StreamTokenLike,
} from "./stream.js";

/** Robinhood Chain — Arbitrum Orbit L2, chain id 4663. */
export const CHAIN_ID = 4663;

const BASE_URL = "https://madeonsol.com/api/v1";

// ─── Error ───────────────────────────────────────────────────────────────────

/** Thrown for any non-2xx API response (and exhausted network retries). */
export class RobinhoodError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** The API request id (`_rid`), when the error body carried one. Include it when reporting issues. */
  readonly requestId: string | null;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "RobinhoodError";
    this.status = status;
    this.body = body;
    const rid =
      body && typeof body === "object" && typeof (body as Record<string, unknown>)._rid === "string"
        ? ((body as Record<string, unknown>)._rid as string)
        : null;
    this.requestId = rid;
  }
}

// ─── Shared primitives ───────────────────────────────────────────────────────

/** All Robinhood Chain responses echo `chain: "robinhood"`. */
export type Chain = "robinhood";
export type TradeAction = "buy" | "sell";
/** Deployer reputation tier on Robinhood Chain. */
export type DeployerTier = "elite" | "good" | "neutral" | "spammer";
/** Uniswap DEX version on Robinhood Chain. */
export type UniswapVersion = "uniswap-v2" | "uniswap-v3" | "uniswap-v4";

// ─── KOL feed (/rhc/kol/feed) ────────────────────────────────────────────────

export interface RhcKolFeedParams {
  /** Number of trades to return (1–100). Default: 50. */
  limit?: number;
  /** Cursor — return trades strictly older than this ISO 8601 timestamp. Pass `next_before` from the previous response. */
  before?: string;
  /** Filter by trade direction. */
  action?: TradeAction;
  /** Filter to a single KOL by their EVM wallet address (0x, 40 hex). */
  kol?: string;
  /** Minimum trade size in ETH. */
  min_eth?: number;
}

/** One KOL trade row from `/rhc/kol/feed`. */
export interface RhcKolFeedTrade {
  /** The KOL's Robinhood-Chain wallet (0x). */
  evm_address: string;
  kol_name: string | null;
  kol_twitter: string | null;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  /** pons | flap | clanker | hood.fun | virtuals | null. */
  launchpad: string | null;
  is_graduated: boolean | null;
  /** Reputation tier of the token's deployer. */
  deployer_tier: DeployerTier | null;
  /** Token age at request time (first-seen → now), minutes. */
  token_age_minutes: number | null;
  action: TradeAction;
  /** Trade size in ETH. */
  eth_amount: number | null;
  token_amount: number | null;
  price_usd_at_trade: number | null;
  /** Token market cap when the KOL traded. */
  market_cap_usd_at_trade: number | null;
  /** Token market cap now. */
  current_mc_usd: number | null;
  /** All-time-high market cap observed since ingestion. */
  peak_mc_usd: number | null;
  liquidity_usd: number | null;
  /** current_mc_usd ÷ market_cap_usd_at_trade — how far the token ran after the KOL's trade. */
  mc_multiple_since_trade: number | null;
  /** uniswap-v2/v3/v4 or the launchpad name for curve trades. */
  dex: string;
  pool: string | null;
  tx_hash: string;
  block_number: number;
  traded_at: string;
}

export interface RhcKolFeedResponse {
  chain: Chain;
  trades: RhcKolFeedTrade[];
  count: number;
  /** Age of the newest row, seconds. */
  data_age_seconds: number | null;
  /** Cursor for the next page — pass as `before` to fetch older trades. */
  next_before: string | null;
  _rid?: string;
}

// ─── KOL leaderboard (/rhc/kol/leaderboard) ──────────────────────────────────

export type RhcKolPeriod = "24h" | "7d" | "30d";

export interface RhcKolLeaderboardParams {
  /** Rolling window. Default: "24h". */
  period?: RhcKolPeriod;
  /** Max results (1–100). Default: 50. */
  limit?: number;
}

export interface RhcKolLeaderboardRow {
  kol_name: string | null;
  kol_twitter: string | null;
  trades: number;
  buys: number;
  sells: number;
  /** Total ETH bought in the window. */
  buy_eth: number;
  /** Total ETH sold in the window. */
  sell_eth: number;
  /** buy_eth − sell_eth (flow, not realized PnL). */
  net_eth: number;
  /** Distinct tokens traded in the window. */
  tokens_traded: number;
  last_trade_at: string;
}

export interface RhcKolLeaderboardResponse {
  chain: Chain;
  period: RhcKolPeriod;
  leaderboard: RhcKolLeaderboardRow[];
  count: number;
  _rid?: string;
}

// ─── KOL hot tokens (/rhc/kol/hot-tokens) ────────────────────────────────────

export type RhcHotTokensWindow = "5m" | "15m" | "1h" | "6h" | "24h";

export interface RhcHotTokensParams {
  /** Rolling consensus window. Default: "1h". */
  window?: RhcHotTokensWindow;
}

export interface RhcHotToken {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  /** noxa | flap | pons | hood.fun | clanker | null. */
  launchpad: string | null;
  is_graduated: boolean | null;
  /** elite | good | neutral | spammer | null. */
  deployer_tier: DeployerTier | null;
  /** Distinct KOL buyers in the window (>= 2). */
  kols_buying: number;
  buys: number;
  sells: number;
  buy_eth: number;
  /** buy_eth − sell_eth. */
  net_eth: number;
  /** Current market cap. */
  market_cap_usd: number | null;
  last_trade_at: string;
}

export interface RhcHotTokensResponse {
  chain: Chain;
  window: RhcHotTokensWindow;
  tokens: RhcHotToken[];
  count: number;
  _rid?: string;
}

// ─── KOL profile (/rhc/kol/{wallet}) ─────────────────────────────────────────

export interface RhcKolProfileStats {
  trades: number;
  buys: number;
  sells: number;
  buy_eth: number;
  sell_eth: number;
  net_eth: number;
  tokens_traded: number;
  /** e.g. "last 200 trades". */
  window: string;
}

/** A trade in a KOL profile's recent-trades list. Loosely shaped by the API. */
export interface RhcKolProfileTrade {
  token_address?: string;
  token_symbol?: string | null;
  token_name?: string | null;
  action?: TradeAction;
  eth_amount?: number | null;
  token_amount?: number | null;
  price_usd_at_trade?: number | null;
  market_cap_usd_at_trade?: number | null;
  dex?: string;
  tx_hash?: string;
  traded_at?: string;
  [key: string]: unknown;
}

export interface RhcKolProfileResponse {
  chain: Chain;
  evm_address: string;
  kol_name: string | null;
  kol_twitter: string | null;
  stats: RhcKolProfileStats;
  /** 50 most recent trades. */
  trades: RhcKolProfileTrade[];
  _rid?: string;
}

// ─── KOL coordination (/rhc/kol/coordination) ────────────────────────────────

export type RhcCoordinationPeriod = "1h" | "6h" | "24h" | "7d";
/** Cohort direction over the window — net_eth ≥ 0 accumulating, else distributing. */
export type RhcCoordinationSignal = "accumulating" | "distributing";

export interface RhcKolCoordinationParams {
  /** Rolling window. Default: "24h". */
  period?: RhcCoordinationPeriod;
  /** Minimum distinct KOL buyers for a token to qualify (2–50). Default: 2. */
  min_kols?: number;
  /** Max tokens (1–50). Default: 20. */
  limit?: number;
  /** Minimum market cap at the FIRST KOL buy (USD). Tokens with an unknown entry MC are dropped when a band is set. */
  min_mc_usd?: number;
  /** Maximum market cap at the first KOL buy (USD). */
  max_mc_usd?: number;
}

/** One KOL's leg of a coordinated cohort. */
export interface RhcCoordinationKol {
  evm_address: string;
  name: string | null;
  twitter_url: string | null;
  buy_eth: number;
  sell_eth: number;
  /** Sold more ETH than they bought inside the window. */
  exited: boolean;
}

/** One coordinated token — bought by `kol_count` distinct KOLs inside the window. */
export interface RhcCoordinationToken {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_tier: DeployerTier | null;
  token_age_minutes: number | null;
  /** Distinct KOL buyers in the window (≥ min_kols). */
  kol_count: number;
  total_buys: number;
  buy_eth: number;
  sell_eth: number;
  /** buy_eth − sell_eth over the window. */
  net_eth: number;
  signal: RhcCoordinationSignal;
  /** KOLs that sold more than they bought. */
  exited_count: number;
  /** kol_count − exited_count. */
  holders_count: number;
  first_buy_at: string;
  last_buy_at: string;
  /** How fast the cohort piled in — last_buy_at − first_buy_at, seconds. */
  time_to_consensus_sec: number;
  market_cap_usd_at_first_buy: number | null;
  current_mc_usd: number | null;
  peak_mc_usd: number | null;
  liquidity_usd: number | null;
  /** Per-KOL breakdown, largest buyer first. */
  kols: RhcCoordinationKol[];
}

export interface RhcKolCoordinationResponse {
  chain: Chain;
  coordination: RhcCoordinationToken[];
  count: number;
  period: RhcCoordinationPeriod;
  min_kols: number;
  _rid?: string;
}

// ─── KOL first touches (/rhc/kol/first-touches) ──────────────────────────────

export interface RhcFirstTouchesParams {
  /** Max events (1–100). Default: 50 — clamped to 20 below PRO. */
  limit?: number;
  /** Only first-touches strictly newer than this ISO 8601 timestamp (poll forward). */
  since?: string;
  /** Cursor — only first-touches strictly older than this ISO 8601 timestamp. Pass `next_before`. */
  before?: string;
  /** Minimum first-buy size in ETH (0–100000). */
  min_eth?: number;
  /** Only tokens younger than N minutes at first touch (1–43200) — isolates genuinely early calls. */
  token_age_max_min?: number;
  /** Filter by launchpad: pons, flap, clanker, hood.fun, noxa, virtuals. */
  launchpad?: string;
  /** Minimum market cap at first buy (USD). */
  min_mc_usd?: number;
  /** Maximum market cap at first buy (USD). */
  max_mc_usd?: number;
}

/** The KOL behind a first touch. `evm_address` is ULTRA/BUSINESS only. */
export interface RhcFirstTouchKol {
  /** ULTRA/BUSINESS only — `name` and `twitter_url` are always returned. */
  evm_address?: string;
  name: string | null;
  twitter_url: string | null;
}

/** The globally earliest KOL buy on a token — the discovery signal. */
export interface RhcFirstTouch {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  first_buy_at: string;
  /** Entry size in ETH. */
  eth_amount: number | null;
  token_amount: number | null;
  tx_hash: string;
  /** Token age at the first touch, minutes. */
  token_age_minutes: number | null;
  market_cap_usd_at_first_buy: number | null;
  price_usd_at_first_buy: number | null;
  current_mc_usd: number | null;
  peak_mc_usd: number | null;
  first_kol: RhcFirstTouchKol;
}

export interface RhcKolFirstTouchesResponse {
  chain: Chain;
  events: RhcFirstTouch[];
  count: number;
  /** Cursor for the next page — pass as `before` to fetch older first-touches. */
  next_before: string | null;
  /** Age of the newest event, seconds. */
  data_age_seconds: number | null;
  _rid?: string;
}

// ─── DEX trade tape (/rhc/trades) ────────────────────────────────────────────

export interface RhcTradesParams {
  /** Number of trades to return (1–100). Default: 50. */
  limit?: number;
  /** Filter to one token address (0x, 40 hex). */
  token?: string;
  /** Filter by DEX version. */
  dex?: UniswapVersion;
  /** Filter by direction. */
  action?: TradeAction;
  /** Minimum trade size in ETH. */
  min_eth?: number;
  /** Cursor: trades strictly older than this block_time (ISO 8601). Pass `next_before`. */
  before?: string;
}

/** One raw DEX swap from `/rhc/trades`. */
export interface RhcTrade {
  block_number: number;
  block_time: string;
  tx_hash: string;
  log_index: number;
  dex: string;
  pool: string;
  /** Swap-log recipient — the ROUTER for aggregated swaps. Use trader_eoa for wallet analytics. */
  trader: string | null;
  /**
   * The effective trading account — tx.from on an ordinary transaction, or the
   * ERC-4337 userOp sender when the trade was bundled. Never the router or the
   * bundler. Still an EOA either way (userOp senders here carry an EIP-7702
   * delegation, not a contract account).
   */
  trader_eoa: string | null;
  /** Router/aggregator contract (tx.to). */
  router: string | null;
  token_address: string | null;
  action: TradeAction | null;
  eth_amount: number | null;
  price_native: number | null;
  price_usd: number | null;
  mc_usd_at_trade: number | null;
  /** Effective gas price, gwei. */
  gas_price: number | null;
  /** Transaction position within the block (ordering / sandwich detection). */
  tx_index: number | null;
  /** 4-byte calldata selector. */
  method_selector: string | null;
  /** v3/v4 in-range liquidity at the trade. */
  liquidity: number | null;
  launchpad: string | null;
  /** True if trader_eoa is a tracked KOL wallet. */
  is_kol: boolean;
  kol_name: string | null;
  /** Set if trader_eoa is a known deployer. */
  deployer_tier: DeployerTier | null;
}

export interface RhcTradesResponse {
  chain: Chain;
  trades: RhcTrade[];
  count: number;
  /** Pagination cursor (last row's block_time). */
  next_before: string | null;
  _rid?: string;
}

// ─── Token discovery (/rhc/tokens) ───────────────────────────────────────────

export type RhcTokensSort = "last_trade" | "market_cap" | "liquidity" | "peak_mc";

export interface RhcTokensListParams {
  /** Number of tokens to return (1–100). Default: 50. */
  limit?: number;
  /** Ordering (all descending): most recent trade, market cap, current liquidity, or all-time-high MC. Default: "last_trade". */
  sort?: RhcTokensSort;
  /** Minimum current market cap (USD). */
  min_mc_usd?: number;
  /** Minimum current liquidity (USD). */
  min_liquidity_usd?: number;
  /** Filter by launchpad: pons, flap, clanker, hood.fun, noxa, virtuals. */
  launchpad?: string;
}

export interface RhcTokenListItem {
  token_address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_address: string | null;
  deployer_tier: DeployerTier | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  /** Percent below all-time-high MC. */
  drawdown_from_peak_pct: number | null;
  liquidity_usd: number | null;
  primary_dex: string | null;
  primary_pool: string | null;
  last_trade_time: string | null;
}

export interface RhcTokensListResponse {
  chain: Chain;
  tokens: RhcTokenListItem[];
  count: number;
  sort: string;
  _rid?: string;
}

// ─── Token snapshot (/rhc/tokens/{address}) ──────────────────────────────────

export interface RhcTokenDeployer {
  address: string;
  tier: DeployerTier;
  tokens_deployed: number;
  graduation_rate: number | null;
  runner_rate: number | null;
  runners: number;
  best_peak_mc_usd: number | null;
  launchpads: string[];
}

export interface RhcTokenKolActivity {
  distinct_kols: number;
  names: string[];
  buys: number;
  sells: number;
  net_eth: number;
}

export interface RhcTokenSnapshot {
  chain: Chain;
  token_address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  graduated_pool: string | null;
  graduated_at: string | null;
  deployer_address: string | null;
  first_seen_at: string | null;
  token_age_minutes: number | null;
  price_usd: number | null;
  price_native: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  drawdown_from_peak_pct: number | null;
  total_supply_raw: string | null;
  liquidity_usd: number | null;
  primary_dex: string | null;
  primary_pool: string | null;
  last_trade_time: string | null;
  /** Deployer reputation. */
  deployer: RhcTokenDeployer | null;
  /** Up to 10 other tokens by the same deployer (symbol or address). */
  deployer_other_tokens: string[];
  kol_activity: RhcTokenKolActivity;
  /** Up to 20 pools with reserves/liquidity/sqrt_price. */
  pools: Array<Record<string, unknown>>;
  _rid?: string;
}

// ─── OHLC candles (/rhc/tokens/{address}/candles) ────────────────────────────

export interface RhcCandlesParams {
  /** Number of candles (most recent first, returned chronological). 1–1000. Default: 240. */
  limit?: number;
  /** Lower bound on bucket_start (ISO 8601). */
  from?: string;
  /** Upper bound on bucket_start (ISO 8601). */
  to?: string;
}

export interface RhcCandle {
  bucket_start: string;
  open_price_usd: number;
  high_price_usd: number;
  low_price_usd: number;
  close_price_usd: number;
  open_mc_usd: number | null;
  high_mc_usd: number | null;
  low_mc_usd: number | null;
  close_mc_usd: number | null;
  close_liquidity_usd: number | null;
  close_supply: number | null;
  volume_usd: number;
  volume_buy_usd: number | null;
  volume_sell_usd: number | null;
  trades: number;
  buy_count: number | null;
  sell_count: number | null;
  dex: string | null;
  pool_address: string | null;
}

export interface RhcCandlesResponse {
  chain: Chain;
  token_address: string;
  /** e.g. "1m". */
  timeframe: string;
  /** Candles ordered oldest → newest. */
  candles: RhcCandle[];
  count: number;
  _rid?: string;
}

// ─── KOL consensus (/rhc/tokens/{address}/kol-consensus) ─────────────────────

export interface RhcKolConsensus {
  total_kol_buyers: number;
  total_kol_sellers: number;
  /** Fraction of KOL buyers who also sold (0–1). */
  kol_exit_rate: number;
  net_flow_eth: number;
  total_buy_eth: number;
  total_sell_eth: number;
  first_kol_buy_at: string | null;
  last_kol_buy_at: string | null;
  first_touch_wallet: string | null;
  first_touch_at: string | null;
  /** Median MC at KOL buy — over buys that carried an MC-at-trade. Null under the pricer's liquidity gate. */
  median_entry_mc_usd: number | null;
  /** Number of buys with a market_cap_usd_at_trade — the median's sample size. */
  entry_mc_samples: number;
  total_trades: number;
  /** ULTRA only — distinct KOL buyer wallets. */
  buyers?: string[];
  /** ULTRA only — KOL wallets that bought and sold. */
  exited?: string[];
}

export interface RhcKolConsensusResponse {
  chain: Chain;
  token_address: string;
  current_mc_usd: number | null;
  current_price_usd: number | null;
  /** Null when no tracked KOL has traded the token. */
  consensus: RhcKolConsensus | null;
  _rid?: string;
}

// ─── Buyer quality (/rhc/tokens/{address}/buyer-quality) ─────────────────────

export type QualityConfidence = "low" | "medium" | "high";
export type QualitySignal = "positive" | "neutral" | "negative";

export interface RhcBuyerQualityBreakdown {
  early_buyers_analyzed: number;
  alpha_wallet_count: number;
  kol_count: number;
  /** Early buyers flagged as part of a same-block launch bundle. */
  bundle_buyer_count: number;
  /** Early buyers on the rolling dump-cluster list (informational — does not move the score). */
  dump_cluster_count: number;
  /** Early buyers with ≥5 recent early-buyer appearances of any kind (dump_cluster_count is a subset). */
  recycled_early_buyer_count: number;
  /** Percent (0–100), non-bot buyers with ≥3 tokens of history. */
  avg_historical_win_rate: number | null;
  bot_dominated: boolean;
}

export interface RhcBuyerQuality {
  score: number;
  confidence: QualityConfidence;
  signal: QualitySignal;
  breakdown: RhcBuyerQualityBreakdown;
}

export interface RhcBuyerQualityCoverage {
  bundle_detection: "available";
  dump_cluster_signal: "available";
  note?: string;
}

export interface RhcBuyerQualityResponse {
  chain: Chain;
  token_address: string;
  current_mc_usd: number | null;
  quality: RhcBuyerQuality;
  coverage?: RhcBuyerQualityCoverage;
  /** Present only when buyer data is insufficient. */
  note?: string;
  _rid?: string;
}

// ─── Token batch (POST /rhc/token/batch) ─────────────────────────────────────

/** Deployer reputation attached to a batch entry. The rate fields are absent when the deployer has no reputation row yet. */
export interface RhcBatchTokenDeployer {
  address: string;
  /** How the deployer was attributed (e.g. the launchpad's factory event). */
  source: string | null;
  tier?: DeployerTier;
  tokens_deployed?: number;
  graduated?: number;
  graduation_rate?: number;
  runners?: number;
  runner_rate?: number;
}

/** One entry of a `POST /rhc/token/batch` response. Unknown addresses come back as `found: false`. */
export type RhcBatchToken =
  | { address: string; found: false }
  | {
      address: string;
      found: true;
      symbol: string | null;
      name: string | null;
      decimals: number | null;
      launchpad: string | null;
      is_graduated: boolean | null;
      graduated_at: string | null;
      first_seen_at: string | null;
      price_usd: number | null;
      market_cap_usd: number | null;
      fdv_usd: number | null;
      liquidity_usd: number | null;
      peak_mc_usd: number | null;
      peak_mc_at: string | null;
      primary_dex: string | null;
      last_trade_time: string | null;
      deployer: RhcBatchTokenDeployer | null;
    };

export interface RhcTokenBatchResponse {
  chain: Chain;
  /** One entry per REQUESTED address, in order, after de-duplication. */
  tokens: RhcBatchToken[];
  /** Address count AFTER de-duplication. */
  requested: number;
  found: number;
  _rid?: string;
}

// ─── Batch buyer quality (POST /rhc/tokens/batch/buyer-quality) ──────────────

/** One entry of a batch buyer-quality response — a score, or a per-token error. */
export type RhcBatchBuyerQuality =
  | RhcBuyerQualityResponse
  | { chain: Chain; token_address: string; error: string };

export interface RhcBatchBuyerQualityResponse {
  chain: Chain;
  tokens: RhcBatchBuyerQuality[];
  requested: number;
  /** Entries that scored (the rest carry `error`). */
  scored: number;
  /** Hard cap of 20 — lower than the Solana batch cap of 50, echoed so a rejected batch shows why. */
  max_addresses: number;
  coverage?: RhcBuyerQualityCoverage;
  _rid?: string;
}

// ─── Launch-bundle detection (/rhc/tokens/{address}/bundle) ──────────────────

/** Robinhood Chain is an Arbitrum Orbit L2 with no atomic multi-signer tx — so no `atomic_tx` kind. */
export type RhcBundleKind = "same_block" | "none";

export interface RhcBundleSummary {
  /** Bundle-cohort size (0 when none). */
  wallet_count: number;
  bundle_kind: RhcBundleKind;
  /** Net tokens still held ÷ tokens bought, [0,1]. The primary signal. */
  held_ratio: number | null;
  /** Net tokens held ÷ total supply, [0,1]; null when supply is unknown. */
  held_pct_of_supply: number | null;
  /** True when the cohort holds ≤0.5% of what it bought. */
  fully_exited: boolean;
  /** Cohort cumulative buy-side token volume (human-scaled). */
  buy_volume: number;
  /** Cohort net position (Σbuys − Σsells, human-scaled). */
  tokens_held: number;
}

export interface RhcBundleWallet {
  /** Early-buyer rank (1 = first buyer). */
  rank: number;
  /** Buyer wallet (lowercase 0x). */
  wallet: string;
  held_ratio: number | null;
  has_sold: boolean;
  /** Wallet is a tracked RHC KOL. */
  is_kol: boolean;
  /** ULTRA only — historical win-rate [0,1]. */
  win_rate?: number | null;
  /** ULTRA only — bot heuristic from mv_rhc_alpha_wallets. */
  likely_bot?: boolean;
  /** ULTRA only — net position, human-scaled. */
  tokens_held?: number;
}

export interface RhcBundleResponse {
  chain: Chain;
  token_address: string;
  bundle: RhcBundleSummary;
  /** Empty for BASIC; top-10 for PRO; full cohort for ULTRA. */
  wallets: RhcBundleWallet[];
  _rid?: string;
}

// ─── Top traders (/rhc/tokens/{address}/top-traders) ─────────────────────────

export interface RhcTopTradersParams {
  /** Rows to return. Capped at 50 on PRO, 200 on ULTRA/BUSINESS. Default: 50. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. */
  offset?: number;
}

export interface RhcTopTrader {
  /** Trader address (lowercase 0x). */
  trader_eoa: string;
  buy_eth: number | null;
  sell_eth: number | null;
  /**
   * REALIZED ETH flow: sell_eth − buy_eth. This is NOT PnL — it does not value
   * the trader's remaining bag, so a wallet that bought and still holds ranks
   * last. For FIFO cost-basis PnL use `wallet.pnl()`.
   */
  net_eth: number | null;
  trades: number;
  last_trade_at: string | null;
  /** Mean market cap (USD) at the time of this trader's trades. */
  avg_trade_mc: number | null;
  /** Wallet-level historical win-rate [0,1]. */
  win_rate: number | null;
  likely_bot: boolean | null;
  is_known_kol: boolean | null;
  /** Null when the KOL is tracked but has no name recorded. */
  kol_name: string | null;
  /** Trader's net across ALL tokens, for context. */
  wallet_net_eth: number | null;
  wallet_tokens: number | null;
  /** Dump-cluster cohort count; >0 means a recycled dumper. */
  dump_cohorts: number | null;
  /** 1–20 when this trader was among the token's earliest buyers. */
  early_buyer_rank: number | null;
}

export interface RhcTopTradersResponse {
  chain: Chain;
  token_address: string;
  traders: RhcTopTrader[];
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  /** States the net_eth semantics explicitly. */
  metric: string;
  _rid?: string;
}

// ─── Cohort flow (/rhc/tokens/{address}/flow) ────────────────────────────────

export type RhcFlowWindow = "1h" | "6h" | "24h" | "7d";

/**
 * Cohorts are mutually exclusive and assigned by a priority ladder in this
 * order. `smart_money` is derived (win-rate ≥ 0.5 and net positive), not a
 * stored label. `unprofiled` is a real answer — the trader has not met the
 * reputation thresholds. There is no `fresh_wallet` cohort because Robinhood
 * Chain stores no wallet-level first-seen.
 */
export type RhcFlowCohortName =
  | "kol"
  | "bot"
  | "dump_cluster"
  | "early_buyer"
  | "unprofiled"
  | "smart_money"
  | "retail";

export interface RhcFlowCohort {
  cohort: RhcFlowCohortName;
  traders: number;
  trades: number;
  buy_eth: number;
  sell_eth: number;
  /** sell − buy. POSITIVE = the cohort DISTRIBUTED; negative = accumulated. */
  net_eth: number;
}

export interface RhcFlowResponse {
  chain: Chain;
  token_address: string;
  window: RhcFlowWindow;
  cohorts: RhcFlowCohort[];
  totals: {
    traders: number;
    trades: number;
    buy_eth: number;
    sell_eth: number;
    net_eth: number;
  };
  sign_convention: string;
  _rid?: string;
}

// ─── Peak history (/rhc/tokens/{address}/peak-history) ────────────────────────

export type RhcPeakWindow = "24h" | "7d" | "30d" | "all";

export interface RhcPeakHistoryParams {
  /** Curve window. Default: "7d". */
  window?: RhcPeakWindow;
  /** Set "false" to skip the series and return only the peak summary. */
  curve?: "true" | "false";
}

export interface RhcPeakCurvePoint {
  bucket_start: string;
  high_mc_usd: number | null;
  close_mc_usd: number | null;
  close_price_usd: number | null;
  volume_usd: number | null;
  trades: number | null;
  /** Running high-water mark — monotonically non-decreasing by construction. */
  running_peak_mc: number | null;
}

export interface RhcPeakHistoryResponse {
  chain: Chain;
  token_address: string;
  name: string | null;
  symbol: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  first_seen_at: string | null;
  current: {
    market_cap_usd: number | null;
    liquidity_usd: number | null;
    last_price_usd: number | null;
    fdv_usd: number | null;
    last_trade_time: string | null;
  };
  peak: {
    /**
     * The stored high-water mark. This is the value every OTHER Robinhood Chain
     * surface keys off (deployer runner-rate, the $40K graduation bar). It is
     * sampled from write batches, so it can UNDERCOUNT an intra-batch spike.
     */
    peak_mc_usd_recorded: number | null;
    peak_mc_at_recorded: string | null;
    /** Max of 1-minute candle highs — trade-level truth, always ≥ recorded. */
    peak_mc_usd_observed: number | null;
    peak_mc_at_observed: string | null;
    /** False when candle history starts after the token did (candles begin 2026-07-15). */
    observed_covers_full_history: boolean;
    pct_of_peak: number | null;
    drawdown_from_peak: number | null;
  };
  curve: {
    window: RhcPeakWindow;
    /** Server-chosen bin size (1m/5m/15m/1h/4h) so the series stays bounded. */
    bucket: string;
    from: string;
    points: RhcPeakCurvePoint[];
    count: number;
    ohlc_history_starts: string | null;
  };
  notes: string;
  _rid?: string;
}

// ─── Risk (/rhc/tokens/{address}/risk) ───────────────────────────────────────

export type RhcProxyKind = "none" | "eip1167_minimal" | "eip1967" | "eip1967_beacon" | "legacy";
/** `none` = no owner function exists at all, which is NOT the same as renounced. */
export type RhcOwnerModel = "none" | "renounced" | "eoa" | "contract";
export type RhcSellable = "yes" | "no" | "unknown";
export type RhcLpCustody = "burned" | "locked" | "at_risk" | "unknown";

export interface RhcRiskResponse {
  chain: Chain;
  token_address: string;
  /** Computed live at the chain head — never cached. */
  checked_at: string;
  code_size: number;
  is_contract: boolean;
  proxy: {
    kind: RhcProxyKind;
    implementation: string | null;
    admin: string | null;
    /** False for eip1167_minimal — the target is baked into immutable code. */
    upgradeable: boolean;
  };
  owner: { model: RhcOwnerModel; address: string | null };
  capabilities: {
    can_mint: boolean;
    can_pause: boolean;
    has_access_control: boolean;
    selectors_found: string[];
  };
  liquidity: {
    primary_pool: string | null;
    dex: string | null;
    /** Read only for uniswap-v2; v3/v4 LP sits in an NFT and reports "unknown". */
    lp_custody: RhcLpCustody;
    lp_burned_pct: number | null;
  };
  /** Simulated live through the router with state overrides. */
  sellability: { sellable: RhcSellable; reason: string | null };
  flags: string[];
  /** 0–100, conservative. Absence of evidence is not evidence of safety. */
  score: number | null;
  coverage: { model: string; note: string };
  _rid?: string;
}

// ─── Holders (/rhc/tokens/{address}/holders) ─────────────────────────────────

export interface RhcHoldersParams {
  /** Rows to return. Capped at 50 on PRO, 200 on ULTRA/BUSINESS. Default: 50. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. */
  offset?: number;
}

export interface RhcHolder {
  holder: string;
  /** Raw uint256 as a decimal STRING — never a number; these exceed 2^53. */
  balance: string;
  /** Share of circulating supply (pools and burns excluded), [0,1]. */
  share: number | null;
  last_block: number | null;
  is_pool: boolean;
  is_burn: boolean;
  is_deployer: boolean;
}

export interface RhcHoldersResponse {
  chain: Chain;
  token_address: string;
  /**
   * TRUE only when the reconstructed supply equals on-chain totalSupply() at a
   * pinned block. Check this before relying on the numbers.
   */
  verified: boolean;
  unverified_reason: string | null;
  holders: RhcHolder[];
  count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  /** Pools and burns are EXCLUDED from the circulating denominator. */
  concentration: {
    holder_count: number | null;
    circulating: string | null;
    top1_share: number | null;
    top10_share: number | null;
    top50_share: number | null;
    hhi: number | null;
    pool_held_pct: number | null;
    burned_pct: number | null;
    deployer_pct: number | null;
  } | null;
  reconciliation: {
    recon_ok: boolean;
    recon_supply: string | null;
    chain_supply: string | null;
    recon_block: number | null;
    checked_at: string | null;
  } | null;
  source: {
    method: string;
    scanned_to_block: number | null;
    backfill_complete: boolean;
    last_sweep_at: string | null;
    note: string;
  };
  _rid?: string;
}

// ─── Deployer leaderboard (/rhc/deployer-hunter/leaderboard) ─────────────────

export type RhcDeployerSort =
  | "graduation_rate"
  | "runner_rate"
  | "tokens_deployed"
  | "best_peak_mc_usd"
  | "last_deploy_at";

export interface RhcDeployerLeaderboardParams {
  /** Ordering (all descending, NULLs last). Default: "graduation_rate". */
  sort?: RhcDeployerSort;
  /** Filter to one reputation tier. */
  tier?: DeployerTier;
  /** Minimum tokens deployed (1–100000). Default: 3. */
  min_tokens?: number;
  /** Max results (1–50). Default: 20. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. */
  offset?: number;
}

export interface RhcDeployerLeaderboardRow {
  /** Deployer wallet (lowercase 0x). */
  deployer_address: string;
  tokens_deployed: number;
  /** Tokens that reached a $40K+ peak MC (the graduation milestone). */
  graduated: number;
  /** graduated ÷ tokens_deployed. */
  graduation_rate: number;
  /** Tokens that peaked ≥ $100K MC. */
  runners: number;
  /** runners ÷ tokens_deployed. */
  runner_rate: number;
  /** All-time-high MC across all their tokens. */
  best_peak_mc_usd: number | null;
  launchpads: string[];
  first_deploy_at: string | null;
  last_deploy_at: string | null;
  /** Scored on `runner_rate` + 24h of deployer history — NOT on `graduation_rate` (only `spammer` still keys off that). */
  tier: DeployerTier;
}

export interface RhcDeployerLeaderboardResponse {
  chain: Chain;
  deployers: RhcDeployerLeaderboardRow[];
  /** Filtered deployer count. */
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  _rid?: string;
}

// ─── Deployer profile (/rhc/deployer-hunter/{address}) ───────────────────────

export interface RhcDeployerReputation {
  deployer_address: string;
  tokens_deployed: number;
  curve_tokens: number;
  graduated: number;
  bonding_rate: number | null;
  runners: number;
  runner_rate: number;
  best_peak_mc_usd: number | null;
  launchpads: string[];
  first_deploy_at: string | null;
  last_deploy_at: string | null;
  tier: DeployerTier;
}

export interface RhcDeployerToken {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  graduated_at: string | null;
  graduated_pool: string | null;
  first_seen_at: string | null;
  /** Live market cap. */
  market_cap_usd: number | null;
  /** All-time-high MC observed since ingestion. */
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
}

export interface RhcDeployerProfileResponse {
  chain: Chain;
  /** False if this wallet has never deployed a tracked token (deployer is then null). */
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerReputation | null;
  /** Up to 50 most recent tokens by this deployer. */
  recent_tokens: RhcDeployerToken[];
  /** Rows returned (capped at 50) — the true total is deployer.tokens_deployed. */
  recent_tokens_count: number;
  _rid?: string;
}

// ─── Deployer trajectory (/rhc/deployer-hunter/{address}/trajectory) ─────────

/**
 * Compact reputation row echoed by the trajectory / tokens routes.
 *
 * `tier` rides `runner_rate` (the $100K bar) and requires 24h of deployer history
 * (migrations 267 + 269). `graduation_rate` still means the $40K bar and is still
 * returned, but it no longer sets the tier — only `spammer` still keys off it.
 */
export interface RhcDeployerSummary {
  deployer_address: string;
  tokens_deployed: number;
  /** Tokens that reached a $40K+ peak MC. */
  graduated: number;
  graduation_rate: number;
  /** Tokens that peaked ≥ $100K MC — the metric the tier is scored on. */
  runners: number;
  runner_rate: number;
  tier: DeployerTier;
}

/** Trailing run in the deployer's chronological launch history. */
export interface RhcDeployerStreak {
  type: "bond" | "fail" | "none";
  count: number;
}

/** A 10-launch window of the rolling success curve. */
export interface RhcDeployerRollingRate {
  /** 1-based index of the last launch in the window. */
  window_end: number;
  /** Share of the window that graduated, 0–1. */
  bond_rate: number;
}

export interface RhcDeployerStretch {
  start_index: number;
  end_index: number;
  bond_rate: number;
}

export interface RhcDeployerTrajectory {
  current_streak: RhcDeployerStreak;
  longest_bond_streak: number;
  longest_fail_streak: number;
  /** Rolling 10-launch success rates, oldest window first. Empty below 10 launches. */
  rolling_bond_rates: RhcDeployerRollingRate[];
  /** Most recent rolling window vs the lifetime rate (±0.05 band). */
  trend: "improving" | "declining" | "stable";
  avg_days_between_deploys: number | null;
  /** Launches burned between a miss and the next hit. */
  avg_recovery_tokens: number | null;
  best_stretch: RhcDeployerStretch | null;
  worst_stretch: RhcDeployerStretch | null;
  total_tokens_analyzed: number;
}

export interface RhcDeployerTrajectoryResponse {
  chain: Chain;
  /** False if this wallet has never deployed a tracked token (deployer + trajectory are then null). */
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerSummary | null;
  /** States what the `bond` wording actually counted — "graduated ($40K+ peak market cap)". */
  success_metric?: string;
  trajectory: RhcDeployerTrajectory | null;
  /** True when the 500-token analysis cap was hit — the curve is partial. */
  truncated?: boolean;
  _rid?: string;
}

// ─── Deployer launch history (/rhc/deployer-hunter/{address}/tokens) ─────────

export type RhcDeployerTokensSort = "first_seen_at" | "peak_mc_usd";

export interface RhcDeployerTokensParams {
  /** Page size (1–100). Default: 50. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. */
  offset?: number;
  /** Ordering. Default: "first_seen_at" (newest first). `peak_mc_usd` sorts the fetched PAGE only. */
  sort?: RhcDeployerTokensSort;
}

/** One launch in a deployer's paginated history. */
export interface RhcDeployerTokenRow {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  /** How the deployer was attributed for this token. */
  deployer_source: string | null;
  is_graduated: boolean | null;
  graduated_at: string | null;
  first_seen_at: string | null;
  market_cap_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  liquidity_usd: number | null;
}

export interface RhcDeployerTokensResponse {
  chain: Chain;
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerSummary | null;
  tokens: RhcDeployerTokenRow[];
  /** Lifetime launch count (deployer.tokens_deployed), not the page size. */
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  sort?: RhcDeployerTokensSort;
  /** `page` when sort=peak_mc_usd — that ordering is applied to the fetched page only. */
  sort_scope?: "page";
  _rid?: string;
}

// ─── Best tokens (/rhc/deployer-hunter/best-tokens) ──────────────────────────

export type RhcBestTokensPeriod = "24h" | "7d" | "30d" | "all";

export interface RhcBestTokensParams {
  /** Launch window. Default: "7d". */
  period?: RhcBestTokensPeriod;
  /** Max tokens (1–50). Default: 10. */
  limit?: number;
}

export interface RhcBestToken {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  first_seen_at: string | null;
  is_graduated: boolean | null;
  market_cap_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  liquidity_usd: number | null;
  /** The reputable deployer behind the launch. */
  deployer: {
    address: string;
    tier: "elite" | "good";
    graduation_rate: number;
    runner_rate: number;
    tokens_deployed: number;
  } | null;
}

export interface RhcBestTokensResponse {
  chain: Chain;
  /** Ranked by peak MC, highest first. */
  tokens: RhcBestToken[];
  period: RhcBestTokensPeriod;
  limit: number;
  /** Size of the elite+good population the ranking drew from. */
  reputable_deployers: number;
  /** Launches considered before ranking. */
  candidates_scanned?: number;
  /** True when the 1000-candidate scan cap was hit — the top-N is drawn from the most RECENT launches. */
  truncated?: boolean;
  _rid?: string;
}

// ─── Deployer stats (/rhc/deployer-hunter/stats) ─────────────────────────────

export interface RhcDeployerStatsResponse {
  chain: Chain;
  total_deployers: number;
  total_tokens: number;
  /** elite + good. */
  reputable_deployers: number;
  by_tier: Record<string, { deployers: number; tokens: number }>;
  /** Share of all indexed tokens deployed by spammers, 0–1. */
  spam_token_share: number | null;
  alerts_24h: number;
  alerts_7d: number;
  /** The thresholds actually in force — elite/good ride runner_rate + 24h of history, spammer keys off graduation_rate. */
  tier_rules: Record<string, string>;
  /** "peak market cap >= $40,000". */
  graduation_definition: string;
  /** "peak market cap >= $100,000". */
  runner_definition: string;
  _rid?: string;
}

// ─── Deployer alerts (/rhc/deployer-hunter/alerts) ───────────────────────────

export type RhcAlertType = "new_deploy" | "graduated";
/** RHC alert priorities — no `low`, unlike Solana. */
export type RhcAlertPriority = "high" | "medium";

export interface RhcDeployerAlertsParams {
  /** Filter on the RESOLVED (read-time) tier, not the snapshot. */
  deployer_tier?: DeployerTier;
  priority?: RhcAlertPriority;
  alert_type?: RhcAlertType;
  /** Filter by launchpad (1–32 chars). */
  launchpad?: string;
  /** Minimum market cap at alert time (USD). */
  min_mc?: number;
  /** Max alerts (1–500). Default: 50 — BASIC/PRO are capped at 50, only ULTRA gets the full limit. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. Ignored when `before` is set. */
  offset?: number;
  /** Poll forward — only alerts with `event_at` strictly newer than this ISO 8601 timestamp. Pass `next_event_at`. */
  since?: string;
  /** Page back — only alerts strictly older than this ISO 8601 timestamp. Pass `next_before`. Takes precedence over `offset`. */
  before?: string;
  /** Disables the default $100 liquidity gate and returns the raw tape. */
  include_untradeable?: boolean;
}

/** One deployer alert. `tier` is resolved at READ time; `tier_at_alert` is the snapshot taken when it fired. */
export interface RhcDeployerAlert {
  id: string;
  deployer_address: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  alert_type: RhcAlertType;
  title: string | null;
  /** Restated at read time in terms of `runner_rate` — the metric that actually sets the tier. */
  message: string | null;
  launchpad: string | null;
  /** The deployer's CURRENT tier, from the live reputation view. */
  tier: DeployerTier | null;
  /** The tier stored when the alert fired. */
  tier_at_alert: DeployerTier | null;
  /** True when the deployer's tier changed since the alert fired. */
  tier_is_stale: boolean;
  mc_at_alert: number | null;
  current_mc_usd: number | null;
  liquidity_usd: number | null;
  priority: RhcAlertPriority;
  is_active: boolean;
  created_at: string;
  event_at: string | null;
}

export interface RhcDeployerAlertsResponse {
  chain: Chain;
  alerts: RhcDeployerAlert[];
  limit: number;
  offset: number;
  /** Echoes whether the default liquidity gate ran — `liquidity_usd >= $100` or `off (include_untradeable=true)`. */
  tradability_filter: string;
  /** Newest `event_at` on this page — pass back as `since` to poll forward. */
  next_event_at: string | null;
  /** Oldest `event_at` on this page — pass as `before` to page back. */
  next_before: string | null;
  /** Age of the newest alert, seconds. */
  data_age_seconds: number | null;
  _rid?: string;
}

// ─── Deployer history (/rhc/deployer-hunter/{address}/history) ───────────────

export interface RhcDeployerHistoryParams {
  /** Page size (1–1000). Default: 100. */
  limit?: number;
  /** Page offset (0–100000). Default: 0. */
  offset?: number;
}

export interface RhcDeployerHistoryResponse {
  chain: Chain;
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerReputation | null;
  tokens: RhcDeployerToken[];
  /** Exact lifetime launch count. */
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  _rid?: string;
}

// ─── Recent graduations (/rhc/deployer-hunter/recent-bonds) ──────────────────

export interface RhcRecentBondsParams {
  /** Filter by the token deployer's tier. */
  deployer_tier?: DeployerTier;
  /** Raise the peak-MC floor (USD). Never lowers it below the $40K graduation milestone. */
  min_peak?: number;
  /** Max tokens (1–200). Default: 50. */
  limit?: number;
}

export interface RhcRecentBondToken {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_address: string | null;
  deployer_tier: DeployerTier | null;
  first_seen_at: string | null;
  market_cap_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
}

export interface RhcRecentBondsResponse {
  chain: Chain;
  /** The milestone that defines a graduation on this chain — 40000 USD peak MC. */
  graduation_mc: number;
  /** Newest peak first. */
  tokens: RhcRecentBondToken[];
  limit: number;
  /** Newest `peak_mc_at` on this page (informational). */
  next_peak_mc_at: string | null;
  _rid?: string;
}

// ─── Alpha wallets (/rhc/alpha-wallets) ──────────────────────────────────────

export type AlphaClassificationFilter = "all" | "human" | "bot" | "smart_money";
export type AlphaIdentityFilter = "all" | "known_kol" | "unknown";
export type AlphaWalletClassification = "bot" | "smart_money" | "trader";
export type AlphaSort =
  | "net_eth"
  | "win_rate"
  | "trades"
  | "tokens"
  | "buy_eth"
  | "memecoin_share"
  | "last_trade_at";
export type SortOrder = "desc" | "asc";

export interface RhcAlphaWalletsParams {
  /** human = not likely_bot; smart_money = human + net_eth ≥ 2 + win_rate ≥ 0.45. Default: "all". */
  classification?: AlphaClassificationFilter;
  /** known_kol = already mapped to a tracked Solana KOL; unknown = net-new RHC smart money. Default: "all". */
  identity?: AlphaIdentityFilter;
  /** Minimum share of trades in launchpad memecoins (0–1). 0.7 ≈ mostly-memecoin traders. */
  min_memecoin_share?: number;
  /** Maximum average market cap traded — filter to low-cap degens. */
  max_avg_mc_usd?: number;
  min_net_eth?: number;
  min_win_rate?: number;
  max_win_rate?: number;
  min_trades?: number;
  min_tokens?: number;
  /** Minimum ETH deployed (whale/size filter). */
  min_buy_eth?: number;
  /** Only wallets that traded within the last N hours (1–720). */
  active_hours?: number;
  /** Sort field. Default: "net_eth". */
  sort?: AlphaSort;
  /** Sort direction. Default: "desc". */
  order?: SortOrder;
  /** Max results (1–100). Default: 25. */
  limit?: number;
  /** Page offset (0–10000). Default: 0. */
  offset?: number;
}

export interface RhcAlphaWallet {
  /** Trader EOA (lowercase 0x). */
  wallet: string;
  classification: AlphaWalletClassification;
  is_known_kol: boolean;
  trades: number;
  tokens: number;
  buy_eth: number;
  sell_eth: number;
  /** Realized net flow (sell − buy). */
  net_eth: number;
  win_rate: number | null;
  /** Share of trades in launchpad memecoins (vs tokenized stocks/stables). */
  memecoin_share: number | null;
  avg_trade_mc_usd: number | null;
  last_trade_at: string | null;
}

export interface RhcAlphaWalletsResponse {
  chain: Chain;
  wallets: RhcAlphaWallet[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  _rid?: string;
}

// ─── Rule engines: shared ────────────────────────────────────────────────────

/**
 * Where a fired rule is delivered. `websocket` needs no `webhook_url`; anything
 * else requires one. A `webhook_secret` is minted (once, on create) only when a
 * webhook URL is set — payloads are signed HMAC-SHA256 over `<timestamp>.<body>`
 * in the `X-MadeOnSol-Signature` header.
 */
export type DeliveryMode = "webhook" | "websocket" | "both";

/** Every rule-engine DELETE returns this. */
export interface RhcDeletedResponse {
  chain: Chain;
  deleted: boolean;
  _rid?: string;
}

// ─── Copy-trade rules (/rhc/copytrade/subscriptions) ─────────────────────────

/** Which side of the tape a copy-trade rule reacts to. */
export type RhcCopyTradeOnlyAction = "buy" | "sell" | "both";

/** How the suggested size is derived from the source trade. */
export type RhcCopyTradeSizingMode = "fixed" | "proportional" | "percent_source";

export interface RhcCopyTradeSubscription {
  /** Numeric identity PK. */
  id: number;
  name: string | null;
  /** Lowercase 0x wallets this rule follows (the API lowercases on write). */
  source_wallets: string[];
  /** Minimum source-trade size in ETH for the rule to fire. */
  min_trade_eth: number;
  only_action: RhcCopyTradeOnlyAction;
  sizing_mode: RhcCopyTradeSizingMode;
  /** ETH when `sizing_mode` is `fixed`, else a multiplier of the source trade. */
  sizing_amount: number;
  delivery_mode: DeliveryMode;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcCopyTradeListResponse {
  chain: Chain;
  subscriptions: RhcCopyTradeSubscription[];
  _rid?: string;
}

export interface RhcCopyTradeCreateParams {
  name?: string;
  /** 1–250 EVM addresses (0x, 40 hex); the per-tier cap is enforced server-side. */
  source_wallets: string[];
  /** Default 0. */
  min_trade_eth?: number;
  /** Default `buy`. */
  only_action?: RhcCopyTradeOnlyAction;
  /** Default `fixed`. */
  sizing_mode?: RhcCopyTradeSizingMode;
  sizing_amount: number;
  /** Default `webhook`. */
  delivery_mode?: DeliveryMode;
  /** HTTPS only. Required unless `delivery_mode` is `websocket`. */
  webhook_url?: string;
}

export interface RhcCopyTradeCreateResponse {
  chain: Chain;
  subscription: RhcCopyTradeSubscription;
  /** Shown ONCE — null when `delivery_mode` is `websocket`. */
  webhook_secret: string | null;
  note: string;
  _rid?: string;
}

export interface RhcCopyTradeGetResponse {
  chain: Chain;
  subscription: RhcCopyTradeSubscription;
  _rid?: string;
}

export interface RhcCopyTradeUpdateParams {
  /** `null` clears the label. */
  name?: string | null;
  source_wallets?: string[];
  min_trade_eth?: number;
  only_action?: RhcCopyTradeOnlyAction;
  sizing_mode?: RhcCopyTradeSizingMode;
  sizing_amount?: number;
  delivery_mode?: DeliveryMode;
  webhook_url?: string | null;
  is_active?: boolean;
}

// ─── Copy-trade fire history (/rhc/copytrade/signals) ────────────────────────

export interface RhcCopyTradeSignalsParams {
  /** Scope to one of your rules — 404 if you do not own it. */
  subscription_id?: number;
  /** ISO 8601 lower bound on `fired_at`. */
  since?: string;
  /** 1–500. Default: 50. */
  limit?: number;
}

export interface RhcCopyTradeSignal {
  id: number;
  subscription_id: number;
  fired_at: string;
  /** The followed wallet whose trade triggered the fire. */
  source_wallet: string;
  action: TradeAction;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  /** Size of the source trade, ETH. */
  source_eth_amount: number | null;
  /** Size your rule's `sizing_mode` implies, ETH. */
  suggested_eth_amount: number | null;
  price_usd: number | null;
  dex: string | null;
  tx_hash: string;
  delivered: boolean;
  delivered_at: string | null;
}

export interface RhcCopyTradeSignalsResponse {
  chain: Chain;
  signals: RhcCopyTradeSignal[];
  count: number;
  _rid?: string;
}

// ─── Price alerts (/rhc/price-alerts) ────────────────────────────────────────

/** Lifecycle of an alert. Terminal states are `recovered` and `expired`. */
export type RhcPriceAlertStatus = "watching" | "dipped" | "recovered" | "expired";

export interface RhcPriceAlert {
  id: number;
  name: string | null;
  token_address: string;
  token_symbol: string | null;
  /** MC captured at creation — an alert is a delta from the moment you set it. */
  baseline_mc_usd: number;
  drop_pct: number;
  /** Null for a dip-only, terminal alert. */
  recovery_pct: number | null;
  status: RhcPriceAlertStatus;
  /** Lowest MC seen since the dip fired. */
  dip_low_mc_usd: number | null;
  dip_fired_at: string | null;
  delivery_mode: DeliveryMode;
  webhook_url: string | null;
  is_active: boolean;
  /** Alerts self-expire 30 days after creation. */
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RhcPriceAlertListResponse {
  chain: Chain;
  alerts: RhcPriceAlert[];
  _rid?: string;
}

export interface RhcPriceAlertCreateParams {
  name?: string;
  /** Must already be tracked on RHC with a market cap, else 400. */
  token_address: string;
  /** 0.01–99.99. */
  drop_pct: number;
  /** 0.01–1000. Omit for a dip-only, terminal alert. */
  recovery_pct?: number;
  /** Default `webhook`. */
  delivery_mode?: DeliveryMode;
  webhook_url?: string;
}

/**
 * How RHC alerts are evaluated. **Not parity with Solana**: these are polled off
 * `rhc_token_prices` rather than reacting to a live price loop, because the RHC
 * price writer emits no `pg_notify`. Effective latency is the poll interval plus
 * the token's own price-update cadence.
 */
export interface RhcPriceAlertEvaluation {
  mode: "polled";
  interval_seconds: number;
  note: string;
}

export interface RhcPriceAlertCreateResponse {
  chain: Chain;
  alert: RhcPriceAlert;
  /** Shown ONCE — null when `delivery_mode` is `websocket`. */
  webhook_secret: string | null;
  evaluation: RhcPriceAlertEvaluation;
  note: string;
  _rid?: string;
}

export interface RhcPriceAlertGetResponse {
  chain: Chain;
  alert: RhcPriceAlert;
  _rid?: string;
}

/**
 * `token_address`, `drop_pct` and `recovery_pct` are immutable — retuning a
 * threshold mid-flight would make the alert's recorded events uninterpretable.
 * Delete and recreate instead.
 */
export interface RhcPriceAlertUpdateParams {
  name?: string | null;
  delivery_mode?: DeliveryMode;
  webhook_url?: string | null;
  is_active?: boolean;
}

// ─── Price-alert events (/rhc/price-alerts/events) ───────────────────────────

export type RhcPriceAlertEventType = "dip" | "recovery";

export interface RhcPriceAlertEventsParams {
  /** Scope to one of your alerts — 404 if you do not own it. */
  alert_id?: number;
  event_type?: RhcPriceAlertEventType;
  /** ISO 8601 lower bound on `fired_at`. */
  since?: string;
  /** 1–500. Default: 50. */
  limit?: number;
}

export interface RhcPriceAlertEvent {
  id: number;
  alert_id: number;
  event_type: RhcPriceAlertEventType;
  fired_at: string;
  token_address: string;
  baseline_mc_usd: number;
  current_mc_usd: number;
  /** Measured drop at fire time, percent. */
  drop_pct_actual: number | null;
  dip_low_mc_usd: number | null;
  /** Measured bounce off the dip low, percent — recovery events only. */
  recovery_pct_actual: number | null;
  delivered: boolean;
  delivered_at: string | null;
}

export interface RhcPriceAlertEventsResponse {
  chain: Chain;
  events: RhcPriceAlertEvent[];
  count: number;
  _rid?: string;
}

// ─── KOL coordination rules (/rhc/kol/coordination/alerts) ───────────────────

export interface RhcCoordinationAlertRule {
  /** UUID. */
  id: string;
  name: string | null;
  /** Distinct tracked KOL buyers needed to fire (2–50). */
  min_kols: number;
  /** Rolling window those buys must land inside (1–60 minutes). */
  window_minutes: number;
  min_score: number;
  /** Minutes before the same token can fire again (1–1440). */
  cooldown_min: number;
  /** Score jump that breaks the cooldown early (0–100). */
  score_jump_break: number;
  min_mc_usd: number | null;
  max_mc_usd: number | null;
  delivery_mode: DeliveryMode;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcCoordinationAlertListResponse {
  chain: Chain;
  rules: RhcCoordinationAlertRule[];
  _rid?: string;
}

export interface RhcCoordinationAlertCreateParams {
  name?: string;
  /** 2–50. Default: 3. */
  min_kols?: number;
  /** 1–60. Default: 15. */
  window_minutes?: number;
  /** 0–100. Default: 0. */
  min_score?: number;
  /** 1–1440. Default: 30. */
  cooldown_min?: number;
  /** 0–100. Default: 20. */
  score_jump_break?: number;
  min_mc_usd?: number | null;
  max_mc_usd?: number | null;
  /** Default `websocket`. */
  delivery_mode?: DeliveryMode;
  webhook_url?: string;
}

/**
 * Which scorer components are real on RHC. Scores are comparable to the Solana
 * coordination scorer, but `earliness` is defaulted (RHC has no early-entry
 * equivalent) while `quality` is a real KOL win-rate. Each fired signal records
 * the same breakdown in its `score_inputs`.
 */
export interface RhcCoordinationAlertScoring {
  score_version: string;
  quality: string;
  earliness: string;
  note: string;
}

export interface RhcCoordinationAlertCreateResponse {
  chain: Chain;
  rule: RhcCoordinationAlertRule;
  /** Shown ONCE — null when `delivery_mode` is `websocket`. */
  webhook_secret: string | null;
  scoring: RhcCoordinationAlertScoring;
  note: string;
  _rid?: string;
}

export interface RhcCoordinationAlertGetResponse {
  chain: Chain;
  rule: RhcCoordinationAlertRule;
  _rid?: string;
}

export interface RhcCoordinationAlertUpdateParams {
  name?: string | null;
  min_kols?: number;
  window_minutes?: number;
  min_score?: number;
  cooldown_min?: number;
  score_jump_break?: number;
  min_mc_usd?: number | null;
  max_mc_usd?: number | null;
  delivery_mode?: DeliveryMode;
  webhook_url?: string | null;
  is_active?: boolean;
}

// ─── First-touch subscriptions (/rhc/kol/first-touches/subscriptions) ────────

/** Auto-classified trader style of the first-touching KOL. */
export type RhcFirstTouchStrategy = "scalper" | "day_trader" | "swing" | "inactive" | "unscored";

/**
 * Push filters. Deliberately NOT the Solana set: RHC has no scout score, so
 * `min_scout_tier` / `min_n_touches` are absent rather than silently matching
 * nothing. Unknown keys are rejected with a 400.
 */
export interface RhcFirstTouchFilters {
  /** Only this KOL's first touches (0x, 40 hex). */
  kol?: string;
  /** Minimum first-buy size in ETH (0–100000). */
  min_first_buy_eth?: number;
  /** 0–1. Win-rate on CLOSED positions; a KOL who has never sold is dropped, not counted as a loser. */
  min_kol_winrate?: number;
  strategy?: RhcFirstTouchStrategy;
  min_mc_usd?: number;
  max_mc_usd?: number;
}

export interface RhcFirstTouchSubscription {
  /** UUID. */
  id: string;
  name: string | null;
  filters: RhcFirstTouchFilters;
  delivery_mode: DeliveryMode;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcFirstTouchSubscriptionListResponse {
  chain: Chain;
  subscriptions: RhcFirstTouchSubscription[];
  _rid?: string;
}

export interface RhcFirstTouchSubscriptionCreateParams {
  name?: string;
  /** Default `{}` — every first touch. */
  filters?: RhcFirstTouchFilters;
  /** Default `websocket`. */
  delivery_mode?: DeliveryMode;
  webhook_url?: string;
}

export interface RhcFirstTouchSubscriptionCreateResponse {
  chain: Chain;
  subscription: RhcFirstTouchSubscription;
  /** Shown ONCE — null when `delivery_mode` is `websocket`. */
  webhook_secret: string | null;
  note: string;
  _rid?: string;
}

export interface RhcFirstTouchSubscriptionGetResponse {
  chain: Chain;
  subscription: RhcFirstTouchSubscription;
  _rid?: string;
}

export interface RhcFirstTouchSubscriptionUpdateParams {
  name?: string | null;
  /** Whole-object REPLACE, not a merge — merging would make removing a filter inexpressible. */
  filters?: RhcFirstTouchFilters;
  delivery_mode?: DeliveryMode;
  webhook_url?: string | null;
  is_active?: boolean;
}

// ─── Stream token (POST /stream/token) ───────────────────────────────────────

export interface StreamToken {
  token: string;
  ws_url: string;
  expires_at?: string;
  [key: string]: unknown;
}

// ─── Client config ───────────────────────────────────────────────────────────

export interface RobinhoodConfig {
  /**
   * MadeOnSol API key (starts with `msk_`). The same key works across every tier.
   * Get a key at https://madeonsol.com/pricing (3-day free trial on Pro/Ultra).
   */
  apiKey: string;
  /** Max automatic retries on 429 / 5xx / network error (default: 2). */
  maxRetries?: number;
  /** Override the API base URL (advanced/testing). Default: https://madeonsol.com/api/v1 */
  baseUrl?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bound GET transport handed to each namespace. */
type Fetcher = <T>(url: string) => Promise<T>;
/** Bound body-capable transport (POST/PATCH/DELETE). DELETE sends no body. */
type Sender = <T>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;

// ─── KOL namespace (client.kol) ──────────────────────────────────────────────

class KolClient {
  /**
   * Coordination alert RULES — the push form of `coordination()`. Fires when N+
   * tracked KOLs buy the same token inside a rolling window. PRO+.
   */
  readonly coordinationAlerts: CoordinationAlertsClient;
  /**
   * First-touch SUBSCRIPTIONS — the push form of `firstTouches()`. Fires when a
   * token gets its first tracked-KOL buy. ULTRA+.
   */
  readonly firstTouchSubscriptions: FirstTouchSubscriptionsClient;

  constructor(
    private readonly _fetch: Fetcher,
    private readonly _baseUrl: string,
    send: Sender,
  ) {
    this.coordinationAlerts = new CoordinationAlertsClient(_fetch, _baseUrl, send);
    this.firstTouchSubscriptions = new FirstTouchSubscriptionsClient(_fetch, _baseUrl, send);
  }

  /**
   * Live feed of KOL trades on Robinhood Chain — every buy/sell from tracked
   * Solana KOLs' verified EVM wallets, attributed to the effective trading
   * account (tx.from, or the ERC-4337 userOp sender when bundled). Tier: **BASIC**.
   * @param params Optional filters: limit (1–100), before cursor, action, kol wallet (0x), min_eth.
   */
  feed(params?: RhcKolFeedParams): Promise<RhcKolFeedResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/feed", params as Record<string, string | number | undefined>));
  }

  /**
   * KOL activity leaderboard — ranked by trade count then net ETH flow. Tier: **BASIC**.
   * @param params Optional: period (24h/7d/30d), limit.
   */
  leaderboard(params?: RhcKolLeaderboardParams): Promise<RhcKolLeaderboardResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/leaderboard", params as Record<string, string | number | undefined>));
  }

  /**
   * Consensus tokens — bought by 2+ distinct tracked KOLs inside the window. Tier: **BASIC**.
   * @param params Optional: window (5m/15m/1h/6h/24h, default 1h).
   */
  hotTokens(params?: RhcHotTokensParams): Promise<RhcHotTokensResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/hot-tokens", params as Record<string, string | undefined>));
  }

  /**
   * Single KOL profile — aggregate stats over the last 200 RHC trades plus the
   * 50 most recent. Tier: **BASIC**.
   * @param wallet KOL EVM wallet address (0x, 40 hex).
   */
  wallet(wallet: string): Promise<RhcKolProfileResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/kol/${encodeURIComponent(wallet)}`));
  }

  /**
   * KOL clustering — tokens bought by `min_kols`+ DISTINCT tracked KOLs inside
   * the window, ranked by KOL count then buy volume. Deeper than `hotTokens()`:
   * each row carries the per-KOL breakdown, net ETH flow, an accumulating vs
   * distributing signal, exit state, and how fast the cohort piled in
   * (`time_to_consensus_sec`). Tier: **BASIC**.
   * @param params Optional: period (1h/6h/24h/7d, default 24h), min_kols (2–50), limit (1–50), min_mc_usd / max_mc_usd (MC at the FIRST KOL buy).
   */
  coordination(params?: RhcKolCoordinationParams): Promise<RhcKolCoordinationResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/coordination", params as Record<string, string | number | undefined>));
  }

  /**
   * First touches — the globally earliest buy by ANY tracked KOL per token, the
   * discovery signal. Each event carries the entry size in ETH, the MC at entry,
   * and the current + peak MC so you can score how the call aged. `limit` is
   * clamped to 20 below PRO, and `first_kol.evm_address` is ULTRA-only.
   * Tier: **BASIC**.
   * @param params Optional: limit, since, before cursor, min_eth, token_age_max_min, launchpad, min_mc_usd / max_mc_usd.
   */
  firstTouches(params?: RhcFirstTouchesParams): Promise<RhcKolFirstTouchesResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/first-touches", params as Record<string, string | number | undefined>));
  }
}

// ─── Tokens namespace (client.tokens) ────────────────────────────────────────

class TokensClient {
  constructor(
    private readonly _fetch: <T>(url: string) => Promise<T>,
    private readonly _baseUrl: string,
    private readonly _post: <T>(url: string, body?: unknown) => Promise<T>,
  ) {}

  /**
   * Robinhood Chain token discovery — live-priced tokens with MC, liquidity,
   * peak MC + drawdown, launchpad, and deployer tier. Tier: **PRO+**.
   * @param params Optional: limit, sort, min_mc_usd, min_liquidity_usd, launchpad.
   */
  list(params?: RhcTokensListParams): Promise<RhcTokensListResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/tokens", params as Record<string, string | number | undefined>));
  }

  /**
   * Full snapshot for one token — metadata, live price/MC/FDV, peak + drawdown,
   * deployer reputation, KOL activity, and pool inventory. Tier: **BASIC**.
   * @param address Token address (0x, 40 hex).
   */
  get(address: string): Promise<RhcTokenSnapshot> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}`));
  }

  /**
   * 1-minute OHLC candles — price + market-cap OHLC, close liquidity, volume
   * with buy/sell split, and trade counts. Tier: **PRO+**.
   * @param address Token address (0x, 40 hex).
   * @param params Optional: limit (1–1000, default 240), from, to.
   */
  candles(address: string, params?: RhcCandlesParams): Promise<RhcCandlesResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/candles`, params as Record<string, string | number | undefined>));
  }

  /**
   * KOL consensus on a token — distinct KOL buyers vs sellers, exit rate, net
   * ETH flow, median entry MC, first touch. ULTRA adds buyer/exited wallet lists.
   * Tier: **PRO+**.
   * @param address Token address (0x, 40 hex).
   */
  kolConsensus(address: string): Promise<RhcKolConsensusResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/kol-consensus`));
  }

  /**
   * Early-buyer quality — a 0–100 read on the first-20 buyer cohort (win-rate,
   * KOL presence, bot-domination, bundle-buyer legs, dump-cluster ensemble).
   * Tier: **BASIC**.
   * @param address Token address (0x, 40 hex).
   */
  buyerQuality(address: string): Promise<RhcBuyerQualityResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/buyer-quality`));
  }

  /**
   * Launch-bundle detection — flags a same-block early-buyer cluster (3+ first
   * buys in one block) and reports how much of what it bought it still holds.
   * Field-gated by tier: BASIC scalar; PRO top-10 wallets; ULTRA full cohort + identity.
   * Tier: **BASIC**.
   * @param address Token address (0x, 40 hex).
   */
  bundle(address: string): Promise<RhcBundleResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/bundle`));
  }

  /**
   * Top traders of one token, ranked by REALIZED ETH flow (sell − buy).
   *
   * `net_eth` is not PnL: it does not value a trader's remaining bag, so a wallet
   * that bought and still holds ranks last. Use `wallet.pnl()` for FIFO
   * cost-basis PnL. Rows are enriched with wallet reputation (win-rate, bot
   * heuristic, KOL identity), dump-cluster membership and early-buyer rank.
   * Tier: **PRO+** (50 rows; ULTRA/BUSINESS raises the cap to 200).
   * @param address Token address (0x, 40 hex).
   */
  topTraders(address: string, params?: RhcTopTradersParams): Promise<RhcTopTradersResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/top-traders`, params as Record<string, string | number | undefined>));
  }

  /**
   * Net buy/sell flow split by mutually-exclusive trader cohort.
   *
   * Sign convention: `net_eth = sell − buy`, so a POSITIVE value means the cohort
   * DISTRIBUTED (took ETH out) and negative means it accumulated. Cohort ladder
   * order is the priority order: kol → bot → dump_cluster → early_buyer →
   * unprofiled → smart_money → retail. Tier: **PRO+**.
   * @param address Token address (0x, 40 hex).
   * @param window Lookback window. Default "24h".
   */
  flow(address: string, window?: RhcFlowWindow): Promise<RhcFlowResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/flow`, { window }));
  }

  /**
   * Peak market cap, drawdown from peak, and the running high-water curve.
   *
   * Returns TWO peaks because they disagree: `peak_mc_usd_recorded` is the stored
   * high-water mark that deployer runner-rate and the $40K graduation bar key
   * off, and `peak_mc_usd_observed` is the max of 1-minute candle highs —
   * trade-level truth, always ≥ recorded, because the recorded value is sampled
   * from write batches and can miss an intra-batch spike. Candle history starts
   * 2026-07-15; `observed_covers_full_history` says whether the observed figure
   * spans the token's whole life. Tier: **PRO+**.
   * @param address Token address (0x, 40 hex).
   */
  peakHistory(address: string, params?: RhcPeakHistoryParams): Promise<RhcPeakHistoryResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/peak-history`, params as Record<string, string | number | undefined>));
  }

  /**
   * EVM-native risk assessment, computed LIVE against the Robinhood Chain node.
   *
   * This is NOT the Solana risk model — EVM has no mint or freeze authority, and
   * only ~2% of Robinhood Chain tokens even expose an owner function, so an
   * absent capability flag is the norm rather than a safety signal. The
   * discriminating signals are proxy upgradeability, LP custody and above all
   * **sellability**, which is simulated at the chain head and never cached
   * (whether a token can be sold changes the moment an owner flips a setting).
   * Tier: **PRO+**.
   * @param address Token address (0x, 40 hex).
   */
  risk(address: string): Promise<RhcRiskResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/risk`));
  }

  /**
   * Exact holder set and concentration, folded from ERC-20 Transfer logs.
   *
   * Not trade-derived — balances come from log replay and are reconciled against
   * on-chain `totalSupply()` at a pinned block. **Check `verified` first**: false
   * means the reconstruction is incomplete for that token and the response says
   * why. Concentration EXCLUDES liquidity pools and burn addresses from the
   * circulating denominator (the largest holder is otherwise the token's own
   * pool) and reports them as `pool_held_pct` / `burned_pct`. Balances are raw
   * uint256 returned as decimal STRINGS to preserve precision.
   * Tier: **PRO+** (50 rows; ULTRA/BUSINESS raises the cap to 200).
   * @param address Token address (0x, 40 hex).
   */
  holders(address: string, params?: RhcHoldersParams): Promise<RhcHoldersResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/tokens/${encodeURIComponent(address)}/holders`, params as Record<string, string | number | undefined>));
  }

  /**
   * Up to 50 tokens in ONE call — metadata, live price/MC/FDV/liquidity, peak MC,
   * primary DEX, and the deployer reputation block. Set-based server-side (three
   * queries regardless of batch size), not a fan-out of `get()`. Every requested
   * address is echoed back — unknown ones as `{ found: false }` — so positions
   * line up with what you sent. Narrower than `get()` on purpose: it does NOT
   * bundle buyer-quality; use `batchBuyerQuality()` for that. Tier: **BASIC**.
   * @param addresses 1–50 token addresses (0x, 40 hex). Duplicates are de-duplicated server-side.
   */
  batch(addresses: string[]): Promise<RhcTokenBatchResponse> {
    return this._post(buildUrl(this._baseUrl, "/rhc/token/batch"), { addresses });
  }

  /**
   * Early-buyer quality for several tokens in one call — the batched form of
   * `buyerQuality()`. A token that fails to score degrades to an entry carrying
   * `error` instead of failing the batch. Tier: **BASIC**.
   *
   * **The cap is 20, not the Solana batch cap of 50** — RHC buyer-quality is a
   * per-token cohort computation (ordered early-buyer scan + bundle detection +
   * alpha/cluster joins), not one set-based query, so 50 would mean ~200
   * round-trips behind a single request. The cap is echoed as `max_addresses`.
   * @param addresses 1–20 token addresses (0x, 40 hex).
   */
  batchBuyerQuality(addresses: string[]): Promise<RhcBatchBuyerQualityResponse> {
    return this._post(buildUrl(this._baseUrl, "/rhc/tokens/batch/buyer-quality"), { addresses });
  }
}

// ─── Deployer Hunter namespace (client.deployerHunter) ───────────────────────

class DeployerHunterClient {
  constructor(private readonly _fetch: <T>(url: string) => Promise<T>, private readonly _baseUrl: string) {}

  /**
   * Deployer reputation leaderboard — ranked over a 5-min-refresh rollup of every
   * launchpad token indexed (40k+ deployers). Tier: **BASIC**.
   *
   * Tier semantics (migrations 267 + 269): `elite` / `good` are earned on the
   * $100K `runner_rate` **and** require 24h of deployer history — the $40K bar
   * proved farmable by operators mass-relaunching one ticker across rotating
   * wallets. `graduation_rate` still means the $40K bar and is still returned,
   * but it no longer sets the tier; `spammer` is the one label that still keys
   * off it. Call `stats()` for the thresholds in force.
   * @param params Optional: sort, tier, min_tokens, limit (1–50), offset.
   */
  leaderboard(params?: RhcDeployerLeaderboardParams): Promise<RhcDeployerLeaderboardResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/deployer-hunter/leaderboard", params as Record<string, string | number | undefined>));
  }

  /**
   * Single deployer profile — full reputation row plus their 50 most recent
   * tokens enriched with live + peak MC. Unknown wallets return 200 with
   * `is_deployer: false`. Tier: **BASIC**.
   * @param address Deployer EVM wallet address (0x, 40 hex).
   */
  profile(address: string): Promise<RhcDeployerProfileResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/deployer-hunter/${encodeURIComponent(address)}`));
  }

  /**
   * Is this deployer getting better or worse? Current + longest hit/miss streaks,
   * a rolling 10-launch success curve, best/worst stretches, deploy cadence, and
   * how many launches they burn between a miss and the next hit. Tier: **BASIC**.
   *
   * The per-token success event is the **$40K peak-MC graduation** (echoed as
   * `success_metric`), deliberately NOT the $100K runner bar that migrations
   * 267 + 269 moved TIERS onto — $100K is rare enough that most deployers would
   * return an all-zero curve, and a trajectory needs events to have a shape.
   * Analysis is capped at 500 launches; `truncated` says whether the curve is
   * the whole story. Unknown wallets return 200 with `is_deployer: false`.
   * @param address Deployer EVM wallet address (0x, 40 hex).
   */
  trajectory(address: string): Promise<RhcDeployerTrajectoryResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/deployer-hunter/${encodeURIComponent(address)}/trajectory`));
  }

  /**
   * One deployer's full paginated launch history, enriched with live MC, peak MC
   * and liquidity. `profile()` caps `recent_tokens` at 50 and is a point-in-time
   * read — this is the enumerable list with limit/offset and `has_more`.
   * Tier: **BASIC**.
   *
   * Note `sort: "peak_mc_usd"` orders the fetched PAGE only (the response echoes
   * `sort_scope: "page"`), because peak MC lives in another table — it is not a
   * global top-tokens ranking. Use `bestTokens()` for a real ranking.
   * @param address Deployer EVM wallet address (0x, 40 hex).
   * @param params Optional: limit (1–100, default 50), offset, sort (first_seen_at | peak_mc_usd).
   */
  tokens(address: string, params?: RhcDeployerTokensParams): Promise<RhcDeployerTokensResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/deployer-hunter/${encodeURIComponent(address)}/tokens`, params as Record<string, string | number | undefined>));
  }

  /**
   * Full token-deploy history for one deployer plus their reputation row.
   * Tier: **PRO+** — the point-in-time `profile()` stays BASIC. RHC has no
   * per-day reputation snapshots, so this is a deploy history, not a daily tier
   * time-series; for the shape-over-time read use `trajectory()`.
   * @param address Deployer EVM wallet address (0x, 40 hex).
   * @param params Optional: limit (1–1000, default 100), offset (0–100000).
   */
  history(address: string, params?: RhcDeployerHistoryParams): Promise<RhcDeployerHistoryResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/deployer-hunter/${encodeURIComponent(address)}/history`, params as Record<string, string | number | undefined>));
  }

  /**
   * The highest-peaking tokens launched by REPUTABLE (good/elite) deployers in a
   * window — "what did the deployers worth tracking actually produce". Gated on
   * reputation rather than raw peak MC; the unfiltered version is
   * `client.tokens.list({ sort: "peak_mc" })`. Tier: **BASIC**.
   *
   * Reputation here is the $100K `runner_rate` tier (+ 24h of deployer history),
   * not `graduation_rate`. If `truncated` is true the top-N was drawn from the
   * 1000 most RECENT launches in the period rather than the whole period.
   * @param params Optional: period (24h/7d/30d/all, default 7d), limit (1–50, default 10).
   */
  bestTokens(params?: RhcBestTokensParams): Promise<RhcBestTokensResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/deployer-hunter/best-tokens", params as Record<string, string | number | undefined>));
  }

  /**
   * Chain-wide deployer reputation summary — population and token count per tier,
   * the reputable-deployer count, spam token share, and 24h/7d alert volume: the
   * denominator for any "is this deployer rare?" question. Tier: **BASIC**.
   *
   * Also returns `tier_rules`, the thresholds actually in force, so you can read
   * what `elite` currently means instead of guessing from the label — `elite` /
   * `good` are earned on the $100K `runner_rate` plus 24h of deployer history
   * (migrations 267 + 269), while `spammer` still keys off `graduation_rate`.
   */
  stats(): Promise<RhcDeployerStatsResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/deployer-hunter/stats"));
  }

  /**
   * Deployer signal feed — new deploys and graduations from tracked deployers,
   * newest first. Tier: **BASIC** (ULTRA gets the full limit; BASIC/PRO share a
   * 50-alert cap). Poll forward with `since: next_event_at`, page back with
   * `before: next_before`.
   *
   * Two things worth knowing. **Tradability is filtered by default**: alerts on
   * tokens with `liquidity_usd` under $100 — unknown liquidity included, since on
   * RHC that usually means a drained pool — are dropped, because a $45K-MC alert
   * on a $68 pool is not a signal. Pass `include_untradeable: true` for the raw
   * tape; the active setting is echoed as `tradability_filter`. And **`tier` is
   * resolved at read time** from the live reputation view, so an alert can never
   * advertise a reputation the deployer has since lost — the snapshot comes back
   * as `tier_at_alert` with `tier_is_stale` flagging drift, and `deployer_tier`
   * filters on the resolved value.
   * @param params Optional: deployer_tier, priority, alert_type, launchpad, min_mc, limit, offset, since, before, include_untradeable.
   */
  alerts(params?: RhcDeployerAlertsParams): Promise<RhcDeployerAlertsResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/deployer-hunter/alerts", params as Record<string, string | number | boolean | undefined>));
  }

  /**
   * Recent graduations, newest peak first, with token metadata and the deployer's
   * tier. On RHC a graduation is the **$40K peak-MC milestone**, not a
   * bonding-curve completion — noxa/pons/clanker launch direct-to-DEX with no
   * curve — so the set is defined purely by peak MC. `min_peak` only raises that
   * floor. Tier: **BASIC**.
   * @param params Optional: deployer_tier, min_peak, limit (1–200, default 50).
   */
  recentBonds(params?: RhcRecentBondsParams): Promise<RhcRecentBondsResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/deployer-hunter/recent-bonds", params as Record<string, string | number | undefined>));
  }
}

// ─── Copy-trade rules namespace (client.copyTrade) ───────────────────────────

/**
 * Server-side copy-trade rules: MadeOnSol watches the Robinhood Chain tape and
 * pushes you a signal when a wallet you follow trades — webhook, WebSocket, or
 * both. **Quotas are per chain**: RHC rules never consume your Solana budget.
 * Tier: **PRO+**.
 */
class CopyTradeClient {
  constructor(
    private readonly _fetch: Fetcher,
    private readonly _baseUrl: string,
    private readonly _send: Sender,
  ) {}

  /**
   * Your Robinhood Chain copy-trade rules. Tier: **PRO+**.
   * `GET /rhc/copytrade/subscriptions`
   */
  list(): Promise<RhcCopyTradeListResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/copytrade/subscriptions"));
  }

  /**
   * Create a copy-trade rule — fires when one of `source_wallets` trades on RHC.
   *
   * Sizes are **ETH, not SOL**, and there is deliberately **no market-cap band**:
   * the RHC trade event carries no market cap, so a band could only be a
   * per-event DB lookup in the hot path of a ~3.3M-trades/day chain. The response
   * carries `webhook_secret` **once** — store it, it is never shown again.
   * Tier: **PRO+**. `POST /rhc/copytrade/subscriptions`
   */
  create(params: RhcCopyTradeCreateParams): Promise<RhcCopyTradeCreateResponse> {
    return this._send("POST", buildUrl(this._baseUrl, "/rhc/copytrade/subscriptions"), params);
  }

  /**
   * Fetch one copy-trade rule. Tier: **PRO+**.
   * `GET /rhc/copytrade/subscriptions/{id}`
   * @param id Numeric rule id.
   */
  get(id: number): Promise<RhcCopyTradeGetResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/copytrade/subscriptions/${id}`));
  }

  /**
   * Partially update a copy-trade rule. The per-tier wallet cap is re-checked, so
   * a PRO rule cannot be PATCHed past its limit. Tier: **PRO+**.
   * `PATCH /rhc/copytrade/subscriptions/{id}`
   * @param id Numeric rule id.
   */
  update(id: number, params: RhcCopyTradeUpdateParams): Promise<RhcCopyTradeGetResponse> {
    return this._send("PATCH", buildUrl(this._baseUrl, `/rhc/copytrade/subscriptions/${id}`), params);
  }

  /**
   * Delete a copy-trade rule (its fired signals cascade). Tier: **PRO+**.
   * `DELETE /rhc/copytrade/subscriptions/{id}`
   * @param id Numeric rule id.
   */
  delete(id: number): Promise<RhcDeletedResponse> {
    return this._send("DELETE", buildUrl(this._baseUrl, `/rhc/copytrade/subscriptions/${id}`));
  }

  /**
   * Fire history for your copy-trade rules — the catch-up path when a webhook was
   * missed or the WS channel dropped. Retained 7 days. Tier: **PRO+**.
   * `GET /rhc/copytrade/signals`
   * @param params Optional: subscription_id, since (ISO 8601), limit (1–500).
   */
  signals(params?: RhcCopyTradeSignalsParams): Promise<RhcCopyTradeSignalsResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/copytrade/signals", params as Record<string, string | number | undefined>));
  }
}

// ─── Price alerts namespace (client.priceAlerts) ─────────────────────────────

/**
 * Market-cap dip/recovery alerts on Robinhood Chain tokens. Quota is per chain.
 *
 * **RHC alerts are polled (~15s), not sub-second like the Solana ones.**
 * `rhc_token_prices` is written by the RHC ingester on a separate box and emits
 * no `pg_notify`, so there is nothing to react to — effective latency is the
 * poll interval plus the token's own price-update cadence. Every create response
 * spells this out in its `evaluation` block. Tier: **PRO+**.
 */
class PriceAlertsClient {
  constructor(
    private readonly _fetch: Fetcher,
    private readonly _baseUrl: string,
    private readonly _send: Sender,
  ) {}

  /**
   * Your Robinhood Chain price alerts. Tier: **PRO+**. `GET /rhc/price-alerts`
   */
  list(): Promise<RhcPriceAlertListResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/price-alerts"));
  }

  /**
   * Create a price alert. The baseline MC is captured **now**, so the alert is a
   * delta from the moment you set it, and the token must already be tracked with
   * a market cap (else 400). Alerts self-expire after 30 days.
   * Tier: **PRO+**. `POST /rhc/price-alerts`
   */
  create(params: RhcPriceAlertCreateParams): Promise<RhcPriceAlertCreateResponse> {
    return this._send("POST", buildUrl(this._baseUrl, "/rhc/price-alerts"), params);
  }

  /**
   * Fetch one price alert. Tier: **PRO+**. `GET /rhc/price-alerts/{id}`
   * @param id Numeric alert id.
   */
  get(id: number): Promise<RhcPriceAlertGetResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/price-alerts/${id}`));
  }

  /**
   * Update a price alert. Only `name`, `delivery_mode`, `webhook_url` and
   * `is_active` are mutable — retuning a threshold mid-flight would make the
   * alert's recorded events uninterpretable, so delete and recreate instead.
   * Tier: **PRO+**. `PATCH /rhc/price-alerts/{id}`
   * @param id Numeric alert id.
   */
  update(id: number, params: RhcPriceAlertUpdateParams): Promise<RhcPriceAlertGetResponse> {
    return this._send("PATCH", buildUrl(this._baseUrl, `/rhc/price-alerts/${id}`), params);
  }

  /**
   * Delete a price alert (its events cascade). Tier: **PRO+**.
   * `DELETE /rhc/price-alerts/{id}`
   * @param id Numeric alert id.
   */
  delete(id: number): Promise<RhcDeletedResponse> {
    return this._send("DELETE", buildUrl(this._baseUrl, `/rhc/price-alerts/${id}`));
  }

  /**
   * Dip and recovery events for your price alerts — the catch-up path for a
   * missed webhook or a dropped WS channel. Retained 30 days. Tier: **PRO+**.
   * `GET /rhc/price-alerts/events`
   * @param params Optional: alert_id, event_type (dip | recovery), since, limit (1–500).
   */
  events(params?: RhcPriceAlertEventsParams): Promise<RhcPriceAlertEventsResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/price-alerts/events", params as Record<string, string | number | undefined>));
  }
}

// ─── Coordination alert rules namespace (client.kol.coordinationAlerts) ──────

/**
 * Push rules over KOL coordination — fire when N+ distinct tracked KOLs buy the
 * same token inside a rolling window. The polling read is
 * `client.kol.coordination()`. Quota is per chain. Tier: **PRO+**.
 */
class CoordinationAlertsClient {
  constructor(
    private readonly _fetch: Fetcher,
    private readonly _baseUrl: string,
    private readonly _send: Sender,
  ) {}

  /**
   * Your RHC coordination rules. Tier: **PRO+**.
   * `GET /rhc/kol/coordination/alerts`
   */
  list(): Promise<RhcCoordinationAlertListResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/coordination/alerts"));
  }

  /**
   * Create a coordination rule.
   *
   * Scoring is the shared v1 scorer, so the number is comparable to Solana, but
   * `earliness` is **defaulted** on RHC (there is no early-entry equivalent)
   * while `quality` is a real KOL win-rate — the response's `scoring` block
   * records which components are real, and every fired signal repeats it in
   * `score_inputs`. Tier: **PRO+**. `POST /rhc/kol/coordination/alerts`
   */
  create(params: RhcCoordinationAlertCreateParams): Promise<RhcCoordinationAlertCreateResponse> {
    return this._send("POST", buildUrl(this._baseUrl, "/rhc/kol/coordination/alerts"), params);
  }

  /**
   * Fetch one coordination rule. Tier: **PRO+**.
   * `GET /rhc/kol/coordination/alerts/{id}`
   * @param id Rule UUID.
   */
  get(id: string): Promise<RhcCoordinationAlertGetResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`));
  }

  /**
   * Partially update a coordination rule. Tier: **PRO+**.
   * `PATCH /rhc/kol/coordination/alerts/{id}`
   * @param id Rule UUID.
   */
  update(id: string, params: RhcCoordinationAlertUpdateParams): Promise<RhcCoordinationAlertGetResponse> {
    return this._send("PATCH", buildUrl(this._baseUrl, `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`), params);
  }

  /**
   * Delete a coordination rule (its cooldown state and fired signals cascade).
   * Tier: **PRO+**. `DELETE /rhc/kol/coordination/alerts/{id}`
   * @param id Rule UUID.
   */
  delete(id: string): Promise<RhcDeletedResponse> {
    return this._send("DELETE", buildUrl(this._baseUrl, `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`));
  }
}

// ─── First-touch subscriptions namespace (client.kol.firstTouchSubscriptions) ─

/**
 * Push subscriptions over KOL first touches — fire when a token gets its FIRST
 * buy from any tracked KOL. The polling read is `client.kol.firstTouches()`.
 * Quota is per chain. Tier: **ULTRA+**.
 */
class FirstTouchSubscriptionsClient {
  constructor(
    private readonly _fetch: Fetcher,
    private readonly _baseUrl: string,
    private readonly _send: Sender,
  ) {}

  /**
   * Your RHC first-touch subscriptions. Tier: **ULTRA+**.
   * `GET /rhc/kol/first-touches/subscriptions`
   */
  list(): Promise<RhcFirstTouchSubscriptionListResponse> {
    return this._fetch(buildUrl(this._baseUrl, "/rhc/kol/first-touches/subscriptions"));
  }

  /**
   * Create a first-touch subscription.
   *
   * The filter set is deliberately **not** the Solana one: RHC has no scout
   * score, so `min_scout_tier` / `min_n_touches` are absent rather than silently
   * matching nothing — `min_kol_winrate` (win-rate on CLOSED positions) and
   * `strategy` are the quality gates. Unknown filter keys are **rejected with a
   * 400**, not ignored. Tier: **ULTRA+**.
   * `POST /rhc/kol/first-touches/subscriptions`
   */
  create(params: RhcFirstTouchSubscriptionCreateParams): Promise<RhcFirstTouchSubscriptionCreateResponse> {
    return this._send("POST", buildUrl(this._baseUrl, "/rhc/kol/first-touches/subscriptions"), params);
  }

  /**
   * Fetch one first-touch subscription. Tier: **ULTRA+**.
   * `GET /rhc/kol/first-touches/subscriptions/{id}`
   * @param id Subscription UUID.
   */
  get(id: string): Promise<RhcFirstTouchSubscriptionGetResponse> {
    return this._fetch(buildUrl(this._baseUrl, `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`));
  }

  /**
   * Update a first-touch subscription. `filters` is a whole-object **replace**,
   * not a merge — merging would make "remove this filter" inexpressible.
   * Tier: **ULTRA+**. `PATCH /rhc/kol/first-touches/subscriptions/{id}`
   * @param id Subscription UUID.
   */
  update(id: string, params: RhcFirstTouchSubscriptionUpdateParams): Promise<RhcFirstTouchSubscriptionGetResponse> {
    return this._send("PATCH", buildUrl(this._baseUrl, `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`), params);
  }

  /**
   * Delete a first-touch subscription. Tier: **ULTRA+**.
   * `DELETE /rhc/kol/first-touches/subscriptions/{id}`
   * @param id Subscription UUID.
   */
  delete(id: string): Promise<RhcDeletedResponse> {
    return this._send("DELETE", buildUrl(this._baseUrl, `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`));
  }
}

// ─── Stream namespace (client.stream) ────────────────────────────────────────

class StreamClient {
  constructor(
    private readonly _post: <T>(url: string) => Promise<T>,
    private readonly _baseUrl: string,
  ) {}

  /**
   * Generate a 24-hour WebSocket streaming token. Returns `ws_url` for the
   * Robinhood Chain event stream. Tier: **PRO+**.
   */
  getToken(): Promise<StreamToken> {
    return this._post(buildUrl(this._baseUrl, "/stream/token"));
  }

  /**
   * Open a managed real-time WebSocket stream for Robinhood Chain. Handles token
   * fetch + refresh, auto-reconnect with backoff, heartbeat liveness, and typed
   * events. Subscribe to `rhc:kol_trades`, `rhc:dex_trades` (ULTRA+), and the
   * four rule-engine channels (`rhc:copytrade:signals`, `rhc:price_alert:events`,
   * `rhc:kol:coordination`, `rhc:kol:first_touches`). Listen on `"warning"` to
   * catch server `channels_rejected` frames instead of silence.
   *
   * @example
   * const stream = client.stream.connect();
   * stream.on("rhc:kol_trade", (t) => console.log(t));
   * stream.subscribe(["rhc:kol_trades"]);
   */
  connect(opts?: Omit<StreamClientOptions, "getToken">): RobinhoodStream {
    return new RobinhoodStream({ ...opts, getToken: () => this.getToken() });
  }
}

// ─── Main client ─────────────────────────────────────────────────────────────

/**
 * Robinhood Chain API client (chain id 4663).
 *
 * All 52 Robinhood Chain endpoints: EVM-native on-chain trading intelligence —
 * live KOL trades and coordination, token discovery & bundles, the DEX trade
 * tape, OHLC candles, deployer reputation, smart-money wallets, and the four
 * push rule engines (copy-trade, price alerts, KOL coordination, first touches).
 * Authenticate with a MadeOnSol `msk_` key (same key, same base URL as the
 * Solana API — Robinhood Chain is bundled into every tier).
 *
 * Rule-engine quotas are **per chain** — RHC rules never consume your Solana
 * allowance.
 *
 * @example
 * ```ts
 * import { RobinhoodClient } from "robinhood-chain-sdk";
 *
 * const client = new RobinhoodClient({ apiKey: "msk_your_api_key_here" });
 *
 * const { trades } = await client.kol.feed({ limit: 10, action: "buy" });
 * const { tokens } = await client.kol.hotTokens({ window: "1h" });
 * const bundle = await client.tokens.bundle("0x1234…");
 *
 * // Push instead of poll: follow three wallets, 0.05 ETH per copy.
 * const { subscription } = await client.copyTrade.create({
 *   source_wallets: ["0xaaa…", "0xbbb…", "0xccc…"],
 *   sizing_mode: "fixed",
 *   sizing_amount: 0.05,
 *   delivery_mode: "websocket",
 * });
 * ```
 */
export class RobinhoodClient {
  /** KOL trade intelligence on Robinhood Chain — feed, leaderboard, hot tokens, per-wallet profile, coordination, first touches. */
  readonly kol: KolClient;
  /** Token intelligence — discovery, per-token snapshot, candles, KOL consensus, buyer quality, launch bundle, batch reads. */
  readonly tokens: TokensClient;
  /** Deployer reputation — leaderboard, profile, trajectory, launch history, best tokens, chain stats, alerts, recent graduations. */
  readonly deployerHunter: DeployerHunterClient;
  /** Copy-trade rule engine — follow wallets, get pushed a signal when they trade (PRO+). Quota is per chain. */
  readonly copyTrade: CopyTradeClient;
  /** Price-alert rule engine — MC dip/recovery alerts, polled ~15s (PRO+). Quota is per chain. */
  readonly priceAlerts: PriceAlertsClient;
  /** Managed WebSocket streaming (rhc:kol_trades, rhc:dex_trades + the four rule-engine channels) — PRO+. */
  readonly stream: StreamClient;

  private readonly _apiKey: string;
  private readonly _baseUrl: string;
  private readonly _maxRetries: number;

  constructor(config: RobinhoodConfig) {
    if (!config || !config.apiKey || typeof config.apiKey !== "string") {
      console.error(
        "\n[robinhood-chain-sdk] Missing API key.\n" +
        "  → Get a key at https://madeonsol.com/pricing (3-day free trial on Pro/Ultra)\n" +
        "  → Then: new RobinhoodClient({ apiKey: process.env.MADEONSOL_API_KEY })\n",
      );
      throw new Error(
        "RobinhoodClient: apiKey is required. Get a key at https://madeonsol.com/pricing",
      );
    }
    this._apiKey = config.apiKey;
    this._baseUrl = config.baseUrl ?? BASE_URL;
    this._maxRetries = config.maxRetries ?? 2;

    const boundGet = this._request.bind(this);
    const boundPost = ((url: string, body?: unknown) => this._requestWithBody("POST", url, body)) as <T>(url: string, body?: unknown) => Promise<T>;
    const boundSend = ((method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) =>
      this._requestWithBody(method, url, body)) as Sender;

    this.kol = new KolClient(boundGet, this._baseUrl, boundSend);
    this.tokens = new TokensClient(boundGet, this._baseUrl, boundPost);
    this.deployerHunter = new DeployerHunterClient(boundGet, this._baseUrl);
    this.copyTrade = new CopyTradeClient(boundGet, this._baseUrl, boundSend);
    this.priceAlerts = new PriceAlertsClient(boundGet, this._baseUrl, boundSend);
    this.stream = new StreamClient(boundPost, this._baseUrl);
  }

  /**
   * Robinhood Chain DEX trade tape — every Uniswap v2/v3/v4 swap on chain 4663,
   * each row carrying the effective trading account (tx.from, or the ERC-4337
   * userOp sender when bundled), gas/ordering for MEV analysis, and
   * KOL/deployer flags. Cursor via `next_before`. Tier: **PRO+**.
   * @param params Optional: limit, token (0x), dex, action, min_eth, before cursor.
   */
  trades(params?: RhcTradesParams): Promise<RhcTradesResponse> {
    return this._request(buildUrl(this._baseUrl, "/rhc/trades", params as Record<string, string | number | undefined>));
  }

  /**
   * Smart-money wallet ranking on Robinhood Chain — trader wallets ranked by
   * realized on-chain performance (net ETH, win rate, memecoin share), with
   * bot-fleet flagging and KOL-identity mapping. Tier: **PRO+**.
   * @param params Optional filters; see RhcAlphaWalletsParams.
   */
  alphaWallets(params?: RhcAlphaWalletsParams): Promise<RhcAlphaWalletsResponse> {
    return this._request(buildUrl(this._baseUrl, "/rhc/alpha-wallets", params as Record<string, string | number | undefined>));
  }

  private _headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this._apiKey}`,
      Accept: "application/json",
      "User-Agent": `robinhood-chain-sdk/${VERSION}`,
    };
  }

  private async _request<T>(url: string): Promise<T> {
    return this._send<T>("GET", url);
  }

  private async _requestWithBody<T>(method: string, url: string, body?: unknown): Promise<T> {
    return this._send<T>(method, url, body);
  }

  private async _send<T>(method: string, url: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: body !== undefined
        ? { ...this._headers(), "Content-Type": "application/json" }
        : this._headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, init);
      } catch (err) {
        // Network-level failure — retry with backoff, else surface it.
        lastErr = err;
        if (attempt < this._maxRetries) {
          await sleep(this._backoffMs(attempt, null));
          continue;
        }
        throw new RobinhoodError(
          `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
          0,
          null,
        );
      }

      // Retry rate-limits and transient server errors, honoring Retry-After / X-RateLimit-Reset.
      if ((response.status === 429 || response.status >= 500) && attempt < this._maxRetries) {
        await sleep(this._backoffMs(attempt, response));
        continue;
      }

      return this._handleResponse<T>(response);
    }
    // Unreachable in practice — the loop either returns or throws — but satisfies the type checker.
    throw new RobinhoodError(
      `Request failed after ${this._maxRetries + 1} attempts`,
      0,
      lastErr ?? null,
    );
  }

  /** Exponential backoff with jitter; prefers a server-provided retry hint when present. */
  private _backoffMs(attempt: number, response: Response | null): number {
    if (response) {
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        const secs = Number(retryAfter);
        if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 30_000);
      }
      const reset = response.headers.get("x-ratelimit-reset");
      if (reset) {
        const resetMs = Number(reset) - Date.now();
        if (Number.isFinite(resetMs) && resetMs > 0) return Math.min(resetMs, 30_000);
      }
    }
    const base = Math.min(500 * 2 ** attempt, 8_000);
    return base / 2 + Math.floor((base / 2) * Math.random());
  }

  private async _handleResponse<T>(response: Response): Promise<T> {
    let responseBody: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    if (!response.ok) {
      const body =
        typeof responseBody === "object" && responseBody !== null
          ? (responseBody as Record<string, unknown>)
          : null;
      const errField = body && typeof body.error === "string" ? body.error : null;
      const msgField = body && typeof body.message === "string" ? body.message : null;
      const message = errField ?? msgField ?? `Request failed with status ${response.status}`;
      throw new RobinhoodError(message, response.status, responseBody);
    }

    return responseBody as T;
  }
}

// Convenience alias.
export type { RobinhoodConfig as Config };

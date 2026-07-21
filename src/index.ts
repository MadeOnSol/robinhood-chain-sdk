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
  /** Authoritative trader wallet (tx.from). */
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
   * Get a free key at https://madeonsol.com/developer
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

// ─── KOL namespace (client.kol) ──────────────────────────────────────────────

class KolClient {
  constructor(private readonly _fetch: <T>(url: string) => Promise<T>, private readonly _baseUrl: string) {}

  /**
   * Live feed of KOL trades on Robinhood Chain — every buy/sell from tracked
   * Solana KOLs' verified EVM wallets, attributed via tx.from. Tier: **BASIC**.
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
}

// ─── Tokens namespace (client.tokens) ────────────────────────────────────────

class TokensClient {
  constructor(private readonly _fetch: <T>(url: string) => Promise<T>, private readonly _baseUrl: string) {}

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
}

// ─── Deployer Hunter namespace (client.deployerHunter) ───────────────────────

class DeployerHunterClient {
  constructor(private readonly _fetch: <T>(url: string) => Promise<T>, private readonly _baseUrl: string) {}

  /**
   * Deployer reputation leaderboard — ranked over a 5-min-refresh rollup of every
   * launchpad token indexed (40k+ deployers). Tier: **BASIC**.
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
   * events. Subscribe to `rhc:kol_trades` and/or `rhc:trades`.
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
 * EVM-native on-chain trading intelligence — live KOL trades, token discovery
 * & bundles, the DEX trade tape, OHLC candles, deployer reputation, and
 * smart-money wallets. Authenticate with a MadeOnSol `msk_` key (same key, same
 * base URL as the Solana API — Robinhood Chain is bundled into every tier).
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
 * ```
 */
export class RobinhoodClient {
  /** KOL trade intelligence on Robinhood Chain — feed, leaderboard, hot tokens, per-wallet profile. */
  readonly kol: KolClient;
  /** Token intelligence — discovery, per-token snapshot, candles, KOL consensus, buyer quality, launch bundle. */
  readonly tokens: TokensClient;
  /** Deployer reputation — leaderboard + per-deployer profile. */
  readonly deployerHunter: DeployerHunterClient;
  /** Managed WebSocket streaming (rhc:kol_trades, rhc:trades) — PRO+. */
  readonly stream: StreamClient;

  private readonly _apiKey: string;
  private readonly _baseUrl: string;
  private readonly _maxRetries: number;

  constructor(config: RobinhoodConfig) {
    if (!config || !config.apiKey || typeof config.apiKey !== "string") {
      console.error(
        "\n[robinhood-chain-sdk] Missing API key.\n" +
        "  → Get a free key (no card) at https://madeonsol.com/developer\n" +
        "  → Then: new RobinhoodClient({ apiKey: process.env.MADEONSOL_API_KEY })\n",
      );
      throw new Error(
        "RobinhoodClient: apiKey is required. Get a free key at https://madeonsol.com/developer",
      );
    }
    this._apiKey = config.apiKey;
    this._baseUrl = config.baseUrl ?? BASE_URL;
    this._maxRetries = config.maxRetries ?? 2;

    const boundGet = this._request.bind(this);
    const boundPost = ((url: string, body?: unknown) => this._requestWithBody("POST", url, body)) as <T>(url: string, body?: unknown) => Promise<T>;

    this.kol = new KolClient(boundGet, this._baseUrl);
    this.tokens = new TokensClient(boundGet, this._baseUrl);
    this.deployerHunter = new DeployerHunterClient(boundGet, this._baseUrl);
    this.stream = new StreamClient(boundPost, this._baseUrl);
  }

  /**
   * Robinhood Chain DEX trade tape — every Uniswap v2/v3/v4 swap on chain 4663,
   * each row carrying the real trader wallet (tx.from), gas/ordering for MEV
   * analysis, and KOL/deployer flags. Cursor via `next_before`. Tier: **PRO+**.
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

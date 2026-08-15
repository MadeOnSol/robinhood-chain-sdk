# robinhood-chain-sdk

[![npm version](https://img.shields.io/npm/v/robinhood-chain-sdk?style=flat-square)](https://www.npmjs.com/package/robinhood-chain-sdk)
[![npm downloads](https://img.shields.io/npm/dm/robinhood-chain-sdk?style=flat-square)](https://www.npmjs.com/package/robinhood-chain-sdk)
[![GitHub stars](https://img.shields.io/github/stars/madeonsol/robinhood-chain-sdk?style=flat-square&logo=github)](https://github.com/madeonsol/robinhood-chain-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> **Robinhood Chain API / SDK — EVM-native on-chain trading intelligence for Robinhood Chain (chain id 4663).** The official, fully-typed, zero-dependency TypeScript client for all 52 endpoints: live KOL trades and coordination, token discovery, batch reads & launch-bundle detection, the Uniswap DEX trade tape, 1-minute OHLC candles, deployer reputation with alerts and trajectories, smart-money wallet rankings, and four **push rule engines** (copy-trade, price alerts, KOL coordination, first touches) — served from a self-hosted Robinhood Chain node.

> ⭐ **[Star on GitHub](https://github.com/madeonsol/robinhood-chain-sdk)** · 📂 **[Examples](./examples/)** · 🌐 **[Robinhood Chain](https://madeonsol.com/robinhood)** · 📚 **[API docs](https://madeonsol.com/api-docs)**

Robinhood Chain (RHC) is an **Arbitrum Orbit L2, chain id 4663**. This SDK wraps the MadeOnSol Robinhood Chain API — every field is EVM-native (`token_address` lowercase `0x`, `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`). It runs in Node.js ≥ 18 and edge runtimes with **zero runtime dependencies** (native `fetch`; the WebSocket stream uses the optional `ws` package on Node < 22 and the platform WebSocket everywhere else).

The KOL→EVM mapping is unique to MadeOnSol: each tracked Solana KOL's Robinhood-Chain wallet is recovered by tracing their Solana→EVM bridge deposits (deBridge / Relay / Mayan / Wormhole), then attributed on-chain to the effective trading account (`tx.from`, or the ERC-4337 userOp sender when the trade was bundled). Robinhood Chain coverage is **bundled into every MadeOnSol tier at no extra cost — same `msk_` API key, same base URL** as the Solana product.

> **New in 0.6.0 — wallet intelligence.** Ten new operations covering the Robinhood Chain wallet surface, which had no SDK binding at all until now: a new `client.wallet` namespace — `profile()`, `pnl()`, `positions()`, `trades()`, `watchlist()`, `track()`, `untrack()`, `relabel()`, `trackedTrades()` and `trackedSummary()`. Everything is **ETH**-denominated, and cost basis is FIFO over a rolling 90-day window — `cost_basis_observable_from` names the date the window opens, so a position opened before it reads as a sell with no matching buy. The profile / PnL / positions trio shares ONE snapshot cache server-side, so calling all three on an address costs roughly one computation rather than three; `cache_hit` says which call paid for it. Watchlist quotas are **per chain** (PRO 50 / ULTRA 100 / BUSINESS 500 RHC wallets), independent of your Solana list.

## New in 0.5.0 — stream fixes

No REST changes; everything below is about `client.stream`.

- **Channel names corrected.** `StreamChannel` now lists the six real RHC channels — `rhc:kol_trades`, `rhc:dex_trades` (the DEX firehose, ULTRA+), `rhc:copytrade:signals`, `rhc:price_alert:events`, `rhc:kol:coordination`, `rhc:kol:first_touches`. 0.4.0's `rhc:trades` never existed server-side; the server now accepts it as a deprecated alias of `rhc:dex_trades`, and the literal stays in the union marked `@deprecated` so 0.4.0 code keeps compiling.
- **Event names corrected.** The firehose broadcasts `rhc:dex_trade` — a 0.4.0 `on("rhc:trade", …)` handler never fired, and is now a **compile error** so you find it. `StreamEventName` covers all six channels: `rhc:kol_trade`, `rhc:dex_trade`, `rhc:copytrade:signal`, `rhc:price_alert:dip` / `rhc:price_alert:recovery`, `rhc:kol:coordination`, `rhc:kol:first_touch`.
- **Server warnings surfaced.** The server answers a bad subscribe (typo'd or tier-gated channel) with a `channels_rejected` warning frame — 0.4.0 silently dropped it, so the stream just looked healthy-but-quiet. It now emits a typed `"warning"` lifecycle event (`StreamWarning`: `code`, `rejected`, `valid_channels`, `message`).

## Quick start (10 seconds)

```bash
npm install robinhood-chain-sdk
```

```ts
import { RobinhoodClient } from "robinhood-chain-sdk";

const client = new RobinhoodClient({ apiKey: "msk_..." }); // free key at madeonsol.com/pricing

// Tokens being bought by 2+ tracked KOLs on Robinhood Chain right now
const { tokens } = await client.kol.hotTokens({ window: "1h" });
console.log(tokens[0]?.token_symbol, tokens[0]?.kols_buying, "KOLs, net", tokens[0]?.net_eth, "ETH");
```

Requires **Node.js ≥ 18** (native `fetch`). Works in Cloudflare Workers, Vercel Edge, Bun, and Deno.

## Authentication

Get a free API key at **[madeonsol.com/pricing](https://madeonsol.com/pricing)** — keys start with `msk_`. The same key unlocks both the Solana API and Robinhood Chain.

```ts
const client = new RobinhoodClient({
  apiKey: process.env.MADEONSOL_API_KEY!,
  maxRetries: 2, // optional — auto-retry on 429 / 5xx with backoff (default 2)
});
```

## Every endpoint → SDK method

All 52 Robinhood Chain operations live under `https://madeonsol.com/api/v1`. Bearer `msk_` auth on every call. Everything is a `GET` except the two batch reads and the four rule engines at the bottom, which are full CRUD.

| # | Endpoint | SDK method | Tier |
|---|---|---|---|
| 1 | `GET /rhc/kol/feed` | `client.kol.feed(params?)` | BASIC |
| 2 | `GET /rhc/kol/leaderboard` | `client.kol.leaderboard(params?)` | BASIC |
| 3 | `GET /rhc/kol/hot-tokens` | `client.kol.hotTokens(params?)` | BASIC |
| 4 | `GET /rhc/kol/coordination` | `client.kol.coordination(params?)` | BASIC |
| 5 | `GET /rhc/kol/first-touches` | `client.kol.firstTouches(params?)` | BASIC |
| 6 | `GET /rhc/kol/{wallet}` | `client.kol.wallet(wallet)` | BASIC |
| 7 | `GET /rhc/trades` | `client.trades(params?)` | PRO+ |
| 8 | `GET /rhc/tokens` | `client.tokens.list(params?)` | PRO+ |
| 9 | `GET /rhc/tokens/{address}` | `client.tokens.get(address)` | BASIC |
| 10 | `GET /rhc/tokens/{address}/candles` | `client.tokens.candles(address, params?)` | PRO+ |
| 11 | `GET /rhc/tokens/{address}/kol-consensus` | `client.tokens.kolConsensus(address)` | PRO+ |
| 12 | `GET /rhc/tokens/{address}/buyer-quality` | `client.tokens.buyerQuality(address)` | BASIC |
| 13 | `GET /rhc/tokens/{address}/bundle` | `client.tokens.bundle(address)` | BASIC |
| 14 | `GET /rhc/tokens/{address}/top-traders` | `client.tokens.topTraders(address, params?)` | PRO+ |
| 15 | `GET /rhc/tokens/{address}/flow` | `client.tokens.flow(address, window?)` | PRO+ |
| 16 | `GET /rhc/tokens/{address}/peak-history` | `client.tokens.peakHistory(address, params?)` | PRO+ |
| 17 | `GET /rhc/tokens/{address}/risk` | `client.tokens.risk(address)` | PRO+ |
| 18 | `GET /rhc/tokens/{address}/holders` | `client.tokens.holders(address, params?)` | PRO+ |
| 19 | `POST /rhc/token/batch` | `client.tokens.batch(addresses)` — max 50 | BASIC |
| 20 | `POST /rhc/tokens/batch/buyer-quality` | `client.tokens.batchBuyerQuality(addresses)` — **max 20** | BASIC |
| 21 | `GET /rhc/deployer-hunter/leaderboard` | `client.deployerHunter.leaderboard(params?)` | BASIC |
| 22 | `GET /rhc/deployer-hunter/best-tokens` | `client.deployerHunter.bestTokens(params?)` | BASIC |
| 23 | `GET /rhc/deployer-hunter/stats` | `client.deployerHunter.stats()` | BASIC |
| 24 | `GET /rhc/deployer-hunter/alerts` | `client.deployerHunter.alerts(params?)` | BASIC |
| 25 | `GET /rhc/deployer-hunter/recent-bonds` | `client.deployerHunter.recentBonds(params?)` | BASIC |
| 26 | `GET /rhc/deployer-hunter/{address}` | `client.deployerHunter.profile(address)` | BASIC |
| 27 | `GET /rhc/deployer-hunter/{address}/trajectory` | `client.deployerHunter.trajectory(address)` | BASIC |
| 28 | `GET /rhc/deployer-hunter/{address}/tokens` | `client.deployerHunter.tokens(address, params?)` | BASIC |
| 29 | `GET /rhc/deployer-hunter/{address}/history` | `client.deployerHunter.history(address, params?)` | PRO+ |
| 30 | `GET /rhc/alpha-wallets` | `client.alphaWallets(params?)` | PRO+ |
| 31 | `GET /rhc/copytrade/subscriptions` | `client.copyTrade.list()` | PRO+ |
| 32 | `POST /rhc/copytrade/subscriptions` | `client.copyTrade.create(params)` | PRO+ |
| 33 | `GET /rhc/copytrade/subscriptions/{id}` | `client.copyTrade.get(id)` | PRO+ |
| 34 | `PATCH /rhc/copytrade/subscriptions/{id}` | `client.copyTrade.update(id, params)` | PRO+ |
| 35 | `DELETE /rhc/copytrade/subscriptions/{id}` | `client.copyTrade.delete(id)` | PRO+ |
| 36 | `GET /rhc/copytrade/signals` | `client.copyTrade.signals(params?)` | PRO+ |
| 37 | `GET /rhc/price-alerts` | `client.priceAlerts.list()` | PRO+ |
| 38 | `POST /rhc/price-alerts` | `client.priceAlerts.create(params)` | PRO+ |
| 39 | `GET /rhc/price-alerts/{id}` | `client.priceAlerts.get(id)` | PRO+ |
| 40 | `PATCH /rhc/price-alerts/{id}` | `client.priceAlerts.update(id, params)` | PRO+ |
| 41 | `DELETE /rhc/price-alerts/{id}` | `client.priceAlerts.delete(id)` | PRO+ |
| 42 | `GET /rhc/price-alerts/events` | `client.priceAlerts.events(params?)` | PRO+ |
| 43 | `GET /rhc/kol/coordination/alerts` | `client.kol.coordinationAlerts.list()` | PRO+ |
| 44 | `POST /rhc/kol/coordination/alerts` | `client.kol.coordinationAlerts.create(params)` | PRO+ |
| 45 | `GET /rhc/kol/coordination/alerts/{id}` | `client.kol.coordinationAlerts.get(id)` | PRO+ |
| 46 | `PATCH /rhc/kol/coordination/alerts/{id}` | `client.kol.coordinationAlerts.update(id, params)` | PRO+ |
| 47 | `DELETE /rhc/kol/coordination/alerts/{id}` | `client.kol.coordinationAlerts.delete(id)` | PRO+ |
| 48 | `GET /rhc/kol/first-touches/subscriptions` | `client.kol.firstTouchSubscriptions.list()` | ULTRA+ |
| 49 | `POST /rhc/kol/first-touches/subscriptions` | `client.kol.firstTouchSubscriptions.create(params)` | ULTRA+ |
| 50 | `GET /rhc/kol/first-touches/subscriptions/{id}` | `client.kol.firstTouchSubscriptions.get(id)` | ULTRA+ |
| 51 | `PATCH /rhc/kol/first-touches/subscriptions/{id}` | `client.kol.firstTouchSubscriptions.update(id, params)` | ULTRA+ |
| 52 | `DELETE /rhc/kol/first-touches/subscriptions/{id}` | `client.kol.firstTouchSubscriptions.delete(id)` | ULTRA+ |
| + | `POST /stream/token` → WebSocket | `client.stream.connect()` | PRO+ |

## What you can build

- **KOL copy-trading on Robinhood Chain** — stream `client.kol.feed()` / the `rhc:kol_trades` channel and mirror verified-KOL buys, EVM-native. Or stop polling entirely: `client.copyTrade.create()` has the server watch the tape and push you a signal.
- **Push instead of poll** — four rule engines (`client.copyTrade`, `client.priceAlerts`, `client.kol.coordinationAlerts`, `client.kol.firstTouchSubscriptions`) deliver over webhook or WebSocket. **Quotas are per chain** — RHC rules never eat your Solana allowance.
- **Consensus scanner** — `client.kol.hotTokens()` surfaces tokens 2+ KOLs are accumulating; `client.kol.coordination()` adds the cohort composition behind it (per-KOL legs, accumulating vs distributing, exit state).
- **Discovery bot** — `client.kol.firstTouches()` gives the globally earliest KOL buy per token, filterable to tokens minutes old.
- **Launch-bundle / rug gate** — `client.tokens.bundle()` flags a same-block early-buyer bundle and how much of supply it still holds; `client.tokens.buyerQuality()` scores the first-20 cohort 0–100 with a dump-cluster ensemble.
- **Portfolio / watchlist refresh** — `client.tokens.batch()` prices up to 50 tokens in one call, `client.tokens.batchBuyerQuality()` scores up to 20.
- **MEV / sandwich analysis** — `client.trades()` gives every Uniswap v2/v3/v4 swap with the effective trading account (`trader_eoa`), `gas_price`, `tx_index`, and `method_selector`.
- **Deployer due-diligence** — `client.deployerHunter.leaderboard()` / `.profile()` / `.trajectory()` / `.tokens()` rank and profile 40k+ RHC deployers; `.stats()` gives the chain-wide denominator.
- **Deployer alert feed** — `client.deployerHunter.alerts()` pushes new deploys and graduations, tradability-filtered by default, with the tier resolved at read time.
- **Smart-money discovery** — `client.alphaWallets()` ranks trader wallets by realized net ETH, win rate, and memecoin share, flagging bot fleets and known KOLs.
- **Charting** — `client.tokens.candles()` returns 1-minute price + market-cap OHLC with buy/sell volume split.

## KOL trade intelligence — `client.kol`

### `client.kol.feed(params?)` — `GET /rhc/kol/feed` (BASIC)

Live buy/sell feed from tracked KOLs' verified Robinhood-Chain wallets, enriched with the token's current/peak MC, deployer tier, and `mc_multiple_since_trade` ("did the call run").

```ts
const { trades, next_before } = await client.kol.feed({
  limit: 50,       // 1–100
  action: "buy",   // "buy" | "sell"
  kol: "0xabc…",   // filter to one KOL's EVM wallet
  min_eth: 0.25,   // minimum trade size in ETH
  // before: next_before,  // cursor — page backwards
});
for (const t of trades) {
  console.log(t.kol_name, "bought", t.token_symbol, `${t.eth_amount} ETH`, `${t.mc_multiple_since_trade}x since`);
}
```

Returns `RhcKolFeedResponse` — `{ chain, trades: RhcKolFeedTrade[], count, data_age_seconds, next_before }`.

### `client.kol.leaderboard(params?)` — `GET /rhc/kol/leaderboard` (BASIC)

KOLs ranked by trade count then net ETH flow over `24h` / `7d` / `30d`. `net_eth` is buy−sell flow (not realized PnL).

```ts
const { leaderboard } = await client.kol.leaderboard({ period: "7d", limit: 25 });
```

### `client.kol.hotTokens(params?)` — `GET /rhc/kol/hot-tokens` (BASIC)

Tokens bought by **2+ distinct KOLs** in the window (`5m`/`15m`/`1h`/`6h`/`24h`) — a consensus signal.

```ts
const { tokens } = await client.kol.hotTokens({ window: "1h" });
```

### `client.kol.coordination(params?)` — `GET /rhc/kol/coordination` (BASIC)

Tokens bought by **`min_kols`+ distinct KOLs** in the window, ranked by KOL count then buy volume. Deeper than `hotTokens()`: each row carries the per-KOL breakdown, `net_eth` (buys − sells in-window), an `accumulating` / `distributing` signal, `exited_count` vs `holders_count`, and `time_to_consensus_sec` (how fast the cohort piled in).

```ts
const { coordination } = await client.kol.coordination({
  period: "24h",      // "1h" | "6h" | "24h" | "7d"
  min_kols: 3,        // 2–50
  limit: 20,          // 1–50
  max_mc_usd: 250_000, // MC at the FIRST KOL buy (unknown entry MC is dropped when a band is set)
});
for (const c of coordination) {
  console.log(c.token_symbol, c.kol_count, "KOLs", c.signal, `${c.net_eth} ETH net`, `${c.holders_count} still holding`);
}
```

RHC has no KOL winrate/strategy tables, so the Solana `avg_winrate_7d` / `coordination_score` fields are intentionally absent.

### `client.kol.firstTouches(params?)` — `GET /rhc/kol/first-touches` (BASIC)

The **globally earliest buy by any tracked KOL** per token — the discovery signal. Each event carries the entry size in ETH, `tx_hash`, `token_age_minutes` at first touch, the MC at entry, and the current + peak MC so you can score how the call aged.

```ts
const { events, next_before } = await client.kol.firstTouches({
  limit: 50,               // 1–100 — clamped to 20 below PRO
  token_age_max_min: 60,   // only tokens under an hour old at first touch
  min_eth: 0.1,
  // since: lastSeen,      // poll forward
  // before: next_before,  // page back
});
```

`first_kol.evm_address` is ULTRA-only; `name` and `twitter_url` are always returned.

### `client.kol.wallet(wallet)` — `GET /rhc/kol/{wallet}` (BASIC)

Aggregate stats over one KOL's last 200 RHC trades plus their 50 most recent.

```ts
const profile = await client.kol.wallet("0xabc…");
console.log(profile.kol_name, profile.stats.net_eth, "ETH net");
```

## DEX trade tape — `client.trades(params?)` — `GET /rhc/trades` (PRO+)

Every Uniswap v2/v3/v4 swap on chain 4663, ~sub-second from execution. Each row carries the effective trading account (`trader_eoa` — `tx.from` normally, or the ERC-4337 userOp sender when the trade was bundled; never the router or the bundler), gas/ordering for MEV work, pool state, and KOL/deployer flags. Cursor via `next_before`.

```ts
const { trades } = await client.trades({
  token: "0xdef…",     // filter to one token
  dex: "uniswap-v3",   // "uniswap-v2" | "uniswap-v3" | "uniswap-v4"
  min_eth: 1,
  limit: 100,
});
for (const t of trades) {
  console.log(t.trader_eoa, t.action, t.eth_amount, "ETH", "gas", t.gas_price, "gwei", t.is_kol ? `(KOL ${t.kol_name})` : "");
}
```

## Token intelligence — `client.tokens`

| Method | Endpoint | Tier | Returns |
|---|---|---|---|
| `list(params?)` | `/rhc/tokens` | PRO+ | Live-priced token discovery — MC, liquidity, peak MC + drawdown, launchpad, deployer tier. Sort by `last_trade` / `market_cap` / `liquidity` / `peak_mc`. |
| `get(address)` | `/rhc/tokens/{address}` | BASIC | Full snapshot: metadata, price/MC/FDV, peak + drawdown, deployer reputation block, KOL activity, pool inventory. |
| `candles(address, params?)` | `/rhc/tokens/{address}/candles` | PRO+ | 1-minute price + market-cap OHLC, close liquidity, volume with buy/sell split, trade counts. |
| `kolConsensus(address)` | `/rhc/tokens/{address}/kol-consensus` | PRO+ | KOL buyers vs sellers, `kol_exit_rate`, `net_flow_eth`, median entry MC, first touch. ULTRA adds buyer/exited wallet lists. |
| `buyerQuality(address)` | `/rhc/tokens/{address}/buyer-quality` | BASIC | 0–100 first-20 buyer-cohort quality — win-rate, KOL presence, bot-domination, bundle-buyer legs, dump-cluster ensemble. |
| `bundle(address)` | `/rhc/tokens/{address}/bundle` | BASIC | Same-block launch-bundle detection + how much of what the cohort bought it still holds. |
| `batch(addresses)` | `POST /rhc/token/batch` | BASIC | Up to **50** tokens in one call — metadata, price/MC/FDV/liquidity, peak MC, deployer reputation. |
| `batchBuyerQuality(addresses)` | `POST /rhc/tokens/batch/buyer-quality` | BASIC | Up to **20** tokens' early-buyer quality scores in one call. |
| `topTraders(address, params?)` | `/rhc/tokens/{address}/top-traders` | PRO+ | Lifetime per-trader performance on one token, ranked by realized ETH, with win-rate / bot / KOL / dump-cluster enrichment. |
| `flow(address, window?)` | `/rhc/tokens/{address}/flow` | PRO+ | Net buy/sell split by trader cohort — who is accumulating and who is distributing. |
| `peakHistory(address, params?)` | `/rhc/tokens/{address}/peak-history` | PRO+ | Peak MC, drawdown, and a running high-water curve. Returns both the recorded and the candle-derived observed peak. |
| `risk(address)` | `/rhc/tokens/{address}/risk` | PRO+ | EVM-native risk computed **live**: proxy upgradeability, mint/pause capability, LP custody, and a live honeypot sell-simulation. |
| `holders(address, params?)` | `/rhc/tokens/{address}/holders` | PRO+ | Exact holder set + concentration, folded from ERC-20 `Transfer` logs and reconciled against on-chain `totalSupply()`. |

### Who is actually making money — `topTraders(address, params?)` (PRO+)

```ts
const { traders } = await client.tokens.topTraders("0xdef…", { limit: 25 });
for (const t of traders) {
  console.log(t.trader_eoa, t.net_eth, t.win_rate, t.likely_bot ? "(bot)" : "");
}
```

> **`net_eth` is REALIZED flow (`sell − buy`), not PnL.** It does not value a trader's remaining bag, so a wallet that bought and still holds ranks **last**, not first. For FIFO cost-basis PnL use `client.wallet.pnl()`.

### Who is buying vs dumping — `flow(address, window?)` (PRO+)

```ts
const { cohorts } = await client.tokens.flow("0xdef…", "24h");
// net_eth = sell − buy, so POSITIVE means that cohort DISTRIBUTED.
const bots = cohorts.find((c) => c.cohort === "bot");
const smart = cohorts.find((c) => c.cohort === "smart_money");
```

Cohorts are mutually exclusive, assigned by priority: `kol` → `bot` → `dump_cluster` → `early_buyer` → `unprofiled` → `smart_money` → `retail`. `smart_money` is derived (win-rate ≥ 0.5 and net positive), and `unprofiled` is a real answer — that trader simply has not met the reputation thresholds yet.

### How far off the top — `peakHistory(address, params?)` (PRO+)

```ts
const p = await client.tokens.peakHistory("0xdef…", { window: "7d" });
console.log(p.peak.drawdown_from_peak, p.peak.peak_mc_usd_recorded, p.peak.peak_mc_usd_observed);
```

> **Two peaks are returned because they disagree.** `peak_mc_usd_recorded` is the stored high-water mark that deployer runner-rate and the $40K graduation bar key off; it is sampled from write batches, so it can undercount an intra-batch spike. `peak_mc_usd_observed` is the max of 1-minute candle highs — trade-level truth, and always ≥ recorded. Candle history begins 2026-07-15, so check `observed_covers_full_history` before treating the observed figure as a lifetime maximum.

### Can I actually sell this — `risk(address)` (PRO+)

```ts
const r = await client.tokens.risk("0xdef…");
if (r.sellability.sellable === "no") return; // bought-but-cannot-sell
if (r.flags.includes("upgradeable") || r.capabilities.can_mint) { /* treat with care */ }
```

> **This is not the Solana risk model.** EVM has no mint or freeze authority: across 300 random Robinhood Chain tokens only **2.3%** even expose an owner function and **0%** expose `mint` in their own bytecode — so an absent flag is the norm, **not** a safety signal. The signals that discriminate here are proxy upgradeability, LP custody and above all **sellability**, which is simulated at the chain head and never cached, because whether a token can be sold changes the instant an owner flips a setting. Note `owner.model: "none"` (no owner function at all) is a different answer from `"renounced"`.

### Who holds it — `holders(address, params?)` (PRO+)

```ts
const h = await client.tokens.holders("0xdef…", { limit: 50 });
if (!h.verified) console.warn("unverified:", h.unverified_reason);
console.log(h.concentration?.top10_share, h.concentration?.pool_held_pct);
```

> Balances are folded from ERC-20 `Transfer` logs — **not** derived from trades — and reconciled against on-chain `totalSupply()` at a pinned block. **Check `verified` first**: `false` means the reconstruction is incomplete for that token and `unverified_reason` says why. Concentration **excludes liquidity pools and burn addresses** from the circulating denominator (the largest holder of a token is otherwise its own pool) and reports them separately as `pool_held_pct` / `burned_pct`. `balance` is a raw uint256 returned as a decimal **string** — do not `Number()` it. Holder addresses may be ERC-4337 smart accounts, so `holder_count` is not a headcount of people.

```ts
// Launch-bundle + quality gate before buying
const { bundle } = await client.tokens.bundle("0xdef…");
const quality = await client.tokens.buyerQuality("0xdef…");
if (bundle.bundle_kind === "same_block" && (bundle.held_pct_of_supply ?? 0) > 0.2 && !bundle.fully_exited) {
  // bundle still sitting on supply — it can dump
}
if (quality.quality.signal === "negative") { /* skip */ }
```

> **EVM note:** Robinhood Chain is an Arbitrum Orbit L2 with no atomic multi-signer transaction, so a detected bundle is `bundle_kind: "same_block"` (or `"none"`) — there is no `atomic_tx` kind. KOL consensus is denominated in ETH (`net_flow_eth`).

### Batch reads

```ts
// Up to 50 tokens, one round-trip. Set-based server-side, not a fan-out of get().
// Every requested address is echoed back — unknown ones as { found: false } — so
// positions line up with what you sent.
const { tokens, requested, found } = await client.tokens.batch([token1, token2, token3]);
for (const t of tokens) {
  if (t.found) console.log(t.symbol, t.market_cap_usd, t.deployer?.tier);
}

// Early-buyer quality for several tokens. MAX 20 — not the Solana batch cap of 50,
// because each token is a per-token cohort computation (early-buyer scan + bundle
// detection + alpha/cluster joins), so 50 would mean ~200 round-trips behind one
// request. The cap comes back as `max_addresses`. A token that fails to score
// degrades to an entry carrying `error` instead of failing the whole batch.
const { tokens: scored } = await client.tokens.batchBuyerQuality([token1, token2]);
for (const q of scored) {
  if ("error" in q) console.warn(q.token_address, q.error);
  else console.log(q.token_address, q.quality.score, q.quality.signal);
}
```

## Deployer reputation — `client.deployerHunter`

Most RHC launchpads are direct-to-DEX (no bonding curve), so "graduation" is a market-cap milestone: `graduation_rate` = share of a deployer's tokens that reached a **$40K+** peak MC; `runner_rate` = share that reached **$100K+**. `tier` is `elite` / `good` / `neutral` / `spammer`.

> **Tier semantics (migrations 267 + 269).** `elite` / `good` are earned on the **$100K `runner_rate`** *and* require **24h of deployer history** — the $40K bar proved farmable by operators mass-relaunching one ticker across rotating wallets, and a wallet minutes old can hit 5 launches on RHC. `graduation_rate` still means the $40K bar and is still returned everywhere, but it **no longer sets the tier**; `spammer` is the one label that still keys off it. Ranking by `graduation_rate` is ranking on a metric the tier ignores. `stats()` returns the thresholds actually in force.

| Method | Endpoint | Tier | Returns |
|---|---|---|---|
| `leaderboard(params?)` | `/rhc/deployer-hunter/leaderboard` | BASIC | 40k+ deployers ranked over a 5-min-refresh rollup. |
| `profile(address)` | `/rhc/deployer-hunter/{address}` | BASIC | Reputation row + 50 most recent tokens. |
| `trajectory(address)` | `/rhc/deployer-hunter/{address}/trajectory` | BASIC | Getting better or worse — streaks, rolling 10-launch success curve, trend, cadence. |
| `tokens(address, params?)` | `/rhc/deployer-hunter/{address}/tokens` | BASIC | Full paginated launch history with live + peak MC and liquidity. |
| `history(address, params?)` | `/rhc/deployer-hunter/{address}/history` | PRO+ | Deploy history + reputation row, exact `total`, `graduated_pool`. |
| `bestTokens(params?)` | `/rhc/deployer-hunter/best-tokens` | BASIC | Highest-peaking tokens from reputable (elite/good) deployers in a window. |
| `stats()` | `/rhc/deployer-hunter/stats` | BASIC | Chain-wide summary — population per tier, spam share, alert volume, active `tier_rules`. |
| `alerts(params?)` | `/rhc/deployer-hunter/alerts` | BASIC | New-deploy / graduation signal feed, tradability-filtered, read-time tier. |
| `recentBonds(params?)` | `/rhc/deployer-hunter/recent-bonds` | BASIC | Recent $40K graduations, newest peak first. |

```ts
// Leaderboard — 40k+ deployers, 5-min-refresh rollup
const { deployers, has_more } = await client.deployerHunter.leaderboard({
  sort: "runner_rate",   // graduation_rate | runner_rate | tokens_deployed | best_peak_mc_usd | last_deploy_at
  tier: "elite",
  min_tokens: 3,
  limit: 20,
  offset: 0,
});

// One deployer — unknown wallets return 200 with is_deployer:false (not a 404)
const { is_deployer, deployer, recent_tokens } = await client.deployerHunter.profile("0xabc…");
```

### Is this deployer improving? — `trajectory(address)` (BASIC)

Current and longest hit/miss streaks, a rolling 10-launch success rate, best/worst stretches, average days between deploys, and how many launches they burn between a miss and the next hit.

```ts
const { trajectory, success_metric, truncated } = await client.deployerHunter.trajectory("0xabc…");
console.log(trajectory?.trend, trajectory?.current_streak, success_metric);
```

The per-token success event here is the **$40K graduation** (echoed as `success_metric`), deliberately *not* the $100K runner bar that sets tiers — $100K is rare enough that most deployers would return an all-zero curve, and a trajectory needs events to have a shape. Analysis is capped at 500 launches; `truncated` tells you whether the curve is the whole story.

### Launch history — `tokens(address, params?)` (BASIC) and `history(address, params?)` (PRO+)

```ts
// Enumerable launch history with live MC, peak MC and liquidity
const { tokens, total, has_more, sort_scope } = await client.deployerHunter.tokens("0xabc…", {
  limit: 50,             // 1–100
  offset: 0,             // 0–10000
  sort: "first_seen_at", // "first_seen_at" | "peak_mc_usd"
});

// PRO+ — the same history with graduated_pool and an exact total
const hist = await client.deployerHunter.history("0xabc…", { limit: 100, offset: 0 });
```

`sort: "peak_mc_usd"` orders the fetched **page** only (the response echoes `sort_scope: "page"`), because peak MC lives in another table — it is not a global top-tokens ranking. Use `bestTokens()` for that. `profile()` caps `recent_tokens` at 50 and is a point-in-time read; `tokens()` is the enumerable list.

### Best tokens + chain stats

```ts
// What did the deployers worth tracking actually produce?
const { tokens, reputable_deployers, truncated } = await client.deployerHunter.bestTokens({
  period: "7d",  // "24h" | "7d" | "30d" | "all"
  limit: 10,     // 1–50
});

// The denominator for "is this deployer rare?"
const stats = await client.deployerHunter.stats();
console.log(stats.by_tier, stats.spam_token_share, stats.tier_rules.elite, stats.runner_definition);
```

`bestTokens()` is gated on reputation rather than raw peak MC — the unfiltered version is `client.tokens.list({ sort: "peak_mc" })`. When `truncated` is true the top-N was drawn from the 1000 most *recent* launches in the period rather than the whole period.

### Deployer alerts — `alerts(params?)` (BASIC)

New deploys and graduations from tracked deployers, newest first. Poll forward with `since: next_event_at`, page back with `before: next_before`. ULTRA gets the full limit; BASIC/PRO share a 50-alert cap.

```ts
const { alerts, tradability_filter, next_event_at } = await client.deployerHunter.alerts({
  deployer_tier: "elite",     // filters on the RESOLVED tier
  alert_type: "new_deploy",   // "new_deploy" | "graduated"
  priority: "high",           // "high" | "medium"
  min_mc: 10_000,
  limit: 50,
  // include_untradeable: true, // opt out of the liquidity gate
});
for (const a of alerts) {
  console.log(a.token_symbol, a.tier, a.liquidity_usd, a.tier_is_stale ? `(was ${a.tier_at_alert})` : "");
}
```

Two things worth knowing:

- **Tradability is filtered by default.** Alerts on tokens with `liquidity_usd` below **$100** are dropped — unknown liquidity included, since on RHC that usually means a drained pool — because a $45K-MC alert on a $68 pool is not a signal. Pass `include_untradeable: true` for the raw tape; the active setting comes back as `tradability_filter`.
- **`tier` is resolved at read time** from the live reputation view, so an alert can never advertise a reputation the deployer has since lost. The snapshot written when the alert fired is returned as `tier_at_alert`, with `tier_is_stale` flagging drift, and `deployer_tier=` filters on the resolved value so the filter and the payload always agree.

### Recent graduations — `recentBonds(params?)` (BASIC)

```ts
const { tokens, graduation_mc } = await client.deployerHunter.recentBonds({
  deployer_tier: "good",
  min_peak: 100_000, // only raises the $40K floor, never lowers it
  limit: 50,         // 1–200
});
```

On RHC a graduation is the **$40K peak-MC milestone**, not a bonding-curve completion — noxa/pons/clanker launch direct-to-DEX with no curve — so the set is defined purely by peak MC.

## Smart-money wallets — `client.alphaWallets(params?)` — `GET /rhc/alpha-wallets` (PRO+)

The reverse of KOL discovery: rank Robinhood Chain trader wallets by realized on-chain performance. `net_eth` is realized net flow (sell − buy), `win_rate` is the share of tokens taken out profitably, `likely_bot` flags atomic-arb/MM fleets. RHC is dual-natured (launchpad memecoins vs tokenized stocks/stables), so filter with `min_memecoin_share` to isolate memecoin traders.

```ts
const { wallets } = await client.alphaWallets({
  classification: "smart_money", // all | human | bot | smart_money
  identity: "unknown",           // all | known_kol | unknown  (net-new RHC smart money)
  min_memecoin_share: 0.7,
  sort: "net_eth",               // net_eth | win_rate | trades | tokens | buy_eth | memecoin_share | last_trade_at
  limit: 25,
});
```

## Rule engines — push, not polling

Four server-side rule engines watch the Robinhood Chain tape for you and deliver over **webhook**, **WebSocket**, or both. **Every quota is per chain** — configuring RHC rules never consumes your Solana budget, and a full set of Solana rules leaves your RHC capacity untouched. A `webhook_secret` is returned **exactly once** on create (null when `delivery_mode` is `"websocket"`); payloads are signed HMAC-SHA256 over `` `<timestamp>.<body>` `` in the `X-MadeOnSol-Signature` header.

### Copy-trade — `client.copyTrade` (PRO+)

```ts
const { subscription, webhook_secret } = await client.copyTrade.create({
  name: "degen desk",
  source_wallets: ["0xaaa…", "0xbbb…", "0xccc…"], // 1–250, per-tier cap enforced server-side
  min_trade_eth: 0.01,
  only_action: "buy",        // buy | sell | both
  sizing_mode: "fixed",      // fixed | proportional | percent_source
  sizing_amount: 0.05,       // ETH when sizing_mode is "fixed"
  delivery_mode: "websocket",
});

await client.copyTrade.update(subscription.id, { is_active: false });
await client.copyTrade.delete(subscription.id); // fired signals cascade

// Catch-up path for a missed webhook / dropped WS — fires retained 7 days
const since = new Date(Date.now() - 3_600_000).toISOString();
const { signals } = await client.copyTrade.signals({ subscription_id: subscription.id, since });
```

Sizes are **ETH, not SOL**, and there is deliberately **no market-cap band** — the RHC trade event carries no market cap, so a band could only be a per-event DB lookup in the hot path of a ~3.3M-trades/day chain. `update()` re-checks the per-tier wallet cap, so a rule cannot be PATCHed past its limit.

### Price alerts — `client.priceAlerts` (PRO+)

```ts
const { alert, evaluation } = await client.priceAlerts.create({
  token_address: "0xdef…", // must already be tracked on RHC with a market cap
  drop_pct: 30,            // 0.01–99.99, measured from the MC captured RIGHT NOW
  recovery_pct: 15,        // omit for a dip-only, terminal alert
  webhook_url: "https://example.com/hook",
});
console.log(evaluation.mode, evaluation.interval_seconds); // "polled", ~15

const { events } = await client.priceAlerts.events({ alert_id: alert.id, event_type: "dip" });
```

> **RHC price alerts are polled (~15s), not sub-second like the Solana ones.** `rhc_token_prices` is written by the RHC ingester on a separate box and emits no `pg_notify`, so there is nothing to react to — effective latency is that interval plus the token's own price-update cadence. Every create response spells this out in its `evaluation` block. The baseline MC is captured at creation, so an alert is a delta from the moment you set it; alerts self-expire after 30 days, and only `name`, `delivery_mode`, `webhook_url` and `is_active` are mutable (retuning a threshold mid-flight would make the recorded events uninterpretable).

### KOL coordination rules — `client.kol.coordinationAlerts` (PRO+)

```ts
const { rule, scoring } = await client.kol.coordinationAlerts.create({
  min_kols: 3,          // 2–50 distinct tracked KOL buyers
  window_minutes: 15,   // 1–60 rolling window
  min_score: 40,        // 0–100
  cooldown_min: 30,     // 1–1440 before the same token can fire again
  score_jump_break: 20, // score jump that breaks the cooldown early
  delivery_mode: "websocket",
});
await client.kol.coordinationAlerts.update(rule.id, { min_kols: 4 }); // UUID id
```

> **Coordination scoring is comparable to Solana, but not identical.** The shared v1 scorer runs, `quality` is a real KOL win-rate, and `earliness` is **defaulted** — RHC has no early-entry equivalent. The create response's `scoring` block records which components are real, and every fired signal repeats it in `score_inputs`.

### KOL first-touch subscriptions — `client.kol.firstTouchSubscriptions` (ULTRA+)

```ts
const { subscription } = await client.kol.firstTouchSubscriptions.create({
  name: "early hands",
  filters: {
    min_first_buy_eth: 0.05,
    min_kol_winrate: 0.5,   // win-rate on CLOSED positions
    strategy: "swing",      // scalper | day_trader | swing | inactive | unscored
    min_mc_usd: 10_000,
  },
  delivery_mode: "websocket",
});

// `filters` is a whole-object REPLACE, not a merge — {} clears every filter
await client.kol.firstTouchSubscriptions.update(subscription.id, { filters: {} });
```

> **First-touch filters are not the Solana set.** RHC has no scout score, so `min_scout_tier` and `min_n_touches` do not exist here rather than silently matching nothing; `min_kol_winrate` and `strategy` are the quality gates. Unknown filter keys are rejected with a **400**, not ignored.

## Streaming — `client.stream` (PRO+)

Managed WebSocket with token fetch + 24h refresh, auto-reconnect with backoff, heartbeat liveness, and typed events. Six RHC channels:

| Channel | Emits | Tier | Scope |
|---|---|---|---|
| `rhc:kol_trades` | `rhc:kol_trade` | PRO+ | broadcast — the live KOL tape |
| `rhc:dex_trades` | `rhc:dex_trade` | **ULTRA+** | broadcast — the full DEX firehose |
| `rhc:copytrade:signals` | `rhc:copytrade:signal` | PRO+ | user-scoped — only **your** rules' fires |
| `rhc:price_alert:events` | `rhc:price_alert:dip`, `rhc:price_alert:recovery` | PRO+ | user-scoped; ~15s polled, not sub-second |
| `rhc:kol:coordination` | `rhc:kol:coordination` | PRO+ | user-scoped — only **your** rules' fires |
| `rhc:kol:first_touches` | `rhc:kol:first_touch` | PRO+ | broadcast — ULTRA gates only the first-touch *subscription CRUD*, not this channel |

> **Deprecated:** `rhc:trades` was never a real channel — 0.4.0 subscribers got a `channels_rejected` warning and silence. The server now accepts it as an alias of `rhc:dex_trades` (and acks it under the canonical name), and the SDK keeps the literal marked `@deprecated` so 0.4.0 code compiles. Use `rhc:dex_trades`.

```ts
const stream = client.stream.connect();

stream
  .on("open", () => console.log("connected"))
  .on("rhc:kol_trade", (trade) => console.log("KOL trade", trade))
  .on("rhc:dex_trade", (trade) => console.log("DEX trade", trade))
  // New in 0.5.0 — the server tells you when a channel was refused (typo or
  // tier gate); 0.4.0 dropped this frame and the stream just stayed silent.
  .on("warning", (w) => console.warn("rejected:", w.code, w.rejected, w.valid_channels))
  .on("error", (err) => console.error(err));

stream.subscribe(["rhc:kol_trades", "rhc:dex_trades"]);
// …later
stream.close(); // clean shutdown — short-lived scripts exit promptly
```

On **Node < 22**, install the optional `ws` package (`npm i ws`) for the fastest clean exit; on Node ≥ 22 and in browsers the platform WebSocket is used automatically. You can also inject an implementation via `client.stream.connect({ WebSocketImpl })`.

## Error handling

Every method throws `RobinhoodError` on a non-2xx response, with `.status`, `.body`, `.message`, and `.requestId` (the API's `_rid` — include it when reporting issues). Rate-limits (`429`) and transient server errors (`5xx`) are retried automatically with exponential backoff, honoring `Retry-After` / `X-RateLimit-Reset`.

```ts
import { RobinhoodError } from "robinhood-chain-sdk";

try {
  await client.trades({ limit: 100 }); // PRO+
} catch (err) {
  if (err instanceof RobinhoodError) {
    if (err.status === 403) console.error("Upgrade required:", err.message);
    else console.error(err.status, err.requestId, err.message);
  }
}
```

## Types & constants

Fully-typed responses and params for all 52 endpoints are exported (`RhcKolFeedResponse`, `RhcKolCoordinationResponse`, `RhcKolFirstTouchesResponse`, `RhcTradesResponse`, `RhcTokenSnapshot`, `RhcTokenBatchResponse`, `RhcBatchBuyerQualityResponse`, `RhcBundleResponse`, `RhcTopTradersResponse`, `RhcFlowResponse`, `RhcPeakHistoryResponse`, `RhcRiskResponse`, `RhcHoldersResponse`, `RhcDeployerTrajectoryResponse`, `RhcDeployerTokensResponse`, `RhcDeployerHistoryResponse`, `RhcBestTokensResponse`, `RhcDeployerStatsResponse`, `RhcDeployerAlertsResponse`, `RhcRecentBondsResponse`, `RhcAlphaWalletsResponse`, plus the rule engines: `RhcCopyTradeSubscription`, `RhcCopyTradeCreateParams`, `RhcCopyTradeSignal`, `RhcPriceAlert`, `RhcPriceAlertEvaluation`, `RhcPriceAlertEvent`, `RhcCoordinationAlertRule`, `RhcCoordinationAlertScoring`, `RhcFirstTouchSubscription`, `RhcFirstTouchFilters`, `RhcDeletedResponse`, …), plus shared types (`DeployerTier`, `TradeAction`, `UniswapVersion`, `DeliveryMode`, `RhcBundleKind`, `RhcAlertType`, `RhcAlertPriority`, `RhcCoordinationSignal`) and the `CHAIN_ID` constant (`4663`).

## Links

- **Robinhood Chain** — [madeonsol.com/robinhood](https://madeonsol.com/robinhood)
- **Pricing & free API key** — [madeonsol.com/pricing](https://madeonsol.com/pricing) (Robinhood Chain bundled into every tier)
- **API docs** — [madeonsol.com/api-docs](https://madeonsol.com/api-docs)
- **npm** — [robinhood-chain-sdk](https://www.npmjs.com/package/robinhood-chain-sdk)
- **GitHub** — [madeonsol/robinhood-chain-sdk](https://github.com/madeonsol/robinhood-chain-sdk)

## License

MIT © MadeOnSol

# robinhood-chain-sdk

[![npm version](https://img.shields.io/npm/v/robinhood-chain-sdk?style=flat-square)](https://www.npmjs.com/package/robinhood-chain-sdk)
[![npm downloads](https://img.shields.io/npm/dm/robinhood-chain-sdk?style=flat-square)](https://www.npmjs.com/package/robinhood-chain-sdk)
[![GitHub stars](https://img.shields.io/github/stars/madeonsol/robinhood-chain-sdk?style=flat-square&logo=github)](https://github.com/madeonsol/robinhood-chain-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> **Robinhood Chain API / SDK — EVM-native on-chain trading intelligence for Robinhood Chain (chain id 4663).** The official, fully-typed, zero-dependency TypeScript client for live KOL trades, token discovery & launch-bundle detection, the Uniswap DEX trade tape, 1-minute OHLC candles, deployer reputation, and smart-money wallet rankings — served from a self-hosted Robinhood Chain node.

> ⭐ **[Star on GitHub](https://github.com/madeonsol/robinhood-chain-sdk)** · 📂 **[Examples](./examples/)** · 🌐 **[Robinhood Chain](https://madeonsol.com/robinhood)** · 📚 **[API docs](https://madeonsol.com/api-docs)**

Robinhood Chain (RHC) is an **Arbitrum Orbit L2, chain id 4663**. This SDK wraps the MadeOnSol Robinhood Chain API — every field is EVM-native (`token_address` lowercase `0x`, `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`). It runs in Node.js ≥ 18 and edge runtimes with **zero runtime dependencies** (native `fetch`; the WebSocket stream uses the optional `ws` package on Node < 22 and the platform WebSocket everywhere else).

The KOL→EVM mapping is unique to MadeOnSol: each tracked Solana KOL's Robinhood-Chain wallet is recovered by tracing their Solana→EVM bridge deposits (deBridge / Relay / Mayan / Wormhole), then attributed on-chain via `tx.from`. Robinhood Chain coverage is **bundled into every MadeOnSol tier at no extra cost — same `msk_` API key, same base URL** as the Solana product.

New customers get a **3-day free trial** of Pro or Ultra when you pay by card — full access, nothing charged during the trial, cancel anytime. Start at [madeonsol.com/pricing](https://madeonsol.com/pricing).

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

All 14 Robinhood Chain endpoints live under `https://madeonsol.com/api/v1`. Bearer `msk_` auth on every call.

| # | Endpoint | SDK method | Tier |
|---|---|---|---|
| 1 | `GET /rhc/kol/feed` | `client.kol.feed(params?)` | BASIC |
| 2 | `GET /rhc/kol/leaderboard` | `client.kol.leaderboard(params?)` | BASIC |
| 3 | `GET /rhc/kol/hot-tokens` | `client.kol.hotTokens(params?)` | BASIC |
| 4 | `GET /rhc/kol/{wallet}` | `client.kol.wallet(wallet)` | BASIC |
| 5 | `GET /rhc/trades` | `client.trades(params?)` | PRO+ |
| 6 | `GET /rhc/tokens` | `client.tokens.list(params?)` | PRO+ |
| 7 | `GET /rhc/tokens/{address}` | `client.tokens.get(address)` | BASIC |
| 8 | `GET /rhc/tokens/{address}/candles` | `client.tokens.candles(address, params?)` | PRO+ |
| 9 | `GET /rhc/tokens/{address}/kol-consensus` | `client.tokens.kolConsensus(address)` | PRO+ |
| 10 | `GET /rhc/tokens/{address}/buyer-quality` | `client.tokens.buyerQuality(address)` | BASIC |
| 11 | `GET /rhc/tokens/{address}/bundle` | `client.tokens.bundle(address)` | BASIC |
| 12 | `GET /rhc/deployer-hunter/leaderboard` | `client.deployerHunter.leaderboard(params?)` | BASIC |
| 13 | `GET /rhc/deployer-hunter/{address}` | `client.deployerHunter.profile(address)` | BASIC |
| 14 | `GET /rhc/alpha-wallets` | `client.alphaWallets(params?)` | PRO+ |
| + | `POST /stream/token` → WebSocket | `client.stream.connect()` | PRO+ |

## What you can build

- **KOL copy-trading on Robinhood Chain** — stream `client.kol.feed()` / the `rhc:kol_trades` channel and mirror verified-KOL buys, EVM-native.
- **Consensus scanner** — `client.kol.hotTokens()` surfaces tokens 2+ KOLs are accumulating, ranked by buyer count then ETH flow.
- **Launch-bundle / rug gate** — `client.tokens.bundle()` flags a same-block early-buyer bundle and how much of supply it still holds; `client.tokens.buyerQuality()` scores the first-20 cohort 0–100 with a dump-cluster ensemble.
- **MEV / sandwich analysis** — `client.trades()` gives every Uniswap v2/v3/v4 swap with the real trader EOA (`tx.from`), `gas_price`, `tx_index`, and `method_selector`.
- **Deployer due-diligence** — `client.deployerHunter.leaderboard()` / `.profile()` rank 40k+ RHC deployers (graduation = $40K peak MC, runner = $100K).
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

### `client.kol.wallet(wallet)` — `GET /rhc/kol/{wallet}` (BASIC)

Aggregate stats over one KOL's last 200 RHC trades plus their 50 most recent.

```ts
const profile = await client.kol.wallet("0xabc…");
console.log(profile.kol_name, profile.stats.net_eth, "ETH net");
```

## DEX trade tape — `client.trades(params?)` — `GET /rhc/trades` (PRO+)

Every Uniswap v2/v3/v4 swap on chain 4663, ~sub-second from execution. Each row carries the authoritative trader wallet (`trader_eoa` = `tx.from`, not the router), gas/ordering for MEV work, pool state, and KOL/deployer flags. Cursor via `next_before`.

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

## Deployer reputation — `client.deployerHunter`

Most RHC launchpads are direct-to-DEX (no bonding curve), so "graduation" is a market-cap milestone: `graduation_rate` = share of a deployer's tokens that reached a **$40K+** peak MC; `runner_rate` = share that reached **$100K+**. `tier` is `elite` / `good` / `neutral` / `spammer`.

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

## Streaming — `client.stream` (PRO+)

Managed WebSocket with token fetch + 24h refresh, auto-reconnect with backoff, heartbeat liveness, and typed events. Channels: **`rhc:kol_trades`** and **`rhc:trades`**.

```ts
const stream = client.stream.connect();

stream
  .on("open", () => console.log("connected"))
  .on("rhc:kol_trade", (trade) => console.log("KOL trade", trade))
  .on("rhc:trade", (trade) => console.log("DEX trade", trade))
  .on("error", (err) => console.error(err));

stream.subscribe(["rhc:kol_trades", "rhc:trades"]);
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

Fully-typed responses and params for all 14 endpoints are exported (`RhcKolFeedResponse`, `RhcTradesResponse`, `RhcTokenSnapshot`, `RhcBundleResponse`, `RhcAlphaWalletsResponse`, …), plus shared types (`DeployerTier`, `TradeAction`, `UniswapVersion`, `RhcBundleKind`) and the `CHAIN_ID` constant (`4663`).

## Links

- **Robinhood Chain** — [madeonsol.com/robinhood](https://madeonsol.com/robinhood)
- **Pricing** — [madeonsol.com/pricing](https://madeonsol.com/pricing) (Robinhood Chain bundled into every tier)
- **API docs** — [madeonsol.com/api-docs](https://madeonsol.com/api-docs)
- **Get a free key** — [madeonsol.com/pricing](https://madeonsol.com/pricing)
- **npm** — [robinhood-chain-sdk](https://www.npmjs.com/package/robinhood-chain-sdk)
- **GitHub** — [madeonsol/robinhood-chain-sdk](https://github.com/madeonsol/robinhood-chain-sdk)

## License

MIT © MadeOnSol

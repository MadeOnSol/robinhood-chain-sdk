# robinhood-chain-sdk — examples

Copy-paste examples for the [`robinhood-chain-sdk`](https://www.npmjs.com/package/robinhood-chain-sdk) TypeScript SDK — the Robinhood Chain (chain id 4663) API.

Get a free API key (no card) at <https://madeonsol.com/pricing>.

```bash
npm install robinhood-chain-sdk
export MADEONSOL_API_KEY=msk_...
npx tsx examples/kol-hot-tokens.ts
```

| File | What it does | Tier |
|---|---|---|
| [`kol-hot-tokens.ts`](./kol-hot-tokens.ts) | List RHC tokens bought by 2+ tracked KOLs in the last hour | BASIC |
| [`token-bundle-check.ts`](./token-bundle-check.ts) | Same-block launch-bundle + first-20 buyer-quality gate for one token | BASIC |
| [`stream-kol-trades.ts`](./stream-kol-trades.ts) | WebSocket: live `rhc:kol_trades` feed | PRO+ |
| [`smoke.ts`](./smoke.ts) | Type-only smoke test — references all 52 endpoints (run by `npm test`) | — |

All examples are self-contained — no extra deps beyond `robinhood-chain-sdk` (plus `ws` for streaming on Node < 22).

## Run any of them

```bash
# tsx (recommended — runs TypeScript directly)
npx tsx examples/kol-hot-tokens.ts

# type-check the examples against src (what `npm test` does)
npm test
```

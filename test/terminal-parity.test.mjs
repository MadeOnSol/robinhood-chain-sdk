import assert from "node:assert/strict";
import { test } from "node:test";
import { RobinhoodClient, STREAM_CHANNELS } from "../dist/index.js";

const token = "0x" + "ab".repeat(20);
const dev = "0x" + "cd".repeat(20);
const kol = "0x" + "ef".repeat(20);

function mockClient(t, body) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: new URL(String(url)), method: init?.method ?? "GET" });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  const client = new RobinhoodClient({ apiKey: "msk_fixture", baseUrl: "https://sdk.invalid/api/v1", maxRetries: 0 });
  return { client, calls };
}

test("kol.scoutLeaderboard binds GET /rhc/kol/scouts/leaderboard with its query params", async (t) => {
  const body = { chain: "robinhood", as_of: "2026-10-15T00:00:00Z", scouts: [{ kol_id: "k", name: "A", twitter_url: null, avatar_url: null, evm_addresses: [kol], as_of: "2026-10-15T00:00:00Z", first_touches_30d: 40, avg_followers_4h: 2.5, swarm_3plus_pct: 41, swarm_5plus_pct: 10, scout_tier: "S" }], count: 1, min_first_touches: 30, method: { tier_min_first_touches: 30, note: "n" } };
  const { client, calls } = mockClient(t, body);
  const r = await client.kol.scoutLeaderboard({ limit: 10, scout_tier: "S", sort: "scout_score", min_first_touches: 30 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url.pathname, "/api/v1/rhc/kol/scouts/leaderboard");
  assert.equal(calls[0].url.searchParams.get("scout_tier"), "S");
  assert.equal(calls[0].url.searchParams.get("sort"), "scout_score");
  assert.equal(calls[0].url.searchParams.get("min_first_touches"), "30");
  assert.equal(r.scouts[0].scout_tier, "S");
});

test("kol.leaderboard passes sort/min_closed and kol.wallet passes include_performance", async (t) => {
  const { client, calls } = mockClient(t, { chain: "robinhood", leaderboard: [], count: 0 });
  await client.kol.leaderboard({ sort: "winrate_7d", min_closed: 5 });
  await client.kol.wallet(kol, { include_performance: true });
  assert.equal(calls[0].url.searchParams.get("sort"), "winrate_7d");
  assert.equal(calls[0].url.searchParams.get("min_closed"), "5");
  assert.equal(calls[1].url.pathname, `/api/v1/rhc/kol/${kol}`);
  assert.equal(calls[1].url.searchParams.get("include_performance"), "true");
});

test("tokens.bundleClusters binds GET /rhc/tokens/{address}/bundles", async (t) => {
  const body = { chain: "robinhood", token_address: token, window: "6h", min_wallets: 4, launch_at: null, summary: { cluster_count: 0, launch_clusters: 0, later_clusters: 0, latest_cluster_at: null, largest_cluster_wallets: 0, baseline: null }, clusters: [], exit_tracking: "ok" };
  const { client, calls } = mockClient(t, body);
  const r = await client.tokens.bundleClusters(token, { window: "6h", min_wallets: 4, limit: 10, include_balances: true });
  assert.equal(calls[0].url.pathname, `/api/v1/rhc/tokens/${token}/bundles`);
  assert.equal(calls[0].url.searchParams.get("window"), "6h");
  assert.equal(calls[0].url.searchParams.get("min_wallets"), "4");
  assert.equal(calls[0].url.searchParams.get("include_balances"), "true");
  assert.equal(r.exit_tracking, "ok");
});

test("tokens.bundleShare binds GET /rhc/tokens/{address}/bundle-share and keeps a null share null", async (t) => {
  const body = { chain: "robinhood", token_address: token, window: "24h", min_wallets: 3, bundled_pct_of_supply_now: null, scope: "launch_and_clusters", clusters_status: "ok", wallets: { total: 4, launch_cohort_wallets: 3, cluster_wallets: 2, overlap: 1, clusters_counted: 1, verified: 3, holding: 2, max: 500 }, held_now: { source: "rhc_node_balanceOf_latest", checked_at: "2026-10-15T00:00:00Z", wallets: 4, verified_wallets: 3, holding_wallets: 2, complete: false, incomplete_reason: "rpc_unavailable", tokens_held_raw: null, tokens_held: null, held_pct_of_supply: null, supply_basis: null }, as_of: "2026-10-15T00:00:00Z" };
  const { client, calls } = mockClient(t, body);
  const r = await client.tokens.bundleShare(token, { window: "1h", min_wallets: 3 });
  assert.equal(calls[0].url.pathname, `/api/v1/rhc/tokens/${token}/bundle-share`);
  assert.equal(calls[0].url.searchParams.get("window"), "1h");
  assert.equal(r.bundled_pct_of_supply_now, null);
  assert.equal(r.held_now.complete, false);
});

test("tokens.kolTrades binds GET /rhc/tokens/{address}/kol-trades with cursor + include_balances", async (t) => {
  const body = { chain: "robinhood", token_address: token, trades: [], count: 0, kols_on_page: 0, next_cursor: null, has_more: false, balances: { source: "rhc_node_balanceOf_latest", checked_at: null, by_wallet: { [kol]: { status: "unverified", balance_raw: null, decimals: null, balance: null, holding: null, reason: "rpc_unavailable" } }, summary: { wallets: 1, verified: 0, holding: 0, zero: 0, unverified: 1 } } };
  const { client, calls } = mockClient(t, body);
  const r = await client.tokens.kolTrades(token, { limit: 50, action: "buy", kol, cursor: "c1", since: "2026-10-01T00:00:00Z", include_balances: true });
  const q = calls[0].url.searchParams;
  assert.equal(calls[0].url.pathname, `/api/v1/rhc/tokens/${token}/kol-trades`);
  assert.equal(q.get("action"), "buy");
  assert.equal(q.get("kol"), kol);
  assert.equal(q.get("cursor"), "c1");
  assert.equal(q.get("include_balances"), "true");
  assert.equal(r.balances.by_wallet[kol].balance_raw, null);
});

test("deployerHunter.activity binds GET /rhc/deployer-hunter/{address}/activity and joins a types array", async (t) => {
  const body = { chain: "robinhood", address: dev, events: [], count: 0, summary: { launches: 0, dev_buys: 0, dev_sells: 0 }, next_cursor: null, has_more: false, window: { since: "2026-09-15T00:00:00Z", max_days: 90 }, coverage: { tokens_attributed: 0, tokens_truncated: false, dev_trades_complete_from: null, archive_required_before: null, trades_scanned: 0, scan_truncated: false, transfers_included: false, linked_wallets_included: false } };
  const { client, calls } = mockClient(t, body);
  const r = await client.deployerHunter.activity(dev, { types: ["dev_buy", "dev_sell"], limit: 20, cursor: "x" });
  await client.deployerHunter.activity(dev, { types: "launch" });
  assert.equal(calls[0].url.pathname, `/api/v1/rhc/deployer-hunter/${dev}/activity`);
  assert.equal(calls[0].url.searchParams.get("types"), "dev_buy,dev_sell");
  assert.equal(calls[0].url.searchParams.get("cursor"), "x");
  assert.equal(calls[1].url.searchParams.get("types"), "launch");
  assert.equal(r.coverage.transfers_included, false);
});

test("opt-in flags reach the existing token/deployer reads", async (t) => {
  const { client, calls } = mockClient(t, {});
  await client.tokens.bundle(token, { include_balances: true });
  await client.tokens.buyerQuality(token, { include_balances: true });
  await client.tokens.earlyBuyers(token, { verify_current_balances: true, include_scout_scores: true });
  await client.tokens.holders(token, { include_wallet_flags: true, after: "k" });
  await client.deployerHunter.tokens(dev, { include_launches_24h: true });
  assert.equal(calls[0].url.searchParams.get("include_balances"), "true");
  assert.equal(calls[1].url.searchParams.get("include_balances"), "true");
  assert.equal(calls[2].url.searchParams.get("verify_current_balances"), "true");
  assert.equal(calls[2].url.searchParams.get("include_scout_scores"), "true");
  assert.equal(calls[3].url.searchParams.get("include_wallet_flags"), "true");
  assert.equal(calls[3].url.searchParams.get("after"), "k");
  assert.equal(calls[4].url.searchParams.get("include_launches_24h"), "true");
  for (const c of calls) assert.equal(c.method, "GET");
});

test("STREAM_CHANNELS lists rhc:token_bundles", () => {
  assert.ok(STREAM_CHANNELS.includes("rhc:token_bundles"));
});

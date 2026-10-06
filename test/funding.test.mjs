import assert from "node:assert/strict";
import { test } from "node:test";
import { RobinhoodClient } from "../dist/index.js";

const wallet = "0x" + "ab".repeat(20);
const funder = "0x" + "cd".repeat(20);

// Shape of GET /rhc/wallet/{address}/funding as assembled by the route
// (src/lib/wallet-funding.ts getFundingConnections + direct_funding block),
// PRO view: no `relationships` inside direct_funding.
const transfer = {
  asset: "native", symbol: "ETH", decimals: 18,
  amount_raw: "123456789012345678901234567890", amount: "123456789012.34567890123456789",
  transfer_count: 2, first_seen: "2026-09-21T10:00:00.000Z", last_seen: "2026-09-22T10:00:00.000Z",
  transactions: [{ tx: "0x" + "ee".repeat(32), explorer_url: "https://explorer.invalid/tx/0x" }],
};
const body = {
  chain: "robinhood", chain_id: "eip155:4663", native_asset: "ETH", address: wallet,
  status: "ok", summary: "2 tracked wallets received ETH from the same address.",
  shared_funders: [{
    funder, funder_explorer_url: "https://explorer.invalid/address/" + funder,
    funder_label: null, service_funder: false, to_this_wallet: [transfer],
    connected_wallets: [{ address: "0x" + "ef".repeat(20), explorer_url: "https://explorer.invalid/a", tracked_as: ["kol"], transfers: [transfer] }],
  }],
  pagination: { limit: 5, offset: 0, total: 1, has_more: false },
  coverage: {
    collection_enabled: true, mode: "on", heartbeat_at: "2026-10-03T00:00:00.000Z", collector_current: true,
    monitoring_started_at: "2026-09-20T13:11:51.000Z", last_committed_position: "99999999999999999999",
    last_committed_at: "2026-10-03T00:00:00.000Z", tracked_intervals: [{ source: "kol", tracked_since: "2026-09-20T13:11:51.000Z", tracked_until: null }],
    known_gaps: [], supported_transfer_types: ["native", "erc20"], unsupported_transfer_types: ["internal"],
    recovery: null, history: "Forward-looking from monitoring start only.",
  },
  disclaimer: "A shared funder is evidence of a funding connection, not proof of common ownership.",
  direct_funding: {
    observed: true, coverage: "forward_only", coverage_explanation: "x", observation_started_at: "2026-09-20T13:11:51.000Z",
    native_funding: {
      source_address: funder, asset: { funding_type: "native", asset: "native", symbol: "ETH", decimals: 18 },
      amount_raw: "123456789012345678901234567890", amount: null, funded_at: "2026-09-21T10:00:00.000Z",
      last_funded_at: "2026-09-22T10:00:00.000Z", transfer_count: 2, shared_infrastructure: false,
    },
    token_funding: { observed: false, reason: "none_observed", explanation: "y" },
    sources: [], source_count: 1, funder_explorer_url: null,
  },
};

test("wallet.funding binds GET /rhc/wallet/{address}/funding with limit/offset and keeps uint256 strings exact", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  const client = new RobinhoodClient({ apiKey: "msk_fixture", baseUrl: "https://sdk.invalid/api/v1", maxRetries: 0 });
  const r = await client.wallet.funding(wallet, { limit: 5, offset: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  const u = new URL(calls[0].url);
  assert.equal(u.pathname, `/api/v1/rhc/wallet/${wallet}/funding`);
  assert.equal(u.searchParams.get("limit"), "5");
  assert.equal(u.searchParams.get("offset"), "0");
  assert.equal(r.status, "ok");
  assert.equal(r.shared_funders[0].to_this_wallet[0].amount_raw, "123456789012345678901234567890");
  assert.equal(typeof r.coverage.last_committed_position, "string");
  assert.equal(r.direct_funding?.native_funding?.relationships, undefined, "PRO view has no relationships");
});

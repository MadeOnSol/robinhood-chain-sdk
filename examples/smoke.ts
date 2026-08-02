/**
 * Type-check smoke test — references every one of the 52 endpoints and the
 * stream client so `npm test` fails if a method signature or type drifts.
 *
 * This does NOT make network calls; it only exercises the type surface. To run
 * it live, set MADEONSOL_API_KEY and change `RUN` to true.
 */
import {
  RobinhoodClient,
  RobinhoodError,
  RobinhoodStream,
  CHAIN_ID,
  type RhcKolFeedResponse,
  type RhcKolLeaderboardResponse,
  type RhcHotTokensResponse,
  type RhcKolProfileResponse,
  type RhcKolCoordinationResponse,
  type RhcKolFirstTouchesResponse,
  type RhcTradesResponse,
  type RhcTokensListResponse,
  type RhcTokenSnapshot,
  type RhcCandlesResponse,
  type RhcKolConsensusResponse,
  type RhcBuyerQualityResponse,
  type RhcBundleResponse,
  type RhcTopTradersResponse,
  type RhcFlowResponse,
  type RhcPeakHistoryResponse,
  type RhcRiskResponse,
  type RhcHoldersResponse,
  type RhcTokenBatchResponse,
  type RhcBatchBuyerQualityResponse,
  type RhcDeployerLeaderboardResponse,
  type RhcDeployerProfileResponse,
  type RhcDeployerTrajectoryResponse,
  type RhcDeployerTokensResponse,
  type RhcDeployerHistoryResponse,
  type RhcBestTokensResponse,
  type RhcDeployerStatsResponse,
  type RhcDeployerAlertsResponse,
  type RhcRecentBondsResponse,
  type RhcAlphaWalletsResponse,
  type RhcCopyTradeListResponse,
  type RhcCopyTradeCreateResponse,
  type RhcCopyTradeGetResponse,
  type RhcCopyTradeSignalsResponse,
  type RhcPriceAlertListResponse,
  type RhcPriceAlertCreateResponse,
  type RhcPriceAlertGetResponse,
  type RhcPriceAlertEventsResponse,
  type RhcCoordinationAlertListResponse,
  type RhcCoordinationAlertCreateResponse,
  type RhcCoordinationAlertGetResponse,
  type RhcFirstTouchSubscriptionListResponse,
  type RhcFirstTouchSubscriptionCreateResponse,
  type RhcFirstTouchSubscriptionGetResponse,
  type RhcDeletedResponse,
} from "robinhood-chain-sdk";

const RUN = false;
const client = new RobinhoodClient({ apiKey: process.env.MADEONSOL_API_KEY ?? "msk_test", maxRetries: 3 });

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const uuid = "00000000-0000-0000-0000-000000000000";

async function main(): Promise<void> {
  // 1–6: KOL
  const feed: RhcKolFeedResponse = await client.kol.feed({ limit: 10, action: "buy", min_eth: 0.1 });
  const lb: RhcKolLeaderboardResponse = await client.kol.leaderboard({ period: "7d" });
  const hot: RhcHotTokensResponse = await client.kol.hotTokens({ window: "1h" });
  const kol: RhcKolProfileResponse = await client.kol.wallet(wallet);
  const coord: RhcKolCoordinationResponse = await client.kol.coordination({ period: "24h", min_kols: 3, limit: 20 });
  const touches: RhcKolFirstTouchesResponse = await client.kol.firstTouches({ limit: 20, token_age_max_min: 60 });

  // 7: DEX tape
  const tape: RhcTradesResponse = await client.trades({ dex: "uniswap-v3", limit: 25 });

  // 8–20: tokens
  const list: RhcTokensListResponse = await client.tokens.list({ sort: "market_cap", min_mc_usd: 1000 });
  const snap: RhcTokenSnapshot = await client.tokens.get(token);
  const candles: RhcCandlesResponse = await client.tokens.candles(token, { limit: 240 });
  const consensus: RhcKolConsensusResponse = await client.tokens.kolConsensus(token);
  const quality: RhcBuyerQualityResponse = await client.tokens.buyerQuality(token);
  const bundle: RhcBundleResponse = await client.tokens.bundle(token);
  const traders: RhcTopTradersResponse = await client.tokens.topTraders(token, { limit: 50 });
  const flow: RhcFlowResponse = await client.tokens.flow(token, "24h");
  const peak: RhcPeakHistoryResponse = await client.tokens.peakHistory(token, { window: "7d" });
  const risk: RhcRiskResponse = await client.tokens.risk(token);
  const holders: RhcHoldersResponse = await client.tokens.holders(token, { limit: 50 });
  const batch: RhcTokenBatchResponse = await client.tokens.batch([token]);          // max 50
  const batchQ: RhcBatchBuyerQualityResponse = await client.tokens.batchBuyerQuality([token]); // max 20

  // 21–29: deployer hunter
  const dlb: RhcDeployerLeaderboardResponse = await client.deployerHunter.leaderboard({ tier: "elite", sort: "runner_rate" });
  const dprof: RhcDeployerProfileResponse = await client.deployerHunter.profile(wallet);
  const traj: RhcDeployerTrajectoryResponse = await client.deployerHunter.trajectory(wallet);
  const dtok: RhcDeployerTokensResponse = await client.deployerHunter.tokens(wallet, { limit: 50, sort: "peak_mc_usd" });
  const dhist: RhcDeployerHistoryResponse = await client.deployerHunter.history(wallet, { limit: 100 }); // PRO+
  const best: RhcBestTokensResponse = await client.deployerHunter.bestTokens({ period: "7d", limit: 10 });
  const dstats: RhcDeployerStatsResponse = await client.deployerHunter.stats();
  const alerts: RhcDeployerAlertsResponse = await client.deployerHunter.alerts({ deployer_tier: "good", include_untradeable: false });
  const bonds: RhcRecentBondsResponse = await client.deployerHunter.recentBonds({ min_peak: 100_000 });

  // 30: alpha wallets
  const alpha: RhcAlphaWalletsResponse = await client.alphaWallets({ classification: "smart_money", sort: "net_eth" });

  // 31–36: copy-trade rule engine (PRO+). Quotas are PER CHAIN.
  const ctList: RhcCopyTradeListResponse = await client.copyTrade.list();
  const ctNew: RhcCopyTradeCreateResponse = await client.copyTrade.create({
    name: "degen desk",
    source_wallets: [wallet],
    min_trade_eth: 0.01,
    only_action: "buy",
    sizing_mode: "fixed",   // no MC band on RHC — the trade event carries no market cap
    sizing_amount: 0.05,
    delivery_mode: "websocket",
  });
  const ctOne: RhcCopyTradeGetResponse = await client.copyTrade.get(ctNew.subscription.id);
  const ctUpd: RhcCopyTradeGetResponse = await client.copyTrade.update(ctNew.subscription.id, { is_active: false });
  const ctSignals: RhcCopyTradeSignalsResponse = await client.copyTrade.signals({ subscription_id: ctNew.subscription.id, limit: 50 });
  const ctDel: RhcDeletedResponse = await client.copyTrade.delete(ctNew.subscription.id);

  // 37–42: price alerts (PRO+) — POLLED ~15s on RHC, not sub-second like Solana.
  const paList: RhcPriceAlertListResponse = await client.priceAlerts.list();
  const paNew: RhcPriceAlertCreateResponse = await client.priceAlerts.create({
    token_address: token,
    drop_pct: 30,
    recovery_pct: 15,
    webhook_url: "https://example.com/hook",
  });
  const paOne: RhcPriceAlertGetResponse = await client.priceAlerts.get(paNew.alert.id);
  const paUpd: RhcPriceAlertGetResponse = await client.priceAlerts.update(paNew.alert.id, { name: "watch" });
  const paEvents: RhcPriceAlertEventsResponse = await client.priceAlerts.events({ alert_id: paNew.alert.id, event_type: "dip" });
  const paDel: RhcDeletedResponse = await client.priceAlerts.delete(paNew.alert.id);

  // 43–47: KOL coordination rules (PRO+)
  const caList: RhcCoordinationAlertListResponse = await client.kol.coordinationAlerts.list();
  const caNew: RhcCoordinationAlertCreateResponse = await client.kol.coordinationAlerts.create({
    min_kols: 3,
    window_minutes: 15,
    cooldown_min: 30,
    delivery_mode: "websocket",
  });
  const caOne: RhcCoordinationAlertGetResponse = await client.kol.coordinationAlerts.get(uuid);
  const caUpd: RhcCoordinationAlertGetResponse = await client.kol.coordinationAlerts.update(uuid, { min_score: 40 });
  const caDel: RhcDeletedResponse = await client.kol.coordinationAlerts.delete(uuid);

  // 48–52: KOL first-touch subscriptions (ULTRA+). Unknown filter keys are 400s.
  const ftList: RhcFirstTouchSubscriptionListResponse = await client.kol.firstTouchSubscriptions.list();
  const ftNew: RhcFirstTouchSubscriptionCreateResponse = await client.kol.firstTouchSubscriptions.create({
    name: "early hands",
    filters: { min_first_buy_eth: 0.05, min_kol_winrate: 0.5, strategy: "swing" },
    delivery_mode: "websocket",
  });
  const ftOne: RhcFirstTouchSubscriptionGetResponse = await client.kol.firstTouchSubscriptions.get(uuid);
  const ftUpd: RhcFirstTouchSubscriptionGetResponse = await client.kol.firstTouchSubscriptions.update(uuid, { filters: {} });
  const ftDel: RhcDeletedResponse = await client.kol.firstTouchSubscriptions.delete(uuid);

  // Touch a representative EVM-native field on each to lock the types in.
  console.log(
    CHAIN_ID,
    feed.trades[0]?.eth_amount,
    lb.leaderboard[0]?.net_eth,
    hot.tokens[0]?.kols_buying,
    kol.stats.net_eth,
    coord.coordination[0]?.kol_count,
    coord.coordination[0]?.signal,
    touches.events[0]?.first_kol.name,
    tape.trades[0]?.tx_hash,
    tape.trades[0]?.trader_eoa,
    list.tokens[0]?.token_address,
    snap.deployer?.tier,
    candles.candles[0]?.close_price_usd,
    consensus.consensus?.net_flow_eth,
    quality.quality.breakdown.dump_cluster_count,
    bundle.bundle.held_pct_of_supply,
    traders.traders[0]?.net_eth,
    flow.cohorts[0]?.net_eth,
    peak.peak.peak_mc_usd_observed,
    risk.sellability.sellable,
    holders.verified,
    batch.found,
    batchQ.max_addresses,
    dlb.deployers[0]?.graduation_rate,
    dprof.deployer?.runner_rate,
    traj.trajectory?.trend,
    dtok.sort_scope,
    dhist.total,
    best.tokens[0]?.peak_mc_usd,
    dstats.tier_rules.elite,
    alerts.alerts[0]?.tier_is_stale,
    alerts.tradability_filter,
    bonds.graduation_mc,
    alpha.wallets[0]?.memecoin_share,
    ctList.subscriptions[0]?.source_wallets,
    ctNew.webhook_secret,
    ctOne.subscription.sizing_mode,
    ctUpd.subscription.is_active,
    ctSignals.signals[0]?.suggested_eth_amount,
    ctDel.deleted,
    paList.alerts[0]?.baseline_mc_usd,
    paNew.evaluation.mode,            // "polled" — RHC alerts are NOT sub-second
    paNew.evaluation.interval_seconds,
    paOne.alert.status,
    paUpd.alert.name,
    paEvents.events[0]?.drop_pct_actual,
    paDel.deleted,
    caList.rules[0]?.min_kols,
    caNew.scoring.earliness,          // defaulted on RHC — no early-entry equivalent
    caOne.rule.cooldown_min,
    caUpd.rule.min_score,
    caDel.deleted,
    ftList.subscriptions[0]?.filters.min_kol_winrate,
    ftNew.subscription.delivery_mode,
    ftOne.subscription.filters.strategy,
    ftUpd.subscription.is_active,
    ftDel.deleted,
  );

  // Stream surface.
  const stream: RobinhoodStream = client.stream.connect();
  stream.on("rhc:trade", (t) => console.log(t)).subscribe(["rhc:trades"]);
  stream.close();
}

if (RUN) {
  main().catch((err) => {
    if (err instanceof RobinhoodError) console.error(err.status, err.requestId, err.message);
    else console.error(err);
    process.exit(1);
  });
}

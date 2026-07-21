/**
 * Type-check smoke test — references every one of the 14 endpoints and the
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
  type RhcTradesResponse,
  type RhcTokensListResponse,
  type RhcTokenSnapshot,
  type RhcCandlesResponse,
  type RhcKolConsensusResponse,
  type RhcBuyerQualityResponse,
  type RhcBundleResponse,
  type RhcDeployerLeaderboardResponse,
  type RhcDeployerProfileResponse,
  type RhcAlphaWalletsResponse,
} from "robinhood-chain-sdk";

const RUN = false;
const client = new RobinhoodClient({ apiKey: process.env.MADEONSOL_API_KEY ?? "msk_test", maxRetries: 3 });

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";

async function main(): Promise<void> {
  // 1–4: KOL
  const feed: RhcKolFeedResponse = await client.kol.feed({ limit: 10, action: "buy", min_eth: 0.1 });
  const lb: RhcKolLeaderboardResponse = await client.kol.leaderboard({ period: "7d" });
  const hot: RhcHotTokensResponse = await client.kol.hotTokens({ window: "1h" });
  const kol: RhcKolProfileResponse = await client.kol.wallet(wallet);

  // 5: DEX tape
  const tape: RhcTradesResponse = await client.trades({ dex: "uniswap-v3", limit: 25 });

  // 6–11: tokens
  const list: RhcTokensListResponse = await client.tokens.list({ sort: "market_cap", min_mc_usd: 1000 });
  const snap: RhcTokenSnapshot = await client.tokens.get(token);
  const candles: RhcCandlesResponse = await client.tokens.candles(token, { limit: 240 });
  const consensus: RhcKolConsensusResponse = await client.tokens.kolConsensus(token);
  const quality: RhcBuyerQualityResponse = await client.tokens.buyerQuality(token);
  const bundle: RhcBundleResponse = await client.tokens.bundle(token);

  // 12–13: deployer hunter
  const dlb: RhcDeployerLeaderboardResponse = await client.deployerHunter.leaderboard({ tier: "elite", sort: "runner_rate" });
  const dprof: RhcDeployerProfileResponse = await client.deployerHunter.profile(wallet);

  // 14: alpha wallets
  const alpha: RhcAlphaWalletsResponse = await client.alphaWallets({ classification: "smart_money", sort: "net_eth" });

  // Touch a representative EVM-native field on each to lock the types in.
  console.log(
    CHAIN_ID,
    feed.trades[0]?.eth_amount,
    lb.leaderboard[0]?.net_eth,
    hot.tokens[0]?.kols_buying,
    kol.stats.net_eth,
    tape.trades[0]?.tx_hash,
    tape.trades[0]?.trader_eoa,
    list.tokens[0]?.token_address,
    snap.deployer?.tier,
    candles.candles[0]?.close_price_usd,
    consensus.consensus?.net_flow_eth,
    quality.quality.breakdown.dump_cluster_count,
    bundle.bundle.held_pct_of_supply,
    dlb.deployers[0]?.graduation_rate,
    dprof.deployer?.runner_rate,
    alpha.wallets[0]?.memecoin_share,
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

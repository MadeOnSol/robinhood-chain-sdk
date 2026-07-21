/**
 * Robinhood Chain — tokens being bought by 2+ tracked KOLs in the last hour.
 *
 * Run:
 *   MADEONSOL_API_KEY=msk_... npx tsx examples/kol-hot-tokens.ts
 *
 * Free key at https://madeonsol.com/developer.
 */
import { RobinhoodClient } from "robinhood-chain-sdk";

const apiKey = process.env.MADEONSOL_API_KEY;
if (!apiKey) {
  console.error("Set MADEONSOL_API_KEY — get a free one at https://madeonsol.com/developer");
  process.exit(1);
}

const client = new RobinhoodClient({ apiKey });

const { tokens, window } = await client.kol.hotTokens({ window: "1h" });

console.log(`RHC consensus tokens (${window}) — ${tokens.length} with 2+ KOL buyers:\n`);
for (const t of tokens) {
  const sym = t.token_symbol || t.token_address.slice(0, 10) + "…";
  const mc = t.market_cap_usd != null ? `$${Math.round(t.market_cap_usd).toLocaleString()}` : "—";
  console.log(
    `  ${sym.padEnd(12)}  ${String(t.kols_buying).padStart(2)} KOLs  ` +
    `net ${t.net_eth.toFixed(3)} ETH  MC ${mc}  [${t.launchpad ?? "?"}]`,
  );
}

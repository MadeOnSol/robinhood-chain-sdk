/**
 * Robinhood Chain — live KOL trade stream over WebSocket (PRO+).
 *
 * Run:
 *   MADEONSOL_API_KEY=msk_... npx tsx examples/stream-kol-trades.ts
 *
 * On Node < 22, also `npm i ws`. Free key at https://madeonsol.com/developer.
 */
import { RobinhoodClient } from "robinhood-chain-sdk";

const apiKey = process.env.MADEONSOL_API_KEY;
if (!apiKey) {
  console.error("Set MADEONSOL_API_KEY — get a free one at https://madeonsol.com/developer");
  process.exit(1);
}

const client = new RobinhoodClient({ apiKey });

const stream = client.stream.connect();

stream
  .on("open", () => console.log("connected — subscribing to rhc:kol_trades"))
  .on("subscribed", (channels) => console.log("subscribed:", channels))
  .on("rhc:kol_trade", (trade) => console.log("KOL trade:", trade))
  .on("error", (err) => console.error("stream error:", err))
  .on("close", () => console.log("stream closed"));

stream.subscribe(["rhc:kol_trades"]);

// Stop after 60s so the example exits cleanly.
setTimeout(() => {
  stream.close();
  process.exit(0);
}, 60_000);

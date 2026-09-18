import assert from "node:assert/strict";
import { test } from "node:test";
import { RobinhoodClient, RobinhoodError } from "../dist/index.js";

const address = "0x" + "11".repeat(20);
const operations = [
  ["copyTrade.create", c => c.copyTrade.create({ source_wallets: [address], sizing_amount: 0.05 }), "POST"],
  ["priceAlerts.create", c => c.priceAlerts.create({ token_address: address, drop_pct: 20 }), "POST"],
  ["coordination.create", c => c.kol.coordinationAlerts.create({ min_kols: 3 }), "POST"],
  ["firstTouch.create", c => c.kol.firstTouchSubscriptions.create({ name: "test" }), "POST"],
  ["wallet.track", c => c.wallet.track({ address }), "POST"],
  ["wallet.relabel", c => c.wallet.relabel(address, null), "PATCH"],
  ["wallet.untrack", c => c.wallet.untrack(address), "DELETE"],
  ["stream.token", c => c.stream.getToken(), "POST"],
  ["stream.rotate", c => c.stream.getToken({ rotate: true }), "POST"],
  ["tokens.batch", c => c.tokens.batch([address]), "POST"],
  ["tokens.batchBuyerQuality", c => c.tokens.batchBuyerQuality([address]), "POST"],
];
for (const [name, select] of [
  ["copyTrade", c => c.copyTrade], ["priceAlerts", c => c.priceAlerts],
  ["coordination", c => c.kol.coordinationAlerts],
  ["firstTouch", c => c.kol.firstTouchSubscriptions],
]) {
  operations.push([`${name}.update`, c => select(c).update(7, { name: "changed" }), "PATCH"]);
  operations.push([`${name}.delete`, c => select(c).delete(7), "DELETE"]);
}

function fixture(t, handle, maxRetries = 2) {
  const calls = [], waits = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, ...init });
    return handle(calls.length, init);
  });
  t.mock.method(globalThis, "setTimeout", (fn, delay) => {
    waits.push(delay);
    queueMicrotask(fn);
    return 0;
  });
  return { client: new RobinhoodClient({ apiKey: "msk_fixture", baseUrl: "https://sdk.invalid/api/v1", maxRetries }), calls, waits };
}
function response(status, body = { error: "upstream failure", _rid: "rid-fixture" }) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Retry-After": "0.001" },
  });
}

for (const [name, invoke, method] of operations) {
  for (const failure of [429, 503, "lost-response"]) {
    test(`${name}: one attempt after ${failure}, even with a retry budget`, async t => {
      // Simulate the server applying each request before losing its response.
      let effects = 0;
      const { client, calls, waits } = fixture(t, () => {
        effects++;
        if (failure === "lost-response") throw new TypeError("connection closed after commit");
        return response(failure);
      });
      await assert.rejects(invoke(client), error => {
        assert.ok(error instanceof RobinhoodError);
        assert.equal(error.status, failure === "lost-response" ? 0 : failure);
        if (failure !== "lost-response") assert.equal(error.requestId, "rid-fixture");
        return true;
      });
      assert.equal(effects, 1);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, method);
      assert.equal(calls[0].headers.Authorization, "Bearer msk_fixture");
      assert.deepEqual(waits, []);
    });
  }
  test(`${name}: successful response is returned without repetition`, async t => {
    const payload = { id: 7, token: "fixture-token", deleted: true };
    const { client, calls, waits } = fixture(t, () => response(200, payload));
    assert.deepEqual(await invoke(client), payload);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, method);
    if (name === "stream.rotate") assert.deepEqual(JSON.parse(calls[0].body), { rotate: true });
    if (name === "wallet.relabel") assert.deepEqual(JSON.parse(calls[0].body), { label: null });
    if (method === "DELETE") assert.equal(calls[0].body, undefined);
    assert.deepEqual(waits, []);
  });
}

for (const failure of [429, 500, 502, 503, 504, "network"]) {
  test(`GET retries ${failure} and returns the next response`, async t => {
    const payload = { trades: [], count: 0 };
    const { client, calls, waits } = fixture(t, n => {
      if (n > 1) return response(200, payload);
      if (failure === "network") throw new TypeError("network failure");
      return response(failure);
    });
    assert.deepEqual(await client.kol.feed({ limit: 3 }), payload);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.match(calls[0].url, /limit=3/);
    assert.equal(waits.length, 1);
    if (failure !== "network") assert.equal(waits[0], 1);
  });
}
for (const budget of [0, 2]) {
  test(`GET stops at maxRetries=${budget}`, async t => {
    const { client, calls, waits } = fixture(t, () => response(503), budget);
    await assert.rejects(client.kol.feed(), { status: 503, requestId: "rid-fixture" });
    assert.equal(calls.length, budget + 1);
    assert.equal(waits.length, budget);
  });
}
test("GET authentication failure is not retried", async t => {
  const { client, calls, waits } = fixture(t, () => response(401));
  await assert.rejects(client.kol.feed(), { status: 401 });
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});
test("mutation with an unreadable success body is not replayed", async t => {
  const { client, calls, waits } = fixture(t, () => new Response("{", {
    status: 200, headers: { "Content-Type": "application/json" },
  }));
  await assert.rejects(client.stream.getToken({ rotate: true }), SyntaxError);
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});

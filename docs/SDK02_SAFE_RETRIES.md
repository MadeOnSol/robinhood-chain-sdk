# SDK-02 — prevent automatic replay of ambiguous mutations

Status: source fix for independent review; not released. Base: `241d63978f35458ecac85507098278cdb2f1440d` in `MadeOnSol/robinhood-chain-sdk`.

The shared transport retried every method after a network failure, 429 or 5xx. A create or stream-token rotation may already have succeeded when its response is lost. Replaying it can create another rule or invalidate another token.

The retry budget now applies only to GET. POST, PATCH and DELETE have zero automatic retries, including the two read-only POST batch methods. There is no route-specific replay allowlist until endpoints have an explicit replay contract. Public method signatures, response/error types, authentication, GET retry hints and default GET retry count are unchanged. DELETE used to retry; callers should inspect current state after an ambiguous failure instead of relying on a repeated DELETE's 404 as proof the first attempt failed.

This does not implement server-side idempotency, exactly-once execution, deadlines/cancellation (OPS-01), signing policy (SDK-01), or receipt isolation (SDK-04). Caller retry wrappers and transport redirects are outside this change. Never infer that a failed request had no effect.

## Validation

- `npm test`: TypeScript build, existing example typecheck and 86 offline Node tests passed on Node 24.19.0 / TypeScript 5.9.3.
- Against the original source, 57 new failure-path cases failed and 29 compatibility/control cases passed. After the fix, all 86 pass.
- Exercises four rule engines, watchlist mutations, token retrieval/rotation and both POST batches on 429, 503 and a lost response after a simulated server commit.
- Tests successful responses, error status/request ID, authentication header, payloads, unreadable success bodies, GET transient failures, retry budget and Retry-After behavior. All HTTP is mocked; no live API writes, payments or publication.
- `git diff --check` passed. Dependencies and package version unchanged. Node 18 minimum-version runtime was not separately tested.

CI: the existing parity workflow now installs from the lockfile with `npm ci` and runs `npm test`. Check its remote result before merge.

## Claude Sonnet review and release

Check that every non-GET path uses the zero-retry budget for both HTTP and network errors, and that no caller secretly retries a create. Review the intentional behavior change for PATCH/DELETE/batch POST and the unchanged request/error contracts. Run `npm test` from this repository.

The matching Python source fix lives in the canonical monorepo, `MadeOnSol/madeonsol`, with review notes at `docs/audit/SDK02_SAFE_RETRIES.md`; the public Python repository is a release mirror. Merge only after independent review, then increment the npm version and use the normal release gates. Existing installations need the new package version; committing or merging source does not update agents automatically.

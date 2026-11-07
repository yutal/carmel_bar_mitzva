import assert from "node:assert/strict";
import { test } from "node:test";
import { FairQueue } from "./fair-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

test("takes turns between events instead of draining the busiest one first", async () => {
  const started: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  const q = new FairQueue(1, async (lane, id) => {
    started.push(`${lane}:${id}`);
    const d = deferred();
    gates.set(`${lane}:${id}`, d);
    await d.promise;
  });
  for (const id of ["1", "2", "3"]) q.add("busy", id);
  q.add("quiet", "a");
  q.add("other", "x");
  const tick = () => new Promise((r) => setImmediate(r));
  for (let i = 0; i < 5; i++) {
    await tick();
    gates.get(started.at(-1)!)!.resolve();
  }
  await tick();
  assert.deepEqual(started, ["busy:1", "quiet:a", "other:x", "busy:2", "busy:3"]);
});

test("does not queue the same job twice and counts the jobs ahead across events", async () => {
  const hold = deferred();
  const q = new FairQueue(1, () => hold.promise);
  q.add("a", "1"); // starts running
  assert.equal(q.add("a", "1"), false);
  q.add("a", "2");
  q.add("a", "3");
  q.add("b", "1");
  q.add("b", "2");
  assert.equal(q.ahead("a", "1"), null, "a running job is not waiting");
  // b arrived after a had one turn, so it goes first once, then they alternate: b:1, a:2, b:2, a:3.
  assert.equal(q.ahead("b", "1"), 0);
  assert.equal(q.ahead("a", "2"), 1);
  assert.equal(q.ahead("b", "2"), 2);
  assert.equal(q.ahead("a", "3"), 3);
  assert.deepEqual(q.stats(), { waiting: 4, running: 1 });
  assert.deepEqual(q.stats("b"), { waiting: 2, running: 0 });
  hold.resolve();
});

test("a failing job frees its slot", async () => {
  const errors: string[] = [];
  const done: string[] = [];
  const q = new FairQueue(
    1,
    async (_lane, id) => {
      if (id === "bad") throw new Error("boom");
      done.push(id);
    },
    (_lane, id) => errors.push(id),
  );
  q.add("e", "bad");
  q.add("e", "good");
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(errors, ["bad"]);
  assert.deepEqual(done, ["good"]);
});

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { refreshHost } = require("../eagle/host.cjs");

test("host refresh verifies both defaults and rejects stale official cache", async context => {
  const expected = { chat: "openai-compatible::group/text", image: "openai-compatible::group/vision" };
  const requests = [];
  let stale = false;
  context.mock.method(global, "fetch", async (url, options) => {
    requests.push({ url, method: options.method ?? "GET" });
    if (url.endsWith("/api/reload")) return Response.json({ success: true });
    const type = url.split("/").at(-1);
    return Response.json({ model: stale ? expected.chat : expected[type] });
  });
  await refreshHost(expected);
  assert.deepEqual(requests.map(request => request.method), ["POST", "GET", "GET"]);
  assert.deepEqual(requests.map(request => new URL(request.url).pathname), [
    "/api/reload", "/api/default-model/chat", "/api/default-model/image",
  ]);
  stale = true;
  await assert.rejects(refreshHost(expected), /默认模型读回不一致/);
});

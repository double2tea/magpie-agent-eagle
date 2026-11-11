const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { test } = require("node:test");
const { createBridge, readConnection } = require("../eagle/bridge.cjs");

const sdkFile = path.join(os.homedir(), "Library/Application Support/Eagle/Plugins/ai-sdk/ai-sdk.cjs");
const createSdk = fs.existsSync(sdkFile) ? require(sdkFile).default : null;

async function fixture(context, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "magpie-eagle-test-"));
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      data: [
        { id: "original", magpie_label: "original · text", modalities: { input: ["text"] } },
        { id: "group/test", magpie_label: "test · routing group", modalities: { input: ["text", "image"] } },
      ],
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseURL = `http://127.0.0.1:${server.address().port}/v1`;
  const ai = createSdk({ configPath: path.join(directory, "real-sdk.bin") });
  if (options.configured !== false) {
    await ai.getProvider("openai-compatible").setConfig({ baseURL, apiKey: "original-test-key" });
    ai.getProvider("openai-compatible").setCustomModels(["original-custom"]);
  }
  await ai.getProvider("tongyi").setConfig({ baseURL, apiKey: "other-provider-test-key" });
  if (options.defaults !== false) {
    ai.setDefaultModel("chat", "tongyi::original-chat");
    ai.setDefaultModel("image", "tongyi::original-image");
  }
  await Promise.resolve();
  const bridgeDirectory = path.join(directory, "bridge");
  const bridge = createBridge({ ai, createSdk, directory: bridgeDirectory });
  const connectionFile = path.join(bridgeDirectory, "connection.json");
  const connection = { model: "group/test", connection: { version: 1, baseURL, apiKey: "new-test-key" } };
  function write(value = connection) {
    fs.writeFileSync(connectionFile, JSON.stringify(value));
  }
  context.after(async () => {
    bridge.stop();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory: bridgeDirectory, ai, bridge, write, connection, requests };
}

test("agent contract loads without Node APIs and keeps credentials under one connection key", async () => {
  const { agent, connect } = await import("../eagle.agent.js");
  assert.equal(agent.id, "eagle");
  assert.equal(agent.model, "model");
  const result = connect({ gateway: { v1: "http://127.0.0.1:3425/v1", key: "test-only" }, model: "group/test" });
  assert.deepEqual(Object.keys(result), ["connection"]);
  assert.equal(result.connection.version, 1);
  assert.throws(() => connect({ gateway: {}, model: "group/test" }));
});

test("connection boundary rejects incomplete, non-loopback, HTTPS, and injected model values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "magpie-eagle-input-"));
  const file = path.join(directory, "connection.json");
  try {
    assert.equal(readConnection(file), null);
    fs.writeFileSync(file, "{}");
    assert.equal(readConnection(file), null);
    const value = { model: "group/test", connection: { version: 1, baseURL: "http://127.0.0.1:3425/v1", apiKey: "test-only" } };
    for (const baseURL of ["http://example.com/v1", "https://localhost/v1", "http://127.0.0.1/v1/other", "http://secret@localhost/v1"]) {
      fs.writeFileSync(file, JSON.stringify({ ...value, connection: { ...value.connection, baseURL } }));
      assert.throws(() => readConnection(file));
    }
    for (const model of ["a::b", "group/a\nsecret", "single"]) {
      fs.writeFileSync(file, JSON.stringify({ ...value, model }));
      assert.throws(() => readConnection(file));
    }
    fs.writeFileSync(file, JSON.stringify(value));
    assert.equal(readConnection(file).model, "group/test");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    fs.writeFileSync(file, JSON.stringify({ ...value, model: "openrouter/model:free" }));
    assert.equal(readConnection(file).model, "openrouter/model:free");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("installed Eagle SDK applies, switches, restarts, and restores only its managed provider", { skip: !createSdk }, async context => {
  const { ai, directory, bridge, write, connection, requests } = await fixture(context);
  write();
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "connected");
  assert.equal(ai.getDefaultModel("chat"), "openai-compatible::group/test");
  assert.equal(ai.getDefaultModel("image"), "openai-compatible::group/test");
  assert.deepEqual([...ai.getProvider("openai-compatible").getCustomModels()], ["original-custom", "group/test"]);
  assert.equal(fs.statSync(path.join(directory, "provider.eac")).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(directory, "snapshot.eac")), false);
  assert.equal(fs.existsSync(path.join(directory, "snapshot.bin")), false);
  const backupSdk = createSdk({ configPath: path.join(directory, "inspect.bin") });
  backupSdk.importConfig(path.join(directory, "provider.eac"));
  await Promise.resolve();
  assert.deepEqual(backupSdk.getAvailableProviders().map(provider => provider.name), ["openai-compatible"]);
  assert.equal(fs.readFileSync(path.join(directory, "state.json"), "utf8").includes("new-test-key"), false);
  write({ ...connection, model: "group/second" });
  await bridge.sync(true);
  assert.equal(ai.getDefaultModel("chat"), "openai-compatible::group/second");
  bridge.stop();
  const restarted = createBridge({ ai, createSdk, directory });
  try {
    await restarted.sync(true);
    assert.equal(restarted.getStatus().phase, "connected");
    write({});
    await restarted.sync(true);
    assert.equal(restarted.getStatus().phase, "idle");
    assert.equal(ai.getDefaultModel("chat"), "tongyi::original-chat");
    assert.equal(ai.getDefaultModel("image"), "tongyi::original-image");
    assert.deepEqual([...ai.getProvider("openai-compatible").getCustomModels()], ["original-custom"]);
    assert.equal(ai.getProvider("tongyi").baseURL, connection.connection.baseURL);
    const auth = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      auth.push(options.headers.Authorization);
      return originalFetch(url, options);
    };
    try {
      await ai.getProvider("openai-compatible").verify();
      await ai.getProvider("tongyi").verify();
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.deepEqual(auth, ["Bearer original-test-key", "Bearer other-provider-test-key"]);
    assert.equal(fs.existsSync(path.join(directory, "provider.eac")), false);
    assert.equal(fs.existsSync(path.join(directory, "state.json")), false);
    assert.ok(requests.every(request => request.url === "/v1/models"));
  } finally {
    restarted.stop();
  }
});

test("chat and vision models are configured separately and survive reconnect", { skip: !createSdk }, async context => {
  const { ai, bridge, write, connection, directory } = await fixture(context);
  await assert.rejects(() => bridge.setVision("group/see"), /请先在 Magpie/);
  write();
  const status = await bridge.setVision("group/see");
  assert.equal(status.phase, "connected");
  assert.equal(ai.getDefaultModel("chat"), "openai-compatible::group/test");
  assert.equal(ai.getDefaultModel("image"), "openai-compatible::group/see");
  assert.deepEqual([...ai.getProvider("openai-compatible").getCustomModels()], ["original-custom", "group/test", "group/see"]);
  assert.deepEqual(bridge.getModels(), { chat: "group/test", vision: "group/see" });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "connection.json"), "utf8")), connection);
  const listed = await bridge.listVisionModels();
  assert.equal(listed.current, "group/see");
  assert.deepEqual(listed.models, [{ id: "group/test", label: "test · routing group" }]);
  write({ ...connection, model: "group/second" });
  await bridge.sync(true);
  assert.equal(ai.getDefaultModel("chat"), "openai-compatible::group/second");
  assert.equal(ai.getDefaultModel("image"), "openai-compatible::group/see");
  bridge.stop();
  const restarted = createBridge({ ai, createSdk, directory });
  try {
    await restarted.sync(true);
    assert.equal(ai.getDefaultModel("image"), "openai-compatible::group/see");
    await assert.rejects(() => restarted.setVision("bad model"), /视觉模型/);
    await restarted.setVision("");
    assert.equal(ai.getDefaultModel("image"), "openai-compatible::group/second");
    assert.equal(fs.existsSync(path.join(directory, "vision.json")), false);
    await restarted.setVision("group/see");
    fs.writeFileSync(path.join(directory, "vision.json"), JSON.stringify({ version: 1, model: "a::b" }));
    await restarted.sync(true);
    assert.equal(restarted.getStatus().phase, "error");
    fs.writeFileSync(path.join(directory, "vision.json"), JSON.stringify({ version: 1, model: "group/see" }));
    write({});
    await restarted.sync(true);
    assert.equal(restarted.getStatus().phase, "idle");
    assert.equal(ai.getDefaultModel("chat"), "tongyi::original-chat");
    assert.equal(ai.getDefaultModel("image"), "tongyi::original-image");
    assert.deepEqual([...ai.getProvider("openai-compatible").getCustomModels()], ["original-custom"]);
  } finally {
    restarted.stop();
  }
});

test("previously unconfigured provider is removed on disconnect", { skip: !createSdk }, async context => {
  const { ai, bridge, write } = await fixture(context, { configured: false });
  write();
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "connected");
  write({});
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "idle");
  assert.equal(ai.getAvailableProviders().some(provider => provider.name === "openai-compatible"), false);
});

test("disconnect restores original settings even when the vision file is corrupt", { skip: !createSdk }, async context => {
  const { ai, bridge, write, directory } = await fixture(context);
  write();
  await bridge.sync(true);
  fs.writeFileSync(path.join(directory, "vision.json"), "{");
  write({});
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "idle");
  assert.equal(ai.getDefaultModel("chat"), "tongyi::original-chat");
  assert.equal(ai.getDefaultModel("image"), "tongyi::original-image");
  assert.equal(fs.existsSync(path.join(directory, "state.json")), false);
});

test("paused bridge rejects vision changes without changing the saved selection", { skip: !createSdk }, async context => {
  const { bridge, write, directory } = await fixture(context);
  write();
  await bridge.setVision("group/test");
  await bridge.restore();
  bridge.stop();
  await assert.rejects(() => bridge.setVision("group/other"), /同步已暂停/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "vision.json"), "utf8")).model, "group/test");
});

test("manual settings changes stop automatic restore without overwriting the user's change", { skip: !createSdk }, async context => {
  const { ai, bridge, write, directory } = await fixture(context);
  write();
  await bridge.sync(true);
  ai.setDefaultModel("chat", "tongyi::manually-chosen");
  await Promise.resolve();
  write({});
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "error");
  assert.equal(ai.getDefaultModel("chat"), "tongyi::manually-chosen");
  assert.equal(fs.existsSync(path.join(directory, "provider.eac")), true);
});

test("unrelated provider changes survive disconnect", { skip: !createSdk }, async context => {
  const { ai, bridge, write, connection } = await fixture(context);
  write();
  await bridge.sync(true);
  await ai.getProvider("tongyi").setConfig({ baseURL: connection.connection.baseURL, apiKey: "changed-other-key" });
  await Promise.resolve();
  write({});
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "idle");
  assert.equal(ai.getProvider("tongyi").apiKey, "chan••••••••-key");
});

test("failed gateway verification preserves backup and does not retry on every timer tick", { skip: !createSdk }, async context => {
  const { ai, bridge, write, directory, connection } = await fixture(context);
  write({ ...connection, connection: { ...connection.connection, baseURL: "http://127.0.0.1:1/v1" } });
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "error");
  assert.equal(ai.getDefaultModel("chat"), "tongyi::original-chat");
  const before = fs.readFileSync(path.join(directory, "state.json"), "utf8");
  await bridge.sync();
  assert.equal(fs.readFileSync(path.join(directory, "state.json"), "utf8"), before);
  write({});
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "idle");
});

test("missing original defaults fails before provider changes", { skip: !createSdk }, async context => {
  const { ai, bridge, write, directory } = await fixture(context, { defaults: false });
  write();
  await bridge.sync(true);
  assert.equal(bridge.getStatus().phase, "error");
  assert.equal(ai.getProvider("openai-compatible").apiKey, "orig••••••••-key");
  assert.equal(fs.existsSync(path.join(directory, "state.json")), false);
});

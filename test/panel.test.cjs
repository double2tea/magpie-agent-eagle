const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function panel() {
  const elements = new Map();
  const handlers = {};
  const status = { phase: "connected", chat: "group/text", image: "group/old", canRestore: true };
  let attempts = 0;
  let fail = true;
  const bridge = {
    start() {},
    stop() {},
    sync: async () => status,
    restore: async () => {},
    getStatus: () => status,
    listVisionModels: async () => {
      attempts += 1;
      if (fail) throw new Error("网关不可达");
      return { current: "group/old", models: [{ id: "group/new", label: "New vision" }] };
    },
  };
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      disabled: false,
      value: "",
      options: [],
      addEventListener(event, listener) { handlers[`${id}:${event}`] = listener; },
      replaceChildren(...options) { this.options = options; },
      add(option) { this.options.push(option); },
    });
    return elements.get(id);
  }
  let onCreate;
  const context = {
    require: name => {
      if (name === "node:path") return path;
      if (name === "./bridge.cjs") return { createBridge: () => bridge };
      if (name === "./host.cjs") return { waitForHost: async () => {}, refreshHost: async () => {} };
      return { default: () => ({}) };
    },
    eagle: {
      app: { userDataPath: "/test" },
      onPluginCreate: handler => { onCreate = handler; },
      onPluginBeforeExit() {},
    },
    document: { body: { dataset: {} }, getElementById: element },
    Option: function (text, value) { this.text = text; this.value = value; },
    location: { reload() {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../eagle/panel.js"), "utf8"), context);
  return { element, handlers, start: () => onCreate(), recover: () => { fail = false; }, attempts: () => attempts };
}

test("resync reloads a previously failed catalog and keeps an unavailable current model visible", async () => {
  const view = panel();
  view.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.element("vision").disabled, true);
  assert.equal(view.element("vision-hint").textContent, "网关不可达");
  view.recover();
  await view.handlers["sync:click"]();
  assert.equal(view.attempts(), 2);
  assert.equal(view.element("vision").disabled, false);
  assert.equal(view.element("vision").value, "group/old");
  assert.equal(view.element("vision").options.at(-1).disabled, true);
  assert.match(view.element("vision").options.at(-1).text, /当前不在视觉模型列表中/);
});

test("restoring and pausing disables the visual model selector", async () => {
  const view = panel();
  view.recover();
  view.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.element("vision").disabled, false);
  await view.handlers["restore:click"]();
  assert.equal(view.element("vision").disabled, true);
  assert.equal(view.element("state").textContent, "已暂停同步");
});

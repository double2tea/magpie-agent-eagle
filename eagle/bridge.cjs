const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { setImmediate: flushSdk } = require("node:timers/promises");

const PROVIDER = "openai-compatible";

function readConnection(file) {
  if (!fs.existsSync(file)) return null;
  fs.chmodSync(file, 0o600);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!value.connection) return null;
  const model = value.model;
  const connection = value.connection;
  if (
    typeof model !== "string" || !model.includes("/") ||
    (/[\s\u0000-\u001f]/u.test(model) || model.includes("::")) ||
    !connection || connection.version !== 1 ||
    typeof connection.baseURL !== "string" ||
    typeof connection.apiKey !== "string" || !connection.apiKey ||
    /[\r\n]/u.test(connection.apiKey)
  ) throw new Error("Magpie 配置不完整，请在 Magpie 重新选择 Eagle 模型。");
  const endpoint = new URL(connection.baseURL);
  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) ||
    endpoint.pathname !== "/v1" || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash
  ) throw new Error("仅支持本机 Magpie 的 HTTP /v1 网关。");
  return { model, baseURL: connection.baseURL, apiKey: connection.apiKey };
}

function writeVision(directory, model) {
  const file = path.join(directory, "vision.json");
  if (model === "") {
    fs.rmSync(file, { force: true });
    return;
  }
  if (typeof model !== "string" || !model.includes("/") ||
    /[\s\u0000-\u001f]/u.test(model) || model.includes("::")) {
    throw new Error("视觉模型应为 provider/model 形式，例如 group/multimodal。");
  }
  saveJson(file, { version: 1, model });
}

async function listVisionModels(connectionFile, visionFile) {
  const connection = readConnection(connectionFile);
  if (!connection) throw new Error("请先在 Magpie 的 magpie-agent-eagle 条目选择语言模型。");
  const response = await fetch(`${connection.baseURL}/models`, {
    headers: { Authorization: `Bearer ${connection.apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Magpie 模型列表读取失败（HTTP ${response.status}）。`);
  const body = await response.json();
  const current = fs.existsSync(visionFile)
    ? JSON.parse(fs.readFileSync(visionFile, "utf8")).model : null;
  if (!body || !Array.isArray(body.data) || body.data.some(entry =>
    !entry || typeof entry.id !== "string" ||
    (entry.magpie_label !== undefined && typeof entry.magpie_label !== "string") ||
    (entry.display_name !== undefined && typeof entry.display_name !== "string") ||
    (entry.modalities?.input !== undefined && !Array.isArray(entry.modalities.input))
  )) throw new Error("Magpie 模型列表格式无效，请重新同步。");
  return {
    current,
    models: body.data
      .filter(entry => entry.modalities?.input?.includes("image"))
      .map(entry => ({ id: entry.id, label: entry.magpie_label || entry.display_name || entry.id }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

function saveJson(file, value) {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function fingerprint(ai) {
  const provider = ai.getProvider(PROVIDER);
  return {
    configured: ai.getAvailableProviders().some(entry => entry.name === PROVIDER),
    baseURL: provider.baseURL || "",
    keyMark: crypto.createHash("sha256").update(provider.apiKey || "").digest("hex"),
    customModels: provider.getCustomModels(),
    chat: ai.getDefaultModel("chat") || null,
    image: ai.getDefaultModel("image") || null,
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createBridge({ ai, createSdk, directory, refreshHost = async () => {}, onStatus = () => {} }) {
  for (const method of ["reload", "exportConfig", "importConfig", "setDefaultModel"]) {
    if (typeof ai[method] !== "function") throw new Error("Eagle AI 模型套件版本不兼容。");
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const connectionFile = path.join(directory, "connection.json");
  const stateFile = path.join(directory, "state.json");
  const backupFile = path.join(directory, "provider.eac");
  const visionFile = path.join(directory, "vision.json");
  let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
  let running = false;
  let stopped = false;
  let timer;
  let lastInput;
  let lastVision;
  let status = { phase: "idle", message: "在 Magpie 的 Eagle 页面选择模型即可连接。" };

  function report(phase, message) {
    status = {
      phase,
      message,
      chat: ai.getDefaultModel("chat") || "未设置",
      image: ai.getDefaultModel("image") || "未设置",
      canRestore: Boolean(state),
    };
    onStatus(status);
    return status;
  }

  async function snapshot(before) {
    if (!before.chat || !before.image) {
      throw new Error("请先在 Eagle AI 模型套件设置语言和视觉默认模型，桥接才能完整恢复原设置。");
    }
    const fullBackup = path.join(directory, "snapshot.eac");
    const scratchFile = path.join(directory, "snapshot.bin");
    try {
      ai.exportConfig(fullBackup);
      fs.chmodSync(fullBackup, 0o600);
      const scratch = createSdk({ configPath: scratchFile });
      scratch.importConfig(fullBackup);
      for (const provider of scratch.getProviders()) {
        if (provider.name !== PROVIDER) provider.removeConfig();
      }
      await flushSdk();
      scratch.exportConfig(backupFile);
      fs.chmodSync(backupFile, 0o600);
    } finally {
      fs.rmSync(fullBackup, { force: true });
      fs.rmSync(scratchFile, { force: true });
    }
    state = { version: 1, phase: "prepared", before, expected: before };
    saveJson(stateFile, state);
  }

  function assertOwned() {
    if (state.phase === "applying" || state.phase === "restoring") {
      throw new Error("上次配置操作未完成。请在 Eagle AI 模型套件核对设置，并使用 provider.eac 备份恢复。");
    }
    if (!same(fingerprint(ai), state.expected)) {
      throw new Error("Eagle 模型配置已被其他操作修改，已停止同步和自动恢复。请核对后在 AI 模型套件导入 provider.eac。");
    }
  }

  async function restore() {
    if (!state) return;
    ai.reload();
    await flushSdk();
    assertOwned();
    state.phase = "restoring";
    saveJson(stateFile, state);
    const provider = ai.getProvider(PROVIDER);
    provider.removeConfig();
    if (state.before.configured) {
      ai.importConfig(backupFile, { mode: "merge", skipDefaultModels: true });
      provider.setCustomModels(state.before.customModels);
    }
    ai.setDefaultModel("chat", state.before.chat);
    ai.setDefaultModel("image", state.before.image);
    await flushSdk();
    ai.reload();
    await flushSdk();
    if (!same(fingerprint(ai), state.before)) throw new Error("原配置恢复校验失败，已保留加密备份。");
    await refreshHost(state.before);
    fs.unlinkSync(stateFile);
    fs.unlinkSync(backupFile);
    state = null;
    report("idle", "已恢复连接前的 Eagle 模型配置。");
  }

  async function apply(desired, startup) {
    ai.reload();
    await flushSdk();
    const signature = crypto.createHash("sha256").update(JSON.stringify(desired)).digest("hex");
    if (state && startup && state.phase === "connected" && state.signature === signature) {
      const actual = fingerprint(ai);
      if (state.expected.image !== state.expected.chat &&
        actual.image === state.expected.chat &&
        same({ ...actual, image: state.expected.image }, state.expected)) {
        ai.setDefaultModel("image", state.expected.image);
        await flushSdk();
        ai.reload();
        await flushSdk();
        assertOwned();
        await refreshHost(state.expected);
        report("connected", "已恢复启动时被重置的视觉模型。");
        return;
      }
    }
    if (state) assertOwned();
    if (state?.phase === "connected" && state.signature === signature) {
      await refreshHost(state.expected);
      report("connected", "已由 Magpie 管理语言和视觉模型。");
      return;
    }
    if (!state) await snapshot(fingerprint(ai));
    state.phase = "applying";
    saveJson(stateFile, state);
    const provider = ai.getProvider(PROVIDER);
    try {
      await provider.setConfig({ baseURL: desired.baseURL, apiKey: desired.apiKey });
      provider.setCustomModels([...new Set([...state.before.customModels, desired.chat, desired.vision])]);
      ai.setDefaultModel("chat", `${PROVIDER}::${desired.chat}`);
      ai.setDefaultModel("image", `${PROVIDER}::${desired.vision}`);
      await flushSdk();
      ai.reload();
      await flushSdk();
      const actual = fingerprint(ai);
      if (actual.baseURL !== desired.baseURL ||
        actual.chat !== `${PROVIDER}::${desired.chat}` ||
        actual.image !== `${PROVIDER}::${desired.vision}`) {
        throw new Error("模型配置读回不一致。");
      }
      await refreshHost(actual);
      state = { ...state, phase: "connected", signature, expected: actual };
      saveJson(stateFile, state);
      report("connected", "已由 Magpie 管理语言和视觉模型。");
    } catch {
      await flushSdk();
      state.phase = "failed";
      state.expected = fingerprint(ai);
      saveJson(stateFile, state);
      throw new Error("无法应用 Magpie 配置，请检查网关与访问权限。原配置备份已保留，可点击恢复。");
    }
  }

  async function sync(force = false, startup = false) {
    if (running || stopped) return;
    running = true;
    try {
      const text = fs.existsSync(connectionFile) ? fs.readFileSync(connectionFile, "utf8") : "";
      const visionText = fs.existsSync(visionFile) ? fs.readFileSync(visionFile, "utf8") : "";
      if (!force && text === lastInput && visionText === lastVision) return;
      lastInput = text;
      lastVision = visionText;
      const desired = readConnection(connectionFile);
      if (!desired) {
        if (state) await restore();
        else report("idle", "在 Magpie 的 Eagle 页面选择模型即可连接。");
        return status;
      }
      const vision = visionText ? JSON.parse(visionText) : null;
      if (vision && (vision.version !== 1 || typeof vision.model !== "string" ||
        !vision.model.includes("/") || /[\s\u0000-\u001f]/u.test(vision.model) || vision.model.includes("::"))) {
        throw new Error("视觉模型无效，请在 Eagle「magpie-agent-eagle」面板重新选择。");
      }
      desired.chat = desired.model;
      desired.vision = vision?.model ?? desired.model;
      await apply(desired, startup);
    } catch (error) {
      const known = error instanceof Error && !/Unexpected|JSON|position|token/iu.test(error.message);
      report("error", known ? error.message : "Magpie 配置文件尚未写完整，请点击重新同步。");
    } finally {
      running = false;
    }
    return status;
  }

  return {
    sync,
    async setVision(model) {
      if (stopped) throw new Error("同步已暂停，请先点击重新同步。");
      if (running) throw new Error("正在同步，请稍后重试。");
      if (!readConnection(connectionFile)) throw new Error("请先在 Magpie 的 magpie-agent-eagle 条目选择语言模型。");
      ai.reload();
      await flushSdk();
      if (state) assertOwned();
      writeVision(directory, model);
      lastVision = undefined;
      await sync(true);
      return status;
    },
    listVisionModels: () => listVisionModels(connectionFile, visionFile),
    getModels() {
      const connection = fs.existsSync(connectionFile)
        ? JSON.parse(fs.readFileSync(connectionFile, "utf8")) : {};
      const vision = fs.existsSync(visionFile)
        ? JSON.parse(fs.readFileSync(visionFile, "utf8")).model : null;
      return { chat: connection.model ?? null, vision: vision ?? connection.model ?? null };
    },
    async restore() {
      if (running) throw new Error("正在同步，请稍后重试。");
      running = true;
      try {
        await restore();
      } finally {
        running = false;
      }
    },
    start() {
      if (timer) return;
      void sync(true, true);
      timer = setInterval(() => void sync(), 1000);
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    getStatus: () => status,
  };
}

module.exports = { createBridge, readConnection };

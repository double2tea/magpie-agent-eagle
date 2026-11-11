const path = require("node:path");
const { createBridge } = require("./bridge.cjs");
const { waitForHost, refreshHost } = require("./host.cjs");

let bridge;
let paused = false;

function paint(status) {
  document.body.dataset.phase = status.phase;
  document.getElementById("state").textContent = {
    idle: "等待 Magpie",
    connected: "已连接 Magpie",
    error: "需要处理",
    paused: "已暂停同步",
  }[status.phase];
  document.getElementById("message").textContent = status.message;
  document.getElementById("chat").textContent = status.chat || "未设置";
  document.getElementById("image").textContent = status.image || "未设置";
  document.getElementById("restore").disabled = !status.canRestore;
  if (status.phase === "paused") document.getElementById("vision").disabled = true;
}

async function initialize() {
  try {
    await waitForHost();
    const sdkPath = path.join(eagle.app.userDataPath, "Plugins", "ai-sdk", "ai-sdk.cjs");
    const createSdk = require(sdkPath).default;
    bridge = createBridge({
      ai: createSdk({ configPath: path.join(eagle.app.userDataPath, "Plugins", "ai-sdk", "config.bin") }),
      createSdk,
      directory: path.join(eagle.app.userDataPath, "MagpieBridge"),
      refreshHost,
      onStatus: paint,
    });
    bridge.start();
    void loadVisionModels();
  } catch (error) {
    paint({ phase: "error", message: `桥接无法启动：${error.message}` });
  }
}

eagle.onPluginCreate(initialize);

async function loadVisionModels() {
  const select = document.getElementById("vision");
  const hint = document.getElementById("vision-hint");
  select.disabled = true;
  try {
    const { current, models } = await bridge.listVisionModels();
    select.replaceChildren(
      new Option("跟随语言模型", ""),
      ...models.map(model => new Option(model.label, model.id)),
    );
    if (current && !models.some(model => model.id === current)) {
      const unavailable = new Option(`${current}（当前不在视觉模型列表中）`, current);
      unavailable.disabled = true;
      select.add(unavailable);
    }
    select.value = current ?? "";
    select.disabled = paused;
    hint.textContent = models.length ? `${models.length} 个支持图片的模型` : "Magpie 中没有支持图片的模型";
  } catch (error) {
    hint.textContent = error.message;
  }
}

document.getElementById("vision").addEventListener("change", async event => {
  if (!bridge || paused) return;
  const hint = document.getElementById("vision-hint");
  const select = event.target;
  select.disabled = true;
  try {
    const status = await bridge.setVision(select.value);
    hint.textContent = status.phase === "connected" ? "视觉模型已应用。" : status.message;
  } catch (error) {
    hint.textContent = error.message;
  } finally {
    select.disabled = paused;
  }
});

document.getElementById("sync").addEventListener("click", async () => {
  if (!bridge) {
    await initialize();
    return;
  }
  if (paused) {
    location.reload();
    return;
  }
  await bridge.sync(true);
  await loadVisionModels();
});

document.getElementById("settings").addEventListener("click", () => eagle.extraModule.ai.open());
document.getElementById("restore").addEventListener("click", async () => {
  if (!bridge) return;
  try {
    await bridge.restore();
    bridge.stop();
    paused = true;
    paint({ ...bridge.getStatus(), phase: "paused", message: "已恢复原配置。本次运行已暂停；重新同步或重启 Eagle 会继续接收 Magpie 配置。" });
  } catch (error) {
    paint({ ...bridge.getStatus(), phase: "error", message: error.message });
  }
});
eagle.onPluginBeforeExit(() => bridge?.stop());

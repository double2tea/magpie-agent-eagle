const API = "http://127.0.0.1:41597";
const { setTimeout: delay } = require("node:timers/promises");

async function waitForHost() {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const health = await response.json();
        if (health.status === "ok" && health.uptime >= 2000) return;
      }
    } catch {}
    await delay(1000);
  }
  throw new Error("Eagle AI 模型套件未就绪，请启用后重新同步。");
}

async function refreshHost(expected) {
  const response = await fetch(`${API}/api/reload`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || (await response.json()).success !== true) {
    throw new Error("Eagle AI 模型套件缓存刷新失败，请重新同步。");
  }
  for (const type of ["chat", "image"]) {
    const readback = await fetch(`${API}/api/default-model/${type}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!readback.ok || (await readback.json()).model !== expected[type]) {
      throw new Error("Eagle AI 模型套件默认模型读回不一致，请核对设置后重新同步。");
    }
  }
}

module.exports = { waitForHost, refreshHost };

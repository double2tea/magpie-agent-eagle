export const agent = {
  id: "eagle",
  name: "magpie-agent-eagle",
  dir: "~/Library/Application Support/Eagle/Plugins/zeezhi-magpie-bridge",
  config: "~/Library/Application Support/Eagle/MagpieBridge/connection.json",
  format: "json",
  model: "model",
  ua: ["eagle", "magpie-eagle"],
  notice: "这里选择 Eagle 的语言模型；视觉模型在 Eagle「magpie-agent-eagle」面板中从 Magpie 的模型列表选择，须支持图片。断开后恢复原配置。",
};

export function connect({ gateway, model }) {
  if (!model || !gateway.v1 || !gateway.key) {
    throw new Error("缺少 Magpie 模型或网关配置。");
  }
  return {
    connection: {
      version: 1,
      baseURL: gateway.v1,
      apiKey: gateway.key,
    },
  };
}

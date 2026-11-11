# Eagle × Magpie

An unofficial **Magpie agent plugin + companion Eagle plugin**. Choose Eagle's
language model in Magpie; choose its vision model from a dropdown in the Eagle
bridge. The dropdown reads Magpie's image-capable model catalog. Disconnecting
restores the Eagle provider and defaults that the bridge replaced.

非官方的 **Magpie Agent 插件 + Eagle 配套桥接插件**。语言模型在 Magpie 选择，
视觉模型在 Eagle「Magpie 桥接」下拉框选择，不需要手填模型名。

> macOS · Eagle AI 模型套件 1.0.0 · Magpie tested with 0.1.3734
>
> v0.3.2: live vision dropdown and five consecutive Eagle cold restarts passed.
> Targeted startup recovery restored the saved vision model in every round.
> See [ACCEPTANCE.md](ACCEPTANCE.md) for test scope and remaining limitations.

## 安装 / Install

1. 在 Eagle 安装并启用「AI 模型套件」1.0.0，先设置语言和视觉默认模型，以便桥接记录和恢复它们。
2. 从 [Releases](https://github.com/double2tea/magpie-agent-eagle/releases)
   下载 `Eagle-Magpie-Bridge-0.3.2.eagleplugin`，在 Eagle 安装并打开「Magpie 桥接」。
3. 在 Magpie 的插件页添加 GitHub 地址，或运行：

   ```sh
   magpie plugin add github:double2tea/magpie-agent-eagle
   ```

4. 在 Magpie 的 Agents 页面找到 **Eagle**，选择语言模型。
5. 在 Eagle「Magpie 桥接」面板的**视觉模型下拉框**选择支持图片的模型，
   或选择「跟随语言模型」。列表来自 Magpie `/v1/models` 的
   `modalities.input`，只列含 `image` 的模型。
6. 在 Magpie 断开 Eagle，恢复连接前配置。Eagle 未运行时，恢复在下次启动桥接时执行。

Install both parts: the `.eagleplugin` release asset inside Eagle, and the
GitHub plugin inside Magpie. Start the Eagle bridge, then select Eagle's
language model on Magpie's Agents page. The vision dropdown lives in the Eagle
bridge and lists Magpie models that advertise image input.

Magpie's current agent plugin interface exposes one model field per agent.
This project keeps a single Eagle agent entry. It does **not** put two selectors
in Magpie's own agent row.

## 行为与边界 / Behavior

- 语言／视觉选择对应 Eagle 的 `chat` / `image` 默认模型。视觉选择保存在本机，
  切换语言模型时独立保留。启动时若只有视觉默认值被改成原语言默认值，
  且其他受管理配置与上次记录一致，桥接会恢复保存的视觉选择。这个特征也可能
  来自用户手动修改，因此启动时符合条件的手动修改同样会被恢复。
  跟随语言模型时，应选支持图片的语言模型。
- Magpie 显示接入成功，只表示已写入连接配置；**以 Eagle 桥接面板为准**。
  模型目录的图片标记不构成对上游推理能力或路由组每个成员的实测保证。
- 只管理 `openai-compatible` provider 和语言／视觉默认模型；连接期间该 provider
  会指向 Magpie。其他 provider 保留。原 provider 配置使用 Eagle 加密导出备份，
  断开后恢复原默认模型和自定义模型列表。
- 正在连接时手动修改受管理 provider 或默认模型，会停止同步和自动恢复。
  配置操作异常退出也会停止自动重写，需核对状态后处理加密备份。
- Eagle「恢复原配置并暂停」只暂停当前插件运行；重新同步或重新启动桥接会继续连接。
  长期断开在 Magpie 操作。卸载前先断开，并确认 Eagle 已恢复原配置。
- 不上传素材，不发起推理，不新增 HTTP 服务；模型列表读取访问本机 Magpie 网关，
  配置后通过本机 Eagle AI 模型套件服务刷新缓存并核对语言／视觉默认值。
  第三方 Eagle 插件可能缓存设置，需要重新打开。
- 使用已安装官方 SDK 的配置方法，不直接编辑加密 `config.bin`。
  写入方法尚无公开稳定合同，升级 Eagle AI 模型套件后需重新验证。

## 数据位置 / Local data

All runtime data stays outside this repository:

| File under `~/Library/Application Support/Eagle/MagpieBridge/` | Purpose |
| --- | --- |
| `connection.json` | Magpie-managed language model, gateway URL and API key; do not share |
| `vision.json` | Saved vision model choice; no API key |
| `state.json` | Original defaults, managed-state fingerprints and operation phase |
| `provider.eac` | Eagle-encrypted backup of the managed provider |

目录权限为 `0700`，连接、状态和备份文件为 `0600`。请勿把运行数据附在 issue 中。

## 开发 / Development

零新增依赖。原生 HTML、CSS、JavaScript；不打入共享运行时或依赖目录。
构建需要 Python 3，测试使用支持 `node:test`、`fetch` 和 `AbortSignal.timeout`
的现代 Node.js（建议 Node.js 22+）。

```sh
git clone https://github.com/double2tea/magpie-agent-eagle.git
cd magpie-agent-eagle
npm test
python3 build.py
```

Build outputs:

- `dist/Eagle-Magpie-Bridge-0.3.2.eagleplugin` — Eagle companion runtime
- `dist/magpie-agent-eagle-0.3.2.tgz` — Magpie agent plugin package

SDK tests load the separately installed
`~/Library/Application Support/Eagle/Plugins/ai-sdk/ai-sdk.cjs`, but use temporary
configurations and a local test HTTP endpoint. They do not change your real
Eagle settings. Without that SDK, those tests are skipped; the agent contract,
input validation and simulated panel tests still run. A green run with skips
does not establish SDK integration.

## License and attribution

Project code: [MIT](LICENSE). Eagle's official icon and marks are excluded from
the MIT license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The official
SDK is not redistributed. This is not an official Eagle or Magpie project.

本方案已优先最短路径 + 未添加未要求兜底/扩展。

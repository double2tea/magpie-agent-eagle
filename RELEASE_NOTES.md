# magpie-agent-eagle v0.3.4

将 Magpie 插件、Agent 条目及 Eagle 配套插件的显示名称统一为 `magpie-agent-eagle`。
保留原 Agent ID、Eagle 插件 ID 和配置目录，已有连接数据继续使用。
Eagle 安装包更名为 `magpie-agent-eagle-0.3.4.eagleplugin`。

- 在 Magpie 的 magpie-agent-eagle 条目选择语言模型，在 Eagle 同名面板从 Magpie 的图片模型目录选择视觉模型。
- 等待官方 AI 模型套件就绪后自动连接；写入后刷新官方缓存并读回核对两个默认模型。
- 定向修复启动时视觉模型被重置为原语言模型的问题；其他受管理配置冲突继续停止同步和恢复。
- 连接成功后自动加载视觉模型列表；先打开面板、后连接 Magpie 时无需再手动重新同步。
- README 补齐首次配置、安装自查、模型修改位置与断开恢复。
- 17 项自动测试通过、零跳过，包含首次连接自动加载回归测试。
- 五次真实 Eagle 冷启动验收来自 v0.3.2；本次启动恢复逻辑未改动，未重做全新用户 GUI 安装。

## 安装

下载并在 Eagle 安装 `magpie-agent-eagle-0.3.4.eagleplugin`，启用官方 AI 模型套件 1.0.0，然后在 Magpie 添加此仓库：

```sh
magpie plugin add github:double2tea/magpie-agent-eagle
```

`magpie-agent-eagle-0.3.4.tgz` 为 Magpie 插件包；`SHA256SUMS.txt` 提供两个安装包的校验值。

已有用户更新 Eagle 同一插件后重新启动 Eagle；Magpie 端通过其插件管理器更新。
语言模型在 Magpie 的 magpie-agent-eagle 条目修改，视觉模型在 Eagle「magpie-agent-eagle」修改。

## 已知边界

启动恢复仅在连接与其他受管理配置均匹配、且视觉默认值变成原语言默认值时执行。它无法区分相同模式的手动修改，因此该手动修改也会被恢复。其他冲突仍会停止同步。

已验证 macOS、本机 Eagle AI 模型套件 1.0.0 和 Magpie 0.1.3734；未验证系统重启、登录启动或端到端模型推理。详情见 ACCEPTANCE.md。

非官方项目；代码为 MIT 许可，Eagle 官方图标与商标不包含在 MIT 授权内。

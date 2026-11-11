# magpie-agent-eagle v0.3.5

- Magpie Agent 条目补上官方 Eagle 图标。此前只有插件行图标，Agent 行显示通用图标。
- Eagle 桥接面板的默认窗口从 620 × 620 调整为 720 × 740，常用内容无需滚动。
- “重新同步”现在可以恢复被改成原语言模型的视觉默认值；其他配置冲突仍停止同步。
- 保留原 Agent ID、Eagle 插件 ID 和配置目录，已有连接数据继续使用。
- 17 项自动测试通过、零跳过。

## 安装

下载并在 Eagle 安装 `magpie-agent-eagle-0.3.5.eagleplugin`，启用官方 AI 模型套件 1.0.0，然后在 Magpie 添加此仓库：

```sh
magpie plugin add github:double2tea/magpie-agent-eagle
```

`magpie-agent-eagle-0.3.5.tgz` 为 Magpie 插件包；`SHA256SUMS.txt` 提供两个安装包的校验值。

已有用户更新 Eagle 同一插件后重新启动 Eagle；Magpie 端通过其插件管理器更新。
语言模型在 Magpie 的 magpie-agent-eagle 条目修改，视觉模型在 Eagle「magpie-agent-eagle」修改。

## 已知边界

启动恢复与“重新同步”仅在连接与其他受管理配置均匹配、且视觉默认值变成原语言默认值时执行。它无法区分相同模式的手动修改，因此该手动修改也会被恢复。其他冲突仍会停止同步。

已验证 macOS、本机 Eagle AI 模型套件 1.0.0 和 Magpie 0.1.3734；未验证系统重启、登录启动或端到端模型推理。详情见 ACCEPTANCE.md。

非官方项目；代码为 MIT 许可，Eagle 官方图标与商标不包含在 MIT 授权内。

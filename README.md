# dsh-sidebar-footer-fold

DeepSeek Harness（DSH）侧栏增强小插件：折叠费用卡片、编辑侧栏入口、清理归档会话。

> **⚠️ 重要声明：本插件基于 [`dsh-cost-meter`](https://www.npmjs.com/package/dsh-cost-meter)（费用计量插件）实现。**
>
> - 本插件**不自带**任何费用/额度数据，也不做计费；它只是把 `dsh-cost-meter` 渲染在左侧栏底部的费用卡片折叠/展开。
> - 依赖 `dsh-cost-meter` 的侧栏 DOM 结构（其费用卡片节点使用 `.cm-footer-stack` 类）以及宿主的 `sidebar.footer.action` 插槽。
> - 使用本插件前请先安装并启用 `dsh-cost-meter`（本插件已在 dsh-cost-meter 1.9.58 上验证）。
> - 若 `dsh-cost-meter` 大版本更新改动了侧栏 DOM，折叠功能可能需要跟随适配（最坏情况只是按钮不生效，不会影响 DSH 启动）。

**English:** A small DeepSeek Harness sidebar enhancement plugin. **It is built on top of [`dsh-cost-meter`](https://www.npmjs.com/package/dsh-cost-meter)**: it only collapses/expands the cost card rendered by that plugin, plus a sidebar entry editor and archived-session cleanup.

## 功能

1. **费用面板折叠**：左侧栏底部、头像上方靠左有一行「费用面板 ▾」文字按钮，点一下把 `dsh-cost-meter` 的侧栏费用卡片整块收起（变成「费用面板 ▸」），再点展开。状态保存在本机浏览器 localStorage，刷新/重启后保持；侧栏收成 56px 图标栏时这行自动隐藏。
2. **编辑侧栏…**：左侧栏面板列表的「更多」菜单里新增「编辑侧栏…」，可勾选显示/隐藏侧栏面板入口；隐藏状态本机记忆，随时可恢复。
3. **归档会话清理**（设置页顶级分区）：列出已归档会话（按工作区分组、显示体积与创建时间），支持单个或全部「移入回收站」。移动的是 Windows 回收站（可还原），不是永久删除；只移动会话自身文件：
   - `sessions/<project>/<sessionId>/`
   - `storages/session_projcache/sessions/<sessionId>.json`

   不碰其他会话、共享附件、账本或其他存储。删除后同步归档列表与工作区记账，侧栏会话列表即时刷新。

## 安装

要求：DSH **0.2.1-rc.2 ~ 0.3.0**（含 0.2.2-rc.1），并已安装 `dsh-cost-meter`。

### 方式一：从 GitHub 安装（推荐）

```bash
dsh plugin --profile desktop add github:eittyneo/dsh-sidebar-footer-fold
```

### 方式二：从 Release 的 tgz 安装

1. 在 [Releases](https://github.com/eittyneo/dsh-sidebar-footer-fold/releases) 下载 `dsh-sidebar-footer-fold-0.3.4.tgz`
2. 在 DSH 插件管理里安装该 tgz，或：

```bash
dsh plugin --profile desktop add file:<path-to>/dsh-sidebar-footer-fold-0.3.4.tgz
```

安装后**重启 DSH**（或硬刷新窗口 Ctrl+Shift+R）使客户端脚本生效。

## 使用

- **折叠费用面板**：点侧栏底部「费用面板 ▾」；状态自动记忆。
- **编辑侧栏**：左侧栏面板列表「更多」→「编辑侧栏…」。
- **归档会话清理**：设置 → 归档会话清理。

## 安全说明（相对已废弃的 0.4.0）

本仓库的 0.4.0 从未发布到 GitHub；它在本地实验时曾把 `dsh-cost-meter` 的 React 管理节点搬进账号菜单，存在触发 React DOM 异常的风险，已在 0.3.4 中彻底移除：

- 不搬移任何第三方 React 管理的 DOM 节点
- 不向账号菜单注入任何内容
- 折叠仅通过给 `body` 加 class 实现
- 宿主半侧只有两个本地 HTTP 接口；删除操作只在用户点击时执行，并走 Windows 回收站

0.3.4 已通过静态检查与运行时冒烟测试（宿主 `apply()`、路由、客户端模块加载/注册/dispose 均不抛异常）。

## 兼容性

- DSH `0.2.1-rc.2 ~ 0.3.0`（含 `0.2.2-rc.1`）
- `dsh-cost-meter`（已在 `1.9.58` 上验证）
- 依赖宿主插槽：`sidebar.footer.action`、`sidebar.panellist.actions`、`settings.section`
- 依赖 `dsh-cost-meter` 渲染的 `.cm-footer-stack` 类名与侧栏面板按钮的 `panelRow` 类名

## 卸载

```bash
dsh plugin --profile desktop remove dsh-sidebar-footer-fold
```

然后重启 DSH。已移入回收站的会话不会被自动还原。

## License

[MIT](LICENSE) © 2026 eittyneo

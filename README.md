<div align="center">

# ▚ Termux WebUI

**专为移动端与 Termux 打造的 · 全宇宙 AI 编程 Agent 统一调度中枢**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](#)
[![Hono](https://img.shields.io/badge/Hono-v4-E36002?logo=hono&logoColor=white)](#)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)

[快速开始](#-快速开始) • [核心特性](#-核心特性) • [AI 工具生态](#-已支持的-ai-编程软件) • [架构设计](#-架构与协议) • [路线图](#-开发路线图)

</div>

---

## 📖 项目简介

**Termux WebUI** 是一个专为 Android / Termux 及移动设备深度定制的 **Web 终端与 AI 编程 Agent 统一控制台**。

不管你的项目在哪个目录、用的是哪个 AI CLI（**Codex、Pi Agent、Antigravity、Claude Code、OpenCode、Aider** 等），只需在手机浏览器打开一个极简网页，就能实现：
- ⚡ **多终端并发运行**：PTY 后台持久保活，刷新网页不中断、不跳变；
- 📚 **全宇宙 AI 历史对话中枢**：全自动深度扫描设备上的所有 AI 编程记录，双层时间链毫秒级校准，一键无缝恢复（Resume）继续对话；
- 📱 **极致手机手势与操作适配**：抽屉式手风琴收纳，释放 100% 垂直屏幕视野，集成移动端专属辅助键盘与剪贴板增强。

---

## ✨ 核心特性

### 1. 📚 全宇宙 AI 历史对话中枢（Unified AI History Hub）
* **深度自动感知**：无需手动配置，后端自动深度扫描设备上已安装的 AI 工具及其历史数据；
* **智能去死/去空会话**：底层健康度检查，自动剔除后台自检报错（401 等）与 0 轮空会话，列表中 100% 真实可进；
* **双层智能时间体系**：
  - *卡片外部*：呈现极其自然的友好相对时间（`刚刚`、`5分钟前`、`今天 14:20`、`8月24日`）；
  - *展开详情*：毫秒不差的精确时间链（📅 创建时间、🔄 最近活跃、💬 首次提问原句、📊 交互轮次）；
* **一键无缝续接（Resume）**：点击卡片自动注入各 CLI 专属参数（如 `codex resume <id>`、`pi --session <id>`、`agy --conversation <id>`）直接拉起交互；
* **实时增量同步**：内置 `🔄 立即刷新` 旋钮，终端关闭/切出时后台毫秒级静默自动重扫。

### 2. 📱 手机端极致交互体验（Mobile-First Ergonomics）
* **全视野终端（最大化可视面积）**：剥离底部常驻栏，多终端管理内嵌于左侧抽屉，垂直终端可用高度提升 4~6 行；
* **防裁切物理安全边距**：内嵌 10px 手机防误触 Padding，告别屏幕边缘字体贴边遮挡；
* **移动端专属控制栏**：轻触唤起 `Ctrl`、`Esc`、`Tab`、上下左右方向键，支持一键粘贴与软键盘防顶起控制；
* **刷新绝对锁定（Zero-Jump）**：持久化当前活跃终端 ID，随时切换 App、刷新浏览器 100% 锁定当前操作窗口。

---

## 🤖 已支持的 AI 编程软件

| 图标 | 编程 Agent | 历史数据解析源 | 一键恢复机制 (Resume) |
| :---: | :--- | :--- | :--- |
| ⚡ | **Codex / Codex-zh** | `~/.codex/history.jsonl` | `codex resume <id>` |
| 🥧 | **Pi Coding Agent** | `~/.pi/agent/sessions/` | `pi --session <id>` |
| 🔮 | **Google Antigravity (Agy)** | `~/.gemini/antigravity-cli/brain/` | `agy --conversation <id>` |
| 🤖 | **Claude Code** | `~/.claude/projects/` | `claude --resume <id>` |
| 💻 | **OpenCode** | `~/.local/share/opencode/` | `opencode -s <id>` |
| 🐚 | **原生 Shell (Bash/Zsh)** | 全局系统环境 | 自由指定工作目录 |
| 🛠️ | **Aider / OpenClaw / Hermes** | 动态探测 $PATH | 自动识别二进制就绪状态 |

---

## 🏗️ 架构与协议

项目采用现代 Monorepo 架构开发，类型全链路共享：

```text
termux-webui/
├── shared/           # 前后端共享协议层 (TypeScript + Zod 类型校验)
│   └── src/index.ts  # AgentConversation, SessionInfo, WsMessage 规范
├── server/           # 高性能后端服务 (Hono + node-pty + WebSocket)
│   ├── src/history.ts# 全量 AI 历史会话扫描与精准时间解析引擎
│   ├── src/clis.ts   # 多目录全局 $PATH 动态探针
│   └── src/index.ts  # 会话调度器与 PTY 进程保活中枢
└── web/              # 移动端 Web 前端 (React 19 + Vite + Tailwind CSS v4 + xterm.js)
    ├── src/components/Drawer.tsx # 3 模块全手风琴抽屉 (终端/AI历史/设置)
    ├── src/components/TerminalView.tsx # xterm.js 终端与手势视口
    └── src/store.ts  # Zustand 状态机 + localStorage 持久化锁定
```

---

## 🚀 快速开始

### 1. 环境要求
- **Node.js**: $\ge$ 18.0.0
- **包管理器**: `pnpm`
- **运行环境**: Linux / Android (Termux) / macOS

### 2. 安装与构建

```bash
# 克隆仓库
git clone https://github.com/bj1995112/termux-webui.git
cd termux-webui

# 安装依赖
pnpm install

# 构建前后端
pnpm build
```

### 3. 启动服务

```bash
# 方式 A：本机运行
pnpm start

# 方式 B：手机/局域网设备访问（推荐）
HOST=0.0.0.0 PORT=4150 pnpm start
```

启动后在手机浏览器打开：`http://<你的设备IP>:4150` 即可畅享完整体验！

---

## 📡 API 概览

| 请求方式 | 接口路由 | 功能说明 |
| :---: | :---| :---|
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/api/clis` | 动态检测本机所有已安装的 AI CLI 工具 |
| `GET` | `/api/history` | 扫描并获取全量纯净 AI 历史对话列表 |
| `DELETE` | `/api/history/:cli/:id` | 彻底删除某个 AI 的历史对话归档 |
| `POST` | `/api/sessions/resume` | 带专属参数恢复指定历史会话 |
| `GET` | `/api/sessions` | 获取当前正在运行的 PTY 终端列表 |
| `POST` | `/api/sessions` | 新建终端会话 `{ kind, cwd? }` |
| `DELETE` | `/api/sessions/:id` | 正常终止并清理终端进程 |
| `WS` | `/ws` | WebSocket 双向实时数据流 (attach / resize / input / output) |

---

## 🧪 自动化测试

```bash
# 运行后端单元测试与生命周期验证
pnpm test
```

---

## 🗺️ 开发路线图

- [x] **M1: 极简多会话 PTY 终端架构** (持久保活、断线重连、物理安全边距)
- [x] **M2: 全宇宙 AI Agent 历史中枢** (Codex/Pi/Agy/Claude/OpenCode 深度扫描与一键 Resume)
- [x] **M3: 双层智能时间链与纯净过滤** (消除死会话，毫秒级真实时间解析，即时同步)
- [ ] **M4: 结构化阅读模式** (ANSI 文本流转结构化卡片，便捷选择与长文复制)
- [ ] **M5: PWA 桌面级离线应用与主题定制** (深色/浅色/OLED 纯黑模式)

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue 与 Pull Request！


<div align="center">

# ▚ Termux WebUI

**专为移动端与 Termux 打造的 · 全宇宙 AI 编程 Agent 统一调度中枢**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](#)
[![Hono](https://img.shields.io/badge/Hono-v4-E36002?logo=hono&logoColor=white)](#)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](#)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple?logo=pwa&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#)

[快速开始](#-快速开始) • [核心特性](#-核心特性) • [精选主题](#-精选大师级主题) • [AI 工具生态](#-已支持的-ai-编程软件) • [架构与安全](#-安全与协议)

</div>

---

## 📖 项目简介

**Termux WebUI** 是一个专为 Android / Termux 及移动设备深度定制的 **Web 终端与 AI 编程 Agent 统一控制台**。

不管你的项目在哪个目录、用的是哪个 AI CLI（**Codex、Pi Agent、Antigravity、Claude Code、OpenCode、Aider** 等），只需在手机浏览器打开一个极简网页，就能实现：
- 🔒 **全域安全鉴权**：内置密码访问控制（默认 `000000`），彻底防御局域网未授权访问；
- ⚡ **多终端并发运行**：PTY 后台持久保活，刷新网页不中断、不跳变，支持已退出终端一键重启；
- 📚 **全宇宙 AI 历史对话中枢**：内存级毫秒扫描缓存，支持免开终端只读 Markdown 问答流预览与一键无缝恢复（Resume）；
- 🎨 **5 款大师级全域精选主题**：Tokyo Night、Cyber OLED、Catppuccin、Dracula、Nord 实时一键切换；
- 📱 **PWA 全屏沉浸式体验**：支持“添加到主屏幕”作为独立无边框 App 运行，释放 100% 垂直屏幕视野。

---

## ✨ 核心特性

### 1. 🎨 5 款大师级全域精选主题（一键实时切换）
* **🌌 Tokyo Night (东京夜)**：深邃蓝紫与极光霓虹，现代 AI 编程首选；
* **🖤 Cyber OLED (赛博纯黑)**：0 耗电 AMOLED 纯黑，极光高对比度；
* **☕ Catppuccin Mocha (摩卡)**：柔和粉彩与温暖质感，护眼细腻；
* **🧛 Dracula (经典德古拉)**：传奇暗紫高对比度，经典极客之选；
* **🌿 Nord (北欧极光)**：极简清爽冰蓝，克制纯粹。

### 2. 📚 AI 历史对话中枢与只读预览（AI History Hub）
* **⚡ 智能 mtime 增量缓存**：扫描时间从数百毫秒降至个位数毫秒，大量历史记录秒级加载；
* **📖 免开终端只读流预览**：无需拉起 PTY 消耗系统资源，直接在抽屉弹窗以格式化气泡查阅过去的问答流；
* **一键无缝续接（Resume）**：点击卡片自动注入各 CLI 专属参数直接拉起交互；
* **专属渐变徽章**：Codex (琥珀金)、Agy (极光青)、Claude (流光紫)、Pi (珊瑚粉)。

### 3. 📱 手机端极致交互体验（Mobile-First Ergonomics）
* **PWA Standalone 全屏应用**：消灭浏览器地址栏和底部导航，终端高度提升 15%~20%；
* **WebLinks 链接一键直达**：终端中输出的 `http://` / `https://` 链接自动识别为可点击跳转项；
* **轻量全局 Toast 提示**：告别阻塞式 `alert()`，操作反馈优雅自然；
* **已退出终端保留与重启**：进程退出不闪退丢失输出，提供 `[🔄 重新启动]` 旋钮；
* **防裁切物理安全边距与多功能快捷键盘**。

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
# 推荐：局域网开放启动（默认访问密码：000000）
HOST=0.0.0.0 PORT=4150 pnpm start

# 如需自定义访问密码
AUTH_PASSWORD=my_secure_password HOST=0.0.0.0 PORT=4150 pnpm start
```

启动后在手机浏览器打开：`http://<你的设备IP>:4150` 输入密码 `000000` 即可开始使用！

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue 与 Pull Request！

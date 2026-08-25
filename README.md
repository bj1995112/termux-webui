# AgentDeck Next

手机优先的通用 AI 编程 Agent 控制台:不管项目在哪、用哪个 CLI,打开同一个网址就能开会话、看输出、批权限。

> 项目早期(M1 骨架):当前已可用 —— 多会话终端 + 快捷键盘。对话视图 / 结构化 agent 接入在 M2/M3。

## 架构

```text
pnpm monorepo
├── shared/   前后端共享协议(zod 类型安全)
├── server/   Hono + node-pty + WebSocket(多会话管理)
└── web/      React 19 + Vite + Tailwind 4(移动优先)
```

## 运行

```bash
pnpm install
pnpm build          # 构建前端
pnpm start          # 默认 127.0.0.1:4173

# 局域网访问(手机)
HOST=0.0.0.0 pnpm start
```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/clis` | 检测本机可用的 CLI |
| GET | `/api/sessions` | 会话列表 |
| POST | `/api/sessions` | 创建会话 `{kind, cwd?}` |
| DELETE | `/api/sessions/:id` | 关闭会话 |
| WS | `/ws` | attach/input/resize/output/exit |

## 路线图

- [x] M1 多会话终端骨架(本期)
- [ ] M2 阅读模式:ANSI→网页输出流,原生选择复制
- [ ] M3 Claude stream-json 对话视图 + 权限按钮;opencode server 对接
- [ ] M4 PWA、主题系统(RGB 选色)、断线恢复

## 测试

```bash
pnpm test   # 后端 vitest(会话生命周期/PTY 流/协议校验)
```

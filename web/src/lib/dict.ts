/**
 * Instant 0ms Rich Unabbreviated Dictionary for Developer CLIs, Agent Submenus & Prompts.
 */

export interface DictEntry {
  badge: string; // e.g. "【压缩历史】" or "【模型推荐】" or "【确认授权】"
  title: string; // e.g. "/compact" or "Claude 3.7 Sonnet"
  explanation: string; // Full un-truncated Chinese explanation
}

export const RICH_DICT: Record<string, DictEntry> = {
  // ==========================================
  // 1. Level 1: Slash Commands (斜杠命令)
  // ==========================================
  '/compact': {
    badge: '【压缩历史】',
    title: '/compact',
    explanation: '清空当前长对话历史记录，但提炼并保留核心代码上下文与任务进度摘要，释放大量上下文窗口空间。',
  },
  '/cost': {
    badge: '【查看开销】',
    title: '/cost',
    explanation: '查看当前会话消耗的 Token 数量、输入/输出 Token 明细以及预估产生的 API 费用与总花费统计。',
  },
  '/help': {
    badge: '【帮助中心】',
    title: '/help',
    explanation: '打开系统帮助文档，列出所有可用斜杠命令、键盘快捷键、工作模式与使用技巧指南。',
  },
  '/init': {
    badge: '【项目初始化】',
    title: '/init',
    explanation: '对当前项目代码库进行深度全景扫描与结构分析，自动生成项目架构说明文件（CLAUDE.md / AGENTS.md）。',
  },
  '/review': {
    badge: '【代码审查】',
    title: '/review',
    explanation: '对比当前分支与基准分支的代码差异，审查所有未提交的修改，检查潜在代码缺陷、逻辑漏洞与优化建议。',
  },
  '/pr_comments': {
    badge: '【PR评论】',
    title: '/pr_comments',
    explanation: '从 GitHub 远程拉取并查看当前 Pull Request 的所有审查评论、讨论留言与修改请求。',
  },
  '/clear': {
    badge: '【清空屏幕】',
    title: '/clear',
    explanation: '清空终端屏幕历史输出，重新初始化当前窗口视图。',
  },
  '/exit': {
    badge: '【退出程序】',
    title: '/exit',
    explanation: '退出当前 Agent 工具或关闭当前终端交互会话。',
  },
  '/quit': {
    badge: '【退出程序】',
    title: '/quit',
    explanation: '安全保存会话状态并退出当前程序。',
  },
  '/login': {
    badge: '【登录认证】',
    title: '/login',
    explanation: '启动 OAuth 网页授权或输入 API Token 登录您的开发者账号。',
  },
  '/logout': {
    badge: '【登出账号】',
    title: '/logout',
    explanation: '注销并清除当前设备上保存的登录凭证与账户信息。',
  },
  '/config': {
    badge: '【配置中心】',
    title: '/config',
    explanation: '查看、编辑与管理全局偏好设置、API 密钥、工作目录、主题与默认参数。',
  },
  '/model': {
    badge: '【切换模型】',
    title: '/model',
    explanation: '打开模型选择子菜单，切换当前 Agent 使用的 AI 底座大模型（如 Claude 3.7 Sonnet、Haiku、GPT-4o）。',
  },
  '/status': {
    badge: '【运行状态】',
    title: '/status',
    explanation: '查看当前会话运行状态、当前激活的模型名称、网络连接与挂载工具状态。',
  },
  '/doctor': {
    badge: '【环境体检】',
    title: '/doctor',
    explanation: '全面检测本地运行环境依赖、Git 配置、编译器版本与网络连通性健康度。',
  },
  '/plan': {
    badge: '【规划模式】',
    title: '/plan',
    explanation: '进入多步骤任务规划模式，先分析需求制定严谨方案，待确认后再动手执行。',
  },
  '/goal': {
    badge: '【长程自主】',
    title: '/goal',
    explanation: '开启长程自主执行模式，Agent 将持续自主分析、编码、运行测试直到完全达成目标。',
  },
  '/bug': {
    badge: '【提交反馈】',
    title: '/bug',
    explanation: '自动收集当前错误日志与环境信息，向官方团队提交 Bug 问题报告与改进建议。',
  },
  '/terminal-setup': {
    badge: '【终端配置】',
    title: '/terminal-setup',
    explanation: '配置终端 Shift+Enter 换行快捷键与终端渲染特性。',
  },

  // ==========================================
  // 2. Level 2: Submenu Model Choices (模型子菜单)
  // ==========================================
  'claude 3.7 sonnet': {
    badge: '【模型推荐】',
    title: 'Claude 3.7 Sonnet',
    explanation: 'Anthropic 最新旗舰大模型，具备极强的深度编码推理、多步骤架构设计与代码生成能力（官方推荐默认模型）。',
  },
  'claude 3.5 sonnet': {
    badge: '【经典模型】',
    title: 'Claude 3.5 Sonnet',
    explanation: '广泛验证的高性能编程模型，具备优异的代码生成质量与逻辑稳定性。',
  },
  'claude 3.5 haiku': {
    badge: '【极速轻量】',
    title: 'Claude 3.5 Haiku',
    explanation: '响应速度极快、成本极其经济的轻量级模型，适合快速问答与简单脚本编辑。',
  },
  'claude 3 opus': {
    badge: '【超大模型】',
    title: 'Claude 3 Opus',
    explanation: '擅长超高难度深度逻辑推理与复杂学术分析的超大型模型。',
  },
  'gpt-4o': {
    badge: '【OpenAI】',
    title: 'GPT-4o',
    explanation: 'OpenAI 旗舰全能多模态大模型，具备出色的多语言与代码编写能力。',
  },
  'deepseek-chat': {
    badge: '【DeepSeek】',
    title: 'DeepSeek-V3',
    explanation: 'DeepSeek 深度求索高性价比通用模型，中文语境与代码能力优异。',
  },
  'deepseek-reasoner': {
    badge: '【深度推理】',
    title: 'DeepSeek-R1',
    explanation: '强化学习深度推理大模型，能够展示完整思考链，擅长复杂算法与架构解题。',
  },

  // ==========================================
  // 3. Level 3: Permissions & Actions (权限与交互操作)
  // ==========================================
  'yes, allow': {
    badge: '【确认授权】',
    title: 'Yes, allow',
    explanation: '允许 Agent 执行当前命令或修改文件，并继续向下执行下一步任务。',
  },
  'yes, allow this once': {
    badge: '【单次允许】',
    title: 'Yes, allow this once',
    explanation: '仅允许本次单次执行此命令或修改文件，下一次操作将重新向您确认。',
  },
  'always allow': {
    badge: '【永久信任】',
    title: 'Always allow for project',
    explanation: '在当前项目中对该类型操作永久信任并自动授权，后续无需重复手动点击确认。',
  },
  'no, reject': {
    badge: '【拒绝执行】',
    title: 'No, reject',
    explanation: '拒绝当前命令执行或文件修改请求，并要求 Agent 停止或寻找替代方案。',
  },
  'cancel': {
    badge: '【取消操作】',
    title: 'Cancel',
    explanation: '取消当前正在进行的交互操作，返回上一级命令行。',
  },
  'continue': {
    badge: '【继续执行】',
    title: 'Continue',
    explanation: '确认当前进度无误，命令 Agent 推进到下一个工作阶段。',
  },
  'skip': {
    badge: '【跳过此项】',
    title: 'Skip',
    explanation: '跳过当前单个文件或任务步骤，继续执行后续队列中的任务。',
  },
  'abort': {
    badge: '【紧急中止】',
    title: 'Abort',
    explanation: '立即中止整个任务流程并撤销未完成的临时状态。',
  },
  'retry': {
    badge: '【重试执行】',
    title: 'Retry',
    explanation: '重新尝试执行上一步失败的命令或网络请求。',
  },
  'all': {
    badge: '【全部允许】',
    title: 'All',
    explanation: '对当前提示涉及的所有文件或所有变更全部予以批准确认。',
  },
  'none': {
    badge: '【全部忽略】',
    title: 'None',
    explanation: '不应用列表中的任何选项或变更。',
  },
};

/**
 * Fast lookup from rich dictionary by keyword or partial match.
 */
export function lookupRichDict(text: string): DictEntry | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  // 1. Direct key match
  if (RICH_DICT[clean]) return RICH_DICT[clean];

  // 2. Slash command match (e.g. "/compact - Clear history..." -> match "/compact")
  const slashMatch = clean.match(/^(\/[a-z0-9_\-]+)/);
  if (slashMatch && RICH_DICT[slashMatch[1]]) {
    return RICH_DICT[slashMatch[1]];
  }

  // 3. Substring matching for options & models
  for (const [k, entry] of Object.entries(RICH_DICT)) {
    if (clean.includes(k)) {
      return entry;
    }
  }

  return null;
}

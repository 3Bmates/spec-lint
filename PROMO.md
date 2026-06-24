# 我做了一个开源工具：用 AI 来检查代码是否「言行一致」

## 背景

写代码时经常遇到一个问题：设计文档说好的接口，写着写着就变形了。

- 规格里定义了 `getUser(id: string): Promise<User>`，实际变成了 `getUser(userId: number)`
- 文档里写了要处理边界条件，代码里根本没考虑
- 代码 review 时没人有时间去逐行对照规格文档

这就是 **SDD（规格驱动开发）** 要解决的问题，而我做了个工具来实现它。

## spec-lint 是什么？

一个命令行工具，读取你的 `.spec.md` 规格文件，自动检查代码实现是否一致：

```bash
npm install -g spec-lint-cli
spec-lint
```

输出长这样：

```
╔══════════════════════════════════════════╗
║        spec-lint · 规格一致性检查        ║
╚══════════════════════════════════════════╝

📋 规格: 1 接口, 3 类型, 2 函数

❌ 错误 (2):
────────────────────────────────────────────────────
  🔧 [method] 方法 "deleteUser" 在接口中未找到
  ⚡ [function] 函数 "formatCurrency" 在源码中未找到

❌ 2 个错误
```

## 核心功能

### 1. 规格驱动开发 (SDD)
在 `specs/` 目录下写 `.spec.md`，定义接口、类型、函数签名：
```markdown
## 接口: UserService
- **方法**: `getUser(id: string): Promise<User>`

## 类型: User
interface User { id: string; name: string; }
```

### 2. AI 语义审查（免费）
集成了 Ollama 本地模型，零费用、不需要 API Key：
```bash
spec-lint --ai
```
AI 会从命名语义、逻辑完整性、边界处理、安全考量四个维度审查。

### 3. Git Hook
```bash
spec-lint init
```
一键安装 pre-commit hook，提交前自动检查。

### 4. Watch 模式
```bash
spec-lint --watch
```
边改代码边自动重检。

## 技术栈

- TypeScript + Node.js CLI
- Ollama 本地 AI（免费，默认 qwen2.5:1.5b）
- 可选 Anthropic Claude API
- 配置文件 `.spec-lintrc.json` 自定义规则

## 开源地址

**GitHub:** https://github.com/3Bmates/spec-lint
**Gitee:** https://gitee.com/bmates/spec-lint
**npm:** `npm install -g spec-lint-cli`

## 适合谁来用？

- 追求代码质量的小团队
- 想试试 SDD（规格驱动开发）的开发者
- 需要 AI 辅助 code review 但不想花钱的人

## 下一步

这个项目是我在开源软件技术课程中完成的作业，目前还在持续迭代。欢迎：
- 提 Issue / PR
- Star ⭐ 支持
- 试用后给反馈

项目的 CI 中自己吃自己的狗粮：每次 PR 都会用 spec-lint 检查 spec-lint 自身的规格一致性 😄

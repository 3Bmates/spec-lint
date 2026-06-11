# spec-lint

> 规格与代码一致性检查工具 — AI 驱动的 SDD 质量门禁

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么？

`spec-lint` 是一个 CLI 工具，用于：

1. 读取项目中的 `.spec.md` 规格文件
2. 检查代码实现是否与规格一致
3. 可选调用 AI 进行语义级别深度审查（**默认免费 · 本地运行**）
4. 支持 Git hook、watch 模式、配置文件

它是 **SDD（规格驱动开发）** 方法论的工具化实现。

## 快速开始

```bash
npm install -g spec-lint-cli
cd my-project
spec-lint
```

## 核心功能

### 1. 基本检查

```bash
spec-lint                          # 默认检查 specs/ → src/
spec-lint --spec ./docs --src ./lib  # 自定义路径
spec-lint --format json            # JSON 输出（CI 友好）
```

### 2. 配置文件 `.spec-lintrc.json`

```json
{
  "specDir": "./specs",
  "srcDir": "./src",
  "severity": {
    "interfaceMissing": "error",
    "methodMissing": "error",
    "typeMissing": "error",
    "functionMissing": "error",
    "fieldMissing": "warning"
  },
  "rules": {
    "checkInterfaces": true,
    "checkTypes": true,
    "checkFunctions": true
  },
  "ai": {
    "enabled": false,
    "provider": "ollama",
    "model": "qwen2.5:1.5b"
  }
}
```

### 3. Watch 模式（边改边查）

```bash
spec-lint --watch      # 或 -w
# 👀 正在监听文件变更... (Ctrl+C 退出)
# 📝 检测到变更: src/parser.ts
# ── 自动重检 ──
```

### 4. Git Pre-commit Hook

```bash
spec-lint init         # 一键安装
# ✅ Git pre-commit hook 已安装
# 每次 git commit 前自动运行 spec-lint
```

### 5. AI 审查（免费）

```bash
# 安装 Ollama（只需一次）
# 下载: https://ollama.com/download
ollama pull qwen2.5:1.5b

# 使用
spec-lint --ai

# 或换更强模型
spec-lint --ai --ai-provider anthropic --ai-key sk-ant-xxx
```

## 规格文件格式

```markdown
## 接口: UserService
- **方法**: `getUser(id: string): Promise<User>`

## 类型: User
```typescript
interface User {
  id: string;
  name: string;
}
```

## 函数: formatDate
- **签名**: `formatDate(date: Date, format: string): string`
```

## CI 集成

```yaml
# .github/workflows/ci.yml
- name: Spec Consistency Check
  run: npx spec-lint --format json

# 带 AI 审查（CI 需预装 Ollama）
- name: AI Spec Review
  run: npx spec-lint --ai
```

## 完整命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--spec <path>` | 规格文件目录 | `./specs/` |
| `--src <path>` | 源码目录 | `./src/` |
| `--watch, -w` | 文件变更自动重检 | - |
| `--ai` | 启用 AI 审查 (Ollama) | 关闭 |
| `--ai-provider` | `ollama` / `anthropic` | `ollama` |
| `--ai-model` | 自定义模型 | `qwen2.5:1.5b` |
| `--ai-key` | Anthropic Key | `AI_API_KEY` |
| `--format` | `text` / `json` | `text` |

| 子命令 | 说明 |
|--------|------|
| `spec-lint init` | 安装 Git pre-commit hook |
| `spec-lint --config` | 显示当前配置 |

## 退出码

| Code | 含义 |
|------|------|
| 0 | 全部通过 |
| 1 | 规格与实现不一致 |
| 2 | 命令行参数错误 |
| 3 | 规格文件解析失败 |
| 4 | AI API 调用失败 |

## 开发

```bash
npm install
npm test              # 10 tests
npm run build
npm run lint          # 自我检查
npm run dev -- --watch  # 开发模式 + watch
```

## 许可证

MIT

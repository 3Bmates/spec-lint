# spec-lint

> 规格与代码一致性检查工具 — AI 驱动的 SDD 质量门禁

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么？

`spec-lint` 是一个 CLI 工具，用于：

1. 读取项目中的 `.spec.md` 规格文件
2. 检查代码实现是否与规格一致
3. 可选调用 AI 进行语义级别深度审查（**默认免费 · 本地运行**）

它是 **SDD（规格驱动开发）** 方法论的工具化实现。

## 快速开始

```bash
# 安装
npm install -g spec-lint

# 在项目中使用
cd my-project
spec-lint
```

## AI 审查（免费）

`--ai` 默认使用 **Ollama 本地模型**，无需 API Key，不花一分钱：

```bash
# 1. 安装 Ollama（只需一次）
# 下载: https://ollama.com/download

# 2. 拉取轻量模型（只需一次，约 1GB）
ollama pull qwen2.5:1.5b

# 3. 直接使用
spec-lint --ai
```

如果想用更强的模型，也支持 Claude API：

```bash
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
  run: npx spec-lint --spec ./specs --src ./src

# 带 AI 审查（CI 机器需预装 Ollama）
- name: AI Spec Review
  run: npx spec-lint --ai --spec ./specs --src ./src
```

## 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--spec <path>` | 规格文件目录 | `./specs/` |
| `--src <path>` | 源码目录 | `./src/` |
| `--ai` | 启用 AI 语义审查 | 关闭 |
| `--ai-provider` | AI 引擎：`ollama`(默认) / `anthropic` | `ollama` |
| `--ai-model` | 自定义模型 | `qwen2.5:1.5b` |
| `--ai-key` | Anthropic Key（仅 anthropic 模式） | `AI_API_KEY` 环境变量 |
| `--format` | 输出格式: `text` / `json` | `text` |

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
npm test              # 运行测试
npm run dev           # 开发模式
npm run build         # 构建
npm run lint          # 自我检查（吃狗粮）
```

## 许可证

MIT

# spec-lint

> 规格与代码一致性检查工具 — AI 驱动的 SDD 质量门禁

[![npm version](https://img.shields.io/npm/v/spec-lint)](https://www.npmjs.com/package/spec-lint)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么？

`spec-lint` 是一个 CLI 工具，用于：

1. 读取项目中的 `.spec.md` 规格文件
2. 检查代码实现是否与规格一致
3. 可选调用 AI 进行语义级别深度审查

它是 **SDD（规格驱动开发）** 方法论的工具化实现。

## 快速开始

```bash
# 安装
npm install -g spec-lint

# 在项目中使用
cd my-project
spec-lint

# 指定规格和源码目录
spec-lint --spec ./docs/specs --src ./src

# 启用 AI 语义审查
spec-lint --ai --ai-key sk-ant-xxx
```

## 规格文件格式

```markdown
## 接口: UserService
- **方法**: `getUser(id: string): Promise<User>`
- **方法**: `createUser(data: CreateUserDTO): Promise<User>`

## 类型: User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
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
```

## 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--spec <path>` | 规格文件目录 | `./specs/` |
| `--src <path>` | 源码目录 | `./src/` |
| `--ai` | 启用 AI 语义审查 | 关闭 |
| `--ai-key <key>` | AI API Key | 环境变量 `AI_API_KEY` |
| `--format <type>` | 输出格式: `text` / `json` | `text` |
| `--help` | 显示帮助 | - |
| `--version` | 显示版本 | - |

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
# 安装依赖
npm install

# 运行测试
npm test

# 开发模式
npm run dev -- --spec ./specs --src ./src

# 构建
npm run build

# 自我检查（吃狗粮 🐶）
npm run lint
```

## 许可证

MIT

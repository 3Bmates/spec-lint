# spec-lint 规格文档

> 版本: 0.1.0 | 状态: draft | 最后更新: 2026-06-11

## 1. 概述

`spec-lint` 是一个 CLI 工具，用于检查代码实现是否与 `.spec.md` 规格文件一致。

### 1.1 核心目标

- 读取项目中的 `.spec.md` 规格文件
- 解析规格中定义的接口、函数签名、类型定义
- 检查源码实现是否与规格声明一致
- 可选调用 AI 进行语义级别的深度审查

### 1.2 v0.1 功能清单

- ✅ 基本检查（接口/类型/函数存在性 + 签名匹配）
- ✅ AI 语义审查（Ollama 免费 + Anthropic 可选）
- ✅ 配置文件 `.spec-lintrc.json`
- ✅ Watch 模式（文件变更自动重检）
- ✅ Git pre-commit hook 安装
- ✅ 彩色终端输出
- ✅ JSON / Text 双格式输出

### 1.3 非目标（v0.1 不做）

- 不自动修复不一致（只报告）
- 不支持非 TypeScript 语言（先聚焦 TS）

---

## 2. 功能规格

### 2.1 CLI 命令

```
spec-lint [options] [files...]

选项:
  --spec <path>      规格文件路径（默认: ./specs/）
  --src <path>       源码目录（默认: ./src/）
  --ai                启用 AI 语义审查
  --ai-key <key>     AI API Key（或通过环境变量 AI_API_KEY）
  --format <type>    输出格式: text (默认) | json
  --help             显示帮助
  --version          显示版本
```

#### 行为

| 场景 | 预期行为 |
|------|---------|
| 无参数运行 | 读取 ./specs/*.spec.md，检查 ./src/ 下所有 .ts 文件 |
| 指定 --spec | 只检查指定的规格文件 |
| 指定 --ai | 额外调用 AI API 做语义一致性审查 |
| 未找到规格文件 | 报错退出，exit code 1 |
| 所有检查通过 | 输出 "✓ All checks passed"，exit code 0 |
| 有检查失败 | 输出差异详情，exit code 1 |

### 2.2 规格解析器 (parser)

#### 输入

.spec.md 文件，支持以下格式：

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

#### 解析规则

| 规则 | 说明 |
|------|------|
| `## 接口: <Name>` | 定义一个接口，提取其后所有 `- **方法**:` 行 |
| `## 类型: <Name>` | 定义一个类型，提取其后代码块中的定义 |
| `## 函数: <Name>` | 定义一个函数，提取 `- **签名**:` 行 |
| 注释行（`<!-- -->`） | 忽略 |

#### 输出 Schema

```typescript
interface ParsedSpec {
  interfaces: InterfaceSpec[];
  types: TypeSpec[];
  functions: FunctionSpec[];
}

interface InterfaceSpec {
  name: string;
  methods: string[];  // 方法签名列表
  file: string;       // 所在规格文件
  line: number;       // 行号
}

interface TypeSpec {
  name: string;
  definition: string; // 类型定义的源代码文本
  file: string;
  line: number;
}

interface FunctionSpec {
  name: string;
  signature: string;  // 函数签名
  file: string;
  line: number;
}
```

### 2.3 代码检查器 (checker)

#### 检查类型

| 检查项 | 说明 | 严重度 |
|--------|------|--------|
| **接口存在性** | 规格中声明的接口在源码中是否存在 | error |
| **方法签名匹配** | 接口方法签名是否与规格一致 | error |
| **类型存在性** | 规格中声明的类型在源码中是否存在 | error |
| **类型字段匹配** | 类型的字段是否与规格一致 | warning |
| **函数存在性** | 规格中声明的函数在源码中是否存在 | error |
| **函数签名匹配** | 函数签名是否与规格一致 | error |

#### 匹配策略

- **存在性检查**: 在源码 AST 中搜索同名声明
- **签名匹配**: 将规格签名标准化后与源码签名比对（忽略空格、换行差异）
- **非精确匹配**: 规格中的类型在源码中有即可，不完全一致只报 warning

### 2.4 AI 语义审查器 (ai-reviewer)

#### 触发条件

- 必须通过 `--ai` 标志显式启用
- 需要有效的 API Key（`--ai-key` 或环境变量 `AI_API_KEY`）

#### 行为

1. 将规格内容 + 源码差异 发送给 AI
2. AI 返回语义层面的审查意见
3. 审查结果附加到最终报告中

#### 审查维度

| 维度 | 说明 |
|------|------|
| 命名语义 | 命名是否准确反映规格意图 |
| 逻辑完整性 | 实现是否覆盖了规格描述的行为 |
| 边界处理 | 是否处理了规格中隐含的边界条件 |
| 安全考量 | 是否存在明显安全漏洞 |

#### AI 引擎

| 引擎 | 默认 | 费用 | 需要 |
|------|------|------|------|
| **Ollama** (本地) | ✅ 默认 | 免费 | 安装 Ollama + 拉取模型 |
| **Anthropic** (云端) | 可选 | 按量付费 | API Key |

#### API 调用（Ollama 模式，默认）

```
POST http://localhost:11434/api/chat
{
  model: "qwen2.5:1.5b",
  stream: false,
  messages: [{
    role: "user",
    content: "你是一个代码审查专家..."
  }],
  options: { temperature: 0.1, num_predict: 1024 }
}
```

#### API 调用（Anthropic 模式）

```
POST https://api.anthropic.com/v1/messages
{
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: "你是一个代码审查专家..."
  }]
}
```

---

## 3. 项目结构

```
spec-lint/
├── specs/
│   └── spec-lint.spec.md      # 自己的规格（吃狗粮）
├── src/
│   ├── index.ts               # CLI 入口
│   ├── parser.ts              # 规格解析器
│   ├── checker.ts             # 代码检查器
│   ├── ai-reviewer.ts         # AI 语义审查器
│   ├── reporter.ts            # 结果输出格式化
│   └── __tests__/             # 测试
│       ├── parser.test.ts
│       ├── checker.test.ts
│       └── fixtures/          # 测试用的规格和源码
├── .github/workflows/
│   └── ci.yml                 # CI + AI 质量门禁
├── .gitee/                    # Gitee 配置
│   └── ISSUE_TEMPLATE.md
├── package.json
├── tsconfig.json
├── README.md
└── CONTRIBUTING.md
```

---

## 4. 错误码

| Code | 含义 |
|------|------|
| 0 | 全部通过 |
| 1 | 规格与实现不一致 |
| 2 | 命令行参数错误 |
| 3 | 规格文件解析失败 |
| 4 | AI API 调用失败 |

---

## 5. 测试策略

- **单元测试**: parser、checker、reporter 各模块独立测试
- **集成测试**: 端到端 CLI 测试（用 fixtures）
- **SDD 自测**: 用 spec-lint 检查 spec-lint 自身

---

## 6. spec-lint 自身规格（吃狗粮）

以下定义必须与源码实现保持一致，用于自测验证。

## 类型: ParsedSpec
```typescript
interface ParsedSpec {
  interfaces: InterfaceSpec[];
  types: TypeSpec[];
  functions: FunctionSpec[];
}
```

## 类型: InterfaceSpec
```typescript
interface InterfaceSpec {
  name: string;
  methods: string[];
  file: string;
  line: number;
}
```

## 类型: TypeSpec
```typescript
interface TypeSpec {
  name: string;
  definition: string;
  file: string;
  line: number;
}
```

## 类型: FunctionSpec
```typescript
interface FunctionSpec {
  name: string;
  signature: string;
  file: string;
  line: number;
}
```

## 类型: CheckResult
```typescript
interface CheckResult {
  type: 'interface' | 'method' | 'type' | 'function' | 'type-fields';
  severity: 'error' | 'warning';
  specItem: string;
  message: string;
  file: string;
  line: number;
}
```

## 函数: parseSpecs
- **签名**: `parseSpecs(filePaths: string[]): ParsedSpec`

## 函数: checkConsistency
- **签名**: `checkConsistency(spec: ParsedSpec, srcDir: string): CheckResult[]`

## 函数: aiReview
- **签名**: `aiReview(spec: ParsedSpec, checkResults: CheckResult[], sourceCode: string, options?: { provider?: AIProvider; apiKey?: string; baseUrl?: string; model?: string }): Promise<AIReviewSummary | null>`

## 函数: loadConfig
- **签名**: `loadConfig(cwd?: string): SpecLintConfig`

## 类型: SpecLintConfig
```typescript
interface SpecLintConfig {
  specDir: string;
  srcDir: string;
  severity: {
    interfaceMissing: 'error' | 'warning' | 'off';
    methodMissing: 'error' | 'warning' | 'off';
    typeMissing: 'error' | 'warning' | 'off';
    functionMissing: 'error' | 'warning' | 'off';
    fieldMissing: 'error' | 'warning' | 'off';
  };
  rules: {
    checkInterfaces: boolean;
    checkTypes: boolean;
    checkFunctions: boolean;
  };
  ai: {
    enabled: boolean;
    provider: 'ollama' | 'anthropic';
    model: string;
  };
  ignore: string[];
}
```

# 贡献指南

感谢你对 spec-lint 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/3Bmates/spec-lint/issues) 中搜索是否已有相同问题
2. 如果没有，创建新 Issue，描述：
   - 运行环境（OS、Node.js 版本）
   - 复现步骤
   - 预期行为 vs 实际行为

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 确保测试通过：`npm test`
4. 提交代码：`git commit -m "feat: 你的功能描述"`
5. 推送分支：`git push origin feat/your-feature`
6. 创建 Pull Request

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档变更
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具链变更

## 开发环境

```bash
npm install
npm run dev     # 开发模式
npm test        # 运行测试
npm run build   # 编译
```

## 项目结构

```
spec-lint/
├── specs/                  # 规格文档（SDD）
│   └── spec-lint.spec.md
├── src/
│   ├── index.ts            # CLI 入口
│   ├── parser.ts           # 规格解析器
│   ├── checker.ts          # 代码检查器
│   ├── ai-reviewer.ts      # AI 语义审查器
│   ├── config.ts           # 配置加载器
│   ├── reporter.ts         # 报告输出器
│   └── __tests__/          # 测试
├── .github/workflows/      # CI 配置
├── package.json
└── README.md
```

## SDD 开发流程

本项目采用 **规格驱动开发（SDD）**：

1. 在 `specs/` 中定义规格
2. 在 `src/` 中实现
3. 运行 `npm run lint` 自我检查
4. 确保规格与实现一致

## 许可证

MIT

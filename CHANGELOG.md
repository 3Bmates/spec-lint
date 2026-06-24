# Changelog

All notable changes to spec-lint will be documented in this file.

## [0.1.1] - 2026-06-11

### Added
- 配置文件 `.spec-lintrc.json` 支持
- Watch 模式（`--watch` / `-w`）：文件变更自动重检
- Git pre-commit hook 安装（`spec-lint init`）
- 彩色终端输出

### Changed
- AI 审查默认使用 Ollama 免费本地模型（qwen2.5:1.5b）
- 支持 Anthropic Claude API 作为备选引擎

## [0.1.0] - 2026-06-10

### Added
- 基本规格解析（接口/类型/函数）
- 代码一致性检查（存在性 + 签名匹配）
- AI 语义审查（Ollama + Anthropic 双引擎）
- JSON / Text 双格式输出
- CI/CD 集成（GitHub Actions）
- 自我一致性验证（吃狗粮）

[0.1.1]: https://github.com/3Bmates/spec-lint/releases/tag/v0.1.1
[0.1.0]: https://github.com/3Bmates/spec-lint/releases/tag/v0.1.0

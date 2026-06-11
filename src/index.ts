#!/usr/bin/env node
/**
 * spec-lint CLI 入口
 *
 * 用法: spec-lint [options]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { parseSpecs } from './parser.js';
import { checkConsistency } from './checker.js';
import { aiReview, type AIProvider } from './ai-reviewer.js';
import { formatText, formatJSON } from './reporter.js';

// ── 帮助信息 ──────────────────────────────────────────

const HELP = `
spec-lint — 规格与代码一致性检查工具（AI 驱动）

用法:
  spec-lint [options] [files...]

选项:
  --spec <path>      规格文件目录（默认: ./specs/）
  --src <path>       源码目录（默认: ./src/）
  --ai                启用 AI 语义审查（自动使用本地 Ollama）
  --ai-provider <p>  AI 引擎: ollama (默认, 免费) | anthropic (需 Key)
  --ai-model <name>  自定义模型名（默认: qwen2.5:1.5b）
  --ai-key <key>     Anthropic API Key（用 --ai-provider anthropic 时需要）
  --format <type>    输出格式: text (默认) | json
  --help             显示此帮助信息
  --version          显示版本号

示例:
  spec-lint                          # 默认检查
  spec-lint --ai                     # 启用 AI 审查 (Ollama 本地免费)
  spec-lint --ai --ai-model qwen2.5:0.5b   # 自定义模型
  spec-lint --ai --ai-provider anthropic --ai-key sk-ant-xxx  # 用 Claude

免费使用 AI 审查:
  安装 Ollama: https://ollama.com/download
  拉取模型:    ollama pull qwen2.5:1.5b
  然后直接:    spec-lint --ai

项目地址: https://gitee.com/bmates/spec-lint
`.trim();

// ── 查找所有 .spec.md 文件 ────────────────────────────

function findSpecFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.spec.md')) {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

// ── 收集源码 ──────────────────────────────────────────

function collectSourceCode(srcDir: string): string {
  if (!existsSync(srcDir)) return '';

  const parts: string[] = [];
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(full);
      } else if (entry.isFile() && extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts')) {
        parts.push(`// ${entry.name}\n${readFileSync(full, 'utf-8')}`);
      }
    }
  }
  walk(srcDir);
  return parts.join('\n\n');
}

// ── 主函数 ────────────────────────────────────────────

async function main(): Promise<number> {
  // 解析命令行参数
  const { values } = parseArgs({
    options: {
      spec: { type: 'string', default: './specs' },
      src: { type: 'string', default: './src' },
      ai: { type: 'boolean', default: false },
      'ai-provider': { type: 'string' },
      'ai-model': { type: 'string' },
      'ai-key': { type: 'string' },
      format: { type: 'string', default: 'text' },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  // --help / --version
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  if (values.version) {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname!, '../package.json'), 'utf-8')
    );
    console.log(`spec-lint v${pkg.version}`);
    return 0;
  }

  const specDir = resolve(values.spec as string);
  const srcDir = resolve(values.src as string);
  const outputFormat = values.format as 'text' | 'json';
  const enableAI = values.ai as boolean;

  // 1. 查找规格文件
  const specFiles = findSpecFiles(specDir);
  if (specFiles.length === 0) {
    console.error(`错误: 在 "${specDir}" 中未找到 .spec.md 文件`);
    return 3;
  }

  // 2. 解析规格
  let spec;
  try {
    spec = parseSpecs(specFiles);
  } catch (err) {
    console.error(`错误: 规格文件解析失败: ${(err as Error).message}`);
    return 3;
  }

  // 3. 检查源码一致性
  const checkResults = checkConsistency(spec, srcDir);

  // 4. AI 语义审查（可选）
  let aiResults = null;
  if (enableAI) {
    try {
      const sourceCode = collectSourceCode(srcDir);
      aiResults = await aiReview(spec, checkResults, sourceCode, {
        provider: values['ai-provider'] as AIProvider | undefined,
        model: values['ai-model'] as string | undefined,
        apiKey: (values['ai-key'] as string) || undefined,
      });
    } catch (err) {
      console.error(`AI 审查失败: ${(err as Error).message}`);
      return 4;
    }
  }

  // 5. 输出结果
  const report = {
    checkResults,
    aiResults: aiResults?.results,
    specCount: {
      interfaces: spec.interfaces.length,
      types: spec.types.length,
      functions: spec.functions.length,
    },
  };

  if (outputFormat === 'json') {
    console.log(formatJSON(report));
  } else {
    console.log(formatText(report));
  }

  // 6. 返回退出码
  const hasErrors = checkResults.some(r => r.severity === 'error');
  return hasErrors ? 1 : 0;
}

// ── 执行 ──────────────────────────────────────────────

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(`致命错误: ${err.message}`);
    process.exit(2);
  });

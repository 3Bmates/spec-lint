#!/usr/bin/env node
/**
 * spec-lint CLI 入口
 *
 * 用法:
 *   spec-lint                           # 默认检查
 *   spec-lint --watch                   # 文件变更自动重检
 *   spec-lint init                      # 安装 git pre-commit hook
 *   spec-lint --ai                      # 启用 AI 审查 (Ollama 免费)
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { parseArgs } from 'node:util';
import chalk from 'chalk';
import { watch } from 'chokidar';
import { parseSpecs } from './parser.js';
import { checkConsistency } from './checker.js';
import { aiReview, type AIProvider } from './ai-reviewer.js';
import { formatText, formatJSON, printSuccess, printError, printInfo } from './reporter.js';
import { loadConfig, DEFAULT_CONFIG } from './config.js';

const PKG_PATH = resolve(import.meta.dirname!, '../package.json');

// ── 帮助信息 ──────────────────────────────────────────

const HELP = `
${chalk.cyan.bold('spec-lint')} ${chalk.gray('— 规格与代码一致性检查工具（AI 驱动）')}

${chalk.bold('用法:')}
  spec-lint [options]
  spec-lint init       安装 Git pre-commit hook

${chalk.bold('选项:')}
  --spec <path>      规格目录 (默认: ./specs/)
  --src <path>       源码目录 (默认: ./src/)
  --watch, -w         文件变更自动重检
  --ai                启用 AI 语义审查 (默认 Ollama 免费)
  --ai-provider <p>  AI 引擎: ollama | anthropic
  --ai-model <name>  自定义模型 (默认: qwen2.5:1.5b)
  --ai-key <key>     Anthropic Key (仅 anthropic 模式)
  --format <type>    输出格式: text | json
  --help             显示此帮助

${chalk.bold('示例:')}
  ${chalk.gray('# 基本检查')}
  spec-lint

  ${chalk.gray('# 文件监听 (边改边查)')}
  spec-lint --watch

  ${chalk.gray('# AI 审查 (免费本地)')}
  spec-lint --ai

  ${chalk.gray('# 安装 Git hook')}
  spec-lint init

${chalk.bold('配置文件:')} .spec-lintrc.json
  https://gitee.com/bmates/spec-lint
`.trim();

// ── 工具函数 ──────────────────────────────────────────

function findSpecFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.spec.md')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function collectSourceCode(srcDir: string): string {
  if (!existsSync(srcDir)) return '';
  const parts: string[] = [];
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
        walk(full);
      else if (entry.isFile() && extname(entry.name) === '.ts' && !entry.name.endsWith('.test.ts'))
        parts.push(`// ${entry.name}\n${readFileSync(full, 'utf-8')}`);
    }
  }
  walk(srcDir);
  return parts.join('\n\n');
}

// ── 核心运行逻辑 ──────────────────────────────────────

async function runOnce(
  specDir: string,
  srcDir: string,
  options: { ai: boolean; provider?: string; model?: string; apiKey?: string; format: 'text' | 'json' }
): Promise<number> {
  // 1. 查找规格
  const specFiles = findSpecFiles(specDir);
  if (specFiles.length === 0) {
    console.error(chalk.red(`错误: 在 "${specDir}" 中未找到 .spec.md 文件`));
    return 3;
  }

  // 2. 解析规格
  let spec;
  try {
    spec = parseSpecs(specFiles);
  } catch (err) {
    console.error(chalk.red(`错误: 规格文件解析失败: ${(err as Error).message}`));
    return 3;
  }

  // 3. 检查一致性（传入配置）
  const config = loadConfig();
  const checkResults = checkConsistency(spec, srcDir, {
    severity: config.severity,
    rules: config.rules,
  });

  // 4. AI 审查
  let aiResults = null;
  if (options.ai) {
    try {
      const sourceCode = collectSourceCode(srcDir);
      aiResults = await aiReview(spec, checkResults, sourceCode, {
        provider: options.provider as AIProvider | undefined,
        model: options.model,
        apiKey: options.apiKey,
      });
    } catch (err) {
      console.error(chalk.red(`AI 审查失败: ${(err as Error).message}`));
      return 4;
    }
  }

  // 5. 输出
  const report = {
    checkResults,
    aiResults: aiResults?.results,
    specCount: {
      interfaces: spec.interfaces.length,
      types: spec.types.length,
      functions: spec.functions.length,
    },
  };

  if (options.format === 'json') {
    console.log(formatJSON(report));
  } else {
    console.log(formatText(report));
  }

  return checkResults.some(r => r.severity === 'error') ? 1 : 0;
}

// ── Watch 模式 ────────────────────────────────────────

async function runWatch(specDir: string, srcDir: string, options: typeof runOnce extends (...args: infer P) => any ? P[2] : any) {
  const dirsToWatch = [specDir, srcDir].filter(d => existsSync(d));
  if (dirsToWatch.length === 0) {
    console.error(chalk.red('错误: 没有可监听的目录'));
    process.exit(2);
  }

  console.log(chalk.cyan('\n👀 正在监听文件变更... (Ctrl+C 退出)\n'));
  console.log(chalk.gray(`  规格: ${specDir}`));
  console.log(chalk.gray(`  源码: ${srcDir}\n`));

  // 立即跑一次
  let exitCode = await runOnce(specDir, srcDir, options);

  // 监听变更
  const watcher = watch(dirsToWatch, {
    ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__tests__/**'],
    ignoreInitial: true,
  });

  let timer: ReturnType<typeof setTimeout> | null = null;

  const onChange = async (filePath: string) => {
    const rel = relative(process.cwd(), filePath).replace(/\\/g, '/');
    console.log(chalk.yellow(`\n📝 检测到变更: ${rel}`));

    // 防抖 300ms
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      console.log(chalk.gray('─'.repeat(60)));
      exitCode = await runOnce(specDir, srcDir, options);
      console.log(chalk.cyan('👀 继续监听... (Ctrl+C 退出)\n'));
    }, 300);
  };

  watcher.on('change', onChange);
  watcher.on('add', onChange);
  watcher.on('unlink', onChange);

  // 优雅退出
  process.on('SIGINT', () => {
    watcher.close();
    console.log(chalk.gray('\n再见 👋\n'));
    process.exit(exitCode);
  });
}

// ── Init: 安装 Git pre-commit hook ─────────────────────

function initGitHook(): number {
  const gitDir = resolve(process.cwd(), '.git');
  if (!existsSync(gitDir)) {
    console.error(chalk.red('错误: 当前目录不是 Git 仓库，请先运行 git init'));
    return 2;
  }

  const hooksDir = resolve(gitDir, 'hooks');
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });

  const hookPath = resolve(hooksDir, 'pre-commit');
  const hookScript = `#!/bin/sh
# spec-lint pre-commit hook
# 提交前检查规格与代码一致性

echo "🔍 spec-lint: 检查规格一致性..."
npx spec-lint --spec ./specs --src ./src --format text

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 规格检查未通过，提交已阻止"
  echo "   请修复后重试，或使用 git commit --no-verify 跳过"
  exit 1
fi

echo "✅ 规格检查通过"
`;

  try {
    writeFileSync(hookPath, hookScript, { mode: 0o755 });
    // Windows 下 chmod 可能无效，补一个
    try { chmodSync(hookPath, 0o755); } catch { /* 忽略 */ }
    printSuccess('Git pre-commit hook 已安装');
    console.log(chalk.gray(`   路径: ${relative(process.cwd(), hookPath)}`));
    console.log(chalk.gray('   每次 git commit 前会自动运行 spec-lint'));
    return 0;
  } catch (err) {
    printError(`安装失败: ${(err as Error).message}`);
    return 2;
  }
}

// ── Show config ───────────────────────────────────────

function showConfig(): number {
  const config = loadConfig();
  console.log(formatJSON({ checkResults: [], specCount: { interfaces: 0, types: 0, functions: 0 }, config }));
  return 0;
}

// ── 主入口 ────────────────────────────────────────────

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      spec: { type: 'string' },
      src: { type: 'string' },
      watch: { type: 'boolean', short: 'w', default: false },
      ai: { type: 'boolean', default: false },
      'ai-provider': { type: 'string' },
      'ai-model': { type: 'string' },
      'ai-key': { type: 'string' },
      format: { type: 'string', default: 'text' },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
      config: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  // 子命令: spec-lint init
  const subcommand = positionals[0] as string | undefined;
  if (subcommand === 'init') return initGitHook();
  if (values.config) return showConfig();

  // --help / --version
  if (values.help) { console.log(HELP); return 0; }
  if (values.version) {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
    console.log(`spec-lint v${pkg.version}`);
    return 0;
  }

  // 加载配置 (命令行参数优先级高于配置文件)
  const config = loadConfig();
  const specDir = resolve(values.spec as string || config.specDir);
  const srcDir = resolve(values.src as string || config.srcDir);
  const outputFormat = (values.format as 'text' | 'json') || 'text';

  const runOptions = {
    ai: (values.ai as boolean) || config.ai.enabled,
    provider: (values['ai-provider'] as string | undefined) || config.ai.provider,
    model: (values['ai-model'] as string | undefined) || config.ai.model,
    apiKey: values['ai-key'] as string | undefined,
    format: outputFormat,
  };

  // Watch 模式
  if (values.watch) {
    await runWatch(specDir, srcDir, runOptions);
    return 0;
  }

  // 单次运行
  return await runOnce(specDir, srcDir, runOptions);
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(chalk.red(`致命错误: ${err.message}`));
    process.exit(2);
  });

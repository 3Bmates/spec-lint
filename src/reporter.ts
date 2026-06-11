/**
 * spec-lint 报告输出器
 * 支持彩色 text 和 json 两种输出格式
 */

import chalk from 'chalk';
import type { CheckResult } from './checker.js';
import type { AIReviewResult } from './ai-reviewer.js';
import type { SpecLintConfig } from './config.js';

export interface ReportInput {
  checkResults: CheckResult[];
  aiResults?: AIReviewResult[] | null;
  specCount: { interfaces: number; types: number; functions: number };
  config?: SpecLintConfig;
}

const BOX_TOP = '╔══════════════════════════════════════════╗';
const BOX_BOT = '╚══════════════════════════════════════════╝';

const ICONS: Record<string, string> = {
  interface: '🔌',
  method: '🔧',
  type: '📐',
  function: '⚡',
  'type-fields': '📋',
};

const SEV_ICONS: Record<string, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

// ── JSON 输出 ──────────────────────────────────────────

export function formatJSON(input: ReportInput): string {
  const output = {
    summary: {
      total: input.checkResults.length,
      errors: input.checkResults.filter(r => r.severity === 'error').length,
      warnings: input.checkResults.filter(r => r.severity === 'warning').length,
      specItems: input.specCount,
    },
    checkResults: input.checkResults,
    aiReview: input.aiResults || [],
  };
  return JSON.stringify(output, null, 2);
}

// ── 彩色 Text 输出 ─────────────────────────────────────

export function formatText(input: ReportInput): string {
  const lines: string[] = [];
  const { checkResults, aiResults, specCount, config } = input;

  // 头部
  lines.push('');
  lines.push(chalk.cyan(BOX_TOP));
  lines.push(chalk.cyan('║') + chalk.bold.white('        spec-lint · 规格一致性检查        ') + chalk.cyan('║'));
  lines.push(chalk.cyan(BOX_BOT));
  lines.push('');

  // 规格概览
  const specItems = [
    `${chalk.yellow(specCount.interfaces)} 接口`,
    `${chalk.yellow(specCount.types)} 类型`,
    `${chalk.yellow(specCount.functions)} 函数`,
  ].join(', ');
  lines.push(`${chalk.blue('📋')} 规格: ${specItems}`);

  if (config) {
    const offRules = Object.entries(config.severity).filter(([, v]) => v === 'off').map(([k]) => k);
    if (offRules.length > 0) {
      lines.push(`   ${chalk.gray(`已关闭 ${offRules.length} 项检查（${offRules.join(', ')}）`)}`);
    }
  }
  lines.push('');

  // 错误
  const errors = checkResults.filter(r => r.severity === 'error');
  const warnings = checkResults.filter(r => r.severity === 'warning');

  if (errors.length > 0) {
    lines.push(chalk.red.bold(`❌ 错误 (${errors.length}):`));
    lines.push(chalk.gray('─'.repeat(60)));
    for (const err of errors) {
      const icon = ICONS[err.type] || '●';
      lines.push(`  ${icon} ${chalk.red(`[${err.type}]`)} ${err.message}`);
      lines.push(`        ${chalk.gray(`📍 ${err.file}:${err.line}`)}`);
    }
    lines.push('');
  }

  // 警告
  if (warnings.length > 0) {
    lines.push(chalk.yellow.bold(`⚠️  警告 (${warnings.length}):`));
    lines.push(chalk.gray('─'.repeat(60)));
    for (const w of warnings) {
      const icon = ICONS[w.type] || '●';
      lines.push(`  ${icon} ${chalk.yellow(`[${w.type}]`)} ${w.message}`);
      lines.push(`        ${chalk.gray(`📍 ${w.file}:${w.line}`)}`);
    }
    lines.push('');
  }

  // AI 审查
  if (aiResults && aiResults.length > 0) {
    lines.push(chalk.magenta.bold(`🤖 AI 语义审查 (${aiResults.length} 条):`));
    lines.push(chalk.gray('─'.repeat(60)));
    for (const r of aiResults) {
      const icon = SEV_ICONS[r.severity] || '●';
      const color = r.severity === 'error' ? chalk.red :
        r.severity === 'warning' ? chalk.yellow : chalk.gray;
      lines.push(`  ${icon} ${color(`[${r.dimension}]`)} ${r.finding}`);
      lines.push(`     ${chalk.cyan('💡')} ${r.suggestion}`);
    }
    lines.push('');
  }

  // 总结
  if (errors.length === 0 && warnings.length === 0) {
    lines.push(chalk.green.bold('✅ 所有检查通过！'));
  } else if (errors.length === 0) {
    lines.push(chalk.yellow.bold(`✅ 无错误，${warnings.length} 个警告`));
  } else {
    lines.push(chalk.red.bold(`❌ ${errors.length} 个错误, ${warnings.length} 个警告`));
  }
  lines.push('');

  return lines.join('\n');
}

// ── 简单消息 ──────────────────────────────────────────

export function printSuccess(msg: string): void {
  console.log(chalk.green(`✅ ${msg}`));
}

export function printError(msg: string): void {
  console.error(chalk.red(`❌ ${msg}`));
}

export function printInfo(msg: string): void {
  console.log(chalk.blue(`ℹ️  ${msg}`));
}

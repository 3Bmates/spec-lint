/**
 * spec-lint 报告输出器
 * 支持 text 和 json 两种输出格式
 */

import type { CheckResult } from './checker.js';
import type { AIReviewResult } from './ai-reviewer.js';

export interface ReportInput {
  checkResults: CheckResult[];
  aiResults?: AIReviewResult[] | null;
  specCount: { interfaces: number; types: number; functions: number };
}

/**
 * 输出为 JSON 格式
 */
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

/**
 * 输出为人类可读的 text 格式
 */
export function formatText(input: ReportInput): string {
  const lines: string[] = [];
  const { checkResults, aiResults, specCount } = input;

  // 头部
  lines.push('');
  lines.push('╔══════════════════════════════════════════╗');
  lines.push('║        spec-lint · 规格一致性检查        ║');
  lines.push('╚══════════════════════════════════════════╝');
  lines.push('');

  // 规格概览
  lines.push(`📋 规格文件: ${specCount.interfaces} 接口, ${specCount.types} 类型, ${specCount.functions} 函数`);
  lines.push('');

  // 错误
  const errors = checkResults.filter(r => r.severity === 'error');
  const warnings = checkResults.filter(r => r.severity === 'warning');

  if (errors.length > 0) {
    lines.push(`❌ 错误 (${errors.length}):`);
    lines.push('─'.repeat(60));
    for (const err of errors) {
      lines.push(`  [${err.type}] ${err.message}`);
      lines.push(`        📍 ${err.file}:${err.line}`);
    }
    lines.push('');
  }

  // 警告
  if (warnings.length > 0) {
    lines.push(`⚠️  警告 (${warnings.length}):`);
    lines.push('─'.repeat(60));
    for (const w of warnings) {
      lines.push(`  [${w.type}] ${w.message}`);
      lines.push(`        📍 ${w.file}:${w.line}`);
    }
    lines.push('');
  }

  // AI 审查结果
  if (aiResults && aiResults.length > 0) {
    lines.push(`🤖 AI 语义审查 (${aiResults.length} 条):`);
    lines.push('─'.repeat(60));
    for (const r of aiResults) {
      const icon = r.severity === 'error' ? '❌' : r.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} [${r.dimension}] ${r.finding}`);
      lines.push(`     💡 ${r.suggestion}`);
    }
    lines.push('');
  }

  // 总结
  if (errors.length === 0 && warnings.length === 0) {
    lines.push('✅ 所有检查通过！');
  } else if (errors.length === 0) {
    lines.push('✅ 无错误，但有警告需要关注');
  } else {
    lines.push(`❌ 发现 ${errors.length} 个错误，${warnings.length} 个警告`);
  }
  lines.push('');

  return lines.join('\n');
}

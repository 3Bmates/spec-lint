/**
 * 报告输出器测试
 */

import { describe, it, expect } from 'vitest';
import { formatText, formatJSON } from '../reporter.js';
import type { CheckResult } from '../checker.js';
import type { AIReviewResult } from '../ai-reviewer.js';

const sampleResults: CheckResult[] = [
  {
    type: 'interface',
    severity: 'error',
    specItem: 'UserService',
    message: '接口 "UserService" 在源码中未找到',
    file: 'specs/api.spec.md',
    line: 10,
  },
  {
    type: 'method',
    severity: 'warning',
    specItem: 'UserService.getUser',
    message: '方法签名可能不匹配规格',
    file: 'specs/api.spec.md',
    line: 12,
  },
];

const sampleAIResults: AIReviewResult[] = [
  {
    dimension: '命名语义',
    finding: '函数名与规格意图不完全匹配',
    severity: 'warning',
    suggestion: '建议将 doStuff 重命名为 calculateTotal',
  },
];

describe('formatJSON', () => {
  it('应输出有效的 JSON', () => {
    const json = formatJSON({
      checkResults: sampleResults,
      aiResults: null,
      specCount: { interfaces: 2, types: 3, functions: 1 },
    });
    const parsed = JSON.parse(json);
    expect(parsed.summary.total).toBe(2);
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.specItems.interfaces).toBe(2);
  });

  it('应包含 AI 审查结果', () => {
    const json = formatJSON({
      checkResults: sampleResults,
      aiResults: sampleAIResults,
      specCount: { interfaces: 1, types: 1, functions: 1 },
    });
    const parsed = JSON.parse(json);
    expect(parsed.aiReview).toHaveLength(1);
    expect(parsed.aiReview[0].dimension).toBe('命名语义');
  });

  it('空结果应输出正确 summary', () => {
    const json = formatJSON({
      checkResults: [],
      aiResults: null,
      specCount: { interfaces: 0, types: 0, functions: 0 },
    });
    const parsed = JSON.parse(json);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.summary.errors).toBe(0);
  });
});

describe('formatText', () => {
  it('应包含头部信息', () => {
    const text = formatText({
      checkResults: [],
      aiResults: null,
      specCount: { interfaces: 1, types: 2, functions: 3 },
    });
    expect(text).toContain('spec-lint');
    expect(text).toContain('规格一致性检查');
    expect(text).toContain('1 接口');
    expect(text).toContain('2 类型');
    expect(text).toContain('3 函数');
  });

  it('全部通过时应显示成功信息', () => {
    const text = formatText({
      checkResults: [],
      aiResults: null,
      specCount: { interfaces: 0, types: 0, functions: 0 },
    });
    expect(text).toContain('所有检查通过');
  });

  it('有错误时应显示错误详情', () => {
    const text = formatText({
      checkResults: sampleResults,
      aiResults: null,
      specCount: { interfaces: 1, types: 1, functions: 1 },
    });
    expect(text).toContain('UserService');
    expect(text).toContain('api.spec.md');
    expect(text).toContain('1 个错误');
    expect(text).toContain('1 个警告');
  });

  it('包含 AI 审查结果时应显示 AI 区块', () => {
    const text = formatText({
      checkResults: [],
      aiResults: sampleAIResults,
      specCount: { interfaces: 0, types: 0, functions: 0 },
    });
    expect(text).toContain('AI 语义审查');
    expect(text).toContain('命名语义');
    expect(text).toContain('calculateTotal');
  });

  it('配置项关闭时应提示', () => {
    const text = formatText({
      checkResults: [],
      aiResults: null,
      specCount: { interfaces: 1, types: 0, functions: 0 },
      config: {
        specDir: './specs',
        srcDir: './src',
        severity: {
          interfaceMissing: 'off',
          methodMissing: 'error',
          typeMissing: 'error',
          functionMissing: 'error',
          fieldMissing: 'warning',
        },
        rules: {
          checkInterfaces: true,
          checkTypes: true,
          checkFunctions: true,
        },
        ai: { enabled: false, provider: 'ollama', model: 'qwen2.5:1.5b' },
        ignore: [],
      },
    });
    expect(text).toContain('已关闭 1 项检查');
  });
});

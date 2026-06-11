/**
 * 代码检查器测试
 */

import { describe, it, expect } from 'vitest';
import { checkConsistency } from '../checker.js';
import type { ParsedSpec } from '../parser.js';

describe('checkConsistency', () => {
  const spec: ParsedSpec = {
    interfaces: [{
      name: 'ParsedSpec',
      methods: [],
      file: 'test.spec.md',
      line: 1,
    }],
    types: [{
      name: 'ParsedSpec',
      definition: 'interface ParsedSpec { interfaces: any[]; types: any[]; functions: any[]; }',
      file: 'test.spec.md',
      line: 5,
    }, {
      name: 'NonExistentType',
      definition: 'type NonExistentType = string;',
      file: 'test.spec.md',
      line: 10,
    }],
    functions: [{
      name: 'parseSpecs',
      signature: 'parseSpecs(filePaths: string[]): ParsedSpec',
      file: 'test.spec.md',
      line: 15,
    }, {
      name: 'nonExistentFunction',
      signature: 'nonExistentFunction(x: number): void',
      file: 'test.spec.md',
      line: 20,
    }],
  };

  it('应正确检查存在的接口', () => {
    const results = checkConsistency(spec, 'src');
    const ifaceResult = results.find(r => r.type === 'interface' && r.specItem === 'ParsedSpec');
    expect(ifaceResult).toBeUndefined(); // 应该存在，无错误
  });

  it('应正确检查存在的类型', () => {
    const results = checkConsistency(spec, 'src');
    const typeResult = results.find(r => r.type === 'type' && r.specItem === 'ParsedSpec');
    expect(typeResult).toBeUndefined(); // 应该存在，无错误
  });

  it('应报告不存在的类型', () => {
    const results = checkConsistency(spec, 'src');
    const missingType = results.find(r => r.type === 'type' && r.specItem === 'NonExistentType');
    expect(missingType).toBeDefined();
    expect(missingType!.severity).toBe('error');
  });

  it('应报告不存在的函数', () => {
    const results = checkConsistency(spec, 'src');
    const missingFunc = results.find(r => r.type === 'function' && r.specItem === 'nonExistentFunction');
    expect(missingFunc).toBeDefined();
    expect(missingFunc!.severity).toBe('error');
  });

  it('不应报告存在的函数', () => {
    const results = checkConsistency(spec, 'src');
    const existingFunc = results.find(r => r.type === 'function' && r.specItem === 'parseSpecs');
    expect(existingFunc).toBeUndefined(); // 应该存在，无错误
  });
});

/**
 * 代码检查器测试
 * 使用受控 fixtures 而非真实 src/ 目录
 */

import { describe, it, expect } from 'vitest';
import { checkConsistency } from '../checker.js';
import type { ParsedSpec } from '../parser.js';
import { resolve } from 'node:path';

const fixtureSrc = resolve(import.meta.dirname!, 'fixtures/src');

describe('checkConsistency', () => {
  const spec: ParsedSpec = {
    interfaces: [{
      name: 'ParsedSpec',
      methods: ['parseSpecs'],
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
    }, {
      name: 'parseSpecs',
      // wrong signature — type should differ from source
      signature: 'parseSpecs(filePaths: string[]): string',
      file: 'test.spec.md',
      line: 25,
    }],
  };

  it('应正确检查存在的接口', () => {
    const results = checkConsistency(spec, fixtureSrc);
    const ifaceResult = results.find(r => r.type === 'interface' && r.specItem === 'ParsedSpec');
    expect(ifaceResult).toBeUndefined();
  });

  it('应正确检查存在的类型', () => {
    const results = checkConsistency(spec, fixtureSrc);
    const typeResult = results.find(r => r.type === 'type' && r.specItem === 'ParsedSpec');
    expect(typeResult).toBeUndefined();
  });

  it('应报告不存在的类型', () => {
    const results = checkConsistency(spec, fixtureSrc);
    const missingType = results.find(r => r.type === 'type' && r.specItem === 'NonExistentType');
    expect(missingType).toBeDefined();
    expect(missingType!.severity).toBe('error');
  });

  it('应报告不存在的函数', () => {
    const results = checkConsistency(spec, fixtureSrc);
    const missingFunc = results.find(r => r.type === 'function' && r.specItem === 'nonExistentFunction');
    expect(missingFunc).toBeDefined();
    expect(missingFunc!.severity).toBe('error');
  });

  it('不应报告存在的函数', () => {
    const results = checkConsistency(spec, fixtureSrc);
    const existingError = results.find(r => r.type === 'function' && r.specItem === 'parseSpecs' && r.severity === 'error');
    expect(existingError).toBeUndefined();
  });

  it('应正确处理 severity: off 的规则', () => {
    const results = checkConsistency(spec, fixtureSrc, {
      severity: {
        interfaceMissing: 'off',
        methodMissing: 'error',
        typeMissing: 'off',
        functionMissing: 'error',
        fieldMissing: 'warning',
      },
      rules: { checkInterfaces: true, checkTypes: true, checkFunctions: true },
    });
    // NonExistentType severity is "off" — should be filtered out
    const typeResult = results.find(r => r.type === 'type');
    expect(typeResult).toBeUndefined();
    // NonExistentFunction should still be reported (error)
    const funcResult = results.find(r => r.type === 'function');
    expect(funcResult).toBeDefined();
  });

  it('应正确处理 checkFunctions: false', () => {
    const results = checkConsistency(spec, fixtureSrc, {
      rules: { checkInterfaces: true, checkTypes: true, checkFunctions: false },
    });
    const funcResult = results.find(r => r.type === 'function');
    expect(funcResult).toBeUndefined();
  });

  it('签名不匹配时应报告 warning', () => {
    const results = checkConsistency(spec, fixtureSrc);
    // parseSpecs with signature 'parseSpecs(filePaths: string[]): string' should get a warning
    const sigWarnings = results.filter(r => r.type === 'function' && r.severity === 'warning');
    expect(sigWarnings.length).toBeGreaterThanOrEqual(1);
    expect(sigWarnings[0].message).toContain('签名可能不匹配');
  });
});

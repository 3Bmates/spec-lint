/**
 * 规格解析器测试
 */

import { describe, it, expect } from 'vitest';
import { parseSpecs } from '../parser.js';
import { resolve } from 'node:path';

const fixture = resolve(import.meta.dirname!, 'fixtures/test.spec.md');

describe('parseSpecs', () => {
  it('应正确解析接口定义', () => {
    const result = parseSpecs([fixture]);
    expect(result.interfaces).toHaveLength(1);
    expect(result.interfaces[0].name).toBe('UserService');
    expect(result.interfaces[0].methods).toEqual([
      'getUser(id: string): Promise<User>',
      'createUser(data: CreateUserDTO): Promise<User>',
    ]);
  });

  it('应正确解析类型定义', () => {
    const result = parseSpecs([fixture]);
    expect(result.types).toHaveLength(2);
    expect(result.types.map(t => t.name)).toContain('User');
    expect(result.types.map(t => t.name)).toContain('CreateUserDTO');

    const userType = result.types.find(t => t.name === 'User')!;
    expect(userType.definition).toContain('interface User');
    expect(userType.definition).toContain('id: string');
    expect(userType.definition).toContain('name: string');
    expect(userType.definition).toContain('email: string');
  });

  it('应正确解析函数定义', () => {
    const result = parseSpecs([fixture]);
    expect(result.functions).toHaveLength(2);
    expect(result.functions.map(f => f.name)).toContain('formatDate');
    expect(result.functions.map(f => f.name)).toContain('validateEmail');

    const formatDate = result.functions.find(f => f.name === 'formatDate')!;
    expect(formatDate.signature).toBe('formatDate(date: Date, format: string): string');
  });

  it('空文件列表应返回空结果', () => {
    const result = parseSpecs([]);
    expect(result.interfaces).toHaveLength(0);
    expect(result.types).toHaveLength(0);
    expect(result.functions).toHaveLength(0);
  });

  it('应跳过代码块中的内容', () => {
    // spec-lint 自己的 spec 中有代码块示例，不应被解析
    const selfSpec = resolve(import.meta.dirname!, '../../specs/spec-lint.spec.md');
    const result = parseSpecs([selfSpec]);
    // 不应解析到 UserService（它在示例代码块中）
    expect(result.interfaces.find(i => i.name === 'UserService')).toBeUndefined();
  });
});

/**
 * 配置加载器测试
 */

import { describe, it, expect } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from '../config.js';

describe('loadConfig', () => {
  it('无配置文件时返回默认配置', () => {
    const config = loadConfig('.');
    expect(config.specDir).toBe(DEFAULT_CONFIG.specDir);
    expect(config.srcDir).toBe(DEFAULT_CONFIG.srcDir);
    expect(config.severity.interfaceMissing).toBe('error');
    expect(config.ai.enabled).toBe(false);
  });

  it('应正确解析 .spec-lintrc.json', () => {
    // Only works when running from the project root
    const config = loadConfig();
    expect(config.specDir).toBe('./specs');
    expect(config.srcDir).toBe('./src');
    expect(config.rules.checkInterfaces).toBe(true);
  });

  it('应正确合并部分配置', () => {
    const config = loadConfig();
    // When loading from project root, the .spec-lintrc.json exists
    // Default values that aren't overridden should still be present
    expect(config.severity.fieldMissing).toBe('warning');
    expect(config.ignore).toContain('node_modules');
  });

  it('DEFAULT_CONFIG 应包含所有必填字段', () => {
    expect(DEFAULT_CONFIG.specDir).toBeDefined();
    expect(DEFAULT_CONFIG.srcDir).toBeDefined();
    expect(DEFAULT_CONFIG.severity).toBeDefined();
    expect(DEFAULT_CONFIG.rules).toBeDefined();
    expect(DEFAULT_CONFIG.ai).toBeDefined();
    expect(DEFAULT_CONFIG.ignore).toBeDefined();
    expect(DEFAULT_CONFIG.severity.interfaceMissing).toBe('error');
    expect(DEFAULT_CONFIG.severity.fieldMissing).toBe('warning');
  });

  it('AI 配置默认使用 ollama + qwen2.5:1.5b', () => {
    expect(DEFAULT_CONFIG.ai.provider).toBe('ollama');
    expect(DEFAULT_CONFIG.ai.model).toBe('qwen2.5:1.5b');
    expect(DEFAULT_CONFIG.ai.enabled).toBe(false);
  });
});

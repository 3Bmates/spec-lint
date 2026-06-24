/**
 * spec-lint 配置加载器
 * 支持 .spec-lintrc.json / .spec-lintrc / spec-lint.config.json
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AIProvider } from './ai-reviewer.js';

// ── 类型 ──────────────────────────────────────────────

export interface SpecLintConfig {
  /** 规格文件目录 */
  specDir: string;
  /** 源码目录 */
  srcDir: string;
  /** 严重度配置 */
  severity: {
    interfaceMissing: 'error' | 'warning' | 'off';
    methodMissing: 'error' | 'warning' | 'off';
    typeMissing: 'error' | 'warning' | 'off';
    functionMissing: 'error' | 'warning' | 'off';
    fieldMissing: 'error' | 'warning' | 'off';
  };
  /** 启用的检查规则 */
  rules: {
    checkInterfaces: boolean;
    checkTypes: boolean;
    checkFunctions: boolean;
  };
  /** AI 审查配置 */
  ai: {
    enabled: boolean;
    provider: AIProvider;
    model: string;
  };
  /** 忽略的文件模式 */
  ignore: string[];
}

// ── 默认配置 ──────────────────────────────────────────

export const DEFAULT_CONFIG: SpecLintConfig = {
  specDir: './specs',
  srcDir: './src',
  severity: {
    interfaceMissing: 'error',
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
  ai: {
    enabled: false,
    provider: 'ollama',
    model: 'qwen2.5:1.5b',
  },
  ignore: ['node_modules', 'dist', '.git', '__tests__'],
};

// ── 加载逻辑 ──────────────────────────────────────────

const CONFIG_FILES = [
  '.spec-lintrc.json',
  '.spec-lintrc',
  'spec-lint.config.json',
];

/**
 * 从项目根目录加载配置文件，不存在则返回默认配置
 */
export function loadConfig(cwd: string = process.cwd()): SpecLintConfig {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8'));
        return mergeConfig(DEFAULT_CONFIG, raw);
      } catch {
        console.warn(`⚠️  配置文件 ${name} 解析失败，使用默认配置`);
      }
    }
  }
  return { ...DEFAULT_CONFIG };
}

/** 深度合并配置 */
function mergeConfig(base: SpecLintConfig, overrides: Partial<SpecLintConfig>): SpecLintConfig {
  return {
    ...base,
    ...overrides,
    severity: { ...base.severity, ...overrides.severity },
    rules: { ...base.rules, ...overrides.rules },
    ai: { ...base.ai, ...overrides.ai },
  };
}

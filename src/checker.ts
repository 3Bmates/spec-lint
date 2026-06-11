/**
 * spec-lint 代码检查器
 * 对比解析后的规格与源码实现，报告差异
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import type { ParsedSpec, InterfaceSpec, TypeSpec, FunctionSpec } from './parser.js';
import type { SpecLintConfig } from './config.js';

// ── 类型定义 ──────────────────────────────────────────

export type Severity = 'error' | 'warning';

export interface CheckResult {
  type: 'interface' | 'method' | 'type' | 'function' | 'type-fields';
  severity: Severity;
  specItem: string;      // 规格项名称
  message: string;
  file: string;          // 规格文件
  line: number;
}

/** 默认严重度配置 */
const DEFAULT_SEVERITY = {
  interfaceMissing: 'error' as const,
  methodMissing: 'error' as const,
  typeMissing: 'error' as const,
  functionMissing: 'error' as const,
  fieldMissing: 'warning' as const,
};

// ── 工具函数 ──────────────────────────────────────────

/** 收集目录下所有 TS 源文件的内容 */
function collectSourceFiles(srcDir: string): Map<string, string> {
  const files = new Map<string, string>();

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = resolve(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== '__tests__') {
          walk(full);
        }
      } else if (extname(entry) === '.ts' && !entry.endsWith('.test.ts')) {
        const relPath = relative(process.cwd(), full).replace(/\\/g, '/');
        files.set(relPath, readFileSync(full, 'utf-8'));
      }
    }
  }

  walk(srcDir);
  return files;
}

/** 标准化签名串：移除多余空格，便于比较 */
function normalize(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/** 从源码中查找某个标识符是否存在 */
function findInSources(sources: Map<string, string>, pattern: RegExp): { found: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const [, content] of sources) {
    const found = content.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }
  return { found: matches.length > 0, matches };
}

// ── 核心检查 ──────────────────────────────────────────

function checkInterface(iface: InterfaceSpec, sources: Map<string, string>): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. 接口存在性（搜索 interface X 或 class X 或 type X）
  const namePattern = new RegExp(`\\b(interface|class|type)\\s+${escapeRegex(iface.name)}\\b`, 'm');
  const { found: ifaceExists } = findInSources(sources, namePattern);

  if (!ifaceExists) {
    results.push({
      type: 'interface',
      severity: 'error',
      specItem: iface.name,
      message: `接口 "${iface.name}" 在源码中未找到 (interface/class/type)` ,
      file: iface.file,
      line: iface.line,
    });
    return results;
  }

  // 2. 检查每个方法
  for (const methodSig of iface.methods) {
    // 提取方法名: "getUser(id: string): Promise<User>" → "getUser"
    const methodName = methodSig.match(/^(\w+)/)?.[1];
    if (!methodName) continue;

    const methodPattern = new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`, 'm');
    const { found: methodExists } = findInSources(sources, methodPattern);

    if (!methodExists) {
      results.push({
        type: 'method',
        severity: 'error',
        specItem: `${iface.name}.${methodName}`,
        message: `方法 "${methodName}" 在接口 "${iface.name}" 的源码中未找到`,
        file: iface.file,
        line: iface.line,
      });
    } else {
      // 找到方法，做简单的签名比对
      const sigPattern = new RegExp(
        `${escapeRegex(methodName)}\\s*\\([^)]*\\)[^;{]*`,
        'm'
      );
      const { matches } = findInSources(sources, sigPattern);
      const sigMatch = matches.find(m => {
        const normalized = normalize(m);
        const normalizedSpec = normalize(methodSig);
        return normalized.includes(normalizedSpec) || normalizedSpec.includes(normalized);
      });

      if (!sigMatch) {
        results.push({
          type: 'method',
          severity: 'warning',
          specItem: `${iface.name}.${methodName}`,
          message: `方法 "${methodName}" 签名可能不匹配规格: \`${methodSig}\``,
          file: iface.file,
          line: iface.line,
        });
      }
    }
  }

  return results;
}

function checkType(typeSpec: TypeSpec, sources: Map<string, string>): CheckResult[] {
  const results: CheckResult[] = [];

  // 类型存在性
  const namePattern = new RegExp(`\\b(interface|type|class|enum)\\s+${escapeRegex(typeSpec.name)}\\b`, 'm');
  const { found } = findInSources(sources, namePattern);

  if (!found) {
    results.push({
      type: 'type',
      severity: 'error',
      specItem: typeSpec.name,
      message: `类型 "${typeSpec.name}" 在源码中未找到`,
      file: typeSpec.file,
      line: typeSpec.line,
    });
  }

  // 字段检查（简单比对规格中定义的关键字段名）
  const specFields = extractFieldNames(typeSpec.definition);
  for (const field of specFields) {
    const fieldPattern = new RegExp(`\\b${escapeRegex(field)}\\b`, 'm');
    const { found: fieldFound } = findInSources(sources, fieldPattern);
    if (!fieldFound) {
      results.push({
        type: 'type-fields',
        severity: 'warning',
        specItem: `${typeSpec.name}.${field}`,
        message: `字段 "${field}" 在类型 "${typeSpec.name}" 的源码中未找到`,
        file: typeSpec.file,
        line: typeSpec.line,
      });
    }
  }

  return results;
}

function checkFunction(funcSpec: FunctionSpec, sources: Map<string, string>): CheckResult[] {
  const results: CheckResult[] = [];

  // 函数存在性
  const funcPattern = new RegExp(
    `\\b(function\\s+${escapeRegex(funcSpec.name)}|const\\s+${escapeRegex(funcSpec.name)}\\s*=|export\\s+function\\s+${escapeRegex(funcSpec.name)})`,
    'm'
  );
  const { found } = findInSources(sources, funcPattern);

  if (!found) {
    results.push({
      type: 'function',
      severity: 'error',
      specItem: funcSpec.name,
      message: `函数 "${funcSpec.name}" 在源码中未找到`,
      file: funcSpec.file,
      line: funcSpec.line,
    });
  }

  return results;
}

/** 从类型定义文本中提取字段名 */
function extractFieldNames(definition: string): string[] {
  const fields: string[] = [];
  const lines = definition.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(\w+)\s*[:?]/);
    if (m && m[1] !== 'interface' && m[1] !== 'type') {
      fields.push(m[1]);
    }
  }
  return fields;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 入口 ────────────────────────────────────────────────

export function checkConsistency(
  spec: ParsedSpec,
  srcDir: string,
  config?: Pick<SpecLintConfig, 'severity' | 'rules'>
): CheckResult[] {
  const sources = collectSourceFiles(srcDir);
  const results: CheckResult[] = [];
  const sev = config?.severity || DEFAULT_SEVERITY;
  const rules = config?.rules || { checkInterfaces: true, checkTypes: true, checkFunctions: true };

  // 检查接口
  if (rules.checkInterfaces) {
    for (const iface of spec.interfaces) {
      const r = checkInterface(iface, sources);
      // 应用严重度配置
      for (const item of r) {
        if (item.type === 'interface' && sev.interfaceMissing === 'off') continue;
        if (item.type === 'method' && sev.methodMissing === 'off') continue;
        if (item.type === 'interface') item.severity = sev.interfaceMissing as Severity;
        if (item.type === 'method') item.severity = sev.methodMissing as Severity;
        results.push(item);
      }
    }
  }

  // 检查类型
  if (rules.checkTypes) {
    for (const typeSpec of spec.types) {
      const r = checkType(typeSpec, sources);
      for (const item of r) {
        if (item.type === 'type' && sev.typeMissing === 'off') continue;
        if (item.type === 'type-fields' && sev.fieldMissing === 'off') continue;
        if (item.type === 'type') item.severity = sev.typeMissing as Severity;
        if (item.type === 'type-fields') item.severity = sev.fieldMissing as Severity;
        results.push(item);
      }
    }
  }

  // 检查函数
  if (rules.checkFunctions) {
    for (const funcSpec of spec.functions) {
      const r = checkFunction(funcSpec, sources);
      for (const item of r) {
        if (sev.functionMissing === 'off') continue;
        item.severity = sev.functionMissing as Severity;
        results.push(item);
      }
    }
  }

  return results;
}

/**
 * spec-lint 规格解析器
 * 解析 .spec.md 文件，提取接口、类型、函数定义
 */

import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

// ── 类型定义 ──────────────────────────────────────────

export interface InterfaceSpec {
  name: string;
  methods: string[];
  file: string;
  line: number;
}

export interface TypeSpec {
  name: string;
  definition: string;
  file: string;
  line: number;
}

export interface FunctionSpec {
  name: string;
  signature: string;
  file: string;
  line: number;
}

export interface ParsedSpec {
  interfaces: InterfaceSpec[];
  types: TypeSpec[];
  functions: FunctionSpec[];
}

// ── 解析逻辑 ──────────────────────────────────────────

/**
 * 从 Markdown 内容中提取接口定义
 * 匹配模式: "## 接口: <Name>" 后跟 "- **方法**: `...`"
 * 跳过代码块 (```) 内的内容
 */
function extractInterfaces(lines: string[], filePath: string): InterfaceSpec[] {
  const interfaces: InterfaceSpec[] = [];
  let current: InterfaceSpec | null = null;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 追踪代码块
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      // 代码块结束后，结束当前接口
      if (!inCodeBlock && current) {
        interfaces.push(current);
        current = null;
      }
      continue;
    }
    if (inCodeBlock) continue;

    // 匹配 "## 接口: <Name>"
    const ifaceMatch = line.match(/^##\s+接口:\s*(\S+)/);
    if (ifaceMatch) {
      if (current) interfaces.push(current);
      current = {
        name: ifaceMatch[1],
        methods: [],
        file: filePath,
        line: i + 1,
      };
      continue;
    }

    // 匹配 "- **方法**: `...`" 在接口定义下
    if (current) {
      const methodMatch = line.match(/^-\s*\*\*方法\*\*:\s*`(.+?)`/);
      if (methodMatch) {
        current.methods.push(methodMatch[1]);
      }

      // 遇到下一个二级标题，结束当前接口
      if (line.startsWith('## ') && !line.includes('接口:')) {
        interfaces.push(current);
        current = null;
      }
    }
  }

  if (current) interfaces.push(current);
  return interfaces;
}

/**
 * 从 Markdown 内容中提取类型定义
 * 匹配模式: "## 类型: <Name>" 后跟 TypeScript 代码块
 */
function extractTypes(lines: string[], filePath: string): TypeSpec[] {
  const types: TypeSpec[] = [];
  let i = 0;
  let inCodeBlock = false;

  while (i < lines.length) {
    const line = lines[i];

    // 追踪代码块
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      i++;
      continue;
    }
    if (inCodeBlock) { i++; continue; }

    const typeMatch = line.match(/^##\s+类型:\s*(\S+)/);
    if (typeMatch) {
      const name = typeMatch[1];
      // 向后查找代码块
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) j++;
      // 找到代码块起始
      if (j < lines.length && lines[j].startsWith('```')) {
        const codeStart = j + 1;
        let codeEnd = codeStart;
        while (codeEnd < lines.length && !lines[codeEnd].startsWith('```')) codeEnd++;

        const definition = lines.slice(codeStart, codeEnd).join('\n');
        if (definition.trim()) {
          types.push({
            name,
            definition: definition.trim(),
            file: filePath,
            line: i + 1,
          });
        }
        i = codeEnd + 1;
        continue;
      }
    }
    i++;
  }

  return types;
}

/**
 * 从 Markdown 内容中提取函数定义
 * 匹配模式: "## 函数: <Name>" 后跟 "- **签名**: `...`"
 */
function extractFunctions(lines: string[], filePath: string): FunctionSpec[] {
  const functions: FunctionSpec[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 追踪代码块
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const funcMatch = line.match(/^##\s+函数:\s*(\S+)/);
    if (!funcMatch) continue;

    const name = funcMatch[1];
    // 向后查找签名行
    for (let j = i + 1; j < lines.length && j <= i + 5; j++) {
      const sigMatch = lines[j].match(/^-\s*\*\*签名\*\*:\s*`(.+?)`/);
      if (sigMatch) {
        functions.push({
          name,
          signature: sigMatch[1],
          file: filePath,
          line: i + 1,
        });
        break;
      }
    }
  }

  return functions;
}

/**
 * 解析单个 .spec.md 文件
 */
function parseSpecFile(filePath: string): ParsedSpec {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = relative(process.cwd(), filePath).replace(/\\/g, '/');

  return {
    interfaces: extractInterfaces(lines, relativePath),
    types: extractTypes(lines, relativePath),
    functions: extractFunctions(lines, relativePath),
  };
}

/**
 * 批量解析 .spec.md 文件
 */
export function parseSpecs(filePaths: string[]): ParsedSpec {
  const merged: ParsedSpec = {
    interfaces: [],
    types: [],
    functions: [],
  };

  for (const fp of filePaths) {
    const parsed = parseSpecFile(fp);
    merged.interfaces.push(...parsed.interfaces);
    merged.types.push(...parsed.types);
    merged.functions.push(...parsed.functions);
  }

  return merged;
}

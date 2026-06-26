/**
 * spec-lint AI 语义审查器
 *
 * 支持两种引擎:
 * - ollama (默认):  免费本地运行，无需 API Key，需安装 Ollama
 * - anthropic:      云端 Claude API，需提供 API Key
 *
 * 优先级: 如果未指定引擎 → 先尝试 Ollama → Ollama 不可用则报错提示安装
 */

import type { ParsedSpec } from './parser.js';
import type { CheckResult } from './checker.js';

// ── 类型定义 ──────────────────────────────────────────

export interface AIReviewResult {
  dimension: string;
  finding: string;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
}

export interface AIReviewSummary {
  results: AIReviewResult[];
  model: string;
  provider: 'ollama' | 'anthropic';
}

export type AIProvider = 'ollama' | 'anthropic';

// ── 默认配置 ──────────────────────────────────────────

/** Ollama 默认使用小模型，速度快、任何机器都能跑 */
const OLLAMA_DEFAULT = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:1.5b',   // 轻量、中文友好、代码能力强
  timeout: 60000,
};

const ANTHROPIC_DEFAULT = {
  baseUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5-20251001',
  timeout: 30000,
};

const INSTALL_GUIDE = `
⚠️  未检测到可用的 AI 引擎。请选择以下方案之一:

方案 A（推荐·免费）: 安装 Ollama 本地模型
  1. 下载安装: https://ollama.com/download
  2. 拉取模型: ollama pull qwen2.5:1.5b
  3. 重新运行: spec-lint --ai

方案 B（付费·更强）: 使用 Claude API
  设置环境变量: set AI_API_KEY=sk-ant-your-key
  然后运行: spec-lint --ai
`.trim();

// ── 检查 Ollama 是否可用 ──────────────────────────────

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_DEFAULT.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── 构建审查提示词 ────────────────────────────────────

function buildReviewPrompt(
  spec: ParsedSpec,
  checkResults: CheckResult[],
  sourceCode: string
): string {
  const specSummary = [
    `接口 (${spec.interfaces.length}): ${spec.interfaces.map(i => i.name).join(', ') || '(无)'}`,
    `类型 (${spec.types.length}): ${spec.types.map(t => t.name).join(', ') || '(无)'}`,
    `函数 (${spec.functions.length}): ${spec.functions.map(f => f.name).join(', ') || '(无)'}`,
  ].join('\n');

  const errors = checkResults.filter(r => r.severity === 'error');
  const warnings = checkResults.filter(r => r.severity === 'warning');

  return `你是一个代码审查专家。请严格检查以下代码实现是否与规格文档一致。

## 规格定义

${specSummary}

详细规格:
${JSON.stringify({ interfaces: spec.interfaces, types: spec.types, functions: spec.functions }, null, 2)}

## 结构检查结果

错误 (${errors.length}):
${errors.map(e => `- ${e.message}`).join('\n') || '(无)'}

警告 (${warnings.length}):
${warnings.map(w => `- ${w.message}`).join('\n') || '(无)'}

## 源码片段

\`\`\`typescript
${sourceCode.slice(0, 8000)}
\`\`\`

## 审查维度

针对以下 4 个维度逐一审查，给出具体发现（必须结合代码细节，不要空泛评价）:
1. **命名语义** — 函数/变量/类型命名是否准确反映规格意图？有无歧义或误导？
2. **逻辑完整性** — 实现是否覆盖规格描述的全部行为？有无遗漏的逻辑分支？
3. **边界处理** — 空值/null/超时/异常/并发等边界条件是否处理？
4. **安全考量** — 是否存在注入/泄露/权限/未校验输入等安全风险？

## 输出格式（严格遵守）

{"results":[{"dimension":"命名语义","finding":"发现的问题或通过","severity":"error|warning|info","suggestion":"改进建议"},{"dimension":"逻辑完整性","finding":"...","severity":"...","suggestion":"..."},{"dimension":"边界处理","finding":"...","severity":"...","suggestion":"..."},{"dimension":"安全考量","finding":"...","severity":"...","suggestion":"..."}]}

规则:
- 必须输出完整的 4 个维度
- 无问题时 severity 用 "info"，finding 写"该项检查通过"
- 只输出 JSON 对象本身，不要任何解释文字`;
}

// ── Ollama 调用 ──────────────────────────────────────

async function callOllama(prompt: string, model: string): Promise<AIReviewResult[]> {
  const response = await fetch(`${OLLAMA_DEFAULT.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: '你是一个严格的代码审查专家。你只输出 JSON，绝不输出任何其他文字。' },
        { role: 'user', content: prompt },
      ],
      format: 'json',  // 强制 Ollama 输出合法 JSON
      options: { temperature: 0.1, num_predict: 1024 },
    }),
    signal: AbortSignal.timeout(OLLAMA_DEFAULT.timeout),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama 返回错误 ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json() as { message: { content: string } };
  return parseAIResponse(data.message.content);
}

// ── Anthropic 调用 ────────────────────────────────────

async function callAnthropic(prompt: string, apiKey: string, baseUrl: string, model: string): Promise<AIReviewResult[]> {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(ANTHROPIC_DEFAULT.timeout),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API 返回错误 ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  const aiText = data.content?.[0]?.text || '';
  return parseAIResponse(aiText);
}

// ── 解析 AI 返回内容 ─────────────────────────────────

/** 4 个维度的中文标签 */
const DIMENSION_LABELS = ['命名语义', '逻辑完整性', '边界处理', '安全考量'];

function parseAIResponse(text: string): AIReviewResult[] {
  // 策略 1: 尝试直接解析 JSON（Ollama format:json 模式会返回纯 JSON）
  const jsonResult = tryParseJSON(text);
  if (jsonResult && jsonResult.length > 0) return jsonResult;

  // 策略 2: 尝试从 markdown 代码块中提取 JSON
  const codeMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeMatch) {
    const blockResult = tryParseJSON(codeMatch[1]);
    if (blockResult && blockResult.length > 0) return blockResult;
  }

  // 策略 3: 自然语言回退 — 将整段文本作为通用建议返回
  return buildFallbackResults(text);
}

/** 尝试从文本中提取并解析 JSON */
function tryParseJSON(text: string): AIReviewResult[] | null {
  try {
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1 || braceEnd <= braceStart) return null;

    const clean = text.slice(braceStart, braceEnd + 1);
    const parsed = JSON.parse(clean);

    // 标准格式: { results: [...] }
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results.filter((r: AIReviewResult) => r.dimension && r.finding);
    }

    // 直接是数组: [...]
    if (Array.isArray(parsed) && parsed.every((r: AIReviewResult) => r.dimension && r.finding)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/** 自然语言回退: 将全文作为一个通用建议，按段落拆分维度 */
function buildFallbackResults(text: string): AIReviewResult[] {
  // 清理文本
  const clean = text.replace(/```[\s\S]*?```/g, '').trim();

  // 尝试按 "命名语义"、"逻辑完整性" 等关键词拆分
  const results: AIReviewResult[] = [];
  let remaining = clean;

  for (const label of DIMENSION_LABELS) {
    const idx = remaining.indexOf(label);
    if (idx === -1) {
      // 该维度未提及，默认通过
      results.push({
        dimension: label,
        finding: 'AI 未对该维度提出具体问题',
        severity: 'info',
        suggestion: '可手动审查该维度',
      });
      continue;
    }

    // 从该维度标签开始，到下一个维度标签或文本结束
    const start = idx + label.length;
    let end = remaining.length;
    for (const nextLabel of DIMENSION_LABELS) {
      const nextIdx = remaining.indexOf(nextLabel, start);
      if (nextIdx !== -1 && nextIdx < end) {
        end = nextIdx;
      }
    }

    const content = remaining.slice(start, end).replace(/^[\s:：*#\-\n]+/, '').trim();

    results.push({
      dimension: label,
      finding: content.slice(0, 200) || 'AI 未对该维度提出具体问题',
      severity: content.includes('问题') || content.includes('风险') || content.includes('漏洞') || content.includes('错误')
        ? 'warning'
        : 'info',
      suggestion: content.length > 200 ? content.slice(0, 200) : content || '可手动审查该维度',
    });

    remaining = remaining.slice(end);
  }

  // 如果完全没有匹配到任何维度标签，返回整段当作通用建议
  if (results.every(r => r.finding.includes('未对该维度提出'))) {
    return [{
      dimension: '通用',
      finding: clean.slice(0, 300),
      severity: 'warning',
      suggestion: '以上为 AI 自然语言输出，建议使用更强大的模型（如 qwen2.5:7b）以获得结构化结果',
    }];
  }

  return results;
}

// ── 入口函数 ──────────────────────────────────────────

export interface AIReviewOptions {
  provider?: AIProvider;     // 指定引擎，不指定则自动检测
  apiKey?: string;           // Anthropic API Key
  baseUrl?: string;          // 自定义 API 地址
  model?: string;            // 自定义模型名
}

export async function aiReview(
  spec: ParsedSpec,
  checkResults: CheckResult[],
  sourceCode: string,
  options: AIReviewOptions = {}
): Promise<AIReviewSummary | null> {
  const { provider, apiKey, baseUrl, model } = options;

  // 确定使用哪个引擎
  let engine: AIProvider;

  if (provider === 'anthropic') {
    engine = 'anthropic';
  } else if (provider === 'ollama') {
    engine = 'ollama';
  } else {
    // 自动检测: 先试 Ollama, 不行再用 Anthropic
    const ollamaOk = await checkOllama();
    if (ollamaOk) {
      engine = 'ollama';
    } else if (apiKey || process.env.AI_API_KEY) {
      engine = 'anthropic';
    } else {
      console.error(INSTALL_GUIDE);
      return null;
    }
  }

  const prompt = buildReviewPrompt(spec, checkResults, sourceCode);

  try {
    let results: AIReviewResult[];
    let modelName: string;

    if (engine === 'ollama') {
      modelName = model || OLLAMA_DEFAULT.model;
      results = await callOllama(prompt, modelName);
    } else {
      const key = apiKey || process.env.AI_API_KEY;
      if (!key) throw new Error('Anthropic 模式需要 API Key');
      modelName = model || ANTHROPIC_DEFAULT.model;
      results = await callAnthropic(
        prompt,
        key,
        baseUrl || process.env.AI_BASE_URL || ANTHROPIC_DEFAULT.baseUrl,
        modelName
      );
    }

    return { results, model: modelName, provider: engine };
  } catch (err) {
    console.error(`AI 审查失败 (${engine}): ${(err as Error).message}`);
    return null;
  }
}

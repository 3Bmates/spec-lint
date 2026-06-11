/**
 * spec-lint AI 语义审查器
 * 调用 AI API 对规格与实现做语义级别的深度审查
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
  cost: number;
}

// ── 配置 ──────────────────────────────────────────────

interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
}

const DEFAULT_CONFIG: Partial<AIConfig> = {
  baseUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5-20251001',
  timeout: 30000,
};

// ── 构建审查提示词 ────────────────────────────────────

function buildReviewPrompt(
  spec: ParsedSpec,
  checkResults: CheckResult[],
  sourceCode: string
): string {
  const specSummary = [
    `接口 (${spec.interfaces.length}): ${spec.interfaces.map(i => i.name).join(', ')}`,
    `类型 (${spec.types.length}): ${spec.types.map(t => t.name).join(', ')}`,
    `函数 (${spec.functions.length}): ${spec.functions.map(f => f.name).join(', ')}`,
  ].join('\n');

  const errors = checkResults.filter(r => r.severity === 'error');
  const warnings = checkResults.filter(r => r.severity === 'warning');

  return `你是一个代码审查专家。请检查以下代码实现是否与规格文档一致。

## 规格定义

${specSummary}

详细规格:
${JSON.stringify({
  interfaces: spec.interfaces,
  types: spec.types,
  functions: spec.functions,
}, null, 2)}

## 结构检查结果

错误 (${errors.length}):
${errors.map(e => `- ${e.message}`).join('\n') || '(无)'}

警告 (${warnings.length}):
${warnings.map(w => `- ${w.message}`).join('\n') || '(无)'}

## 源码片段

\`\`\`typescript
${sourceCode.slice(0, 8000)}
\`\`\`

请从以下维度审查，并以 JSON 格式返回结果:
1. **命名语义**: 命名是否准确反映规格中的意图
2. **逻辑完整性**: 实现是否覆盖了规格描述的行为
3. **边界处理**: 是否处理了规格中隐含的边界条件
4. **安全考量**: 是否存在明显安全漏洞

返回格式:
\`\`\`json
{
  "results": [
    {
      "dimension": "命名语义|逻辑完整性|边界处理|安全考量",
      "finding": "发现描述",
      "severity": "error|warning|info",
      "suggestion": "改进建议"
    }
  ]
}
\`\`\``;
}

// ── API 调用 ──────────────────────────────────────────

async function callAI(prompt: string, config: AIConfig): Promise<AIReviewResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API 返回错误 ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
    };

    const aiText = data.content?.[0]?.text || '';
    return parseAIResponse(aiText);
  } finally {
    clearTimeout(timer);
  }
}

/** 从 AI 回复中提取 JSON 结果 */
function parseAIResponse(text: string): AIReviewResult[] {
  // 尝试匹配 JSON 块
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim());
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results;
    }
  } catch {
    // JSON 解析失败，返回原始文本作为一条结果
    return [{
      dimension: '通用',
      finding: `AI 返回非标准 JSON，原始内容: ${text.slice(0, 500)}`,
      severity: 'warning',
      suggestion: '请检查 AI API 调用',
    }];
  }

  return [];
}

// ── 入口 ────────────────────────────────────────────────

export async function aiReview(
  spec: ParsedSpec,
  checkResults: CheckResult[],
  sourceCode: string,
  options: { apiKey?: string; baseUrl?: string } = {}
): Promise<AIReviewSummary | null> {
  const apiKey = options.apiKey || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('AI 审查需要 API Key。请通过 --ai-key 或环境变量 AI_API_KEY 提供');
  }

  const config: AIConfig = {
    apiKey,
    baseUrl: options.baseUrl || process.env.AI_BASE_URL || DEFAULT_CONFIG.baseUrl!,
    model: DEFAULT_CONFIG.model!,
    timeout: DEFAULT_CONFIG.timeout!,
  };

  const prompt = buildReviewPrompt(spec, checkResults, sourceCode);

  try {
    const results = await callAI(prompt, config);
    return {
      results,
      model: config.model,
      cost: estimateCost(results),
    };
  } catch (err) {
    console.error(`AI 审查失败: ${(err as Error).message}`);
    return null;
  }
}

/** 粗略估算成本（非精确计费，仅做参考） */
function estimateCost(results: AIReviewResult[]): number {
  // Claude Haiku 约 $0.25/MTok input, $1.25/MTok output
  // 这里只是一个占位估算
  return results.length * 0.001;
}

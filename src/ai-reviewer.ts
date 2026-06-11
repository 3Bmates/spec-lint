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

  return `你是一个代码审查专家。请检查以下代码实现是否与规格文档一致。

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

请从以下维度审查，以 JSON 格式返回:
1. **命名语义**: 命名是否准确反映规格意图
2. **逻辑完整性**: 实现是否覆盖规格描述的行为
3. **边界处理**: 是否处理了规格中隐含的边界条件
4. **安全考量**: 是否存在明显安全漏洞

只返回 JSON，不要其他内容:
{"results":[{"dimension":"...","finding":"...","severity":"error|warning|info","suggestion":"..."}]}`;
}

// ── Ollama 调用 ──────────────────────────────────────

async function callOllama(prompt: string, model: string): Promise<AIReviewResult[]> {
  const response = await fetch(`${OLLAMA_DEFAULT.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: 'user', content: prompt }],
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

// ── 解析 AI 返回的 JSON ──────────────────────────────

function parseAIResponse(text: string): AIReviewResult[] {
  // 尝试匹配 JSON 块或直接 JSON
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    // 提取最外层 { ... } 对象
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart === -1 || braceEnd === -1) throw new Error('未找到 JSON');
    const clean = jsonStr.slice(braceStart, braceEnd + 1);
    const parsed = JSON.parse(clean);
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results;
    }
  } catch {
    return [{
      dimension: '通用',
      finding: `AI 返回解析失败，原始内容: ${text.slice(0, 300)}`,
      severity: 'warning',
      suggestion: '请手动检查或更换模型重试',
    }];
  }

  return [];
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

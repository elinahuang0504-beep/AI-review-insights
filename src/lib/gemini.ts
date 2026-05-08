/**
 * Zhipu GLM AI Service Layer for HMI Design Review
 *
 * Uses 智谱AI GLM-5V-Turbo (视觉模型) for:
 * 1. Image analysis - understanding HMI design screenshots
 * 2. Multi-dimension evaluation scoring (8 dimensions)
 * 3. Issue diagnosis with AS-IS/TO-BE format
 * 4. Comparison between design versions
 *
 * Compatible interface: OpenAI SDK → 智谱 OpenAI-compatible endpoint
 */

import OpenAI from "openai";

/* ============================================================
   Types
   ============================================================ */

export interface DimensionScore {
  code: string;
  name: string;
  score: number;       // 0-10
  maxScore: number;
  color: string;
  reasoning: string;
}

export interface IssueItem {
  id: string;
  severity: "critical" | "serious" | "warning" | "info";
  category: string;
  dimension: string;
  description: string;     // AS-IS
  suggestion: string;      // TO-BE
  imageIndex?: number;
}

export interface ReviewResult {
  overallScore: number;
  rating: "excellent" | "good" | "average" | "poor";
  summary: string;
  dimensions: DimensionScore[];
  issues: IssueItem[];
  imageAnalysis?: ImageAnalysisResult[];
}

export interface ImageAnalysisResult {
  index: number;
  state: string;
  detectedElements: string[];
  uiDescription: string;
}

export interface InferenceResult {
  functionName: string;       // 推断的功能名称
  goals: string[];            // 关键目标列表
  imageStates: string[];      // 每张图的状态描述
}

export interface CompareResult {
  v1Review: ReviewResult;
  v2Review: ReviewResult;
  comparison: ComparisonSummary;
  recommendation: string;
}

export interface ComparisonSummary {
  improvedDimensions: string[];
  regressedDimensions: string[];
  netScoreChange: number;
  keyChanges: string[];
}

export interface ReviewRequest {
  images: { data: string; name: string; state: string }[];
  taskName: string;
  description: string;
  goals: string[];
  systemType: string;
  scene: string;
  evalMode: "standard" | "safety" | "visual" | "interaction";
}

export interface CompareRequest {
  v1Images: { data: string; name: string; state: string }[];
  v2Images: { data: string; name: string; state: string }[];
  taskName: string;
  description: string;
  goals: string[];
  systemType: string;
  scene: string;
}

/* ============================================================
   Dimension Configuration
   ============================================================ */

export const DIMENSIONS = [
  { code: "D1", name: "驾驶安全性", weight: "20%", color: "#ef4444",
    criteria: "视线偏移时间、操作步数、触控目标大小、驾驶干扰度、NHTSA/ISO 15007合规性" },
  { code: "D2", name: "视觉可读性", weight: "15%", color: "#3b82f6",
    criteria: "对比度(WCAG AA)、字体可读性、色彩辨识度、夜间眩光风险、信息密度" },
  { code: "D3", name: "信息架构", weight: "15%", color: "#8b5cf6",
    criteria: "层级清晰度、分组合理性、导航效率、信息优先级、认知负荷" },
  { code: "D4", name: "交互效率", weight: "15%", color: "#10b981",
    criteria: "操作路径长度、反馈及时性、手势支持、常用功能可达性、学习成本" },
  { code: "D5", name: "一致性", weight: "10%", color: "#f59e0b",
    criteria: "视觉一致性、交互模式统一、术语规范、与平台规范对齐" },
  { code: "D6", name: "无障碍", weight: "10%", color: "#ec4899",
    criteria: "WCAG合规、色盲友好、大字模式、语音辅助兼容、操作容错" },
  { code: "D7", name: "美观度", weight: "10%", color: "#06b6d4",
    criteria: "视觉层次、留白节奏、色彩和谐、图标质量、整体精致感" },
  { code: "D8", name: "品牌感", weight: "5%", color: "#84cc16",
    criteria: "品牌识别度、设计语言一致、情感传达、差异化程度" },
];

/* ============================================================
   Rating Calculation Helper
   规则：>90分(9.0)为优秀(excellent)，>80分(8.0)为良好(good)，其他维持AI返回值
   ============================================================ */
function calculateRating(score: number, aiRating?: string): "excellent" | "good" | "average" | "poor" {
  // 基于分数的硬性规则优先
  if (score >= 9.0) return "excellent";
  if (score >= 8.0) return "good";
  // 80分以下维持AI原始判断或默认值
  return (aiRating === "excellent" || aiRating === "good" || aiRating === "average" || aiRating === "poor")
    ? aiRating
    : "average";
}

/* ============================================================
   Zhipu GLM Client (OpenAI compatible)
   ============================================================ */

function getGLMClient(): OpenAI {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey || apiKey === "your_zhipu_api_key_here") {
    throw new Error("ZHIPU_API_KEY not configured. Please set it in .env.local");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
    timeout: 180000, // 3分钟超时（大图片分析需要更长时间）
    maxRetries: 2,
  });
}

const VISION_MODEL = "glm-5v-turbo";

/* ============================================================
   System Prompts
   GLM-5V-Turbo supports larger max_tokens for vision requests
   ============================================================ */

const REVIEW_SYSTEM_PROMPT =
  "你是HMI/车载UX评审专家(15年经验)。遵循ISO15007、NHTSA视线偏移≤2秒、WCAG2.1 AA标准。" +
  "【8维度】D1驾驶安全性[20%]:视线偏移/操作步数/触控目标/驾驶干扰;D2视觉可读性[15%]:对比度/字体/色彩/眩光;D3信息架构[15%]:层级/分组/导航;D4交互效率[15%]:路径长度/反馈/手势;D5一致性[10%]:视觉/交互统一;D6无障碍[10%]:WCAG/色盲/容错;D7美观度[10%]:层次/节奏/和谐;D8品牌感[5%]。" +
  "【问题等级】致命Critical=安全违规/事故风险;严重Serious=影响体验安全;Warning=偏离最佳实践;Info=优化建议。" +
  "输出JSON:{overallScore:0-10,rating,summary,dimensions:[{code,score,reasoning}],issues:[{id,severity,dimension,description,suggestion}]}";

const COMPARE_SYSTEM_PROMPT =
  REVIEW_SYSTEM_PROMPT + " 对比模式:额外输出comparison{improved,regressed,netChange,keyChanges}和recommendation。";

/* ============================================================
   Retry utility with exponential backoff for rate limiting
   - 429: 指数退避，最长等30秒
   - 5xx: 标准重试
   - 其他错误: 直接抛出
   ============================================================ */

function isRateLimitError(error: any): boolean {
  // OpenAI SDK 格式
  if (error?.status === 429) return true;
  // 智谱API 返回格式（可能嵌套在 error.error 中）
  const msg = error?.message || "";
  const errBody = error?.error;
  if (typeof errBody === "object" && (errBody?.code === 429 || errBody?.status === 429)) return true;
  if (msg.includes("429") || msg.includes("速率限制") || msg.includes("rate") || msg.includes("频率")) return true;
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        // 429 用更长的退避：5s → 15s → 30s
        const delayMs = [5000, 15000, 30000][attempt] ?? 30000;
        console.warn(`[Retry] API 429 限流，${delayMs / 1000}s 后重试 (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      // 5xx 可重试一次
      if ((error?.status >= 500 && error?.status < 600) && attempt < 1) {
        console.warn(`[Retry] Server ${error.status}，3s后重试`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/* ============================================================
   Severity Normalization
   智谱AI可能返回中文或英文的severity值，统一映射为标准英文
   ============================================================ */

const SEVERITY_MAP: Record<string, "critical" | "serious" | "warning" | "info"> = {
  // English
  critical: "critical",
  serious: "serious",
  warning: "warning",
  info: "info",
  // Chinese
  致命: "critical",
  严重: "serious",
  警告: "warning",
  提示: "info",
  一般: "info",
  优化: "info",
  建议: "info",
};

function normalizeSeverity(raw: string): "critical" | "serious" | "warning" | "info" {
  const trimmed = String(raw).trim().toLowerCase();
  return SEVERITY_MAP[raw] || SEVERITY_MAP[trimmed] || "info";
}

/* ============================================================
   Core Functions
   ============================================================ */

/**
 * Convert base64 image to OpenAI-compatible content parts
 */
type ImageContentPart = {
  type: "image_url";
  image_url: { url: string };
};

/**
 * 压缩图片 base64 — 缩小尺寸 + 降低质量
 * 目标：将大图（>2MB）压缩到 ~500KB 以内
 */
async function compressImageBase64(
  dataUrl: string,
  maxWidth = 1920,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      // 等比缩放
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(dataUrl); return; }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(dataUrl);
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * 服务端版：估算并裁剪 base64 图片大小提示
 * 返回原始大小信息供日志记录
 */
function getImageInfo(data: string): { sizeBytes: number; sizeKB: number; mime: string } {
  const headerEnd = data.indexOf(",");
  if (headerEnd < 0) return { sizeBytes: 0, sizeKB: 0, mime: "unknown" };
  const header = data.slice(0, headerEnd);
  const body = data.slice(headerEnd + 1);
  const mimeMatch = header.match(/data:(.+?);base64/);
  return {
    sizeBytes: (body.length * 3) / 4,
    sizeKB: Math.round(((body.length * 3) / 4) / 1024),
    mime: mimeMatch?.[1] || "unknown",
  };
}

function prepareImageContents(images: { data: string; name: string; state: string }[]): ImageContentPart[] {
  return images.map((img, idx) => {
    const info = getImageInfo(img.data);
    if (info.sizeKB > 500) {
      console.warn(`[Image ${idx + 1}] ${img.name} 较大 (${info.sizeKB}KB)，建议前端压缩后上传`);
    }
    return {
      type: "image_url" as const,
      image_url: {
        url: img.data.startsWith('data:') ? img.data : `data:${img.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${img.data}`,
      },
    };
  });
}

/**
 * Build review prompt from request data
 */
function buildReviewPrompt(req: ReviewRequest): string {
  const modeDescriptions: Record<string, string> = {
    standard: "标准模式：均衡评估所有维度",
    safety: "安全优先模式：驾驶安全性(D1)权重提升50%，重点审查操作安全性、视线偏移时间、触控目标大小",
    visual: "视觉优先模式：视觉可读性(D2)和美观度(D7)权重提升，重点审查对比度、字体、色彩、视觉层次",
    interaction: "交互优先模式：交互效率(D4)和信息架构(D3)权重提升，重点审查操作路径、反馈机制、信息架构",
  };

  return `## 审查任务信息
- 任务名称：${req.taskName}
- 功能描述：${req.description || "未提供"}
- 关键目标：${req.goals.filter(g => g.trim()).join('；') || "未指定"}
- 所属系统：${req.systemType || "未指定"}
- 驾驶场景：${req.scene}
- 评估模式：${modeDescriptions[req.evalMode]}

## 上传的设计稿（共${req.images.length}张）
${req.images.map((img, i) => `- 图片${i + 1} [${img.state}]：${img.name}`).join('\n')}

## 请执行以下分析步骤：
1. 分析每张图片的界面状态和UI元素
2. 基于8个维度进行逐项评分（0-10分），给出具体reasoning
3. 列出所有发现的问题，按严重程度分类
4. 给出AS-IS问题描述 + TO-BE改进建议
5. 计算综合评分并总结`;
}

/**
 * Build compare prompt - 强制要求分离的v1Review/v2Review结构
 */
function buildComparePrompt(req: CompareRequest): string {
  return `## 对比审查任务信息
- 任务名称：${req.taskName}
- 功能描述：${req.description || "未提供"}
- 关键目标：${req.goals.filter(g => g.trim()).join('；') || "未指定"}
- 所属系统：${req.systemType || "未指定"}

## V1 版本设计稿（共${req.v1Images.length}张）
${req.v1Images.map((img, i) => `- V1_图片${i + 1} [${img.state}]`).join('\n')}

## V2 版本设计稿（共${req.v2Images.length}张）
${req.v2Images.map((img, i) => `- V2_图片${i + 1} [${img.state}]`).join('\n')}

## 请执行以下分析，必须严格按JSON格式输出：

### 要求：
1. 分别评估V1和V2版本的8维度得分(0-10)，每个维度给出具体分数
2. 为每个版本分别列出该版本特有的问题（V1的问题只属于V1，V2的问题只属于V2）
3. 对比两个版本找出改进和退化的维度
4. 给出最终推荐意见

### 输出JSON结构（严格遵守）：
{
  "v1Review": {
    "overallScore": 7.5,
    "rating": "good",
    "summary": "V1版本总结",
    "dimensions": [
      {"code":"D1","score":7.0,"reasoning":"..."},
      {"code":"D2","score":6.5,"reasoning":"..."},
      ...全部8个维度
    ],
    "issues": [
      {"id":"v1_1","severity":"serious","dimension":"驾驶安全性","category":"操作安全","description":"V1特有的AS-IS问题描述","suggestion":"TO-BE建议"},
      ...V1独有问题列表
    ]
  },
  "v2Review": {
    "overallScore": 8.0,
    "rating": "good",
    "summary": "V2版本总结",
    "dimensions": [...],
    "issues": [...]  // V2独有问题列表
  },
  "comparison": {
    "improvedDimensions":["视觉可读性","交互效率"],
    "regressedDimensions":["美观度"],
    "netScoreChange": 0.5,
    "keyChanges":["变化点1","变化点2"]
  },
  "recommendation": "推荐使用V2版本"
}

重要：v1Review和v2Review必须有各自独立的dimensions数组和issues数组，不能相同。`;
}

/**
 * Clean JSON response from potential markdown code blocks or surrounding text.
 * Handles various AI output formats robustly.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();

  // 1. Strip markdown code blocks (```json ... ``` or ``` ... ```)
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }

  // 2. If still not starting with { or [, try to extract JSON from surrounding text
  if (!cleaned.match(/^\s*[\{\[]/)) {
    // Find first { or [ and match to its closing bracket
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    let startIdx = -1;
    if (objStart >= 0 && arrStart >= 0) {
      startIdx = Math.min(objStart, arrStart);
    } else if (objStart >= 0 || arrStart >= 0) {
      startIdx = Math.max(objStart, arrStart);
    }
    if (startIdx >= 0) {
      // Find matching closing bracket by counting depth
      let depth = 0;
      let endIdx = startIdx;
      const openChar = cleaned[startIdx];
      const closeChar = openChar === '{' ? '}' : ']';
      for (let i = startIdx; i < cleaned.length; i++) {
        if (cleaned[i] === openChar) depth++;
        else if (cleaned[i] === closeChar) depth--;
        if (depth === 0) { endIdx = i; break; }
      }
      if (endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1).trim();
      }
    }
  }

  return cleaned;
}

/**
 * Attempt to fix common JSON issues produced by LLM outputs
 * - Trailing commas before } or ]
 * - Unquoted property names
 * - Single quotes instead of double quotes
 * - Comments (// or /*)
 */
function attemptFixMalformedJson(jsonStr: string): string {
  let fixed = jsonStr;

  // Remove single-line comments (// ...)
  fixed = fixed.replace(/\/\/[^\n]*/g, '');

  // Remove multi-line comments (/* ... */)
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

  // Replace single quotes with double quotes (simple heuristic - avoid inside strings)
  fixed = fixed.replace(/'/g, '"');

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  return fixed;
}

/**
 * Robust JSON parser that handles various LLM output formats
 */
function safeParseJson(text: string, fallbackLabel: string = "result"): any {
  // Strategy 1: Direct parse after cleaning
  const cleaned = cleanJsonResponse(text);
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Strategy 2: Fix common JSON issues and retry
  try {
    return JSON.parse(attemptFixMalformedJson(cleaned));
  } catch {}

  // Strategy 3: Log raw content for debugging and throw meaningful error
  console.error(`[${fallbackLabel}] Failed to parse JSON. Raw preview (first 300 chars):`, text.slice(0, 300));
  throw new Error(`Expected double-quoted property name in JSON at position 51`);
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Perform a full HMI Design Review using Zhipu GLM-5V-Turbo
 */
export async function performReview(req: ReviewRequest): Promise<ReviewResult> {
  const client = getGLMClient();

  const imageContents = prepareImageContents(req.images);
  const prompt = buildReviewPrompt(req);

  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${REVIEW_SYSTEM_PROMPT}\n\n${prompt}\n\n直接输出JSON，不要markdown。` },
              ...imageContents,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      })
    );

    const responseText = completion.choices[0]?.message?.content || "";
    const parsed = safeParseJson(responseText, "Review");

    // Enrich with dimension metadata and colors
    const enrichedDimensions: DimensionScore[] = DIMENSIONS.map(dim => {
      const found = parsed.dimensions?.find((d: any) => d.code === dim.code) || {};
      return {
        code: dim.code,
        name: dim.name,
        score: Math.max(0, Math.min(10, found.score ?? 7.0)),
        maxScore: 10,
        color: dim.color,
        reasoning: found.reasoning || "",
      };
    });

    const enrichedIssues: IssueItem[] = (parsed.issues || []).map((issue: any, idx: number) => ({
      id: issue.id || `issue_${idx + 1}`,
      severity: normalizeSeverity(issue.severity),
      category: issue.category || "未分类",
      dimension: issue.dimension || "其他",
      description: issue.description || "",
      suggestion: issue.suggestion || "",
      imageIndex: issue.imageIndex,
    }));

    return {
      overallScore: Math.max(0, Math.min(10, parsed.overallScore ?? 7.0)),
      rating: calculateRating(Math.max(0, Math.min(10, parsed.overallScore ?? 7.0)), parsed.rating),
      summary: parsed.summary || "AI分析完成",
      dimensions: enrichedDimensions,
      issues: enrichedIssues,
    };
  } catch (error: any) {
    console.error("Zhipu GLM review error:", {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      stack: error?.stack?.slice(0, 500),
      errorBody: error?.error ? JSON.stringify(error.error).slice(0, 500) : undefined,
    });
    throw new Error(`AI分析失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

/**
 * Perform a comparison review between two design versions
 */
export async function performComparison(req: CompareRequest): Promise<CompareResult> {
  const client = getGLMClient();

  const v1ImageContents = prepareImageContents(req.v1Images);
  const v2ImageContents = prepareImageContents(req.v2Images);
  const prompt = buildComparePrompt(req);

  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${COMPARE_SYSTEM_PROMPT}\n\n${prompt}\n\n直接输出JSON，不要markdown。` },
              ...v1ImageContents,
              { type: "text", text: "\n--- 以上V1 ---\n以下是V2:\n" },
              ...v2ImageContents,
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      })
    );

    const responseText = completion.choices[0]?.message?.content || "";
    console.log("[Compare] Raw response length:", responseText.length);

    let parsed: any;
    try {
      parsed = safeParseJson(responseText, "Compare");
    } catch (parseErr) {
      console.error("[Compare] JSON parse failed, raw preview:", responseText.slice(0, 500));
      throw new Error("AI返回数据格式异常，无法解析为JSON");
    }

    // 检查是否有分离的v1Review/v2Review
    const hasSeparatedReviews = parsed.v1Review && parsed.v2Review;
    if (!hasSeparatedReviews) {
      console.warn("[Compare] AI did NOT return separated v1Review/v2Review! Structure keys:", Object.keys(parsed).join(','));
    }

    // Enrich both version reviews
    const enrichReview = (review: any, fallbackLabel: string): ReviewResult => {
      // 如果没有独立的review数据，从顶层取并打标记区分
      const source = review && (review.dimensions?.length > 0 || review.overallScore != null)
        ? review
        : parsed; // fallback - 但这可能导致相同数据

      return {
        overallScore: Math.max(0, Math.min(10, source.overallScore ?? 7.0)),
        rating: calculateRating(Math.max(0, Math.min(10, source.overallScore ?? 7.0)), source.rating),
        summary: source.summary || `${fallbackLabel} AI分析完成`,
        dimensions: DIMENSIONS.map(dim => {
          const found = source.dimensions?.find((d: any) => d.code === dim.code) || {};
          return {
            code: dim.code,
            name: dim.name,
            score: Math.max(0, Math.min(10, found.score ?? 7.0)),
            maxScore: 10,
            color: dim.color,
            reasoning: found.reasoning || "",
          };
        }),
        issues: (source.issues || []).map((issue: any, idx: number) => ({
          id: issue.id || `${fallbackLabel}_${idx + 1}`,
          severity: normalizeSeverity(issue.severity),
          category: issue.category || "未分类",
          dimension: issue.dimension || "其他",
          description: issue.description || "",
          suggestion: issue.suggestion || "",
          imageIndex: issue.imageIndex,
        })),
      };
    };

    // 如果AI没有返回分离结构，尝试用issues的id前缀区分，或给不同默认分数
    if (!hasSeparatedReviews && parsed.dimensions) {
      console.warn("[Compare] Using flat structure for both versions — scores will be identical");
    }

    return {
      v1Review: enrichReview(parsed.v1Review, "V1"),
      v2Review: enrichReview(parsed.v2Review, "V2"),
      comparison: {
        improvedDimensions: parsed.comparison?.improvedDimensions || [],
        regressedDimensions: parsed.comparison?.regressedDimensions || [],
        netScoreChange: parsed.comparison?.netScoreChange ?? 0,
        keyChanges: parsed.comparison?.keyChanges || [],
      },
      recommendation: parsed.recommendation || "需要进一步分析",
    };
  } catch (error) {
    console.error("Zhipu GLM comparison error:", error);
    throw new Error(`AI对比失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

/**
 * Analyze uploaded images to auto-predict UI states and elements
 */
export async function analyzeImages(
  images: { data: string; name: string }[]
): Promise<ImageAnalysisResult[]> {
  const client = getGLMClient();

  const imageContents = prepareImageContents(images.map(i => ({ ...i, state: "" })));

  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              ...imageContents,
              {
                type: "text",
                text: `分析HMI截图，每张返回JSON: {state:"界面状态", detectedElements:["元素列表"], uiDescription:"描述"}。状态可选：默认展示/点击前/悬停态/按下态/点击后/选中态/加载中/成功态/错误态/空状态/编辑态/展开态。输出JSON数组，按图片顺序。`,
              },
            ],
          },
        ],
      temperature: 0.2,
      max_tokens: 2048,
    })
    );

    const responseText = completion.choices[0]?.message?.content || "";
    const parsed = safeParseJson(responseText, "AnalyzeImages");

    // Handle both array and object responses
    const items = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data || [parsed]);

    return items.map((item: any, idx: number) => ({
      index: idx,
      state: item.state || "默认展示",
      detectedElements: item.detectedElements || [],
      uiDescription: item.uiDescription || "",
    }));
  } catch (error) {
    console.error("Image analysis error:", error);
    return images.map((_, idx) => ({
      index: idx,
      state: "默认展示",
      detectedElements: [],
      uiDescription: "分析失败",
    }));
  }
}

/**
 * AI智能推断：根据上传的HMI截图，推断功能名称、关键目标和各图状态
 */
export async function inferFromImages(
  images: { data: string; name: string }[]
): Promise<InferenceResult> {
  const client = getGLMClient();

  const imageContents = prepareImageContents(images.map(i => ({ ...i, state: "" })));

  try {
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              ...imageContents,
              {
                type: "text",
                text: `你是一位资深车载HMI产品经理。请分析以上${images.length}张HMI设计截图，推断以下信息并严格按JSON格式输出：

1. **functionName**: 这是什么功能页面？用简洁中文描述（例如"中控主屏幕快捷操作面板"、"空调控制界面"、"导航地图主页"等），不超过20字
2. **goals**: 用户使用这个功能时最关键的2-3个目标（每条不超过30字，关注驾驶安全、操作效率、信息获取等）
3. **imageStates**: 每张图片对应的UI状态描述（与图片顺序一致，例如"默认首页状态"、"点击空调按钮后的展开弹窗"、"温度调节滑块交互态"等）

输出JSON（不要markdown）：
{"functionName":"...","goals":["...","..."],"imageStates":["...","..."]}`,
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      })
    );

    const responseText = completion.choices[0]?.message?.content || "";
    const parsed = safeParseJson(responseText, "Inference");

    return {
      functionName: parsed.functionName || "未命名功能",
      goals: Array.isArray(parsed.goals) && parsed.goals.length > 0
        ? parsed.goals.slice(0, 4)
        : ["提升操作效率", "降低驾驶干扰"],
      imageStates: Array.isArray(parsed.imageStates)
        ? parsed.imageStates.map((s: string, i: number) => s || `第${i + 1}张`)
        : images.map((_, i) => `第${i + 1}张`),
    };
  } catch (error) {
    console.error("Inference error:", error);
    return {
      functionName: "未命名审查任务",
      goals: ["请补充关键目标"],
      imageStates: images.map((_, i) => `第${i + 1}张`),
    };
  }
}

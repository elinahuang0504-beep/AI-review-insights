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
   ============================================================ */

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimited =
        error?.status === 429 ||
        (error?.message?.includes("400") && error?.message?.includes("参数"));
      if (attempt < maxRetries && isRateLimited) {
        const delayMs = Math.pow(2, attempt + 1) * 1000;
        console.warn(`API rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
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

function prepareImageContents(images: { data: string; name: string; state: string }[]): ImageContentPart[] {
  return images.map(img => ({
    type: "image_url" as const,
    image_url: {
      url: img.data.startsWith('data:') ? img.data : `data:${img.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${img.data}`,
    },
  }));
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
 * Build compare prompt
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

## 请执行以下分析：
1. 分别评估V1和V2版本的8维度得分
2. 对比两个版本，找出改进和退化的维度
3. 列出关键变化点
4. 给出最终推荐意见（推荐V1/V2/需进一步优化）`;
}

/**
 * Clean JSON response from potential markdown code blocks
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }
  return cleaned;
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
    const parsed = JSON.parse(cleanJsonResponse(responseText));

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
      severity: ["critical", "serious", "warning", "info"].includes(issue.severity)
        ? issue.severity : "info",
      category: issue.category || "未分类",
      dimension: issue.dimension || "其他",
      description: issue.description || "",
      suggestion: issue.suggestion || "",
      imageIndex: issue.imageIndex,
    }));

    return {
      overallScore: Math.max(0, Math.min(10, parsed.overallScore ?? 7.0)),
      rating: parsed.rating || "average",
      summary: parsed.summary || "AI分析完成",
      dimensions: enrichedDimensions,
      issues: enrichedIssues,
    };
  } catch (error) {
    console.error("Zhipu GLM review error:", error);
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
        max_tokens: 4096,
      })
    );

    const responseText = completion.choices[0]?.message?.content || "";
    const parsed = JSON.parse(cleanJsonResponse(responseText));

    // Enrich both version reviews
    const enrichReview = (review: any): ReviewResult => ({
      overallScore: Math.max(0, Math.min(10, review.overallScore ?? 7.0)),
      rating: review.rating || "average",
      summary: review.summary || "AI分析完成",
      dimensions: DIMENSIONS.map(dim => {
        const found = review.dimensions?.find((d: any) => d.code === dim.code) || {};
        return {
          code: dim.code,
          name: dim.name,
          score: Math.max(0, Math.min(10, found.score ?? 7.0)),
          maxScore: 10,
          color: dim.color,
          reasoning: found.reasoning || "",
        };
      }),
      issues: (review.issues || []).map((issue: any, idx: number) => ({
        id: issue.id || `issue_${idx + 1}`,
        severity: ["critical", "serious", "warning", "info"].includes(issue.severity)
          ? issue.severity : "info",
        category: issue.category || "未分类",
        dimension: issue.dimension || "其他",
        description: issue.description || "",
        suggestion: issue.suggestion || "",
        imageIndex: issue.imageIndex,
      })),
    });

    return {
      v1Review: enrichReview(parsed.v1Review || parsed),
      v2Review: enrichReview(parsed.v2Review || parsed),
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
    const parsed = JSON.parse(cleanJsonResponse(responseText));

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

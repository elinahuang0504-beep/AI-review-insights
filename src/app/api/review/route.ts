import { NextRequest, NextResponse } from "next/server";
import { performReview } from "@/lib/gemini";
import type { ReviewResult } from "@/lib/gemini";
import { buildUserEvalPrompt, parseUserEvalResponse, summarizeEvaluations } from "@/lib/user-evaluation";
import type { Persona } from "@/lib/persona";
import OpenAI from "openai";

// Vercel Hobby 实际限制60s，设置稍高以利用全部配额
export const maxDuration = 180;

function getGLMClient(): OpenAI {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey || apiKey === "your_zhipu_api_key_here") {
    throw new Error("ZHIPU_API_KEY not configured in .env.local");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
    timeout: 60000,
    maxRetries: 0,
  });
}

/**
 * 构造审查结果摘要文本，供用户评测AI参考
 * 包含：总分、各维度得分+理由、关键问题摘要
 */
function buildReviewContext(reviewResult: ReviewResult, goals: string[]): string {
  const dimLines = reviewResult.dimensions.map(d =>
    `- ${d.name}(${d.code}): ${d.score.toFixed(1)}/10 — ${d.reasoning || "无详细说明"}`
  ).join("\n");
  const topIssues = reviewResult.issues.slice(0, 5).map(i =>
    `[${i.severity}] ${i.dimension}: ${i.description?.slice(0, 80)}`
  ).join("\n");

  return `## 专家审查结果摘要
总分: ${reviewResult.overallScore.toFixed(1)}/10 (${reviewResult.rating})
总结: ${reviewResult.summary}

各维度评分:
${dimLines}

关键问题:
${topIssues || "无严重问题"}

待评测目标:
${goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`;
}

/**
 * 轻量级用户评测（无图片，使用审查结果文本作上下文）
 * 耗时 ~5-15s/人，远低于视觉模型版本
 */
async function runUserEvalFast(
  reviewContext: string,
  personas: Persona[],
  taskDesc: string,
  goals: string[],
  sampleSize: number,
) {
  const selected = personas.slice(0, Math.min(sampleSize, personas.length));
  if (selected.length === 0) return null;

  const client = getGLMClient();
  const results: ReturnType<typeof parseUserEvalResponse>[] = [];
  // 使用快速文本模型，不依赖视觉能力
  const MODEL_FALLBACKS = ["glm-4-flash", "glm-4-plus"];

  for (const persona of selected) {
    let evalSuccess = false;
    for (const model of MODEL_FALLBACKS) {
      try {
        const prompt = buildUserEvalPrompt(persona, taskDesc, goals, 0);
        const fullPrompt = `${reviewContext}\n\n---\n\n${prompt}`;
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.4,
          max_tokens: 1024,
        });
        const rawText = completion.choices[0]?.message?.content || "";
        const parsed = parseUserEvalResponse(rawText, persona);
        if (parsed) {
          results.push(parsed);
          evalSuccess = true;
          break;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("model_not_found") || errMsg.includes("invalid_model") || errMsg.includes("403") || errMsg.includes("401")) {
          continue;
        }
        break;
      }
    }
  }

  if (results.length === 0) return null;
  return summarizeEvaluations(results.filter((r): r is NonNullable<typeof r> => r !== null), selected.length);
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length") || "unknown";
    console.log(`[Review API] Request received, size: ${contentLength} bytes`);

    const body = await req.json();

    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json({ error: "请上传至少1张设计稿图片" }, { status: 400 });
    }
    if (body.images.length > 9) {
      return NextResponse.json({ error: "最多支持上传9张图片" }, { status: 400 });
    }
    if (!body.taskName || !body.taskName.trim()) {
      return NextResponse.json({ error: "请填写任务名称" }, { status: 400 });
    }

    const reviewRequest = {
      images: body.images.map((img: any) => ({
        data: img.data,
        name: img.name,
        state: img.state || "默认展示",
      })),
      taskName: body.taskName.trim(),
      description: body.description || "",
      goals: body.goals || [],
      systemType: body.systemType || "",
      scene: body.scene || "行驶中+静止通用",
      evalMode: body.evalMode || "standard",
    };

    const goals = body.goals || [];
    const ue = body.userEval;
    const shouldRunUserEval = ue?.enabled && Array.isArray(ue.personas) && ue.personas.length > 0;

    // 1. 审查（视觉模型，30-50s）
    const reviewResult = await performReview(reviewRequest);

    // 2. 用户评测（文本模型，5-15s，不传图，用审查结果作上下文）
    let userEvalSummary = null;
    if (shouldRunUserEval && reviewResult) {
      try {
        const reviewContext = buildReviewContext(reviewResult, goals);
        userEvalSummary = await runUserEvalFast(
          reviewContext,
          ue.personas,
          body.taskName,
          goals,
          ue.sampleSize || ue.personas.length,
        );
      } catch (evalErr) {
        console.error("[Review/user-eval] 评测异常:", evalErr);
      }
    }

    return NextResponse.json({ success: true, data: { review: reviewResult, userEvalSummary } });
  } catch (error) {
    console.error("Review API Error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

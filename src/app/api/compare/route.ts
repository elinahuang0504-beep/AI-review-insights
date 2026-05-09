import { NextRequest, NextResponse } from "next/server";
import { performComparison } from "@/lib/gemini";
import type { ReviewResult } from "@/lib/gemini";
import { buildUserEvalPrompt, parseUserEvalResponse, summarizeEvaluations } from "@/lib/user-evaluation";
import type { Persona } from "@/lib/persona";
import OpenAI from "openai";

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

/** 用审查结果构建评测上下文 */
function buildReviewContext(reviewResult: ReviewResult, goals: string[], label?: string): string {
  const prefix = label ? `[${label}版本] ` : "";
  const dimLines = reviewResult.dimensions.map(d =>
    `- ${d.name}(${d.code}): ${d.score.toFixed(1)}/10 — ${d.reasoning || "无详细说明"}`
  ).join("\n");
  const topIssues = reviewResult.issues.slice(0, 3).map(i =>
    `[${i.severity}] ${i.dimension}: ${i.description?.slice(0, 80)}`
  ).join("\n");

  return `${prefix}专家审查结果摘要
总分: ${reviewResult.overallScore.toFixed(1)}/10 (${reviewResult.rating})
总结: ${reviewResult.summary}

各维度评分:
${dimLines}

关键问题:
${topIssues || "无严重问题"}

待评测目标:
${goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`;
}

/** 轻量级用户评测（无图片，文本模型 ~5-15s/人） */
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
    console.log(`[Compare API] Request received, size: ${contentLength} bytes`);

    const body = await req.json();

    if (!body.v1Images?.length || !body.v2Images?.length) {
      return NextResponse.json({ error: "请为V1和V2版本各上传至少1张设计稿图片" }, { status: 400 });
    }
    if (body.v1Images.length > 9 || body.v2Images.length > 9) {
      return NextResponse.json({ error: "每个版本最多支持9张图片" }, { status: 400 });
    }
    if (!body.taskName || !body.taskName.trim()) {
      return NextResponse.json({ error: "请填写任务名称" }, { status: 400 });
    }

    const compareRequest = {
      v1Images: body.v1Images.map((img: any) => ({
        data: img.data,
        name: img.name,
        state: img.state || "默认展示",
      })),
      v2Images: body.v2Images.map((img: any) => ({
        data: img.data,
        name: img.name,
        state: img.state || "默认展示",
      })),
      taskName: body.taskName.trim(),
      description: body.description || "",
      goals: body.goals || [],
      systemType: body.systemType || "",
      scene: body.scene || "行驶中+静止通用",
    };

    const goals = body.goals || [];
    const ue = body.userEval;
    const shouldRunUserEval = ue?.enabled && Array.isArray(ue.personas) && ue.personas.length > 0;

    // 1. 对比审查（视觉模型，30-50s）
    const result = await performComparison(compareRequest);

    // 2. 轻量用户评测（文本模型，5-15s，基于审查结果上下文，不传图）
    let userEvalSummary = null;
    if (shouldRunUserEval && result) {
      try {
        // 用两个版本中更好的那个做评测上下文
        const betterReview = result.v2Review.overallScore >= result.v1Review.overallScore
          ? result.v2Review : result.v1Review;
        const betterLabel = result.v2Review.overallScore >= result.v1Review.overallScore
          ? "V2" : "V1";
        const reviewContext = buildReviewContext(betterReview, goals, betterLabel);
        userEvalSummary = await runUserEvalFast(
          reviewContext,
          ue.personas,
          body.taskName,
          goals,
          ue.sampleSize || ue.personas.length,
        );
      } catch (evalErr) {
        console.error("[Compare/user-eval] 评测异常:", evalErr);
      }
    }

    return NextResponse.json({ success: true, data: { compare: result, userEvalSummary } });
  } catch (error) {
    console.error("Compare API Error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

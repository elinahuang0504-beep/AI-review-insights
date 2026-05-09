import { NextRequest, NextResponse } from "next/server";
import { performReview } from "@/lib/gemini";
import { buildUserEvalPrompt, parseUserEvalResponse, summarizeEvaluations } from "@/lib/user-evaluation";
import type { Persona } from "@/lib/persona";
import OpenAI from "openai";

// Vercel: 增加Serverless Function最大执行时间到180秒
export const maxDuration = 180;

function getGLMClient(): OpenAI {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey || apiKey === "your_zhipu_api_key_here") {
    throw new Error("ZHIPU_API_KEY not configured in .env.local");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
    timeout: 180000,
    maxRetries: 1,
  });
}

/** 内部执行用户评测（与审查共享同一份图片数据） */
async function runUserEvalInternally(
  images: { data: string; name: string; state: string }[],
  personas: Persona[],
  taskInfo: { taskName: string; description: string; goals: string[] },
  goals: string[],
  sampleSize: number,
) {
  const selected = personas.slice(0, Math.min(sampleSize, personas.length));
  if (selected.length === 0) return null;

  const client = getGLMClient();
  const results: ReturnType<typeof parseUserEvalResponse>[] = [];
  const MODEL_FALLBACKS = ["glm-5v-turbo", "glm-4v", "glm-4-flash"];

  for (const persona of selected) {
    let evalSuccess = false;
    for (const model of MODEL_FALLBACKS) {
      try {
        const prompt = buildUserEvalPrompt(persona, taskInfo.description || taskInfo.taskName, goals || [], images.length);
        const content: any[] = [{ type: "text", text: prompt }];
        for (const img of images) {
          content.push({ type: "image_url", image_url: { url: img.data } });
        }
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content }],
          temperature: 0.4,
          max_tokens: 4096,
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
        if (errMsg.includes("model_not_found") || errMsg.includes("invalid_model") || errMsg.includes("403") || errMsg.includes("401") || errMsg.includes("not available")) {
          continue;
        }
        break;
      }
    }
    if (!evalSuccess) {
      console.warn(`[Review/user-eval] 车主 ${persona.name} 所有模型均失败`);
    }
  }

  if (results.length === 0) return null;
  return summarizeEvaluations(results, selected.length);
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

    // 1. 执行专家审查
    const reviewResult = await performReview(reviewRequest);

    // 2. 执行用户评测（使用同一份图片，不额外传输）
    let userEvalSummary = null;
    const ue = body.userEval;
    if (ue?.enabled && Array.isArray(ue.personas) && ue.personas.length > 0) {
      try {
        userEvalSummary = await runUserEvalInternally(
          reviewRequest.images,
          ue.personas,
          { taskName: body.taskName, description: body.description || "", goals: body.goals || [] },
          body.goals || [],
          ue.sampleSize || ue.personas.length,
        );
      } catch (evalErr) {
        console.error("[Review/user-eval] 内部评测异常:", evalErr);
      }
    }

    return NextResponse.json({ success: true, data: { review: reviewResult, userEvalSummary } });
  } catch (error) {
    console.error("Review API Error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

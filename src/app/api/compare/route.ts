import { NextRequest, NextResponse } from "next/server";
import { performComparison } from "@/lib/gemini";
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

/** 内部执行用户评测（共享同一份图片数据） */
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
  }

  if (results.length === 0) return null;
  return summarizeEvaluations(results, selected.length);
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length") || "unknown";
    console.log(`[Compare API] Request received, size: ${contentLength} bytes`);

    const body = await req.json();

    if (!body.v1Images?.length || !body.v2Images?.length) {
      return NextResponse.json(
        { error: "请为V1和V2版本各上传至少1张设计稿图片" },
        { status: 400 }
      );
    }

    if (body.v1Images.length > 9 || body.v2Images.length > 9) {
      return NextResponse.json(
        { error: "每个版本最多支持9张图片" },
        { status: 400 }
      );
    }

    if (!body.taskName || !body.taskName.trim()) {
      return NextResponse.json(
        { error: "请填写任务名称" },
        { status: 400 }
      );
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

    // 1. 执行对比评审
    const result = await performComparison(compareRequest);

    // 2. 执行用户评测（合并V1+V2图片）
    let userEvalSummary = null;
    const ue = body.userEval;
    if (ue?.enabled && Array.isArray(ue.personas) && ue.personas.length > 0) {
      try {
        const allImages = [...compareRequest.v1Images, ...compareRequest.v2Images];
        userEvalSummary = await runUserEvalInternally(
          allImages,
          ue.personas,
          { taskName: body.taskName, description: body.description || "", goals: body.goals || [] },
          body.goals || [],
          ue.sampleSize || ue.personas.length,
        );
      } catch (evalErr) {
        console.error("[Compare/user-eval] 内部评测异常:", evalErr);
      }
    }

    return NextResponse.json({ success: true, data: { compare: result, userEvalSummary } });
  } catch (error) {
    console.error("Compare API Error:", error);
    
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

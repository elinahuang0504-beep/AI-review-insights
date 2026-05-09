import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Persona } from "@/lib/persona";
import {
  buildUserEvalPrompt,
  parseUserEvalResponse,
  summarizeEvaluations,
} from "@/lib/user-evaluation";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personas, taskInfo, goals, sampleSize, images } = body as {
      personas: Persona[];
      taskInfo: { taskName: string; description: string; goals: string[] };
      goals: string[];
      sampleSize: number;
      images?: { data: string; name: string }[];
    };

    if (!Array.isArray(personas) || personas.length === 0) {
      return NextResponse.json({ success: false, error: "没有可用的虚拟车主数据" }, { status: 400 });
    }

    if (!sampleSize || sampleSize < 1) {
      return NextResponse.json({ success: false, error: "样本量必须大于0" }, { status: 400 });
    }

    // 采样
    const selected = personas.slice(0, Math.min(sampleSize, personas.length)) as Persona[];

    const client = getGLMClient();
    const results: ReturnType<typeof parseUserEvalResponse>[] = [];
    // 使用视觉模型进行评测（需要识别设计稿截图）
    const MODEL_FALLBACKS = ["glm-5v-turbo", "glm-4v", "glm-4-flash"];

    for (const persona of selected) {
      let evalSuccess = false;

      for (const model of MODEL_FALLBACKS) {
        try {
          const prompt = buildUserEvalPrompt(
            persona,
            taskInfo.description || taskInfo.taskName,
            goals || [],
            images?.length || 0,
          );

          // 构造多模态内容：文字 + 图片
          const content: any[] = [{ type: "text", text: prompt }];
          if (images && images.length > 0) {
            for (const img of images) {
              content.push({
                type: "image_url",
                image_url: { url: img.data },
              });
            }
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
            console.log(`[API/user-eval] 车主 ${persona.name} 评测完成（模型: ${model}），得分: ${parsed.overallScore}`);
            evalSuccess = true;
            break; // 成功则跳出模型循环
          } else {
            console.warn(`[API/user-eval] 车主 ${persona.name} 返回内容解析失败（模型: ${model}），原始内容长度: ${rawText.length}`);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[API/user-eval] 车主 ${persona.name} 使用模型 ${model} 失败: ${errMsg}`);
          // 如果是模型不存在/无权限的错误，尝试下一个模型
          if (
            errMsg.includes("model_not_found") ||
            errMsg.includes("invalid_model") ||
            errMsg.includes("403") ||
            errMsg.includes("401") ||
            errMsg.includes("not available")
          ) {
            console.log(`[API/user-eval] 切换到备用模型...`);
            continue;
          }
          // 其他错误（超时、网络等）直接跳过该用户
          break;
        }
      }

      if (!evalSuccess) {
        console.warn(`[API/user-eval] 车主 ${persona.name} 所有模型均失败，跳过`);
      }
    }

    // 即使部分成功也返回结果（部分结果 > 无结果）
    if (results.length === 0) {
      console.error(`[API/user-eval] 全部 ${selected.length} 位车主评测均失败`);
      return NextResponse.json({
        success: false,
        error: `所有车主的评测均失败（共尝试 ${selected.length} 人）`,
      }, { status: 500 });
    }

    const summary = summarizeEvaluations(
      results.filter((r): r is NonNullable<typeof r> => r !== null),
      selected.length,
    );

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("[API/user-eval] Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "用户评测服务异常" },
      { status: 500 },
    );
  }
}

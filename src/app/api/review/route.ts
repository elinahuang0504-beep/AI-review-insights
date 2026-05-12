import { NextRequest, NextResponse } from "next/server";
import { performReview } from "@/lib/gemini";

// Vercel Hobby 实际限制60s，设置稍高以利用全部配额
export const maxDuration = 180;

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

    // 仅执行审查（视觉模型），不再包含用户评测
    const reviewResult = await performReview(reviewRequest);

    return NextResponse.json({ success: true, data: { review: reviewResult } });
  } catch (error) {
    console.error("Review API Error:", error);
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

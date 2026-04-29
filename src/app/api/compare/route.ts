import { NextRequest, NextResponse } from "next/server";
import { performComparison } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
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

    const result = await performComparison(compareRequest);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Compare API Error:", error);
    
    const message = error instanceof Error ? error.message : "服务器内部错误";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { analyzeImages, inferFromImages } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length") || "unknown";
    console.log(`[Analyze API] Request received, size: ${contentLength} bytes`);

    const body = await req.json();

    if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
      return NextResponse.json(
        { error: "请上传至少1张图片" },
        { status: 400 }
      );
    }

    // Smart inference mode - AI infers function name, goals, and image states
    if (body.action === "infer") {
      const result = await inferFromImages(body.images);
      return NextResponse.json({ success: true, data: result });
    }

    // Default: basic image analysis
    const result = await analyzeImages(body.images);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Analyze API Error:", error);
    
    const message = error instanceof Error ? error.message : "分析失败";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

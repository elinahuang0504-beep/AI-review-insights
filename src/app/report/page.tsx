"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileDown, Download, Home } from "lucide-react";

/* ============================================================
   Types
   ============================================================ */
interface DimensionScore {
  code: string;
  name: string;
  score: number;
  maxScore: number;
  color: string;
}

interface IssueItem {
  id: string;
  severity: "critical" | "serious" | "warning" | "info";
  category: string;
  dimension: string;
  description: string;
  suggestion: string;
}

interface ReviewResult {
  overallScore: number;
  rating: string;
  summary: string;
  dimensions: DimensionScore[];
  issues: IssueItem[];
}

interface UploadedImagePreview {
  url: string;
  stateDesc: string;
}

/* ============================================================
   Radar Chart SVG
   ============================================================ */
function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const size = 320;
  const center = size / 2;
  const radius = size * 0.36;
  const angleStep = (Math.PI * 2) / dimensions.length;

  const points = dimensions.map((dim, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (dim.score / dim.maxScore) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  });

  const pathData =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
    "Z";
  const labelPoints = dimensions.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: center + (radius + 38) * Math.cos(angle),
      y: center + (radius + 38) * Math.sin(angle),
    };
  });

  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from(
            { length: dimensions.length },
            (_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const rr = radius * r;
              return `${center + rr * Math.cos(angle)},${center + rr * Math.sin(angle)}`;
            }
          ).join(" ")}
          fill="none"
          stroke="rgba(148,163,184,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Axes */}
      {dimensions.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(angle)}
            y2={center + radius * Math.sin(angle)}
            stroke="rgba(148,163,184,0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data Area */}
      <path
        d={pathData}
        fill="rgba(99,102,241,0.15)"
        stroke="#6366f1"
        strokeWidth="2"
      />

      {/* Data Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={dimensions[i].color}
          stroke="#0a0f18"
          strokeWidth="2"
        />
      ))}

      {/* Labels - using foreignObject for text wrapping */}
      {dimensions.map((dim, i) => {
        const lp = labelPoints[i];
        return (
          <foreignObject
            key={i}
            x={lp.x - 50}
            y={lp.y - 10}
            width="100"
            height="20"
          >
            <div
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: "9.5px",
                fontWeight: 500,
                color: "#94a3b8",
                lineHeight: 1.3,
              }}
            >
              {dim.name}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}

/* ============================================================
   Severity helpers
   ============================================================ */
function getSeverityConfig(severity: string) {
  switch (severity) {
    case "critical":
      return {
        label: "致命",
        bg: "bg-red-500/10 border-red-500/20 text-red-400",
        dot: "bg-red-500",
      };
    case "serious":
      return {
        label: "严重",
        bg: "bg-orange-500/10 border-orange-500/20 text-orange-400",
        dot: "bg-orange-500",
      };
    case "warning":
      return {
        label: "警告",
        bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
        dot: "bg-yellow-500",
      };
    default:
      return {
        label: "提示",
        bg: "bg-slate-500/10 border-slate-500/20 text-slate-400",
        dot: "bg-slate-500",
      };
  }
}

function getRatingConfig(rating: string) {
  switch (rating) {
    case "excellent":
      return { label: "优秀", color: "text-emerald-400", ring: "#34d399", bg: "bg-emerald-500/10" };
    case "good":
      return { label: "良好", color: "text-blue-400", ring: "#60a5fa", bg: "bg-blue-500/10" };
    case "average":
      return { label: "一般", color: "text-amber-400", ring: "#fbbf24", bg: "bg-amber-500/10" };
    default:
      return { label: "需改进", color: "text-red-400", ring: "#f87171", bg: "bg-red-500/10" };
  }
}

/* ============================================================
   Score Ring Component
   ============================================================ */
function ScoreRing({ score, rating }: { score: number; rating: string }) {
  const cfg = getRatingConfig(rating);
  const percent = score * 10; // 7.6 -> 76
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-[130px] h-[130px]">
      <svg width="130" height="130" className="-rotate-90">
        <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="65" cy="65" r="54" fill="none"
          stroke={cfg.ring} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-extrabold ${cfg.color}`}>
          {(score * 10).toFixed(0)}
        </span>
        <span className={`text-[11px] font-medium ${cfg.color}/70`}>{cfg.label}</span>
      </div>
    </div>
  );
}

/* ============================================================
   Report Page Component
   ============================================================ */
export default function ReportPage() {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [images, setImages] = useState<UploadedImagePreview[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedResult = sessionStorage.getItem("reviewResult");
      if (storedResult) setResult(JSON.parse(storedResult));

      const storedImages = sessionStorage.getItem("reviewImages");
      if (storedImages) setImages(JSON.parse(storedImages));
    } catch {}
    setLoaded(true); // Mark as loaded regardless of data presence
  }, []);

  /* Loading State - only show spinner before useEffect runs */
  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f18]">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-5" />
        <p className="text-slate-400">正在加载报告...</p>
        <Link href="/" className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
          返回首页
        </Link>
      </div>
    );
  }

  /* No Data State - loaded but no review result */
  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f18]">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-800/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        </div>
        <p className="text-slate-300 font-medium text-lg mb-2">未找到审查数据</p>
        <p className="text-sm text-slate-500 mb-6 max-w-md text-center">请从首页开始一次新的审查，或从历史记录中选择一条记录查看。</p>
        <div className="flex items-center gap-3">
          <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            开始新审查
          </Link>
          <Link href="/history" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] transition-colors">
            查看历史记录
          </Link>
        </div>
      </div>
    );
  }

  const severityStyles: Record<string, string> = {
    critical:
      "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase shrink-0 border",
    serious:
      "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase shrink-0 border",
    warning:
      "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase shrink-0 border",
    info: "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase shrink-0 border",
  };

  return (
    <div className="min-h-screen bg-[#0a0f18]">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] -left-[10%] w-[50%] h-[70%] rounded-full bg-indigo-600/6 blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[10%] w-[50%] h-[60%] rounded-full bg-purple-600/6 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-[#0a0f18]/85 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/history" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <span className="text-slate-700">|</span>
          <span className="text-sm font-medium text-white">审查报告</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors">
            <FileDown className="w-3.5 h-3.5" />
            导出 PDF
          </button>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
            <Home className="w-3.5 h-3.5" />
            首页
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-16 space-y-8">

        {/* ===== TOP SECTION: Left Images | Right Score & Analysis ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* LEFT: Uploaded Images */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-white">上传的设计稿</h3>
              <span className="text-xs text-slate-500">{images.length} 张</span>
            </div>

            {/* Main Image Display */}
            <div className="aspect-[4/3] rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden relative group">
              {images.length > 0 ? (
                <img
                  src={images[selectedImageIndex]?.url}
                  alt={`设计稿 ${selectedImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-sm text-slate-600">无预览图</p>
                </div>
              )}
              
              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80"
                  >&#8249;</button>
                  <button
                    onClick={() => setSelectedImageIndex((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80"
                  >&#8250;</button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === idx
                        ? "border-indigo-500 shadow-lg shadow-indigo-500/20"
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-white/20"
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Image State Label */}
            {images[selectedImageIndex]?.stateDesc && (
              <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-slate-400">
                  状态：<span className="text-slate-200">{images[selectedImageIndex].stateDesc}</span>
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: Score + Summary + Radar + Dimensions */}
          <div className="lg:col-span-3 space-y-5">
            
            {/* Score Row */}
            <div className="flex items-start gap-6 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <ScoreRing score={result.overallScore} rating={result.rating} />
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white mb-1.5">HMI 设计审查报告</h2>
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                  {result.summary}
                </p>
              </div>
            </div>

            {/* Radar Chart + Dimensions Side by Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Radar */}
              <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white mb-4">维度评分雷达图</h3>
                <div className="flex justify-center">
                  <RadarChart dimensions={result.dimensions} />
                </div>
              </div>

              {/* Dimension Bars - Unified Color, Red for < 6 */}
              <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white mb-4">维度详情评分</h3>
                <div className="space-y-3">
                  {result.dimensions.map((dim) => {
                    const isLow = dim.score < 6;
                    const unifiedColor = "#818cf8"; // indigo-400
                    return (
                      <div key={dim.code}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: unifiedColor }} />
                            <span className="text-xs font-medium text-slate-300">{dim.name}</span>
                          </div>
                          <span
                            className="text-xs font-bold"
                            style={{ color: isLow ? "#f87171" : unifiedColor }}
                          >
                            {dim.score.toFixed(1)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: `${(dim.score / dim.maxScore) * 100}%`,
                              backgroundColor: isLow ? "#f87171" : unifiedColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "总评", value: result.overallScore.toFixed(1), color: getRatingConfig(result.rating).color },
                { label: "维度数", value: String(result.dimensions.length), color: "text-indigo-400" },
                { label: "问题数", value: String(result.issues.length), color: "text-amber-400" },
                {
                  label: "最高分维度",
                  value: result.dimensions.reduce((a, b) =>
                    a.score > b.score ? a : b
                  ).name,
                  color: "text-emerald-400",
                },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-sm font-bold truncate ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== BOTTOM SECTION: Issues Detail List ===== */}
        <div className="space-y-5">
          {/* Section Header */}
          <div className="flex items-center gap-3">
            <ChevronRight className="w-4 h-4 text-indigo-400 rotate-90" />
            <h2 className="text-base font-bold text-white">问题细节列表</h2>
            <div className="flex gap-2 ml-auto">
              {["critical", "serious", "warning", "info"].map((sev) => {
                const count = result.issues.filter((i) => i.severity === sev).length;
                if (count === 0) return null;
                const cfg = getSeverityConfig(sev);
                return (
                  <span key={sev} className={`${severityStyles[sev]} ${cfg.bg}`}>
                    {cfg.label} {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Issues Responsive Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {result.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all overflow-hidden"
                >
                  <div className="p-4">
                    {/* Header row - dimension as title */}
                    <h4 className="text-sm font-semibold text-indigo-300 mb-2.5">{issue.dimension}</h4>

                    {/* AS-IS / TO-BE cards */}
                    <div className="rounded-lg overflow-hidden border border-white/[0.04]">
                      <div className="p-2.5 bg-red-500/[0.03] border-b border-white/[0.04]">
                        <p className="text-[11px] font-medium text-red-400/80 mb-0.5">AS-IS</p>
                        <p className="text-[13px] text-slate-300 leading-snug">{issue.description}</p>
                      </div>
                      <div className="p-2.5 bg-emerald-500/[0.03]">
                        <p className="text-[11px] font-medium text-emerald-400/80 mb-0.5">TO-BE</p>
                        <p className="text-[13px] text-slate-300 leading-snug">{issue.suggestion}</p>
                      </div>
                    </div>
                  </div>
                </div>
            ))}

            {result.issues.length === 0 && (
              <div className="col-span-full py-16 text-center rounded-xl border border-dashed border-white/[0.08]">
                <p className="text-sm text-slate-500">未发现明显问题，设计方案表现优秀！</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
          <button className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
            <Download className="w-4 h-4" />
            导出 PDF 报告
          </button>
          <button className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] transition-colors">
            <FileDown className="w-4 h-4" />
            导出 Word
          </button>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <Home className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

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

interface CompareResultData {
  v1Review: ReviewResult;
  v2Review: ReviewResult;
  comparison: {
    improvedDimensions: string[];
    regressedDimensions: string[];
    netScoreChange: number;
    keyChanges: string[];
  };
  recommendation: string;
}

interface CompareImagePreview {
  url: string;
  stateDesc: string;
}

/* ============================================================
   Dual Radar Chart SVG — 双方案雷达图叠加显示
   ============================================================ */
function DualRadarChart({ v1Dims, v2Dims }: { v1Dims: DimensionScore[]; v2Dims: DimensionScore[] }) {
  const size = 360;
  const center = size / 2;
  const radius = size * 0.35;
  const angleStep = (Math.PI * 2) / v1Dims.length;

  const calcPoints = (dims: DimensionScore[]) => dims.map((dim, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (dim.score / dim.maxScore) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  });

  const v1Points = calcPoints(v1Dims);
  const v2Points = calcPoints(v2Dims);

  const toPath = (pts: typeof v1Points) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  const labelPoints = v1Dims.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return { x: center + (radius + 36) * Math.cos(angle), y: center + (radius + 36) * Math.sin(angle) };
  });

  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: v1Dims.length }, (_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const rr = radius * r;
            return `${center + rr * Math.cos(angle)},${center + rr * Math.sin(angle)}`;
          }).join(" ")}
          fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1"
        />
      ))}

      {/* Axes */}
      {v1Dims.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="rgba(148,163,184,0.08)" strokeWidth="1" />;
      })}

      {/* V2 area (behind) — blue */}
      <path d={toPath(v2Points)} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth="1.8" strokeDasharray="4 3" />

      {/* V1 area (front) — indigo */}
      <path d={toPath(v1Points)} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="2" />

      {/* V1 data points */}
      {v1Points.map((p, i) => (
        <circle key={`v1-${i}`} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="#0a0f18" strokeWidth="1.5" />
      ))}
      {/* V2 data points */}
      {v2Points.map((p, i) => (
        <circle key={`v2-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#3b82f6" stroke="#0a0f18" strokeWidth="1.5" />
      ))}

      {/* Labels */}
      {v1Dims.map((dim, i) => {
        const lp = labelPoints[i];
        return (
          <foreignObject key={i} x={lp.x - 48} y={lp.y - 10} width="96" height="20">
            <div style={{ width: "100%", textAlign: "center", fontSize: "9px", fontWeight: 500, color: "#94a3b8", lineHeight: 1.3 }}>
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
    case "critical": case "致命":
      return { label: "致命", bg: "bg-red-500/10 border-red-500/20 text-red-400", dot: "bg-red-500" };
    case "serious": case "严重":
      return { label: "严重", bg: "bg-orange-500/10 border-orange-500/20 text-orange-400", dot: "bg-orange-500" };
    case "warning": case "警告":
      return { label: "警告", bg: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400", dot: "bg-yellow-500" };
    default:
      return { label: "提示", bg: "bg-slate-500/10 border-slate-500/20 text-slate-400", dot: "bg-slate-500" };
  }
}

function getRatingConfig(rating: string) {
  switch (rating) {
    case "excellent": return { label: "优秀", color: "text-emerald-400", ring: "#34d399", bg: "bg-emerald-500/10" };
    case "good": return { label: "良好", color: "text-blue-400", ring: "#60a5fa", bg: "bg-blue-500/10" };
    case "average": return { label: "一般", color: "text-amber-400", ring: "#fbbf24", bg: "bg-amber-500/10" };
    default: return { label: "需改进", color: "text-red-400", ring: "#f87171", bg: "bg-red-500/10" };
  }
}

/* ============================================================
   Export Helpers
   ============================================================ */
function handleExportPDF() {
  try { window.print(); } catch (err) { console.error("PDF export failed:", err); alert("导出失败，请尝试使用「导出 Word」功能"); }
}

function handleExportWord(data: CompareResultData | null) {
  if (!data) { alert("没有可导出的数据"); return; }
  const ratingMap: Record<string, string> = { excellent: "优秀", good: "良好", average: "一般", poor: "需改进" };

  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Smart Review - HMI设计对比报告</title>
    <style>body{font-family:微软雅黑,sans-serif;font-size:14px;color:#333;line-height:1.8;}
    h1{font-size:22px;color:#1a1a2e;border-bottom:3px solid #4f46e5;padding-bottom:10px;}
    h2{font-size:16px;color:#4f46e5;margin-top:24px;border-left:4px solid #4f46e5;padding-left:10px;}
    table{width:100%;border-collapse:collapse;margin:12px 0;} th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px;} th{background:#f0f0f5;font-weight:600;}
    .score-box{display:inline-block;background:#4f46e5;color:#fff;padding:6px 16px;border-radius:20px;font-size:24px;font-weight:bold;margin:16px 0;}
    .improved{color:#16a34a;font-weight:600;} .regressed{color:#dc2626;font-weight:600;}
    </style></head><body>
    <h1>Smart Review - HMI设计对比报告</h1>
    <p><strong>推荐：</strong>${data.recommendation}</p>

    <h2>综合评分</h2><table><tr><th>版本</th><th>评分</th><th>评级</th></tr>
    <tr><td>V1</td><td>${(data.v1Review.overallScore * 10).toFixed(0)}</td><td>${ratingMap[data.v1Review.rating]}</td></tr>
    <tr><td>V2</td><td>${(data.v2Review.overallScore * 10).toFixed(0)}</td><td>${ratingMap[data.v2Review.rating]}</td></tr>
    </table>
    <p>分差：${data.comparison.netScoreChange > 0 ? "+" : ""}${data.comparison.netScoreChange.toFixed(1)}</p>

    <h2>维度对比</h2><table><tr><th>维度</th><th>V1得分</th><th>V2得分</th><th>差值</th></tr>
    ${data.v1Review.dimensions.map(d => {
      const v2d = data.v2Review.dimensions.find(v => v.code === d.code) || d;
      const diff = v2d.score - d.score;
      return `<tr><td>${d.name}</td><td>${d.score.toFixed(1)}</td><td>${v2d.score.toFixed(1)}</td><td class="${diff > 0 ? "improved" : diff < 0 ? "regressed" : ""}">${diff > 0 ? "+" : ""}${diff.toFixed(1)}</td></tr>`;
    }).join("")}
    </table>

    <h2>V2 改进维度</h2><p>${data.comparison.improvedDimensions.join("、") || "无"}</p>
    <h2>V2 退化维度</h2><p>${data.comparison.regressedDimensions.join("、") || "无"}</p>

    <h2>关键变化点</h2><ul>${data.comparison.keyChanges.map(c => `<li>${c}</li>`).join("")}</ul>

    <p style="margin-top:32px;color:#999;font-size:12px;">由 Smart Review AI 辅助生成 · ${new Date().toLocaleString('zh-CN')}</p>
    </body></html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `HMI对比报告_${new Date().toISOString().slice(0,10)}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ============================================================
   Compare Report Page Component
   ============================================================ */
export default function ComparePage() {
  const [result, setResult] = useState<CompareResultData | null>(null);
  const [images, setImages] = useState<CompareImagePreview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("compareResult");
      if (stored) {
        const raw = JSON.parse(stored);
        /* 归一化：确保所有必填字段有安全默认值 */
        const safeReview = (r: any) => ({
          overallScore: r?.overallScore ?? 7.0,
          rating: r?.rating || "average",
          summary: r?.summary || "AI分析完成",
          dimensions: Array.isArray(r?.dimensions) ? r.dimensions : [],
          issues: Array.isArray(r?.issues) ? r.issues : [],
        });
        const normalized = {
          v1Review: safeReview(raw.v1Review),
          v2Review: safeReview(raw.v2Review),
          comparison: {
            improvedDimensions: Array.isArray(raw.comparison?.improvedDimensions) ? raw.comparison.improvedDimensions : [],
            regressedDimensions: Array.isArray(raw.comparison?.regressedDimensions) ? raw.comparison.regressedDimensions : [],
            netScoreChange: raw.comparison?.netScoreChange ?? 0,
            keyChanges: Array.isArray(raw.comparison?.keyChanges) ? raw.comparison.keyChanges : [],
          },
          recommendation: raw.recommendation || "需要进一步分析",
        };
        setResult(normalized);
      }
      const storedImages = sessionStorage.getItem("compareImages");
      if (storedImages) setImages(JSON.parse(storedImages));
    } catch (e) {
      console.error("[Compare] Failed to load/normalize data:", e);
    }
    setLoaded(true);
  }, []);

  /* Loading State */
  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f18]">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-5" />
        <p className="text-slate-400">正在加载对比报告...</p>
        <Link href="/" className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">返回首页</Link>
      </div>
    );
  }

  /* No Data State */
  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f18]">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-800/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.78c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
        </div>
        <p className="text-slate-300 font-medium text-lg mb-2">未找到对比数据</p>
        <p className="text-sm text-slate-500 mb-6 max-w-md text-center">请从首页选择「对比模式」上传两套方案进行对比。</p>
        <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">开始新对比</Link>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: #333 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .min-h-screen { min-height: auto !important; padding: 20px !important; }
          .bg-\\[\\#0a0f18\\] { background: white !important; }
          .text-white { color: #1a1a2e !important; }
          .text-slate-200, .text-slate-300, .text-slate-400 { color: #444 !important; }
          .border-white\\/\\[0\\.06\\], .border-white\\/\\[0.08\\] { border-color: #e5e7eb !important; }
          .bg-white\\/\\[0\\.02\\] { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
          .fixed { position: static !important; }
          .grid { display: block !important; page-break-inside: avoid; }
        }
      ` }} />

    <div className="min-h-screen bg-[#0a0f18]">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] -left-[10%] w-[50%] h-[70%] rounded-full bg-indigo-600/6 blur-[120px]" />
        <div className="absolute bottom-[10%] -right-[10%] w-[50%] h-[60%] rounded-full bg-purple-600/6 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-[#0a0f18]/85 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/history" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors no-print">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
          <span className="text-slate-700">|</span>
          <span className="text-sm font-medium text-white">对比报告</span>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer">
            <FileDown className="w-3.5 h-3.5" /> 导出 PDF
          </button>
          <button onClick={() => handleExportWord(result)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer">
            <Download className="w-3.5 h-3.5" /> 导出 Word
          </button>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors no-print">
            <Home className="w-3.5 h-3.5" /> 首页
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-16 space-y-6">

        {/* ===== 上传图片展示区 ===== */}
        {images.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">上传的设计稿</h3>
                <span className="text-xs text-slate-500">{images.length} 张</span>
              </div>

              {/* Main Image Display */}
              <div className="aspect-[4/3] rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden relative group">
                <img
                  src={images[selectedImageIndex]?.url}
                  alt={`设计稿 ${selectedImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />

                {/* V1 / V2 版本标签 - 右上角 */}
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider backdrop-blur-sm border shadow-sm ${
                  selectedImageIndex === 0
                    ? "bg-indigo-500/80 text-white border-indigo-400/50"
                    : "bg-blue-500/80 text-white border-blue-400/50"
                }`}>
                  {selectedImageIndex === 0 ? "V1" : "V2"}
                </div>
                
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

            {/* 右侧占位 - 与图片区对齐 */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* 第一层级：分数对比 */}
              <div className="flex items-center justify-center gap-8 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-center">
                  <p className="text-[11px] text-indigo-400/70 uppercase tracking-wider mb-1.5 font-medium">Version 1</p>
                  <span className="text-4xl font-extrabold" style={{ color: getRatingConfig(result.v1Review.rating).color }}>
                    {(result.v1Review.overallScore * 10).toFixed(0)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{getRatingConfig(result.v1Review.rating).label}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg text-slate-600 font-light">VS</span>
                  {result.comparison.netScoreChange !== 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      result.comparison.netScoreChange > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {result.comparison.netScoreChange > 0 ? "+" : ""}{result.comparison.netScoreChange.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-blue-400/70 uppercase tracking-wider mb-1.5 font-medium">Version 2</p>
                  <span className="text-4xl font-extrabold" style={{ color: getRatingConfig(result.v2Review.rating).color }}>
                    {(result.v2Review.overallScore * 10).toFixed(0)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{getRatingConfig(result.v2Review.rating).label}</p>
                </div>
              </div>

              {/* 第二层级：解读信息 */}
              <div className="flex-1 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs text-indigo-400 font-medium shrink-0">AI 解读</span>
                  <div className="h-px flex-1 bg-white/[0.06] mt-2" />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{result.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== 无图片时的顶部摘要（两层级布局） ===== */}
        {images.length === 0 && (
          <div className="space-y-4">
            {/* 第一层级：分数对比 */}
            <div className="flex items-center justify-center gap-8 p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="text-center">
                <p className="text-[11px] text-indigo-400/70 uppercase tracking-wider mb-1.5 font-medium">Version 1</p>
                <span className="text-4xl font-extrabold" style={{ color: getRatingConfig(result.v1Review.rating).color }}>
                  {(result.v1Review.overallScore * 10).toFixed(0)}
                </span>
                <p className="text-xs text-slate-500 mt-1">{getRatingConfig(result.v1Review.rating).label}</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg text-slate-600 font-light">VS</span>
                {result.comparison.netScoreChange !== 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    result.comparison.netScoreChange > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}>
                    {result.comparison.netScoreChange > 0 ? "+" : ""}{result.comparison.netScoreChange.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="text-[11px] text-blue-400/70 uppercase tracking-wider mb-1.5 font-medium">Version 2</p>
                <span className="text-4xl font-extrabold" style={{ color: getRatingConfig(result.v2Review.rating).color }}>
                  {(result.v2Review.overallScore * 10).toFixed(0)}
                </span>
                <p className="text-xs text-slate-500 mt-1">{getRatingConfig(result.v2Review.rating).label}</p>
              </div>
            </div>

            {/* 第二层级：解读信息 */}
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xs text-indigo-400 font-medium shrink-0">AI 解读</span>
                <div className="h-px flex-1 bg-white/[0.06] mt-2" />
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.recommendation}</p>
            </div>
          </div>
        )}

        {/* ===== 雷达图与维度评分左右并列展示 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 左侧：雷达图 */}
          <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">维度评分雷达图</h3>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6366f1]" />V1</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" />V2</span>
              </div>
            </div>
            <div className="flex justify-center">
              <DualRadarChart v1Dims={result.v1Review.dimensions} v2Dims={result.v2Review.dimensions} />
            </div>
          </div>

          {/* 右侧：维度评分详情 - 同一维度上下两行(V1/V2) */}
          <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-white mb-4">维度评分详情</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {result.v1Review.dimensions.map((dim) => {
                const v2Dim = result.v2Review.dimensions.find(d => d.code === dim.code) || dim;
                const diff = v2Dim.score - dim.score;
                const isLowV1 = dim.score < 6;
                const isLowV2 = v2Dim.score < 6;
                return (
                  <div key={dim.code} className="p-3 rounded-lg bg-black/20 border border-white/[0.03]">
                    {/* 维度名称 + 差值 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dim.color || "#818cf8" }} />
                        <span className="text-xs font-semibold text-white">{dim.name}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${diff > 0 ? "bg-green-500/10 text-green-400" : diff < 0 ? "bg-red-500/10 text-red-400" : "bg-slate-500/10 text-slate-500"}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </span>
                    </div>
                    
                    {/* V1 行 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-indigo-400/80 w-5 font-medium">V1</span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(dim.score / dim.maxScore) * 100}%`,
                            backgroundColor: isLowV1 ? "#f87171" : "#818cf8",
                          }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${isLowV1 ? "text-red-400" : "text-indigo-300"}`}>
                        {dim.score.toFixed(1)}
                      </span>
                    </div>
                    
                    {/* V2 行 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-blue-400/80 w-5 font-medium">V2</span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(v2Dim.score / v2Dim.maxScore) * 100}%`,
                            backgroundColor: isLowV2 ? "#f87171" : "#60a5fa",
                          }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${isLowV2 ? "text-red-400" : "text-blue-300"}`}>
                        {v2Dim.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== ISSUE CARDS: 两方案问题分别展示（参考单方案报告卡片格式）===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Version 1 Issues */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChevronRight className="w-4 h-4 text-indigo-400 rotate-90" />
                  <h2 className="text-base font-bold text-white">Version 1 问题清单</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 font-mono">
                  {result.v1Review.issues.length} 项
                </span>
              </div>

              {result.v1Review.issues.length > 0 ? (
                <div className="space-y-3">
                  {result.v1Review.issues.map((issue) => {
                    const sevCfg = getSeverityConfig(issue.severity);
                    return (
                      <div key={issue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-indigo-300">{issue.dimension}</h4>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${sevCfg.bg}`}>
                              {sevCfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2.5">{issue.category}</p>
                          <div className="rounded-lg overflow-hidden border border-white/[0.04]">
                            <div className="p-2.5 bg-red-500/[0.03] border-b border-white/[0.04]">
                              <p className="text-[11px] font-medium text-red-400/80 mb-0.5">AS-IS 当前问题</p>
                              <p className="text-[13px] text-slate-300 leading-snug">{issue.description}</p>
                            </div>
                            <div className="p-2.5 bg-emerald-500/[0.03]">
                              <p className="text-[11px] font-medium text-emerald-400/80 mb-0.5">TO-BE 改进建议</p>
                              <p className="text-[13px] text-slate-300 leading-snug">{issue.suggestion}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center rounded-xl border border-dashed border-white/[0.08]">
                  <p className="text-sm text-slate-500">未发现问题，方案表现优秀！</p>
                </div>
              )}
            </div>

            {/* Version 2 Issues */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChevronRight className="w-4 h-4 text-blue-400 rotate-90" />
                  <h2 className="text-base font-bold text-white">Version 2 问题清单</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 font-mono">
                  {result.v2Review.issues.length} 项
                </span>
              </div>

              {result.v2Review.issues.length > 0 ? (
                <div className="space-y-3">
                  {result.v2Review.issues.map((issue) => {
                    const sevCfg = getSeverityConfig(issue.severity);
                    return (
                      <div key={issue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-blue-500/15 transition-all overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-blue-300">{issue.dimension}</h4>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${sevCfg.bg}`}>
                              {sevCfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2.5">{issue.category}</p>
                          <div className="rounded-lg overflow-hidden border border-white/[0.04]">
                            <div className="p-2.5 bg-red-500/[0.03] border-b border-white/[0.04]">
                              <p className="text-[11px] font-medium text-red-400/80 mb-0.5">AS-IS 当前问题</p>
                              <p className="text-[13px] text-slate-300 leading-snug">{issue.description}</p>
                            </div>
                            <div className="p-2.5 bg-emerald-500/[0.03]">
                              <p className="text-[11px] font-medium text-emerald-400/80 mb-0.5">TO-BE 改进建议</p>
                              <p className="text-[13px] text-slate-300 leading-snug">{issue.suggestion}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center rounded-xl border border-dashed border-white/[0.08]">
                  <p className="text-sm text-slate-500">未发现问题，方案表现优秀！</p>
                </div>
              )}
            </div>
          </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06] no-print">
          <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer">
            <Download className="w-4 h-4" /> 导出 PDF 报告
          </button>
          <button onClick={() => handleExportWord(result)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] transition-colors cursor-pointer">
            <FileDown className="w-4 h-4" /> 导出 Word
          </button>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <Home className="w-4 h-4" /> 返回首页
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}

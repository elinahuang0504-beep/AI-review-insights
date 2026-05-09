"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileDown, Download, Home, Users, ChevronDown } from "lucide-react";

/* ============================================================
   Dimension Code → Name 映射
   ============================================================ */
const DIMENSION_NAME_MAP: Record<string, string> = {
  D1: "驾驶安全性", D2: "视觉可读性", D3: "信息架构",
  D4: "交互效率",  D5: "一致性",     D6: "无障碍",
  D7: "美观度",    D8: "功能完整性与状态感知",
};
function resolveDimensionName(raw: string): string {
  // 支持多维度组合：如 "D1" 或 "D1/D3/D6"
  return raw.split("/").map(code => {
    const trimmed = code.trim();
    return DIMENSION_NAME_MAP[trimmed] || trimmed;
  }).join("/");
}

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

/* 用户评测结果（PRD v1.1） */
import type { UserEvaluationSummary } from "@/lib/user-evaluation";
import { getConsistencyLabel, getConsistencyColor, getScoreColor, getScoreRating } from "@/lib/user-evaluation";

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

      {/* Labels - using foreignObject for text wrapping with more space */}
      {dimensions.map((dim, i) => {
        const lp = labelPoints[i];
        return (
          <foreignObject key={i} x={lp.x - 55} y={lp.y - 12} width="110" height="32">
            <div
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: "10px",
                fontWeight: 500,
                color: "#94a3b8",
                lineHeight: 1.4,
                wordBreak: "break-word",
                overflowWrap: "break-word",
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
    case "致命":
      return {
        label: "致命",
        bg: "bg-red-500/10 border-red-500/20 text-red-400",
        dot: "bg-red-500",
      };
    case "serious":
    case "严重":
      return {
        label: "严重",
        bg: "bg-orange-500/10 border-orange-500/20 text-orange-400",
        dot: "bg-orange-500",
      };
    case "warning":
    case "警告":
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
/* ============================================================
   Export Helpers
   ============================================================ */

function handleExportPDF() {
  try {
    window.print();
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("导出失败，请尝试使用「导出 Word」功能");
  }
}

function handleExportWord(result: ReviewResult | null) {
  if (!result) { alert("没有可导出的数据"); return; }

  const ratingMap: Record<string, string> = {
    excellent: "优秀", good: "良好", average: "一般", poor: "需改进",
  };
  const severityMap: Record<string, string> = {
    critical: "致命", serious: "严重", warning: "警告", info: "提示",
  };

  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>HMI设计审查报告</title>
    <style>body{font-family:微软雅黑,sans-serif;font-size:14px;color:#333;line-height:1.8;}
    h1{font-size:22px;color:#1a1a2e;border-bottom:3px solid #4f46e5;padding-bottom:10px;}
    h2{font-size:16px;color:#4f46e5;margin-top:24px;border-left:4px solid #4f46e5;padding-left:10px;}
    h3{font-size:14px;color:#555;margin-top:16px;}
    table{width:100%;border-collapse:collapse;margin:12px 0;}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px;}
    th{background:#f0f0f5;font-weight:600;}
    .score-box{display:inline-block;background:#4f46e5;color:#fff;padding:6px 16px;border-radius:20px;font-size:28px;font-weight:bold;margin:16px 0;}
    .issue-card{border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:10px 0;}
    .as-is{background:#fef2f2;border-left:4px solid #ef4444;}
    .to-be{background:#ecfdf5;border-left:4px solid #10b981;}
    </style></head><body>
    <h1>Smart Review - HMI设计审查报告</h1>
    <p><strong>评级：</strong>${ratingMap[result.rating] || result.rating} &nbsp;|&nbsp; <strong>总分：</strong>${(result.overallScore * 10).toFixed(0)} / 100</p>
    <p><strong>摘要：</strong>${result.summary}</p>

    <h2>维度评分详情</h2><table><tr><th>维度</th><th>得分</th><th>满分</th></tr>
    ${result.dimensions.map(d => `<tr><td>${d.name}</td><td>${d.score.toFixed(1)}</td><td>${d.maxScore}</td></tr>`).join('')}
    </table>

    <h2>问题清单（共${result.issues.length}项）</h2>
    ${result.issues.map(issue => `
      <div class="issue-card">
        <h3>[${severityMap[issue.severity] || issue.severity}] ${(issue.dimension || "").split("/").map(c => DIMENSION_NAME_MAP[c.trim()] || c.trim()).join("/")} — ${issue.category}</h3>
        <div class="as-is"><strong>AS-IS 当前问题：</strong>${issue.description}</div>
        <div class="to-be"><strong>TO-BE 改进建议：</strong>${issue.suggestion}</div>
      </div>
    `).join('')}

    <p style="margin-top:32px;color:#999;font-size:12px;">由 Smart Review AI 辅助生成 · ${new Date().toLocaleString('zh-CN')}</p>
    </body></html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HMI审查报告_${new Date().toISOString().slice(0,10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   Report Page Component
   ============================================================ */
export default function ReportPage() {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [images, setImages] = useState<UploadedImagePreview[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [userEvalSummary, setUserEvalSummary] = useState<UserEvaluationSummary | null>(null);
  const [activeTab, setActiveTab] = useState<"expert" | "user-eval">("expert");

  // Section refs for tab anchor scrolling
  const expertSectionRef = useRef<HTMLDivElement>(null);
  const userEvalSectionRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (tab: "expert" | "user-eval") => {
    setActiveTab(tab);
    const el = tab === "expert" ? expertSectionRef.current : userEvalSectionRef.current;
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  useEffect(() => {
    try {
      const storedResult = sessionStorage.getItem("reviewResult");
      if (storedResult) setResult(JSON.parse(storedResult));

      const storedImages = sessionStorage.getItem("reviewImages");
      if (storedImages) setImages(JSON.parse(storedImages));

      // 加载用户评测结果（PRD v1.1）
      const storedUserEval = sessionStorage.getItem("userEvaluationSummary");
      if (storedUserEval) setUserEvalSummary(JSON.parse(storedUserEval));
    } catch {}
    setLoaded(true); // Mark loaded regardless of data existence
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
    <>
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: #333 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .min-h-screen { min-height: auto !important; padding: 20px !important; }
          .bg-\\[\\#0a0f18\\] { background: white !important; }
          .text-white { color: #1a1a2e !important; }
          .text-slate-200, .text-slate-300, .text-slate-400 { color: #444 !important; }
          .text-indigo-300, .text-indigo-400 { color: #4338ca !important; }
          .border-white\\/\\[0\\.06\\], .border-white\\/\\[0\\.08\\] { border-color: #e5e7eb !important; }
          .bg-white\\/\\[0\\.02\\], .bg-white\\/\\[0\\.03\\] { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
          .rounded-xl, .rounded-2xl { border-radius: 6px !important; }
          .shadow-xl, .shadow-\\[0_8px_32px_rgba\\(0,0,0,0\\.4\\)\\] { box-shadow: none !important; }
          .backdrop-blur-md { backdrop-filter: none !important; }
          header.sticky { position: relative !important; background: #f9fafb !important; border-bottom: 2px solid #ddd !important; padding: 12px 20px !important; }
          .fixed { position: static !important; }
          .grid { display: block !important; page-break-inside: avoid; }
          .aspect-video img { max-width: 100% !important; height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
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
          <Link href="/history" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <span className="text-slate-700">|</span>
          <span className="text-sm font-medium text-white">审查报告</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer">
            <FileDown className="w-3.5 h-3.5" />
            导出 PDF
          </button>
          <button onClick={() => handleExportWord(result)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            导出 Word
          </button>
          <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
            <Home className="w-3.5 h-3.5" />
            首页
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-16 space-y-8">

        {/* ===== Sticky Tab Navigation ===== */}
        <div className="sticky top-14 z-40 -mx-6 px-6 bg-[#0a0f18]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex gap-1">
            <button
              onClick={() => scrollToSection("expert")}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${
                activeTab === "expert"
                  ? "text-white bg-white/[0.06] border-b-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
              }`}
            >
              专家审查
            </button>
            {userEvalSummary && (
              <button
                onClick={() => scrollToSection("user-eval")}
                className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${
                  activeTab === "user-eval"
                    ? "text-white bg-white/[0.06] border-b-2 border-indigo-500"
                    : userEvalSummary.enabled
                      ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                      : "text-amber-400/70 hover:text-amber-300 hover:bg-white/[0.03]"
                }`}
              >
                用户评测{!userEvalSummary.enabled && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">未完成</span>}
              </button>
            )}
          </div>
        </div>

        {/* ===== 专家审查区域 ===== */}
        <div ref={expertSectionRef} className="space-y-5">
          {/* Section Header — 无icon，纯文字 */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white">专家审查</h2>
          </div>

          {/* TOP SECTION: 全宽垂直排列 */}

          {/* 评分卡片 — 全宽 */}
            <div className="flex items-start gap-6 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <ScoreRing score={result.overallScore} rating={result.rating} />
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white mb-1.5">HMI 设计审查报告</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {result.summary}
                </p>
              </div>
            </div>

            {/* 上传设计稿 | 雷达图 | 维度条 — 3列网格 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* 列1：上传的设计稿 */}
              <div className="space-y-4 md:col-span-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">上传的设计稿</h3>
                  <span className="text-xs text-slate-500">{images.length} 张</span>
                </div>

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

                {images[selectedImageIndex]?.stateDesc && (
                  <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-xs text-slate-400">
                      状态：<span className="text-slate-200">{images[selectedImageIndex].stateDesc}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* 列2：维度评分雷达图 */}
              <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white mb-4">维度评分雷达图</h3>
                <div className="flex justify-center">
                  <RadarChart dimensions={result.dimensions} />
                </div>
              </div>

              {/* 列3：维度详情评分 */}
              <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <h3 className="text-sm font-semibold text-white mb-4">维度详情评分</h3>
                <div className="space-y-3">
                  {result.dimensions.map((dim) => {
                    const isLow = dim.score < 6;
                    const unifiedColor = "#818cf8";
                    return (
                      <div key={dim.code}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: unifiedColor }} />
                            <span className="text-xs font-medium text-slate-300">{dim.name}</span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: isLow ? "#f87171" : unifiedColor }}>
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

            </div>{/* end 3列网格 */}

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
        </div>{/* end 专家审查 space-y-5 */}

        {/* ===== BOTTOM SECTION: Issues Detail List ===== */}
        <div className="space-y-5">
          {/* Section Header — 无icon */}
          <div className="flex items-center gap-2.5">
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
            {result.issues.map((issue) => {
              const sevCfg = getSeverityConfig(issue.severity);
              return (
                <div
                  key={issue.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all overflow-hidden"
                >
                  <div className="p-4">
                    {/* Header row - severity badge + dimension title */}
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-sm font-semibold text-indigo-300">{resolveDimensionName(issue.dimension)}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${sevCfg.bg}`}>
                        {sevCfg.label}
                      </span>
                    </div>

                    {/* Category sub-label */}
                    <p className="text-[11px] text-slate-500 mb-2.5">{issue.category}</p>

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
              );
            })}

            {result.issues.length === 0 && (
              <div className="col-span-full py-16 text-center rounded-xl border border-dashed border-white/[0.08]">
                <p className="text-sm text-slate-500">未发现明显问题，设计方案表现优秀！</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 用户评测统一区域（PRD v1.1）===== */}
        {userEvalSummary && (
          <div ref={userEvalSectionRef} className="space-y-5">
            {/* Section Header — 无icon */}
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-white">用户评测</h2>
              {!userEvalSummary.enabled ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium">
                  评测未完成
                </span>
              ) : (
                <span className="text-xs text-slate-500 ml-1">共 {userEvalSummary.sampleSize} 位车主独立评估</span>
              )}
            </div>

            {/* 未完成状态：显示错误原因或引导 */}
            {!userEvalSummary.enabled ? (
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-[18px] h-[18px] text-amber-400" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-amber-300/90">
                      用户评测未成功执行
                    </p>
                    <p className="text-[13px] text-slate-400 leading-relaxed">
                      {userEvalSummary.errorMessage || "评测过程中出现异常，未能生成用户评测数据。"}
                    </p>
                  </div>
                </div>
                {(userEvalSummary?.errorMessage || "").includes("虚拟用户库为空") && (
                  <div className="flex items-center gap-2 pl-12">
                    <Link href="/history" className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors inline-flex items-center gap-1.5">
                      前往添加虚拟车主 →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* 正常状态：总结卡片 + 详情 */}
                <UserEvalSummaryCard summary={userEvalSummary} />
                <UserEvalDetailSection summary={userEvalSummary} />
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
          <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer">
            <Download className="w-4 h-4" />
            导出 PDF 报告
          </button>
          <button onClick={() => handleExportWord(result)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] transition-colors cursor-pointer">
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
    </>
  );
}

/* ============================================================
   UserEvalSummaryCard — 用户评测总结（截图布局：左右双栏）
   ============================================================ */

/** 头像背景色 — 使用与卡片一致的半透明底色 */
const AVATAR_BG = "bg-white/[0.02]";

function UserEvalSummaryCard({ summary }: { summary: UserEvaluationSummary }) {
  const scoreColor = getScoreColor(summary.overallAverageScore);
  // 从 perGoalScores 中取第一个目标的分数色作为进度条渐变参考

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* 标题行 */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-1">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
          <Users className="w-[18px] h-[18px] text-emerald-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">用户评测总结</h3>
        <span className="ml-auto text-xs text-slate-500">共 {summary.sampleSize} 位车主独立评估</span>
      </div>

      {/* 左右双栏内容 */}
      <div className="flex flex-col md:flex-row gap-6 px-5 pb-5 pt-3">
        {/* ===== 左栏：评分区 ===== */}
        <div className="md:w-[42%] space-y-3">
          <p className="text-xs font-medium text-emerald-400">评测得分</p>

          {/* 大分数字 */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] font-bold leading-none tracking-tight" style={{ color: scoreColor }}>
              {summary.overallAverageScore.toFixed(1)}
            </span>
            <span className="text-lg text-slate-500 font-medium">/ 10</span>
          </div>

          <p className="text-xs text-slate-500">{summary.sampleSize} 位用户平均评分</p>

          {/* 进度条（绿色渐变） */}
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${summary.overallAverageScore * 10}%`,
                background: "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)",
              }}
            />
          </div>

          {/* 各车主分数标签 */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400 pt-1">
            {summary.personas.map((p, i) => (
              <span key={p.personaId} className="whitespace-nowrap">
                {p.personaName} <span className="font-semibold text-slate-300">{p.overallScore.toFixed(1)}</span>
                {i < summary.personas.length - 1 && <span className="mx-1.5 text-slate-600">·</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ===== 右栏：综合点评 ===== */}
        <div className="md:w-[58%] space-y-3">
          <p className="text-xs font-medium text-slate-400">综合点评</p>

          {/* 综合评价段落 */}
          <p className="text-[13px] text-slate-300 leading-relaxed">{summary.recommendation}</p>

          {/* 性能优点（黄色点）+ 共性建议（绿色点） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* 从所有 persona 的 suggestions/painPoints 中提取共性 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                <span className="text-xs font-medium text-indigo-300/90">性能优点</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-3">
                {(() => {
                  // 取高分目标的前3个 reasoning 片段作为优点摘要
                  const allHighGoals = summary.personas.flatMap(p =>
                    p.goals.filter(g => g.score >= 7).map(g => `${g.goalText}`)
                  );
                  const uniqueGoals = [...new Set(allHighGoals)];
                  if (uniqueGoals.length > 0) {
                    return uniqueGoals.slice(0, 3).join("；") + (uniqueGoals.length > 3 ? "等" : "") + "表现良好，用户体验较佳。";
                  }
                  // fallback: 取所有 persona 的前2条建议作为优点方向
                  const posSuggestions = summary.personas.slice(0, 2)
                    .flatMap(p => p.goals.slice(0, 1).map(g => g.suggestions?.[0]).filter(Boolean));
                  return posSuggestions.length > 0
                    ? posSuggestions.join("。").slice(0, 80) + "..."
                    : "视觉层次清晰、主控反馈即时，常用功能触手可及成本低。";
                })()}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-emerald-300/90">共性建议</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-3">
                {(() => {
                  // 取低分目标的 painPoints 作为建议
                  const allPainPoints = summary.personas.flatMap(p =>
                    p.goals.filter(g => g.score < 7).flatMap(g => g.painPoints || [])
                  );
                  const uniquePainPoints = [...new Set(allPainPoints)];
                  if (uniquePainPoints.length > 0) {
                    return uniquePainPoints.slice(0, 2).join("；") + "等需要关注优化方向。";
                  }
                  // fallback
                  const allSuggestions = summary.personas.flatMap(p =>
                    p.goals.flatMap(g => g.suggestions || [])
                  );
                  const uniqueSuggestions = [...new Set(allSuggestions)];
                  return uniqueSuggestions.length > 0
                    ? uniqueSuggestions.slice(0, 2).join("；") + "..."
                    : "减少驾驶时的菜单层级，提供语音交互与新手引导。";
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   UserEvalDetailSection — 用户评测详情（截图布局：3列卡片）
   ============================================================ */

/** 从 persona 叙述中提取简短描述（年龄/驾龄/类型等） */
function extractPersonaShortInfo(persona: { personaNarrative: string }): string {
  const text = persona.personaNarrative || "";
  // 尝试提取"XX岁 · 驾龄X年 · XXX车主"格式
  const match = text.match(/(\d+岁)[^·]*·[^·]*·\s*(.{2,10}(?:用户|车主|司机))/);
  if (match) return `${match[1]} · ${match[2]}`;
  // fallback: 取前30字
  return text.length > 35 ? text.slice(0, 35) + "..." : text;
}

function UserEvalDetailSection({ summary }: { summary: UserEvaluationSummary }) {
  if (!summary.personas || summary.personas.length === 0) return null;

  return (
    <div id="user-eval-detail">
      {/* ===== 3列卡片网格 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.personas.map((persona, idx) => (
          <div
            key={persona.personaId}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4"
          >
            {/* 卡片头部：编号 + 分数 */}
            <div className="flex items-start justify-between">
              <span className="text-xs font-mono text-slate-500">#{String(idx + 1).padStart(2, "0")}</span>
              <div className="flex items-baseline gap-0.5">
                <span
                  className="text-3xl font-bold leading-none"
                  style={{ color: getScoreColor(persona.overallScore) }}
                >
                  {persona.overallScore.toFixed(1)}
                </span>
                <span className="text-xs text-slate-600 font-medium">/10</span>
              </div>
            </div>

            {/* 头像 + 姓名 + 简介信息 */}
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-full ${AVATAR_BG} border border-white/[0.08] flex items-center justify-center shrink-0`}
              >
                <span className="text-base font-bold text-indigo-400">
                  {(persona.personaName || "?").charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{persona.personaName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {extractPersonaShortInfo(persona)}
                </p>
              </div>
            </div>

            {/* 目标达成度（进度条列表） */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-500">目标达成度</p>
              {persona.goals.map((goal, gIdx) => (
                <div key={`${persona.personaId}-g-${gIdx}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-300 truncate mr-2">{goal.goalText}</span>
                    <span className="text-xs font-semibold text-slate-200 shrink-0 w-7 text-right">
                      {goal.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${goal.score * 10}%`,
                        backgroundColor: goal.score < 6 ? "#f87171" : "#818cf8",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 主观评价（引用样式） */}
            {persona.summary && (
              <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                <p className="text-[11px] font-medium text-slate-500">主观评价</p>
                <blockquote className="relative pl-3 py-2 rounded-lg bg-white/[0.02] border-l-2 border-indigo-500/30">
                  <span className="absolute -top-0.5 left-1 text-indigo-500/40 text-lg leading-none select-none">"</span>
                  <p className="text-[12px] text-slate-300 leading-relaxed italic pl-2">
                    {persona.summary}
                  </p>
                  <span className="absolute -bottom-2 right-2 text-indigo-500/40 text-lg leading-none select-none">"</span>
                </blockquote>
              </div>
            )}

            {/* 优点 + 建议 */}
            {(persona.goals.some(g => (g.painPoints?.length ?? 0) > 0 || (g.suggestions?.length ?? 0) > 0)) && (
              <div className="space-y-2.5 pt-1">
                {/* 优点 — 黄色点 */}
                {(() => {
                  const allPos = persona.goals
                    .filter(g => g.suggestions?.length)
                    .flatMap(g => g.suggestions!.slice(0, 2));
                  if (allPos.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-[11px] font-medium text-indigo-300/90">建议</span>
                      </div>
                      <ul className="pl-4 space-y-0.5">
                        {allPos.slice(0, 3).map((s, i) => (
                          <li key={`pos-${i}`} className="text-[11px] text-slate-400 leading-relaxed">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* 建议 — 绿色点 */}
                {(() => {
                  const allPain = persona.goals
                    .filter(g => g.painPoints?.length)
                    .flatMap(g => g.painPoints!.slice(0, 2));
                  if (allPain.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-[11px] font-medium text-emerald-300/90">缺点</span>
                      </div>
                      <ul className="pl-4 space-y-0.5">
                        {allPain.slice(0, 3).map((s, i) => (
                          <li key={`pain-${i}`} className="text-[11px] text-slate-400 leading-relaxed">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

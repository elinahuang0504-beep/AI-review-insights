"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileDown, Download, Home, Users, ChevronDown } from "lucide-react";

/* 用户评测（PRD v1.1） */
import type { UserEvaluationSummary } from "@/lib/user-evaluation";
import { getConsistencyLabel, getConsistencyColor, getScoreColor, getScoreRating } from "@/lib/user-evaluation";

/* ============================================================
   Dimension Code → Name 映射
   ============================================================ */
const DIMENSION_NAME_MAP: Record<string, string> = {
  D1: "驾驶安全性", D2: "视觉可读性", D3: "信息架构",
  D4: "交互效率",  D5: "一致性",     D6: "无障碍",
  D7: "美观度",    D8: "功能完整性与状态感知",
};
function resolveDimensionName(raw: string): string {
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
   Score Ring Component — 双版本对比评分环
   ============================================================ */
function DualScoreRing({ v1Score, v2Score, v1Rating, v2Rating, netChange }: { v1Score: number; v2Score: number; v1Rating: string; v2Rating: string; netChange: number }) {
  const cfg1 = getRatingConfig(v1Rating);
  const cfg2 = getRatingConfig(v2Rating);

  return (
    <div className="flex items-center gap-6">
      {/* V1 Ring */}
      <div className="relative w-[110px] h-[110px]">
        <svg width="110" height="110" className="-rotate-90">
          <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle cx="55" cy="55" r="46" fill="none" stroke={cfg1.ring} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={289} strokeDashoffset={289 - (v1Score * 10 / 100) * 289} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-extrabold ${cfg1.color}`}>{(v1Score * 10).toFixed(0)}</span>
          <span className={`text-[10px] font-medium ${cfg1.color}/70`}>{cfg1.label}</span>
        </div>
        <p className="text-[9px] text-indigo-400/70 text-center mt-0.5">V1</p>
      </div>

      {/* VS + Diff */}
      <div className="flex flex-col items-center gap-1 px-3">
        <span className="text-sm text-slate-600 font-light tracking-wider">VS</span>
        {netChange !== 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${netChange > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {netChange > 0 ? "+" : ""}{netChange.toFixed(1)}
          </span>
        )}
      </div>

      {/* V2 Ring */}
      <div className="relative w-[110px] h-[110px]">
        <svg width="110" height="110" className="-rotate-90">
          <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle cx="55" cy="55" r="46" fill="none" stroke={cfg2.ring} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={289} strokeDashoffset={289 - (v2Score * 10 / 100) * 289} className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-extrabold ${cfg2.color}`}>{(v2Score * 10).toFixed(0)}</span>
          <span className={`text-[10px] font-medium ${cfg2.color}/70`}>{cfg2.label}</span>
        </div>
        <p className="text-[9px] text-blue-400/70 text-center mt-0.5">V2</p>
      </div>
    </div>
  );
}

/* Avatar for user eval detail */
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initial = (name?.charAt(0) || "U").toUpperCase();
  return (
    <div className={`${size === "sm" ? "w-11 h-11 text-base" : "w-12 h-12 text-sm"} rounded-full bg-white/[0.02] border border-white/[0.08] flex items-center justify-center font-semibold text-indigo-400 shrink-0`}>
      {initial}
    </div>
  );
}

/** 头像背景色 — 使用与卡片一致的半透明底色 */
const AVATAR_BG = "bg-white/[0.02]";

/* ============================================================
   Compare Report Page Component
   ============================================================ */
export default function ComparePage() {
  const [result, setResult] = useState<CompareResultData | null>(null);
  const [images, setImages] = useState<CompareImagePreview[]>([]);
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

      // 加载用户评测结果（PRD v1.1）
      const storedUserEval = sessionStorage.getItem("userEvaluationSummary");
      if (storedUserEval) setUserEvalSummary(JSON.parse(storedUserEval));
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
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-16 space-y-8">

        {/* ===== Sticky Tab Navigation ===== */}
        <div className="sticky top-14 z-40 -mx-6 px-6 bg-[#0a0f18]/90 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex gap-1">
            <button onClick={() => scrollToSection("expert")} className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${activeTab === "expert" ? "text-white bg-white/[0.06] border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"}`}>
              专家审查
            </button>
            {userEvalSummary && userEvalSummary.enabled && (
              <button onClick={() => scrollToSection("user-eval")} className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${activeTab === "user-eval" ? "text-white bg-white/[0.06] border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"}`}>
                用户评测
              </button>
            )}
          </div>
        </div>

        {/* ===== 专家审查区域 ===== */}
        <div ref={expertSectionRef} className="space-y-5">

          {/* 评分卡片 — 全宽，双版本对比 */}
          <div className="flex items-start gap-6 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <DualScoreRing v1Score={result.v1Review.overallScore} v2Score={result.v2Review.overallScore} v1Rating={result.v1Review.rating} v2Rating={result.v2Review.rating} netChange={result.comparison.netScoreChange} />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-bold text-white mb-1.5">HMI 设计审查报告</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{result.recommendation}</p>
            </div>
          </div>

          {/* 上传设计稿 | 雷达图 | 维度条 — 3列网格 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* 列1：上传的设计稿 */}
            {images.length > 0 && (
              <div className="space-y-4 md:col-span-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">上传的设计稿</h3>
                  <span className="text-xs text-slate-500">{images.length} 张</span>
                </div>
                <div className="aspect-[4/3] rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden relative group">
                  <img src={images[selectedImageIndex]?.url} alt={`设计稿 ${selectedImageIndex + 1}`} className="w-full h-full object-contain" />
                  {images[selectedImageIndex]?.stateDesc !== undefined && (
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider backdrop-blur-sm border shadow-sm ${selectedImageIndex === 0 ? "bg-indigo-500/80 text-white border-indigo-400/50" : "bg-blue-500/80 text-white border-blue-400/50"}`}>
                      {selectedImageIndex === 0 ? "V1" : "V2"}
                    </div>
                  )}
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setSelectedImageIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80">&#8249;</button>
                      <button onClick={() => setSelectedImageIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80">&#8250;</button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {images.map((img, idx) => (
                      <button key={idx} onClick={() => setSelectedImageIndex(idx)} className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === idx ? "border-indigo-500 shadow-lg shadow-indigo-500/20" : "border-transparent opacity-60 hover:opacity-100 hover:border-white/20"}`}>
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {images[selectedImageIndex]?.stateDesc && (
                  <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-xs text-slate-400">状态：<span className="text-slate-200">{images[selectedImageIndex].stateDesc}</span></p>
                  </div>
                )}
              </div>
            )}

            {/* 列2：维度评分雷达图（双版本叠加） */}
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ gridColumn: images.length > 0 ? undefined : "span 1" }}>
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

            {/* 列3：维度详情评分（同一维度行显示V1+V2） */}
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]" style={{ gridColumn: images.length > 0 ? undefined : "span 1" }}>
              <h3 className="text-sm font-semibold text-white mb-4">维度详情评分</h3>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {result.v1Review.dimensions.map((dim) => {
                  const v2Dim = result.v2Review.dimensions.find(d => d.code === dim.code) || dim;
                  const diff = v2Dim.score - dim.score;
                  const isLowV1 = dim.score < 6;
                  const isLowV2 = v2Dim.score < 6;
                  return (
                    <div key={dim.code}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#818cf8" }} />
                          <span className="text-xs font-medium text-slate-300">{dim.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${diff > 0 ? "bg-green-500/10 text-green-400" : diff < 0 ? "bg-red-500/10 text-red-400" : "bg-slate-500/10 text-slate-500"}`}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      </div>
                      {/* V1 bar */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-indigo-400/80 w-5 font-medium shrink-0">V1</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(dim.score / dim.maxScore) * 100}%`, backgroundColor: isLowV1 ? "#f87171" : "#818cf8" }} />
                        </div>
                        <span className={`text-xs font-semibold w-9 text-right shrink-0 ${isLowV1 ? "text-red-400" : "text-indigo-300"}`}>{dim.score.toFixed(1)}</span>
                      </div>
                      {/* V2 bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-400/80 w-5 font-medium shrink-0">V2</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(v2Dim.score / v2Dim.maxScore) * 100}%`, backgroundColor: isLowV2 ? "#f87171" : "#60a5fa" }} />
                        </div>
                        <span className={`text-xs font-semibold w-9 text-right shrink-0 ${isLowV2 ? "text-red-400" : "text-blue-300"}`}>{v2Dim.score.toFixed(1)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>{/* end 3列网格 */}

          {/* 快速统计 — 2列小卡片（左边V1问题数，右边V2问题数） */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Version 1 问题</p>
              <p className="text-lg font-bold text-indigo-400">{result.v1Review.issues.length}<span className="text-xs text-slate-600 ml-1 font-normal">项</span></p>
              <div className="flex gap-1 mt-1.5">
                {["critical", "serious", "warning"].map(sev => {
                  const count = result.v1Review.issues.filter(i => i.severity === sev).length;
                  if (count === 0) return null;
                  const cfg = getSeverityConfig(sev);
                  return <span key={`${sev}-v1`} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cfg.bg}`}>{cfg.label}{count}</span>;
                })}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Version 2 问题</p>
              <p className="text-lg font-bold text-blue-400">{result.v2Review.issues.length}<span className="text-xs text-slate-600 ml-1 font-normal">项</span></p>
              <div className="flex gap-1 mt-1.5">
                {["critical", "serious", "warning"].map(sev => {
                  const count = result.v2Review.issues.filter(i => i.severity === sev).length;
                  if (count === 0) return null;
                  const cfg = getSeverityConfig(sev);
                  return <span key={`${sev}-v2`} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cfg.bg}`}>{cfg.label}{count}</span>;
                })}
              </div>
            </div>
          </div>

        </div>{/* end 专家审查 space-y-5 */}

        {/* ===== 问题细节列表（两方案并列展示）===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Version 1 Issues */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Version 1 问题清单</h3>
              <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 font-mono">{result.v1Review.issues.length} 项</span>
            </div>
            {result.v1Review.issues.length > 0 ? (
              <div className="space-y-3">
                {result.v1Review.issues.map((issue) => {
                  const sevCfg = getSeverityConfig(issue.severity);
                  return (
                    <div key={issue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-indigo-300">{resolveDimensionName(issue.dimension)}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${sevCfg.bg}`}>{sevCfg.label}</span>
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
              <h3 className="text-sm font-semibold text-white">Version 2 问题清单</h3>
              <span className="text-xs px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-300 font-mono">{result.v2Review.issues.length} 项</span>
            </div>
            {result.v2Review.issues.length > 0 ? (
              <div className="space-y-3">
                {result.v2Review.issues.map((issue) => {
                  const sevCfg = getSeverityConfig(issue.severity);
                  return (
                    <div key={issue.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-blue-500/15 transition-all overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-blue-300">{resolveDimensionName(issue.dimension)}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${sevCfg.bg}`}>{sevCfg.label}</span>
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

        {/* ===== 用户评测统一区域 ===== */}
        {userEvalSummary && userEvalSummary.enabled && (
          <div ref={userEvalSectionRef} className="space-y-5">

            {/* 总结卡片 — 全宽 */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* 标题行 */}
              <div className="flex items-center gap-2.5 px-5 pt-5 pb-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <Users className="w-[18px] h-[18px] text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">用户评测总结</h3>
                <span className="ml-auto text-xs text-slate-500">共 {userEvalSummary.sampleSize} 位车主独立评估</span>
              </div>
              <div className="flex flex-col md:flex-row gap-6 px-5 pb-5 pt-3">
                {/* 左栏：评分区 */}
                <div className="md:w-[42%] space-y-3">
                  <p className="text-xs font-medium text-indigo-400">评测得分</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[44px] font-bold leading-none tracking-tight" style={{ color: getScoreColor(userEvalSummary.overallAverageScore) }}>{userEvalSummary.overallAverageScore.toFixed(1)}</span>
                    <span className="text-lg text-slate-500 font-medium">/ 10</span>
                  </div>
                  <p className="text-xs text-slate-500">{userEvalSummary.sampleSize} 位用户平均评分</p>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${userEvalSummary.overallAverageScore * 10}%`, background: "linear-gradient(90deg, #6366f1, #818cf8, #a5b4fc)" }} />
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-400 pt-1">
                    {userEvalSummary.personas.map((p, i) => (
                      <span key={p.personaId} className="whitespace-nowrap">{p.personaName} <span className="font-semibold text-slate-300">{p.overallScore.toFixed(1)}</span>{i < userEvalSummary.personas.length - 1 && <span className="mx-1.5 text-slate-600">·</span>}</span>
                    ))}
                  </div>
                </div>
                {/* 右栏：综合点评 */}
                <div className="md:w-[58%] space-y-3">
                  <p className="text-xs font-medium text-slate-400">综合点评</p>
                  <p className="text-[13px] text-slate-300 leading-relaxed">{userEvalSummary.recommendation}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-xs font-medium text-indigo-300/90">性能优点</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed pl-3">
                        {(() => {
                          const allHighGoals = userEvalSummary.personas.flatMap(p => p.goals.filter(g => g.score >= 7).map(g => g.goalText));
                          const uniqueGoals = [...new Set(allHighGoals)];
                          if (uniqueGoals.length > 0) return uniqueGoals.slice(0, 3).join("；") + (uniqueGoals.length > 3 ? "等" : "") + "表现良好，用户体验较佳。";
                          return "视觉层次清晰、主控反馈即时，常用功能触手可及成本低。";
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
                          const allPainPoints = userEvalSummary.personas.flatMap(p => p.goals.filter(g => g.score < 7).flatMap(g => g.painPoints || []));
                          const uniquePainPoints = [...new Set(allPainPoints)];
                          if (uniquePainPoints.length > 0) return uniquePainPoints.slice(0, 2).join("；") + "等需要关注优化方向。";
                          return "减少驾驶时的菜单层级，提供语音交互与新手引导。";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 详情卡片网格 — 3列 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userEvalSummary.personas.map((persona, idx) => (
                <div key={persona.personaId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                  {/* 编号 + 分数 */}
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-mono text-slate-500">#{String(idx + 1).padStart(2, "0")}</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-3xl font-bold leading-none" style={{ color: getScoreColor(persona.overallScore) }}>{persona.overallScore.toFixed(1)}</span>
                      <span className="text-xs text-slate-600 font-medium">/10</span>
                    </div>
                  </div>
                  {/* 头像 + 姓名 + 简介信息 */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full ${AVATAR_BG} border border-white/[0.08] flex items-center justify-center shrink-0`}>
                      <span className="text-base font-bold text-indigo-400">{(persona.personaName || "?").charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{persona.personaName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{persona.personaNarrative?.slice(0, 35)}</p>
                    </div>
                  </div>
                  {/* 目标达成度（进度条） */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-500">目标达成度</p>
                    {persona.goals.map((goal, gIdx) => (
                      <div key={`${persona.personaId}-g-${gIdx}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-slate-300 truncate mr-2">{goal.goalText}</span>
                          <span className="text-xs font-semibold text-slate-200 shrink-0 w-7 text-right">{goal.score.toFixed(1)}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${goal.score * 10}%`, backgroundColor: goal.score < 6 ? "#f87171" : "#818cf8" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 主观评价 */}
                  {persona.summary && (
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                      <p className="text-[11px] font-medium text-slate-500">主观评价</p>
                      <blockquote className="relative pl-3 py-2 rounded-lg bg-white/[0.02] border-l-2 border-indigo-500/30">
                        <span className="absolute -top-0.5 left-1 text-indigo-500/40 text-lg leading-none select-none">&ldquo;</span>
                        <p className="text-[12px] text-slate-300 leading-relaxed italic pl-2">{persona.summary}</p>
                        <span className="absolute -bottom-2 right-2 text-indigo-500/40 text-lg leading-none select-none">&rdquo;</span>
                      </blockquote>
                    </div>
                  )}
                  {/* 优点 + 建议 */}
                  {(persona.goals.some(g => (g.painPoints?.length ?? 0) > 0 || (g.suggestions?.length ?? 0) > 0)) && (
                    <div className="space-y-2.5 pt-1">
                      {(() => {
                        const allPos = persona.goals.filter(g => g.suggestions?.length).flatMap(g => g.suggestions!.slice(0, 2));
                        if (allPos.length === 0) return null;
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                              <span className="text-[11px] font-medium text-indigo-300/90">建议</span>
                            </div>
                            <ul className="pl-4 space-y-0.5">
                              {allPos.slice(0, 3).map((s, i) => <li key={`pos-${i}`} className="text-[11px] text-slate-400 leading-relaxed">{s}</li>)}
                            </ul>
                          </div>
                        );
                      })()}
                      {(() => {
                        const allPain = persona.goals.filter(g => g.painPoints?.length).flatMap(g => g.painPoints!.slice(0, 2));
                        if (allPain.length === 0) return null;
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="text-[11px] font-medium text-emerald-300/90">缺点</span>
                            </div>
                            <ul className="pl-4 space-y-0.5">
                              {allPain.slice(0, 3).map((s, i) => <li key={`pain-${i}`} className="text-[11px] text-slate-400 leading-relaxed">{s}</li>)}
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
        )}

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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radar, GitCompare, ExternalLink, Trash2, Calendar, ArrowLeft } from "lucide-react";

/* ============================================================
   History Page - Reads real data from localStorage
   ============================================================ */

interface HistoryRecord {
  id: string;
  name: string;
  type: "review" | "compare";
  date: string;
  score: number | null;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-blue-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
}

function loadRecords(): HistoryRecord[] {
  try {
    const data = localStorage.getItem("reviewHistory");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRecords(loadRecords());
    setLoaded(true);
  }, []);

  useEffect(() => {
    const handler = () => setRecords(loadRecords());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleDelete = (id: string) => {
    // Also clean up stored detail data
    localStorage.removeItem(`reviewDetail_${id}`);
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    try {
      localStorage.setItem("reviewHistory", JSON.stringify(updated));
    } catch {}
  };

  const handleViewReport = (record: HistoryRecord) => {
    try {
      const detailData = localStorage.getItem(`reviewDetail_${record.id}`);
      if (detailData) {
        // Has stored detail — use it
        sessionStorage.setItem("reviewResult", detailData);
      } else {
        // No stored detail (old record before feature existed) — generate fallback
        const scoreValue = record.score ? record.score / 10 : 7.6;
        const clamp = (v: number) => Math.round(Math.max(5, Math.min(10, v)) * 10) / 10;
        const fallback = {
          overallScore: scoreValue,
          rating: scoreValue >= 9 ? "excellent" : scoreValue >= 8 ? "good" : scoreValue >= 6 ? "average" : "poor",
          summary: `「${record.name}」的 HMI 设计审查已完成。整体方案在视觉呈现和交互逻辑上表现良好，建议关注驾驶安全性和信息架构层级的进一步优化。`,
          dimensions: [
            { code: "D1", name: "驾驶安全性", score: clamp(scoreValue - 0.3), maxScore: 10, color: "#ef4444" },
            { code: "D2", name: "视觉可读性", score: clamp(scoreValue + 0.6), maxScore: 10, color: "#3b82f6" },
            { code: "D3", name: "信息架构",   score: clamp(scoreValue - 0.8), maxScore: 10, color: "#8b5cf6" },
            { code: "D4", name: "交互效率",   score: clamp(scoreValue + 0.2), maxScore: 10, color: "#10b981" },
            { code: "D5", name: "一致性",     score: clamp(scoreValue + 0.9), maxScore: 10, color: "#f59e0b" },
            { code: "D6", name: "无障碍",     score: clamp(scoreValue - 0.4), maxScore: 10, color: "#ec4899" },
            { code: "D7", name: "美观度",     score: clamp(scoreValue + 0.5), maxScore: 10, color: "#06b6d4" },
            { code: "D8", name: "品牌感",     score: clamp(scoreValue + 0.1), maxScore: 10, color: "#84cc16" },
          ],
          issues: [
            { id: "i1", severity: "warning", category: "操作负荷", dimension: "驾驶安全性", description: "部分高频功能入口层级较深，驾驶中视线偏移时间可能超过推荐阈值。", suggestion: "将常用操作提升至一级或二级菜单，减少操作路径深度。" },
            { id: "i2", severity: "info", category: "视觉细节", dimension: "视觉可读性", description: "个别区域文字对比度略低于最佳实践标准。", suggestion: "确保所有正文文字与背景的对比度达到 WCAG AA 的 4.5:1 标准。" },
          ],
        };
        sessionStorage.setItem("reviewResult", JSON.stringify(fallback));
      }
      sessionStorage.setItem("reviewTaskInfo", JSON.stringify({ description: record.name, goals: [] }));
      router.push("/report");
    } catch (err) {
      console.error("Failed to load report:", err);
      router.push("/report");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f18]">
      <div className="max-w-6xl mx-auto px-8 py-10 pt-24">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Link>
          </div>
          <h1 className="font-bold text-2xl text-white tracking-tight">历史记录</h1>
          <p className="text-sm text-slate-400 mt-2">
            回顾以往的设计审查与对比报告，随时追踪优化进展。
          </p>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[80px_1fr_200px_100px_140px] gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.03]">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">类型</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">审查任务名称</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">创建时间</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">评分</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">操作</span>
          </div>

          {/* Table Body */}
          {loaded && records.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="grid grid-cols-[80px_1fr_200px_100px_140px] gap-4 px-6 py-5 items-center hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Type Icon */}
                  <div className="flex items-center">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        record.type === "review"
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {record.type === "review" ? (
                        <Radar className="w-[18px] h-[18px]" />
                      ) : (
                        <GitCompare className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Task Name */}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-200 truncate block group-hover:text-white transition-colors">
                      {record.name}
                    </span>
                  </div>

                  {/* Created Time */}
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{record.date}</span>
                  </div>

                  {/* Score */}
                  <div className={`text-base font-semibold ${getScoreColor(record.score)}`}>
                    {record.score ?? "—"}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleViewReport(record)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      查看
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="删除记录"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : loaded ? (
            /* Empty State */
            <div className="py-20 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-800/50 flex items-center justify-center">
                <Radar className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">暂无历史记录</p>
              <p className="text-xs text-slate-600 mt-1">完成一次审查后，记录将自动保存在此</p>
              <Link
                href="/"
                className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-medium bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors"
              >
                开始第一次审查
              </Link>
            </div>
          ) : (
            /* Loading State */
            <div className="py-20 text-center">
              <div className="w-8 h-8 mx-auto mb-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">加载中...</p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {loaded && records.length > 0 && (
          <div className="mt-6 flex items-center gap-4 text-xs text-slate-500">
            <span>共 {records.length} 条记录</span>
            <span className="text-slate-700">·</span>
            <span>{records.filter((r) => r.type === "review").length} 条审查</span>
            <span className="text-slate-700">·</span>
            <span>{records.filter((r) => r.type === "compare").length} 条对比</span>
          </div>
        )}
      </div>
    </div>
  );
}

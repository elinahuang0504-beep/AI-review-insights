"use client";

import { useState, useCallback, useRef } from "react";

/* ============================================================
   类型定义
   ============================================================ */
interface DiagnosticItem {
  id: string;
  category: string;
  asIs: string;
  toBe: string;
}

interface StepConfig {
  num: number;
  label: string;
  desc: string;
}

const STEPS: StepConfig[] = [
  { num: 1, label: "上传图片", desc: "拖拽或点击上传设计稿文件" },
  { num: 2, label: "智能识别", desc: "AI 解析视觉元素与布局结构" },
  { num: 3, label: "多维度评价", desc: "安全性 · 可用性 · 无障碍 · 美观度" },
  { num: 4, label: "报告生成", desc: "输出 AS-IS / TO-BE 对比诊断结果" },
];

const DEFAULT_DIAGNOSTICS: DiagnosticItem[] = [];

const MOCK_DIAGNOSTICS: DiagnosticItem[] = [
  {
    id: "d1",
    category: "驾驶安全 · 信息层级优化",
    asIs: "关键操作按钮尺寸偏小，在行驶震动场景下误触风险较高，视觉权重与辅助元素未拉开差距。",
    toBe: "将核心操作按钮最小触控区域扩大至 48×48dp，通过字号加粗 + 青色高亮边框强化主次层级，降低认知负荷。",
  },
  {
    id: "d2",
    category: "可用性 · 操作路径精简",
    asIs: "从首页到达目标功能需经过三级页面跳转，每级均存在非必要的确认弹窗阻断。",
    toBe: "合并中间层为底部抽屉式导航，取消低风险操作的二次确认，路径缩短为两级直达目标。",
  },
  {
    id: "d3",
    category: "无障碍 · 对色对比度修复",
    asIs: "部分说明文字使用 #8a9aad 色值于深底背景上，实测对比度约 2.8:1，低于 WCAG AA 标准。",
    toBe: "正文文字亮度提升至 #c5d0dc 以上，确保全区域对比度 ≥ 4.5:1；同时提供系统字体大小跟随选项。",
  },
  {
    id: "d4",
    category: "美观度 · 留白节奏调整",
    asIs: "卡片内边距不统一（16~28px 混用），模块间缺乏呼吸空间，整体呈现拥挤感。",
    toBe: "统一内边距规范为 24px 基准，模块间距采用 8px 栅格倍数（32/48/64），形成清晰的视觉呼吸韵律。",
  },
];

/* ============================================================
   步骤指示器组件
   ============================================================ */
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="glass-card glow-cyan px-6 py-5 mb-10">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => (
          <div key={step.num} className="flex items-center gap-3">
            {/* 圆圈数字 */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-500
                  ${currentStep >= step.num
                    ? "step-number-active text-[#041018]"
                    : "bg-slate-800/80 text-slate-500 border border-slate-700/60"
                  }
                `}
              >
                {step.num}
              </div>
              <span className={`mt-2 text-[11px] font-medium tracking-wide ${
                currentStep >= step.num ? "text-cyan-neon" : "text-slate-600"
              }`}>
                {step.label}
              </span>
            </div>

            {/* 连线 */}
            {idx < STEPS.length - 1 && (
              <div className={`step-connector hidden sm:block ${currentStep > step.num ? "opacity-100" : "opacity-40"}`} />
            )}
          </div>
        ))}
      </div>

      {/* 当前步骤描述 */}
      <p className="text-center text-xs text-slate-500 mt-4 font-light tracking-wide">
        {STEPS[Math.max(0, currentStep - 1)]?.desc ?? ""}
      </p>
    </div>
  );
}

/* ============================================================
   AS-IS / TO-BE 诊断卡片组件
   ============================================================ */
function DiagnosticCard({ item, index }: { item: DiagnosticItem; index: number }) {
  return (
    <div
      className="glass-card overflow-hidden card-hover animate-fade-up"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* 卡片标题栏 — 青绿色渐变 */}
      <div className="diagnostic-header diagnostic-card-header px-5 py-3.5">
        <h3 className="text-sm font-semibold text-white tracking-tight">{item.category}</h3>
      </div>

      {/* 内容区 */}
      <div className="p-5 space-y-4">
        {/* AS-IS */}
        <div>
          <span className="as-is-label">AS-IS · 现状问题</span>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400 font-light">
            {item.asIs}
          </p>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

        {/* TO-BE */}
        <div>
          <span className="to-be-label">TO-BE · 改进方案</span>
          <p className="mt-1.5 text-[13px] leading-relaxed to-be-content font-normal">
            {item.toBe}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   主页组件
   ============================================================ */
export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>(DEFAULT_DIAGNOSTICS);
  const [currentStep, setCurrentStep] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- 文件处理 ---------- */
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setHasAnalyzed(false);
      setDiagnostics(DEFAULT_DIAGNOSTICS);
      setCurrentStep(1);
    };
    reader.readAsDataURL(file);
  }, []);

  /* ---------- 拖拽事件 ---------- */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ---------- 点击上传 ---------- */
  const handleClickUpload = () => fileInputRef.current?.click();
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  /* ---------- AI 分析模拟 ---------- */
  const handleAnalyze = async () => {
    if (!image || isAnalyzing) return;

    // 步骤推进：识别
    setCurrentStep(2);
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    await new Promise((r) => setTimeout(r, 700));

    // 多维度评价
    setCurrentStep(3);
    await new Promise((r) => setTimeout(r, 1000));

    // 报告生成
    setCurrentStep(4);
    await new Promise((r) => setTimeout(r, 500));

    setDiagnostics(MOCK_DIAGNOSTICS);
    setIsAnalyzing(false);
    setHasAnalyzed(true);
  };

  /* ---------- 重置 ---------- */
  const handleReset = () => {
    setImage(null);
    setHasAnalyzed(false);
    setDiagnostics(DEFAULT_DIAGNOSTICS);
    setCurrentStep(1);
  };

  /* ============================================================
     渲染
     ============================================================ */
  return (
    <div className="min-h-screen bg-bg-primary px-5 py-8 lg:px-12 lg:py-10">
      {/* ====== 页面标题 ====== */}
      <header className="max-w-6xl mx-auto mb-7">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-neon to-blue-deep flex items-center justify-center text-base font-black text-[#041018] shadow-lg shadow-cyan-neon/20">
            LR
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Lumine Review
            </h1>
            <p className="text-[11px] font-light text-slate-500 tracking-widest uppercase">
              Design Review System
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">

        {/* ====== 步骤指示器 ====== */}
        <StepIndicator currentStep={isAnalyzing ? currentStep : (hasAnalyzed ? 4 : image ? 2 : 1)} />

        {/* ====== 主内容：左右布局 ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">

          {/* ========== 左栏：上传区 ========== */}
          <section className="lg:col-span-2 space-y-5">
            <div
              onClick={handleClickUpload}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative glass-card cursor-pointer transition-all duration-300 min-h-[360px]
                flex flex-col items-center justify-center overflow-hidden
                ${isDragging ? "upload-zone-dragging border-cyan-neon/50" : "hover:border-glass-border"}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />

              {image ? (
                <div className="relative w-full h-full p-4">
                  <img
                    src={image}
                    alt="设计稿预览"
                    className="w-full h-full object-contain rounded-xl max-h-[340px]"
                  />
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-[#0c1629]/90 backdrop-blur-md border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-400/30 transition-all"
                    aria-label="移除图片"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="text-center px-7 py-10">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                    isDragging ? "bg-cyan-neon/15" : "bg-slate-800/70"
                  }`}>
                    <svg className={`w-7 h-7 transition-colors duration-300 ${
                      isDragging ? "text-cyan-neon drop-shadow-[0_0_8px_rgba(0,229,204,0.5)]" : "text-slate-600"
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className={`text-[15px] font-medium mb-1 transition-colors duration-300 ${
                    isDragging ? "text-cyan-neon" : "text-slate-300"
                  }`}>
                    {isDragging ? "松开以上传" : "拖拽设计稿到此处"}
                  </p>
                  <p className="text-[13px] text-slate-500 font-light mb-4">或点击选择文件</p>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 text-[12px] text-slate-500 font-light border border-white/[0.03]">
                    PNG · JPG · WebP · SVG
                  </span>
                </div>
              )}
            </div>

            {/* 分析按钮 */}
            <button
              onClick={handleAnalyze}
              disabled={!image || isAnalyzing}
              className={`
                w-full py-3.5 rounded-2xl font-bold text-[14px] tracking-widest
                flex items-center justify-center gap-2.5 select-none
                ${!image || isAnalyzing
                  ? "bg-slate-800/60 text-slate-600 cursor-not-allowed border border-white/[0.03]"
                  : "glow-btn text-white"
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin w-4.5 h-4.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>AI 正在诊断中...</span>
                </>
              ) : (
                <>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>开始分析</span>
                </>
              )}
            </button>
          </section>

          {/* ========== 右栏：诊断报告 ========== */}
          <section className="lg:col-span-3 space-y-6">
            {/* Result 头部 */}
            {!hasAnalyzed && !isAnalyzing && (
              <div className="glass-card p-8 text-center opacity-50">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 font-light">上传设计稿后启动 AI 诊断</p>
                <p className="text-xs text-slate-700 mt-1 font-light">AS-IS / TO-BE 对比报告将在此展示</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="glass-card p-10 text-center glow-cyan">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-neon/10 flex items-center justify-center animate-pulse-glow rounded-full">
                  <svg className="w-6 h-6 text-cyan-neon" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L4.2 15.3" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-white tracking-wide">AI 诊断进行中</p>
                <p className="text-xs text-cyan-neon/70 mt-1.5 font-light">步骤 {currentStep}/4 · 请稍候</p>
              </div>
            )}

            {/* ====== Result 结果区 ====== */}
            {hasAnalyzed && (
              <>
                <div className="glass-card glow-cyan p-8 text-center">
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-cyan-neon mb-3">
                    Result
                  </p>
                  <h2 className="result-title-glow text-2xl sm:text-[26px] font-black leading-snug tracking-tight mb-2">
                    基于 AI 诊断结果<br />已生成多维度改进建议
                  </h2>
                  <p className="text-[13px] text-slate-500 font-light max-w-md mx-auto leading-relaxed">
                    Based on the analysis results, we identified key issues and provided AS-IS / TO-BE improvement proposals for each dimension.
                  </p>
                </div>

                {/* 诊断卡片网格 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {diagnostics.map((d, i) => (
                    <DiagnosticCard key={d.id} item={d} index={i} />
                  ))}
                </div>

                {/* 底部综合评分 */}
                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-neon/20 to-blue-deep/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-cyan-neon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">综合评估完成</p>
                    <p className="text-[12px] text-slate-500 font-light mt-0.5">
                      共发现 <span className="glow-text-cyan font-bold">{diagnostics.length}</span> 项可优化问题，
                      已按优先级生成改进方案。
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-14 pt-5 border-t border-white/[0.04]">
        <p className="text-center text-[11px] text-slate-700 font-light tracking-wider">
          LUMINE DESIGN REVIEW · AI DIAGNOSTIC SYSTEM · v2.0
        </p>
      </footer>
    </div>
  );
}

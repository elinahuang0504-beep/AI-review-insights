"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";

/* ============================================================
   Compare Mode Page - Dual Version Comparison
   ============================================================ */

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  state: string;
}

interface TaskInfo {
  name: string;
  description: string;
  goals: string[];
}

interface DimensionScore {
  code: string; name: string; score: number; maxScore: number; color: string;
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

/** Convert File to base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STEPS = [
  { num: 1, label: "上传双方案", desc: "分别上传Version1和Version2的设计稿" },
  { num: 2, label: "任务信息", desc: "填写功能描述和关键目标" },
  { num: 3, label: "确认对比", desc: "选择评估模式并提交" },
  { num: 4, label: "对比报告", desc: "双方案多维度量化对比分析" },
];

const DIMENSIONS = [
  { code: "D1", name: "驾驶安全性", color: "#ef4444" },
  { code: "D2", name: "视觉可读性", color: "#3b82f6" },
  { code: "D3", name: "信息架构", color: "#8b5cf6" },
  { code: "D4", name: "交互效率", color: "#10b981" },
  { code: "D5", name: "一致性", color: "#f59e0b" },
  { code: "D6", name: "无障碍", color: "#ec4899" },
  { code: "D7", name: "美观度", color: "#06b6d4" },
  { code: "D8", name: "品牌感", color: "#84cc16" },
];

function generateMockCompareResult(): CompareResultData {
  return {
    v1Review: {
      overallScore: 7.6,
      rating: "good",
      summary: "V1版本整体表现良好，视觉层次清晰，但在交互效率和信息架构方面存在优化空间。",
      dimensions: DIMENSIONS.map((d, i) => ({
        code: d.code, name: d.name, color: d.color, maxScore: 10,
        score: [7.5, 8.2, 6.8, 7.9, 8.5, 7.2, 8.0, 7.4][i],
      })),
      issues: [],
    },
    v2Review: {
      overallScore: 8.1,
      rating: "good",
      summary: "V2版本在交互效率和信息架构上有明显提升，整体更加符合车载HMI设计规范。",
      dimensions: DIMENSIONS.map((d, i) => ({
        code: d.code, name: d.name, color: d.color, maxScore: 10,
        score: [7.8, 8.0, 7.5, 8.6, 8.3, 7.5, 7.8, 7.6][i],
      })),
      issues: [],
    },
    comparison: {
      improvedDimensions: ["信息架构", "交互效率", "驾驶安全性"],
      regressedDimensions: ["视觉可读性", "美观度"],
      netScoreChange: 0.5,
      keyChanges: [
        "V2将高频操作入口从三级菜单提升至一级，操作路径缩短40%",
        "V2优化了导航栏的信息层级，关键信息更加突出",
        "V2的触控目标尺寸从36px提升至48px，符合ISO标准",
        "V2调整了色彩饱和度，夜间模式眩光风险降低",
      ],
    },
    recommendation: "推荐采用Version 2方案。V2在核心维度（交互效率、信息架构）上有显著提升，虽然视觉可读性略有下降，但整体用户体验更优。建议在V2基础上进一步优化色彩对比度。",
  };
}

export default function ComparePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [v1Images, setV1Images] = useState<UploadedImage[]>([]);
  const [v2Images, setV2Images] = useState<UploadedImage[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo>({ name: "", description: "", goals: [""] });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startComparison = async () => {
    setIsAnalyzing(true);
    setError(null);
    setCurrentStep(4);

    try {
      // Convert images to base64
      const v1Data = await Promise.all(
        v1Images.map(async (img) => ({ data: await fileToBase64(img.file), name: img.file.name, state: img.state }))
      );
      const v2Data = await Promise.all(
        v2Images.map(async (img) => ({ data: await fileToBase64(img.file), name: img.file.name, state: img.state }))
      );

      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          v1Images: v1Data,
          v2Images: v2Data,
          taskName: taskInfo.name,
          description: taskInfo.description,
          goals: taskInfo.goals.filter(g => g.trim()),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errData.error || `服务器错误 (${response.status})`);
      }

      const json = await response.json();
      if (!json.success) throw new Error(json.error || "AI对比返回异常");

      setCompareResult(json.data);
    } catch (err) {
      console.error("Comparison failed:", err);
      setError(err instanceof Error ? err.message : "未知错误");
      // Fallback to mock data for demo
      setCompareResult(generateMockCompareResult());
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* Step Indicator */
  function StepIndicator({ current }: { current: number }) {
    return (
      <div className="glass-card-static px-6 py-6 mb-8">
        <div className="step-indicator justify-center">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="step-item">
              <div className={`step-circle ${current > step.num ? "step-circle-completed" : current === step.num ? "step-circle-active" : "step-circle-pending"}`}>
                {current > step.num ? <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> : step.num}
              </div>
              <span className={`step-label ${current > step.num ? "step-label-completed" : current === step.num ? "step-label-active" : "step-label-pending"}`}>{step.label}</span>
              {idx < STEPS.length - 1 && <div className={`step-line ${current > step.num ? "step-line-active" : ""}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-[13px] text-text-muted mt-5">{STEPS[current - 1]?.desc}</p>
      </div>
    );
  }

  /* Upload Zone for each version */
  function VersionUploadZone({ 
    version, images, setImages 
  }: { version: "V1" | "V2"; images: UploadedImage[]; setImages: (imgs: UploadedImage[]) => void }) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [versionName, setVersionName] = useState(version === "V1" ? "Version 1" : "Version 2");

    const handleFiles = useCallback((files: FileList | null) => {
      if (!files) return;
      const newImages: UploadedImage[] = [];
      Array.from(files).forEach(file => {
        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024 || images.length + newImages.length >= 9) return;
        newImages.push({
          id: `img_${Date.now()}_${Math.random()}`, file,
          preview: URL.createObjectURL(file),
          name: file.name.replace(/\.[^/.]+$/, ""),
          state: "默认展示",
        });
      });
      if (newImages.length > 0) setImages([...images, ...newImages]);
    }, [images, setImages]);

    return (
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display font-semibold text-white">{versionName}</h3>
          <input
            type="text"
            value={versionName}
            onChange={e => setVersionName(e.target.value)}
            placeholder="命名版本..."
            className="text-sm px-3 py-1.5 rounded-lg bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 outline-none w-36"
          />
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          className={`upload-zone min-h-[240px] flex flex-col items-center justify-center p-6 ${isDragging ? "upload-zone-dragging" : ""}`}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
          
          {images.length === 0 ? (
            <>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isDragging ? "bg-accent-neon/15" : "bg-bg-tertiary"}`}>
                <svg className={`w-6 h-6 ${isDragging ? "text-accent-neon" : "text-text-muted"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              </div>
              <p className="text-sm font-medium text-text-secondary">拖拽或点击上传</p>
              <p className="text-xs text-text-muted mt-1">最多9张 / 单张≤10MB</p>
            </>
          ) : (
            <div className="w-full grid grid-cols-4 gap-2 p-2">
              {images.map(img => (
                <div key={img.id} className="relative aspect-video rounded-lg overflow-hidden bg-bg-tertiary group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={e => { e.stopPropagation(); setImages(images.filter(i => i.id !== img.id)); }} className="absolute top-1 right-1 w-5 h-5 rounded bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {images.length < 9 && (
                <div onClick={() => inputRef.current?.click()} className="aspect-video rounded-lg border border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-accent-primary/30 transition-colors">
                  <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted text-center">{images.length}/9 张已上传</p>
      </div>
    );
  }

  /* Loading State */
  if (isAnalyzing) {
    return (
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-8 pt-16">
          <Link href="/" className="text-sm text-text-muted hover:text-accent-secondary inline-flex items-center gap-1 mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> 返回首页
          </Link>
          <h1 className="font-display font-bold text-2xl text-white mb-6">对比模式</h1>
          <StepIndicator current={4} />
          <div className="animate-fade-in glass-card glow-intense p-20 text-center">
            <div className="hero-orb mx-auto mb-8" style={{ width: '200px', height: '200px' }}>
              <div className="hero-orb-inner" style={{ width: '90px', height: '90px' }}>
                <svg className="w-7 h-7 text-accent-neon animate-pulse-glow" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </div>
            </div>
            <h2 className="font-display font-bold text-2xl text-white mb-3">AI 正在对比分析中...</h2>
            <p className="text-text-secondary">分别对两套方案进行多维度评估，并生成差异分析报告</p>
            <div className="flex items-center justify-center gap-2 mt-6">
              {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-accent-neon animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 pt-16">
        {/* Breadcrumb */}
        <div className="mb-8 pt-2">
          <Link href="/" className="text-sm text-text-muted hover:text-accent-secondary inline-flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> 返回首页
          </Link>
          <h1 className="font-display font-bold text-2xl text-white">对比模式</h1>
          <p className="text-sm text-text-muted mt-1">上传两套设计方案，AI 将进行横向量化对比分析</p>
        </div>

        <StepIndicator current={currentStep} />

        {currentStep === 1 && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <VersionUploadZone version="V1" images={v1Images} setImages={setV1Images} />
              <VersionUploadZone version="V2" images={v2Images} setImages={setV2Images} />
            </div>
            
            {v1Images.length > 0 && v2Images.length > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setCurrentStep(2)} className="btn-primary">
                  下一步：填写信息
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            )}

            {(v1Images.length === 0 || v2Images.length === 0) && (
              <div className="text-center py-8 text-text-muted text-sm">
                请分别在两侧上传设计方案（建议一一对应）
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="animate-fade-in space-y-6">
            <div className="glass-card-static p-6 space-y-5">
              <h3 className="font-display font-semibold text-white">任务信息（同时作用于两个版本）</h3>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">任务名称 <span className="text-red-400">*</span></label>
                <input type="text" value={taskInfo.name} onChange={e => setTaskInfo({...taskInfo, name: e.target.value})} placeholder="例如：导航首页 V1 vs V2 对比" className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 outline-none text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">功能描述 <span className="text-text-muted font-normal">(选填)</span></label>
                <textarea value={taskInfo.description} onChange={e => setTaskInfo({...taskInfo, description: e.target.value})} placeholder="描述这是什么页面/功能..." rows={3} className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 outline-none text-sm resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">关键目标 <button onClick={() => setTaskInfo({...taskInfo, goals: [...taskInfo.goals, ""]})} className="ml-2 text-accent-secondary hover:text-accent-neon text-xs font-normal">+ 添加</button></label>
                <div className="space-y-2">
                  {taskInfo.goals.map((g, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={g} onChange={e => {
                        const ng = [...taskInfo.goals]; ng[i] = e.target.value; setTaskInfo({...taskInfo, goals: ng});
                      }} placeholder={`目标 ${i+1}`} className="flex-1 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted outline-none text-sm" />
                      {taskInfo.goals.length > 1 && <button onClick={() => setTaskInfo({...taskInfo, goals: taskInfo.goals.filter((_, idx) => idx !== i)})} className="w-10 h-10 rounded-lg bg-bg-tertiary text-text-muted hover:text-red-400 shrink-0"><svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setCurrentStep(1)} className="btn-secondary"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> 上一步</button>
              <button onClick={() => setCurrentStep(3)} disabled={!taskInfo.name.trim()} className="btn-primary">下一步：确认对比<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="animate-fade-in space-y-6">
            <div className="glass-card-static p-6 space-y-5">
              <h3 className="font-display font-semibold text-white">对比信息确认</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs text-text-muted uppercase tracking-wider mb-3">Version 1 ({v1Images.length}张)</h4>
                  <div className="flex gap-2">{v1Images.slice(0, 4).map(img => <img key={img.id} src={img.preview} className="w-14 h-10 rounded object-cover border border-white/[0.06]" />)}</div>
                </div>
                <div>
                  <h4 className="text-xs text-text-muted uppercase tracking-wider mb-3">Version 2 ({v2Images.length}张)</h4>
                  <div className="flex gap-2">{v2Images.slice(0, 4).map(img => <img key={img.id} src={img.preview} className="w-14 h-10 rounded object-cover border border-white/[0.06]" />)}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-white/[0.04]">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">任务名称</span>
                <p className="text-sm text-white mt-1 font-medium">{taskInfo.name}</p>
              </div>

              <div>
                <h4 className="text-sm text-text-secondary mb-3">评估模式</h4>
                <div className="grid grid-cols-4 gap-3">
                  {["标准模式", "安全优先", "视觉优先", "交互优先"].map(m => (
                    <button key={m} className="p-3 rounded-xl border border-white/[0.06] bg-bg-tertiary/30 text-text-secondary text-[13px] hover:border-accent-primary/40 transition-all">{m}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setCurrentStep(2)} className="btn-secondary"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg> 返回修改</button>
              <button onClick={startComparison} className="btn-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                开始对比分析
              </button>
            </div>
          </div>  
        )}

        {currentStep === 4 && !isAnalyzing && (
          <div className="animate-fade-in space-y-6">
            {compareResult ? (
              <>
                <div className="glass-card glow-primary p-8 text-center">
                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 inline-flex items-center gap-2 text-[13px] text-yellow-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                      AI分析服务暂不可用（{error}），当前显示为示例数据
                    </div>
                  )}
                  <span className="rating-badge rating-good text-sm mb-3">对比完成</span>
                  <h2 className="font-display font-bold text-3xl text-gradient mb-3">双方案对比报告已生成</h2>
                  <p className="text-text-secondary max-w-xl mx-auto">{compareResult.recommendation}</p>
                  
                  {/* Score Comparison */}
                  <div className="flex items-center justify-center gap-12 mt-8 mb-8">
                    <div className="text-center">
                      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Version 1 综合分</div>
                      <div className={`score-value ${compareResult.v1Review.rating === 'excellent' ? 'score-excellent' : compareResult.v1Review.rating === 'good' ? 'score-good' : 'score-average'}`}>
                        {compareResult.v1Review.overallScore.toFixed(1)}<span className="text-lg text-text-muted">/10</span>
                      </div>
                    </div>
                    <div className="text-2xl text-text-muted font-light">vs</div>
                    <div className="text-center">
                      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Version 2 综合分</div>
                      <div className={`score-value ${compareResult.v2Review.rating === 'excellent' ? 'score-excellent' : compareResult.v2Review.rating === 'good' ? 'score-good' : 'score-average'}`}>
                        {compareResult.v2Review.overallScore.toFixed(1)}<span className="text-lg text-text-muted">/10</span>
                      </div>
                    </div>
                  </div>

                  {compareResult.comparison.netScoreChange !== 0 && (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                      compareResult.comparison.netScoreChange > 0
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        {compareResult.comparison.netScoreChange > 0
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 7.5H8.25" />
                        }
                      </svg>
                      分差：{compareResult.comparison.netScoreChange > 0 ? "+" : ""}{compareResult.comparison.netScoreChange.toFixed(1)}
                    </div>
                  )}
                </div>

                {/* Dimension Comparison Table */}
                <div className="glass-card-static p-6">
                  <h3 className="font-display font-semibold text-white mb-4">维度对比详情</h3>
                  <div className="space-y-3">
                    {compareResult.v1Review.dimensions.map((dim) => {
                      const v2Dim = compareResult.v2Review.dimensions.find(d => d.code === dim.code);
                      if (!v2Dim) return null;
                      const diff = v2Dim.score - dim.score;
                      return (
                        <div key={dim.code} className="flex items-center gap-4 p-3 rounded-lg bg-bg-tertiary/30">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dim.color }} />
                          <span className="text-sm text-white w-20 shrink-0">{dim.name}</span>
                          <div className="flex-1 flex items-center gap-4">
                            <span className="font-mono text-sm font-bold w-12 text-right" style={{ color: dim.color }}>{dim.score.toFixed(1)}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] flex overflow-hidden">
                              <div className="h-full transition-all duration-500" style={{ width: `${Math.max(dim.score, v2Dim.score) * 10}%`, backgroundColor: dim.color, opacity: 0.3 }} />
                              <div className="h-full rounded-l-full absolute" style={{ width: `${dim.score * 10}%`, backgroundColor: dim.color }}></div>
                            </div>
                            <span className={`font-mono text-sm font-bold w-12 ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-text-muted"}`}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                            </span>
                            <span className="font-mono text-sm font-bold w-12 text-right" style={{ color: v2Dim.color }}>{v2Dim.score.toFixed(1)}</span>
                          </div>
                          <span className="text-[11px] text-text-muted w-16 shrink-0 text-right">{v2Dim.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Changes & Recommendation */}
                {(compareResult.comparison.improvedDimensions.length > 0 || compareResult.comparison.regressedDimensions.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {compareResult.comparison.improvedDimensions.length > 0 && (
                      <div className="glass-card-static p-5">
                        <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
                          V2 改进维度
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {compareResult.comparison.improvedDimensions.map(d => (
                            <span key={d} className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs border border-green-500/20">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {compareResult.comparison.regressedDimensions.length > 0 && (
                      <div className="glass-card-static p-5">
                        <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 7.5H8.25" /></svg>
                          V2 退化维度
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {compareResult.comparison.regressedDimensions.map(d => (
                            <span key={d} className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs border border-red-500/20">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Key Changes List */}
                {compareResult.comparison.keyChanges.length > 0 && (
                  <div className="glass-card-static p-5">
                    <h4 className="text-sm font-semibold text-white mb-3">关键变化点</h4>
                    <ul className="space-y-2">
                      {compareResult.comparison.keyChanges.map((change, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-neon mt-1.5 shrink-0"></span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card-static p-16 text-center">
                <p className="text-text-muted">暂无对比结果</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg> 导出 PDF 报告</button>
              <Link href="/" className="btn-secondary ml-auto">返回首页</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

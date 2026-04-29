"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";

/* ============================================================
   Types
   ============================================================ */
interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
  state: string; // AI-predicted state
}

interface TaskInfo {
  name: string;
  description: string;
  goals: string[];
  systemType: string; // 中控屏/仪表盘/HUD等
  scene: string; // 行驶中/静止/停车/全场景
}

interface ReviewResult {
  overallScore: number;
  rating: string;
  summary: string;
  dimensions: DimensionScore[];
  issues: IssueItem[];
}

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
  imageIndex?: number;
}

/* ============================================================
   Step Config
   ============================================================ */
const STEPS = [
  { num: 1, label: "上传设计稿", desc: "上传1-9张HMI设计稿图片" },
  { num: 2, label: "任务信息", desc: "填写/确认功能描述和关键目标" },
  { num: 3, label: "确认审查", desc: "选择评估模式并提交" },
  { num: 4, label: "查看报告", desc: "多维度评估报告与改进建议" },
];

const STATE_OPTIONS = [
  "默认展示", "点击前", "悬停态", "按下态", "点击后", "选中态",
  "加载中", "处理中", "成功态", "错误态", "空状态", "编辑态", "展开态", "弹窗态"
];

const SYSTEM_TYPES = ["中控屏", "仪表盘", "副驾屏", "HUD", "手机APP", "其他"];
const SCENE_TYPES = ["行驶中+静止通用", "行驶中", "静止", "停车", "全场景"];
const EVAL_MODES = [
  { key: "standard", label: "标准模式", desc: "均衡评估所有维度" },
  { key: "safety", label: "安全优先", desc: "驾驶安全性权重提升50%" },
  { key: "visual", label: "视觉优先", desc: "视觉可读性、美学吸引力提升" },
  { key: "interaction", label: "交互优先", desc: "交互效率、信息架构提升" },
];

/* ============================================================
   Image Utilities
   ============================================================ */

/** Convert a File object to base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   Mock Results (fallback if API unavailable)
   ============================================================ */
function generateMockResult(): ReviewResult {
  return {
    overallScore: 7.6,
    rating: "good",
    summary: "该设计方案整体表现良好，视觉层次清晰，色彩搭配符合车载环境规范。主要优化方向集中在驾驶安全性维度的操作路径深度和信息架构的层级简化上。",
    dimensions: [
      { code: "D1", name: "驾驶安全性", score: 7.5, maxScore: 10, color: "#ef4444" },
      { code: "D2", name: "视觉可读性", score: 8.2, maxScore: 10, color: "#3b82f6" },
      { code: "D3", name: "信息架构", score: 6.8, maxScore: 10, color: "#8b5cf6" },
      { code: "D4", name: "交互效率", score: 7.9, maxScore: 10, color: "#10b981" },
      { code: "D5", name: "一致性", score: 8.5, maxScore: 10, color: "#f59e0b" },
      { code: "D6", name: "无障碍", score: 7.2, maxScore: 10, color: "#ec4899" },
      { code: "D7", name: "美观度", score: 8.0, maxScore: 10, color: "#06b6d4" },
      { code: "D8", name: "品牌感", score: 7.4, maxScore: 10, color: "#84cc16" },
    ],
    issues: [
      {
        id: "i1", severity: "serious", category: "操作负荷",
        dimension: "驾驶安全性",
        description: "从首页到达目标空调调节功能需经过3级页面跳转（首页→设置→空调→调节），在驾驶过程中视线偏移时间超过NHTSA推荐的2秒限制。",
        suggestion: "建议将高频空调操作合并至一级或二级菜单，或将常用温度调节以常驻控件形式呈现于主界面。",
      },
      {
        id: "i2", severity: "warning", category: "对比度不足",
        dimension: "视觉可读性",
        description: "部分说明文字使用#8a9aad色值于深色背景上，实测对比度约2.8:1，低于WCAG AA标准的4.5:1要求。夜间模式眩光风险较高。",
        suggestion: "将正文文字亮度提升至#c5d0dc以上，确保全区域对比度≥4.5:1；同时检查大文字区域是否满足3:1标准。",
      },
      {
        id: "i3", severity: "warning", category: "触控目标过小",
        dimension: "驾驶安全性",
        description: "部分次要操作按钮的触控区域约为36×36dp，低于ISO 15007推荐的48×48dp最小触控面积标准，在行驶震动环境下误触率较高。",
        suggestion: "所有可交互元素的最小触控区域应扩展至48×48dp，核心操作按钮建议64×64dp以上，并保持足够的间距（≥8dp）。",
      },
      {
        id: "i4", severity: "info", category: "留白节奏",
        dimension: "美观度",
        description: "卡片内边距存在混用（16px~28px），模块间缺乏统一的呼吸空间规律，整体视觉密度偏高，可能造成认知疲劳。",
        suggestion: "统一内边距基准为24px，模块间距采用8px栅格倍数（32/48/64px），建立清晰的视觉韵律体系。",
      },
      {
        id: "i5", severity: "serious", category: "信息层级混乱",
        dimension: "信息架构",
        description: "当前界面中标题、正文、辅助信息的字号差距不足（仅差2px），且未通过颜色深浅进行层级区分，导致用户扫描时难以快速定位关键信息。",
        suggestion: "建立三级字号体系（标题18+/正文14+/辅助12+），配合不同透明度的白色（100%/70%/45%）形成清晰的视觉层级。",
      },
    ],
  };
}

/* ============================================================
   Components
   ============================================================ */

/* --- Step Indicator --- */
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="glass-card-static px-6 py-6 mb-8">
      <div className="step-indicator">
        {STEPS.map((step, idx) => (
          <div key={step.num} className="step-item">
            <div className={`step-circle ${
              current > step.num ? "step-circle-completed" :
              current === step.num ? "step-circle-active" : "step-circle-pending"
            }`}>
              {current > step.num ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : step.num}
            </div>
            <span className={`step-label ${
              current > step.num ? "step-label-completed" :
              current === step.num ? "step-label-active" : "step-label-pending"
            }`}>
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`step-line ${current > step.num ? "step-line-active" : ""}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-[13px] text-text-muted mt-5">
        {STEPS[current - 1]?.desc ?? ""}
      </p>
    </div>
  );
}

/* --- Step 1: Upload Zone --- */
function Step1Upload({ 
  images, setImages, onNext 
}: { 
  images: UploadedImage[]; 
  setImages: (imgs: UploadedImage[]) => void;
  onNext: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newImages: UploadedImage[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (images.length + newImages.length >= 9) return;
      if (file.size > 10 * 1024 * 1024) return;
      
      const preview = URL.createObjectURL(file);
      newImages.push({
        id: `img_${Date.now()}_${Math.random()}`,
        file,
        preview,
        name: file.name.replace(/\.[^/.]+$/, ""),
        state: "默认展示",
      });
    });
    
    if (newImages.length > 0) {
      setImages([...images, ...newImages]);
    }
  }, [images, setImages]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };

  const removeImage = (id: string) => {
    setImages(images.filter(img => img.id !== id));
  };

  const updateState = (id: string, state: string) => {
    setImages(images.map(img => img.id === id ? { ...img, state } : img));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Upload Area */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`upload-zone min-h-[280px] flex flex-col items-center justify-center p-8 ${isDragging ? "upload-zone-dragging" : ""}`}
      >
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragging ? "bg-accent-neon/15" : "bg-bg-tertiary"}`}>
          <svg className={`w-7 h-7 transition-colors ${isDragging ? "text-accent-neon" : "text-text-muted"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-base font-medium text-white mb-1">{isDragging ? "松开以上传" : "拖拽设计稿到此处"}</p>
        <p className="text-sm text-text-muted mb-4">或点击选择文件</p>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="px-3 py-1 rounded-full bg-bg-tertiary border border-white/[0.05]">PNG</span>
          <span className="px-3 py-1 rounded-full bg-bg-tertiary border border-white/[0.05]">JPG</span>
          <span className="px-3 py-1 rounded-full bg-bg-tertiary border border-white/[0.05]">单张 ≤10MB</span>
          <span className="px-3 py-1 rounded-full bg-bg-tertiary border border-white/[0.05]">最多9张</span>
        </div>
      </div>

      {/* Image Thumbnails */}
      {images.length > 0 && (
        <div className="glass-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-white">
              已上传 ({images.length}/9)
            </h3>
            <button onClick={() => setImages([])} className="text-xs text-text-muted hover:text-red-400 transition-colors">
              清空全部
            </button>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-video rounded-xl overflow-hidden bg-bg-tertiary border border-white/[0.06]">
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* State Tag */}
                <div className="absolute bottom-2 left-2 right-2">
                  <select 
                    value={img.state} 
                    onChange={(e) => updateState(img.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-[11px] px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-white/80 border border-white/10 focus:border-accent-neon/50 outline-none"
                  >
                    {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Name */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[10px] text-white/80 truncate max-w-[80%]">
                  {img.name}
                </div>
              </div>
            ))}
            
            {/* Add more slot */}
            {images.length < 9 && (
              <div 
                onClick={() => inputRef.current?.click()}
                className="aspect-video rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-accent-primary/40 hover:bg-white/[0.02] transition-all"
              >
                <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Next Button */}
      {images.length > 0 && (
        <div className="flex justify-end">
          <button onClick={onNext} className="btn-primary">
            下一步：填写信息
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* --- Step 2: Task Info Form --- */
function Step2TaskInfo({
  taskInfo, setTaskInfo, images, onPrev, onNext
}: {
  taskInfo: TaskInfo; setTaskInfo: (t: TaskInfo) => void;
  images: UploadedImage[]; onPrev: () => void; onNext: () => void;
}) {
  const addGoal = () => setTaskInfo({ ...taskInfo, goals: [...taskInfo.goals, ""] });
  const removeGoal = (i: number) => setTaskInfo({ ...taskInfo, goals: taskInfo.goals.filter((_, idx) => idx !== i) });
  const updateGoal = (i: number, val: string) => {
    const newGoals = [...taskInfo.goals];
    newGoals[i] = val;
    setTaskInfo({ ...taskInfo, goals: newGoals });
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Global Info Section */}
      <div className="glass-card-static p-6 space-y-5">
        <h3 className="font-display font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3 .83-5.88-3.54-3.44 4.92-.72L11.42 2l2.89 5.73 4.92.72-3.53 3.44.83 5.89-5.1-3zM22.08 14.17l-2.16 1.74.37 2.69-2.41-1.49-2.41 1.49.37-2.69-2.16-1.74 2.77-.41.97-2.51 2.77.41z" /></svg>
          全局信息
          <span className="text-[11px] font-normal text-text-muted ml-auto">作用于本组所有设计稿</span>
        </h3>

        {/* Task Name */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">任务名称 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={taskInfo.name}
            onChange={(e) => setTaskInfo({ ...taskInfo, name: e.target.value })}
            placeholder="例如：中控屏空调控制界面审查"
            className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 outline-none transition-all text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">功能设计描述 <span className="text-text-muted font-normal">(选填)</span></label>
          <textarea
            value={taskInfo.description}
            onChange={(e) => setTaskInfo({ ...taskInfo, description: e.target.value })}
            placeholder="描述这是什么页面/功能..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 outline-none transition-all text-sm resize-none"
          />
        </div>

        {/* Goals */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            关键目标 <span className="text-text-muted font-normal">(选填)</span>
            <button onClick={addGoal} className="ml-3 text-accent-secondary hover:text-accent-neon text-xs font-normal">+ 添加目标</button>
          </label>
          <div className="space-y-2">
            {taskInfo.goals.map((goal, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => updateGoal(i, e.target.value)}
                  placeholder={`目标 ${i + 1}`}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-white/[0.08] text-white placeholder:text-text-muted focus:border-accent-primary/50 outline-none transition-all text-sm"
                />
                {taskInfo.goals.length > 1 && (
                  <button onClick={() => removeGoal(i)} className="w-10 h-10 rounded-lg bg-bg-tertiary border border-white/[0.06] flex items-center justify-center text-text-muted hover:text-red-400 hover:border-red-400/30 transition-all shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System Type & Scene */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">所属系统 <span className="text-text-muted font-normal">(选填)</span></label>
            <select 
              value={taskInfo.systemType} 
              onChange={(e) => setTaskInfo({ ...taskInfo, systemType: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white focus:border-accent-primary/50 outline-none text-sm appearance-none cursor-pointer"
            >
              <option value="">请选择...</option>
              {SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">驾驶场景</label>
            <select 
              value={taskInfo.scene} 
              onChange={(e) => setTaskInfo({ ...taskInfo, scene: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-bg-tertiary border border-white/[0.08] text-white focus:border-accent-primary/50 outline-none text-sm appearance-none cursor-pointer"
            >
              {SCENE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          上一步
        </button>
        <button onClick={onNext} className="btn-primary" disabled={!taskInfo.name.trim()}>
          下一步：确认审查
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
        </button>
      </div>
    </div>
  );
}

/* --- Step 3: Confirm & Submit --- */
function Step3Confirm({
  taskInfo, images, onPrev, onStartReview, evalMode, onEvalModeChange
}: {
  taskInfo: TaskInfo; images: UploadedImage[];
  onPrev: () => void; onStartReview: () => void;
  evalMode: string;
  onEvalModeChange: (mode: string) => void;
}) {
  const [isStarting, setIsStarting] = useState(false);

  const handleSubmit = async () => {
    setIsStarting(true);
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 800));
    onStartReview();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary Card */}
      <div className="glass-card-static p-6 space-y-5">
        <h3 className="font-display font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          审查信息确认
        </h3>

        {/* Images Preview */}
        <div>
          <h4 className="text-sm text-text-secondary mb-3">设计稿 ({images.length}张)</h4>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map(img => (
              <div key={img.id} className="shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-bg-tertiary border border-white/[0.06]">
                <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Task Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-white/[0.04]">
            <span className="text-[11px] text-text-muted uppercase tracking-wider">任务名称</span>
            <p className="text-sm text-white mt-1 font-medium">{taskInfo.name || "未命名任务"}</p>
          </div>
          <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-white/[0.04]">
            <span className="text-[11px] text-text-muted uppercase tracking-wider">所属系统</span>
            <p className="text-sm text-white mt-1">{taskInfo.systemType || "未指定"}</p>
          </div>
          <div className="sm:col-span-2 p-4 rounded-xl bg-bg-tertiary/50 border border-white/[0.04]">
            <span className="text-[11px] text-text-muted uppercase tracking-wider">功能描述</span>
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{taskInfo.description || "未填写"}</p>
          </div>
        </div>

        {/* Goals */}
        {taskInfo.goals.filter(g => g.trim()).length > 0 && (
          <div>
            <h4 className="text-sm text-text-secondary mb-2">关键目标 ({taskInfo.goals.filter(g => g.trim()).length}项)</h4>
            <div className="flex flex-wrap gap-2">
              {taskInfo.goals.filter(g => g.trim()).map((g, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-accent-primary/8 text-accent-primary text-[13px] border border-accent-primary/15">
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation Mode Selection */}
        <div>
          <h4 className="text-sm text-text-secondary mb-3">评估模式</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EVAL_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => onEvalModeChange(mode.key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  evalMode === mode.key
                    ? "border-accent-primary/50 bg-accent-primary/8 shadow-lg shadow-accent-primary/10"
                    : "border-white/[0.06] bg-bg-tertiary/30 hover:border-white/[0.12]"
                }`}
              >
                <span className={`text-sm font-medium ${evalMode === mode.key ? "text-accent-primary" : "text-text-secondary"}`}>{mode.label}</span>
                <p className="text-[11px] text-text-muted mt-1 leading-tight">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          返回修改
        </button>
        <button onClick={handleSubmit} disabled={isStarting} className="btn-primary">
          {isStarting ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              提交中...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              开始审查
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* --- Step 4: Report Page --- */
function Step4Report({ result, error }: { result: ReviewResult; error?: string | null }) {
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "details">("overview");

  const getRatingConfig = (rating: string) => {
    switch (rating) {
      case "excellent": return { label: "优秀", class: "rating-excellent" };
      case "good": return { label: "良好", class: "rating-good" };
      case "average": return { label: "一般", class: "rating-average" };
      default: return { label: "需改进", class: "rating-poor" };
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical": return { label: "致命", class: "severity-critical" };
      case "serious": return { label: "严重", class: "severity-serious" };
      case "warning": return { label: "警告", class: "severity-warning" };
      default: return { label: "提示", class: "severity-info" };
    }
  };

  const ratingCfg = getRatingConfig(result.rating);

  /* Radar Chart SVG (simplified) */
  function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
    const size = 260;
    const center = size / 2;
    const radius = size * 0.38;
    const angleStep = (Math.PI * 2) / dimensions.length;

    // Generate polygon points
    const points = dimensions.map((dim, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (dim.score / dim.maxScore) * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
      };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
    const labelPoints = dimensions.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return {
        x: center + (radius + 28) * Math.cos(angle),
        y: center + (radius + 28) * Math.sin(angle),
      };
    });

    // Background rings
    const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Rings */}
        {rings.map(r => (
          <polygon key={r}
            points={Array.from({ length: dimensions.length }, (_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const rr = radius * r;
              return `${center + rr * Math.cos(angle)},${center + rr * Math.sin(angle)}`;
            }).join(' ')}
            fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1"
          />
        ))}

        {/* Axes */}
        {dimensions.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          return (
            <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="rgba(148,163,184,0.1)" strokeWidth="1" />
          );
        })}

        {/* Data Area */}
        <path d={pathData} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" />

        {/* Data Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill={dimensions[i].color} stroke="#030712" strokeWidth="2" />
        ))}

        {/* Labels */}
        {dimensions.map((dim, i) => (
          <text key={i} x={labelPoints[i].x} y={labelPoints[i].y} 
            textAnchor="middle" dominantBaseline="middle" 
            fill="#94a3b8" fontSize="11" fontWeight="500">
            {dim.code}
          </text>
        ))}
      </svg>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Report Header */}
      <div className="glass-card glow-primary p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 via-transparent to-accent-secondary/5 pointer-events-none" />
        <div className="relative">
          {/* Error Notice (if using fallback data) */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center gap-2 text-[13px] text-yellow-400">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              <span>AI分析服务暂不可用（{error}），当前显示为示例数据</span>
            </div>
          )}
          <span className={`rating-badge ${ratingCfg.class} text-sm mb-4 inline-block`}>{ratingCfg.label}</span>
          <div className="score-ring my-4">
            <div className={`score-value score-${result.rating}`}>
              {result.overallScore.toFixed(1)}
              <span className="text-2xl text-text-muted">/10</span>
            </div>
          </div>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed mt-4">
            {result.summary}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {(["overview", "issues", "details"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium transition-all relative ${
              activeTab === tab ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {{ overview: "维度总览", issues: "问题列表", details: "逐图批注" }[tab]}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-primary to-accent-neon" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="glass-card-static p-6 flex flex-col items-center">
            <h3 className="font-display font-semibold text-white self-start mb-4">维度评分雷达图</h3>
            <RadarChart dimensions={result.dimensions} />
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-6 w-full">
              {result.dimensions.map(dim => (
                <div key={dim.code} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dim.color }} />
                  <span className="text-[13px] text-text-secondary truncate">{dim.name}</span>
                  <span className="ml-auto font-mono text-[13px] font-bold" style={{ color: dim.color }}>{dim.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dimension Scores List */}
          <div className="glass-card-static p-6">
            <h3 className="font-display font-semibold text-white mb-4">维度详情</h3>
            <div className="space-y-4">
              {result.dimensions.map(dim => (
                <div key={dim.code}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dim.color }} />
                      <span className="text-[14px] font-medium text-white">{dim.name}</span>
                      <span className="text-[11px] text-text-muted font-mono">{dim.code}</span>
                    </div>
                    <span className="font-display font-bold text-[15px]" style={{ color: dim.color }}>
                      {dim.score.toFixed(1)}<span className="text-text-muted text-[12px]">/{dim.maxScore}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(dim.score / dim.maxScore) * 100}%`, backgroundColor: dim.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "issues" && (
        <div className="space-y-4">
          {/* Severity Filter Stats */}
          <div className="flex gap-3 flex-wrap">
            {["critical", "serious", "warning", "info"].map(sev => {
              const count = result.issues.filter(i => i.severity === sev).length;
              if (count === 0) return null;
              const cfg = getSeverityConfig(sev);
              return (
                <span key={sev} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${cfg.class}`}>
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>

          {/* Issues List */}
          {result.issues.map(issue => {
            const sevCfg = getSeverityConfig(issue.severity);
            return (
              <div key={issue.id} className="glass-card-static p-5 group hover:border-white/[0.1] transition-all">
                <div className="flex items-start gap-4">
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase shrink-0 ${sevCfg.class}`}>
                    {sevCfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-white">{issue.category}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.05] text-text-muted">{issue.dimension}</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-3">
                      <span className="text-text-muted mr-2">AS-IS:</span>{issue.description}
                    </p>
                    <div className="p-3 rounded-lg bg-accent-primary/5 border border-accent-primary/10">
                      <p className="text-sm text-accent-secondary leading-relaxed">
                        <span className="text-accent-neon font-semibold mr-2">TO-BE:</span>{issue.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "details" && (
        <div className="glass-card-static p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-bg-tertiary flex items-center justify-center">
            <svg className="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
          </div>
          <h3 className="font-display font-semibold text-white text-lg mb-2">逐图批注</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            此功能将在连接真实 AI 分析引擎后启用，届时可在每张设计稿上直接标注问题区域并关联具体问题条目。
          </p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/[0.04]">
        <button className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          导出 PDF 报告
        </button>
        <button className="btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          导出 Word
        </button>
        <Link href="/" className="btn-secondary ml-auto">
          返回首页
        </Link>
      </div>
    </div>
  );
}

/* ============================================================
   Loading State Component (during analysis)
   ============================================================ */
function AnalyzingLoader({ error }: { error?: string | null }) {
  return (
    <div className="animate-fade-in glass-card glow-intense p-16 text-center">
      <div className="hero-orb mx-auto mb-8" style={{ width: '200px', height: '200px' }}>
        <div className="hero-orb-inner" style={{ width: '90px', height: '90px' }}>
          <svg className="w-8 h-8 text-accent-neon animate-pulse-glow" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L4.2 15.3" />
          </svg>
        </div>
      </div>
      <h2 className="font-display font-bold text-2xl text-white mb-3">AI 专家正在分析中</h2>
      <p className="text-text-secondary mb-6">正在对设计稿进行 8 维度系统化评估...</p>
      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-accent-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-accent-neon animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-[12px] text-text-muted mt-4">预计耗时 30-60 秒</p>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function ReviewPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [taskInfo, setTaskInfo] = useState<TaskInfo>({
    name: "", description: "", goals: [""], systemType: "", scene: "行驶中+静止通用"
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [evalMode, setEvalMode] = useState("standard");
  const [error, setError] = useState<string | null>(null);

  const startReview = async () => {
    setIsAnalyzing(true);
    setError(null);
    setCurrentStep(4);

    try {
      // Convert all images to base64
      const imagePromises = images.map(async (img) => ({
        data: await fileToBase64(img.file),
        name: img.file.name,
        state: img.state,
      }));
      const imageData = await Promise.all(imagePromises);

      // Call the AI review API
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: imageData,
          taskName: taskInfo.name,
          description: taskInfo.description,
          goals: taskInfo.goals.filter(g => g.trim()),
          systemType: taskInfo.systemType,
          scene: taskInfo.scene,
          evalMode: evalMode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "请求失败" }));
        throw new Error(errData.error || `服务器错误 (${response.status})`);
      }

      const json = await response.json();
      
      if (!json.success) {
        throw new Error(json.error || "AI分析返回异常");
      }

      setResult(json.data as ReviewResult);
    } catch (err) {
      console.error("Review failed:", err);
      const message = err instanceof Error ? err.message : "未知错误";
      setError(message);
      // Fallback to mock data for demo
      setResult(generateMockResult());
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb / Title */}
        <div className="mb-8 pt-2">
          <Link href="/" className="text-sm text-text-muted hover:text-accent-secondary transition-colors inline-flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            返回首页
          </Link>
          <h1 className="font-display font-bold text-2xl text-white">审查模式</h1>
        </div>

        {/* Step Indicator */}
        {!isAnalyzing && !result && <StepIndicator current={currentStep} />}

        {/* Step Content */}
        {isAnalyzing ? (
          <AnalyzingLoader error={error} />
        ) : result ? (
          <Step4Report result={result} error={error} />
        ) : (
          <>
            {currentStep === 1 && (
              <Step1Upload 
                images={images} 
                setImages={setImages} 
                onNext={() => setCurrentStep(2)} 
              />
            )}
            {currentStep === 2 && (
              <Step2TaskInfo 
                taskInfo={taskInfo} 
                setTaskInfo={setTaskInfo} 
                images={images}
                onPrev={() => setCurrentStep(1)} 
                onNext={() => setCurrentStep(3)} 
              />
            )}
            {currentStep === 3 && (
              <Step3Confirm 
                taskInfo={taskInfo} 
                images={images} 
                onPrev={() => setCurrentStep(2)}
                onStartReview={startReview}
                evalMode={evalMode}
                onEvalModeChange={setEvalMode}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

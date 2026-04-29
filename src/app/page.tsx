"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  Bot,
  Sparkles,
  Loader2,
  GitCompare,
  Zap,
  Layers,
  FileDown,
  Radar,
  Plus,
  Minus,
  User,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* ============================================================
   Session storage for passing review data to report page
   ============================================================ */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   LocalStorage history persistence
   ============================================================ */
interface HistoryRecord {
  id: string;
  name: string;
  type: "review" | "compare";
  date: string;
  score: number | null;
}

function saveHistoryRecord(
  name: string,
  type: "review" | "compare",
  score: number | null,
  reviewData?: object
) {
  try {
    const existing = localStorage.getItem("reviewHistory");
    const records: HistoryRecord[] = existing ? JSON.parse(existing) : [];
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    // Convert score from 10-scale to 100-scale for display
    const displayScore = score ? Math.round(score * 10) : null;
    const recordId = `h_${Date.now()}`;
    records.unshift({
      id: recordId,
      name,
      type,
      date: dateStr,
      score: displayScore,
    });
    localStorage.setItem("reviewHistory", JSON.stringify(records.slice(0, 50))); // Keep max 50 records

    // Also save full review data for report viewing later
    if (reviewData) {
      localStorage.setItem(`reviewDetail_${recordId}`, JSON.stringify(reviewData));
    }
  } catch (e) {
    console.warn("Failed to save history record:", e);
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ============================================================
   Types
   ============================================================ */
interface UploadedImage {
  id: string;
  url: string;
  stateDesc: string;
  file: File;
}

/* ============================================================
   Background Particles
   ============================================================ */
const Particles = () => {
  const [particles, setParticles] = useState<Array<{ size: number; duration: number; delay: number; left: number }>>([]);

  useEffect(() => {
    setParticles(
      [...Array(40)].map(() => ({
        size: Math.random() * 4 + 1,
        duration: Math.random() * 10 + 5,
        delay: Math.random() * 5,
        left: Math.random() * 100,
      }))
    );
  }, []);

  if (particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          20% { opacity: 0.6; transform: translateY(-20px) translateX(10px) scale(1.2); }
          80% { opacity: 0.6; transform: translateY(-80px) translateX(-10px) scale(0.8); }
          100% { transform: translateY(-100px) translateX(0) scale(0.5); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute bg-indigo-300 rounded-full blur-[1px] mix-blend-screen"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              bottom: "-10%",
              animation: `float-up ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
};

/* ============================================================
   Header Navigation
   ============================================================ */
function HeaderNav() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[#0a0f18]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6">
      <Link href="/" className="inline-flex items-baseline gap-1 hover:opacity-80 transition-opacity">
        <span className="text-xl font-light tracking-tight text-slate-200">Smart</span>
        <span className="text-xl font-bold tracking-tight text-indigo-400">Review</span>
        <div className="w-[6px] h-[6px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mb-1"></div>
      </Link>
      <Link
        href="/history"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
      >
        <span className="text-sm font-medium text-slate-300">个人中心</span>
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <User className="w-4 h-4 text-indigo-400" />
        </div>
      </Link>
    </header>
  );
}

/* ============================================================
   Main Page
   ============================================================ */
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"review" | "compare">("review");

  return (
    <div className="relative w-full min-h-screen flex flex-col pb-24 overflow-hidden">
      {/* Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#0a0f18]">
        {/* Dynamic Mesh */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[90%] rounded-full bg-indigo-600/20 blur-[130px] mix-blend-screen animate-pulse"
          style={{ animationDuration: "10s" }}
        />
        <div
          className="absolute top-[20%] -right-[10%] w-[60%] h-[100%] rounded-full bg-blue-500/15 blur-[120px] mix-blend-screen animate-pulse"
          style={{ animationDuration: "12s", animationDelay: "1s" }}
        />
        <div
          className="absolute -bottom-[30%] left-[20%] w-[70%] h-[80%] rounded-full bg-purple-600/15 blur-[140px] mix-blend-screen animate-pulse"
          style={{ animationDuration: "14s", animationDelay: "2s" }}
        />

        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+")`,
          }}
        />
      </div>

      <HeaderNav />
      <Particles />

      {/* Hero Banner Area */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center pt-32 pb-24 px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI辅助设计审查工具全新上线</span>
        </div>

        <div className="flex items-center justify-center mb-4">
          <span className="text-5xl md:text-7xl font-light tracking-tight text-slate-200">Smart</span>
          <span className="text-5xl md:text-7xl font-bold tracking-tight text-indigo-400">Review</span>
          <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 ml-2 mb-4 md:mb-6"></div>
        </div>
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium text-center drop-shadow leading-relaxed">
          首款专为车载 HMI 打造的 AI 设计评估工具，从美学到人机工程，为您提供专家级的深度分析与多方案对标体验。
        </p>
      </div>

      <div className="relative z-10 max-w-[1400px] w-full mx-auto px-6 flex flex-col items-center">
        {/* Advantages / Features Section */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">多维度智能审查</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              结合最新大模型能力，深度分析HMI设计中的人机交互、视觉美学与安全合规隐患。
            </p>
          </div>

          <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">双方案深度横评</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              支持深浅模式或多版本设计并行对比，直观呈现优劣势数据差异，推荐最优解。
            </p>
          </div>

          <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Radar className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">量化评估体系</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              将界面元素打散，通过计算元素数量、对齐方式、颜色数量等，得出一个美学评分或复杂度评分。
            </p>
          </div>

          <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-2xl p-6 backdrop-blur-xl transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileDown className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">一键专业报告导出</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              自动生成专业级评审详尽报告，支持导出PDF/Word格式，无缝衔接团队工作流。
            </p>
          </div>
        </div>

        {/* Operation Area Wrapper */}
        <div className="w-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-[2rem] p-6 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {/* Text + Underline Tabs */}
          <div className="flex items-center gap-12 border-b border-white/[0.08] mb-10 px-2">
            <button
              onClick={() => setActiveTab("review")}
              className={cn(
                "pb-4 text-base font-medium transition-all duration-200 relative cursor-pointer",
                activeTab === "review"
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              审查模式 (Review)
              {activeTab === "review" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-500 rounded-t-full shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className={cn(
                "pb-4 text-base font-medium transition-all duration-200 relative cursor-pointer",
                activeTab === "compare"
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              对比模式 (Compare)
              {activeTab === "compare" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-500 rounded-t-full shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="w-full">
            {activeTab === "review" ? <ReviewTab /> : <CompareTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Review Tab
   ============================================================ */
function ReviewTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState<string[]>([""]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files)
        .slice(0, 9 - images.length)
        .map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          url: URL.createObjectURL(file),
          stateDesc: "",
          file,
        }));
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const updateStateDesc = (id: string, val: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, stateDesc: val } : img))
    );
  };

  const addGoal = () => setGoals([...goals, ""]);

  const updateGoal = (index: number, value: string) => {
    const newGoals = [...goals];
    newGoals[index] = value;
    setGoals(newGoals);
  };

  const removeGoal = (index: number) => {
    const newGoals = goals.filter((_, i) => i !== index);
    setGoals(newGoals.length ? newGoals : [""]);
  };

  const autoFillAI = () => {
    if (images.length === 0) {
      alert("请先上传设计稿。");
      return;
    }
    setIsAiLoading(true);
    setTimeout(() => {
      setDescription("中控主屏幕快捷操作面板");
      setGoals([
        "用户需要在夜间驾驶环境下快速准确地找到空调、座椅加热等高频车控按键",
        "避免在驾驶操作时产生意外的误触",
      ]);
      setImages((prev) =>
        prev.map((img, i) => ({
          ...img,
          stateDesc:
            img.stateDesc ||
            (i === 0
              ? "默认状态 (首页展示)"
              : i === 1
              ? "按键点击交互反馈"
              : "模态弹窗状态"),
        }))
      );
      setIsAiLoading(false);
    }, 1500);
  };

  const startReview = async () => {
    if (images.length === 0) {
      alert("请至少上传一张设计稿。");
      return;
    }
    setIsReviewing(true);

    try {
      // Convert images to base64 for API
      const imageData = await Promise.all(
        images.map(async (img) => ({
          data: await fileToBase64(img.file),
          name: img.file.name,
          state: img.stateDesc || "默认展示",
        }))
      );

      // Call AI review API
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: imageData,
          taskName: description || "未命名审查任务",
          description,
          goals: goals.filter(g => g.trim()),
          systemType: "中控屏",
          scene: "行驶中+静止通用",
          evalMode: "standard",
        }),
      });

      let reviewData;
      
      if (!response.ok) {
        // API failed - use mock data
        console.warn("API request failed, using mock data");
        reviewData = generateMockResult();
      } else {
        const json = await response.json();
        if (json.success && json.data) {
          reviewData = json.data;
        } else {
          reviewData = generateMockResult();
        }
      }

      // Store result in sessionStorage for report page
      sessionStorage.setItem("reviewResult", JSON.stringify(reviewData));
      sessionStorage.setItem("reviewTaskInfo", JSON.stringify({ description, goals: goals.filter(g => g.trim()) }));
      // Store image previews for report page display
      sessionStorage.setItem("reviewImages", JSON.stringify(images.map(img => ({
        url: img.url,
        stateDesc: img.stateDesc || "默认展示",
      }))));

      // Persist history record to localStorage (with full data for later viewing)
      saveHistoryRecord(description || "未命名审查任务", "review", reviewData.overallScore, reviewData);

      // Navigate directly to report page
      router.push("/report");
    } catch (err) {
      console.error("Review error:", err);
      // Use mock data on error
      const mockResult = generateMockResult();
      sessionStorage.setItem("reviewResult", JSON.stringify(mockResult));
      sessionStorage.setItem("reviewTaskInfo", JSON.stringify({ description, goals: goals.filter(g => g.trim()) }));
      sessionStorage.setItem("reviewImages", JSON.stringify(images.map(img => ({
        url: img.url,
        stateDesc: img.stateDesc || "默认展示",
      }))));
      saveHistoryRecord(description || "未命名审查任务", "review", mockResult.overallScore, mockResult);
      router.push("/report");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start w-full">
      {/* Main Content - Upload Area */}
      <div className="lg:col-span-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-200 mb-2">上传设计稿</h2>
          <p className="text-sm text-slate-400 mb-6">
            支持上传1-9张图片，AI将从多维度进行专家级审查评估。
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative group flex flex-col gap-3 p-3 border border-white/[0.06] rounded-2xl bg-black/20 hover:bg-black/30 transition-colors"
              >
                <div className="aspect-video relative rounded-xl overflow-hidden bg-[#0f172a] group-hover:ring-1 ring-indigo-500/50 transition-all">
                  <img
                    src={img.url}
                    alt="Uploaded design"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-white hover:bg-red-500/90 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={img.stateDesc}
                  onChange={(e) => updateStateDesc(img.id, e.target.value)}
                  placeholder="描述所属状态 (例如: 默认态)"
                  className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>
            ))}

            {images.length < 9 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video flex flex-col items-center justify-center gap-3 border border-dashed border-white/20 rounded-2xl bg-white/[0.02] hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <Upload className="w-5 h-5 opacity-80" />
                </div>
                <span className="text-sm font-medium">点击上传图片</span>
              </button>
            )}
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>

      {/* Sidebar Settings */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-black/20 border border-white/[0.06] rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-slate-200">审查配置</h2>
            <button
              onClick={autoFillAI}
              disabled={isAiLoading}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors border border-indigo-500/20 font-medium cursor-pointer"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI自动推断</span>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-2">
                功能描述 (选填)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：这是一个负一屏快捷操作页面..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none transition-all leading-relaxed"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-400 block mb-2">
                关键目标
              </label>
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => updateGoal(index, e.target.value)}
                        placeholder="请输入具体关键目标..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-8 pr-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => removeGoal(index)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addGoal}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加新目标</span>
                </button>
              </div>
            </div>

            <div className="pt-5 border-t border-white/[0.06]">
              <button
                onClick={startReview}
                disabled={isReviewing}
                className="w-full relative group overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] border border-indigo-500/50 cursor-pointer"
              >
                {isReviewing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>正在深度分析...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5" />
                    <span>确认并开始审查</span>
                  </>
                )}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Compare Tab
   ============================================================ */
function CompareTab() {
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  const [imagesA, setImagesA] = useState<UploadedImage[]>([]);
  const [imagesB, setImagesB] = useState<UploadedImage[]>([]);
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState<string[]>([""]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const handleUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    version: "A" | "B"
  ) => {
    const files = e.target.files;
    if (files) {
      const targetState = version === "A" ? imagesA : imagesB;
      const setter = version === "A" ? setImagesA : setImagesB;
      const newImages = Array.from(files)
        .slice(0, 9 - targetState.length)
        .map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          url: URL.createObjectURL(file),
          stateDesc: "",
          file,
        }));
      setter((prev) => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string, version: "A" | "B") => {
    const setter = version === "A" ? setImagesA : setImagesB;
    setter((prev) => prev.filter((img) => img.id !== id));
  };

  const updateStateDesc = (id: string, val: string, version: "A" | "B") => {
    const setter = version === "A" ? setImagesA : setImagesB;
    setter((prev) =>
      prev.map((img) => (img.id === id ? { ...img, stateDesc: val } : img))
    );
  };

  const addGoal = () => setGoals([...goals, ""]);

  const updateGoal = (index: number, value: string) => {
    const newGoals = [...goals];
    newGoals[index] = value;
    setGoals(newGoals);
  };

  const removeGoal = (index: number) => {
    const newGoals = goals.filter((_, i) => i !== index);
    setGoals(newGoals.length ? newGoals : [""]);
  };

  const autoFillAI = () => {
    if (imagesA.length === 0 && imagesB.length === 0) {
      alert("请先上传设计稿。");
      return;
    }
    setIsAiLoading(true);
    setTimeout(() => {
      setDescription("负一屏快捷操作页面，在深色与浅色模式下的设计方案对比。");
      setGoals([
        "对比深色模式与浅色模式在强光及弱光环境下的视觉可用性",
        "评估两个版本下用户的认知负荷差异",
      ]);
      const autofillImages = (imgs: UploadedImage[]) =>
        imgs.map((img, i) => ({
          ...img,
          stateDesc:
            img.stateDesc || (i === 0 ? "默认状态 (首页展示)" : "交互状态"),
        }));
      setImagesA(autofillImages(imagesA));
      setImagesB(autofillImages(imagesB));
      setIsAiLoading(false);
    }, 1500);
  };

  const startCompare = () => {
    if (imagesA.length === 0 || imagesB.length === 0) {
      alert("请确保版本A和版本B都上传了设计稿进行对比。");
      return;
    }
    setIsComparing(true);
    setTimeout(() => {
      window.location.href = `/compare?task=${Date.now()}`;
    }, 2000);
  };

  const UploadGrid = ({
    version,
    images,
  }: {
    version: "A" | "B";
    images: UploadedImage[];
  }) => (
    <div className="flex-1 space-y-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-white/10 text-slate-200 flex items-center justify-center font-bold text-sm border border-white/5">
            {version}
          </span>
          <span>版本 {version}</span>
        </h3>
        <span className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-slate-400 font-mono border border-white/[0.05]">
          {images.length} / 9
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative group flex flex-col gap-2 p-2.5 border border-white/[0.06] rounded-2xl bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className="aspect-video relative rounded-xl overflow-hidden bg-[#0f172a] group-hover:ring-1 ring-indigo-500/50 transition-all">
              <img
                src={img.url}
                alt={`Version ${version}`}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              />
              <button
                onClick={() => removeImage(img.id, version)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-white hover:bg-red-500/90 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={img.stateDesc}
              onChange={(e) =>
                updateStateDesc(img.id, e.target.value, version)
              }
              placeholder="所属状态 (默认/点击)"
              className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        ))}

        {images.length < 9 && (
          <button
            onClick={() =>
              version === "A"
                ? fileInputRefA.current?.click()
                : fileInputRefB.current?.click()
            }
            className="aspect-video flex flex-col items-center justify-center gap-2 border border-dashed border-white/20 rounded-2xl bg-white/[0.02] hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-all duration-300"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <Upload className="w-4 h-4 opacity-80" />
            </div>
            <span className="text-xs font-medium">点击上传 ({version})</span>
          </button>
        )}
      </div>
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={version === "A" ? fileInputRefA : fileInputRefB}
        onChange={(e) => handleUpload(e, version)}
      />
    </div>
  );

  return (
    <div className="flex flex-col xl:flex-row gap-10 items-stretch w-full">
      {/* Upload Areas */}
      <div className="flex-1 flex flex-col md:flex-row gap-8">
        <UploadGrid version="A" images={imagesA} />
        {/* Divider with VS */}
        <div className="hidden md:flex flex-col items-center justify-center -mx-4 z-10 pt-10">
          <div className="w-12 h-12 rounded-full bg-[#0a0f18] border-2 border-white/10 text-slate-400 font-bold flex items-center justify-center text-sm shadow-xl tracking-wider">
            VS
          </div>
        </div>
        <UploadGrid version="B" images={imagesB} />
      </div>

      {/* Settings */}
      <div className="w-full xl:w-96 shrink-0 space-y-6">
        <div className="bg-black/20 border border-white/[0.06] rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-semibold text-slate-200">对比配置</h2>
            <button
              onClick={autoFillAI}
              disabled={isAiLoading}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors border border-indigo-500/20 font-medium cursor-pointer"
            >
              {isAiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI智能推断</span>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-2">
                共同场景描述 (选填)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：在此版本中主要改变了..."
                className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none transition-all leading-relaxed"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-400 block mb-2">
                对比目标
              </label>
              <div className="space-y-3">
                {goals.map((goal, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => updateGoal(index, e.target.value)}
                        placeholder="请输入对比目标..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-8 pr-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => removeGoal(index)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addGoal}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 border border-dashed border-white/10 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加对比目标</span>
                </button>
              </div>
            </div>

            <div className="pt-5 border-t border-white/[0.06]">
              <button
                onClick={startCompare}
                disabled={isComparing}
                className="w-full relative group overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] border border-indigo-500/50 cursor-pointer"
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>正在深度对比...</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-5 h-5" />
                    <span>确认并对比版本</span>
                  </>
                )}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Mock Data (fallback when API is unavailable)
   ============================================================ */
function generateMockResult() {
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
        description: "部分说明文字使用#8a9aad色值于深色背景上，实测对比度约2.8:1，低于WCAG AA标准的4.5:1要求。",
        suggestion: "将正文文字亮度提升至#c5d0dc以上，确保全区域对比度≥4.5:1。",
      },
      {
        id: "i3", severity: "warning", category: "触控目标过小",
        dimension: "驾驶安全性",
        description: "部分次要操作按钮的触控区域约为36×36dp，低于ISO 15007推荐的48×48dp最小触控面积标准。",
        suggestion: "所有可交互元素的最小触控区域应扩展至48×48dp，核心操作按钮建议64×64dp以上。",
      },
      {
        id: "i4", severity: "info", category: "留白节奏",
        dimension: "美观度",
        description: "卡片内边距存在混用（16px~28px），模块间缺乏统一的呼吸空间规律，整体视觉密度偏高。",
        suggestion: "统一内边距基准为24px，模块间距采用8px栅格倍数（32/48/64px）。",
      },
    ],
  };
}

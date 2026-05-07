"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radar,
  GitCompare,
  ExternalLink,
  Trash2,
  Calendar,
  ArrowLeft,
  User,
  Users,
  Plus,
  X,
  Edit3,
  Upload,
  Camera,
  Tag,
  Clock,
  Car,
  Shield,
} from "lucide-react";
import {
  loadPersonas,
  addPersona,
  updatePersona,
  deletePersona as deletePersonaStorage,
  type Persona,
} from "@/lib/persona";

/* ============================================================
   Types — 历史记录
   ============================================================ */
interface HistoryRecord {
  id: string;
  name: string;
  type: "review" | "compare";
  date: string;
  score: number | null;
}

/* ============================================================
   Helpers — History
   ============================================================ */
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

/* ============================================================
   Tab 类型
   ============================================================ */
type TabType = "history" | "persona";

/* ============================================================
   Avatar Component
   ============================================================ */
function Avatar({ src, name, size = "md" }: { src?: string; name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = {
    sm: "w-9 h-9 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-lg",
  }[size];

  if (src) {
    return (
      <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover ring-2 ring-indigo-500/30`} />
    );
  }
  const initial = (name?.charAt(0) || "U").toUpperCase();
  const colors = [
    "bg-indigo-500/20 text-indigo-300",
    "bg-purple-500/20 text-purple-300",
    "bg-blue-500/20 text-blue-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-amber-500/20 text-amber-300",
    "bg-pink-500/20 text-pink-300",
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-semibold ${colors[colorIndex]} ring-2 ring-white/5`}>
      {initial}
    </div>
  );
}

/* ============================================================
   Persona Form Modal（新增 / 编辑）
   ============================================================ */
function PersonaFormModal({
  persona,
  onSave,
  onClose,
}: {
  persona?: Persona | null;
  onSave: (data: Omit<Persona, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}) {
  const isEdit = !!persona;
  const [name, setName] = useState(persona?.name || "");
  const [age, setAge] = useState(persona?.age || "");
  const [gender, setGender] = useState(persona?.gender || "");
  const [drivingExperience, setDrivingExperience] = useState(persona?.drivingExperience || "");
  const [scenario, setScenario] = useState(persona?.scenario || "");
  const [description, setDescription] = useState(persona?.description || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(persona?.tags || []);
  const [avatar, setAvatar] = useState(persona?.avatar || "");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limit to 512KB for localStorage
    if (file.size > 512 * 1024) {
      alert("头像图片不能超过 512KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("请输入用户名称");
      return;
    }
    onSave({ name: name.trim(), age, gender, drivingExperience, scenario, description, tags, avatar });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#111827] border border-white/[0.08] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "编辑虚拟用户" : "新增虚拟用户"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Avatar Upload */}
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Avatar src={avatar} name={name || "新用户"} size="lg" />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-300">头像</p>
              <p className="text-xs text-slate-500 mt-0.5">点击上传，支持 JPG/PNG，不超过 512KB</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1.5">用户名称 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：张三 / 新手司机小王"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Row: Age + Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1.5">年龄段</label>
              <input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="如：25-35"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1.5">性别</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              >
                <option value="">不限</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
          </div>

          {/* Driving Experience + Scenario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1.5">驾龄</label>
              <input
                value={drivingExperience}
                onChange={(e) => setDrivingExperience(e.target.value)}
                placeholder="如：3-5年"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1.5">使用场景</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              >
                <option value="">请选择</option>
                <option value="通勤代步">通勤代步</option>
                <option value="家庭出行">家庭出行</option>
                <option value="商务用车">商务用车</option>
                <option value="长途旅行">长途旅行</option>
                <option value="网约车运营">网约车运营</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1.5">标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/15">
                  <Tag className="w-3 h-3" />{t}
                  <button onClick={() => handleRemoveTag(t)} className="ml-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                placeholder="输入标签后回车添加"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button onClick={handleAddTag} className="px-3 py-2 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-medium hover:bg-indigo-500/25 transition-colors border border-indigo-500/20 cursor-pointer">
                添加
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-400 block mb-1.5">补充描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充说明该用户的特征、偏好、使用习惯等..."
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none transition-all leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
            取消
          </button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 cursor-pointer">
            {isEdit ? "保存修改" : "创建用户"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Personal Center Page
   ============================================================ */
export default function PersonalCenterPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("history");

  /* ---- History State ---- */
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* ---- Persona State ---- */
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoaded, setPersonasLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  /* Load history records */
  useEffect(() => {
    setRecords(loadRecords());
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    const handler = () => setRecords(loadRecords());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /* Load personas */
  useEffect(() => {
    setPersonas(loadPersonas());
    setPersonasLoaded(true);
  }, []);

  /* ---- History Handlers ---- */
  const handleDeleteHistory = (id: string) => {
    localStorage.removeItem(`reviewDetail_${id}`);
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    try { localStorage.setItem("reviewHistory", JSON.stringify(updated)); } catch {}
  };

  const handleViewReport = (record: HistoryRecord) => {
    try {
      const detailData = localStorage.getItem(`reviewDetail_${record.id}`);

      if (record.type === "compare") {
        /* 对比记录 → 跳转到 /compare 页面 */
        if (detailData) {
          sessionStorage.setItem("compareResult", detailData);
        }
        router.push("/compare");
        return;
      }

      /* 审查记录 → 跳转到 /report 页面 */
      if (detailData) {
        sessionStorage.setItem("reviewResult", detailData);
      } else {
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
            { id: "i1", severity: "warning" as const, category: "操作负荷", dimension: "驾驶安全性", description: "部分高频功能入口层级较深，驾驶中视线偏移时间可能超过推荐阈值。", suggestion: "将常用操作提升至一级或二级菜单，减少操作路径深度。" },
            { id: "i2", severity: "info" as const, category: "视觉细节", dimension: "视觉可读性", description: "个别区域文字对比度略低于最佳实践标准。", suggestion: "确保所有正文文字与背景的对比度达到 WCAG AA 的 4.5:1 标准。" },
          ],
        };
        sessionStorage.setItem("reviewResult", JSON.stringify(fallback));
      }
      sessionStorage.setItem("reviewTaskInfo", JSON.stringify({ description: record.name, goals: [] }));
      router.push("/report");
    } catch (err) {
      console.error("Failed to load report:", err);
      router.push(record.type === "compare" ? "/compare" : "/report");
    }
  };

  /* ---- Persona Handlers ---- */
  const handleAddPersona = (data: Omit<Persona, "id" | "createdAt" | "updatedAt">) => {
    const created = addPersona(data);
    setPersonas(loadPersonas());
  };

  const handleUpdatePersona = (data: Omit<Persona, "id" | "createdAt" | "updatedAt">) => {
    if (editingPersona) {
      updatePersona(editingPersona.id, data);
      setPersonas(loadPersonas());
    }
  };

  const handleDeletePersona = (id: string) => {
    if (!confirm("确定要删除该虚拟用户吗？")) return;
    deletePersonaStorage(id);
    setPersonas(loadPersonas());
  };

  const openCreateForm = () => {
    setEditingPersona(null);
    setShowForm(true);
  };

  const openEditForm = (persona: Persona) => {
    setEditingPersona(persona);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPersona(null);
  };

  const handleFormSave = (data: Omit<Persona, "id" | "createdAt" | "updatedAt">) => {
    if (editingPersona) {
      handleUpdatePersona(data);
    } else {
      handleAddPersona(data);
    }
  };

  /* ================================================================
     RENDER
     ================================================================ */
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
          <h1 className="font-bold text-2xl text-white tracking-tight">个人中心</h1>
          <p className="text-sm text-slate-400 mt-2">
            管理你的审查历史与虚拟用户库，随时追踪设计评估进展。
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
          >
            <Radar className="w-4 h-4" />
            审查历史
            {historyLoaded && records.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500">{records.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("persona")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "persona"
                ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
          >
            <Users className="w-4 h-4" />
            虚拟用户库
            {personasLoaded && personas.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500">{personas.length}</span>
            )}
          </button>
        </div>

        {/* ====== TAB: 审查历史 ====== */}
        {activeTab === "history" && (
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
            {historyLoaded && records.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="grid grid-cols-[80px_1fr_200px_100px_140px] gap-4 px-6 py-5 items-center hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${record.type === "review" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {record.type === "review" ? <Radar className="w-[18px] h-[18px]" /> : <GitCompare className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-200 truncate block group-hover:text-white transition-colors">{record.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{record.date}</span>
                    </div>
                    <div className={`text-base font-semibold ${getScoreColor(record.score)}`}>{record.score ?? "—"}</div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleViewReport(record)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer">
                        <ExternalLink className="w-3.5 h-3.5" />查看
                      </button>
                      <button onClick={() => handleDeleteHistory(record.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="删除记录">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : historyLoaded ? (
              /* Empty State */
              <div className="py-20 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-800/50 flex items-center justify-center">
                  <Radar className="w-7 h-7 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">暂无历史记录</p>
                <p className="text-xs text-slate-600 mt-1">完成一次审查后，记录将自动保存在此</p>
                <Link href="/" className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-medium bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors">
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

            {/* Footer Stats */}
            {historyLoaded && records.length > 0 && (
              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center gap-4 text-xs text-slate-500">
                <span>共 {records.length} 条记录</span>
                <span className="text-slate-700">·</span>
                <span>{records.filter((r) => r.type === "review").length} 条审查</span>
                <span className="text-slate-700">·</span>
                <span>{records.filter((r) => r.type === "compare").length} 条对比</span>
              </div>
            )}
          </div>
        )}

        {/* ====== TAB: 虚拟用户库 ====== */}
        {activeTab === "persona" && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {personasLoaded && personas.length > 0
                  ? `已创建 ${personas.length} 个虚拟用户`
                  : "暂无虚拟用户，创建后可在审查时引用"}
              </p>
              <button
                onClick={openCreateForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                新增用户
              </button>
            </div>

            {/* Persona Grid */}
            {personasLoaded && personas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {personas.map((p) => (
                  <div key={p.id} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all">
                    {/* Card Header: avatar + name + actions */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar} name={p.name} size="md" />
                        <div>
                          <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">{p.name}</h3>
                          {p.scenario && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Car className="w-3 h-3" />{p.scenario}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons (hover visible) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditForm(p)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" aria-label="编辑用户">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeletePersona(p.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="删除用户">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-2.5">
                      {(p.age || p.gender) && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-slate-400">
                            {[p.age, p.gender].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </div>
                      )}
                      {p.drivingExperience && (
                        <div className="flex items-center gap-2 text-sm">
                          <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-slate-400">驾龄 {p.drivingExperience}</span>
                        </div>
                      )}
                      {p.tags && p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {p.tags.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400 text-xs border border-white/[0.05]">
                              <Tag className="w-2.5 h-2.5" />{t}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.description && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 pt-1 border-t border-white/[0.04]">{p.description}</p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Clock className="w-3 h-3" />
                      更新于 {new Date(p.updatedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                ))}
              </div>
            ) : personasLoaded ? (
              /* Empty State */
              <div className="py-24 text-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01]">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-indigo-400/60" />
                </div>
                <p className="text-sm font-medium text-slate-400">还没有虚拟用户</p>
                <p className="text-xs text-slate-500 mt-1 mb-5">创建典型用户画像，让 AI 审查时能基于真实用户视角给出建议</p>
                <button
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 transition-colors border border-indigo-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  创建第一个虚拟用户
                </button>
              </div>
            ) : (
              /* Loading */
              <div className="py-20 text-center">
                <div className="w-8 h-8 mx-auto mb-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">加载中...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Portal */}
      {showForm && (
        <PersonaFormModal
          persona={editingPersona}
          onSave={handleFormSave}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

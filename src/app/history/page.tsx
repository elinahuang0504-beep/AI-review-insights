"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  deletePersonaStorage,
  batchAddPersonas,
  type Persona,
  type Gender,
  type DrivingExperience,
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
    onSave({ name: name.trim(), age: age ? Number(age) : undefined, gender: gender as Gender, drivingExperience: drivingExperience as DrivingExperience, scenario, description, tags, avatar });
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

  /* ---- Persona Search & Filter (PRD v1.1) ---- */
  const [personaSearch, setPersonaSearch] = useState("");
  const [personaActiveFilter, setPersonaActiveFilter] = useState<string>("all");

  // Dynamic filter tags from all personas
  const personaFilterTags = (() => {
    const tagSet = new Set<string>();
    for (const p of personas) {
      if (p.customTags) p.customTags.forEach((t) => tagSet.add(t));
      if (p.techAffinity) tagSet.add(p.techAffinity);
    }
    return Array.from(tagSet).slice(0, 8); // Limit to 8 tags
  })();

  // Filtered personas
  const filteredPersonas = useMemo(() => {
    let result = personas;
    // Text search
    if (personaSearch.trim()) {
      const q = personaSearch.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.customTags?.some((t) => t.toLowerCase().includes(q)) ||
        p.occupation?.toLowerCase().includes(q) ||
        p.narrative?.toLowerCase().includes(q)
      );
    }
    // Tag filter
    if (personaActiveFilter !== "all") {
      result = result.filter((p) =>
        p.customTags?.includes(personaActiveFilter) || p.techAffinity === personaActiveFilter
      );
    }
    return result;
  }, [personas, personaSearch, personaActiveFilter]);

  /* ---- Batch Import ---- */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openBatchImport = () => {
    fileInputRef.current?.click();
  };

  const handleBatchImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("文件大小不能超过 5MB");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      let importedData: Array<Record<string, unknown>> = [];

      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        // Use xlsx-like parsing for CSV/Excel
        importedData = await parseSpreadsheetFile(file);
      } else if (ext === "docx") {
        // Word document - for now show a message that mammoth is needed
        alert("Word 文档解析需要安装额外依赖，建议使用 Excel 或 CSV 格式导入。");
        return;
      } else {
        alert("不支持的文件格式，请使用 .xlsx / .xls / .csv 文件");
        return;
      }

      if (importedData.length > 0) {
        const mapped = importedData.map((row: Record<string, unknown>) => ({
          name: String(row["姓名"] || row["name"] || ""),
          age: row["年龄"] ? Number(row["年龄"]) : undefined,
          gender: (row["性别"] as string) || undefined,
          occupation: (row["职业"] || row["occupation"] as string) || undefined,
          cityTier: (row["城市级别"] || row["city_tier"] as string) || undefined,
          drivingExperience: (row["驾龄"] || row["driving_experience"] as string) || undefined,
          carOwnership: (row["购车经历"] || row["car_ownership"] as string) || undefined,
          incomeLevel: (row["收入水平"] || row["income_level"] as string) || undefined,
          familyStatus: (row["家庭状况"] || row["family_status"] as string) || undefined,
          techAffinity: (row["科技偏好"] || row["tech_affinity"] as string) || undefined,
          uiComplexityPref: (row["界面偏好"] || row["ui_complexity_pref"] as string) || undefined,
          safetyPriority: (row["安全重视度"] || row["safety_priority"] as string) || undefined,
          learningWillingness: (row["学习意愿"] || row["learning_willingness"] as string) || undefined,
          distractionTolerance: (row["干扰容忍度"] || row["distraction_tolerance"] as string) || undefined,
          brandLoyalty: (row["品牌忠诚度"] || row["brand_loyalty"] as string) || undefined,
          customTags: typeof row["自定义标签"] === "string"
            ? (row["自定义标签"] as string).split(",").map((s) => s.trim()).filter(Boolean)
            : Array.isArray(row["custom_tags"])
              ? row["custom_tags"].map(String)
              : [],
          drivingScenario: typeof row["用车场景"] === "string"
            ? (row["用车场景"] as string).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          featurePriority: typeof row["高频功能"] === "string"
            ? (row["高频功能"] as string).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          accessibilityNeeds: typeof row["特殊需求"] === "string"
            ? (row["特殊需求"] as string).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          narrative: (row["画像描述"] || row["narrative"] as string) || "",
        }));

        const { success } = batchAddPersonas(mapped.filter((d) => d.name) as Omit<Persona, "id" | "createdAt" | "updatedAt">[]);
        setPersonas(loadPersonas());
        alert(`导入完成：成功 ${success} 条${mapped.length !== success ? `，失败 ${mapped.length - success} 条` : ""}`);
      }
    } catch (err) {
      console.error("Batch import error:", err);
      alert("导入失败：" + (err instanceof Error ? err.message : "未知错误"));
    }

    // Reset file input
    e.target.value = "";
  };

  /** Simple CSV parser */
  async function parseSpreadsheetFile(file: File): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { resolve([]); return; }

        // Parse header
        const headers = lines[0].split(/[,\t]/).map((h) => h.trim());

        // Map Chinese column names to field keys
        const headerMap: Record<string, string> = {};
        headers.forEach((h) => {
          const keyMap: Record<string, string> = {
            "姓名": "name", "名称": "name", "name": "name",
            "年龄": "age", "age": "age",
            "性别": "gender", "gender": "gender",
            "收入水平": "income_level", "income_level": "income_level",
            "家庭状况": "family_status", "family_status": "family_status",
            "职业": "occupation", "occupation": "occupation",
            "城市级别": "city_tier", "city_tier": "city_tier",
            "驾龄": "driving_experience", "driving_experience": "driving_experience",
            "购车经历": "car_ownership", "car_ownership": "car_ownership",
            "科技偏好": "tech_affinity", "tech_affinity": "tech_affinity",
            "界面偏好": "ui_complexity_pref", "ui_complexity_pref": "ui_complexity_pref",
            "安全重视度": "safety_priority", "safety_priority": "safety_priority",
            "用车场景": "driving_scenario", "driving_scenario": "driving_scenario",
            "高频功能": "feature_priority", "feature_priority": "feature_priority",
            "学习意愿": "learning_willingness", "learning_willingness": "learning_willingness",
            "干扰容忍度": "distraction_tolerance", "distraction_tolerance": "distraction_tolerance",
            "特殊需求": "accessibility_needs", "accessibility_needs": "accessibility_needs",
            "品牌忠诚度": "brand_loyalty", "brand_loyalty": "brand_loyalty",
            "自定义标签": "custom_tags", "custom_tags": "custom_tags",
            "画像描述": "narrative", "narrative": "narrative",
          };
          headerMap[h] = keyMap[h] || h;
        });

        // Parse data rows
        const rows = lines.slice(1).map((line) => {
          const values = line.split(/[,\t]/);
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            obj[headerMap[h]] = values[i]?.trim() || "";
          });
          return obj;
        });

        resolve(rows.filter((r) => r.name || r[headerMap["name"]]));
      };
      reader.readAsText(file);
    });
  }

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
            {/* Toolbar: 搜索 + 批量导入 + 新增 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 搜索框 */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input
                  type="text"
                  value={personaSearch || ""}
                  onChange={(e) => setPersonaSearch(e.target.value)}
                  placeholder="按名称/标签搜索车主..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              {/* 批量导入按钮 */}
              <button onClick={openBatchImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 cursor-pointer">
                <Upload className="w-4 h-4" />
                批量导入
              </button>
              {/* 新增按钮 */}
              <button onClick={openCreateForm} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />
                新增车主
              </button>
              <p className="text-xs text-slate-500 ml-auto self-end">
                {personasLoaded && personas.length > 0 ? `共 ${personas.length} 位车主` : "暂无数据"}
              </p>
            </div>

            {/* 筛选标签 */}
            {personaFilterTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPersonaActiveFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                    personaActiveFilter === "all"
                      ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                      : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.06]"
                  }`}
                >
                  全部
                </button>
                {personaFilterTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setPersonaActiveFilter(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                      personaActiveFilter === tag
                        ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                        : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.06]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Persona Card Grid */}
            {personasLoaded && filteredPersonas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredPersonas.map((p) => (
                  <div key={p.id} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all cursor-default">
                    {/* Card Header: avatar + name + tags + actions */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={p.avatar} name={p.name} size="sm" />
                        <div>
                          <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">{p.name}</h3>
                          {p.customTags && p.customTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.customTags.slice(0, 2).map((t) => (
                                <span key={t} className="px-1.5 py-px rounded bg-indigo-500/10 text-[10px] text-indigo-400">{t}</span>
                              ))}
                              {p.customTags.length > 2 && <span className="px-1.5 py-px rounded bg-white/5 text-[10px] text-slate-500">+{p.customTags.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditForm(p)} className="p-1.5 rounded text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" aria-label="编辑"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeletePersona(p.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {/* Key Features Row */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 mb-2">
                      {p.age && <span>{p.age}岁</span>}
                      {p.age && p.gender && <span className="text-slate-700">·</span>}
                      {p.gender && <span>{p.gender}</span>}
                      {(p.age || p.gender) && p.drivingExperience && <span className="text-slate-700">·</span>}
                      {p.drivingExperience && <span>{p.drivingExperience}</span>}
                      {p.cityTier && <span className="ml-auto">{p.cityTier}</span>}
                    </div>

                    {/* Behavior Preference Summary */}
                    {(() => {
                      const prefs = [p.techAffinity, p.safetyPriority === "极高" ? "安全优先" : "", p.uiComplexityPref].filter(Boolean);
                      return prefs.length > 0 ? (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">{prefs.join(" · ")}</p>
                      ) : null;
                    })()}

                    {/* Timestamp */}
                    <div className="mt-3 pt-2 border-t border-white/[0.03] flex items-center justify-between text-[10px] text-slate-600">
                      <Clock className="w-3 h-3" />
                      {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
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

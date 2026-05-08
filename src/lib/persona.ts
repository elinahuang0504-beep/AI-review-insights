/* ============================================================
   Virtual User Library — 虚拟车主用户库数据模型与持久化工具
   PRD v1.1 迭代：完整 Demographics + Preferences + Narrative
   ============================================================ */

/* ---- 枚举类型定义 ---- */
export type Gender = "男" | "女" | "未指定";
export type IncomeLevel = "低收入" | "中等收入" | "高收入" | "未指定";
export type FamilyStatus = "单身" | "已婚无孩" | "已婚有孩" | "三代同堂";
export type CityTier = "一线城市" | "二线城市" | "三线城市" | "其他";
export type DrivingExperience = "<1年" | "1-3年" | "3-5年" | "5-10年" | ">10年";
export type CarOwnership = "首购" | "增购" | "换购";

// ---- 行为偏好枚举 ----
export type TechAffinity = "传统保守" | "适度尝试" | "科技先锋";
export type UIPreference = "简洁直观" | "功能丰富" | "高度定制";
export type SafetyPriority = "一般" | "较高" | "极高";
export type LearningWillingness = "低" | "中" | "高";
export type DistractionTolerance = "低" | "中" | "高";
export type BrandLoyalty = "低" | "中" | "高";

export type DrivingScenario = "城市通勤" | "长途高速" | "周末自驾" | "商务出行" | "家庭接送";
export type FeaturePriority = "导航" | "音乐" | "空调" | "电话" | "车辆设置" | "辅助驾驶";
export type AccessibilityNeed = "大字体偏好" | "高对比度需求" | "语音交互偏好" | "无特殊需求";

/** 单个虚拟车主完整档案 */
export interface Persona {
  id: string;

  /* ===== 基本特征 (Demographics) ===== */
  name: string;                    // 称呼（必填），如"王先生"
  avatar?: string;                 // 头像 URL 或 base64
  age?: number;                    // 年龄
  gender?: Gender;
  incomeLevel?: IncomeLevel;
  familyStatus?: FamilyStatus;
  occupation?: string;             // 职业，如"IT工程师"
  cityTier?: CityTier;
  drivingExperience?: DrivingExperience;
  carOwnership?: CarOwnership;

  /* ===== 行为偏好 (Preferences) ===== */
  techAffinity?: TechAffinity;     // 科技偏好
  uiComplexityPref?: UIPreference; // 界面复杂度偏好
  safetyPriority?: SafetyPriority;  // 安全重视程度
  drivingScenario?: DrivingScenario[];    // 用车场景（多选）
  featurePriority?: FeaturePriority[];    // 高频使用功能（多选）
  learningWillingness?: LearningWillingness;
  distractionTolerance?: DistractionTolerance;
  accessibilityNeeds?: AccessibilityNeed[]; // 特殊需求（多选）
  brandLoyalty?: BrandLoyalty;
  customTags?: string[];           // 自定义标签

  /* ===== 画像描述 (Narrative) ===== */
  narrative?: string;              // AI生成/管理员撰写的自然语言描述

  /* ===== 元数据 ===== */
  createdAt: string;
  updatedAt: string;
}

/* ============================================================
   用户评测结果数据模型
   ============================================================ */

/** 单个目标达成率 */
export interface GoalAchievement {
  goalId: string;
  goalText: string;                // 关键目标文本
  personaName: string;             // 评测的虚拟车主名称
  score: number;                   // 达成率 1-10分
  satisfaction: number;            // 满意度预估 1-10
  reasoning: string;               // 推理过程
  painPoints: string[];            // 痛点列表
  suggestions: string[];           // 改进建议
}

/** 单个虚拟车主的完整评测结果 */
export interface PersonaEvaluationResult {
  personaId: string;
  personaName: string;
  personaNarrative: string;        // 角色扮演用的画像描述
  goals: GoalAchievement[];
  overallScore: number;            // 该车主综合达成率
  summary: string;                 // 该车主的总体评价
}

/** 用户评测汇总结果 */
export interface UserEvaluationSummary {
  enabled: boolean;
  sampleSize: number;               // 抽样数量
  overallAverageScore: number;      // 所有目标的平均达成率
  consistencyLevel: "high" | "medium" | "low"; // 一致性等级
  consistencyVariance: number;      // 方差值
  perGoalScores: {                  // 每个目标的平均得分
    goalText: string;
    averageScore: number;
    minScore: number;
    maxScore: number;
  }[];
  personas: PersonaEvaluationResult[];
  recommendation: string;           // 综合推荐结论
}

const STORAGE_KEY = "virtualUserLibrary";

/* ---- CRUD 操作 ---- */

/** 获取全部用户 */
export function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 新增用户 */
export function addPersona(data: Omit<Persona, "id" | "createdAt" | "updatedAt">): Persona {
  const personas = loadPersonas();
  const now = new Date().toISOString();
  const persona: Persona = {
    ...data,
    id: `persona_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  personas.unshift(persona);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
  return persona;
}

/** 更新用户 */
export function updatePersona(id: string, patch: Partial<Omit<Persona, "id" | "createdAt">>): Persona | null {
  const personas = loadPersonas();
  const idx = personas.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  personas[idx] = { ...personas[idx], ...patch, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
  return personas[idx];
}

/** 删除用户 */
export function deletePersonaStorage(id: string): boolean {
  const personas = loadPersonas();
  const filtered = personas.filter((p) => p.id !== id);
  if (filtered.length === personas.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/** 根据 ID 获取单个用户 */
export function getPersonaById(id: string): Persona | null {
  return loadPersonas().find((p) => p.id === id) ?? null;
}

/* ---- 批量导入 ---- */

/** 批量添加用户（用于导入） */
export function batchAddPersonas(dataList: Omit<Persona, "id" | "createdAt" | "updatedAt">[]): { success: number; failed: number } {
  let success = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const data of dataList) {
    try {
      if (!data.name || !data.name.trim()) { failed++; continue; }
      const persona: Persona = {
        ...data,
        id: `persona_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${success}`,
        createdAt: now,
        updatedAt: now,
      };
      const personas = loadPersonas();
      personas.unshift(persona);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personas));
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

/** 获取所有自定义标签（用于筛选标签动态生成） */
export function getAllCustomTags(): string[] {
  const personas = loadPersonas();
  const tagSet = new Set<string>();
  for (const p of personas) {
    if (p.customTags) p.customTags.forEach((t) => tagSet.add(t));
  }
  return Array.from(tagSet);
}

/** 随机抽样 N 个用户（用于评测） */
export function samplePersonas(count: number): Persona[] {
  const all = loadPersonas();
  if (all.length <= count) return [...all];
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ---- 选项常量表（供UI组件使用） ---- */
export const GENDER_OPTIONS: Gender[] = ["男", "女", "未指定"];
export const INCOME_OPTIONS: IncomeLevel[] = ["低收入", "中等收入", "高收入", "未指定"];
export const FAMILY_OPTIONS: FamilyStatus[] = ["单身", "已婚无孩", "已婚有孩", "三代同堂"];
export const CITY_TIER_OPTIONS: CityTier[] = ["一线城市", "二线城市", "三线城市", "其他"];
export const DRIVING_EXP_OPTIONS: DrivingExperience[] = ["<1年", "1-3年", "3-5年", "5-10年", ">10年"];
export const CAR_OWNERSHIP_OPTIONS: CarOwnership[] = ["首购", "增购", "换购"];

export const TECH_AFFINITY_OPTIONS: TechAffinity[] = ["传统保守", "适度尝试", "科技先锋"];
export const UI_PREF_OPTIONS: UIPreference[] = ["简洁直观", "功能丰富", "高度定制"];
export const SAFETY_PRIORITY_OPTIONS: SafetyPriority[] = ["一般", "较高", "极高"];
export const LEARNING_OPTIONS: LearningWillingness[] = ["低", "中", "高"];
export const DISTRACTION_OPTIONS: DistractionTolerance[] = ["低", "中", "高"];
export const BRAND_LOYALTY_OPTIONS: BrandLoyalty[] = ["低", "中", "高"];

export const SCENARIO_OPTIONS: DrivingScenario[] = ["城市通勤", "长途高速", "周末自驾", "商务出行", "家庭接送"];
export const FEATURE_OPTIONS: FeaturePriority[] = ["导航", "音乐", "空调", "电话", "车辆设置", "辅助驾驶"];
export const ACCESSIBILITY_OPTIONS: AccessibilityNeed[] = ["大字体偏好", "高对比度需求", "语音交互偏好", "无特殊需求"];

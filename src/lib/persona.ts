/* ============================================================
   Virtual User Library — 虚拟用户库数据模型与持久化工具
   ============================================================ */

/** 单个虚拟用户档案 */
export interface Persona {
  id: string;
  name: string;                 // 用户名称 / 角色名
  avatar?: string;              // 头像 base64 或 URL
  age?: string;                 // 年龄段，如 "25-35"
  gender?: string;              // 性别
  drivingExperience?: string;   // 驾龄，如 "3-5年"
  scenario?: string;            // 主要使用场景，如 "通勤代步"
  description?: string;         // 补充描述
  tags?: string[];              // 标签，如 ["新手司机","科技爱好者"]
  createdAt: string;            // 创建时间 ISO
  updatedAt: string;            // 更新时间 ISO
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
  personas.unshift(persona); // 最新在前
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
export function deletePersona(id: string): boolean {
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

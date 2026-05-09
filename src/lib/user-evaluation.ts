/* ============================================================
   用户评测 AI 分析引擎
   PRD v1.1: 以虚拟车主视角模拟用户完成设计任务并评估达成率
   ============================================================ */

import type { Persona, PersonaEvaluationResult, UserEvaluationSummary, GoalAchievement } from "./persona";
import { loadPersonas } from "./persona";

// Re-export types for downstream consumers (compare/page, report/page)
export type { UserEvaluationSummary };

/**
 * 运行完整的用户评测流程（客户端版本）
 * 通过 /api/user-eval 服务端路由调用 AI，避免暴露 API Key
 *
 * @param taskInfo 任务信息（从页面传入）
 * @param goals 关键目标列表
 * @param sampleSize 采样车主数量
 * @param images 设计稿截图（base64 + 名称），用于AI评测
 * @returns UserEvaluationSummary（始终返回对象，通过 enabled/errorMessage 区分状态）
 */
export async function runUserEvaluations(
  taskInfo: { taskName: string; description: string; goals: string[] },
  goals: string[],
  sampleSize: number,
  images?: { data: string; name: string }[],
): Promise<UserEvaluationSummary> {
  // 从 localStorage 读取车主库数据传给服务端
  const rawPersonas = (() => {
    try {
      return JSON.parse(localStorage.getItem("virtualUserLibrary") || "[]");
    } catch {
      return [];
    }
  })();

  if (!Array.isArray(rawPersonas) || rawPersonas.length === 0) {
    console.warn("[runUserEvaluations] 没有可用的虚拟车主数据。请先在「个人中心→虚拟用户库」中添加车主。");
    return {
      enabled: false,
      sampleSize,
      overallAverageScore: 0,
      consistencyLevel: "low",
      consistencyVariance: 0,
      perGoalScores: [],
      personas: [],
      recommendation: "",
      errorMessage: "虚拟用户库为空：请在「个人中心→虚拟用户库」中至少添加1位虚拟车主后再启用用户评测。",
    };
  }

  try {
    const response = await fetch("/api/user-eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personas: rawPersonas,
        taskInfo,
        goals,
        sampleSize,
        images,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`用户评测API错误 (${response.status}): ${errorBody}`);
    }

    const json = await response.json();
    if (json.success && json.data) return json.data;

    // API 返回 success:false
    return {
      enabled: false,
      sampleSize,
      overallAverageScore: 0,
      consistencyLevel: "low",
      consistencyVariance: 0,
      perGoalScores: [],
      personas: [],
      recommendation: "",
      errorMessage: json.error || "所有车主的评测均失败，请稍后重试。",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[runUserEvaluations] 用户评测失败:", errMsg);
    return {
      enabled: false,
      sampleSize,
      overallAverageScore: 0,
      consistencyLevel: "low",
      consistencyVariance: 0,
      perGoalScores: [],
      personas: [],
      recommendation: "",
      errorMessage: `评测异常: ${errMsg}`,
    };
  }
}

/**
 * 生成单个虚拟车主的用户评测 Prompt
 * @param persona 虚拟车主画像
 * @param designDescription 设计稿描述/任务描述
 * @param goals 关键目标列表
 * @param imagesBase64 设计截图（base64列表）
 */
export function buildUserEvalPrompt(
  persona: Persona,
  designDescription: string,
  goals: string[],
  imageCount: number,
): string {
  const narrative = persona.narrative || buildNarrativeFromPersona(persona);
  const goalList = goals.map((g, i) => `${i + 1}. ${g}`).join("\n");

  return `你是一位专业的 HMI（车载人机界面）用户体验研究员。现在需要你以一位**特定虚拟车主**的身份，对给定的车载HMI设计方案进行模拟使用评测。

---

## 你的角色设定

${narrative}

## 你的核心行为特征

- 科技偏好：${persona.techAffinity ?? "适度尝试"}
- 界面偏好：${persona.uiComplexityPref ?? "简洁直观"}
- 安全重视度：${persona.safetyPriority ?? "较高"}
- 学习新功能意愿：${persona.learningWillingness ?? "中"}
- 界面干扰容忍度：${persona.distractionTolerance ?? "中"}
- 品牌忠诚度：${persona.brandLoyalty ?? "中"}
- 高频使用功能：${persona.featurePriority?.join("、") || "导航、音乐、空调"}
${persona.accessibilityNeeds && persona.accessibilityNeeds.length > 0 && !persona.accessibilityNeeds.includes("无特殊需求") ? `- 特殊需求：${persona.accessibilityNeeds.join("、")}` : ""}

## 待评测的设计方案

**任务名称**：${designDescription}
**关键目标**：
${goalList}
**截图数量**：${imageCount} 张

---

请按照以下步骤进行评测：

### 步骤 1：角色代入
以上述虚拟车主的身份，设身处地想象自己坐在驾驶座上，面对这个HMI界面。

### 步骤 2：逐目标模拟操作
对每个关键目标，模拟你作为该车主尝试完成任务的完整过程：
- 你会如何找到入口？
- 操作路径是否直觉友好？
- 是否存在让你困惑或分心的元素？
- 考虑你的年龄(${persona.age ?? "?"}岁)、驾龄(${persona.drivingExperience ?? "?"})、科技接受度和安全重视度

### 步骤 3：评分
对每个目标给出：
1. **达成率 (1-10分)**：我能否顺利完成任务？10=完美达成，1=完全无法完成
2. **满意度预估 (1-10分)**：如果我成功完成了这个目标，我的满意程度？

### 步骤 4：考虑特殊需求
考虑该车主的特殊需求（如大字体、语音偏好、家庭场景等）对体验的影响。

---

## 输出格式（严格 JSON）

请输出以下 JSON 格式（不要包含其他文字）：

\`\`\`json
{
  "goals": [
    {
      "goalText": "目标原文",
      "score": 达成率(1-10的数字),
      "satisfaction": 满意度(1-10的数字),
      "reasoning": "推理过程，说明为什么给出该分数，结合车主画像特征",
      "painPoints": ["痛点1", "痛点2"],
      "suggestions": ["改进建议1", "改进建议2"]
    }
  ],
  "overallScore": 所有目标的平均达成率(保留1位小数),
  "summary": "2-3句话总结该车主对这个设计的总体评价，体现其独特视角"
}
\`\`\`

**重要**：
- 评分要真实反映该车主类型的视角，不同车主应有差异化评价
- 推理过程必须结合车主的具体画像特征
- 如果某个目标对该车主特别重要（如安全类目标对"安全重视度极高"的车主），应在reasoning中强调`;
}

/** 从 Persona 字段自动生成 narrative（用于 AI 辅助生成） */
export function buildNarrativeFromPersona(p: Persona): string {
  const parts = [
    p.name || "某车主",
    p.age ? `${p.age}岁` : "",
    p.occupation ? `${p.occupation}` : "",
    p.cityTier ? `居住在${p.cityTier}` : "",
    p.familyStatus ? `家庭状况：${p.familyStatus}` : "",
    p.drivingExperience ? `驾龄${p.drivingExperience}` : "",
    p.carOwnership ? `购车经历：${p.carOwnership}车主` : "",
  ].filter(Boolean);

  const prefParts = [
    p.techAffinity ? `对科技产品${p.techAffinity === "传统保守" ? "较为保守，喜欢熟悉的功能" : p.techAffinity === "科技先锋" ? "是科技先锋，喜欢尝试新功能" : "愿意适度尝试新功能"}` : "",
    p.uiComplexityPref ? `偏好${p.uiComplexityPref === "简洁直观" ? "简洁直观的界面，反感复杂菜单" : p.uiComplexityPref === "功能丰富" ? "功能丰富的界面，愿意探索高级选项" : "高度可定制的界面"}` : "",
    p.safetyPriority ? `${p.safetyPriority === "极高" ? "极度" : p.safetyPriority === "较高" ? "非常" : ""}重视驾驶安全` : "",
    p.drivingScenario?.length ? `主要用车场景：${p.drivingScenario.join("、")}` : "",
    p.featurePriority?.length ? `高频使用功能：${p.featurePriority.join("、")}` : "",
  ].filter(Boolean);

  return `${parts.join("，")}。${prefParts.length > 0 ? prefParts.join("。") + "。" : ""}`;
}

/**
 * 解析 AI 返回的 JSON 评测结果
 */
export function parseUserEvalResponse(raw: string, persona: Persona): PersonaEvaluationResult | null {
  try {
    // 尝试提取 JSON
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/) || jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    jsonStr = jsonMatch[1] || jsonMatch[0];

    const data = JSON.parse(jsonStr);
    const goals: GoalAchievement[] = (data.goals || []).map((g: Record<string, unknown>) => ({
      goalId: `goal_${Math.random().toString(36).slice(2, 8)}`,
      goalText: String(g.goalText || ""),
      personaName: persona.name,
      score: Number(g.score) || 5,
      satisfaction: Number(g.satisfaction) || 5,
      reasoning: String(g.reasoning || ""),
      painPoints: Array.isArray(g.painPoints) ? g.painPoints.map(String) : [],
      suggestions: Array.isArray(g.suggestions) ? g.suggestions.map(String) : [],
    }));

    return {
      personaId: persona.id,
      personaName: persona.name,
      personaNarrative: persona.narrative || buildNarrativeFromPersona(persona),
      goals,
      overallScore: Number(data.overallScore) || (goals.length > 0 ? goals.reduce((s, g) => s + g.score, 0) / goals.length : 5),
      summary: String(data.summary || ""),
    };
  } catch (e) {
    console.error("[UserEval] Failed to parse response:", e);
    return null;
  }
}

/**
 * 汇总多个用户的评测结果
 */
export function summarizeEvaluations(results: PersonaEvaluationResult[], sampleSize: number): UserEvaluationSummary {
  if (results.length === 0) {
    return {
      enabled: true,
      sampleSize: 0,
      overallAverageScore: 0,
      consistencyLevel: "medium",
      consistencyVariance: 0,
      perGoalScores: [],
      personas: [],
      recommendation: "暂无评测数据",
    };
  }

  // 收集所有目标
  const goalMap = new Map<string, number[]>();
  for (const r of results) {
    for (const g of r.goals) {
      if (!goalMap.has(g.goalText)) goalMap.set(g.goalText, []);
      goalMap.get(g.goalText)!.push(g.score);
    }
  }

  // 计算每个目标的平均分
  const perGoalScores = Array.from(goalMap.entries()).map(([text, scores]) => ({
    goalText: text,
    averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
  }));

  // 计算整体一致性（基于方差）
  const allScores = results.map((r) => r.overallScore);
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / allScores.length;

  let consistencyLevel: "high" | "medium" | "low";
  if (variance < 1.0) consistencyLevel = "high";
  else if (variance <= 2.0) consistencyLevel = "medium";
  else consistencyLevel = "low";

  // 直接取各车主 overallScore 的平均值，与底部车主分数标签保持一致
  const overallAvg = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : 0;

  // 综合推荐
  const positiveRatio = results.filter((r) => r.overallScore >= 7).length / results.length;
  let recommendation: string;
  if (positiveRatio >= 0.8) {
    recommendation = `绝大多数车主（${Math.round(positiveRatio * 100)}%）对设计方案给出了正面评价，各维度达成率较高，可以进入下一轮迭代优化。`;
  } else if (positiveRatio >= 0.5) {
    recommendation = `约 ${Math.round(positiveRatio * 100)}% 的车主给出了正面评价，但部分用户群体（如新手司机/保守型用户）存在明显痛点，建议针对性优化后再推进。`;
  } else {
    recommendation = `超过半数车主对当前设计提出了改进意见，建议重点关注低分目标的优化，尤其是与驾驶安全性和信息可读性相关的部分。`;
  }

  return {
    enabled: true,
    sampleSize,
    overallAverageScore: overallAvg,
    consistencyLevel,
    consistencyVariance: Math.round(variance * 100) / 100,
    perGoalScores,
    personas: results,
    recommendation,
  };
}

/**
 * 一致性等级中文标签
 */
export function getConsistencyLabel(level: UserEvaluationSummary["consistencyLevel"]): string {
  switch (level) {
    case "high": return "车主意见高度一致";
    case "medium": return "存在一定分歧";
    case "low": return "车主意见分歧较大，需重点关注";
  }
}

/**
 * 一致性等级颜色
 */
export function getConsistencyColor(level: UserEvaluationSummary["consistencyLevel"]): string {
  switch (level) {
    case "high": return "#22c55e"; // Success green
    case "medium": return "#f59e0b"; // Warning yellow
    case "low": return "#ef4444"; // Danger red
  }
}

/**
 * 达成率分数颜色
 */
export function getScoreColor(score: number): string {
  if (score >= 8) return "#22c55e"; // 绿色 - 优秀
  if (score >= 6) return "#f59e0b"; // 黄色 - 一般
  return "#ef4444"; // 红色 - 需关注
}

/**
 * 达成率分数评级文字
 */
export function getScoreRating(score: number): string {
  if (score >= 9) return "优秀";
  if (score >= 7) return "良好";
  if (score >= 5) return "一般";
  return "需改进";
}

/** 预估用户评测额外耗时（秒），基于样本量 */
export function estimateUserEvalTime(sampleSize: number): string {
  const basePerUser = 12; // 每个用户约12秒
  const totalSeconds = sampleSize * basePerUser;
  const min = Math.round(totalSeconds * 0.8);
  const max = Math.round(totalSeconds * 1.2);
  return `${min}-${max}秒`;
}

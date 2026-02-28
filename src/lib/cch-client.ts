// CCH API 客户端 - 封装对 Claude Code Hub 后端的所有调用
// CCH API 格式: POST /api/actions/{module}/{action}
// 响应格式: { ok: true, data: ... } 或 { ok: false, error: "..." }

const CCH_API_URL = process.env.CCH_API_URL;
const CCH_ADMIN_TOKEN = process.env.CCH_ADMIN_TOKEN;

// ==================== 类型定义 ====================

export interface CCHUser {
  id: number;
  name: string;
  isEnabled: boolean;
  role: string;
}

export interface CCHKey {
  id: number;
  name: string;
  key: string;
}

export interface CCHAddUserResponse {
  user: CCHUser;
  key: CCHKey;
}

export interface CCHQuotaUsage {
  keyId: number;
  used: number;
  limit: number;
  remaining: number;
}

export interface CCHSession {
  id: string;
  userId: number;
  username: string;
  model: string;
  startedAt: string;
  status?: string;
}

export interface CCHOverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalKeys: number;
  activeKeys: number;
  activeSessions: number;
  totalRequests: number;
}

// ==================== 内部工具函数 ====================

function getBaseUrl(): string {
  if (!CCH_API_URL) {
    throw new Error("CCH_API_URL 环境变量未设置");
  }
  return CCH_API_URL.replace(/\/+$/, "");
}

function getAdminToken(): string {
  if (!CCH_ADMIN_TOKEN) {
    throw new Error("CCH_ADMIN_TOKEN 环境变量未设置");
  }
  return CCH_ADMIN_TOKEN;
}

/**
 * 统一调用 CCH Server Actions API
 * CCH 使用 POST /api/actions/{module}/{action} 格式
 */
async function cchAction<T>(
  module: string,
  action: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const token = getAdminToken();
  const url = `${baseUrl}/api/actions/${module}/${action}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody.error || errorBody.message || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(
      `CCH API 错误 [${response.status}] ${module}/${action}: ${errorMessage}`
    );
  }

  const result = await response.json();

  // CCH 返回 { ok: true, data: ... } 格式
  if (result.ok === false) {
    throw new Error(
      `CCH 业务错误 ${module}/${action}: ${result.error || "未知错误"}`
    );
  }

  return result.data as T;
}

// ==================== API 方法 ====================

/**
 * 创建用户并返回用户信息和默认密钥
 * CCH addUser 接受 { name } 参数，自动生成 sk- 前缀的 API Key
 */
export async function addUser(
  username: string
): Promise<CCHAddUserResponse> {
  const data = await cchAction<{
    user: CCHUser;
    defaultKey: CCHKey;
  }>("users", "addUser", { name: username });

  return {
    user: data.user,
    key: data.defaultKey,
  };
}

/**
 * 启用/禁用用户
 */
export async function toggleUserEnabled(
  userId: number,
  enabled: boolean
): Promise<void> {
  await cchAction("users", "editUser", {
    id: userId,
    isEnabled: enabled,
  });
}

/**
 * 启用/禁用密钥
 */
export async function toggleKeyEnabled(
  keyId: number,
  enabled: boolean
): Promise<void> {
  await cchAction("keys", "editKey", {
    id: keyId,
    isEnabled: enabled,
  });
}

/**
 * 获取密钥的配额使用情况
 */
export async function getKeyQuotaUsage(
  keyId: number
): Promise<CCHQuotaUsage> {
  try {
    const data = await cchAction<Record<string, unknown>>(
      "keys",
      "getKeyLimitUsage",
      { keyId }
    );
    return {
      keyId,
      used: (data.used as number) ?? 0,
      limit: (data.limit as number) ?? 0,
      remaining: (data.remaining as number) ?? 0,
    };
  } catch {
    return { keyId, used: 0, limit: 0, remaining: 0 };
  }
}

/**
 * 获取指定用户的所有密钥
 */
export async function getUserKeys(userId: number): Promise<CCHKey[]> {
  const data = await cchAction<CCHKey[]>("keys", "getKeys", { userId });
  return data;
}

/**
 * 获取当前活跃会话列表
 */
export async function getActiveSessions(): Promise<CCHSession[]> {
  try {
    const data = await cchAction<CCHSession[]>(
      "statistics",
      "getActiveSessions",
      {}
    );
    return data;
  } catch {
    return [];
  }
}

/**
 * 获取系统概览统计数据
 */
export async function getOverviewStats(): Promise<CCHOverviewStats> {
  try {
    const data = await cchAction<Record<string, unknown>>(
      "statistics",
      "getOverview",
      {}
    );
    return {
      totalUsers: (data.totalUsers as number) ?? 0,
      activeUsers: (data.activeUsers as number) ?? 0,
      totalKeys: (data.totalKeys as number) ?? 0,
      activeKeys: (data.activeKeys as number) ?? 0,
      activeSessions: (data.activeSessions as number) ?? 0,
      totalRequests: (data.totalRequests as number) ?? 0,
    };
  } catch {
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalKeys: 0,
      activeKeys: 0,
      activeSessions: 0,
      totalRequests: 0,
    };
  }
}

/**
 * 获取所有用户列表
 */
export async function getAllUsers(): Promise<CCHUser[]> {
  const data = await cchAction<CCHUser[]>("users", "getUsers", {});
  return data;
}

// 命名空间导出
export const cchClient = {
  addUser,
  toggleUserEnabled,
  toggleKeyEnabled,
  getKeyQuotaUsage,
  getUserKeys,
  getActiveSessions,
  getOverviewStats,
  getAllUsers,
};

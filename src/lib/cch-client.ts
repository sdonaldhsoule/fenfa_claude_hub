// CCH API 客户端 - 封装对 Claude Code Hub 后端的所有调用
// CCH API 格式: POST /api/actions/{module}/{action}
// 响应格式: { ok: true, data: ... } 或 { ok: false, error: "..." }

const CCH_API_URL = process.env.CCH_API_URL;
const CCH_ADMIN_TOKEN = process.env.CCH_ADMIN_TOKEN;
const CCH_AUTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存，避免每次都登录
let cachedAuthToken: { token: string; expiresAt: number } | null = null;

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
 * 从响应中提取错误文本
 */
async function getErrorMessage(response: Response): Promise<string> {
  try {
    const errorBody = (await response.json()) as Record<string, unknown>;
    const messageCandidates = [
      errorBody.error,
      errorBody.message,
      errorBody.errorCode,
    ];
    const message = messageCandidates.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
    if (message) return message;
  } catch {
    // ignore
  }

  try {
    const text = await response.text();
    if (text.trim().length > 0) {
      return text.slice(0, 200);
    }
  } catch {
    // ignore
  }

  return response.statusText || "未知错误";
}

/**
 * 从 Set-Cookie 中提取 auth-token
 */
function extractAuthToken(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/auth-token=([^;]+)/i);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * 通过 /api/auth/login 交换 auth-token（新版本 CCH 认证方式）
 */
async function getAuthToken(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    cachedAuthToken &&
    cachedAuthToken.expiresAt > Date.now()
  ) {
    return cachedAuthToken.token;
  }

  const baseUrl = getBaseUrl();
  const adminToken = getAdminToken();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key: adminToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await getErrorMessage(response);
    throw new Error(
      `CCH 登录失败 [${response.status}]: ${message}（请检查 CCH_ADMIN_TOKEN 是否为可登录后台的有效令牌）`
    );
  }

  const tokenFromCookie = extractAuthToken(response.headers.get("set-cookie"));
  if (tokenFromCookie) {
    cachedAuthToken = {
      token: tokenFromCookie,
      expiresAt: Date.now() + CCH_AUTH_CACHE_TTL_MS,
    };
    return tokenFromCookie;
  }

  let tokenFromBody: string | null = null;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.token === "string" && body.token.trim().length > 0) {
      tokenFromBody = body.token;
    }
  } catch {
    // ignore
  }

  if (!tokenFromBody) {
    throw new Error("CCH 登录成功，但未返回 auth-token");
  }

  cachedAuthToken = {
    token: tokenFromBody,
    expiresAt: Date.now() + CCH_AUTH_CACHE_TTL_MS,
  };
  return tokenFromBody;
}

/**
 * 解析 Server Actions 响应
 */
function parseActionResult<T>(
  result: unknown,
  module: string,
  action: string
): T {
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (record.ok === false) {
      const message =
        (typeof record.error === "string" && record.error) ||
        (typeof record.message === "string" && record.message) ||
        "未知错误";
      throw new Error(`CCH 业务错误 ${module}/${action}: ${message}`);
    }
    if ("data" in record) {
      return record.data as T;
    }
  }

  // 兼容直接返回数组/对象的实现
  return result as T;
}

/**
 * 使用 Cookie 会话调用 CCH（优先）
 */
async function cchActionWithCookie<T>(
  module: string,
  action: string,
  body: Record<string, unknown>,
  allowRefresh = true
): Promise<T> {
  const baseUrl = getBaseUrl();
  const adminToken = getAdminToken();
  const authToken = await getAuthToken();
  const url = `${baseUrl}/api/actions/${module}/${action}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 兼容部分实现：部分版本只认 Cookie，部分版本可接受 Authorization
      Cookie: `auth-token=${encodeURIComponent(authToken)}`,
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.status === 401 && allowRefresh) {
    await getAuthToken(true);
    return cchActionWithCookie<T>(module, action, body, false);
  }

  if (!response.ok) {
    const errorMessage = await getErrorMessage(response);
    throw new Error(
      `CCH API 错误 [${response.status}] ${module}/${action}: ${errorMessage}`
    );
  }

  const result = await response.json();
  return parseActionResult<T>(result, module, action);
}

/**
 * 使用 Bearer 直连调用 CCH（旧版本回退）
 */
async function cchActionWithBearer<T>(
  module: string,
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  const baseUrl = getBaseUrl();
  const adminToken = getAdminToken();
  const url = `${baseUrl}/api/actions/${module}/${action}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await getErrorMessage(response);
    throw new Error(
      `CCH API 错误 [${response.status}] ${module}/${action}: ${errorMessage}`
    );
  }

  const result = await response.json();
  return parseActionResult<T>(result, module, action);
}

/**
 * 统一调用 CCH Server Actions API
 * 优先 Cookie 会话认证，失败后回退 Bearer 直连
 */
async function cchAction<T>(
  module: string,
  action: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  try {
    return await cchActionWithCookie<T>(module, action, body);
  } catch (cookieError) {
    try {
      return await cchActionWithBearer<T>(module, action, body);
    } catch (bearerError) {
      const cookieMessage =
        cookieError instanceof Error ? cookieError.message : String(cookieError);
      const bearerMessage =
        bearerError instanceof Error ? bearerError.message : String(bearerError);
      throw new Error(
        `CCH 调用失败 ${module}/${action}。Cookie 会话认证失败：${cookieMessage}；Bearer 回退失败：${bearerMessage}`
      );
    }
  }
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

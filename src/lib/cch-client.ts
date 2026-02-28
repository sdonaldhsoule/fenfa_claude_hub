// CCH API 客户端 - 封装对 CCH 后端的所有调用

const CCH_API_URL = process.env.CCH_API_URL;
const CCH_ADMIN_TOKEN = process.env.CCH_ADMIN_TOKEN;

// ==================== 类型定义 ====================

export interface CCHUser {
  id: number;
  username: string;
  enabled: boolean;
  createdAt: string;
}

export interface CCHKey {
  id: number;
  key: string;
  userId: number;
  enabled: boolean;
  createdAt: string;
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

export interface CCHApiError {
  message: string;
  status: number;
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

async function cchFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const token = getAdminToken();

  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody.message || errorBody.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(
      `CCH API 错误 [${response.status}] ${path}: ${errorMessage}`
    );
  }

  // 处理无内容响应
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ==================== API 方法 ====================

/**
 * 创建用户并返回用户信息和密钥
 */
export async function addUser(
  username: string
): Promise<CCHAddUserResponse> {
  return cchFetch<CCHAddUserResponse>("/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

/**
 * 启用/禁用用户
 */
export async function toggleUserEnabled(
  userId: number,
  enabled: boolean
): Promise<void> {
  await cchFetch(`/v1/admin/users/${userId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

/**
 * 启用/禁用密钥
 */
export async function toggleKeyEnabled(
  keyId: number,
  enabled: boolean
): Promise<void> {
  await cchFetch(`/v1/admin/keys/${keyId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

/**
 * 获取密钥的配额使用情况
 */
export async function getKeyQuotaUsage(
  keyId: number
): Promise<CCHQuotaUsage> {
  return cchFetch<CCHQuotaUsage>(`/v1/admin/keys/${keyId}/usage`);
}

/**
 * 获取指定用户的所有密钥
 */
export async function getUserKeys(userId: number): Promise<CCHKey[]> {
  return cchFetch<CCHKey[]>(`/v1/admin/users/${userId}/keys`);
}

/**
 * 获取当前活跃会话列表
 */
export async function getActiveSessions(): Promise<CCHSession[]> {
  return cchFetch<CCHSession[]>("/v1/admin/sessions");
}

/**
 * 获取系统概览统计数据
 */
export async function getOverviewStats(): Promise<CCHOverviewStats> {
  return cchFetch<CCHOverviewStats>("/v1/admin/stats");
}

/**
 * 获取所有用户列表
 */
export async function getAllUsers(): Promise<CCHUser[]> {
  return cchFetch<CCHUser[]>("/v1/admin/users");
}

// 命名空间导出，方便 import { cchClient } from "@/lib/cch-client" 使用
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

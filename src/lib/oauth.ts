// LinuxDO OAuth 工具

// ==================== 类型定义 ====================

export interface LinuxDOUser {
  id: number;
  username: string;
  name: string;
  avatar_template: string;
  trust_level: number;
  silenced: boolean;
  active: boolean;
}

// ==================== OAuth 端点 ====================

const AUTHORIZE_URL = "https://connect.linux.do/oauth2/authorize";
const TOKEN_URL = "https://connect.linux.do/oauth2/token";
const USERINFO_URL = "https://connect.linux.do/api/user";

// ==================== 环境变量 ====================

function getClientId(): string {
  const clientId = process.env.LINUXDO_CLIENT_ID;
  if (!clientId) {
    throw new Error("LINUXDO_CLIENT_ID 环境变量未设置");
  }
  return clientId;
}

function getClientSecret(): string {
  const clientSecret = process.env.LINUXDO_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("LINUXDO_CLIENT_SECRET 环境变量未设置");
  }
  return clientSecret;
}

function getRedirectUri(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL 环境变量未设置");
  }
  return `${siteUrl}/api/auth/callback`;
}

// ==================== OAuth 方法 ====================

/**
 * 构建 LinuxDO OAuth 授权 URL
 */
export function getAuthorizationUrl(state: string): string {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 用授权码换取 access_token
 * 使用 HTTP Basic Auth (client_id:client_secret)
 */
export async function exchangeCode(
  code: string
): Promise<{ access_token: string }> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const redirectUri = getRedirectUri();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody.error_description || errorBody.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(`LinuxDO OAuth token 交换失败: ${errorMessage}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("LinuxDO OAuth 响应中缺少 access_token");
  }

  return { access_token: data.access_token as string };
}

/**
 * 使用 access_token 获取 LinuxDO 用户信息
 */
export async function getUserInfo(
  accessToken: string
): Promise<LinuxDOUser> {
  const response = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `获取 LinuxDO 用户信息失败 [${response.status}]: ${response.statusText}`
    );
  }

  const user: LinuxDOUser = await response.json();

  if (!user.id || !user.username) {
    throw new Error("LinuxDO 用户信息格式无效");
  }

  return user;
}

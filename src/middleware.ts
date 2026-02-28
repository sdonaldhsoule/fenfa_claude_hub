import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ==================== 路径定义 ====================

const PUBLIC_PATHS = [
  "/",
  "/api/auth/login",
  "/api/auth/callback",
];

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
];

const ADMIN_PREFIXES = [
  "/admin",
  "/api/admin",
];

const AUTH_REQUIRED_PREFIXES = [
  "/dashboard",
  "/api/user",
];

// ==================== 工具函数 ====================

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRequiredPath(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function verifyToken(
  token: string
): Promise<{ userId: string; role: string } | null> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return null;
    }
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

// ==================== 中间件 ====================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静态资源和公开 API 前缀直接放行
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 从 cookie 获取 token
  const token = request.cookies.get("session")?.value;
  const user = token ? await verifyToken(token) : null;

  // 已登录用户访问首页，跳转到 dashboard
  if (pathname === "/" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 公开路径直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 未登录用户访问受保护路径，跳转到首页
  if (!user && (isAuthRequiredPath(pathname) || isAdminPath(pathname))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 管理路径需要 ADMIN 角色
  if (isAdminPath(pathname)) {
    if (!user || user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

// ==================== Matcher 配置 ====================

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

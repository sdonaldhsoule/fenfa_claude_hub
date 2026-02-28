import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, getUserInfo } from "@/lib/oauth";
import { signJWT, encrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cchClient } from "@/lib/cch-client";
import { ensureDailyQuotaRefresh } from "@/lib/key-policy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 验证参数
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_params", siteUrl));
  }

  // 验证 state (CSRF 防护)
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/?error=invalid_state", siteUrl));
  }

  try {
    await ensureDailyQuotaRefresh();

    // 用 code 换 access_token
    const tokenData = await exchangeCode(code);
    const accessToken = tokenData.access_token;

    // 获取用户信息
    const linuxdoUser = await getUserInfo(accessToken);

    // 检查 trust_level >= 1
    if (linuxdoUser.trust_level < 1) {
      return NextResponse.redirect(
        new URL("/?error=trust_level_too_low", siteUrl)
      );
    }

    // 检查 silenced/banned
    if (linuxdoUser.silenced || !linuxdoUser.active) {
      return NextResponse.redirect(
        new URL("/?error=account_restricted", siteUrl)
      );
    }

    // 判断是否为初始管理员
    const initialAdminId = process.env.INITIAL_ADMIN_LINUXDO_ID;
    const isInitialAdmin =
      initialAdminId && String(linuxdoUser.id) === String(initialAdminId);

    // 查找或创建用户
    const now = new Date();
    let user = await prisma.user.findUnique({
      where: { linuxdoId: linuxdoUser.id },
    });

    if (user) {
      // 老用户: 更新 LinuxDO 信息
      if (user.isBanned) {
        return NextResponse.redirect(
          new URL(
            `/?error=banned&reason=${encodeURIComponent(user.banReason || "您已被封禁")}`,
            siteUrl
          )
        );
      }

      user = await prisma.user.update({
        where: { linuxdoId: linuxdoUser.id },
        data: {
          username: linuxdoUser.username,
          name: linuxdoUser.name,
          avatarTemplate: linuxdoUser.avatar_template,
          trustLevel: linuxdoUser.trust_level,
          lastLoginAt: now,
          lastActivityAt: now,
          ...(isInitialAdmin ? { role: "ADMIN" } : {}),
        },
      });
    } else {
      // 新用户: 调用 CCH 创建用户+Key
      try {
        const cchResult = await cchClient.addUser(linuxdoUser.username);

        user = await prisma.user.create({
          data: {
            linuxdoId: linuxdoUser.id,
            username: linuxdoUser.username,
            name: linuxdoUser.name,
            avatarTemplate: linuxdoUser.avatar_template,
            trustLevel: linuxdoUser.trust_level,
            role: isInitialAdmin ? "ADMIN" : "USER",
            cchUserId: cchResult.user.id,
            cchApiKey: encrypt(cchResult.key.key),
            cchKeyId: cchResult.key.id,
            lastLoginAt: now,
            lastActivityAt: now,
            lastKnownUsage: 0,
            quotaWindowStartAt: now,
            quotaWindowBaseUsage: 0,
            keyAutoDisabled: false,
            autoDisabledAt: null,
          },
        });
      } catch (cchError) {
        console.error("CCH user creation failed:", cchError);
        return NextResponse.redirect(
          new URL("/?error=cch_creation_failed", siteUrl)
        );
      }
    }

    // 签发 JWT
    const token = await signJWT({
      userId: user.id,
      linuxdoId: user.linuxdoId,
      username: user.username,
      role: user.role,
    });

    // 设置 HttpOnly cookie
    const response = NextResponse.redirect(new URL("/dashboard", siteUrl));
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", siteUrl));
  }
}

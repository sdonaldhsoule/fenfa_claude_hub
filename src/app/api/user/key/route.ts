import { NextResponse } from "next/server";
import { clearSessionCookie, decrypt, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateUserKeyPolicy } from "@/lib/key-policy";

// 获取当前用户的 API Key 信息
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      cchApiKey: true,
      cchKeyId: true,
      cchUserId: true,
      isBanned: true,
      banReason: true,
      createdAt: true,
      lastLoginAt: true,
      lastActivityAt: true,
      lastKnownUsage: true,
      keyAutoDisabled: true,
      autoDisabledAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.isBanned) {
    return clearSessionCookie(
      NextResponse.json(
        {
          error: "Account banned",
          reason: user.banReason || "您已被封禁",
        },
        { status: 403 }
      )
    );
  }

  const policyState = await evaluateUserKeyPolicy({
    id: user.id,
    cchKeyId: user.cchKeyId,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastActivityAt: user.lastActivityAt,
    lastKnownUsage: user.lastKnownUsage,
    keyAutoDisabled: user.keyAutoDisabled,
    autoDisabledAt: user.autoDisabledAt,
  });

  let apiKey: string | null = null;
  if (user.cchApiKey) {
    try {
      apiKey = decrypt(user.cchApiKey);
    } catch {
      apiKey = null;
    }
  }

  return NextResponse.json({
    apiKey: apiKey
      ? {
          key: apiKey,
          keyId: user.cchKeyId,
          userId: user.cchUserId,
          status: policyState.keyStatus,
          autoDisabledAt: policyState.autoDisabledAt
            ? policyState.autoDisabledAt.toISOString()
            : null,
        }
      : null,
    usage: policyState.usage,
    policy: {
      inactivityHours: policyState.policyConfig.inactivityHours,
      dailyReactivateAt: policyState.policyConfig.dailyReactivateAtLabel,
      dailyReactivateHourBjt: policyState.policyConfig.dailyReactivateHourBjt,
      dailyReactivateMinuteBjt:
        policyState.policyConfig.dailyReactivateMinuteBjt,
      nextDailyReactivateAt: policyState.nextDailyReactivateAt.toISOString(),
      lastActivityAt: policyState.lastActivityAt.toISOString(),
    },
  });
}

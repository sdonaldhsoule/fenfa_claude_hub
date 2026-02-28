import { NextResponse } from "next/server";
import { getSession, decrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cchClient } from "@/lib/cch-client";

// 获取当前用户的 API Key 信息
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let apiKey: string | null = null;
  if (user.cchApiKey) {
    try {
      apiKey = decrypt(user.cchApiKey);
    } catch {
      apiKey = null;
    }
  }

  // 获取使用统计
  let usage = null;
  if (user.cchKeyId) {
    try {
      usage = await cchClient.getKeyQuotaUsage(user.cchKeyId);
    } catch {
      // 如果获取使用统计失败，不影响返回 Key
    }
  }

  return NextResponse.json({
    apiKey: apiKey
      ? {
          key: apiKey,
          keyId: user.cchKeyId,
          userId: user.cchUserId,
        }
      : null,
    usage,
  });
}

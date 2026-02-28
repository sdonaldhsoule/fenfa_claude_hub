import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      linuxdoId: true,
      username: true,
      name: true,
      avatarTemplate: true,
      trustLevel: true,
      role: true,
      isBanned: true,
      banReason: true,
      cchUserId: true,
      cchKeyId: true,
      lastLoginAt: true,
      createdAt: true,
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

  return NextResponse.json({ user });
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cchClient } from "@/lib/cch-client";
import { z } from "zod";

const banSchema = z.object({
  reason: z.string().min(1, "封禁原因不能为空"),
});

// 封禁用户
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const body = await request.json();
  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 不能封禁自己
  if (user.id === session.userId) {
    return NextResponse.json(
      { error: "Cannot ban yourself" },
      { status: 400 }
    );
  }

  try {
    // CCH: 禁用用户和 Key
    if (user.cchUserId) {
      await cchClient.toggleUserEnabled(user.cchUserId, false);
    }
    if (user.cchKeyId) {
      await cchClient.toggleKeyEnabled(user.cchKeyId, false);
    }

    // 更新本地 DB
    await prisma.user.update({
      where: { id },
      data: {
        isBanned: true,
        banReason: parsed.data.reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ban user failed:", error);
    return NextResponse.json(
      { error: "Failed to ban user" },
      { status: 500 }
    );
  }
}

// 解封用户
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // CCH: 启用用户和 Key
    if (user.cchUserId) {
      await cchClient.toggleUserEnabled(user.cchUserId, true);
    }
    if (user.cchKeyId) {
      await cchClient.toggleKeyEnabled(user.cchKeyId, true);
    }

    // 更新本地 DB
    await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        banReason: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unban user failed:", error);
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 }
    );
  }
}

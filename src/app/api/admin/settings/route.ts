import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getKeyPolicyConfig,
  getNextDailyReactivateAt,
  updateKeyPolicyConfig,
} from "@/lib/key-policy";

const updatePolicySchema = z.object({
  inactivityHours: z.number().int().min(1).max(168),
  dailyReactivateHourBjt: z.number().int().min(0).max(23),
  dailyReactivateMinuteBjt: z.number().int().min(0).max(59),
});

async function ensureAdmin() {
  const session = await getSession();
  if (!session) return null;

  const authUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isBanned: true },
  });

  if (!authUser || authUser.isBanned || authUser.role !== "ADMIN") {
    return null;
  }

  return authUser;
}

export async function GET() {
  const admin = await ensureAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getKeyPolicyConfig();
  const nextDailyReactivateAt = getNextDailyReactivateAt(
    new Date(),
    config.dailyReactivateHourBjt,
    config.dailyReactivateMinuteBjt
  );

  return NextResponse.json({
    policy: {
      ...config,
      nextDailyReactivateAt: nextDailyReactivateAt.toISOString(),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await ensureAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体格式无效" }, { status: 400 });
  }

  const parsed = updatePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数无效" },
      { status: 400 }
    );
  }

  const config = await updateKeyPolicyConfig(parsed.data);
  const nextDailyReactivateAt = getNextDailyReactivateAt(
    new Date(),
    config.dailyReactivateHourBjt,
    config.dailyReactivateMinuteBjt
  );

  return NextResponse.json({
    success: true,
    policy: {
      ...config,
      nextDailyReactivateAt: nextDailyReactivateAt.toISOString(),
    },
  });
}

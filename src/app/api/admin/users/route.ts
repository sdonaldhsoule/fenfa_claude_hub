import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 获取所有用户
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, isBanned: true },
  });

  if (!authUser || authUser.isBanned || authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const role = (searchParams.get("role") || "").toUpperCase();
  const status = (searchParams.get("status") || "").toLowerCase();
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawPageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(100, rawPageSize)
      : 20;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role === "ADMIN" || role === "USER") {
    where.role = role;
  }

  if (status === "banned") {
    where.isBanned = true;
  } else if (status === "active" || status === "normal") {
    where.isBanned = false;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

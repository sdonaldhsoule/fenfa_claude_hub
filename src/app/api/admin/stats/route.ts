import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cchClient } from "@/lib/cch-client";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  try {
    const stats = await cchClient.getOverviewStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cchClient } from "@/lib/cch-client";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
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

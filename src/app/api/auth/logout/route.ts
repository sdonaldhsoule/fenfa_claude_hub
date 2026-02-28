import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}

export async function GET() {
  return clearSessionCookie(NextResponse.redirect(new URL("/", SITE_URL)));
}

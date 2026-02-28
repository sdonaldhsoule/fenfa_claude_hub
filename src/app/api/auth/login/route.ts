import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorizationUrl } from "@/lib/oauth";

export async function GET() {
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}

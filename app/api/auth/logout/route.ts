import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, destroySession } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  // Best-effort: the cookie is cleared regardless, so a DB blip cannot trap
  // someone in a signed-in state.
  await destroySession(jar.get(AUTH_COOKIE)?.value).catch(() => {});
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

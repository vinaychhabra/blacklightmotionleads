import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const pixel = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255,
  33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1,
  0, 59,
]);

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bmhsjutyqplvwlkuarbr.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm";
    const client = createClient(url, key);
    const { error } = await client.rpc("track_email_open", { tracking_token: token });
    if (error) console.error("Email open tracking failed:", error.message);
  }

  return new NextResponse(pixel, {
    status: 200,
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

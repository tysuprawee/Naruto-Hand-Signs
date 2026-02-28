import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdminDashboardResponse {
  ok: boolean;
  reason?: string;
  detail?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSupabaseServerClient() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "").trim();
  if (!url || !key) {
    throw new Error("Supabase server environment is missing.");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function toErrorResponse(status: number, payload: AdminDashboardResponse): Response {
  return NextResponse.json(payload, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toErrorResponse(400, { ok: false, reason: "invalid_json" });
  }

  if (!isRecord(body)) {
    return toErrorResponse(400, { ok: false, reason: "invalid_payload" });
  }

  const password = String(body.password || "");
  const timezone = String(body.timezone || "UTC").trim().slice(0, 64);
  if (!password.trim()) {
    return toErrorResponse(400, { ok: false, reason: "missing_password" });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_dashboard_stats", {
      p_password: password,
      p_tz: timezone || "UTC",
    });

    if (error) {
      return toErrorResponse(500, {
        ok: false,
        reason: "rpc_error",
        detail: String(error.message || "admin dashboard rpc failed"),
      });
    }

    if (!isRecord(data)) {
      return toErrorResponse(500, { ok: false, reason: "invalid_rpc_response" });
    }

    if (!Boolean(data.ok)) {
      const reason = String(data.reason || "unauthorized");
      const status = reason === "invalid_password"
        ? 401
        : reason === "password_not_set"
          ? 428
          : 400;
      return toErrorResponse(status, {
        ok: false,
        reason,
        detail: String(data.detail || ""),
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return toErrorResponse(500, {
      ok: false,
      reason: "server_error",
      detail: String((err as Error)?.message || err || "unexpected server error"),
    });
  }
}

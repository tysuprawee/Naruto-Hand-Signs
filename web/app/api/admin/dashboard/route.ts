import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdminDashboardResponse {
  ok: boolean;
  reason?: string;
  detail?: string;
  retry_seconds?: number;
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
  const action = String(body.action || "stats").trim().toLowerCase();
  if (!password.trim()) {
    return toErrorResponse(400, { ok: false, reason: "missing_password" });
  }

  const rawForwarded = String(request.headers.get("x-forwarded-for") || "").trim();
  const ip = (rawForwarded.split(",")[0] || String(request.headers.get("x-real-ip") || "")).trim().slice(0, 120);
  const userAgent = String(request.headers.get("user-agent") || "").trim().slice(0, 1024);
  const clientId = createHash("sha256")
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 64);

  try {
    const supabase = getSupabaseServerClient();
    let rpcName = "";
    let rpcPayload: Record<string, unknown> = {};

    if (action === "stats") {
      rpcName = "admin_dashboard_stats";
      rpcPayload = {
        p_password: password,
        p_tz: timezone || "UTC",
        p_client_id: clientId,
        p_user_agent: userAgent,
        p_ip: ip,
      };
    } else if (action === "config_list") {
      rpcName = "admin_get_app_config";
      rpcPayload = {
        p_password: password,
        p_client_id: clientId,
        p_user_agent: userAgent,
        p_ip: ip,
      };
    } else if (action === "config_upsert") {
      const config = isRecord(body.config) ? body.config : {};
      rpcName = "admin_upsert_app_config";
      rpcPayload = {
        p_password: password,
        p_type: String(config.type || ""),
        p_message: String(config.message || ""),
        p_version: String(config.version || ""),
        p_url: String(config.url || ""),
        p_checksum: String(config.checksum || ""),
        p_is_active: Boolean(config.is_active ?? true),
        p_priority: Number(config.priority ?? 100),
        p_client_id: clientId,
        p_user_agent: userAgent,
        p_ip: ip,
      };
    } else if (action === "reports_list") {
      rpcName = "admin_get_user_reports";
      rpcPayload = {
        p_password: password,
        p_limit: Math.max(1, Math.min(300, Number(body.limit ?? 120) || 120)),
        p_client_id: clientId,
        p_user_agent: userAgent,
        p_ip: ip,
      };
    } else {
      return toErrorResponse(400, { ok: false, reason: "invalid_action" });
    }

    const { data, error } = await supabase.rpc(rpcName, rpcPayload);

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
        : reason === "locked_out" || reason === "rate_limited"
          ? 429
        : reason === "password_not_set"
          ? 428
          : 400;
      return toErrorResponse(status, {
        ok: false,
        reason,
        detail: String(data.detail || ""),
        retry_seconds: Number(data.retry_seconds || 0) || undefined,
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

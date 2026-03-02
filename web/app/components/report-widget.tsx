"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareWarning, Send, X } from "lucide-react";
import { supabase } from "@/utils/supabase";

const REPORT_DRAFT_KEY = "shinobi-report-draft-v1";
const REPORT_MIN_LEN = 5;
const REPORT_MAX_LEN = 600;

function trimReportText(raw: string): string {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, REPORT_MAX_LEN);
}

export default function ReportWidget() {
  const pathname = usePathname();
  const isGameRoute = String(pathname || "").startsWith("/play");
  const toastTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "idle">("idle");
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"ok" | "error" | "idle">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const draft = window.localStorage.getItem(REPORT_DRAFT_KEY);
      if (draft) setText(String(draft).slice(0, REPORT_MAX_LEN));
    } catch {
      // Ignore storage read failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!text.trim()) {
        window.localStorage.removeItem(REPORT_DRAFT_KEY);
        return;
      }
      window.localStorage.setItem(REPORT_DRAFT_KEY, text.slice(0, REPORT_MAX_LEN));
    } catch {
      // Ignore storage write failures.
    }
  }, [text]);

  const charsLeft = useMemo(() => REPORT_MAX_LEN - text.length, [text.length]);

  const showToast = (message: string, tone: "ok" | "error") => {
    setToastMessage(message);
    setToastTone(tone);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      setToastTone("idle");
      toastTimerRef.current = null;
    }, 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async () => {
    const reportText = trimReportText(text);
    if (reportText.length < REPORT_MIN_LEN) {
      const message = `Please add at least ${REPORT_MIN_LEN} characters.`;
      setStatus(message);
      setStatusTone("error");
      showToast(message, "error");
      return;
    }
    if (!supabase) {
      const message = "Report service is unavailable right now.";
      setStatus(message);
      setStatusTone("error");
      showToast(message, "error");
      return;
    }

    setSending(true);
    setStatus("");
    setStatusTone("idle");
    try {
      let authUserId: string | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        authUserId = data?.user?.id || null;
      } catch {
        authUserId = null;
      }

      const { error } = await supabase.from("user_reports").insert({
        report_text: reportText,
        page_path: String(pathname || "").slice(0, 256) || null,
        user_agent: typeof window !== "undefined" ? String(window.navigator.userAgent || "").slice(0, 1024) : null,
        auth_user_id: authUserId,
      });

      if (error) {
        const message = `Failed to send report: ${error.message || "unknown_error"}`;
        setStatus(message);
        setStatusTone("error");
        showToast(message, "error");
        return;
      }

      setText("");
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(REPORT_DRAFT_KEY);
        } catch {
          // Ignore storage write failures.
        }
      }
      const successMessage = "Report sent. Thank you.";
      setStatus(successMessage);
      setStatusTone("ok");
      showToast(successMessage, "ok");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      const errorMessage = `Failed to send report: ${message}`;
      setStatus(errorMessage);
      setStatusTone("error");
      showToast(errorMessage, "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`report-widget fixed flex flex-col gap-2 ${isGameRoute ? "report-widget-game" : ""}`}
    >
      {open && (
        <div className="report-panel w-[min(92vw,340px)] rounded-2xl border border-cyan-300/40 bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(5,8,22,0.95))] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Quick Report</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-600/70 bg-zinc-900/60 p-1 text-zinc-300 hover:border-zinc-400 hover:text-white"
              aria-label="Close report panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value.slice(0, REPORT_MAX_LEN));
              if (status) {
                setStatus("");
                setStatusTone("idle");
              }
            }}
            placeholder="Describe the issue or feedback..."
            rows={4}
            className="w-full resize-none rounded-lg border border-cyan-400/35 bg-black/35 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-cyan-300"
          />

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400">{charsLeft} left</span>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={sending}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/50 bg-cyan-500/18 px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-cyan-100 hover:border-cyan-200 hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send"}
            </button>
          </div>

          {status && (
            <p className={`mt-2 text-xs ${statusTone === "ok" ? "text-emerald-300" : "text-red-300"}`}>
              {status}
            </p>
          )}
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`report-toast max-w-[min(92vw,340px)] rounded-xl border px-3 py-2 text-xs font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm ${
            toastTone === "ok"
              ? "border-emerald-300/55 bg-emerald-500/16 text-emerald-100"
              : "border-red-300/55 bg-red-500/16 text-red-100"
          }`}
        >
          {toastMessage}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="report-trigger inline-flex items-center gap-1.5 rounded-full border border-cyan-300/45 bg-cyan-500/18 px-3 py-2 text-xs font-black uppercase tracking-[0.11em] text-cyan-100 shadow-[0_0_20px_rgba(56,189,248,0.22)] backdrop-blur-sm hover:border-cyan-200 hover:bg-cyan-500/26"
        aria-label="Open report panel"
      >
        <MessageSquareWarning className="h-3.5 w-3.5" />
        <span className="report-trigger-label">Report</span>
      </button>

      <style jsx>{`
        .report-widget {
          z-index: 85;
          right: 1rem;
          bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          align-items: flex-end;
        }
        .report-toast {
          pointer-events: none;
        }
        .report-widget-game {
          z-index: 48;
          right: 1rem;
          bottom: calc(5.25rem + env(safe-area-inset-bottom, 0px));
        }
        @media (max-width: 768px) {
          .report-widget {
            right: 0.75rem;
            bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
          }
          .report-widget-game {
            left: 0.75rem;
            right: auto;
            bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
            align-items: flex-start;
          }
          .report-panel {
            width: min(94vw, 320px);
          }
          .report-trigger {
            padding-left: 0.65rem;
            padding-right: 0.65rem;
          }
          .report-trigger-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

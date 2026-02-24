"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase";

function getErrorMessage(err: unknown): string {
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
        return String((err as { message?: unknown }).message || "");
    }
    return "";
}

function isTransientAnalyticsError(err: unknown): boolean {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return true;
    }
    const message = getErrorMessage(err).toLowerCase();
    return (
        message.includes("failed to fetch")
        || message.includes("fetch failed")
        || message.includes("networkerror")
        || message.includes("network request failed")
        || message.includes("load failed")
    );
}

export default function AnalyticsTracker() {
    const pathname = usePathname();

    useEffect(() => {
        // Basic check ensuring supabase is initialized
        const client = supabase;
        if (!client) return;

        const trackVisit = async () => {
            try {
                const { error } = await client.from("website_visits").insert({
                    page_path: pathname,
                    user_agent: window.navigator.userAgent,
                    referrer: document.referrer || null,
                });

                if (error) {
                    if (!isTransientAnalyticsError(error) && process.env.NODE_ENV !== "production") {
                        console.error("Supabase analytics error:", error.message);
                    }
                }
            } catch (err) {
                if (!isTransientAnalyticsError(err) && process.env.NODE_ENV !== "production") {
                    console.error("Unexpected analytics error:", err);
                }
            }
        };

        // Timeout ensures we don't block main thread on navigation start
        const timer = setTimeout(() => {
            trackVisit();
        }, 1000);

        return () => clearTimeout(timer);
    }, [pathname]);

    return null;
}

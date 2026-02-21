"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase";

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
                    console.error("Supabase analytics error:", error.message);
                }
            } catch (err) {
                console.error("Unexpected analytics error:", err);
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

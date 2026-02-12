"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

export default function VisitorStats() {
    const [stats, setStats] = useState<{ today: number; total: number } | null>(null);

    useEffect(() => {
        async function fetchStats() {
            if (!supabase) return;

            try {
                const { data, error } = await supabase.rpc('get_visit_stats');

                if (error) {
                    console.error("Error fetching stats:", error);
                    return;
                }

                if (data) {
                    setStats(data as { today: number; total: number });
                }
            } catch (err) {
                console.error("Unexpected stats error:", err);
            }
        }

        fetchStats();
    }, []);

    if (!stats) return null;

    return (
        <div className="flex items-center gap-6 text-xs text-ninja-dim font-mono border-l border-ninja-border pl-6">
            <div className="flex flex-col">
                <span className="text-white font-bold">{stats.today.toLocaleString()}</span>
                <span className="uppercase tracking-wide opacity-70">Visitors Today</span>
            </div>
            <div className="flex flex-col">
                <span className="text-white font-bold">{stats.total.toLocaleString()}</span>
                <span className="uppercase tracking-wide opacity-70">Total Visits</span>
            </div>
        </div>
    );
}

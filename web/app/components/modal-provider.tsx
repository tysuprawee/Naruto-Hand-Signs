"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { ArrowLeft, Check, Copy, X } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface ModalContextType {
    openModal: (title: string, message: string) => void;
    trackClick: (buttonName: string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModal() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error("useModal must be used within a ModalProvider");
    }
    return context;
}

export function ModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");

    const openModal = (title: string, message: string) => {
        setTitle(title);
        setMessage(message);
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
    };

    const trackClick = async (buttonName: string) => {
        if (!supabase) return;
        try {
            await supabase.from("button_clicks").insert({
                button_name: buttonName,
                user_agent: window.navigator.userAgent,
            });
        } catch (err) {
            console.error("Failed to track click:", err);
        }
    };

    return (
        <ModalContext.Provider value={{ openModal, trackClick }}>
            {children}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-ninja-panel border border-ninja-border rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-ninja-dim hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-ninja-accent animate-pulse"></span>
                            {title}
                        </h3>
                        <p className="text-ninja-dim leading-relaxed">{message}</p>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-ninja-accent hover:bg-ninja-accent-glow text-white text-sm font-bold rounded-lg transition-all"
                            >
                                GOT IT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ModalContext.Provider>
    );
}

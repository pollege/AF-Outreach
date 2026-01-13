"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Megaphone,
    Users,
    Inbox,
    Settings,
    LogOut,
    Sparkles,
    Activity,
    BarChart3
} from "lucide-react";

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Megaphone, label: "Campagne", href: "/campaigns" },
    { icon: Sparkles, label: "Campagne AI", href: "/ai-campaigns" },
    { icon: BarChart3, label: "Statistiche", href: "/stats" },
    { icon: Users, label: "Leads", href: "/leads" }, // Global Leads view? Or maybe just keep inside campaigns
    { icon: Inbox, label: "Inbox", href: "/inbox" },
    { icon: Activity, label: "Registro Invii", href: "/logs" },
    { icon: Settings, label: "Impostazioni", href: "/settings" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-4 top-4 bottom-4 w-64 glass-dark rounded-2xl flex flex-col p-4 z-50 text-slate-100 transition-all duration-300">
            {/* Logo */}
            <div className="flex flex-col items-center justify-center gap-2 px-2 py-6 mb-2">
                <div className="w-16 h-16 relative flex-shrink-0">
                    {/* Reverted filter as requested */}
                    <img src="/logo.png" alt="AF" className="object-contain w-full h-full" />
                </div>
                <span className="font-bold text-lg tracking-tight text-center">AF Outreach</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const isAI = item.href === '/ai-campaigns';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                                isActive
                                    ? "bg-white/10 text-white shadow-lg backdrop-blur-sm"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 transition-colors",
                                isActive
                                    ? (isAI ? "text-purple-400" : "text-blue-400")
                                    : (isAI ? "text-slate-400 group-hover:text-purple-400" : "text-slate-400 group-hover:text-blue-400")
                            )} />
                            <span className="font-medium">{item.label}</span>

                            {isActive && (
                                <div className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full",
                                    isAI
                                        ? "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                        : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                )} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="mt-auto space-y-4">
                <div className="pt-4 border-t border-white/10">
                    <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>

                {/* Developer Credits */}
                <div className="px-4 pb-2 text-xs text-slate-500 flex flex-col items-center text-center">
                    <span>Sviluppato da <br /><span className="text-slate-400 font-medium">Alessandro Federici</span></span>
                    <a
                        href="https://af-automations.framer.website"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <Sparkles className="w-3 h-3" />
                        AF Automations
                    </a>
                </div>
            </div>
        </aside>
    );
}

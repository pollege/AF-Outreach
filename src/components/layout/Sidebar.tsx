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
    Sparkles
} from "lucide-react";

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Megaphone, label: "Campagne", href: "/campaigns" },
    { icon: Users, label: "Leads", href: "/leads" }, // Global Leads view? Or maybe just keep inside campaigns
    { icon: Inbox, label: "Inbox", href: "/inbox" },
    { icon: Settings, label: "Impostazioni", href: "/settings" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-4 top-4 bottom-4 w-64 glass-dark rounded-2xl flex flex-col p-4 z-50 text-slate-100 transition-all duration-300">
            {/* Logo */}
            <div className="flex items-center gap-2 px-2 py-4 mb-6">
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight">ColdAi</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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
                            <item.icon className={cn("w-5 h-5", isActive ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400")} />
                            <span className="font-medium">{item.label}</span>

                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="mt-auto pt-4 border-t border-white/10">
                <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
}

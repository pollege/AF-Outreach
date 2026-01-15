"use client";

import { Bell, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useRealNotifications } from "@/hooks/useRealNotifications";

export function Header({ title, description, subtitle }: { title: string, description?: string, subtitle?: string }) {
    const router = useRouter();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const { notifications, loading } = useRealNotifications();
    const unreadCount = notifications.filter(n => !n.read).length;

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <header className="flex items-center justify-between mb-8 pt-2 relative z-20">
            {/* Backdrop for closing dropdowns */}
            {(showNotifications || showProfileMenu) && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => { setShowNotifications(false); setShowProfileMenu(false); }}
                />
            )}

            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
                {(description || subtitle) && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {description || subtitle}
                    </p>
                )}
                {!description && !subtitle && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-4 relative z-40">
                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
                        className={cn(
                            "relative p-2 rounded-full transition-colors",
                            showNotifications ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-700"
                        )}
                    >
                        <Bell className="w-6 h-6" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50 dark:border-slate-950 animate-pulse" />
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifiche</h3>
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline">Segna lette</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {loading && <p className="p-4 text-center text-sm text-slate-500">Caricamento...</p>}
                                {!loading && notifications.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nessuna notifica</p>}
                                {notifications.map(n => (
                                    <div key={n.id} className={cn(
                                        "p-4 border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative",
                                        !n.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                                    )}>
                                        {!n.read && <div className="absolute left-2 top-5 w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{n.title}</p>
                                        <p className="text-xs text-slate-500 line-clamp-2">{n.desc}</p>
                                        <span className="text-[10px] text-slate-400 mt-2 block">{n.time}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 text-center border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                <button className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium">
                                    Vedi tutte
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Avatar */}
                <div className="relative">
                    <button
                        onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-900 transition-all active:scale-95"
                    >
                        A
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Alex S.</p>
                                <p className="text-xs text-slate-500">alex.staipollege@hotmail.it</p>
                            </div>
                            <div className="p-1">
                                <Link
                                    href="/settings"
                                    onClick={() => setShowProfileMenu(false)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <User className="w-4 h-4" />
                                    Il mio Profilo
                                </Link>
                                <Link
                                    href="/settings"
                                    onClick={() => setShowProfileMenu(false)}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    Impostazioni
                                </Link>
                                <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Esci
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

"use client";

import { Bell } from "lucide-react";

export function Header({ title }: { title: string }) {
    return (
        <header className="flex items-center justify-between mb-8 pt-2">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            <div className="flex items-center gap-4">
                <button className="relative p-2 rounded-full hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-500">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-50 dark:border-slate-950 animate-pulse" />
                </button>

                {/* User Avatar Placeholder */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/10 cursor-pointer">
                    A
                </div>
            </div>
        </header>
    );
}

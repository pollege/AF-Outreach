import { Header } from "@/components/layout/Header";
import { TrendingUp, Users, Mail, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const stats = [
    {
        label: "Email Inviate",
        value: "1,234",
        change: "+12.5%",
        icon: Mail,
        color: "text-blue-500",
        bg: "bg-blue-500/10"
    },
    {
        label: "Open Rate",
        value: "45%",
        change: "+2.1%",
        icon: Users, // Should be Eye potentially
        color: "text-purple-500",
        bg: "bg-purple-500/10"
    },
    {
        label: "Click Rate",
        value: "12%",
        change: "-0.5%",
        icon: MousePointerClick,
        color: "text-amber-500",
        bg: "bg-amber-500/10"
    },
    {
        label: "Risposte",
        value: "28",
        change: "+5.2%",
        icon: TrendingUp,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10"
    }
];

export default function DashboardPage() {
    return (
        <>
            <Header title="Dashboard" />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 dark:border-white/5">
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn("p-3 rounded-xl", stat.bg)}>
                                <stat.icon className={cn("w-6 h-6", stat.color)} />
                            </div>
                            <span className={cn("text-xs font-medium px-2 py-1 rounded-full bg-white/10", stat.change.startsWith('+') ? "text-emerald-400" : "text-rose-400")}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</h3>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Main Content Area - Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Area */}
                <div className="lg:col-span-2 glass dark:glass-dark rounded-2xl p-6 min-h-[400px] border border-white/20 dark:border-white/5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Performance Campagne</h3>
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        Grafico Andamento (Placeholder)
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="glass dark:glass-dark rounded-2xl p-6 min-h-[400px] border border-white/20 dark:border-white/5">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Attività Recente</h3>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                                    MR
                                </div>
                                <div>
                                    <p className="text-sm text-slate-200">Mario Rossi ha risposto</p>
                                    <p className="text-xs text-slate-500">2 min fa</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

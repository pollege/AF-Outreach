"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TrendingUp, Users, Mail, MousePointerClick, Loader2, Sparkles, Edit2, ArrowUpRight, Info } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { CampaignStats } from "@/components/dashboard/CampaignStats";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        leads: 0,
        sent: 0,
        replies: 0,
        openRate: 0,
        replyRate: 0,
        activeCampaigns: 0
    });
    const [braveUsage, setBraveUsage] = useState(0);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [mailAccounts, setMailAccounts] = useState<any[]>([]);
    const [chartData, setChartData] = useState<{ activity: any[], growth: any[] }>({ activity: [], growth: [] });
    const [topCampaigns, setTopCampaigns] = useState<any[]>([]);

    useEffect(() => {
        async function fetchStats() {
            try {
                // Parallel fetching
                const [leadsRes, sentRes, repliesRes, openedRes, activeCampRes, recentRes, accountsRes, usageRes] = await Promise.all([
                    supabase.from('contacts').select('*', { count: 'exact', head: true }),
                    supabase.from('messages').select('*', { count: 'exact', head: true }).or('status.eq.sent,status.eq.opened,status.eq.replied'),
                    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'replied'),
                    supabase.from('messages').select('*', { count: 'exact', head: true }).or('status.eq.opened,status.eq.replied'),
                    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                    supabase.from('messages').select('*, leads(first_name, last_name)').order('created_at', { ascending: false }).limit(5),
                    supabase.from('mail_accounts').select('*').eq('status', 'active'),
                    fetch('/api/usage').then(r => r.json())
                ]);

                const totalSent = sentRes.count || 0;
                const totalOpened = openedRes.count || 0;
                const totalReplied = repliesRes.count || 0;

                setStats({
                    leads: leadsRes.count || 0,
                    sent: totalSent,
                    replies: totalReplied,
                    // Real Open Rate: (Opened + Replied) / Sent
                    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
                    replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
                    activeCampaigns: activeCampRes.count || 0
                });

                if (recentRes.data) setRecentActivity(recentRes.data);
                if (accountsRes.data) setMailAccounts(accountsRes.data);
                if (usageRes && typeof usageRes.usage === 'number') setBraveUsage(usageRes.usage);

                // Fetch Chart Data & Campaigns
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const dateStr = thirtyDaysAgo.toISOString();

                const [msgHistory, leadHistory, campStats] = await Promise.all([
                    supabase.from('messages').select('created_at, status').gte('created_at', dateStr),
                    supabase.from('leads').select('created_at').gte('created_at', dateStr),
                    supabase.from('campaigns').select('*, stats:campaign_stats(*)').eq('status', 'active').limit(5)
                ]);

                // Process Activity Data
                const activityMap = new Map();
                const growthMap = new Map();

                // Initialize last 30 days
                for (let i = 0; i < 30; i++) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
                    activityMap.set(key, { date: key, sent: 0, replies: 0 });
                    growthMap.set(key, { date: key, leads: 0 });
                }

                msgHistory.data?.forEach((m: any) => {
                    const key = new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
                    if (activityMap.has(key)) {
                        const entry = activityMap.get(key);
                        if (m.status === 'sent' || m.status === 'opened' || m.status === 'replied') entry.sent++;
                        if (m.status === 'replied') entry.replies++;
                    }
                });

                leadHistory.data?.forEach((l: any) => {
                    const key = new Date(l.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
                    if (growthMap.has(key)) {
                        growthMap.get(key).leads++;
                    }
                });

                setChartData({
                    activity: Array.from(activityMap.values()).reverse(),
                    growth: Array.from(growthMap.values()).reverse()
                });

                if (campStats.data) setTopCampaigns(campStats.data);

            } catch (e) {
                console.error("Dashboard stats error", e);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const statCards = [
        {
            label: "Campagne Attive",
            value: stats.activeCampaigns,
            icon: Sparkles,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
            description: "In esecuzione"
        },
        {
            label: "Email Inviate",
            value: stats.sent,
            icon: Mail,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            description: "Totale invii"
        },
        {
            label: "Open Rate",
            value: stats.openRate + "%",
            icon: MousePointerClick,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            tooltip: (
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 pointer-events-none text-left leading-relaxed">
                    <strong>Stima al Ribasso:</strong><br />
                    Dato conservativo (Pixel + Risposte).<br />
                    <div className="absolute -bottom-1 left-2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
            )
        },
        {
            label: "Reply Rate",
            value: stats.replyRate + "%",
            icon: TrendingUp, // Reusing TrendingUp for Rate
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            description: "Tasso risposta"
        },
        {
            label: "Risposte",
            value: stats.replies,
            icon: TrendingUp,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            description: "Totale"
        },
        {
            label: "Contatti",
            value: stats.leads,
            icon: Users,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            description: "Database"
        }
    ];

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>;
    }

    return (
        <>
            <Header title="Dashboard" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {statCards.map((stat, i) => (
                    <div key={i} className="glass dark:glass-dark p-4 rounded-xl border border-white/20 dark:border-white/5 relative group overflow-visible">
                        {stat.tooltip && (
                            <div className="absolute top-2 right-2">
                                <div className="relative group/info cursor-help">
                                    <Info className="w-3.5 h-3.5 text-slate-300 hover:text-blue-500 transition-colors" />
                                    {stat.tooltip}
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn("p-2 rounded-lg", stat.bg)}>
                                <stat.icon className={cn("w-4 h-4", stat.color)} />
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium truncate">{stat.label}</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white pl-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <DashboardCharts activityData={chartData.activity} growthData={chartData.growth} />

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Col: Campaign Stats & Mail Health */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-[300px]">
                        <CampaignStats campaigns={topCampaigns} />
                    </div>

                    {/* Mail Account Health */}
                    <div className="glass dark:glass-dark rounded-2xl p-6 min-h-[300px] border border-white/20 dark:border-white/5">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            Stato Invio Account
                        </h3>

                        {mailAccounts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                                <p className="mb-2">Nessun account email collegato.</p>
                                <a href="/settings" className="text-blue-400 hover:underline">Configura ora &rarr;</a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {mailAccounts.map((acc, i) => {
                                    const percent = Math.min(100, Math.round((acc.daily_sent / acc.daily_limit) * 100));
                                    let colorClass = "bg-blue-500";
                                    if (percent > 80) colorClass = "bg-amber-500";
                                    if (percent >= 100) colorClass = "bg-red-500";

                                    return (
                                        <div key={acc.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-[150px]" title={acc.email}>
                                                        {acc.from_name || acc.email}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{acc.email}</p>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className={cn(
                                                        "text-sm font-bold px-2 py-1 rounded-md", // Removed font-mono
                                                        percent >= 100 ? "bg-red-500/10 text-red-500" : "bg-slate-200 dark:bg-white/10"
                                                    )}>
                                                        {acc.daily_sent} / {acc.daily_limit}
                                                    </span>
                                                    <a href="/settings?tab=mail" className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-2 w-full bg-slate-200 dark:bg-black/40 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full transition-all duration-500", colorClass)}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-right mt-1 text-slate-400">
                                                {percent}% utilizzato
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Brave Widget + Recent Activity */}
                <div className="space-y-6">

                    {/* Brave API Widget (Compact) */}
                    <div className="glass dark:glass-dark rounded-2xl p-6 border border-white/20 dark:border-white/5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-orange-500/10">
                                    <Sparkles className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                                        Brave API
                                    </h3>
                                    <a href="https://api-dashboard.search.brave.com/app/dashboard" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline">
                                        Gestisci &rarr;
                                    </a>
                                </div>
                            </div>
                            <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                                braveUsage > 1900 ? "bg-red-100 text-red-600 border-red-200" : "bg-emerald-100 text-emerald-600 border-emerald-200"
                            )}>
                                {braveUsage > 1900 ? "Limit" : "Active"}
                            </span>
                        </div>

                        <div className="mb-3">
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    {braveUsage}
                                </span>
                                <span className="text-sm font-medium text-slate-400">
                                    / 2000
                                </span>
                            </div>
                            <p className="text-xs text-slate-500">Richieste mensili utilizzate</p>
                        </div>

                        <div className="h-2 w-full bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden">
                            <div
                                className={cn("h-full transition-all duration-500",
                                    braveUsage > 1800 ? "bg-red-500" : braveUsage > 1000 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${Math.min((braveUsage / 2000) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="glass dark:glass-dark rounded-2xl p-6 border border-white/20 dark:border-white/5">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Attività Recente</h3>
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? recentActivity.map((msg, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                                        MSG
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-200">
                                            Email a {msg.leads?.first_name || 'Prospect'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(msg.created_at).toLocaleTimeString()} - {msg.status}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-500">Nessuna attività recente</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

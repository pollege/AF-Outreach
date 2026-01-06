"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Sparkles, Loader2, Play, Pause, CheckCircle2, UserPlus, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Type definition based on our schema
type Campaign = {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'completed';
    stats: {
        sent: number;
        opened: number;
        replied: number;
    };
    created_at: string;
    automation_mode: 'review' | 'auto';
};

export default function AICampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('campaigns')
                    .select('*')
                    .eq('enrichment_enabled', true) // Only AI enriched campaigns
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setCampaigns(data || []);
            } catch (err: any) {
                console.error("Error fetching AI campaigns:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchCampaigns();
    }, []);

    return (
        <>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                    </div>
                    <Header title="Campagne AI" />
                </div>
                <Link href="/ai-campaigns/new">
                    <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20">
                        <Sparkles className="w-4 h-4" />
                        Nuova Campagna AI
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 mb-6">
                    Errore caricamento campagne AI: {error}.
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 glass dark:glass-dark rounded-3xl border border-dashed border-purple-500/20">
                    <div className="w-20 h-20 bg-purple-500/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <Sparkles className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Inizia la tua Rivoluzione AI</h3>
                    <p className="text-slate-500 max-w-md text-center mb-8">
                        Crea campagne intelligenti che scrivono email personalizzate in autonomia, arricchendo i dati dei lead dal web.
                    </p>
                    <Link href="/ai-campaigns/new">
                        <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-none shadow-xl shadow-purple-500/20 py-6 px-8 text-lg rounded-xl">
                            <Sparkles className="w-5 h-5 mr-2" />
                            Crea Prima Campagna AI
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign) => (
                        <Link key={campaign.id} href={`/ai-campaigns/${campaign.id}`} className="group">
                            <div className="glass dark:glass-dark p-6 rounded-2xl border border-purple-500/10 hover:border-purple-500/50 transition-all duration-300 h-full flex flex-col hover:shadow-lg hover:shadow-purple-500/10 relative overflow-hidden">
                                {/* Gradient Orb Effect */}
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/30 transition-colors" />

                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md",
                                        campaign.status === 'active' ? "bg-emerald-500/20 text-emerald-500" :
                                            campaign.status === 'draft' ? "bg-slate-500/20 text-slate-500" :
                                                "bg-amber-500/20 text-amber-500"
                                    )}>
                                        {campaign.status === 'active' ? <Play className="w-5 h-5 fill-current" /> :
                                            campaign.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                                <Pause className="w-5 h-5 fill-current" />}
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1",
                                            campaign.automation_mode === 'auto'
                                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                                                : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                                        )}>
                                            {campaign.automation_mode === 'auto' ? (
                                                <><Sparkles className="w-3 h-3" /> AUTO</>
                                            ) : (
                                                <><UserPlus className="w-3 h-3" /> REVIEW</>
                                            )}
                                        </span>
                                        <span className={cn(
                                            "text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wider",
                                            campaign.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                                        )}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-purple-400 transition-colors relative z-10">
                                    {campaign.name}
                                </h3>

                                <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 relative z-10">
                                    <FileText className="w-3 h-3" />
                                    <span>AI Generated Sequence</span>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mt-auto pt-6 border-t border-white/10 relative z-10">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Sent</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">{campaign.stats?.sent || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Open</p>
                                        <p className="font-semibold text-slate-900 dark:text-white text-emerald-400">
                                            {campaign.stats?.sent ? Math.round((campaign.stats.opened / campaign.stats.sent) * 100) : 0}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Reply</p>
                                        <p className="font-semibold text-slate-900 dark:text-white text-blue-400">
                                            {campaign.stats?.sent ? Math.round((campaign.stats.replied / campaign.stats.sent) * 100) : 0}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </>
    );
}

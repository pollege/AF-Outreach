"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Plus, Loader2, Play, Pause, CheckCircle2 } from "lucide-react";
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
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                setLoading(true);
                // We select * from campaigns. 
                // Note: RLS might block this if not authenticated and policies not set to public.
                // We added "Enable all for authenticated users". 
                // If we are not logged in via Supabase Auth, this will return error or empty.

                const { data, error } = await supabase
                    .from('campaigns')
                    .select('*')
                    .neq('enrichment_enabled', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setCampaigns(data || []);
            } catch (err: any) {
                console.error("Error fetching campaigns:", err);
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
                <Header title="Campagne" />
                <Link href="/campaigns/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        Nuova Campagna
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 mb-6">
                    Errore caricamento campagne: {error}. Assicurati di aver eseguito la Migration SQL e di essere loggato (se RLS attivo).
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 glass dark:glass-dark rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Plus className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Nessuna campagna</h3>
                    <p className="text-slate-500 max-w-sm text-center mb-6">Crea la tua prima campagna di cold outreach per iniziare a trovare nuovi clienti.</p>
                    <Link href="/campaigns/new">
                        <Button>Inizia Ora</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign) => (
                        <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="group">
                            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 dark:border-white/5 hover:border-blue-500/50 transition-colors h-full flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        campaign.status === 'active' ? "bg-emerald-500/20 text-emerald-500" :
                                            campaign.status === 'draft' ? "bg-slate-500/20 text-slate-500" :
                                                "bg-amber-500/20 text-amber-500"
                                    )}>
                                        {campaign.status === 'active' ? <Play className="w-5 h-5 fill-current" /> :
                                            campaign.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                                                <Pause className="w-5 h-5 fill-current" />}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wider",
                                        campaign.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                                    )}>
                                        {campaign.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-400 transition-colors">
                                    {campaign.name}
                                </h3>

                                <div className="grid grid-cols-3 gap-4 mt-auto pt-6 border-t border-white/10">
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

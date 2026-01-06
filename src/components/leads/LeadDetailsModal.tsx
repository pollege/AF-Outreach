import { useState } from "react";
import { X, RefreshCw, Trash2, Sparkles, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface LeadDetailsModalProps {
    lead: any;
    isOpen: boolean;
    onClose: () => void;
    onLeadUpdate?: (lead: any) => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose, onLeadUpdate }: LeadDetailsModalProps) {
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    if (!isOpen || !lead) return null;

    const handleAction = async (action: 'enrich' | 'generate' | 'clear') => {
        setLoadingAction(action);
        try {
            if (action === 'clear') {
                // 1. Reset Lead Status & Data
                const { error: updateError } = await supabase.from('leads').update({
                    status: 'new',
                    enrichment_data: null
                }).eq('id', lead.id);

                if (updateError) throw updateError;

                // 2. Delete Generated Messages (Optional but cleaner)
                const { error: deleteError } = await supabase
                    .from('messages')
                    .delete()
                    .eq('lead_id', lead.id)
                    .neq('status', 'sent'); // Don't delete sent messages for safety

                if (deleteError) console.error("Error deleting messages:", deleteError);

                toast.success("Dati arricchimento cancellati");
                if (onLeadUpdate) onLeadUpdate({ ...lead, status: 'new', enrichment_data: null, messages: [] });
                router.refresh();
            } else if (action === 'enrich') {
                const res = await fetch('/api/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId: lead.campaign_id, leadId: lead.id })
                });
                if (!res.ok) throw new Error("Errore API");
                toast.success("Arricchimento rigenerato!");
                // Fetch updated lead
                const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
                if (data && onLeadUpdate) onLeadUpdate(data);
                router.refresh();
            } else if (action === 'generate') {
                const res = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId: lead.campaign_id, leadId: lead.id })
                });
                if (!res.ok) throw new Error("Errore API");
                toast.success("Messaggio rigenerato!");
                const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
                if (data && onLeadUpdate) onLeadUpdate(data);
                router.refresh();
            }
        } catch (e: any) {
            toast.error("Errore azione: " + e.message);
        }
        setLoadingAction(null);
    };

    const enrichment = lead.enrichment_data || {};
    const latestMessage = lead.messages && lead.messages.length > 0 ? lead.messages[0] : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 p-0 overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{lead.first_name} {lead.last_name}</h3>
                            <p className="text-sm text-slate-500">{lead.company_name}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 ml-4">
                            <Button
                                variant="outline" size="sm"
                                disabled={!!loadingAction}
                                onClick={() => handleAction('enrich')}
                                title="Rifai Ricerca Web"
                            >
                                {loadingAction === 'enrich' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                disabled={!!loadingAction}
                                onClick={() => handleAction('generate')}
                                title="Rigenera Messaggio con AI"
                            >
                                {loadingAction === 'generate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            </Button>
                            <Button
                                variant="outline" size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                disabled={!!loadingAction}
                                onClick={() => handleAction('clear')}
                                title="Cancella Dati AI"
                            >
                                {loadingAction === 'clear' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 flex-1">

                    {/* Enrichment Data */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Dati Arricchimento
                        </h4>

                        {enrichment && (
                            <div className="space-y-4">
                                {/* Summary */}
                                {enrichment.summary && (
                                    <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-500/20">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {enrichment.summary}
                                        </p>
                                    </div>
                                )}

                                {/* Recent News */}
                                {enrichment.recent_news && enrichment.recent_news.length > 0 && (
                                    <div>
                                        <span className="text-xs font-medium text-slate-500 block mb-1">Notizie Recenti</span>
                                        <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">
                                            {enrichment.recent_news.map((news: string, i: number) => (
                                                <li key={i}>{news}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Pain Points */}
                                {enrichment.pain_points && enrichment.pain_points.length > 0 && (
                                    <div>
                                        <span className="text-xs font-medium text-slate-500 block mb-1">Pain Points</span>
                                        <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">
                                            {enrichment.pain_points.map((pp: string, i: number) => (
                                                <li key={i}>{pp}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Search Results Links */}
                                {enrichment.search_results && enrichment.search_results.length > 0 && (
                                    <div>
                                        <span className="text-xs font-medium text-slate-500 block mb-1">Fonti Ricerca</span>
                                        <div className="space-y-2">
                                            {enrichment.search_results.map((res: any, i: number) => (
                                                <div key={i} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-500/30 transition-colors">
                                                    <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-purple-600 hover:underline block truncate">
                                                        {res.title}
                                                    </a>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{res.description}</p>
                                                    {res.age && <span className="text-[10px] text-slate-400 mt-1 block">{res.age}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!enrichment.summary && (!enrichment.recent_news || enrichment.recent_news.length === 0) && (!enrichment.pain_points || enrichment.pain_points.length === 0) && (!enrichment.search_results || enrichment.search_results.length === 0) && (
                                    <p className="text-sm text-slate-400 italic">Nessun dato di arricchimento disponibile.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Generated Message */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Messaggio Generato
                        </h4>
                        {latestMessage ? (
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                <div className="mb-2">
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-2">Oggetto:</span>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">{latestMessage.subject}</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-white/10 my-2"></div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: latestMessage.body }}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Nessun messaggio generato ancora.</p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

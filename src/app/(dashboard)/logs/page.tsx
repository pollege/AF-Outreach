
"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Filter,
    Loader2,
    RefreshCw,
    Search,
    MessageCircle,
    Tag,
    ChevronDown,
    MailOpen,
    Eye,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";

export default function LogsPage() {
    // Pagination
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [totalCount, setTotalCount] = useState(0);

    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    // Filters
    const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'failed' | 'sent' | 'queued'>('all');
    const [searchTerm, setSearchTerm] = useState("");

    // Modal
    const [viewingLead, setViewingLead] = useState<any>(null);

    // Initial Fetch (Campaigns)
    useEffect(() => {
        const fetchCampaigns = async () => {
            const { data } = await supabase.from('campaigns').select('id, name, enrichment_enabled');
            if (data) setCampaigns(data);
        };
        fetchCampaigns();
    }, []);

    // Fetch Messages
    const fetchMessages = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('messages')
                .select(`
                    *,
                    leads:lead_id (
                        id, first_name, last_name, email, company_name, status, tags, enrichment_data, linkedin_url, job_title
                    ),
                    campaigns:campaign_id (id, name, enrichment_enabled)
                `, { count: 'exact' });

            if (selectedCampaign !== 'all') {
                query = query.eq('campaign_id', selectedCampaign);
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Pagination
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setMessages(data || []);
            if (count !== null) setTotalCount(count);
        } catch (e: any) {
            toast.error("Errore caricamento logs: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when filters or pagination change
    useEffect(() => {
        fetchMessages();
    }, [selectedCampaign, statusFilter, page, pageSize]);

    // Reset page when filters change
    useEffect(() => {
        setPage(0);
    }, [selectedCampaign, statusFilter]);

    // Retry Action
    const handleRetry = async (messageId: string) => {
        try {
            const { error } = await supabase
                .from('messages')
                .update({ status: 'queued', error_log: null })
                .eq('id', messageId);

            if (error) throw error;

            toast.success("Messaggio accodato per il riinvio");
            // Optimistic update
            setMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, status: 'queued', error_log: null } : m
            ));
        } catch (e: any) {
            toast.error("Errore retry: " + e.message);
        }
    };

    // Filter Logic (Client-side search) - Still useful for quick search within the page
    // BUT for global search we might need server-side search if pagination is on. 
    // For now, let's keep it client side on the fetched page or assume user wants to filter fetched results.
    // actually, normally search and pagination should be server side together. 
    // Given the request complexity, let's keep search client-side for the current page context for simplicity or 
    // if the user wants "Global Search" it requires backend change.
    // The previous implementation was client-side filtering on 100 items. 
    // Let's keeps filtering on the fetched chunk for now to avoid huge refactor, but it's a limitation.
    // Wait, the user asked for pagination because "1000 items appear all at once".
    // I will filter `messages` directly.

    const filteredMessages = messages.filter(msg => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            msg.leads?.email?.toLowerCase().includes(searchLower) ||
            msg.subject?.toLowerCase().includes(searchLower) ||
            msg.leads?.company_name?.toLowerCase().includes(searchLower)
        );
    });

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || 'unknown';

        const badgeConfig: Record<string, { label: string, color: string, icon: any, desc: string }> = {
            'sent': {
                label: 'Inviato',
                color: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-200 dark:border-green-500/20',
                icon: CheckCircle2,
                desc: "Il messaggio è stato inviato correttamente al provider di posta."
            },
            'failed': {
                label: 'Fallito',
                color: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20',
                icon: AlertCircle,
                desc: "L'invio è fallito causa errore tecnico. Controlla il log."
            },
            'queued': {
                label: 'In Coda',
                color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
                icon: Clock,
                desc: "Il messaggio è in coda e verrà processato a breve dal sistema."
            },
            'sending': {
                label: 'In Invio',
                color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
                icon: Loader2,
                desc: "Il messaggio è attualmente in fase di invio."
            },
            'replied': {
                label: 'Risposto',
                color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
                icon: MailOpen,
                desc: "Il lead ha risposto a questa email."
            },
            'opened': {
                label: 'Letto',
                color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
                icon: Eye,
                desc: "Il lead ha aperto e visualizzato l'email."
            },
            'draft': {
                label: 'Bozza',
                color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-white/10',
                icon: null,
                desc: "Il messaggio è salvato come bozza e non è stato inviato."
            },
            'generated': {
                label: 'Generato',
                color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
                icon: Sparkles,
                desc: "Contenuto generato dall'AI, pronto per la revisione o l'invio."
            },
            'researched': {
                label: 'Analizzato',
                color: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
                icon: Search,
                desc: "Dati del lead arricchiti dall'AI, pronto per la generazione."
            },
            'new': {
                label: 'Nuovo',
                color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-white/5',
                icon: null,
                desc: "Lead appena importato o creato."
            }
        };

        const config = badgeConfig[s] || {
            label: status,
            color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-white/10',
            icon: null,
            desc: "Stato sconosciuto"
        };

        const Icon = config.icon;

        return (
            <div className="group/badge relative inline-flex justify-center">
                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium gap-1.5 border cursor-help", config.color)}>
                    {Icon && <Icon className={cn("w-3.5 h-3.5", s === 'sending' && "animate-spin")} />}
                    {config.label}
                </span>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 w-56 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs rounded-xl shadow-xl opacity-0 translate-y-2 group-hover/badge:opacity-100 group-hover/badge:translate-y-0 transition-all pointer-events-none z-50 text-center leading-relaxed">
                    {config.desc}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white dark:border-t-slate-900 drop-shadow-sm"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen pb-20">
            <Header title="Registro Invii" subtitle="Monitora lo stato di tutti i messaggi inviati dal sistema." />

            {/* Filters Bar */}
            <div className="mt-8 mb-6 glass dark:glass-dark p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">

                {/* Left: Filters */}
                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto p-2">
                    {/* Nice Custom Select Wrapper */}
                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Filter className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <select
                            className="h-10 pl-10 pr-10 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all cursor-pointer appearance-none min-w-[240px]"
                            value={selectedCampaign}
                            onChange={(e) => setSelectedCampaign(e.target.value)}
                        >
                            <option value="all">Tutte le Campagne</option>
                            {campaigns.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.enrichment_enabled ? '✨ ' : '📢 '} {c.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden md:block mx-1"></div>

                    {/* Status Tabs */}
                    <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                        {[
                            { id: 'all', label: 'Tutti' },
                            { id: 'failed', label: 'Errori' },
                            { id: 'queued', label: 'In Coda' },
                            { id: 'sent', label: 'Inviati' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setStatusFilter(tab.id as any)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium rounded-lg transition-all",
                                    statusFilter === tab.id
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Search & Refresh */}
                <div className="flex items-center gap-3 w-full xl:w-auto p-2">
                    <div className="relative flex-1 md:flex-initial group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Cerca email, lead, oggetto..."
                            className="pl-9 h-10 w-full md:w-72 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-slate-950 transition-all rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Button
                        variant="outline"
                        onClick={async () => {
                            const toastId = toast.loading("Invio messaggi in coda...");
                            try {
                                await fetch('/api/cron/send');
                                toast.success("Processo invio completato!", { id: toastId });
                                fetchMessages();
                            } catch (e) {
                                toast.error("Errore avvio processo", { id: toastId });
                            }
                        }}
                        className="h-10 px-4 rounded-xl border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        title="Forza invio messaggi in coda"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Processa Coda
                    </Button>

                    <Button variant="outline" size="icon" onClick={fetchMessages} className="h-10 w-10 min-w-[2.5rem] rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4 font-medium w-[180px]">Data & Ora</th>
                            <th className="px-6 py-4 font-medium">Campagna</th>
                            <th className="px-6 py-4 font-medium">Lead & Status</th>
                            <th className="px-6 py-4 font-medium">Dettagli Email</th>
                            <th className="px-6 py-4 font-medium text-center">Stato Invio</th>
                            <th className="px-6 py-4 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? (
                            <tr><td colSpan={6} className="p-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" /><p className="text-slate-400">Caricamento registro...</p></td></tr>
                        ) : filteredMessages.length === 0 ? (
                            <tr><td colSpan={6} className="p-16 text-center text-slate-500 italic">
                                <div className="flex flex-col items-center gap-2">
                                    <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                                    <p>Nessun messaggio trovato.</p>
                                    <p className="text-xs text-slate-400">Prova a cambiare i filtri di ricerca.</p>
                                </div>
                            </td></tr>
                        ) : (
                            filteredMessages.map((msg) => (
                                <tr
                                    key={msg.id}
                                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] group transition-colors cursor-pointer"
                                    onDoubleClick={() => setViewingLead({
                                        ...msg.leads,
                                        id: msg.lead_id,
                                        campaign_id: msg.campaign_id,
                                        messages: [msg], // Inject current message
                                        _enrichmentEnabled: msg.campaigns?.enrichment_enabled
                                    })}
                                >
                                    {/* Date */}
                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap align-top">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                {new Date(msg.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Campaign */}
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex items-center gap-2 mb-1">
                                            {msg.campaigns?.enrichment_enabled ?
                                                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> :
                                                <Megaphone className="w-3.5 h-3.5 text-blue-500" />
                                            }
                                            <span className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]" title={msg.campaigns?.name}>
                                                {msg.campaigns?.name}
                                            </span>
                                        </div>
                                        <span className={cn(
                                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider",
                                            msg.campaigns?.enrichment_enabled
                                                ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-500/20"
                                                : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-500/20"
                                        )}>
                                            {msg.campaigns?.enrichment_enabled ? 'AI Outreach' : 'Standard'}
                                        </span>
                                    </td>

                                    {/* Lead */}
                                    <td className="px-6 py-4 align-top">
                                        <div className="flex flex-col gap-1.5">
                                            <div>
                                                <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                    {msg.leads?.first_name} {msg.leads?.last_name}

                                                    {/* Replied Badge */}
                                                    {msg.leads?.status === 'replied' && ( // Assuming 'replied' is the status
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold border border-green-200 dark:border-green-800">
                                                            <MailOpen className="w-3 h-3 mr-1" />
                                                            Risposto
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate max-w-[180px]">
                                                    {msg.leads?.company_name}
                                                </div>
                                            </div>

                                            {/* Tags */}
                                            {msg.leads?.tags && msg.leads.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {msg.leads.tags.slice(0, 2).map((tag: string) => (
                                                        <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/10">
                                                            <Tag className="w-2.5 h-2.5 mr-1 opacity-50" />
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {msg.leads.tags.length > 2 && (
                                                        <span className="text-[10px] text-slate-400">+{msg.leads.tags.length - 2}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Subject / Error */}
                                    <td className="px-6 py-4 align-top max-w-[300px]">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate" title={msg.subject}>
                                                {msg.subject || "(Nessun oggetto)"}
                                            </div>

                                            {/* Error Log Display */}
                                            {msg.error_log && (
                                                <div className="mt-1 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/30 text-xs text-red-600 dark:text-red-400 font-mono break-all group-hover:bg-red-100 dark:group-hover:bg-red-900/20 transition-colors cursor-help">
                                                    <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" />
                                                    {msg.error_log}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4 align-top text-center">
                                        {getStatusBadge(msg.status)}
                                        {msg.opened_at && (
                                            <div className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-medium animate-in fade-in">
                                                <Eye className="w-3 h-3" /> Letta
                                            </div>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 align-top text-right">
                                        <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {/* Details Button */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                                                onClick={() => setViewingLead({
                                                    ...msg.leads,
                                                    id: msg.lead_id,
                                                    campaign_id: msg.campaign_id,
                                                    messages: [msg], // Inject current message
                                                    _enrichmentEnabled: msg.campaigns?.enrichment_enabled
                                                })}
                                                title="Vedi Lead"
                                            >
                                                <Eye className="w-4 h-4 text-slate-400 hover:text-blue-500" />
                                            </Button>

                                            {(msg.status === 'failed' || msg.status === 'sending') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                                    onClick={() => handleRetry(msg.id)}
                                                    title="Riprova Invio"
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1.5" />
                                                    Riprova
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                    <span>Mostra</span>
                    <select
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>risultati su {totalCount}</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="min-w-[3rem] text-center">
                        Pag. {page + 1} di {Math.max(1, Math.ceil(totalCount / pageSize))}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={(page + 1) * pageSize >= totalCount}
                        onClick={() => setPage(p => p + 1)}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Reuse Lead Details Modal for consistency */}
            {viewingLead && (
                <LeadDetailsModal
                    isOpen={!!viewingLead}
                    lead={viewingLead}
                    onClose={() => setViewingLead(null)}
                    enrichmentEnabled={viewingLead._enrichmentEnabled}
                    onLeadUpdate={(updatedLead) => {
                        setViewingLead({ ...updatedLead, _enrichmentEnabled: viewingLead._enrichmentEnabled });
                        fetchMessages(); // Refresh background list
                    }}
                />
            )}
        </div>
    );
}

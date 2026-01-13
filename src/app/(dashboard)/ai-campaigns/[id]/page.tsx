"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Users, BarChart3, Settings, Search, Timer, Sparkles, Bot, BrainCircuit, AlertTriangle, Target, Newspaper, Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Papa from "papaparse";
import { LeadEditor } from "@/components/leads/LeadEditor";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";
import { EnrichmentSettingsModal } from "@/components/campaigns/EnrichmentSettingsModal";
import { ContactPickerModal } from "@/components/leads/ContactPickerModal";
import { Edit2, Eye, Database } from "lucide-react";
import { toast } from "sonner";

export default function AICampaignDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [campaign, setCampaign] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'import' | 'sequence' | 'settings'>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        async function fetchCampaign() {
            const [campaignRes, leadsRes, sentRes] = await Promise.all([
                supabase.from('campaigns').select('*').eq('id', id).single(),
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('campaign_id', id),
                supabase.from('messages').select('*', { count: 'exact', head: true }).eq('campaign_id', id).or('status.eq.sent,status.eq.sending')
            ]);

            if (campaignRes.data) {
                // FORCE REDIRECT if standard campaign
                if (!campaignRes.data.enrichment_enabled) {
                    router.push(`/campaigns/${id}`);
                    return;
                }

                setCampaign({
                    ...campaignRes.data,
                    stats: {
                        leads: leadsRes.count || 0,
                        sent: sentRes.count || 0,
                        open_rate: 0
                    }
                });
            }
            setLoading(false);
        }
        fetchCampaign();
    }, [id]);

    const togglePause = async () => {
        if (!campaign) return;
        const newStatus = campaign.status === 'active' ? 'paused' : 'active';

        const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', id);

        if (error) {
            toast.error("Errore aggiornamento status");
        } else {
            setCampaign({ ...campaign, status: newStatus });
            toast.success(newStatus === 'active' ? "Campagna attivata!" : "Campagna in pausa");
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;
    if (!campaign) return <div className="p-8">Campagna AI non trovata</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
                    </div>

                    <div className="flex gap-2">
                        <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-mono uppercase border",
                            campaign.status === 'active' ? "bg-green-100/50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" :
                                campaign.status === 'paused' ? "bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" :
                                    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        )}>
                            {campaign.status}
                        </span>

                        <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-mono uppercase border flex items-center gap-1",
                            campaign.automation_mode === 'auto'
                                ? "bg-purple-100/50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"
                                : "bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                        )}>
                            {campaign.automation_mode === 'auto' ? <Sparkles className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            {campaign.automation_mode}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={togglePause}>
                        {campaign.status === 'active' ? 'Metti in Pausa' : 'Attiva Campagna'}
                    </Button>
                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => setActiveTab('settings')}>Configura AI</Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-6 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Dashboard AI', icon: BrainCircuit },
                    { id: 'leads', label: 'Leads & Enrichment', icon: Users },
                    { id: 'import', label: 'Importa Dati', icon: Upload },
                    { id: 'sequence', label: 'Strategia & Contenuto', icon: Bot }, // Renamed for AI context
                    { id: 'settings', label: 'Impostazioni', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer",
                            activeTab === tab.id
                                ? "border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-900/10"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* AI Workflow Info Box */}
            {/* AI Workflow Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <BrainCircuit className="w-24 h-24 text-blue-500" />
                </div>
                <div className="flex gap-4 relative z-10">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg h-fit">
                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-1">Workflow AI Guidato</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3 max-w-3xl">
                            Automatizza la personalizzazione delle tue campagne in 3 passaggi:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/60 dark:bg-black/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">1. Importa & Arricchisci</div>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Carica i tuoi lead. L'AI cercherà in autonomia news, informazioni aziendali e persone chiave per ogni contatto.
                                </p>
                            </div>
                            <div className="bg-white/60 dark:bg-black/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">2. Generazione Smart</div>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Crea messaggi iper-personalizzati basati sui dati raccolti. In modalità <em>Revisione</em> puoi controllarli prima dell'invio.
                                </p>
                            </div>
                            <div className="bg-white/60 dark:bg-black/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">3. Controllo & Invio</div>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Revisiona le bozze ed approvale con un click. Il sistema gestirà l'invio ottimizzato per evitare lo spam.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab campaign={campaign} />}
                {activeTab === 'leads' && <LeadsTab campaignId={id} />}
                {activeTab === 'import' && <ImportTab campaignId={id} onImportSuccess={() => setActiveTab('leads')} />}
                {activeTab === 'sequence' && <AISequenceTab campaign={campaign} onUpdate={(c) => setCampaign(c)} />}
                {activeTab === 'settings' && <SettingsTab campaign={campaign} onUpdate={(c) => setCampaign(c)} />}
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// AI Sequence Tab (Specialized)
// ------------------------------------------------------------------
function AISequenceTab({ campaign, onUpdate }: { campaign: any, onUpdate: (c: any) => void }) {
    const [marketingGoal, setMarketingGoal] = useState(campaign.email_template?.body_template || "");
    const [subject, setSubject] = useState(campaign.email_template?.subject_template || "");
    const [saving, setSaving] = useState(false);
    const mode = campaign.email_template?.mode || 'template';

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('campaigns').update({
            email_template: {
                ...campaign.email_template,
                subject_template: subject,
                body_template: mode === 'ai_generated' ? marketingGoal : campaign.email_template.body_template, // Logic valid only for ai_generated for now
            }
        }).eq('id', campaign.id);

        if (error) {
            toast.error("Errore salvataggio: " + error.message);
        } else {
            // Update local state
            onUpdate({
                ...campaign,
                email_template: {
                    ...campaign.email_template,
                    subject_template: subject,
                    body_template: marketingGoal
                }
            });
            toast.success("Strategia aggiornata con successo!");
        }
        setSaving(false);
    };

    if (mode !== 'ai_generated') {
        return (
            <div className="p-8 text-center text-slate-500 glass dark:glass-dark rounded-xl border border-dashed">
                <SwitchToAIMode />
                {/* Fallback to standard message if somehow mixed, but we forced consistency */}
                <p className="mt-4">Questa campagna usa un template fisso ("Standard AI"). Vai nelle impostazioni se vuoi cambiare modalità.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 p-6 rounded-2xl flex items-start gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-800 rounded-xl text-purple-600 dark:text-purple-200">
                    <Bot className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">AI Campaign Brain</h3>
                    <p className="text-purple-700 dark:text-purple-300 text-sm mt-1">
                        In questa modalità, non modifichi il testo esatto dell'email. Modifichi il "cervello" dell'AI definendo l'obiettivo.
                        L'AI genererà un messaggio unico per ogni lead basandosi sui dati arricchiti.
                    </p>
                </div>
            </div>

            <div className="glass dark:glass-dark p-8 rounded-2xl border border-white/20">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Obiettivo Marketing & Istruzioni Prompt
                        </label>
                        <textarea
                            className="w-full min-h-[200px] p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 focus:ring-2 focus:ring-purple-500 focus:outline-none text-base leading-relaxed"
                            value={marketingGoal}
                            onChange={(e) => setMarketingGoal(e.target.value)}
                            placeholder="Descrivi l'obiettivo della campagna..."
                        />
                        <p className="text-sm text-slate-500 mt-2">
                            Suggerimento: Sii specifico sul tono (es. "professionale ma amichevole"), sulla lunghezza ("max 100 parole") e sulla Call to Action ("chiedi 15 min di call").
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Oggetto (Template Base)
                        </label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="border-purple-200 dark:border-purple-500/30 focus:border-purple-500"
                        />
                        <p className="text-sm text-slate-500 mt-2">
                            L'AI userà questo come base, ma potrebbe adattarlo se trova informazioni rilevanti (es. nome azienda o news recenti).
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="text-sm text-slate-400 italic">
                            Le modifiche avranno effetto sui prossimi lead processati.
                        </div>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                            {saving ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Aggiorna Strategia AI
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SwitchToAIMode() {
    return null; // Placeholder
}

// ------------------------------------------------------------------
// Other Tabs (Reused/Simplified)
// ------------------------------------------------------------------

function OverviewTab({ campaign }: { campaign: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Contatti da Arricchire</h3>
                <p className="text-3xl font-bold mt-2">{campaign.stats?.leads || 0}</p>
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Email Generate</h3>
                <p className="text-3xl font-bold mt-2 text-purple-600 dark:text-purple-400">{campaign.stats?.sent || 0}</p>
                {/* Note: 'sent' might be 'generated' but effectively sent in this MVP */}
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Tasso Risposta</h3>
                <p className="text-3xl font-bold mt-2 text-blue-400">0%</p>
            </div>
        </div>
    )
}

function LeadsTab({ campaignId }: { campaignId: string }) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState<any>(null); // State for modal
    const [viewingLead, setViewingLead] = useState<any>(null); // State for details
    const [searchTerm, setSearchTerm] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [enrichingId, setEnrichingId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const router = useRouter();

    const handleImportFromDB = async (contacts: any[]) => {
        const newLeads = contacts.map(contact => ({
            campaign_id: campaignId,
            contact_id: contact.id,
            status: 'new',
            lead_score: 0,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            company_name: contact.company_name,
            job_title: contact.job_title,
            linkedin_url: contact.linkedin_url
        }));

        const { error } = await supabase.from('leads').insert(newLeads);

        if (error) {
            console.error('Import error details:', JSON.stringify(error, null, 2));
            toast.error("Errore importazione: " + (error.message || "Errore sconosciuto"));
        } else {
            const { data: newLeads } = await supabase
                .from('leads')
                .select('*, messages(*)')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });
            setLeads(newLeads || []);
            toast.success(`Importati ${contacts.length} leads`);
        }
    };

    const handleEnrich = async () => {
        setEnriching(true);
        try {
            const res = await fetch('/api/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });
            const data = await res.json();
            if (data.brave_credits) {
                localStorage.setItem('brave_credits', data.brave_credits);
                window.dispatchEvent(new Event('brave-credits-updated'));
            }
            if (!res.ok) throw new Error(data.error || 'Errore sconosciuto');

            toast.success(`Analisi completata!`, {
                description: `${data.count} lead arricchiti con successo.${data.failed > 0 ? ` (${data.failed} falliti)` : ''}`
            });

            // Refresh leads locally
            const { data: newLeads } = await supabase
                .from('leads')
                .select('*, messages(*)')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });
            setLeads(newLeads || []);
            router.refresh(); // Refresh server components if any
        } catch (e: any) {
            toast.error("Errore durante l'analisi", { description: e.message });
        }
        setEnriching(false);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore sconosciuto');

            toast.success(`Generazione completata!`, {
                description: `${data.count} messaggi creati.`
            });

            // Refresh leads locally
            const { data: newLeads } = await supabase
                .from('leads')
                .select('*, messages(*)')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });
            setLeads(newLeads || []);
            router.refresh();
        } catch (e: any) {
            toast.error("Errore durante la generazione", { description: e.message });
        }
        setGenerating(false);
    };

    useEffect(() => {
        async function fetchLeads() {
            const { data } = await supabase
                .from('leads')
                .select('*, messages(*)')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });
            setLeads(data || []);
            setLoading(false);
        }
        fetchLeads();
    }, [campaignId]);

    const handleSingleEnrich = async (lead: any, overrideConfig?: any) => {
        setEnrichingId(lead.id);
        try {
            // 1. Enrich
            toast.loading("Analisi in corso...", { id: 'single-enrich' });
            const enrichRes = await fetch('/api/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId,
                    leadId: lead.id,
                    enrichmentConfig: overrideConfig // Pass override config
                })
            });
            const enrichData = await enrichRes.json();
            if (enrichData.brave_credits) {
                localStorage.setItem('brave_credits', enrichData.brave_credits);
                window.dispatchEvent(new Event('brave-credits-updated'));
            }
            if (!enrichRes.ok) throw new Error(enrichData.error || "Errore durante l'analisi");

            // 2. Generate
            toast.loading("Generazione bozza in corso...", { id: 'single-enrich' });
            const genRes = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, leadId: lead.id })
            });
            if (!genRes.ok) throw new Error("Errore durante la generazione");

            toast.success("Lead arricchito e messaggio generato!", { id: 'single-enrich' });

            // 3. Refresh single lead
            const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
            if (data) handleSaveLead(data);
            router.refresh();
        } catch (e: any) {
            toast.error("Errore: " + e.message, { id: 'single-enrich' });
        }
        setEnrichingId(null);
    };

    const handleSaveLead = (updatedLead: any) => {
        setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
        if (viewingLead && viewingLead.id === updatedLead.id) {
            setViewingLead(updatedLead);
        }
    };

    const translateStatus = (status: string) => {
        if (status === 'draft') return 'Bozza';
        if (status === 'queued') return 'In Coda AI';
        if (status === 'sent') return 'Inviato';
        if (status === 'new') return 'Da Elaborare';
        if (status === 'researched') return 'Arricchito';
        if (status === 'message_generated') return 'Generato';
        return status;
    };

    const filteredLeads = leads.filter(lead =>
        (lead.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (lead.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (lead.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    const [lastClick, setLastClick] = useState<{ id: string, time: number } | null>(null);
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

    const isDrag = (e: React.MouseEvent) => {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        return dx > 5 || dy > 5;
    };

    const handleRowClick = (lead: any, e: React.MouseEvent) => {
        if (isDrag(e)) return;
        setViewingLead(lead);
    };

    const handleCellClick = (e: React.MouseEvent, lead: any) => {
        e.stopPropagation();

        if (isDrag(e)) {
            setLastClick(null);
            return;
        }

        const now = Date.now();
        if (lastClick && lastClick.id === lead.id && now - lastClick.time < 200) {
            setViewingLead(lead);
            setLastClick(null);
        } else {
            setLastClick({ id: lead.id, time: now });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="flex gap-4 items-center w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Cerca lead..."
                            className="pl-9 bg-white dark:bg-black/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => {
                        if (leads.length === 0) return toast.error("Nessun lead da esportare");

                        // Flatten data for CSV
                        const csvData = leads.map(l => ({
                            FirstName: l.first_name,
                            LastName: l.last_name,
                            Company: l.company_name,
                            Email: l.email,
                            Status: l.status,
                            Enrichment_News: l.enrichment_data?.recent_news?.join(' | ') || '',
                            Enrichment_PainPoints: l.enrichment_data?.pain_points?.join(' | ') || '',
                            AI_Subject: l.messages?.[0]?.subject || '',
                            AI_Message: l.messages?.[0]?.body || '',
                            LastUpdated: l.updated_at
                        }));

                        const csv = Papa.unparse(csvData);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `campaign_export_${campaignId}_${new Date().toISOString().slice(0, 10)}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("Export completato!");
                    }}>
                        <Upload className="w-4 h-4 mr-2 rotate-180" /> {/* Rotated upload icon serves as download */}
                        Esporta CSV
                    </Button>

                    <div className="h-6 w-px bg-slate-300 dark:bg-white/20 mx-2 hidden md:block" />

                    <Button
                        size="sm"
                        disabled={enriching || generating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-500/20"
                        onClick={handleEnrich}
                    >
                        {enriching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {enriching ? 'Analisi...' : 'Analizza Nuovi Lead'}
                    </Button>

                    <Button
                        size="sm"
                        disabled={enriching || generating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-500/20"
                        onClick={handleGenerate}
                    >
                        {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                        {generating ? 'Generazione...' : 'Genera Bozze'}
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nome</th>
                            <th className="px-4 py-3 font-medium">Azienda</th>
                            <th className="px-4 py-3 font-medium">Tipo Enrichment</th>
                            <th className="px-4 py-3 font-medium">AI Status</th>
                            <th className="px-4 py-3 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={4} className="p-4 text-center">Caricamento AI Brain...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nessun lead. Importa CSV per iniziare l'arricchimento.</td></tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-white/5 group cursor-pointer"
                                    onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                    onClick={(e) => handleRowClick(lead, e)}>
                                    <td
                                        className="px-4 py-3 font-medium cursor-default"
                                        onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                        onClick={(e) => handleCellClick(e, lead)}
                                    >
                                        {lead.first_name} {lead.last_name}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-slate-500 cursor-default"
                                        onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                        onClick={(e) => handleCellClick(e, lead)}
                                    >
                                        {lead.company_name}
                                    </td>
                                    <td className="px-4 py-3">
                                        {lead.enrichment_data?.type ? (
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium uppercase border flex items-center gap-1 w-fit",
                                                lead.enrichment_data.type === 'risks' ? "bg-red-50 text-red-600 border-red-200" :
                                                    lead.enrichment_data.type === 'pain_points' ? "bg-amber-50 text-amber-600 border-amber-200" :
                                                        lead.enrichment_data.type === 'news' ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                            "bg-slate-50 text-slate-600 border-slate-200"
                                            )}>
                                                {lead.enrichment_data.type === 'risks' ? <AlertTriangle className="w-3 h-3" /> :
                                                    lead.enrichment_data.type === 'pain_points' ? <Target className="w-3 h-3" /> :
                                                        lead.enrichment_data.type === 'news' ? <Newspaper className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                                                {lead.enrichment_data.type === 'generic' ? 'GENERICA' :
                                                    lead.enrichment_data.type === 'news' ? 'NOTIZIE' :
                                                        lead.enrichment_data.type === 'pain_points' ? 'SFIDE' :
                                                            lead.enrichment_data.type === 'risks' ? 'RISCHI' : lead.enrichment_data.type.toUpperCase()}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-medium uppercase border",
                                            lead.status === 'researched' || lead.enrichment_data ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-600 border-slate-200"
                                        )}>
                                            {translateStatus(lead.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleSingleEnrich(lead); }}
                                            disabled={enrichingId === lead.id}
                                            className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-50"
                                            title="Arricchisci Singolarmente"
                                        >
                                            {enrichingId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setViewingLead(lead) }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-purple-500"><Eye className="w-4 h-4" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingLead(lead) }} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <LeadEditor lead={editingLead} isOpen={!!editingLead} onClose={() => setEditingLead(null)} onSave={handleSaveLead} />
            <LeadDetailsModal
                lead={viewingLead}
                isOpen={!!viewingLead}
                onClose={() => setViewingLead(null)}
                onLeadUpdate={handleSaveLead}
                enrichmentEnabled={true}
                onEnrich={handleSingleEnrich}
            />
        </div >
    )
}

// Reuse ImportTab and SettingsTab as they are generic enough, just updating Settings slightly if needed
function ImportTab({ campaignId, onImportSuccess }: { campaignId: string, onImportSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    // DB Import State
    const [isDbImportOpen, setIsDbImportOpen] = useState(false);
    const [existingContactIds, setExistingContactIds] = useState<string[]>([]);
    const [loadingExisting, setLoadingExisting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            Papa.parse(f, {
                header: true,
                preview: 5,
                skipEmptyLines: true,
                complete: (results) => {
                    setPreview(results.data);
                }
            });
        }
    };

    const handleOpenDbImport = async () => {
        setLoadingExisting(true);
        // Fetch existing lead contact IDs to filter selection
        const { data } = await supabase.from('leads').select('contact_id').eq('campaign_id', campaignId);
        if (data) {
            setExistingContactIds(data.map(l => l.contact_id).filter(Boolean));
        }
        setLoadingExisting(false);
        setIsDbImportOpen(true);
    };

    const handleImportFromDB = async (contacts: any[]) => {
        const newLeads = contacts.map(contact => ({
            campaign_id: campaignId,
            contact_id: contact.id,
            status: 'new',
            lead_score: 0,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            company_name: contact.company_name,
            job_title: contact.job_title,
            linkedin_url: contact.linkedin_url
        }));

        const { error } = await supabase.from('leads').insert(newLeads);

        if (error) {
            console.error('Import error details:', JSON.stringify(error, null, 2));
            toast.error("Errore importazione: " + (error.message || "Errore sconosciuto"));
        } else {
            toast.success(`Importati ${contacts.length} leads dal Database`);
            onImportSuccess();
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setProgress(0);

        try {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const totalRows = results.data.length;

                    // 1. Pre-process CSV rows
                    const processedRows = results.data.map((row: any) => {
                        // Normalize Keys
                        const normalizedRow: any = {};
                        Object.keys(row).forEach(key => {
                            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                            normalizedRow[cleanKey] = row[key];
                        });

                        const findVal = (variations: string[]) => {
                            for (const v of variations) {
                                if (normalizedRow[v]) return normalizedRow[v];
                            }
                            return null;
                        };

                        const email = findVal(['email', 'mail', 'e-mail']);
                        if (!email) return null; // Skip invalid rows

                        return {
                            email: email,
                            first_name: findVal(['firstname', 'first_name', 'nome', 'name']),
                            last_name: findVal(['lastname', 'last_name', 'cognome', 'surname']),
                            company_name: findVal(['companyname', 'company_name', 'company', 'azienda']),
                            job_title: findVal(['jobtitle', 'job_title', 'role', 'position', 'title']),
                            linkedin_url: findVal(['linkedin', 'linkedinurl', 'linkedin_url', 'website']),

                            // Custom Fields for Contact
                            raw_row: row
                        };
                    }).filter(r => r !== null);

                    if (processedRows.length === 0) {
                        toast.error("Nessun lead valido trovato (Email mancanti).");
                        setUploading(false);
                        return;
                    }

                    // 2. Prepare Contacts Payload (Unique Emails)
                    // We use a Map to keep the "last" occurrence or just keys
                    const contactsMap = new Map();
                    const customFieldKeysToIgnore = ['firstname', 'first_name', 'nome', 'name', 'lastname', 'last_name', 'cognome', 'surname', 'email', 'mail', 'e-mail', 'companyname', 'company_name', 'company', 'azienda', 'jobtitle', 'job_title', 'role', 'position', 'title', 'linkedin', 'linkedinurl', 'linkedin_url'];

                    processedRows.forEach((p: any) => {
                        // Extract custom fields for this specific contact
                        const customFields: any = {};
                        Object.keys(p.raw_row).forEach(originalKey => {
                            const cleanKey = originalKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (!customFieldKeysToIgnore.includes(cleanKey)) {
                                customFields[originalKey] = p.raw_row[originalKey];
                            }
                        });

                        contactsMap.set(p.email, {
                            email: p.email,
                            first_name: p.first_name,
                            last_name: p.last_name,
                            company_name: p.company_name,
                            job_title: p.job_title,
                            linkedin_url: p.linkedin_url,
                            custom_fields: customFields
                        });
                    });

                    const uniqueContacts = Array.from(contactsMap.values());

                    // 3. Upsert Contacts & Fetch IDs
                    // Chunking for contacts
                    const CHUNK_SIZE = 50;
                    const contactChunks = [];
                    for (let i = 0; i < uniqueContacts.length; i += CHUNK_SIZE) {
                        contactChunks.push(uniqueContacts.slice(i, i + CHUNK_SIZE));
                    }

                    let processedCount = 0;

                    // We need a map of Email -> UUID to link later
                    const emailToIdMap = new Map<string, string>();

                    for (const chunk of contactChunks) {
                        // Upsert contacts
                        const { error: upsertError } = await supabase
                            .from('contacts')
                            .upsert(chunk, { onConflict: 'email', ignoreDuplicates: false }); // Update existing contacts with new info? or true to keep old? let's update (false)

                        if (upsertError) {
                            console.error("Contact Upsert Error", upsertError);
                            // Continue?
                        }

                        // Fetch IDs for this chunk (we need to fetch by email)
                        const emails = chunk.map((c: any) => c.email);
                        const { data: fetchedContacts } = await supabase
                            .from('contacts')
                            .select('id, email')
                            .in('email', emails);

                        if (fetchedContacts) {
                            fetchedContacts.forEach((fan: any) => {
                                emailToIdMap.set(fan.email, fan.id);
                            });
                        }

                        processedCount += chunk.length;
                        setProgress(Math.round((processedCount / (uniqueContacts.length * 2)) * 100)); // First half of progress
                    }

                    // 4. Insert Campaign Leads (Links)
                    const leadsPayload = processedRows.map((p: any) => {
                        const contactId = emailToIdMap.get(p.email);
                        if (!contactId) return null;

                        return {
                            campaign_id: campaignId,
                            contact_id: contactId,
                            status: 'new',
                            // We duplicate these for now for backward compatibility, but eventually we'll remove them
                            email: p.email,
                            first_name: p.first_name,
                            last_name: p.last_name,
                            company_name: p.company_name
                        };
                    }).filter((l: any) => l !== null);

                    const leadsChunks = [];
                    for (let i = 0; i < leadsPayload.length; i += CHUNK_SIZE) {
                        leadsChunks.push(leadsPayload.slice(i, i + CHUNK_SIZE));
                    }

                    let insertedLeadsCount = 0;
                    let skippedCount = 0;

                    for (const chunk of leadsChunks) {
                        const { data, error } = await supabase
                            .from('leads')
                            .upsert(chunk, { onConflict: 'email, campaign_id', ignoreDuplicates: true })
                            .select();

                        if (error) console.error("Leads Insert Error", error);
                        if (data) insertedLeadsCount += data.length;

                        processedCount += chunk.length;
                        // Normalize progress to max 100
                        const currentProg = Math.round(50 + (processedCount / (uniqueContacts.length * 2)) * 50);
                        setProgress(Math.min(currentProg, 100));
                    }

                    setUploading(false);
                    skippedCount = totalRows - insertedLeadsCount;

                    toast.success(
                        ((<div className="flex flex-col gap-1">
                            <span className="font-semibold">Importazione completata (Global Architecture)!</span>
                            <span className="text-xs">
                                ✅ {insertedLeadsCount} collegati
                                <br />
                                ⚠️ {skippedCount} già presenti
                            </span>
                        </div>) as any),
                        { duration: 5000 }
                    );
                    onImportSuccess();
                }
            });
        } catch (e: any) {
            toast.error("Errore: " + e.message);
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6">Scegli la fonte dei dati</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option 2: Database */}
                <div
                    onClick={handleOpenDbImport}
                    className="group border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500"
                >
                    <div className="p-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 mb-4 group-hover:scale-110 transition-transform">
                        {loadingExisting ? <Loader2 className="w-8 h-8 animate-spin" /> : <Database className="w-8 h-8" />}
                    </div>
                    <h3 className="font-semibold text-lg text-indigo-900 dark:text-indigo-100">Da Database Contatti</h3>
                    <p className="text-sm text-indigo-500/80 mt-2 max-w-xs">
                        Seleziona dai contatti già presenti nel tuo CRM (o importati da estensioni).
                    </p>
                    <Button variant="ghost" className="mt-4 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                        Sfoglia Database &rarr;
                    </Button>
                </div>

                {/* Option 1: CSV */}
                <div className="border-2 border-dashed border-purple-300 dark:border-purple-700/50 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer relative">
                    <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
                    <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="font-semibold text-lg text-purple-900 dark:text-purple-100">Carica File CSV</h3>
                    <p className="text-sm text-purple-500/80 mt-2 max-w-xs">
                        Carica un file .csv con colonne: email, nome, azienda, etc.
                    </p>
                    {file && <p className="mt-4 font-medium text-purple-600 bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-full text-sm">{file.name}</p>}
                </div>
            </div>

            {/* CSV Preview Section */}
            {preview.length > 0 && (
                <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8 animate-in fade-in slide-in-from-bottom-4">
                    <h4 className="font-medium text-slate-800 dark:text-white mb-4">Anteprima Import CSV</h4>
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-800">
                        <pre className="text-xs text-slate-600 dark:text-slate-400">{JSON.stringify(preview, null, 2)}</pre>
                    </div>

                    <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-lg py-6" onClick={handleUpload} disabled={uploading}>
                        {uploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="w-5 h-5 mr-2" />}
                        Importa e Analizza {preview.length} Lead
                    </Button>
                </div>
            )}

            <ContactPickerModal
                isOpen={isDbImportOpen}
                onClose={() => setIsDbImportOpen(false)}
                onImport={handleImportFromDB}
                existingLeadContactIds={existingContactIds}
            />
        </div>
    )
}

function SettingsTab({ campaign, onUpdate }: { campaign: any, onUpdate: (c: any) => void }) {
    const [mailAccounts, setMailAccounts] = useState<any[]>([]);
    const [isEnrichmentSettingsOpen, setIsEnrichmentSettingsOpen] = useState(false);
    const [apiUsage, setApiUsage] = useState<number>(0);

    const [formData, setFormData] = useState({
        name: campaign.name,
        description: campaign.description || '',
        tracking_enabled: campaign.tracking_enabled ?? true,
        sender_account_id: campaign.sender_account_id || 'auto',
        // Limits defaults
        daily_limit: campaign.sending_limits?.daily_limit ?? 50,
        hourly_limit: campaign.sending_limits?.hourly_limit ?? 10,
        // Schedule defaults
        start_time: campaign.sending_limits?.start_time ?? '09:00',
        end_time: campaign.sending_limits?.end_time ?? '18:00',
        // AI Defaults
        automation_mode: campaign.automation_mode || 'review',
        enrichment_config: campaign.enrichment_config || { type: 'generic' }
    });

    useEffect(() => {
        const fetchAccounts = async () => {
            const { data } = await supabase.from('mail_accounts').select('id, email, from_name, daily_limit').eq('status', 'active');
            if (data) setMailAccounts(data);
        };
        fetchAccounts();

        // Fetch API Usage
        fetch('/api/usage')
            .then(res => res.json())
            .then(data => setApiUsage(data.usage || 0))
            .catch(err => console.error('Failed to load usage:', err));

    }, []);

    const [updating, setUpdating] = useState(false);

    const handleSave = async () => {
        setUpdating(true);

        const updates = {
            name: formData.name,
            description: formData.description,
            tracking_enabled: formData.tracking_enabled,
            sender_account_id: formData.sender_account_id === 'auto' ? null : formData.sender_account_id,
            sending_limits: {
                daily_limit: parseInt(String(formData.daily_limit)),
                hourly_limit: parseInt(String(formData.hourly_limit)),
                start_time: formData.start_time,
                end_time: formData.end_time
            },
            automation_mode: formData.automation_mode,
            enrichment_config: formData.enrichment_config
        };

        const { error } = await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', campaign.id);

        if (error) {
            toast.error("Errore salvataggio: " + error.message);
        } else {
            onUpdate({ ...campaign, ...updates });
            toast.success("Impostazioni salvate con successo!");
        }
        setUpdating(false);
    }

    return (
        <div className="w-full space-y-8 pb-10">
            {/* Header / Save */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Impostazioni Avanzate</h2>
                    <p className="text-slate-500 text-sm">Configura l'invio e il comportamento dell'AI.</p>
                </div>
                <Button onClick={handleSave} disabled={updating} className="bg-purple-600 hover:bg-purple-700">
                    {updating && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                    Salva Modifiche
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Left Column Stack */}
                <div className="space-y-6">
                    {/* 1. General Info */}
                    <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-4 h-fit">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            Generale
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Nome Campagna</label>
                                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border-purple-200 focus:border-purple-500 dark:border-white/10 dark:focus:border-purple-500/50" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Descrizione</label>
                                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="border-purple-200 focus:border-purple-500 dark:border-white/10 dark:focus:border-purple-500/50" />
                            </div>
                        </div>
                    </div>

                    {/* 2. Tracking */}
                    <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-4 h-fit">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Tracking & Analytics
                            </h3>
                        </div>

                        <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-900 dark:text-slate-200">Tracking Aperture</span>
                                    <div className="group relative">
                                        <div className="cursor-help text-slate-400 hover:text-blue-500 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                        </div>
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-4 bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none shadow-xl border border-white/10">
                                            <h4 className="font-bold mb-2 text-blue-300">Come funziona il Tracking?</h4>
                                            <p className="mb-2">Il sistema inserisce un piccolo "pixel" invisibile (un'immagine 1x1) in fondo alle email.</p>
                                            <ul className="space-y-1 list-disc pl-3 text-slate-300">
                                                <li><strong>ATTIVO:</strong> Sai esattamente chi apre le email e quando. Utile per capire l'interesse dei lead caldi.</li>
                                                <li><strong>DISATTIVO:</strong> Consigliato per le prime email a freddo (Cold Outreach). Alcuni filtri antispam penalizzano i pixel di tracciamento. Disattivandolo aumenti la probabilità di finire in Inbox principale.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">Abilita il pixel di tracciamento nelle email.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, tracking_enabled: !formData.tracking_enabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${formData.tracking_enabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.tracking_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>

                </div>

                {/* 2. AI Control Mode */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-purple-500/20 bg-purple-50/20 dark:bg-purple-900/10 space-y-4 h-fit">
                    <h3 className="font-semibold text-lg text-purple-800 dark:text-purple-200 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4" />
                        Modalità Automazione AI
                    </h3>

                    <div className="space-y-3">
                        <div
                            className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                formData.automation_mode === 'review'
                                    ? "bg-purple-100/50 border-purple-300 dark:bg-purple-900/30 dark:border-purple-500"
                                    : "border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            )}
                            onClick={() => setFormData({ ...formData, automation_mode: 'review' })}
                        >
                            <div className={cn(
                                "mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                formData.automation_mode === 'review'
                                    ? "border-purple-600 dark:border-purple-400"
                                    : "border-slate-400 dark:border-slate-600"
                            )}>
                                {formData.automation_mode === 'review' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400" />
                                )}
                            </div>
                            <div>
                                <span className={cn(
                                    "block text-sm font-semibold transition-colors",
                                    formData.automation_mode === 'review' ? "text-purple-900 dark:text-purple-100" : "text-slate-900 dark:text-slate-200"
                                )}>Revisione Manuale (Draft)</span>
                                <span className={cn(
                                    "text-sm transition-colors", // Increased from text-xs
                                    formData.automation_mode === 'review' ? "text-purple-700 dark:text-purple-300" : "text-slate-500"
                                )}>
                                    L'AI genera le email e le salva come "bozza". Devi approvarle manualmente per inviarle. Consigliato per i primi test.
                                </span>
                            </div>
                        </div>

                        <div
                            className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                formData.automation_mode === 'auto'
                                    ? "bg-purple-100/50 border-purple-300 dark:bg-purple-900/30 dark:border-purple-500"
                                    : "border-transparent hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            )}
                            onClick={() => setFormData({ ...formData, automation_mode: 'auto' })}
                        >
                            <div className={cn(
                                "mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                formData.automation_mode === 'auto'
                                    ? "border-purple-600 dark:border-purple-400"
                                    : "border-slate-400 dark:border-slate-600"
                            )}>
                                {formData.automation_mode === 'auto' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400" />
                                )}
                            </div>
                            <div>
                                <span className={cn(
                                    "block text-sm font-semibold transition-colors",
                                    formData.automation_mode === 'auto' ? "text-purple-900 dark:text-purple-100" : "text-slate-900 dark:text-slate-200"
                                )}>Completamente Automatico</span>
                                <span className={cn(
                                    "text-sm transition-colors", // Increased from text-xs
                                    formData.automation_mode === 'auto' ? "text-purple-700 dark:text-purple-300" : "text-slate-500"
                                )}>
                                    L'AI genera e invia direttamente. Ottimizza per la velocità. Usa solo se ti fidi del prompt.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Enrichment Configuration */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-4 md:col-span-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                Configurazione Arricchimento AI
                            </h3>
                            <p className="text-sm text-slate-500 mb-2">
                                Scegli come l'AI deve analizzare i siti web dei lead.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEnrichmentSettingsOpen(true)}
                                className="text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                            >
                                <Settings className="w-3.5 h-3.5 mr-2" />
                                Impostazioni Avanzate
                            </Button>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                Richieste: <span className={cn("font-bold", apiUsage > 1800 ? "text-red-500" : apiUsage > 1000 ? "text-amber-500" : "text-emerald-500")}>{apiUsage}</span> / 2000
                            </span>
                            <div className="w-32 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-500",
                                        apiUsage > 1800 ? "bg-red-500" : apiUsage > 1000 ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${Math.min((apiUsage / 2000) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {
                                id: 'generic',
                                label: 'Ricerca Generica',
                                desc: 'Panoramica generale, sito web, social.',
                                detailed_desc: "Analisi completa dell'azienda. Identifica chi sono, cosa vendono (prodotti/servizi), il business model e la presenza social. Ideale per qualificazione standard."
                            },
                            {
                                id: 'news',
                                label: 'Notizie Recenti',
                                desc: 'Focus su articoli, eventi e novità recenti.',
                                detailed_desc: "Focus temporale ultimi 12 mesi. Cerca comunicati stampa, lanci prodotti, eventi e investimenti. Perfetto per trovare 'trigger' di conversazione recenti."
                            },
                            {
                                id: 'pain_points',
                                label: 'Sfide & Strategia',
                                desc: 'Analisi obiettivi crescita e sfide mercato.',
                                detailed_desc: "Analisi strategica profonda. Cerca interviste al management, piani industriali e report per dedurre obiettivi di crescita e sfide del mercato."
                            },
                            {
                                id: 'risks',
                                label: 'Rischi & Criticità',
                                desc: 'Analisi problemi, recensioni, rischi.',
                                detailed_desc: "Audit aggressivo. Cerca segnali negativi: recensioni critiche, problemi finanziari, cause legali o controversie. Utile per scartare lead rischiosi."
                            }
                        ].map((type) => (
                            <div
                                key={type.id}
                                className={cn(
                                    "group relative p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md",
                                    (formData.enrichment_config?.type || 'generic') === type.id
                                        ? "bg-purple-50 border-purple-300 ring-1 ring-purple-300 dark:bg-purple-900/20 dark:border-purple-500"
                                        : "bg-white border-slate-200 dark:bg-white/5 dark:border-white/10"
                                )}
                                onClick={() => setFormData({
                                    ...formData,
                                    enrichment_config: { ...(formData.enrichment_config || {}), type: type.id }
                                })}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-4 h-4 rounded-full border flex items-center justify-center",
                                            (formData.enrichment_config?.type || 'generic') === type.id
                                                ? "border-purple-600 bg-purple-600"
                                                : "border-slate-300 dark:border-slate-600"
                                        )}>
                                            {(formData.enrichment_config?.type || 'generic') === type.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{type.label}</span>
                                    </div>

                                    {/* Info Icon with Tooltip */}
                                    <div className="relative group/tooltip">
                                        <div className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-purple-500 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                        </div>
                                        {/* Tooltip Content */}
                                        <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                                            {type.detailed_desc}
                                            <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900"></div>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                                    {type.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Sending Configuration (Wide) */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-6 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Timer className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                            Configurazione Invio
                        </h3>


                    </div>

                    <div className="mb-4">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Mittente (Override)</label>
                        <select
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-900 dark:text-slate-100 cursor-pointer"
                            value={formData.sender_account_id}
                            onChange={e => setFormData({ ...formData, sender_account_id: e.target.value })}
                        >
                            <option value="auto" className="dark:bg-slate-950">⚡ Automatico (Rotazione Intelligente - Consigliato)</option>
                            {mailAccounts.map(acc => (
                                <option key={acc.id} value={acc.id} className="dark:bg-slate-950">
                                    {acc.from_name} ({acc.email})
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-slate-500 mt-2">
                            "Automatico" ruota tra tutti gli account con budget disponibile.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Limits */}
                        {/* Limits */}
                        <div className="space-y-4">
                            {/* Header matched to right column for alignment */}
                            <div className="flex justify-between items-end border-b border-slate-100 dark:border-white/5 pb-3">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Limiti di Volume</h4>
                                <div className="h-[38px] w-1" /> {/* Spacer to align with Clock on right */}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Max Giornaliero</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.daily_limit}
                                            onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                                            className={cn(
                                                "pr-12 font-bold border-purple-200 focus:border-purple-500 dark:border-white/10",
                                                mailAccounts.find(a => a.id === formData.sender_account_id)?.daily_limit && formData.daily_limit > (mailAccounts.find(a => a.id === formData.sender_account_id)?.daily_limit || 0)
                                                    ? "border-amber-500 text-amber-600 focus:ring-amber-500/20"
                                                    : ""
                                            )}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">/day</span>
                                    </div>
                                    {/* Warn limit mismatch - Reverted to Column */}
                                    {(() => {
                                        const selectedAccount = mailAccounts.find(a => a.id === formData.sender_account_id);
                                        if (selectedAccount && selectedAccount.daily_limit && formData.daily_limit > selectedAccount.daily_limit) {
                                            return (
                                                <div className="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800 flex flex-col gap-1.5">
                                                    <span className="font-semibold flex items-center gap-1">
                                                        ⚠️ Limite Tecnico: {selectedAccount.daily_limit}
                                                    </span>
                                                    <span>L'account inviante ha un blocco a {selectedAccount.daily_limit} email/giorno.</span>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, daily_limit: selectedAccount.daily_limit })}
                                                        className="text-left underline hover:text-amber-800 dark:hover:text-amber-400 font-medium"
                                                    >
                                                        Allinea a {selectedAccount.daily_limit} &rarr;
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Max Orario</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.hourly_limit}
                                            onChange={(e) => setFormData({ ...formData, hourly_limit: parseInt(e.target.value) })}
                                            className="pr-12 font-bold border-purple-200 focus:border-purple-500 dark:border-white/10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">/hr</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-100 dark:border-white/5 pb-3">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Finestra Temporale</h4>
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Orario Server</span>
                                    <span className="block text-xl font-bold font-mono text-slate-900 dark:text-white leading-none">
                                        {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Inizio Invii</label>
                                    <Input
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        className="font-sans text-base text-slate-900 dark:text-slate-100 border-purple-200 focus:border-purple-500 dark:border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Fine Invii</label>
                                    <Input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        className="font-sans text-base text-slate-900 dark:text-slate-100 border-purple-200 focus:border-purple-500 dark:border-white/10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Danger Zone (Wide) */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 border-l-4 border-l-red-500 md:col-span-2 bg-red-50/10 dark:bg-red-900/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-lg text-red-600 dark:text-red-400 mb-1">Zona Pericolosa</h3>
                            <p className="text-sm text-slate-500">Eliminare una campagna è irreversibile. I lead verranno scollegati ma non eliminati.</p>
                        </div>
                        <Button variant="destructive" className="cursor-pointer">Elimina Campagna</Button>
                    </div>
                </div>
            </div >

            <EnrichmentSettingsModal
                isOpen={isEnrichmentSettingsOpen}
                onClose={() => setIsEnrichmentSettingsOpen(false)}
                config={formData.enrichment_config || { type: 'generic' }}
                onSave={(newConfig) => setFormData({ ...formData, enrichment_config: newConfig })}
            />
        </div >
    )
}

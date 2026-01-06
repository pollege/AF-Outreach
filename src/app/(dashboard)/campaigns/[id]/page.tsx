"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Users, BarChart3, Settings, Search, Timer } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Papa from "papaparse";

export default function CampaignDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [campaign, setCampaign] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'import' | 'settings' | 'sequence'>('overview');
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
                // FORCE REDIRECT if AI campaign
                if (campaignRes.data.enrichment_enabled) {
                    router.push(`/ai-campaigns/${id}`);
                    return;
                }

                setCampaign({
                    ...campaignRes.data,
                    stats: {
                        leads: leadsRes.count || 0,
                        sent: sentRes.count || 0,
                        open_rate: 0 // Placeholder until we have tracking logic
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
            alert("Errore aggiornamento status");
        } else {
            setCampaign({ ...campaign, status: newStatus });
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!campaign) return <div className="p-8">Campagna non trovata</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{campaign.name}</h1>
                    <div className="flex gap-2">
                        <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-mono uppercase",
                            campaign.status === 'active' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                campaign.status === 'paused' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                            {campaign.status}
                        </span>
                        <span className="text-slate-500 text-sm">{campaign.description}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={togglePause}>
                        {campaign.status === 'active' ? 'Pausa' : 'Attiva'}
                    </Button>
                    <Button onClick={() => setActiveTab('settings')}>Modifica Campagna</Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-6 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Panoramica', icon: BarChart3 },
                    { id: 'leads', label: 'Leads', icon: Users },
                    { id: 'import', label: 'Importa CSV', icon: Upload },
                    { id: 'sequence', label: 'Sequenza', icon: Timer },
                    { id: 'settings', label: 'Impostazioni', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer",
                            activeTab === tab.id
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab campaign={campaign} />}
                {activeTab === 'leads' && <LeadsTab campaignId={id} />}
                {activeTab === 'import' && <ImportTab campaignId={id} onImportSuccess={() => setActiveTab('leads')} />}
                {activeTab === 'sequence' && <SequenceEditor campaign={campaign} onUpdate={(c) => setCampaign(c)} />}
                {activeTab === 'settings' && <SettingsTab campaign={campaign} onUpdate={(c) => setCampaign(c)} />}
            </div>
        </div>
    );
}

function OverviewTab({ campaign }: { campaign: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Totale Leads</h3>
                <p className="text-3xl font-bold mt-2">{campaign.stats?.leads || 0}</p>
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Email Inviate</h3>
                <p className="text-3xl font-bold mt-2">{campaign.stats?.sent || 0}</p>
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Tasso Apertura</h3>
                <p className="text-3xl font-bold mt-2 text-emerald-500">0%</p>
            </div>
        </div>
    )
}

import { LeadEditor } from "@/components/leads/LeadEditor";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";
import { SequenceEditor } from "@/components/campaigns/SequenceEditor";
import { Edit2, Eye } from "lucide-react";

function LeadsTab({ campaignId }: { campaignId: string }) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState<any>(null); // State for modal
    const [viewingLead, setViewingLead] = useState<any>(null); // State for details
    const [searchTerm, setSearchTerm] = useState("");

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

    const handleSaveLead = (updatedLead: any) => {
        setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
    };

    const translateStatus = (status: string) => {
        if (status === 'draft') return 'Bozza';
        if (status === 'queued') return 'In Coda';
        if (status === 'sent') return 'Inviato';
        if (status === 'new') return 'Nuovo';
        if (status === 'researched') return 'Arricchito';
        if (status === 'message_generated') return 'Msg Generato';
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
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Cerca lead..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="sm">Esporta</Button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nome</th>
                            <th className="px-4 py-3 font-medium">Azienda</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Stato</th>
                            <th className="px-4 py-3 font-medium">Score</th>
                            <th className="px-4 py-3 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={6} className="p-4 text-center">Caricamento...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nessun lead trovato. Importa un CSV.</td></tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-slate-50 dark:hover:bg-white/5 group cursor-pointer"
                                    onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                    onClick={(e) => handleRowClick(lead, e)}
                                >
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
                                    <td className="px-4 py-3 text-slate-500">{lead.email}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 uppercase">
                                            {translateStatus(lead.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{lead.lead_score}</td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingLead(lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                            title="Vedi Dettagli"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLead(lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                                            title="Modifica Lead"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            <LeadEditor
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                onSave={handleSaveLead}
            />

            {/* Details Modal */}
            <LeadDetailsModal
                lead={viewingLead}
                isOpen={!!viewingLead}
                onClose={() => setViewingLead(null)}
            />
        </div>
    )
}

function ImportTab({ campaignId, onImportSuccess }: { campaignId: string, onImportSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

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

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);

        try {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const leads = results.data.map((row: any) => ({
                        campaign_id: campaignId,
                        first_name: row.first_name || row.FirstName,
                        last_name: row.last_name || row.LastName,
                        email: row.email || row.Email,
                        company_name: row.company_name || row.Company,
                        job_title: row.job_title || row.JobTitle,
                        linkedin_url: row.linkedin_url || row.LinkedIn,
                        status: 'new'
                    })).filter((l: any) => l.email && l.company_name);

                    if (leads.length === 0) {
                        alert("Nessun lead valido trovato nel CSV (controlla intestazioni).");
                        setUploading(false);
                        return;
                    }

                    const { error } = await supabase.from('leads').insert(leads);

                    if (error) {
                        console.error(error);
                        alert("Errore importazione: " + error.message);
                    } else {
                        alert(`Importati ${leads.length} leads con successo!`);
                        onImportSuccess();
                    }
                    setUploading(false);
                }
            });
        } catch (e: any) {
            alert("Errore: " + e.message);
            setUploading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                />
                <Upload className="w-10 h-10 text-slate-400 mb-4" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Carica file CSV</h3>
                <p className="text-sm text-slate-500 mt-2">o trascina il file qui</p>
                {file && <p className="mt-4 font-medium text-blue-500">{file.name}</p>}
            </div>

            {preview.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">Preview (Primi 5)</h4>
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl overflow-x-auto">
                        <pre className="text-xs text-slate-600 dark:text-slate-400">{JSON.stringify(preview, null, 2)}</pre>
                    </div>

                    <Button className="w-full mt-4" onClick={handleUpload} disabled={uploading}>
                        {uploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Importa {preview.length}+ Lead
                    </Button>
                </div>
            )}
        </div>
    )
}


function SettingsTab({ campaign, onUpdate }: { campaign: any, onUpdate: (c: any) => void }) {
    const [mailAccounts, setMailAccounts] = useState<any[]>([]);

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
    });

    useEffect(() => {
        const fetchAccounts = async () => {
            const { data } = await supabase.from('mail_accounts').select('id, email, from_name').eq('status', 'active');
            if (data) setMailAccounts(data);
        };
        fetchAccounts();
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
            }
        };

        const { error } = await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', campaign.id);

        if (error) {
            alert("Errore salvataggio: " + error.message);
        } else {
            onUpdate({ ...campaign, ...updates });
            alert("Impostazioni salvate con successo!");
        }
        setUpdating(false);
    }

    return (
        <div className="w-full space-y-8 pb-10">
            {/* Header / Save */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Impostazioni Campagna</h2>
                    <p className="text-slate-500 text-sm">Configura i parametri generali e di invio.</p>
                </div>
                <Button onClick={handleSave} disabled={updating}>
                    {updating && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                    Salva Modifiche
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. General Info */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-4 h-fit">
                    <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Generale
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Nome Campagna</label>
                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Descrizione</label>
                            <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
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
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${formData.tracking_enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.tracking_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* 3. Sending Configuration (Wide) */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-6 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Timer className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                            Configurazione Invio
                        </h3>
                        {/* Info Tooltip omitted for brevity as it's static */}
                    </div>

                    <div className="mb-4">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Mittente (Override)</label>
                        <select
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100 cursor-pointer"
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
                            "Automatico" ruota tra tutti gli account con budget disponibile. Seleziona un account specifico solo se vuoi forzare l'invio da un unico mittente (es. CEO).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Limits */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">Limiti di Volume</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Max Giornaliero</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.daily_limit}
                                            onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                                            className="pr-12 font-bold"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">/day</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Max Orario</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.hourly_limit}
                                            onChange={(e) => setFormData({ ...formData, hourly_limit: parseInt(e.target.value) })}
                                            className="pr-12 font-bold"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">/hr</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Limita la velocità di invio per proteggere la reputazione del dominio.</p>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-slate-100 dark:border-white/5 pb-3">
                                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Finestra Temporale</h4>
                                <div className="text-right">
                                    <span className="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-0.5">Orario Server</span>
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
                                        className="font-sans text-base text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Fine Invii</label>
                                    <Input
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        className="font-sans text-base text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400">Le email verranno inviate solo durante questa fascia oraria.</p>
                        </div>
                    </div>
                </div>

                {/* 4. Danger Zone (Wide) */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 border-l-4 border-l-red-500 md:col-span-2 bg-red-50/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-lg text-red-600 mb-1">Zona Pericolosa</h3>
                            <p className="text-sm text-slate-500">Queste azioni sono distruttive e non possono essere annullate.</p>
                        </div>
                        <Button variant="destructive">Elimina Campagna</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

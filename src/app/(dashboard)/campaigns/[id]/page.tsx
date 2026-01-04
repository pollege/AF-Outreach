"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Users, BarChart3, Settings, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Papa from "papaparse";

export default function CampaignDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();

    const [campaign, setCampaign] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'import' | 'settings'>('overview');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        async function fetchCampaign() {
            const { data } = await supabase.from('campaigns').select('*').eq('id', id).single();
            setCampaign(data);
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
                    { id: 'settings', label: 'Impostazioni', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm whitespace-nowrap",
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
                <p className="text-3xl font-bold mt-2">0</p>
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
    const [name, setName] = useState(campaign.name);
    const [desc, setDesc] = useState(campaign.description || '');
    const [updating, setUpdating] = useState(false);

    const handleSave = async () => {
        setUpdating(true);
        const { error } = await supabase.from('campaigns').update({ name, description: desc }).eq('id', campaign.id);
        if (error) {
            alert("Errore salvataggio");
        } else {
            onUpdate({ ...campaign, name, description: desc });
            alert("Salvato!");
        }
        setUpdating(false);
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 space-y-4">
                <h3 className="font-semibold text-lg mb-4">Dettagli Campagna</h3>
                <div>
                    <label className="text-sm text-slate-500 block mb-1">Nome Campagna</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm text-slate-500 block mb-1">Descrizione</label>
                    <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <Button onClick={handleSave} disabled={updating}>
                    {updating && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                    Salva Modifiche
                </Button>
            </div>

            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 border-l-4 border-l-red-500">
                <h3 className="font-semibold text-lg text-red-600 mb-2">Zona Pericolosa</h3>
                <p className="text-sm text-slate-500 mb-4">L'eliminazione della campagna è irreversibile.</p>
                <Button variant="destructive">Elimina Campagna</Button>
            </div>
        </div>
    )
}

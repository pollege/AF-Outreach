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

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!campaign) return <div className="p-8">Campagna non trovata</div>;

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{campaign.name}</h1>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-mono uppercase">
                            {campaign.status}
                        </span>
                        <span className="text-slate-500 text-sm">{campaign.description}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Pause</Button>
                    <Button>Edit Campaign</Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-6">
                {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'leads', label: 'Leads', icon: Users },
                    { id: 'import', label: 'Import CSV', icon: Upload },
                    { id: 'settings', label: 'Settings', icon: Settings },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm",
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
                {activeTab === 'settings' && <div>Settings Placeholder</div>}
            </div>
        </div>
    );
}

function OverviewTab({ campaign }: { campaign: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Total Leads</h3>
                <p className="text-3xl font-bold mt-2">0</p>
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Emails Sent</h3>
                <p className="text-3xl font-bold mt-2">{campaign.stats?.sent || 0}</p>
            </div>
            <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20">
                <h3 className="text-sm font-medium text-slate-500">Open Rate</h3>
                <p className="text-3xl font-bold mt-2 text-emerald-500">0%</p>
            </div>
        </div>
    )
}

function LeadsTab({ campaignId }: { campaignId: string }) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeads() {
            const { data } = await supabase.from('leads').select('*').eq('campaign_id', campaignId);
            setLeads(data || []);
            setLoading(false);
        }
        fetchLeads();
    }, [campaignId]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Cerca lead..." className="pl-9" />
                </div>
                <Button variant="outline" size="sm">Export</Button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Nome</th>
                            <th className="px-4 py-3 font-medium">Azienda</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={5} className="p-4 text-center">Caricamento...</td></tr>
                        ) : leads.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nessun lead trovato. Importa un CSV.</td></tr>
                        ) : (
                            leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="px-4 py-3 font-medium">{lead.first_name} {lead.last_name}</td>
                                    <td className="px-4 py-3 text-slate-500">{lead.company_name}</td>
                                    <td className="px-4 py-3 text-slate-500">{lead.email}</td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 uppercase">
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{lead.lead_score}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
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
            // Parse full file
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
                    })).filter((l: any) => l.email && l.company_name); // Basic validation

                    if (leads.length === 0) {
                        alert("Nessun lead valido trovato nel CSV (controlla intestazioni).");
                        setUploading(false);
                        return;
                    }

                    // Batch insert (Supabase limits batch size, typically safe around 1000, we stick to smaller chunks if needed or all if small)
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

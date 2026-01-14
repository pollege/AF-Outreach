"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Users, BarChart3, Settings, Search, Timer } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Papa from "papaparse";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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
            toast.error("Errore aggiornamento status");
        } else {
            setCampaign({ ...campaign, status: newStatus });

            if (newStatus === 'active') {
                toast.success("Campagna attivata! Avvio pianificazione e invio...");

                // Trigger Cron Jobs Immediately (Fire & Forget)
                // We need to pass the user's Auth Token to bypass the Secret check
                supabase.auth.getSession().then(async ({ data: { session } }) => {
                    const token = session?.access_token;

                    if (!token) {
                        toast.error("Sessione non valida. Ricarica la pagina e riprova.");
                        return;
                    }

                    const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

                    try {
                        // 1. Schedule (Generate Messages)
                        toast.info("Generazione messaggi in corso...");
                        const scheduleRes = await fetch('/api/cron/schedule?force=true', { headers });
                        const scheduleData = await scheduleRes.json();

                        if (!scheduleRes.ok) throw new Error(scheduleData.error || "Errore scheduler");

                        const count = scheduleData.scheduled || 0;
                        if (count > 0) {
                            toast.success(`${count} messaggi generati! Invio in corso...`);
                        } else {
                            toast.warning("Nessun messaggio generato. (Controlla che ci siano lead Nuovi e una Sequenza salvata)");
                        }

                        // 2. Send (Process Queue) - Only if we didn't crash
                        const sendRes = await fetch('/api/cron/send?force=true', { headers });
                        const sendData = await sendRes.json();

                        if (sendRes.ok && sendData.sent > 0) {
                            toast.success(`${sendData.sent} email inviate!`);
                        }
                    } catch (error: any) {
                        console.error("Cron trigger error:", error);
                        toast.error(`Errore attivazione: ${error.message}`);
                    }
                });
            } else {
                toast.success("Campagna messa in pausa");
            }
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
                    { id: 'import', label: 'Importa Dati', icon: Upload },
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
                {activeTab === 'leads' && <LeadsTab campaignId={id} enrichmentEnabled={campaign.enrichment_enabled} />}
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
import { LeadsTable } from "@/components/leads/LeadsTable";
import { ContactPickerModal } from "@/components/leads/ContactPickerModal";
import { Edit2, Eye, Database } from "lucide-react";

function LeadsTab({ campaignId, enrichmentEnabled }: { campaignId: string, enrichmentEnabled: boolean }) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState<any>(null); // State for modal
    const [viewingLead, setViewingLead] = useState<any>(null); // State for details
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        async function fetchLeads() {
            const { data } = await supabase
                .from('leads')
                .select('*, contacts(*), messages(*)') // Link contacts
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false });
            setLeads(data || []);
            setLoading(false);
        }
        fetchLeads();
    }, [campaignId]);

    const handleSaveLead = (updatedLead: any) => {
        // Optimistic update
        if (leads.some(l => l.id === updatedLead.id)) {
            setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
        } else {
            setLeads([updatedLead, ...leads]);
        }
    };

    const handleUpdateFromModal = (updatedLead: any) => {
        // Update the list
        setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
        // Update the modal view
        setViewingLead(updatedLead);
    }



    const filteredLeads = leads.filter(lead => {
        // Search in CONTACT fields
        const c = lead.contacts || {};
        return (
            (c.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
    });



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
                <div className="flex gap-2">

                    <Button variant="outline" size="sm" onClick={() => setEditingLead({})}>
                        <Users className="w-4 h-4 mr-2" />
                        Nuovo Lead
                    </Button>
                    <Button variant="outline" size="sm">Esporta</Button>
                </div>
            </div>

            {/* Leads Table Component */}
            <LeadsTable
                data={filteredLeads}
                loading={loading}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onView={setViewingLead}
                onEdit={setEditingLead}
                settingsKey="campaign_leads_table_common_v1"
                enableColumnConfig={false}
            />



            {/* Edit Modal */}
            <LeadEditor
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                onSave={handleSaveLead}
                campaignId={campaignId}
            />

            {/* Details Modal */}
            <LeadDetailsModal
                lead={viewingLead}
                isOpen={!!viewingLead}
                onClose={() => setViewingLead(null)}
                enrichmentEnabled={enrichmentEnabled}
                onLeadUpdate={handleUpdateFromModal}
            />
        </div>
    )
}

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
            toast.error("Errore importazione: " + error.message);
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
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold">Importazione completata (Global Architecture)!</span>
                            <span className="text-xs">
                                ✅ {insertedLeadsCount} collegati
                                <br />
                                ⚠️ {skippedCount} già presenti
                            </span>
                        </div>,
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
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative">
                    <input
                        type="file"
                        accept=".csv"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                    />
                    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Carica file CSV</h3>
                    <p className="text-sm text-slate-500 mt-2">o trascina il file qui</p>
                    {file && <p className="mt-4 font-medium text-blue-500">{file.name}</p>}
                </div>
            </div>

            {uploading && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Importazione in corso...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {!uploading && preview.length > 0 && (
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">Preview (Primi 5)</h4>
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl overflow-x-auto">
                        <pre className="text-xs text-slate-600 dark:text-slate-400">{JSON.stringify(preview, null, 2)}</pre>
                    </div>

                    <Button className="w-full mt-4" onClick={handleUpload} disabled={uploading}>
                        <Upload className="w-4 h-4 mr-2" />
                        Importa {preview.length}+ Lead
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
    const [isSending, setIsSending] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [debugResult, setDebugResult] = useState<any>(null);

    const handleDelete = async () => {
        try {
            const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);
            if (error) throw error;
            toast.success("Campagna eliminata");
            window.location.href = "/campaigns";
        } catch (e: any) {
            toast.error("Errore eliminazione: " + e.message);
        }
    };

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
                        <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>Elimina Campagna</Button>
                    </div>
                </div>

                {/* 5. Test Zone (Wide) ... (rest of code) */}
                <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 border-l-4 border-l-blue-500 md:col-span-2 bg-blue-50/10">
                    {/* ... Test Zone Content ... (keep as is, I need to match the context properly) */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-semibold text-lg text-blue-600 mb-1 flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                Test Runner (Debug)
                            </h3>
                            <p className="text-sm text-slate-500">Strumenti per forzare l'esecuzione immediata (ignora pianificazione).</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={async () => {
                                setDebugResult({ status: 'running', message: 'Generazione in corso...' });
                                try {
                                    const res = await fetch(`/api/cron/generate?campaign_id=${campaign.id}`);
                                    const data = await res.json();
                                    setDebugResult({
                                        type: 'GENERATE',
                                        timestamp: new Date().toLocaleTimeString(),
                                        data: data
                                    });
                                    if (data.generated_count > 0) toast.success(`Generati ${data.generated_count} messaggi`);
                                    else toast.info("Nessun messaggio generato");
                                } catch (e: any) {
                                    setDebugResult({ status: 'error', message: e.message });
                                    toast.error("Errore generazione");
                                }
                            }}>
                                1. Genera Email (Step 1)
                            </Button>

                            <Button variant="outline" disabled={isSending} onClick={async () => {
                                setIsSending(true);
                                setDebugResult({ status: 'running', message: 'Invio in corso (n8n)...' });
                                try {
                                    const res2 = await fetch(`/api/cron/send?force=true&campaign_id=${campaign.id}`);
                                    const data = await res2.json();

                                    setDebugResult({
                                        type: 'SEND',
                                        timestamp: new Date().toLocaleTimeString(),
                                        status: (data.skipped && data.skipped.length > 0) ? (data.sent_count > 0 ? 'WARNING' : 'ERROR') : 'SUCCESS',
                                        data: data
                                    });

                                    if (data.sent_count > 0) {
                                        toast.success(`Inviate ${data.sent_count} email`);
                                    }
                                } catch (e: any) {
                                    setDebugResult({ status: 'error', message: e.message });
                                    toast.error("Errore invio");
                                } finally {
                                    setIsSending(false);
                                }
                            }}>
                                {isSending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Inviando...</> : "2. Invia Ora (Step 2 - n8n)"}
                            </Button>
                        </div>

                        {/* Debug Console Output */}
                        {debugResult && (
                            <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 text-sm font-mono">
                                <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        Console Output {debugResult.timestamp && `[${debugResult.timestamp}]`}
                                    </span>
                                    <button onClick={() => setDebugResult(null)} className="text-xs text-slate-500 hover:text-slate-700">Clear</button>
                                </div>
                                <div className="bg-slate-950 p-4 overflow-x-auto">
                                    <pre className={cn(
                                        "whitespace-pre-wrap break-all",
                                        debugResult.status === 'ERROR' ? "text-red-400" :
                                            debugResult.status === 'WARNING' ? "text-amber-400" :
                                                "text-green-400"
                                    )}>
                                        {JSON.stringify(debugResult.data || debugResult, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div> {/* This closes the main grid container */}

            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Elimina Campagna"
                description="Sei sicuro di voler eliminare questa campagna? Tutti i lead e i messaggi associati verranno persi definitivamente."
                confirmText="Elimina Definitivamente"
                variant="destructive"
            />
        </div >
    )
}


import { useState, useEffect } from "react";
import {
    X,
    RefreshCw,
    Trash2,
    Sparkles,
    Bot,
    Loader2,
    Mail,
    Building2,
    Globe,
    Linkedin,
    Calendar,
    User,
    Tag,
    AlertCircle,
    CheckCircle2,
    Save,
    Info,
    BrainCircuit,
    Send,
    Megaphone,
    Edit2,
    PenLine,
    Clock,
    ChevronRight,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface LeadDetailsModalProps {
    lead: any;
    isOpen: boolean;
    onClose: () => void;
    onLeadUpdate?: (lead: any) => void;
    enrichmentEnabled?: boolean;
    initialTab?: 'email' | 'enrichment' | 'details';
    initialFocusField?: string | null;
    onEdit?: (lead: any) => void;
    onAddToCampaign?: (lead: any) => void;
    onEnrich?: (lead: any, config?: any) => Promise<void>;
}

export function LeadDetailsModal({ lead, isOpen, onClose, onLeadUpdate, onEdit, onAddToCampaign, onEnrich, enrichmentEnabled = false, initialTab = 'email', initialFocusField = null }: LeadDetailsModalProps) {
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'email' | 'enrichment' | 'details'>(initialTab);
    const [focusField, setFocusField] = useState<string | null>(initialFocusField);

    // Direct Email State
    const [isComposing, setIsComposing] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);
    const [mailAccounts, setMailAccounts] = useState<any[]>([]);
    const [selectedSenderId, setSelectedSenderId] = useState<string>('auto');

    const [showTagInput, setShowTagInput] = useState(false);
    const [relatedCampaigns, setRelatedCampaigns] = useState<any[]>([]);
    const [enrichmentType, setEnrichmentType] = useState('generic');

    // Sort to get truly latest message
    const sortedMessages = [...(lead?.messages || [])].sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestMessage = sortedMessages[0];
    const enrichment = lead?.enrichment_data || lead?.enrichment || {};

    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    // Initialize editor content when composing starts
    useEffect(() => {
        if (isComposing && editingMessageId) {
            // When editing, emailBody is already set from handleEditDraft
            // For new composition, emailBody is empty, which is fine for RichTextEditor
        }
    }, [isComposing, editingMessageId]);



    const handleEditDraft = (msg: any) => {
        setEditingMessageId(msg.id);
        setEmailSubject(msg.subject || "");
        setEmailBody(msg.body || ""); // Keep HTML
        if (msg.sender_account_id) setSelectedSenderId(msg.sender_account_id);
        setIsComposing(true);
    };

    // Fetch mail accounts on mount
    useEffect(() => {
        supabase.from('mail_accounts').select('id, email, from_name').eq('status', 'active')
            .then(({ data }) => {
                if (data) setMailAccounts(data);
            });
    }, []);

    // Fetch related campaigns on mount
    useEffect(() => {
        if (lead?.contact_id) {
            supabase
                .from('leads')
                .select('id, status, campaigns(name)')
                .eq('contact_id', lead.contact_id)
                .neq('id', lead.id)
                .then(({ data }) => {
                    if (data) setRelatedCampaigns(data);
                });
        }
    }, [lead]);

    // Reset tab and focus when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setFocusField(initialFocusField);
        }
    }, [isOpen, initialTab, initialFocusField]);

    if (!isOpen || !lead) return null;

    const handleAction = async (action: 'enrich' | 'clear' | 'retry') => {
        setLoadingAction(action);
        try {
            if (action === 'clear') {
                // Clear logic placeholder
                toast.info("Funzionalità Clear da implementare completamente");
            } else if (action === 'enrich') {
                // Enrich logic placeholder
            } else if (action === 'retry') {
                // Retry logic placeholder
            }
        } catch (e: any) {
            toast.error("Errore azione: " + e.message);
        }
        setLoadingAction(null);
    };

    const contact = lead.contacts || lead;
    const customFields = contact.custom_fields || {};

    // Helper to find case-insensitive keys
    const findKey = (obj: any, keys: string[]) => {
        const objKeys = Object.keys(obj).map(k => k.toLowerCase());
        for (const key of keys) {
            const index = objKeys.indexOf(key.toLowerCase());
            if (index !== -1) return obj[Object.keys(obj)[index]];
        }
        return null;
    };

    const logoUrl = findKey(customFields, ['logo', 'image', 'photo', 'avatar', 'img', 'company logo', 'company_logo', 'person photo']);
    const websiteUrl = findKey(customFields, ['website', 'url', 'site', 'web', 'company website', 'company_website', 'link', 'homepage', 'domain', 'company domain']);

    const handleRemoveFromCampaign = async (campaignLeadId: string, campaignName: string) => {
        if (!confirm(`Sei sicuro di voler rimuovere questo contatto dalla campagna "${campaignName}"?`)) return;

        const { error } = await supabase.from('leads').delete().eq('id', campaignLeadId);

        if (error) {
            toast.error("Errore rimozione: " + error.message);
        } else {
            toast.success(`Rimosso da ${campaignName}`);
            // If we deleted the CURRENT lead view, close modal or refresh
            if (campaignLeadId === lead.id) {
                onClose();
                // Ideally trigger a refresh in parent, but close is safe
            } else {
                // Refresh related campaigns list
                setRelatedCampaigns(prev => prev.filter(rc => rc.id !== campaignLeadId));
            }
            if (onLeadUpdate) onLeadUpdate(lead);
        }
    };

    const handleSaveDraft = async () => {
        if (!emailSubject.trim()) {
            toast.error("Oggetto obbligatorio");
            return;
        }

        const content = emailBody; // emailBody now holds HTML from RichTextEditor
        if (!content.trim()) {
            toast.error("Messaggio obbligatorio");
            return;
        }

        setSendingEmail(true);
        try {
            const payload: any = {
                campaign_id: lead.campaign_id,
                lead_id: lead.id,
                subject: emailSubject,
                body: content,
                status: 'draft', // Always draft when simple saving
            };

            if (selectedSenderId && selectedSenderId !== 'auto') {
                payload.sender_account_id = selectedSenderId;
            }

            if (editingMessageId) {
                await supabase.from('messages').update(payload).eq('id', editingMessageId);
            } else {
                await supabase.from('messages').insert(payload);
            }

            toast.success("Bozza salvata!");
            setIsComposing(false);
            setEditingMessageId(null);
            setEmailSubject("");
            setEmailBody("");

            // Refresh
            if (onLeadUpdate) {
                const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
                if (data) onLeadUpdate(data);
            }

        } catch (e: any) {
            toast.error("Errore salvataggio: " + e.message);
        }
        setSendingEmail(false);
    };

    const handleSendEmail = async () => {
        if (!emailSubject.trim() || !emailBody.trim()) {
            toast.error("Oggetto e messaggio sono obbligatori");
            return;
        }

        setSendingEmail(true);
        try {
            const finalBody = emailBody; // emailBody already holds HTML from RichTextEditor

            const payload: any = {
                campaign_id: lead.campaign_id,
                lead_id: lead.id,
                subject: emailSubject,
                body: finalBody,
                status: 'queued',
            };

            // If specific sender selected, add it
            if (selectedSenderId && selectedSenderId !== 'auto') {
                payload.sender_account_id = selectedSenderId;
            }

            let error;
            if (editingMessageId) {
                // Update existing
                const { error: updateError } = await supabase.from('messages').update(payload).eq('id', editingMessageId);
                error = updateError;
            } else {
                // Insert new
                const { error: insertError } = await supabase.from('messages').insert(payload);
                error = insertError;
            }

            if (error) throw error;

            // 2. Trigger Cron (Fire & Forget attempt)
            fetch(`/api/cron/send?campaign_id=${lead.campaign_id}&force=true`);

            toast.success(editingMessageId ? "Bozza aggiornata e messa in coda!" : "Email in coda di invio!");
            setIsComposing(false);
            setEditingMessageId(null);
            setEmailSubject("");
            setEmailBody("");

            // Refresh lead to show new message in list (might delay slightly)
            setTimeout(() => {
                if (onLeadUpdate) {
                    supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single()
                        .then(({ data }) => {
                            if (data) onLeadUpdate(data);
                        });
                }
            }, 1000);

        } catch (e: any) {
            toast.error("Errore invio: " + e.message);
        }
        setSendingEmail(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-[95vw] h-[85vh] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                                {contact.first_name?.[0]}{contact.last_name?.[0]}
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {contact.first_name} {contact.last_name}
                                {lead.status === 'researched' && <Sparkles className="w-4 h-4 text-purple-500 fill-purple-500/10" />}
                            </h2>
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                {contact.job_title} @ {contact.company_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {enrichmentEnabled && (
                            <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-1 mr-2">
                                <button
                                    onClick={() => setActiveTab('email')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                        activeTab === 'email' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    Email & Messaggi
                                </button>
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                        activeTab === 'details' ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <Tag className="w-3 h-3" /> Dettagli
                                </button>
                                <button
                                    onClick={() => setActiveTab('enrichment')}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                                        activeTab === 'enrichment' ? "bg-white dark:bg-slate-800 shadow-sm text-purple-600 dark:text-purple-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <Sparkles className="w-3 h-3" /> Arricchimento
                                </button>
                            </div>
                        )}
                        <div className="flex flex-col items-center gap-0.5">
                            <Button variant="ghost" size="icon" onClick={() => { setIsComposing(!isComposing); setActiveTab('email'); setEditingMessageId(null); setEmailSubject(""); setEmailBody(""); }} title="Scrivi Email" className={isComposing && !editingMessageId ? "text-purple-600 bg-purple-50 dark:bg-purple-900/20" : ""}>
                                <PenLine className="w-5 h-5 text-slate-400 hover:text-purple-500" />
                            </Button>
                            <span className="text-[10px] text-slate-500 font-medium">Scrivi</span>
                        </div>

                        {onAddToCampaign && (
                            <div className="flex flex-col items-center gap-0.5">
                                <Button variant="ghost" size="icon" onClick={() => onAddToCampaign(lead)} title="Aggiungi a Campagna">
                                    <Megaphone className="w-5 h-5 text-slate-400 hover:text-purple-500" />
                                </Button>
                                <span className="text-[10px] text-slate-500 font-medium">Campagna</span>
                            </div>
                        )}

                        {onEdit && (
                            <div className="flex flex-col items-center gap-0.5">
                                <Button variant="ghost" size="icon" onClick={() => onEdit(lead)} title="Modifica Lead">
                                    <Edit2 className="w-5 h-5 text-slate-400 hover:text-purple-500" />
                                </Button>
                                <span className="text-[10px] text-slate-500 font-medium">Modifica</span>
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-0.5">
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <X className="w-5 h-5 text-slate-400 hover:text-red-500" />
                            </Button>
                            <span className="text-[10px] text-slate-500 font-medium">Chiudi</span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Sidebar */}
                    <div className="w-full md:w-80 shrink-0 border-r border-slate-100 dark:border-white/5 overflow-y-auto bg-slate-50/30 dark:bg-white/[0.02] p-6 space-y-6">

                        {/* Contact Details */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contatto</h4>
                            <div className="space-y-3">
                                {contact.email && (
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <a href={`mailto:${contact.email}`} className="hover:text-blue-500 hover:underline">{contact.email}</a>
                                    </div>
                                )}
                                {contact.linkedin_url && (
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Linkedin className="w-4 h-4 text-slate-400" />
                                        <a href={contact.linkedin_url} target="_blank" className="hover:text-blue-500 hover:underline">Profilo LinkedIn</a>
                                    </div>
                                )}
                                {contact.company_name && (
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        {websiteUrl ? (
                                            <a href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`} target="_blank" className="hover:text-blue-500 hover:underline flex items-center gap-1">
                                                {contact.company_name} <Globe className="w-3 h-3 opacity-50" />
                                            </a>
                                        ) : (
                                            <span>{contact.company_name}</span>
                                        )}
                                    </div>
                                )}

                                {/* Show generic custom fields if needed or debugging */}
                                {/* <pre className="text-xs text-slate-400">{JSON.stringify(customFields, null, 2)}</pre> */}
                            </div>
                        </div>

                        {/* Campaigns List (New Feature) */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Campagne Attive</h4>
                            <div className="space-y-2">
                                {/* Current Campaign */}
                                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-500/20 shadow-sm group">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                        <Megaphone className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-purple-600 dark:text-purple-300 font-medium truncate">Attuale</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{lead.campaigns?.name || 'Nessuna'}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFromCampaign(lead.id, lead.campaigns?.name)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                        title="Rimuovi da questa campagna"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Other Campaigns */}
                                {relatedCampaigns.map((rc) => (
                                    <div key={rc.id} className="flex items-center gap-3 p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm opacity-70 hover:opacity-100 transition-opacity group">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900/20 flex items-center justify-center text-slate-400">
                                            <Megaphone className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-500 truncate">{rc.status}</p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{rc.campaigns?.name}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFromCampaign(rc.id, rc.campaigns?.name)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                            title="Rimuovi da questa campagna"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Toolbar Actions (Clear) */}
                        <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                            <Button variant="outline" size="sm" onClick={() => handleAction('clear')} disabled={!!loadingAction} className="w-full text-red-500 hover:bg-red-50 border-red-200">
                                {loadingAction === 'clear' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Cancella Dati
                            </Button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-900">
                        {activeTab === 'email' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comunicazioni</h3>
                                </div>

                                {isComposing && (
                                    <div className="bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-500/30 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                                <PenLine className="w-4 h-4" /> {editingMessageId ? 'Modifica Bozza' : 'Nuova Email'}
                                            </h4>
                                            <button onClick={() => { setIsComposing(false); setEditingMessageId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                        </div>
                                        <div className="space-y-3">
                                            {/* Sender Selection */}
                                            <select
                                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900 dark:text-white dark:border-white/10 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                                                value={selectedSenderId}
                                                onChange={(e) => setSelectedSenderId(e.target.value)}
                                            >
                                                <option value="auto" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Rotazione Automatica (Default)</option>
                                                {mailAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                                        {acc.from_name} &lt;{acc.email}&gt;
                                                    </option>
                                                ))}
                                            </select>

                                            <input
                                                className="w-full px-3 py-2 border rounded-lg dark:bg-black/20 dark:border-white/10 text-sm font-medium"
                                                placeholder="Oggetto dell'email"
                                                value={emailSubject}
                                                onChange={(e) => setEmailSubject(e.target.value)}
                                            />
                                            <RichTextEditor
                                                key={editingMessageId || 'new'}
                                                value={emailBody}
                                                onChange={setEmailBody}
                                                className="min-h-[300px]"
                                                placeholder="Scrivi il tuo messaggio qui..."
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => { setIsComposing(false); setEditingMessageId(null); }}>Annulla</Button>
                                                <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-700" onClick={handleSaveDraft} disabled={sendingEmail}>
                                                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                                    {editingMessageId ? 'Salva Modifiche' : 'Salva Bozza'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {latestMessage && !isComposing ? (
                                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{latestMessage.subject || '(Nessun oggetto)'}</p>
                                                <p className="text-xs text-slate-500">{new Date(latestMessage.created_at).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-1 rounded text-xs font-bold uppercase",
                                                    latestMessage.status === 'sent' ? "bg-green-100 text-green-700" :
                                                        latestMessage.status === 'queued' ? "bg-blue-100 text-blue-700" :
                                                            latestMessage.status === 'draft' ? "bg-amber-100 text-amber-700" :
                                                                "bg-slate-100 text-slate-600"
                                                )}>{latestMessage.status || 'Draft'}</span>
                                            </div>
                                        </div>

                                        {/* HTML Rendering */}
                                        <div
                                            className="text-sm text-slate-600 dark:text-slate-300 font-sans bg-white dark:bg-black/20 p-4 rounded-lg border border-slate-100 dark:border-white/5 prose dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: latestMessage.body }}
                                        />

                                        {/* Draft Actions */}
                                        {latestMessage.status === 'draft' && (
                                            <div className="flex gap-2 pt-2 justify-end border-t border-slate-200 dark:border-white/10 mt-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10"
                                                    onClick={() => handleEditDraft(latestMessage)}
                                                >
                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                    Modifica
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                                                    onClick={async () => {
                                                        const { error } = await supabase.from('messages').delete().eq('id', latestMessage.id);
                                                        if (!error) {
                                                            toast.success("Bozza eliminata");
                                                            if (onLeadUpdate) {
                                                                const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
                                                                if (data) onLeadUpdate(data);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    Scarta
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 text-white hover:bg-green-700 border-none"
                                                    onClick={async () => {
                                                        const { error } = await supabase.from('messages').update({ status: 'queued' }).eq('id', latestMessage.id);
                                                        if (!error) {
                                                            toast.success("Messaggio approvato! In coda di invio.");
                                                            // Trigger cron to send immediately if needed
                                                            fetch(`/api/cron/send?campaign_id=${lead.campaign_id}&force=true`);

                                                            if (onLeadUpdate) {
                                                                const { data } = await supabase.from('leads').select('*, messages(*)').eq('id', lead.id).single();
                                                                if (data) onLeadUpdate(data);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Approva & Invia
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    !isComposing && (
                                        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl h-[300px]">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                                <Mail className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="font-medium text-slate-600 dark:text-slate-300 mb-2">Nessun messaggio presente</p>

                                            {enrichmentEnabled && onEnrich ? (
                                                <div className="flex flex-col gap-2 items-center">
                                                    <p className="text-sm text-slate-500 mb-4 max-w-xs">
                                                        Usa l'AI per analizzare il lead e generare una bozza personalizzata.
                                                    </p>
                                                    <Button onClick={() => onEnrich(lead)} className="bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/20">
                                                        <Sparkles className="w-4 h-4 mr-2" />
                                                        Genera Bozza con AI
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-sm mb-6 max-w-xs mx-auto">
                                                    Vai alla <strong>Dashboard della Campagna</strong> per generare e gestire i messaggi.
                                                </p>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {activeTab === 'details' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Focused Field Section */}
                                {focusField && customFields[focusField] && (
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-200 dark:border-blue-500/30">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                                {focusField.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                        <div className="text-xl text-slate-900 dark:text-white font-medium whitespace-pre-wrap break-all leading-relaxed">
                                            {String(customFields[focusField])}
                                        </div>
                                    </div>
                                )}

                                {/* All Custom Fields Grid */}
                                <div>
                                    {focusField && (
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">
                                            Altri Dettagli
                                        </h3>
                                    )}

                                    {!focusField && (
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                                            Dettagli & Campi Personalizzati
                                        </h3>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(customFields).length > 0 ? (
                                            Object.entries(customFields).map(([key, value]) => {
                                                // Skip the focused field in the main grid
                                                if (focusField && key === focusField) return null;

                                                // Skip ignored fields
                                                if (['logo', 'image', 'photo', 'avatar', 'img', 'website', 'url', 'site', 'web', 'linkedin', 'linkedin_url'].includes(key.toLowerCase())) return null;

                                                return (
                                                    <div key={key} className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors group">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                                            {key.replace(/_/g, ' ')}
                                                        </p>
                                                        <div className="text-sm text-slate-900 dark:text-white font-medium whitespace-pre-wrap break-all">
                                                            {value ? String(value) : <span className="text-slate-400 italic">N/A</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-2 text-center p-12 text-slate-400">
                                                Nessun campo personalizzato trovato.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'enrichment' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                {!enrichment || Object.keys(enrichment).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl h-[300px]">
                                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 text-blue-400">
                                            <BrainCircuit className="w-8 h-8" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Analisi AI mancante</h4>
                                        <p className="text-sm text-slate-500 mb-6 max-w-xs">
                                            Analizza questo lead per trovare notizie recenti, pain points e informazioni strategiche.
                                        </p>

                                        {onEnrich && (
                                            <div className="flex flex-col gap-3 items-center w-full max-w-xs">
                                                <select
                                                    value={enrichmentType}
                                                    onChange={(e) => setEnrichmentType(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    <option value="generic">Generica (Standard)</option>
                                                    <option value="news">Notizie Recenti</option>
                                                    <option value="pain_points">Sfide & Pain Points</option>
                                                    <option value="risks">Rischi & Criticità</option>
                                                </select>
                                                <Button
                                                    onClick={() => onEnrich(lead, { type: enrichmentType })}
                                                    className="w-full bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                                                >
                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                    Avvia Analisi Completa
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Re-Analyze Header */}
                                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Risultati Analisi</h4>
                                                <p className="text-xs text-slate-400">Tipo: {enrichment.type || 'Generico'}</p>
                                            </div>
                                            {onEnrich && (
                                                <div className="flex gap-2">
                                                    <select
                                                        value={enrichmentType}
                                                        onChange={(e) => setEnrichmentType(e.target.value)}
                                                        className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    >
                                                        <option value="generic">Generica</option>
                                                        <option value="news">Notizie</option>
                                                        <option value="pain_points">Pain Points</option>
                                                        <option value="risks">Rischi</option>
                                                    </select>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onEnrich(lead, { type: enrichmentType })}
                                                        title="Rigenera con nuova modalità"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {/* Recent News */}
                                        {enrichment.recent_news?.length > 0 && (
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                    <Globe className="w-5 h-5 text-blue-500" /> Ultime Notizie
                                                </h4>
                                                <div className="grid gap-3">
                                                    {enrichment.recent_news.map((news: string, i: number) => (
                                                        <div key={i} className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                                                            <p className="text-sm text-slate-700 dark:text-slate-300">{news}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pain Points */}
                                        {enrichment.pain_points?.length > 0 && (
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                    <AlertCircle className="w-5 h-5 text-red-500" /> Pain Points & Sfide
                                                </h4>
                                                <div className="grid gap-3">
                                                    {enrichment.pain_points.map((pp: string, i: number) => (
                                                        <div key={i} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-500/20 shadow-sm flex gap-3">
                                                            <div className="min-w-[4px] bg-red-400 rounded-full h-full"></div>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{pp}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Search Sources */}
                                        {enrichment.search_results?.length > 0 && (
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                    <Search className="w-5 h-5 text-slate-400" /> Fonti Analizzate
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {enrichment.search_results.map((res: any, i: number) => (
                                                        <a key={i} href={res.url} target="_blank" className="p-3 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 hover:border-blue-400 transition-colors block group">
                                                            <div className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate group-hover:underline">{res.title}</div>
                                                            <div className="text-xs text-slate-400 truncate mt-1">{res.url}</div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

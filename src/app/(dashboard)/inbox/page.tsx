"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, User, Clock, Send, Archive, Trash2, RefreshCw, Mail, Reply, X, PenTool, Settings, Maximize2, Minimize2, Copy, Tag, Plus, LayoutTemplate, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { EmailTagInput } from "@/components/ui/EmailTagInput";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import Link from "next/link";
// Types
interface Conversation {
    lead_id: string;
    lead_name: string;
    lead_email: string;
    company: string;
    last_message: string;
    last_message_at: string;
    unread: boolean;
    status: 'replied' | 'archived';
    tags?: string[];
}

const AVAILABLE_TAGS = [
    { label: "Interessato", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    { label: "Da seguire", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
    { label: "Non interessato", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    { label: "Meeting", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    { label: "Cliente", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" }
];

interface Message {
    id: string;
    type: 'initial' | 'follow_up_1' | 'follow_up_2' | 'break_up' | 'inbound';
    body_final?: string;
    body?: string;
    subject?: string;
    created_at: string;
    status: string;
    from_name?: string;
    cc?: string[];
    bcc?: string[];
}

const cleanHtml = (html: string) => {
    if (!html) return "";
    if (typeof document === 'undefined') return html;
    if (html.startsWith("&lt;") || html.includes("&lt;p&gt;")) {
        try {
            const txt = document.createElement("textarea");
            txt.innerHTML = html;
            return txt.value;
        } catch (e) { return html; }
    }
    return html;
};

// Helper for offline check
const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

export default function InboxPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<string | null>(null);

    // Reply State
    const [replyText, setReplyText] = useState("");
    const [replyTo, setReplyTo] = useState<string[]>([]);
    const [replyCc, setReplyCc] = useState<string[]>([]);
    const [replyBcc, setReplyBcc] = useState<string[]>([]);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [isReplying, setIsReplying] = useState(false);

    // Editor Ref
    const [editor, setEditor] = useState<any>(null);

    // Signature State
    const [signature, setSignature] = useState("");
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [tempSignature, setTempSignature] = useState("");
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

    // Filter
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    // Context Menu State
    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, leadId: string } | null>(null);

    // Templates State
    const [templates, setTemplates] = useState<{ id: string, title: string, body: string }[]>([]);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ title: '', body: '' });

    // AI Summary State
    const [summary, setSummary] = useState<string | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    useEffect(() => {
        // Load signature
        const savedSig = localStorage.getItem('email_signature');
        if (savedSig) {
            setSignature(savedSig);
            setTempSignature(savedSig);
        } else {
            const defaultSig = `<p><br>--<br><strong>Nome Cognome</strong><br>Ruolo<br>Azienda</p>`;
            setSignature(defaultSig);
            setTempSignature(defaultSig);
        }

        // Load templates
        const savedTemplates = localStorage.getItem('email_templates');
        if (savedTemplates) {
            setTemplates(JSON.parse(savedTemplates));
        } else {
            setTemplates([{ id: '1', title: 'Intro', body: 'Ciao, grazie per il tuo interesse.' }]);
        }

        fetchConversations();
    }, []);

    const saveTemplate = () => {
        if (!newTemplate.title || !newTemplate.body) return;
        const updated = [...templates, { id: Date.now().toString(), ...newTemplate }];
        setTemplates(updated);
        localStorage.setItem('email_templates', JSON.stringify(updated));
        setNewTemplate({ title: '', body: '' });
    };

    const deleteTemplate = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        localStorage.setItem('email_templates', JSON.stringify(updated));
    };

    const insertTemplate = (body: string) => {
        if (editor) {
            editor.commands.insertContent(body);
            setIsTemplateModalOpen(false);
        }
    };

    useEffect(() => {
        if (selectedLeadId) {
            fetchMessages(selectedLeadId);
            setIsReplying(false);
            setReplyText("");

            const lead = conversations.find(c => c.lead_id === selectedLeadId);
            if (lead) {
                setReplyTo([lead.lead_email]);
            } else {
                setReplyTo([]);
            }
            setReplyCc([]);
            setReplyBcc([]);
            setShowCc(false);
            setShowBcc(false);
        }
    }, [selectedLeadId, conversations]);

    // Context Menu: Close on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const saveSignature = () => {
        localStorage.setItem('email_signature', tempSignature);
        setSignature(tempSignature);
        setIsSignatureModalOpen(false);
        toast.success("Firma salvata!");
    };

    const insertSignature = () => {
        if (editor) {
            editor.chain().focus().insertContent(signature).run();
            toast.success("Firma inserita");
        } else {
            setReplyText(prev => prev + signature);
            toast.success("Firma accodata (Editor non pronto)");
        }
    };

    const handleContextMenu = (e: React.MouseEvent, leadId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, leadId });
    };

    const handleMarkAsRead = async (leadId: string, status?: 'read' | 'unread') => {
        const conversation = conversations.find(c => c.lead_id === leadId);
        if (!conversation) return;

        const targetStatus = status === 'read' ? 'read' : (status === 'unread' ? 'unread' : (conversation.unread ? 'read' : 'unread'));
        const newUnread = targetStatus === 'unread';

        if (conversation.unread === newUnread) return; // No change needed

        const wasUnread = conversation.unread;

        // Optimistic update
        setConversations(prev => prev.map(c =>
            c.lead_id === leadId ? { ...c, unread: newUnread } : c
        ));

        // API Call
        try {
            const res = await fetch('/api/leads/read-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId,
                    status: targetStatus
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed");
            }
        } catch (e) {
            console.error(e);
            toast.error("Errore salvataggio stato");
            // Revert on error
            setConversations(prev => prev.map(c =>
                c.lead_id === leadId ? { ...c, unread: wasUnread } : c
            ));
        }
    };

    const promptDeleteConversation = (leadId: string) => {
        setLeadToDelete(leadId);
    };

    const confirmDeleteConversation = async () => {
        if (!leadToDelete) return;
        const leadId = leadToDelete;
        const previousConversations = [...conversations];

        // Optimistic update
        setConversations(prev => prev.filter(c => c.lead_id !== leadId));
        if (selectedLeadId === leadId) {
            setSelectedLeadId(null);
            setMessages([]);
        }

        try {
            const res = await fetch(`/api/leads/messages?leadId=${leadId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed");
            toast.success("Conversazione rimossa");
        } catch (e) {
            toast.error("Errore cancellazione");
            setConversations(previousConversations);
        } finally {
            setLeadToDelete(null);
        }
    };

    const handleTagUpdate = async (leadId: string, newTags: string[]) => {
        // Optimistic
        setConversations(prev => prev.map(c =>
            c.lead_id === leadId ? { ...c, tags: newTags } : c
        ));

        try {
            const res = await fetch('/api/leads/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, tags: newTags })
            });
            if (!res.ok) throw new Error("Failed to save tags");
        } catch (e) {
            toast.error("Errore salvataggio tag");
            fetchConversations(); // Revert
        }
    };

    const handleSummarize = async () => {
        if (!selectedLeadId || messages.length === 0) return;
        setLoadingSummary(true);
        try {
            const res = await fetch('/api/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSummary(data.summary);
        } catch (e) {
            toast.error("Errore generazione riassunto");
        }
        setLoadingSummary(false);
    };

    const handleCopyEmail = (leadId: string) => {
        const lead = conversations.find(c => c.lead_id === leadId);
        if (lead) {
            navigator.clipboard.writeText(lead.lead_email);
            toast.success("Email copiata: " + lead.lead_email);
        }
    };

    const fetchConversations = async () => {
        setLoading(true);
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, leads!inner(first_name, last_name, email, company_name, status, last_read_at, tags)')
            .eq('type', 'inbound')
            .order('created_at', { ascending: false });

        if (messages) {
            const threads = new Map<string, Conversation>();
            messages.forEach((msg: any) => {
                if (!threads.has(msg.lead_id)) {
                    threads.set(msg.lead_id, {
                        lead_id: msg.lead_id,
                        lead_name: `${msg.leads.first_name} ${msg.leads.last_name || ''}`,
                        lead_email: msg.leads.email,
                        company: msg.leads.company_name,
                        last_message: msg.body.substring(0, 60) + "...",
                        last_message_at: msg.created_at,
                        unread: !msg.leads.last_read_at || new Date(msg.created_at) > new Date(msg.leads.last_read_at),
                        status: msg.leads.status,
                        tags: msg.leads.tags || []
                    });
                }
            });
            setConversations(Array.from(threads.values()));
        }
        setLoading(false);
    };

    const fetchMessages = async (leadId: string) => {
        setLoadingMessages(true);
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data as any);
        setLoadingMessages(false);
    };

    const handleReply = async () => {
        if (!replyText.trim() || replyText === "<p></p>" || !selectedLeadId) return;
        const toastId = toast.loading("Invio risposta...");

        try {
            const res = await fetch('/api/mail/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: selectedLeadId,
                    body: replyText,
                    to: replyTo,
                    cc: replyCc,
                    bcc: replyBcc
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Risposta inviata!", { id: toastId });
                setReplyText("");
                setIsReplying(false);
                fetchMessages(selectedLeadId);
            } else {
                toast.error("Errore invio: " + data.error, { id: toastId });
            }
        } catch (e: any) {
            toast.error("Errore di rete: " + e.message, { id: toastId });
        }
    };

    const filteredConversations = conversations.filter(c => {
        if (filter === 'unread') return c.unread;
        return true;
    });

    const unreadCount = conversations.filter(c => c.unread).length;

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col">
            <ConfirmModal
                isOpen={!!leadToDelete}
                onClose={() => setLeadToDelete(null)}
                onConfirm={confirmDeleteConversation}
                title="Elimina Conversazione"
                description="Sei sicuro? I messaggi verranno rimossi SOLO da questo sistema, non dalla tua email reale."
                variant="destructive"
                confirmText="Elimina"
            />
            {/* Signature Modal */}
            {isSignatureModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsSignatureModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Imposta Firma</h3>
                            <Button variant="ghost" size="sm" onClick={() => setIsSignatureModalOpen(false)}><X className="w-5 h-5" /></Button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-sm text-slate-500 mb-4">
                                Progetta la tua firma email professionale.
                            </p>
                            <RichTextEditor
                                value={tempSignature}
                                onChange={setTempSignature}
                                className="min-h-[200px]"
                                placeholder="Scrivi la tua firma..."
                            />
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
                            <Button variant="ghost" onClick={() => setIsSignatureModalOpen(false)}>Annulla</Button>
                            <Button onClick={saveSignature} className="bg-blue-600 hover:bg-blue-700 text-white">Salva Firma</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reply Modal (Expanded) */}
            {isReplyModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={() => setIsReplyModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-950 rounded-xl shadow-2xl w-[95vw] h-[95vh] flex flex-col border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Reply className="w-5 h-5 text-blue-600" />
                                Rispondi a {conversations.find(c => c.lead_id === selectedLeadId)?.lead_name}
                            </h3>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsReplyModalOpen(false)} title="Riduci a icona">
                                    <Minimize2 className="w-5 h-5 text-slate-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Recipients Area */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-950">
                            <div className="flex items-start gap-3">
                                <span className="text-sm font-semibold text-slate-500 mt-1.5 w-10">A:</span>
                                <EmailTagInput
                                    value={replyTo}
                                    onChange={setReplyTo}
                                    className="flex-1 min-h-[38px]"
                                    placeholder="Destinatari"
                                />
                                <div className="flex gap-1 mt-1">
                                    {(!showCc && replyCc.length === 0) && <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setShowCc(true)}>Cc</Button>}
                                    {(!showBcc && replyBcc.length === 0) && <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setShowBcc(true)}>CCN</Button>}
                                </div>
                            </div>

                            {(showCc || replyCc.length > 0) && (
                                <div className="flex items-start gap-3 animate-in slide-in-from-top-1">
                                    <span className="text-sm font-semibold text-slate-500 mt-1.5 w-10">Cc:</span>
                                    <EmailTagInput
                                        value={replyCc}
                                        onChange={setReplyCc}
                                        className="flex-1 min-h-[38px]"
                                        placeholder="Copia Conoscenza"
                                    />
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full mt-0.5" onClick={() => { setShowCc(false); setReplyCc([]); }}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </Button>
                                </div>
                            )}

                            {(showBcc || replyBcc.length > 0) && (
                                <div className="flex items-start gap-3 animate-in slide-in-from-top-1">
                                    <span className="text-sm font-semibold text-slate-500 mt-1.5 w-10">CCN:</span>
                                    <EmailTagInput
                                        value={replyBcc}
                                        onChange={setReplyBcc}
                                        className="flex-1 min-h-[38px]"
                                        placeholder="Copia Nascosta"
                                    />
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full mt-0.5" onClick={() => { setShowBcc(false); setReplyBcc([]); }}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <RichTextEditor
                                value={replyText}
                                onChange={setReplyText}
                                onEditorReady={setEditor}
                                className="border-0 h-full rounded-none focus-visible:ring-0"
                                customActions={
                                    <>
                                        <div className="flex gap-1 border-r border-slate-200 dark:border-slate-800 pr-1 mr-1">
                                            <button onClick={insertSignature} className="p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400" title="Inserisci Firma"><PenTool className="w-4 h-4" /></button>
                                            <button onClick={() => setIsSignatureModalOpen(true)} className="p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400" title="Impostazioni Firma"><Settings className="w-4 h-4" /></button>
                                        </div>
                                        <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400" title="Template Rapidi"><LayoutTemplate className="w-4 h-4" /></button>
                                    </>
                                }
                            />
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                            <Button variant="ghost" onClick={() => setIsReplyModalOpen(false)}>
                                Continua nell'editor piccolo
                            </Button>
                            <Button onClick={() => { setIsReplyModalOpen(false); handleReply(); }} disabled={!replyText.trim() || replyText === '<p></p>'} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                                Invia Messaggio <Send className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Header title="Inbox Unificata" description="Gestisci tutte le risposte dai tuoi lead in un unico posto." />

            <div className="flex-1 min-h-0 flex gap-4 mt-4">
                {/* Sidebar */}
                <div className="w-[380px] flex flex-col bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Sidebar Header */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="font-bold text-lg dark:text-white">Messaggi</h2>
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => selectedLeadId && promptDeleteConversation(selectedLeadId)}
                                    className="hover:text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500"
                                    onClick={async () => {
                                        const id = toast.loading("Sincronizzazione in corso...");

                                        if (isOffline()) {
                                            toast.error("Offline: Controlla la tua connessione", { id });
                                            // Fallback refresh to show local data if any
                                            fetchConversations();
                                            return;
                                        }

                                        try {
                                            const res = await fetch('/api/cron/sync-inbox');

                                            // Handle server-side errors (e.g. 500)
                                            if (!res.ok) {
                                                const errText = await res.text().catch(() => "Errore sconosciuto");
                                                toast.error(`Errore Server (${res.status}): ${errText}`, { id });
                                                fetchConversations();
                                                return;
                                            }

                                            const data = await res.json();
                                            if (data.success) {
                                                const msg = data.stats.matched > 0
                                                    ? `Trovati ${data.stats.matched} nuovi messaggi.`
                                                    : "Nessun nuovo messaggio.";
                                                toast.success(msg, { id });
                                                fetchConversations();
                                            } else {
                                                toast.error("Errore: " + data.error, { id });
                                            }
                                        } catch (e) {
                                            toast.error("Errore di connessione o Offline", { id });
                                            fetchConversations();
                                        }
                                    }}
                                    title="Aggiorna e Sincronizza"
                                >
                                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                                </Button>
                            </div>
                        </div>
                        {/* Search & Filter */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Cerca per nome, azienda..."
                                    className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-1"
                                />
                            </div>
                            <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={cn(
                                        "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                        filter === 'all' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    Tutti
                                </button>
                                <button
                                    onClick={() => setFilter('unread')}
                                    className={cn(
                                        "flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-2",
                                        filter === 'unread' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    Da leggere
                                    {unreadCount > 0 && <span className="text-[10px] bg-blue-600 text-white px-1.5 rounded-full">{unreadCount}</span>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Thread List - Added custom-scrollbar class here */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        {/* Context Menu */}
                        {contextMenu && (
                            <div
                                className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                                style={{ top: contextMenu.y, left: contextMenu.x }}
                            >
                                <button
                                    onClick={() => handleMarkAsRead(contextMenu.leadId)}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    <Mail className="w-4 h-4" /> Segna come {conversations.find(c => c.lead_id === contextMenu.leadId)?.unread ? 'letto' : 'da leggere'}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyEmail(contextMenu.leadId);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" /> Copia email
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                <button
                                    onClick={() => promptDeleteConversation(contextMenu.leadId)}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Elimina conversazione
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3">
                                <Loader2 className="animate-spin text-blue-600" />
                                <p className="text-xs text-slate-400">Caricamento messaggi...</p>
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[300px] text-center p-8 opacity-60">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                    <Mail className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Nessun messaggio</p>
                                <p className="text-xs text-slate-500 mt-1">La tua inbox è vuota per ora.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredConversations.map(conv => (
                                    <div
                                        key={conv.lead_id}
                                        onClick={() => {
                                            setSelectedLeadId(conv.lead_id);
                                            if (conv.unread) handleMarkAsRead(conv.lead_id, 'read');
                                        }}
                                        onContextMenu={(e) => handleContextMenu(e, conv.lead_id)}
                                        className={cn(
                                            "p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 group relative select-none",
                                            selectedLeadId === conv.lead_id ? "bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-l-blue-500" : "border-l-2 border-l-transparent"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {conv.unread && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                                                <span className={cn("text-sm truncate", conv.unread ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-200")}>
                                                    {conv.lead_name}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">
                                                {new Date(conv.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate mb-1.5">{conv.company}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate opacity-90">
                                            {conv.last_message.replace(/<[^>]*>/g, '')}
                                        </p>
                                        {/* Tags List */}
                                        {conv.tags && conv.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {conv.tags.map(tag => {
                                                    const tagConfig = AVAILABLE_TAGS.find(t => t.label === tag);
                                                    return (
                                                        <span key={tag} className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap", tagConfig?.color || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                                                            {tag}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content (Reading Pane) */}
                <div className="flex-1 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
                    {selectedLeadId ? (
                        <>
                            {/* Header */}
                            <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-950 z-10 shrink-0">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center text-blue-700 dark:text-blue-100 font-bold text-lg shrink-0">
                                        {conversations.find(c => c.lead_id === selectedLeadId)?.lead_name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
                                                {conversations.find(c => c.lead_id === selectedLeadId)?.lead_name}
                                            </h3>
                                            {messages.length > 0 && messages[0].subject && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-700">|</span>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[300px]" title={messages[0].subject}>
                                                        {messages[0].subject}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                                            <span>{conversations.find(c => c.lead_id === selectedLeadId)?.lead_email}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                                            <span>{conversations.find(c => c.lead_id === selectedLeadId)?.company}</span>
                                        </div>
                                        {/* Header Tags */}
                                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                                            {conversations.find(c => c.lead_id === selectedLeadId)?.tags?.map(tag => {
                                                const tagConfig = AVAILABLE_TAGS.find(t => t.label === tag);
                                                return (
                                                    <span key={tag} className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", tagConfig?.color || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                                                        {tag}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const lead = conversations.find(c => c.lead_id === selectedLeadId!);
                                                                if (lead && lead.tags) {
                                                                    handleTagUpdate(lead.lead_id, lead.tags.filter(t => t !== tag));
                                                                }
                                                            }}
                                                            className="hover:opacity-60"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                );
                                            })}

                                            {/* Add Tag Dropdown */}
                                            <div className="relative group">
                                                <button className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors">
                                                    <Plus className="w-3 h-3" /> Tag
                                                </button>

                                                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg p-1 z-50 hidden group-hover:block transition-all animate-in fade-in zoom-in-95">
                                                    <p className="text-[10px] text-slate-400 px-2 py-1 font-semibold uppercase tracking-wider">Aggiungi Etichetta</p>
                                                    {AVAILABLE_TAGS.map(tag => (
                                                        <button
                                                            key={tag.label}
                                                            onClick={() => {
                                                                const lead = conversations.find(c => c.lead_id === selectedLeadId!);
                                                                if (lead) {
                                                                    const currentTags = lead.tags || [];
                                                                    if (!currentTags.includes(tag.label)) {
                                                                        handleTagUpdate(lead.lead_id, [...currentTags, tag.label]);
                                                                    }
                                                                }
                                                            }}
                                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md flex items-center gap-2"
                                                        >
                                                            <span className={cn("w-2 h-2 rounded-full", tag.color.split(' ')[0])}></span>
                                                            <span className="text-slate-700 dark:text-slate-200">{tag.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" title="Archivia" onClick={() => toast.success("Archiviazione: Funzionalità in arrivo!")}><Archive className="w-4 h-4 text-slate-500" /></Button>
                                    <Button variant="ghost" size="sm" title="Elimina" onClick={() => selectedLeadId && promptDeleteConversation(selectedLeadId)}><Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" /></Button>
                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Riassumi con IA"
                                        onClick={handleSummarize}
                                        disabled={loadingSummary}
                                        className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
                                    >
                                        <Sparkles className={cn("w-4 h-4", loadingSummary ? "animate-spin" : "")} />
                                    </Button>
                                </div>
                            </div>

                            {/* Summary Alert */}
                            {summary && (
                                <div className="mx-4 mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-start gap-3 relative animate-in slide-in-from-top-2">
                                    <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-100 mb-1">Riassunto IA</h4>
                                        <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">{summary}</p>
                                    </div>
                                    <button onClick={() => setSummary(null)} className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Chat Scroll Area - Added custom-scrollbar class here */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-black/20 scroll-smooth custom-scrollbar">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
                                ) : (
                                    messages.map((msg) => {
                                        const isInbound = msg.type === 'inbound';
                                        const activeConv = conversations.find(c => c.lead_id === selectedLeadId);
                                        return (
                                            <div key={msg.id} className="w-full mx-auto">
                                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
                                                    {/* Email Header */}
                                                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/50">
                                                        <div className="flex gap-4">
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                                                                isInbound ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100" : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                                                            )}>
                                                                {isInbound ? (msg.from_name ? msg.from_name.charAt(0) : 'L') : 'T'}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                                        {isInbound ? (
                                                                            <>
                                                                                {msg.from_name || activeConv?.lead_name || 'Lead'}
                                                                                {activeConv?.company && (
                                                                                    <span className="text-slate-400 font-normal text-xs border-l border-slate-300 dark:border-slate-700 pl-2">
                                                                                        {activeConv.company}
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        ) : 'Tu (Outreach System)'}
                                                                    </span>
                                                                    <span className="text-xs text-slate-500">
                                                                        &lt;{isInbound ? conversations.find(c => c.lead_id === selectedLeadId)?.lead_email : 'tu@iltuoindirizzo.com'}&gt;
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-slate-500 mt-0.5">
                                                                    A: {isInbound ? 'Te' : conversations.find(c => c.lead_id === selectedLeadId)?.lead_email}
                                                                </div>
                                                                {msg.cc && msg.cc.length > 0 && <div className="text-xs text-slate-400 mt-0.5">Cc: {msg.cc.join(', ')}</div>}
                                                                {/* Corrected Bcc to CCN here */}
                                                                {msg.bcc && msg.bcc.length > 0 && <div className="text-xs text-slate-400 mt-0.5">CCN: {msg.bcc.join(', ')}</div>}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex flex-col items-end">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                {!isReplying && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                        onClick={() => {
                                                                            setIsReplying(true);
                                                                            setTimeout(() => {
                                                                                document.getElementById('reply-editor')?.scrollIntoView({ behavior: 'smooth' });
                                                                            }, 100);
                                                                        }}
                                                                    >
                                                                        <Reply className="w-3 h-3 mr-1" /> Rispondi
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <span>{new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                            <span>{new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>

                                                    {/* Email Body */}
                                                    <div className="p-8 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                                                        <div
                                                            className="prose prose-sm dark:prose-invert max-w-none prose-p:mb-4 prose-a:text-blue-600"
                                                            dangerouslySetInnerHTML={{ __html: cleanHtml(msg.body_final || msg.body || "") }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Reply Box */}
                            <div id="reply-editor" className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 z-20">
                                {!isReplying ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-slate-500 h-10 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
                                        onClick={() => setIsReplying(true)}
                                    >
                                        <Reply className="w-4 h-4 mr-2" /> Rispondi...
                                    </Button>
                                ) : (
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 bg-white dark:bg-slate-900">
                                        {/* Recipients Header */}
                                        <div className="flex flex-col gap-1 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="h-6 w-8 text-xs font-semibold text-slate-500 p-0 hover:bg-transparent cursor-default">A:</Button>
                                                <EmailTagInput
                                                    value={replyTo}
                                                    onChange={setReplyTo}
                                                    className="flex-1"
                                                    placeholder="Destinatari"
                                                />
                                                <div className="flex gap-1 ml-auto">
                                                    {!showCc && <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-slate-600" onClick={() => setShowCc(true)}>Cc</Button>}
                                                    {!showBcc && <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-slate-600" onClick={() => setShowBcc(true)}>CCN</Button>}
                                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 self-center" />
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-blue-100 text-blue-600 dark:hover:bg-blue-900/30 rounded-full" onClick={() => setIsReplyModalOpen(true)} title="Espandi A Schermo Intero">
                                                        <Maximize2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full ml-1" onClick={() => setIsReplying(false)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            {showCc && (
                                                <div className="flex items-center gap-2 animate-in slide-in-from-top-1">
                                                    <span className="w-8 text-xs font-semibold text-slate-500 text-center">Cc:</span>
                                                    <EmailTagInput
                                                        value={replyCc}
                                                        onChange={setReplyCc}
                                                        className="flex-1"
                                                        placeholder="Cc"
                                                    />
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full" onClick={() => { setShowCc(false); setReplyCc([]); }}>
                                                        <X className="w-3 h-3 text-slate-400" />
                                                    </Button>
                                                </div>
                                            )}
                                            {showBcc && (
                                                <div className="flex items-center gap-2 animate-in slide-in-from-top-1">
                                                    <span className="w-8 text-xs font-semibold text-slate-500 text-center">CCN:</span>
                                                    <EmailTagInput
                                                        value={replyBcc}
                                                        onChange={setReplyBcc}
                                                        className="flex-1"
                                                        placeholder="CCN"
                                                    />
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full" onClick={() => { setShowBcc(false); setReplyBcc([]); }}>
                                                        <X className="w-3 h-3 text-slate-400" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <RichTextEditor
                                            value={replyText}
                                            onChange={setReplyText}
                                            onEditorReady={setEditor}
                                            className="border-0 rounded-none min-h-[200px] bg-white dark:bg-slate-900"
                                            customActions={
                                                <>
                                                    <div className="flex gap-1 border-r border-slate-200 dark:border-slate-800 pr-1 mr-1">
                                                        <button
                                                            onClick={insertSignature}
                                                            className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                            title="Inserisci Firma"
                                                        >
                                                            <PenTool className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setIsSignatureModalOpen(true)}
                                                            className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                            title="Imposta Firma"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsTemplateModalOpen(true)}
                                                        className="p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                        title="Template Rapidi"
                                                    >
                                                        <LayoutTemplate className="w-4 h-4" />
                                                    </button>
                                                </>
                                            }
                                        />

                                        <div className="flex justify-end p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                            <div className="flex gap-2">
                                                <Button variant="ghost" onClick={() => setIsReplying(false)}>Annulla</Button>
                                                <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || replyText === '<p></p>'} className="px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                                                    Invia <Send className="w-3 h-3 ml-2" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 dark:bg-slate-900/20">
                            <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-6">
                                <Mail className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Seleziona una conversazione</h3>
                            <p className="text-sm max-w-xs text-center text-slate-500">Scegli un messaggio dall'elenco a sinistra per visualizzare la cronologia e rispondere.</p>
                        </div>
                    )}
                </div>
            </div>
            {/* Template Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setIsTemplateModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-950 rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <LayoutTemplate className="w-5 h-5 text-blue-500" /> Template Rapidi
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setIsTemplateModalOpen(false)} className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                            {/* New Template Form */}
                            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 mb-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Nuovo Template</h4>
                                <Input
                                    placeholder="Titolo (es. Intro)"
                                    className="mb-2 bg-white dark:bg-slate-950"
                                    value={newTemplate.title}
                                    onChange={e => setNewTemplate(prev => ({ ...prev, title: e.target.value }))}
                                />
                                <textarea
                                    placeholder="Testo del messaggio..."
                                    className="w-full text-sm p-3 rounded-md border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-950 min-h-[80px]"
                                    value={newTemplate.body}
                                    onChange={e => setNewTemplate(prev => ({ ...prev, body: e.target.value }))}
                                />
                                <div className="flex justify-end mt-2">
                                    <Button size="sm" onClick={saveTemplate} disabled={!newTemplate.title || !newTemplate.body} className="bg-blue-600">Salva Template</Button>
                                </div>
                            </div>

                            {/* List */}
                            <h4 className="text-xs font-bold text-slate-500 uppercase">I tuoi Template</h4>
                            {templates.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Nessun template salvato.</p>
                            ) : (
                                <div className="space-y-2">
                                    {templates.map(t => (
                                        <div key={t.id} className="group flex items-start justify-between p-3 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer" onClick={() => insertTemplate(t.body)}>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900 dark:text-white">{t.title}</p>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{t.body}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-400 hover:text-red-500"
                                                onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

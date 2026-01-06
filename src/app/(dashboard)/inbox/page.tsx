"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, User, Clock, Send, Archive, Trash2, RefreshCw, Mail, Reply, X, PenTool, Settings } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { EmailTagInput } from "@/components/ui/EmailTagInput"; // Added import
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
}

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

export default function InboxPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Reply State - Updated to arrays
    const [replyText, setReplyText] = useState("");
    const [replyTo, setReplyTo] = useState<string[]>([]);
    const [replyCc, setReplyCc] = useState<string[]>([]);
    const [replyBcc, setReplyBcc] = useState<string[]>([]);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [isReplying, setIsReplying] = useState(false);

    // Editor Ref for direct manipulation
    const [editor, setEditor] = useState<any>(null);

    // Signature State
    const [signature, setSignature] = useState("");
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
    const [tempSignature, setTempSignature] = useState("");

    // Filter
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

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

        fetchConversations();
    }, []);

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

    const saveSignature = () => {
        localStorage.setItem('email_signature', tempSignature);
        setSignature(tempSignature);
        setIsSignatureModalOpen(false);
        toast.success("Firma salvata!");
    };

    const insertSignature = () => {
        if (editor) {
            // Using editor chain to insert content at cursor position prevents overwriting
            // and ensures smooth UX
            editor.chain().focus().insertContent(signature).run();
            toast.success("Firma inserita");
        } else {
            // Fallback if editor not ready (should generally involve setting text, but Tiptap is preferred via instance)
            setReplyText(prev => prev + signature);
            toast.success("Firma accodata (Editor non pronto)");
        }
    };

    const fetchConversations = async () => {
        setLoading(true);
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, leads!inner(first_name, last_name, email, company_name, status)')
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
                        unread: true, // TODO: Real logic
                        status: msg.leads.status
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
            // const cleanRecipients = (str: string) => str.split(/[,;]/).map(s => s.trim()).filter(Boolean);
            // Already arrays now

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
            {/* Signature Modal */}
            {isSignatureModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
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

            <Header title="Inbox Unificata" description="Gestisci tutte le risposte dai tuoi lead in un unico posto." />

            <div className="flex-1 min-h-0 flex gap-4 mt-4">
                {/* Sidebar */}
                <div className="w-[380px] flex flex-col bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {/* Sidebar Header */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="font-bold text-lg dark:text-white">Messaggi</h2>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => fetchConversations()} title="Aggiorna">
                                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500"
                                    onClick={async () => {
                                        const id = toast.loading("Sync IMAP in corso...");
                                        try {
                                            const res = await fetch('/api/cron/sync-inbox');
                                            const data = await res.json();
                                            if (data.success) {
                                                toast.success(`Trovati ${data.stats.matched} nuovi messaggi.`, { id });
                                                fetchConversations();
                                            } else {
                                                toast.error("Errore: " + data.error, { id });
                                            }
                                        } catch (e) { toast.error("Offline", { id }); }
                                    }}
                                    title="Forza Sync Ora"
                                >
                                    <Mail className="w-4 h-4" />
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
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                                        onClick={() => setSelectedLeadId(conv.lead_id)}
                                        className={cn(
                                            "p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 group relative",
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
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" title="Archivia"><Archive className="w-4 h-4 text-slate-500" /></Button>
                                    <Button variant="ghost" size="sm" title="Elimina"><Trash2 className="w-4 h-4 text-red-400" /></Button>
                                </div>
                            </div>

                            {/* Chat Scroll Area - Added custom-scrollbar class here */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-black/20 scroll-smooth custom-scrollbar">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
                                ) : (
                                    messages.map((msg) => {
                                        const isInbound = msg.type === 'inbound';
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
                                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                                        {isInbound ? (msg.from_name || 'Lead') : 'Tu (Outreach System)'}
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
        </div>
    );
}

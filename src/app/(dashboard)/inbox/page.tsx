"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Search, Send, Paperclip, MoreVertical, Trash2, Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Mock Data for UI testing/development
const MOCK_THREADS = [
    {
        id: 1,
        lead: "Mario Rossi",
        company: "Tech Solutions Srl",
        subject: "Re: Collaborazione B2B",
        preview: "Grazie per l'email, saremmo interessati a capire meglio come...",
        date: "10:30",
        unread: true,
        messages: [
            { id: 101, from: "me", body: "<p>Ciao Mario,<br><br>Volevo proporti una collaborazione...</p>", date: "Yesterday, 14:00" },
            { id: 102, from: "them", body: "<p>Buongiorno Alessandro,</p><p>Grazie per l'email, saremmo interessati a capire meglio come la vostra soluzione può aiutarci con l'automazione.</p><p>Avete una demo disponibile?</p><p>Cordiali saluti,<br>Mario</p>", date: "Today, 10:30" }
        ]
    },
    {
        id: 2,
        lead: "Giulia Bianchi",
        company: "Creative Agency",
        subject: "Re: Preventivo Servizi",
        preview: "Potreste mandarmi maggiori dettagli sui costi?",
        date: "Ieri",
        unread: false,
        messages: [
            { id: 201, from: "me", body: "<p>Ciao Giulia...</p>", date: "2 days ago" },
            { id: 202, from: "them", body: "<p>Salve,</p><p>Potreste mandarmi maggiori dettagli sui costi?</p>", date: "Yesterday, 09:15" }
        ]
    },
    {
        id: 3,
        lead: "Luca Verdi",
        company: "Green Energy SpA",
        subject: "Incontro conoscitivo",
        preview: "Siamo disponibili per una call martedì prossimo.",
        date: "2 Gen",
        unread: false,
        messages: [
            { id: 301, from: "them", body: "<p>Siamo disponibili per una call martedì prossimo.</p>", date: "2 Jan, 16:20" }
        ]
    }
];

export default function InboxPage() {
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(MOCK_THREADS[0].id);
    const [searchTerm, setSearchTerm] = useState("");
    const [replyText, setReplyText] = useState("");

    const filteredThreads = MOCK_THREADS.filter(t =>
        t.lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedThread = MOCK_THREADS.find(t => t.id === selectedThreadId);

    const handleSend = () => {
        alert("Simulazione: L'invio reale richiede il webhook n8n configurato (Step successivo).");
        setReplyText("");
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col">
            <Header title="Inbox" />

            <div className="flex flex-1 gap-6 overflow-hidden h-full pb-4">

                {/* Left Sidebar - Thread List */}
                <div className="w-full md:w-1/3 glass dark:glass-dark rounded-2xl border border-white/20 dark:border-white/5 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Cerca email..."
                                className="pl-9 bg-white/50 dark:bg-black/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredThreads.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Nessuna conversazione trovata.</div>
                        ) : (
                            filteredThreads.map((thread) => (
                                <div
                                    key={thread.id}
                                    onClick={() => setSelectedThreadId(thread.id)}
                                    className={cn(
                                        "p-4 border-b border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors",
                                        selectedThreadId === thread.id ? "bg-slate-50 dark:bg-white/10 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={cn("font-medium text-sm", thread.unread ? "text-slate-900 dark:text-white font-bold" : "text-slate-700 dark:text-slate-300")}>
                                            {thread.lead}
                                        </h4>
                                        <span className="text-xs text-slate-400">{thread.date}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-1 font-medium truncate">{thread.company}</div>
                                    <div className={cn("text-sm truncate", thread.unread ? "text-slate-800 dark:text-slate-200 font-semibold" : "text-slate-500")}>
                                        {thread.subject}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 truncate">
                                        {thread.preview}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Content - Thread Detail */}
                <div className="flex-1 glass dark:glass-dark rounded-2xl border border-white/20 dark:border-white/5 flex flex-col overflow-hidden hidden md:flex">
                    {selectedThread ? (
                        <>
                            {/* Toolbar */}
                            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedThread.subject}</h2>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
                                        Inbox
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer"><Trash2 className="w-4 h-4 text-slate-400" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer"><MoreVertical className="w-4 h-4 text-slate-400" /></Button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-black/10">
                                {selectedThread.messages.map((msg) => (
                                    <div key={msg.id} className={cn("flex flex-col max-w-3xl", msg.from === 'me' ? "ml-auto items-end" : "mr-auto items-start")}>
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{msg.from === 'me' ? 'Tu' : selectedThread.lead}</span>
                                            <span className="text-xs text-slate-400">{msg.date}</span>
                                        </div>
                                        <div className={cn(
                                            "p-4 rounded-2xl shadow-sm text-sm leading-relaxed",
                                            msg.from === 'me'
                                                ? "bg-blue-600 text-white rounded-tr-sm"
                                                : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                                        )}>
                                            <div dangerouslySetInnerHTML={{ __html: msg.body }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Reply Box */}
                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10">
                                <div className="relative">
                                    <textarea
                                        className="w-full h-32 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border-none focus:ring-2 focus:ring-blue-500 resize-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                                        placeholder="Scrivi una risposta..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                    />
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer">
                                            <Paperclip className="w-4 h-4 text-slate-500" />
                                        </Button>
                                        <Button size="sm" className="pl-3 pr-4 rounded-full cursor-pointer hover:shadow-lg transition-shadow" onClick={handleSend}>
                                            <Send className="w-3 h-3 mr-2" />
                                            Invia
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Mail className="w-16 h-16 mb-4 opacity-20" />
                            <p>Seleziona una conversazione per leggerla</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

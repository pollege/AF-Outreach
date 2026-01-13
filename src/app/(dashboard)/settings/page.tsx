"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Play, Loader2, Server, Globe, Mail, Settings, Users, Brain } from "lucide-react";
import { MailAccountsTab } from "@/components/settings/MailAccountsTab";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { useEffect } from "react";
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'accounts'>('general');


    return (
        <div className="max-w-4xl">
            <Header title="Impostazioni" />

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-8">
                <button
                    onClick={() => setActiveTab('general')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'general'
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                >
                    <Settings className="w-4 h-4" />
                    Generale
                </button>
                <button
                    onClick={() => setActiveTab('accounts')}
                    className={cn(
                        "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                        activeTab === 'accounts'
                            ? "border-blue-500 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                >
                    <Mail className="w-4 h-4" />
                    Email Accounts
                </button>
            </div>

            {activeTab === 'general' ? (
                <>
                    {/* AI Info Card */}
                    <div className="glass dark:glass-dark rounded-2xl p-6 border border-white/20 dark:border-white/5 mb-8 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-indigo-900/10 dark:to-blue-900/10">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Brain className="w-5 h-5 text-indigo-500" />
                            Stato Modelli AI (Attivi)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Globe className="w-12 h-12 text-indigo-600" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Enrichment (Ricerca)</h3>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">GPT-4o Mini</p>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">Auto-Search & Analisi Web</p>
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Brain className="w-12 h-12 text-emerald-600" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Summarization</h3>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">GPT-4o Mini</p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Riassunti Inbox</p>
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Mail className="w-12 h-12 text-blue-600" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Copywriting</h3>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">GPT-4o</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">Generazione Bozze Email</p>
                            </div>
                        </div>
                    </div>



                    {/* n8n Configuration Section */}
                    <N8nConfigSection />

                    {/* API Configuration Placeholder */}
                    <div className="glass dark:glass-dark rounded-2xl p-8 border border-white/20 dark:border-white/5">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Configurazione API</h2>
                        <p className="text-slate-500 text-sm mb-4">
                            Le chiavi API sono gestite nel file <code>.env.local</code> per sicurezza.
                        </p>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-2 border-b border-white/10">
                                <span>Supabase URL</span>
                                <span className="font-mono text-slate-500">Configurato</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/10">
                                <span>OpenAI API Key</span>
                                <span className="font-mono text-slate-500">Configurato</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-white/10">
                                <span>Brave Search API</span>
                                <span className="font-mono text-slate-500">Configurato</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <MailAccountsTab />
            )}
        </div>
    );
}

function N8nConfigSection() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Fetch initial settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.n8n_webhook_url) setUrl(data.n8n_webhook_url);
            })
            .catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ n8n_webhook_url: url })
            });
            if (res.ok) {
                toast.success("Webhook n8n salvato!");
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            toast.error("Errore salvataggio settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass dark:glass-dark rounded-2xl p-8 border border-white/20 dark:border-white/5 mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#ff6d5a] flex items-center justify-center text-white font-bold text-xs">n8n</div>
                Configurazione Invio
            </h2>
            <p className="text-slate-500 mb-6">
                L'invio effettivo delle email è delegato a n8n per garantire affidabilità e gestione delle code.
                <br />Inserisci qui l'URL del Webhook di produzione del tuo workflow n8n.
            </p>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-xs font-semibold uppercase text-slate-500 mb-1 block">n8n Webhook URL (POST)</label>
                    <Input
                        placeholder="https://n8n.tuodominio.com/webhook/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="font-mono text-sm"
                    />
                </div>
                <div className="flex items-end">
                    <Button onClick={handleSave} disabled={saving} className="bg-[#ff6d5a] hover:bg-[#ff6d5a]/90 text-white">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva Configurazione"}
                    </Button>
                </div>
            </div>

            <div className="mt-4 p-4 bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                <p className="font-bold mb-1">Come configurare:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Importa il file <code>n8n_workflow_sender.json</code> nel tuo n8n.</li>
                    <li>Attiva il workflow.</li>
                    <li>Copia l'URL del nodo "Webhook" (Production URL) e incollalo qui sopra.</li>
                </ol>
            </div>
        </div>
    );


}

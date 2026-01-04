"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Play, Loader2, Server, Globe, Mail } from "lucide-react";

export default function SettingsPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    const triggerCron = async (endpoint: string, label: string) => {
        setLoading(label);
        setResult(null);
        try {
            const res = await fetch(`/api/cron/${endpoint}`);
            const data = await res.json();
            setResult(`Successo: ${JSON.stringify(data)}`);
        } catch (e: any) {
            setResult(`Errore: ${e.message}`);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="max-w-4xl">
            <Header title="Impostazioni" />

            {/* Manual Triggers Section */}
            <div className="glass dark:glass-dark rounded-2xl p-8 border border-white/20 dark:border-white/5 mb-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-500" />
                    Controllo Automazioni (Manuale)
                </h2>
                <p className="text-slate-500 mb-6">
                    Qui puoi avviare manualmente i processi che normalmente girano in background (Cron Jobs).
                    Utile per testare il flusso immediato senza aspettare.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        onClick={() => triggerCron('enrich', 'enrich')}
                        disabled={!!loading}
                        variant="outline"
                        className="justify-start h-auto py-4"
                    >
                        <Globe className="w-5 h-5 mr-3 text-purple-500" />
                        <div className="text-left">
                            <div className="font-semibold">1. Enrichment Lead</div>
                            <div className="text-xs text-slate-500 font-normal">Cerca news & info</div>
                        </div>
                        {loading === 'enrich' && <Loader2 className="ml-auto w-4 h-4 animate-spin" />}
                    </Button>

                    <Button
                        onClick={() => triggerCron('generate', 'generate')}
                        disabled={!!loading}
                        variant="outline"
                        className="justify-start h-auto py-4"
                    >
                        <Play className="w-5 h-5 mr-3 text-amber-500" />
                        <div className="text-left">
                            <div className="font-semibold">2. Generazione Email</div>
                            <div className="text-xs text-slate-500 font-normal">Crea bozze messaggi</div>
                        </div>
                        {loading === 'generate' && <Loader2 className="ml-auto w-4 h-4 animate-spin" />}
                    </Button>

                    <Button
                        onClick={() => triggerCron('send', 'send')}
                        disabled={!!loading}
                        variant="outline"
                        className="justify-start h-auto py-4"
                    >
                        <Mail className="w-5 h-5 mr-3 text-emerald-500" />
                        <div className="text-left">
                            <div className="font-semibold">3. Invio Email</div>
                            <div className="text-xs text-slate-500 font-normal">Manda a n8n</div>
                        </div>
                        {loading === 'send' && <Loader2 className="ml-auto w-4 h-4 animate-spin" />}
                    </Button>
                </div>

                {result && (
                    <div className="mt-6 p-4 rounded-xl bg-slate-100 dark:bg-black/20 font-mono text-xs overflow-x-auto text-slate-600 dark:text-slate-300">
                        {result}
                    </div>
                )}
            </div>

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
        </div>
    );
}

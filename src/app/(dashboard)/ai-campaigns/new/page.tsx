"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Bot, Sparkles, AlertCircle, Copy, Check, Fingerprint, Eye } from "lucide-react";
import Link from "next/link";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { cn } from "@/lib/utils";

export default function NewAICampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        subject_template: "Question about {company_name}",
        body_template: "Hi {first_name}, ...",
        tracking_enabled: true,
        enrichment_enabled: true, // ALWAYS TRUE for AI Campaigns

        // New AI Modes
        ai_generation_mode: 'template' as 'template' | 'ai_generated', // Template vs Pure AI
        marketing_goal: "Voglio fissare una call per mostrare la nostra soluzione di Lead Generation...", // Used if ai_generated
        automation_mode: 'review' as 'review' | 'auto' // Review vs Auto-Send
    });

    const [editorInstance, setEditorInstance] = useState<any>(null);

    const insertVariable = (variable: string) => {
        if (editorInstance) {
            editorInstance.chain().focus().insertContent(` ${variable} `).run();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('campaigns')
                .insert({
                    name: formData.name,
                    description: formData.description,
                    email_template: {
                        subject_template: formData.subject_template,
                        // If AI generated, we save the goal as context
                        body_template: formData.ai_generation_mode === 'ai_generated' ? formData.marketing_goal : formData.body_template,
                        mode: formData.ai_generation_mode,
                        tone: "professional",
                        max_length: 100
                    },
                    status: 'draft',
                    stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
                    tracking_enabled: formData.tracking_enabled,
                    enrichment_enabled: true, // Enforce AI
                    automation_mode: formData.automation_mode
                })
                .select()
                .single();

            if (error) throw error;

            // Redirect to the new AI Campaign Detail page
            router.push(`/ai-campaigns/${data.id}`);

        } catch (err: any) {
            console.error("Error creating AI campaign:", err);
            alert("Errore creazione campagna AI: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const variables = ["{first_name}", "{last_name}", "{company_name}", "{job_title}", "{location}", "{recent_news}"];

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <Link href="/ai-campaigns" className="inline-flex items-center text-sm text-slate-500 hover:text-purple-500 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Torna a Campagne AI
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Sparkles className="w-6 h-6 text-purple-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Nuova Campagna AI</h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Crea una campagna intelligente potenziata dall'AI.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* 1. Dettagli Base */}
                <div className="glass dark:glass-dark p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-purple-900/5">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">1</span>
                        Dettagli Base
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Campagna (Es. Q1 SaaS Outreach AI)</label>
                            <Input
                                required
                                placeholder="Dai un nome riconoscibile..."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="text-lg py-6 border-purple-200 dark:border-purple-500/30 focus:border-purple-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descrizione (Opzionale)</label>
                            <Input
                                placeholder="Qual è l'obiettivo di questa campagna?"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Configurazione AI */}
                <div className="glass dark:glass-dark p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-purple-900/5 overflow-hidden relative">
                    {/* Background glow effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">2</span>
                            Configurazione AI
                        </h3>

                        <div className="space-y-6">

                            {/* A. Generation Mode */}
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-500/20 rounded-xl space-y-4">
                                <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                    <Bot className="w-4 h-4" /> Modalità Generazione
                                </h4>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, ai_generation_mode: 'template' })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            formData.ai_generation_mode === 'template'
                                                ? "bg-white dark:bg-purple-500/10 border-purple-500 ring-1 ring-purple-500 shadow-md"
                                                : "bg-white/50 dark:bg-white/5 border-transparent hover:border-purple-200"
                                        )}
                                    >
                                        <div className="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-200">Template + AI Variables</div>
                                        <p className="text-xs text-slate-500">Usa una struttura fissa ma arricchisci con variabili trovate dal web (news, job title, ecc).</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, ai_generation_mode: 'ai_generated' })}
                                        className={cn(
                                            "p-3 rounded-xl border text-left transition-all",
                                            formData.ai_generation_mode === 'ai_generated'
                                                ? "bg-white dark:bg-purple-500/10 border-purple-500 ring-1 ring-purple-500 shadow-md"
                                                : "bg-white/50 dark:bg-white/5 border-transparent hover:border-purple-200"
                                        )}
                                    >
                                        <div className="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-200">Full AI Generation</div>
                                        <p className="text-xs text-slate-500">L'AI scrive l'intera email da zero basandosi sul tuo obiettivo e sul profilo del lead.</p>
                                    </button>
                                </div>
                            </div>

                            {/* B. Automation Mode */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", formData.automation_mode === 'auto' ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600")}>
                                        {formData.automation_mode === 'auto' ? <Sparkles className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                                            {formData.automation_mode === 'auto' ? "Invio Automatico" : "Revisione Manuale"}
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                            {formData.automation_mode === 'auto'
                                                ? "Massima velocità: le email vengono inviate appena generate."
                                                : "Massimo controllo: richiedono tua approvazione."}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex bg-slate-200 dark:bg-black/20 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, automation_mode: 'review' })}
                                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", formData.automation_mode === 'review' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700")}
                                    >
                                        Revisione
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, automation_mode: 'auto' })}
                                        className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", formData.automation_mode === 'auto' ? "bg-white dark:bg-green-600 shadow-sm text-green-700 dark:text-white" : "text-slate-500 hover:text-slate-700")}
                                    >
                                        Auto-Send
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* 3. Content Logic */}
                <div className="glass dark:glass-dark p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-purple-900/5">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-bold">3</span>
                        {formData.ai_generation_mode === 'ai_generated' ? "Obiettivo Campagna" : "Template Email"}
                    </h3>

                    <div className="space-y-6">

                        {/* If Template Mode */}
                        {formData.ai_generation_mode === 'template' && (
                            <>
                                {/* Variables Helper */}
                                <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                    <span className="text-xs font-semibold uppercase text-slate-400 mr-2">Smart Variables:</span>
                                    {variables.map(v => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => insertVariable(v)}
                                            className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 hover:border-purple-300 hover:text-purple-500 transition-all active:scale-95 cursor-pointer"
                                            title="Inserisci nell'editor"
                                        >
                                            {v}
                                            <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-500" />
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Oggetto</label>
                                        <Input
                                            value={formData.subject_template}
                                            onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                                            className="font-medium"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Corpo Email Template</label>
                                        <div className="space-y-0">
                                            <RichTextEditor
                                                value={formData.body_template}
                                                onChange={(val) => setFormData({ ...formData, body_template: val })}
                                                className="min-h-[300px] rounded-b-none border-b-0"
                                                onEditorReady={setEditorInstance}
                                            />
                                            {/* Static Footer Preview */}
                                            <div className="p-4 bg-slate-50 dark:bg-black/20 border border-t-0 border-slate-200 dark:border-white/10 rounded-b-xl text-xs text-slate-500 flex flex-col gap-2 select-none">
                                                <div className="flex items-center gap-2 opacity-70">
                                                    <div className="h-px bg-slate-300 dark:bg-white/20 flex-1" />
                                                    <span>Footer Automatico</span>
                                                    <div className="h-px bg-slate-300 dark:bg-white/20 flex-1" />
                                                </div>
                                                <div className="text-center italic">
                                                    <br />
                                                    <small>Se non vuoi più ricevere queste email, <span className="text-blue-500 underline cursor-not-allowed">disiscriviti qui</span>.</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* If AI Generated Mode */}
                        {formData.ai_generation_mode === 'ai_generated' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl">
                                    <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">Obiettivo di Marketing</h4>
                                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                                        Descrivi cosa vuoi ottenere. L'AI analizzerà il sito web del lead e scriverà l'email perfetta per raggiungere questo obiettivo.
                                    </p>

                                    <textarea
                                        className="w-full min-h-[150px] p-4 rounded-xl border border-purple-200 dark:border-purple-700 bg-white dark:bg-black/20 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                                        placeholder="Es. Voglio fissare una call conoscitiva di 15 min. Parla di come possiamo aiutarli a scalare le vendite B2B automatizzando il cold outreach..."
                                        value={formData.marketing_goal}
                                        onChange={(e) => setFormData({ ...formData, marketing_goal: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Oggetto (Base)</label>
                                    <Input
                                        value={formData.subject_template}
                                        onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                                        placeholder="Es. Partnership Idea for {company_name}"
                                        className="border-purple-200 focus:border-purple-500"
                                    />
                                    <p className="text-xs text-slate-500">L'AI potrà ottimizzare l'oggetto per massimizzare l'Open Rate.</p>
                                </div>
                            </div>
                        )}

                        {/* Tracking Toggle (Mini) */}
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5 mt-6">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, tracking_enabled: !formData.tracking_enabled })}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                    formData.tracking_enabled
                                        ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                                )}
                            >
                                <div className={cn("w-2 h-2 rounded-full", formData.tracking_enabled ? "bg-purple-500" : "bg-slate-400")} />
                                {formData.tracking_enabled ? "Tracking Attivo" : "Tracking Disattivato"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={() => router.back()} className="hover:bg-slate-100 dark:hover:bg-white/5">
                        Annulla
                    </Button>
                    <Button type="submit" disabled={loading} className="px-8 py-6 text-lg bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-500/20">
                        {loading && <Loader2 className="w-5 h-5 mr-3 animate-spin" />}
                        <Sparkles className="w-5 h-5 mr-2" />
                        Lancia Campagna AI
                    </Button>
                </div>
            </form >
        </div >
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft, Megaphone, AlertCircle, Copy, Check, Eye } from "lucide-react";
import Link from "next/link";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { cn } from "@/lib/utils";

export default function NewCampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        subject_template: "",
        body_template: "",
        tracking_enabled: true,
        enrichment_enabled: false, // Force False for Standard
        automation_mode: 'review' // Standard is always review basically, or just standard sending
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
                        body_template: formData.body_template,
                        // Sync legacy fields for compatibility
                        subject: formData.subject_template,
                        body: formData.body_template,
                        mode: 'template',
                        tone: "professional",
                        max_length: 100
                    },
                    status: 'draft',
                    stats: { sent: 0, opened: 0, clicked: 0, replied: 0 },
                    tracking_enabled: formData.tracking_enabled,
                    enrichment_enabled: false, // Explicitly false
                    automation_mode: 'review'
                })
                .select()
                .single();

            if (error) throw error;

            router.push(`/campaigns/${data.id}`);

        } catch (err: any) {
            console.error("Error creating campaign:", err);
            toast.error("Errore creazione campagna: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const variables = ["{first_name}", "{last_name}", "{company_name}", "{job_title}", "{location}"];

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <Link href="/campaigns" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-500 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Torna alle campagne
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Megaphone className="w-6 h-6 text-blue-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Nuova Campagna Standard</h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Crea una campagna di cold outreach classica.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* 1. Dettagli Base */}
                <div className="glass dark:glass-dark p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-blue-900/5">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold">1</span>
                        Dettagli Base
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Campagna</label>
                            <Input
                                required
                                placeholder="Es. Q1 Outreach Sales"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="text-lg py-6"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descrizione (Opzionale)</label>
                            <Input
                                placeholder="Note interne..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Content */}
                <div className="glass dark:glass-dark p-8 rounded-3xl border border-white/20 dark:border-white/5 shadow-xl shadow-blue-900/5">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold">2</span>
                        Template Email
                    </h3>

                    <div className="space-y-6">
                        {/* Variables Helper */}
                        <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs font-semibold uppercase text-slate-400 mr-2">Variabili CSV:</span>
                            {variables.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => insertVariable(v)}
                                    className="group flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-all active:scale-95 cursor-pointer"
                                    title="Inserisci nell'editor"
                                >
                                    {v}
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
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Corpo Email</label>
                                <div className="space-y-0">
                                    <RichTextEditor
                                        value={formData.body_template}
                                        onChange={(val) => setFormData({ ...formData, body_template: val })}
                                        className="min-h-[300px] rounded-b-none border-b-0"
                                        onEditorReady={setEditorInstance}
                                    />
                                    {/* Static Footer Preview */}
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 border border-t-0 border-slate-200 dark:border-white/10 rounded-b-xl text-sm text-slate-500 flex flex-col gap-2 select-none">
                                        <div className="flex items-center gap-2 opacity-70">
                                            <div className="h-px bg-slate-300 dark:bg-white/20 flex-1" />
                                            <span>Footer Automatico</span>
                                            <div className="h-px bg-slate-300 dark:bg-white/20 flex-1" />
                                        </div>
                                        <div className="text-center italic">
                                            <br />
                                            <span className="text-sm">Se non vuoi più ricevere queste email, <span className="text-blue-500 underline cursor-not-allowed">disiscriviti qui</span>.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tracking Toggle (Mini) */}
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5 mt-6">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, tracking_enabled: !formData.tracking_enabled })}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                    formData.tracking_enabled
                                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                                )}
                            >
                                <div className={cn("w-2 h-2 rounded-full", formData.tracking_enabled ? "bg-blue-500" : "bg-slate-400")} />
                                {formData.tracking_enabled ? "Tracking Attivo" : "Tracking Disattivato"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 pt-4">
                    <Button type="button" variant="ghost" onClick={() => router.back()} className="hover:bg-slate-100 dark:hover:bg-white/5">
                        Annulla
                    </Button>
                    <Button type="submit" disabled={loading} className="px-8 py-6 text-lg shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all">
                        {loading && <Loader2 className="w-5 h-5 mr-3 animate-spin" />}
                        Crea Campagna
                    </Button>
                </div>
            </form >
        </div >
    );
}

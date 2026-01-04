"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewCampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        subject_template: "Question about {company_name}",
        body_template: "Hi {first_name}, ...",
    });

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
                        tone: "professional",
                        max_length: 100
                    },
                    status: 'draft',
                    stats: { sent: 0, opened: 0, clicked: 0, replied: 0 }
                })
                .select()
                .single();

            if (error) throw error;

            // Redirect to the campaign page overview/import
            router.push(`/campaigns/${data.id}`);

        } catch (err: any) {
            console.error("Error creating campaign:", err);
            alert("Errore creazione campagna: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <Link href="/campaigns" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-500 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Torna alle campagne
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nuova Campagna</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Configura i dettagli della tua campagna di outreach.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass dark:glass-dark p-8 rounded-2xl border border-white/20 dark:border-white/5 space-y-6">

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Campagna</label>
                        <Input
                            required
                            placeholder="es. Q1 Expansion Italy"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descrizione (Opzionale)</label>
                        <Input
                            placeholder="Obiettivo della campagna..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Template Email Base</h3>
                        <p className="text-sm text-slate-500 mb-4">Usa le variabili <code>{`{first_name}`}</code>, <code>{`{company_name}`}</code> etc.</p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Oggetto (Template)</label>
                                <Input
                                    value={formData.subject_template}
                                    onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Corpo (Template)</label>
                                <textarea
                                    className="flex w-full min-h-[150px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-50"
                                    value={formData.body_template}
                                    onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>Annulla</Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Crea Campagna
                    </Button>
                </div>
            </form>
        </div>
    );
}

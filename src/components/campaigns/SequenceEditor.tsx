"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input"; // Assuming you have this
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Loader2, Plus, Trash2, Clock, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface SequenceStep {
    delay_days: number;
    type: string;
    subject: string;
    body: string;
}

export function SequenceEditor({ campaign, onUpdate }: { campaign: any, onUpdate: (c: any) => void }) {
    // Initial Email (Step 0)
    const [initialSubject, setInitialSubject] = useState(campaign.email_template?.subject || "");
    const [initialBody, setInitialBody] = useState(campaign.email_template?.body || "");

    // Follow-ups (Steps 1+)
    const [sequence, setSequence] = useState<SequenceStep[]>(campaign.follow_up_sequence || []);

    const [saving, setSaving] = useState(false);

    const addStep = () => {
        setSequence([
            ...sequence,
            {
                delay_days: 3,
                type: `follow_up_${sequence.length + 1}`,
                subject: "Re: " + initialSubject,
                body: "Just bumping this up..."
            }
        ]);
    };

    const removeStep = (index: number) => {
        const newSeq = [...sequence];
        newSeq.splice(index, 1);
        setSequence(newSeq);
    };

    const updateStep = (index: number, field: keyof SequenceStep, value: any) => {
        const newSeq = [...sequence];
        // @ts-ignore
        newSeq[index][field] = value;
        setSequence(newSeq);
    };

    const handleSave = async () => {
        setSaving(true);

        const updatedCampaign = {
            email_template: { ...campaign.email_template, subject: initialSubject, body: initialBody },
            follow_up_sequence: sequence
        };

        const { error } = await supabase
            .from('campaigns')
            .update({
                email_template: updatedCampaign.email_template,
                follow_up_sequence: updatedCampaign.follow_up_sequence
            })
            .eq('id', campaign.id);

        if (error) {
            toast.error("Errore salvataggio: " + error.message);
        } else {
            onUpdate({ ...campaign, ...updatedCampaign });
            toast.success("Sequenza salvata con successo!");
        }
        setSaving(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold dark:text-white">Sequenza di Outreach</h2>
                    <p className="text-slate-500 text-sm">Definisci i passaggi automatici della tua campagna.</p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                    Salva Modifiche
                </Button>
            </div>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:ml-8 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent dark:before:from-slate-700 dark:before:via-slate-800">

                {/* STEP 0: INITIAL */}
                <div className="relative pl-16 md:pl-20">
                    <div className="absolute left-2 md:left-4 top-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 flex items-center justify-center z-10">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-300">0</span>
                    </div>

                    <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <h3 className="font-semibold text-lg">Email Iniziale</h3>
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Day 0</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Oggetto</label>
                                <Input
                                    value={initialSubject}
                                    onChange={(e) => setInitialSubject(e.target.value)}
                                    placeholder="Es. Partnership Opportunity..."
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Corpo del Messaggio</label>
                                <RichTextEditor
                                    value={initialBody}
                                    onChange={setInitialBody}
                                    className="min-h-[200px]"
                                />
                                <p className="text-xs text-slate-400 mt-2">Variabili supportate: {'{first_name}, {last_name}, {company_name}'}</p>
                            </div>

                            {/* Static Footer Preview */}
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                <p className="text-xs text-slate-400 text-center">
                                    Se non vuoi più ricevere queste email, <span className="text-blue-500 underline decoration-blue-500/30">disiscriviti qui</span>.
                                </p>
                                <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center mt-1">(Questo footer verrà aggiunto automaticamente)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOLLOW UPS */}
                {sequence.map((step, idx) => (
                    <div key={idx} className="relative pl-16 md:pl-20">
                        <div className="absolute left-2 md:left-4 top-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center z-10">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{idx + 1}</span>
                        </div>

                        {/* Connector line arrow */}
                        <div className="absolute left-6 md:left-8 -top-6 bottom-full w-px bg-slate-300 dark:bg-slate-700"></div>

                        <div className="glass dark:glass-dark p-6 rounded-2xl border border-white/20 shadow-sm group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-900/50">
                                        <Clock className="w-4 h-4 text-amber-500" />
                                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Attendi</span>
                                        <input
                                            type="number"
                                            value={step.delay_days}
                                            onChange={(e) => updateStep(idx, 'delay_days', parseInt(e.target.value))}
                                            className="w-12 text-center bg-transparent border-b border-amber-300 focus:outline-none text-amber-800 dark:text-amber-300 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">giorni</span>
                                    </div>
                                    <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">Follow-up {idx + 1}</h3>
                                </div>
                                <button onClick={() => removeStep(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Oggetto</label>
                                    <Input
                                        value={step.subject}
                                        onChange={(e) => updateStep(idx, 'subject', e.target.value)}
                                        placeholder="Re: ..."
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Corpo del Messaggio</label>
                                    <RichTextEditor
                                        value={step.body}
                                        onChange={(html) => updateStep(idx, 'body', html)}
                                        className="min-h-[200px]"
                                    />
                                </div>

                                {/* Static Footer Preview */}
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-400 text-center">
                                        Se non vuoi più ricevere queste email, <span className="text-blue-500 underline decoration-blue-500/30">disiscriviti qui</span>.
                                    </p>
                                    <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center mt-1">(Questo footer verrà aggiunto automaticamente)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* ADD FLUTTON */}
                <div className="relative pl-16 md:pl-20 pt-4">
                    <button
                        onClick={addStep}
                        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 font-medium transition-colors bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-900/50"
                    >
                        <Plus className="w-5 h-5" />
                        Aggiungi Step di Follow-up
                    </button>
                </div>

            </div>
        </div >
    );
}

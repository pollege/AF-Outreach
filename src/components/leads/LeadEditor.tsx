"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

interface LeadEditorProps {
    lead: any;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedLead: any) => void;
}

export function LeadEditor({ lead, isOpen, onClose, onSave }: LeadEditorProps) {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        job_title: '',
        linkedin_url: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (lead) {
            setFormData({
                first_name: lead.first_name || '',
                last_name: lead.last_name || '',
                company_name: lead.company_name || '',
                email: lead.email || '',
                job_title: lead.job_title || '',
                linkedin_url: lead.linkedin_url || ''
            });
        }
    }, [lead]);

    if (!isOpen || !lead) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('leads')
                .update(formData)
                .eq('id', lead.id);

            if (error) throw error;

            onSave({ ...lead, ...formData });
            onClose();
        } catch (error: any) {
            alert("Errore durante il salvataggio: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Modifica Lead</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Nome</label>
                        <Input name="first_name" value={formData.first_name} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Cognome</label>
                        <Input name="last_name" value={formData.last_name} onChange={handleChange} />
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Azienda</label>
                        <Input name="company_name" value={formData.company_name} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                        <Input name="email" value={formData.email} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Job Title</label>
                        <Input name="job_title" value={formData.job_title} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">LinkedIn URL</label>
                        <Input name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Annulla</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Salva
                    </Button>
                </div>
            </div>
        </div>
    );
}

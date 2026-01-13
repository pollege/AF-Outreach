"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

import { toast } from "sonner";

interface LeadEditorProps {
    lead: any;
    campaignId?: string; // Optional because only needed for creation
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedLead: any) => void;
}

export function LeadEditor({ lead, isOpen, onClose, onSave, campaignId }: LeadEditorProps) {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        job_title: '',
        linkedin_url: ''
    });
    const [customFields, setCustomFields] = useState<Record<string, any>>({});
    const [showCustomFields, setShowCustomFields] = useState(false);
    const [newFieldKey, setNewFieldKey] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (lead) {
            // Prefer contact info, fallback to lead (legacy)
            const c = lead.contacts || lead;
            setFormData({
                first_name: c.first_name || '',
                last_name: c.last_name || '',
                company_name: c.company_name || '',
                email: c.email || '',
                job_title: c.job_title || '',
                linkedin_url: c.linkedin_url || ''
            });
            setCustomFields(c.custom_fields || {});
        }
    }, [lead]);

    if (!isOpen || !lead) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let result;

            // 1. Prepare Contact Payload
            const contactPayload = {
                email: formData.email,
                first_name: formData.first_name,
                last_name: formData.last_name,
                company_name: formData.company_name,
                job_title: formData.job_title,
                linkedin_url: formData.linkedin_url,
                custom_fields: customFields,
                updated_at: new Date().toISOString()
            };

            // 2. Upsert Contact (Find or Create)
            const { data: contact, error: contactError } = await supabase
                .from('contacts')
                .upsert(contactPayload, { onConflict: 'email' })
                .select()
                .single();

            if (contactError) throw new Error("Errore salvataggio contatto: " + contactError.message);

            if (lead.id) {
                // UPDATE existing lead
                // We actually updated the CONTACT above. Now we just return the lead with the updated contact.
                // Optionally update lead-specific fields if we had them (e.g. status), but here we only edit contact info.

                // Fetch full lead to return
                const { data, error } = await supabase
                    .from('leads')
                    .select('*, contacts(*)')
                    .eq('id', lead.id)
                    .single();

                if (error) throw error;
                result = data;
                toast.success("Contatto aggiornato globalmente");
            } else {
                // CREATE new lead
                if (!campaignId) throw new Error("Campaign ID mancante per il nuovo lead");

                // Check if lead already exists in this campaign
                const { data: existingLead } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('campaign_id', campaignId)
                    .eq('contact_id', contact.id)
                    .single();

                if (existingLead) {
                    toast.warning("Questo contatto è già presente nella campagna.");
                    result = existingLead;
                } else {
                    const { data, error } = await supabase
                        .from('leads')
                        .insert({
                            campaign_id: campaignId,
                            contact_id: contact.id,
                            status: 'new',
                            // Legacy backup (optional, can be removed if strict)
                            email: contact.email,
                            first_name: contact.first_name,
                            last_name: contact.last_name,
                            company_name: contact.company_name
                        })
                        .select('*, contacts(*)')
                        .single();

                    if (error) throw error;
                    result = data;
                    toast.success("Nuovo lead aggiunto alla campagna");
                }
            }

            onSave(result);
            onClose();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error("Errore: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200 p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {lead.id ? "Modifica Lead" : "Nuovo Lead"}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Autocomplete Hack: Hidden inputs to trap browser autofill */}
                <input type="text" name="prevent_autofill" id="prevent_autofill" value="" style={{ display: 'none' }} tabIndex={-1} readOnly />
                <input type="password" name="password_fake" id="password_fake" value="" style={{ display: 'none' }} tabIndex={-1} readOnly />

                <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Nome</label>
                            <Input
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Cognome</label>
                            <Input
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Azienda</label>
                            <Input
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
                            <Input
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Job Title</label>
                            <Input
                                name="job_title"
                                value={formData.job_title}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">LinkedIn URL</label>
                            <Input
                                name="linkedin_url"
                                value={formData.linkedin_url}
                                onChange={handleChange}
                                autoComplete="off"
                                data-lpignore="true"
                                data-form-type="other"
                            />
                        </div>
                    </div>

                    {/* Collapsible Custom Fields Section */}
                    <div className="border rounded-xl mb-6">
                        <button
                            type="button"
                            onClick={() => setShowCustomFields(!showCustomFields)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors rounded-t-xl"
                        >
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-400" />
                                Campi Personalizzati ({Object.keys(customFields).length})
                            </span>
                            {showCustomFields ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        {showCustomFields && (
                            <div className="p-4 space-y-4">
                                {/* Add New Field */}
                                <div className="flex gap-2 mb-4">
                                    <Input
                                        placeholder="Nuovo campo (es. Città)"
                                        value={newFieldKey}
                                        onChange={(e) => setNewFieldKey(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            if (!newFieldKey.trim()) return;
                                            setCustomFields({ ...customFields, [newFieldKey.trim()]: '' });
                                            setNewFieldKey("");
                                        }}
                                        disabled={!newFieldKey.trim()}
                                    >
                                        <Plus className="w-4 h-4 mr-1" /> Aggiungi
                                    </Button>
                                </div>

                                {/* List Fields */}
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {Object.entries(customFields).map(([key, value]) => (
                                        <div key={key} className="flex items-center gap-2 group">
                                            <div className="w-1/3 text-xs font-semibold text-slate-500 truncate" title={key}>
                                                {key}
                                            </div>
                                            <Input
                                                value={value as string}
                                                onChange={(e) => setCustomFields({ ...customFields, [key]: e.target.value })}
                                                className="h-8 text-sm flex-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newFields = { ...customFields };
                                                    delete newFields[key];
                                                    setCustomFields(newFields);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-all"
                                                title="Elimina campo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(customFields).length === 0 && (
                                        <p className="text-center text-xs text-slate-400 py-4 italic">Nessun campo personalizzato</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Annulla</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salva
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

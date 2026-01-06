import { useState, useEffect } from "react";
import { X, Plus, ShieldAlert, Search, Zap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EnrichmentConfig {
    type: string;
    focus_keywords?: string[];
    excluded_domains?: string[];
    search_depth?: 'normal' | 'deep';
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: EnrichmentConfig;
    onSave: (newConfig: EnrichmentConfig) => void;
}

export function EnrichmentSettingsModal({ isOpen, onClose, config, onSave }: Props) {
    const [localConfig, setLocalConfig] = useState<EnrichmentConfig>(config);
    const [keywordInput, setKeywordInput] = useState("");
    const [domainInput, setDomainInput] = useState("");

    // Reset local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalConfig({
                ...config,
                focus_keywords: config.focus_keywords || [],
                excluded_domains: config.excluded_domains || [],
                search_depth: config.search_depth || 'normal'
            });
        }
    }, [isOpen, config]);

    if (!isOpen) return null;

    const addKeyword = () => {
        if (!keywordInput.trim()) return;
        const current = localConfig.focus_keywords || [];
        if (!current.includes(keywordInput.trim())) {
            setLocalConfig({ ...localConfig, focus_keywords: [...current, keywordInput.trim()] });
        }
        setKeywordInput("");
    };

    const removeKeyword = (idx: number) => {
        const current = localConfig.focus_keywords || [];
        setLocalConfig({ ...localConfig, focus_keywords: current.filter((_, i) => i !== idx) });
    };

    const addDomain = () => {
        if (!domainInput.trim()) return;
        const current = localConfig.excluded_domains || [];
        if (!current.includes(domainInput.trim())) {
            setLocalConfig({ ...localConfig, excluded_domains: [...current, domainInput.trim()] });
        }
        setDomainInput("");
    };

    const removeDomain = (idx: number) => {
        const current = localConfig.excluded_domains || [];
        setLocalConfig({ ...localConfig, excluded_domains: current.filter((_, i) => i !== idx) });
    };

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-500" />
                        Impostazioni Avanzate Ricerca
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">

                    {/* 1. Focus Keywords */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-purple-500" />
                            <label className="text-sm font-semibold text-slate-900 dark:text-white">Focus Keywords</label>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Aggiungi parole chiave specifiche per il tuo business (es. "SaaS", "Cybersecurity"). Verranno incluse nella ricerca per trovare lead più rilevanti.
                        </p>
                        <div className="flex gap-2">
                            <Input
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                placeholder="Es. Logistica, CRM..."
                                className="flex-1"
                            />
                            <Button variant="secondary" onClick={addKeyword} size="sm">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[2rem]">
                            {(localConfig.focus_keywords || []).map((kw, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                    {kw}
                                    <button onClick={() => removeKeyword(i)} className="hover:text-purple-900 dark:hover:text-white">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {(localConfig.focus_keywords?.length === 0) && (
                                <span className="text-xs text-slate-400 italic">Nessuna keyword impostata</span>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-white/5" />

                    {/* 2. Excluded Domains */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                            <label className="text-sm font-semibold text-slate-900 dark:text-white">Esclusione Domini (Blacklist)</label>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Domini da escludere dai risultati (es. paginegialle.it, indeed.com).
                        </p>
                        <div className="flex gap-2">
                            <Input
                                value={domainInput}
                                onChange={(e) => setDomainInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                                placeholder="Es. indeed.com"
                                className="flex-1"
                            />
                            <Button variant="secondary" onClick={addDomain} size="sm">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[2rem]">
                            {(localConfig.excluded_domains || []).map((dom, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                                    {dom}
                                    <button onClick={() => removeDomain(i)} className="hover:text-red-900 dark:hover:text-white">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {(localConfig.excluded_domains?.length === 0) && (
                                <span className="text-xs text-slate-400 italic">Nessun dominio escluso</span>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-white/5" />

                    {/* 3. Search Depth */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-500" />
                            <label className="text-sm font-semibold text-slate-900 dark:text-white">Profondità Ricerca</label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition-all ${localConfig.search_depth === 'normal' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-white/5 dark:border-white/10'}`}
                                onClick={() => setLocalConfig({ ...localConfig, search_depth: 'normal' })}
                            >
                                <span className="text-sm font-medium">Normale (Veloce)</span>
                                <span className="text-xs text-slate-500">Analizza i primi 3-5 risultati. Ottimo per panoramiche.</span>
                            </div>
                            <div
                                className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition-all ${localConfig.search_depth === 'deep' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white border-slate-200 hover:border-blue-300 dark:bg-white/5 dark:border-white/10'}`}
                                onClick={() => setLocalConfig({ ...localConfig, search_depth: 'deep' })}
                            >
                                <span className="text-sm font-medium">Profonda (Deep)</span>
                                <span className="text-xs text-slate-500">Analizza più risultati e fa query multiple. Più lento.</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Annulla</Button>
                    <Button onClick={handleSave}>Salva Impostazioni</Button>
                </div>
            </div>
        </div>
    );
}

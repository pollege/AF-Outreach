"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader2, Plus, Trash2, Edit2, CheckCircle, AlertTriangle, RefreshCw, Mail, ShieldCheck, Globe, Server, X, ExternalLink, Flame, Info, Lock, Settings, ChevronDown, ChevronUp, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface MailAccount {
    id: string;
    created_at: string;
    email: string;
    from_name: string;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass: string;
    imap_host: string;
    imap_port: number;
    imap_user: string;
    imap_pass: string;
    status: 'active' | 'disconnected' | 'error';
    daily_limit: number;
    daily_sent: number;
    error_message?: string;
    provider_type?: 'gmail' | 'outlook' | 'custom';
    last_reset_at?: string;
}

interface ProviderConfig {
    name: string;
    smtp_host: string;
    smtp_port: number;
    imap_host: string;
    imap_port: number;
    help_url: string | null;
    icon: (className: string) => React.ReactNode;
}

const PROVIDERS: Record<'gmail' | 'outlook' | 'custom', ProviderConfig> = {
    gmail: {
        name: "Google Workspace / Gmail",
        smtp_host: "smtp.gmail.com",
        smtp_port: 465, // SSL usually preferred
        imap_host: "imap.gmail.com",
        imap_port: 993,
        help_url: "https://support.google.com/accounts/answer/185833",
        icon: (className: string) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>
    },
    outlook: {
        name: "Outlook / Office 365",
        smtp_host: "smtp.office365.com",
        smtp_port: 587, // STARTTLS
        imap_host: "outlook.office365.com",
        imap_port: 993,
        help_url: "https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353",
        icon: (className: string) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M1 17L1 7L7 5L7 19L1 17ZM17 4L8.3 5L8.3 19L17 20L17 4ZM23 7.8L17.8 8.7L17.8 15.6L23 16.5L23 7.8Z" /></svg>
    },
    custom: {
        name: "Custom SMTP",
        smtp_host: "",
        smtp_port: 587,
        imap_host: "",
        imap_port: 993,
        help_url: null,
        icon: (className: string) => <Server className={className} />
    }
};

const getWarmupLimit = (daysActive: number) => {
    if (daysActive <= 3) return 10;
    if (daysActive <= 7) return 20;
    if (daysActive <= 14) return 35;
    if (daysActive <= 21) return 50;
    return 100; // Full throttle after 3 weeks
};

export function MailAccountsTab() {
    const [accounts, setAccounts] = useState<MailAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Testing State
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

    // Form State
    const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'custom'>('gmail');
    const [formData, setFormData] = useState<Partial<MailAccount>>({
        daily_limit: 10,
        smtp_port: 465,
        imap_port: 993,
        provider_type: 'gmail'
    });
    const [showCredentials, setShowCredentials] = useState(true);
    const [showAdvancedServers, setShowAdvancedServers] = useState(false);
    const [showWarmupGuide, setShowWarmupGuide] = useState(false);
    const [isPreWarmed, setIsPreWarmed] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    // Effect to auto-fill hosts when provider changes
    useEffect(() => {
        if (!isModalOpen) return;

        const defaults = PROVIDERS[selectedProvider];
        if (selectedProvider !== 'custom') {
            setFormData(prev => ({
                ...prev,
                smtp_host: defaults.smtp_host,
                smtp_port: defaults.smtp_port,
                imap_host: defaults.imap_host,
                imap_port: defaults.imap_port,
                provider_type: selectedProvider
            }));
        }
    }, [selectedProvider, isModalOpen]);

    const handleOpenModal = (account?: MailAccount) => {
        setIsPreWarmed(false); // Reset toggle
        if (account) {
            // Edit Mode
            setFormData(account);
            setSelectedProvider(account.provider_type || 'custom');
            setShowCredentials(false);

            // Heuristic: If limit is high on a young account, maybe it was pre-warmed? 
            // Doesn't matter much, user can re-toggle.
        } else {
            // Create Mode
            setFormData({ daily_limit: 10, provider_type: 'gmail' });
            setSelectedProvider('gmail');
            setShowCredentials(true);
        }
        setIsModalOpen(true);
    };

    const fetchAccounts = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('mail_accounts').select('*, last_reset_at').order('created_at', { ascending: false });
        if (data) setAccounts(data);
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (!formData.email || !formData.smtp_host) {
                toast.error("Email e Host sono obbligatori.");
                setSaving(false);
                return;
            }

            const { provider_type, ...dbPayloadRaw } = formData;

            const payload = {
                ...dbPayloadRaw,
                smtp_user: dbPayloadRaw.smtp_user || dbPayloadRaw.email,
                imap_user: dbPayloadRaw.imap_user || dbPayloadRaw.email,
                status: 'active',
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('mail_accounts').upsert([payload]);
            if (error) throw error;

            await fetchAccounts();
            setIsModalOpen(false);
            toast.success(formData.id ? "Modifiche salvate" : "Account collegato con successo!");

            setFormData({ daily_limit: 10 });
            setSelectedProvider('gmail');
        } catch (e: any) {
            console.error(e);
            toast.error("Errore salvataggio: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async (account: MailAccount) => {
        setTesting(true);
        setTestingId(account.id);
        setTestResult(null);
        try {
            // Run SMTP and IMAP tests in parallel
            const [smtpRes, imapRes] = await Promise.all([
                fetch('/api/mail/test-connection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(account)
                }),
                fetch('/api/mail/test-imap', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(account)
                })
            ]);

            const smtpData = await smtpRes.json();
            const imapData = await imapRes.json();

            if (smtpRes.ok) {
                // Merge reports
                const combinedReport = {
                    ...smtpData.report,
                    imap: imapRes.ok ? { status: 'ok', message: 'IMAP Connected' } : { status: 'error', message: imapData.error }
                };
                setTestResult(combinedReport);

                if (imapRes.ok) {
                    toast.success("Test completo superato (SMTP + IMAP)");
                } else {
                    toast.warning("SMTP OK, ma Errore IMAP: " + imapData.error);
                }
            } else {
                toast.error("Errore test SMTP: " + smtpData.error);
            }
        } catch (e: any) {
            toast.error("Errore di rete: " + e.message);
        } finally {
            setTesting(false);
            setTestingId(null);
        }
    };

    const handleDeleteClick = (id: string) => {
        setAccountToDelete(id);
    };

    const confirmDelete = async () => {
        if (!accountToDelete) return;
        await supabase.from('mail_accounts').delete().eq('id', accountToDelete);
        await fetchAccounts();
        toast.success("Account eliminato");
        setAccountToDelete(null); // Close the modal after deletion
    };

    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'active' || status === 'ok') return <CheckCircle className="w-full h-full text-emerald-500" />;
        if (status === 'warning') return <AlertTriangle className="w-full h-full text-amber-500" />;
        return <X className="w-full h-full text-red-500" />;
    };

    // Calculate warmup stats for form
    const daysActive = formData.created_at ? differenceInDays(new Date(), parseISO(formData.created_at)) : 0;
    const recommendedLimit = getWarmupLimit(daysActive);
    const isWarmingUp = daysActive < 22 && !isPreWarmed;

    return (
        <div className="space-y-8">
            <ConfirmModal
                isOpen={!!accountToDelete}
                onClose={() => setAccountToDelete(null)}
                onConfirm={confirmDelete}
                title="Elimina Account"
                description="Sei sicuro? Non potrai più usare questo indirizzo per inviare campagne."
                variant="destructive"
                confirmText="Elimina"
            />
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        Account Email Connessi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Gestisci i mittenti per le tue campagne di outreach.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuovo Account
                </Button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map(acc => {
                    const days = acc.created_at ? differenceInDays(new Date(), parseISO(acc.created_at)) : 0;
                    const warmupLimit = getWarmupLimit(days);
                    // Determine if we should show warmup badge: only if limit is somewhat low, implying it follows the curve
                    // Or simply if it's young. Let's stick to Age.
                    const isWarm = days < 22;
                    // If the user set a limit much higher than recommended, assume they skipped warmup
                    // Badge shows if strictly in warm-up period, regardless of limit setting
                    const effectiveIsWarm = isWarm;

                    // --- VISUAL SAFEGUARD ---
                    // Since we use a nightly cron to reset, if the user visits BEFORE the cron runs (or if cron fails),
                    // they might see old data (e.g. 10/10 sent yesterday).
                    // We check `last_reset_at`. If it's NOT today, we assume 0 sent for display purposes.
                    const lastReset = acc.last_reset_at ? parseISO(acc.last_reset_at) : null;
                    const isResetToday = lastReset ? differenceInDays(new Date(), lastReset) === 0 : false;

                    // If no last_reset_at, assume 0. If old date, assume 0.
                    const displaySent = isResetToday ? acc.daily_sent : 0;
                    // ------------------------

                    return (
                        <div key={acc.id} className="glass dark:glass-dark group relative p-6 rounded-2xl border border-white/20 dark:border-white/5 hover:border-blue-500/30 transition-all flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                                        {acc.smtp_host?.includes('google') || acc.provider_type === 'gmail' ? PROVIDERS.gmail.icon("w-6 h-6 text-slate-700 dark:text-white") :
                                            acc.smtp_host?.includes('office365') || acc.provider_type === 'outlook' ? PROVIDERS.outlook.icon("w-6 h-6 text-blue-600") :
                                                <Server className="w-6 h-6 text-slate-400" />}
                                    </div>
                                    <div className="flex gap-2">
                                        {effectiveIsWarm && (
                                            <div className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center gap-1">
                                                <Flame className="w-3 h-3" />
                                                <span>Giorno {days + 1}</span>
                                            </div>
                                        )}
                                        <div className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                            acc.status === 'active' ? "bg-emerald-100/50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-100 text-red-600"
                                        )}>
                                            {acc.status === 'active' ? 'ATTIVO' : 'ERRORE'}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg dark:text-white truncate" title={acc.email}>{acc.from_name || "Account"}</h3>
                                <p className="text-sm text-slate-500 truncate mb-4">{acc.email}</p>

                                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-black/20 p-3 rounded-lg">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Limite Giornaliero</span>
                                        <div className="flex items-center gap-2">
                                            {effectiveIsWarm && acc.daily_limit > warmupLimit && (
                                                <span className="text-[10px] text-orange-500 font-bold flex items-center" title={`Limite consigliato: ${warmupLimit}`}>
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    High
                                                </span>
                                            )}
                                            <span className="font-sans font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                                                {acc.daily_sent}<span className="text-slate-400 text-sm font-normal">/{acc.daily_limit}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div className={cn("h-full", effectiveIsWarm && acc.daily_limit > warmupLimit ? "bg-orange-500" : "bg-blue-500")} style={{ width: `${Math.min((acc.daily_sent / acc.daily_limit) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-white/5">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleTest(acc)} disabled={testing}>
                                    {testing && testingId === acc.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ShieldCheck className="w-3 h-3 mr-2" />}
                                    Check Salute
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleOpenModal(acc)}>
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(acc.id)} className="hover:text-red-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    );
                })}

                {accounts.length === 0 && !loading && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold dark:text-white">Nessun account collegato</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">Collega il tuo account email per iniziare a inviare campagne di cold outreach.</p>
                        <Button onClick={() => handleOpenModal()}>Connetti Primo Account</Button>
                    </div>
                )}
            </div>

            {/* Test Report Modal */}
            {testResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setTestResult(null)}>
                    <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-blue-500/20 p-6 rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
                        {/* (Same test report content) */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold dark:text-white">Diagnostica Dominio</h3>
                                <p className="text-xs text-slate-500">Analisi reputazione e configurazione tecnica.</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setTestResult(null)}><X className="w-4 h-4" /></Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Invio (SMTP)</div>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5"><StatusIcon status={testResult.smtp.status} /></div>
                                    <span className="font-bold dark:text-white">{testResult.smtp.status === 'ok' ? 'Stabilita' : 'Fallita'}</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Ricezione (IMAP)</div>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5"><StatusIcon status={testResult.imap?.status || 'error'} /></div>
                                    <span className="font-bold dark:text-white">{testResult.imap?.status === 'ok' ? 'Stabilita' : 'Fallita'}</span>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center col-span-2 md:col-span-1">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">MX Record</div>
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5"><StatusIcon status={testResult.mx.status} /></div>
                                    <span className="font-bold dark:text-white">{testResult.mx.status === 'ok' ? 'Valido' : 'Errore'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Sicurezza Anti-Spam</h4>

                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                                    <div className="text-sm font-medium dark:text-slate-200">SPF Record</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 max-w-[150px] truncate">{testResult.spf.message}</span>
                                    <div className="w-4 h-4"><StatusIcon status={testResult.spf.status} /></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-4 h-4 text-slate-400" />
                                    <div className="text-sm font-medium dark:text-slate-200">DMARC Policy</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 max-w-[150px] truncate">{testResult.dmarc.message}</span>
                                    <div className="w-4 h-4"><StatusIcon status={testResult.dmarc.status} /></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                            <Button onClick={() => setTestResult(null)}>Chiudi Report</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-blue-500/20 p-0 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                            <h3 className="text-lg font-bold dark:text-white">Configura Email</h3>
                            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}><X className="w-4 h-4" /></Button>
                        </div>

                        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-8">

                            {/* SECTION 1: LIMITI & WARMUP (Only visible in Edit Mode) */}
                            {formData.id && (
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400">
                                                <Settings className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Limiti di Invio</h4>
                                        </div>

                                        {/* Pre-warm Toggle */}
                                        <div
                                            onClick={() => setIsPreWarmed(!isPreWarmed)}
                                            className="flex items-center gap-2 cursor-pointer select-none"
                                        >
                                            <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", isPreWarmed ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600")}>
                                                {isPreWarmed && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Casella già rodata / Storica</span>
                                        </div>
                                    </div>

                                    {/* Warmup Status Bar Or Pre-Warmed Badge */}
                                    {isPreWarmed ? (
                                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            <div className="text-sm">
                                                <p className="font-bold text-emerald-800 dark:text-emerald-400">Modalità Esperto Attiva</p>
                                                <p className="text-emerald-600 dark:text-emerald-500/80 text-xs">I limiti di sicurezza warm-up sono disabilitati. Imposta il limite che preferisci.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {formData.created_at && isWarmingUp && (
                                                <div className="mb-6 p-1 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-100 dark:border-white/5">
                                                    <div className="p-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-white dark:bg-orange-500/20 rounded-full flex items-center justify-center shadow-sm">
                                                                <Flame className="w-5 h-5 text-orange-500" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-orange-900 dark:text-orange-100">Warm-up: Giorno {daysActive >= 0 ? daysActive + 1 : 1}</p>
                                                                <p className="text-xs text-orange-700 dark:text-orange-300">Consigliato: <span className="font-bold">{recommendedLimit} email/giorno</span></p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="bg-white dark:bg-transparent border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/20"
                                                            onClick={() => setFormData(prev => ({ ...prev, daily_limit: recommendedLimit }))}
                                                        >
                                                            Applica {recommendedLimit}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold uppercase text-slate-500">Limite Giornaliero (Max Email)</label>
                                        <Input
                                            type="number"
                                            className="h-12 text-lg font-bold font-sans"
                                            value={formData.daily_limit}
                                            onChange={e => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
                                        />
                                        {!isPreWarmed && isWarmingUp && formData.daily_limit! > recommendedLimit && (
                                            <p className="text-xs text-orange-500 font-bold flex items-center mt-2 animate-pulse">
                                                <AlertTriangle className="w-4 h-4 mr-1.5" />
                                                Attenzione: Stai superando il limite sicuro di {recommendedLimit}.
                                            </p>
                                        )}
                                    </div>

                                    {/* Professional Guide Accordion */}
                                    <div className="mt-6 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => setShowWarmupGuide(!showWarmupGuide)}
                                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                                <BookOpen className="w-4 h-4" />
                                                <span className="text-sm font-bold">Guida Professionale al Warm-up</span>
                                            </div>
                                            {showWarmupGuide ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                        </button>

                                        {showWarmupGuide && (
                                            <div className="p-4 bg-white dark:bg-[#0F172A]/50 text-sm space-y-4 animate-in slide-in-from-top-2">
                                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    Il warm-up è il processo di aumento graduale del volume di invio per costruire una reputazione positiva con gli ISP (Gmail, Outlook). Una casella nuova che invia troppo e troppo in fretta viene etichettata come spammer.
                                                </p>

                                                <div className="grid gap-3">
                                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
                                                        <h5 className="font-bold text-blue-700 dark:text-blue-300 text-xs uppercase mb-1">Settimana 1: Trust Building</h5>
                                                        <p className="text-slate-600 dark:text-slate-400 text-xs">
                                                            <span className="font-bold">Max 10-20 email/giorno.</span><br />
                                                            L'obiettivo è dimostrare che sei un umano. Ottieni risposte, rispondi alle email.
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20">
                                                        <h5 className="font-bold text-indigo-700 dark:text-indigo-300 text-xs uppercase mb-1">Settimana 2: Ramp Up</h5>
                                                        <p className="text-slate-600 dark:text-slate-400 text-xs">
                                                            <span className="font-bold">Max 20-40 email/giorno.</span><br />
                                                            Aumenta leggermente il volume. Usa personalizzazioni. Monitora il bounce rate (deve stare sotto il 2%).
                                                        </p>
                                                    </div>
                                                    <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-500/20">
                                                        <h5 className="font-bold text-purple-700 dark:text-purple-300 text-xs uppercase mb-1">Settimana 3: Normalizzazione</h5>
                                                        <p className="text-slate-600 dark:text-slate-400 text-xs">
                                                            <span className="font-bold">Max 50-80 email/giorno.</span><br />
                                                            Ora puoi iniziare a spingere. Dopo il giorno 21, puoi assestarti sul tuo volume target (es. 100-150).
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 text-xs text-slate-500 italic">
                                                    Consiglio Pro: La qualità batte la quantità. Una email che riceve risposta vale 100 email inviate a vuoto per la reputazione del dominio.
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <hr className="my-8 border-slate-100 dark:border-white/5" />
                                </section>
                            )}

                            {/* SECTION 2: CREDENZIALI (Always visible in Create Mode, Collapsible in Edit Mode) */}
                            <section>
                                {formData.id && (
                                    <button
                                        onClick={() => setShowCredentials(!showCredentials)}
                                        className="w-full flex items-center justify-between group mb-6"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">Credenziali di Connessione</h4>
                                                <p className="text-xs text-slate-400 font-normal">Provider, Email, Password, Porte</p>
                                            </div>
                                        </div>
                                        <div className="p-2 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors">
                                            {showCredentials ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </button>
                                )}

                                {(formData.id ? showCredentials : true) && (
                                    <div className={cn("animate-in fade-in slide-in-from-top-2 duration-200", !formData.id && "mt-2")}>
                                        {/* (Provider Select, Help Link, Inputs...) - Same as before */}
                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            {(['gmail', 'outlook', 'custom'] as const).map(p => (
                                                <div
                                                    key={p}
                                                    onClick={() => setSelectedProvider(p)}
                                                    className={cn(
                                                        "cursor-pointer rounded-xl border p-4 flex flex-col items-center gap-3 transition-all hover:bg-slate-50 dark:hover:bg-white/5",
                                                        selectedProvider === p
                                                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-600"
                                                            : "border-slate-200 dark:border-white/10"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-white">
                                                        {PROVIDERS[p].icon("w-6 h-6")}
                                                    </div>
                                                    <span className="text-sm font-semibold dark:text-slate-300">{PROVIDERS[p].name}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {PROVIDERS[selectedProvider].help_url && (
                                            <div className="mb-6 flex justify-center">
                                                <a
                                                    href={PROVIDERS[selectedProvider].help_url!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 hover:underline transition-colors"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    <span>Guida: Come configurare {PROVIDERS[selectedProvider].name}</span>
                                                </a>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold uppercase text-slate-500">Tuo Nome (Mittente)</label>
                                                <Input
                                                    placeholder="Es. Mario Rossi"
                                                    value={formData.from_name || ''}
                                                    onChange={e => setFormData({ ...formData, from_name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold uppercase text-slate-500">Email Address</label>
                                                <Input
                                                    placeholder="mario@azienda.com"
                                                    value={formData.email || ''}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                />
                                            </div>
                                            <div className="col-span-full space-y-1.5">
                                                <label className="text-xs font-semibold uppercase text-slate-500">Password / App Password</label>
                                                <Input
                                                    type="password"
                                                    placeholder={selectedProvider === 'gmail' ? "App Password (di 16 caratteri)" : "Password dell'email"}
                                                    value={formData.smtp_pass || ''}
                                                    onChange={e => setFormData({ ...formData, smtp_pass: e.target.value, imap_pass: e.target.value })}
                                                />
                                                {selectedProvider === 'gmail' && <p className="text-[10px] text-slate-400">⚠️ Per Gmail, devi generare una "App Password" dal tuo account Google. Non usare la tua password normale.</p>}
                                            </div>
                                        </div>

                                        <div className="col-span-full">
                                            <button
                                                className="text-xs text-slate-500 hover:text-blue-600 underline flex items-center gap-1 mt-2"
                                                onClick={() => setShowAdvancedServers(!showAdvancedServers)}
                                            >
                                                <Settings className="w-3 h-3" />
                                                {showAdvancedServers ? "Nascondi Parametri Server" : "Mostra Parametri Server (Avanzato)"}
                                            </button>
                                        </div>

                                        {(selectedProvider === 'custom' || showAdvancedServers) && (
                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 animate-in fade-in bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-xl col-span-full">
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-4 uppercase">Configurazione Server</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-mono text-slate-400">SMTP HOST</label>
                                                        <Input className="h-8 text-xs" value={formData.smtp_host || ''} onChange={e => setFormData({ ...formData, smtp_host: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-mono text-slate-400">SMTP PORT</label>
                                                        <Input className="h-8 text-xs" value={formData.smtp_port || ''} onChange={e => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-mono text-slate-400">IMAP HOST</label>
                                                        <Input className="h-8 text-xs" value={formData.imap_host || ''} onChange={e => setFormData({ ...formData, imap_host: e.target.value })} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-mono text-slate-400">IMAP PORT</label>
                                                        <Input className="h-8 text-xs" value={formData.imap_port || ''} onChange={e => setFormData({ ...formData, imap_port: parseInt(e.target.value) })} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Annulla</Button>
                            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {formData.id ? "Salva Modifiche" : "Connetti Account"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

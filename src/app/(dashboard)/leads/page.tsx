"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, Eye, Edit2, Users, Sparkles, Mail, Check, Trash2, Megaphone, Settings, CheckCircle2, ChevronRight, Linkedin, ArrowUp, ArrowDown, Globe, Copy, ExternalLink, X, Building2, Percent, Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

import { LeadEditor } from "@/components/leads/LeadEditor";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function LeadsPage() {
    const router = useRouter();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lead: any } | null>(null);

    // Stats State
    const [stats, setStats] = useState({
        total: 0,
        withEmail: 0,
        withLinkedin: 0,
        companies: 0
    });



    // Dynamic Columns State



    // Dynamic Columns State
    const STANDARD_COLUMNS = ['first_name', 'last_name', 'company_name', 'email'];
    const LEADS_TABLE_SETTINGS_KEY = 'leads_table_settings_v1';

    const [allColumns, setAllColumns] = useState<string[]>(STANDARD_COLUMNS);
    const [columnOrder, setColumnOrder] = useState<string[]>(STANDARD_COLUMNS);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(STANDARD_COLUMNS));
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Resizing Refs
    const resizingCol = useRef<string | null>(null);
    const startX = useRef<number>(0);
    const startWidth = useRef<number>(0);

    // Selection now tracks contact_ids for UI, but actions need lead_ids
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

    const [isSelectingCampaign, setIsSelectingCampaign] = useState(false);
    const [campaignSelectorTarget, setCampaignSelectorTarget] = useState<any>(null);
    const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
    const [viewingLeadTab, setViewingLeadTab] = useState<'email' | 'enrichment' | 'details'>('email');
    const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
    const [viewingLeadTab, setViewingLeadTab] = useState<'email' | 'enrichment' | 'details'>('email');
    const [viewingFocusField, setViewingFocusField] = useState<string | null>(null);

    // Confirm Modal State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => Promise<void> | void;
        variant?: "default" | "destructive";
        confirmText?: string;
    }>({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: () => { },
    });

    useEffect(() => {
        fetchLeads();
        fetchStats();

        // Load settings
        const saved = localStorage.getItem(LEADS_TABLE_SETTINGS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.columnOrder && Array.isArray(parsed.columnOrder)) setColumnOrder(parsed.columnOrder);
                if (parsed.visibleColumns && Array.isArray(parsed.visibleColumns)) setVisibleColumns(new Set(parsed.visibleColumns));
                if (parsed.columnWidths) setColumnWidths(parsed.columnWidths);
            } catch (e) {
                console.error("Failed to load table settings", e);
            }
        }
        setIsSettingsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isSettingsLoaded) return;

        const settings = {
            columnOrder,
            visibleColumns: Array.from(visibleColumns),
            columnWidths
        };
        localStorage.setItem(LEADS_TABLE_SETTINGS_KEY, JSON.stringify(settings));
    }, [columnOrder, visibleColumns, columnWidths, isSettingsLoaded]);

    useEffect(() => {
        supabase.from('campaigns').select('id, name, enrichment_enabled, automation_mode').then(({ data }) => setAllCampaigns(data || []));

        // Global Mouse Events for Resizing
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingCol.current) return;
            const diff = e.clientX - startX.current;
            const newWidth = Math.max(50, startWidth.current + diff); // Min width 50px
            setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
        };

        const handleMouseUp = () => {
            if (resizingCol.current) {
                resizingCol.current = null;
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    async function fetchLeads() {
        setLoading(true);
        const { data } = await supabase
            .from('leads')
            .select('*, contacts(*), campaigns(name), messages(*)')
            .order('created_at', { ascending: false })
            .limit(200); // Increased limit to ensure we see duplicates

        setLeads(data || []);
        setLoading(false);
        setLeads(data || []);
        setLoading(false);
    }

    async function fetchStats() {
        try {
            const [
                { count: total },
                { count: email },
                { count: linkedin },
                { data: companies }
            ] = await Promise.all([
                supabase.from('contacts').select('*', { count: 'exact', head: true }),
                supabase.from('contacts').select('*', { count: 'exact', head: true }).neq('email', null).neq('email', ''),
                supabase.from('contacts').select('*', { count: 'exact', head: true }).neq('linkedin_url', null).neq('linkedin_url', ''),
                supabase.from('contacts').select('company_name')
            ]);

            const uniqueCompanies = new Set((companies || []).map((c: any) => c.company_name).filter(Boolean)).size;

            setStats({
                total: total || 0,
                withEmail: email || 0,
                withLinkedin: linkedin || 0,
                companies: uniqueCompanies
            });
        } catch (e) {
            console.error("Error fetching stats:", e);
        }
    }

    // Initialize Columns from Data
    // Initialize Columns from Data
    // Initialize Columns from Data
    useEffect(() => {
        if (leads.length > 0) {
            const keys = new Set<string>();
            leads.forEach(lead => {
                const fields = lead.contacts?.custom_fields || lead.custom_fields;
                if (fields) {
                    Object.keys(fields).forEach(key => keys.add(key));
                }
            });

            const customKeys = Array.from(keys);
            const mergedColumns = [...STANDARD_COLUMNS, ...customKeys];
            setAllColumns(mergedColumns);

            setColumnOrder(prev => {
                // If keys are new, append them to the end of the existing order
                const newKeys = mergedColumns.filter(k => !prev.includes(k));
                if (newKeys.length > 0) {
                    // Optionally add new keys to visibleColumns only if we are initialized
                    // But if user has saved preferences, maybe they prefer manual addition?
                    // Let's make them visible by default so they don't miss new data
                    setVisibleColumns(prevVis => {
                        const newVis = new Set(prevVis);
                        newKeys.forEach(k => newVis.add(k));
                        return newVis;
                    });
                    return [...prev, ...newKeys];
                }
                return prev;
            });

            // If we have new columns and visibility is empty (rare case if standard init worked, or fresh start), set default
            // But if settings are loaded, size might be > 0. The above block handles appending new keys.
            // This fallback is mostly for the very first load if something is weird.
            if (!isSettingsLoaded && visibleColumns.size === 0) {
                setVisibleColumns(new Set(mergedColumns));
            }
        }
    }, [leads]);

    const toggleColumn = (col: string) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(col)) newSet.delete(col);
        else newSet.add(col);
        setVisibleColumns(newSet);
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...columnOrder];
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setColumnOrder(newOrder);
    };

    const startResizing = (e: React.MouseEvent, col: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingCol.current = col;
        startX.current = e.clientX;
        startWidth.current = getColWidth(col);
        document.body.style.cursor = 'col-resize';
    };

    const autoFitColumn = (col: string) => {
        // Calculate max width based on content of visible leads
        const leadsToScan = leads; // Use all loaded leads for better accuracy
        let maxWidth = 0;

        // 1. Measure header (Header is bold, so ~8.5px/char)
        const headerText = formatHeader(col);
        maxWidth = Math.max(maxWidth, headerText.length * 8.5 + 32);

        // 2. Measure content
        leadsToScan.slice(0, 100).forEach(lead => {
            let value = '';

            if (col === 'first_name') value = lead.first_name || '';
            else if (col === 'last_name') value = lead.last_name || '';
            else if (col === 'email') value = lead.email || '';
            else if (col === 'company_name') value = lead.company_name || '';
            else {
                value = lead.custom_fields?.[col] || '';
            }

            if (value) {
                // Tighter estimate: ~7.5px/char + 32px padding (reduced from 48)
                const width = String(value).length * 7.5 + 32;
                maxWidth = Math.max(maxWidth, width);
            }
        });

        // Clamp values
        maxWidth = Math.max(80, Math.min(maxWidth, 500)); // Min 80px (was 100), Max 500px (was 600)

        setColumnWidths(prev => ({
            ...prev,
            [col]: maxWidth
        }));
    };

    const getColWidth = (col: string) => {
        if (columnWidths[col]) return columnWidths[col];
        if (col === 'email') return 250;
        if (col === 'company_name') return 200;
        return 150;
    };

    // Helper to format custom field keys
    // Helper to format custom field keys
    const formatHeader = (key: string) => {
        if (key === 'first_name') return 'Nome';
        if (key === 'last_name') return 'Cognome';
        if (key === 'company_name') return 'Azienda';
        if (key === 'email') return 'Email';
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const handleSaveLead = (updatedLead: any) => {
        // Refresh full list to handle complex updates
        fetchLeads();
        setEditingLead(null);
    };

    // Grouping Logic
    const groupedLeads = leads.reduce((acc: any[], lead) => {
        const contactId = lead.contact_id;
        if (!contactId) return acc;

        const existingGroup = acc.find(g => g.contactId === contactId);
        if (existingGroup) {
            existingGroup.allocations.push({
                leadId: lead.id,
                campaignName: lead.campaigns?.name,
                status: lead.status,
                lead: lead // Keep reference to full lead object
            });
        } else {
            acc.push({
                contactId: contactId,
                contact: lead.contacts || lead, // Fallback to flat fields if legacy
                allocations: [{
                    leadId: lead.id,
                    campaignName: lead.campaigns?.name,
                    status: lead.status,
                    lead: lead
                }]
            });
        }
        return acc;
    }, []);

    const filteredGroups = groupedLeads.filter(group => {
        const c = group.contact;
        return (
            (c.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (c.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
    });

    const translateStatus = (status: string) => {
        if (status === 'draft') return 'Bozza';
        if (status === 'queued') return 'In Coda';
        if (status === 'sent') return 'Inviato';
        if (status === 'new') return 'Nuovo';
        if (status === 'researched') return 'Arricchito';
        if (status === 'message_generated') return 'Msg Generato';
        return status;
    };

    const isDrag = (e: React.MouseEvent) => {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        return dx > 5 || dy > 5;
    };

    // --- Double Scrollbar Logic ---
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    // Update width on mount/resize/columnChange so top scroll matches table
    useEffect(() => {
        if (tableScrollRef.current) {
            setTableWidth(tableScrollRef.current.scrollWidth);
        }
    }, [leads, visibleColumns, loading]);

    const handleScroll = (source: 'top' | 'table') => {
        if (!topScrollRef.current || !tableScrollRef.current) return;

        if (source === 'top') {
            if (tableScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
                tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
            }
        } else {
            if (topScrollRef.current.scrollLeft !== tableScrollRef.current.scrollLeft) {
                topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
            }
        }
    }

    const handleRowClick = (group: any, e: React.MouseEvent) => {
        if (isDrag(e)) return;
        if (selectedContactIds.includes(group.contactId)) {
            setSelectedContactIds(selectedContactIds.filter(id => id !== group.contactId));
        } else {
            setSelectedContactIds([...selectedContactIds, group.contactId]);
        }
    };

    const handleRowDoubleClick = (group: any, e: React.MouseEvent, initialTab: 'email' | 'enrichment' | 'details' = 'email', focusField: string | null = null) => {
        if (isDrag(e)) return;
        // View details of the FIRST allocation/lead as entry point
        setViewingLead(group.allocations[0].lead);
        setViewingLeadTab(initialTab);
        setViewingFocusField(focusField);
    };

    const handleContextMenu = (e: React.MouseEvent, group: any) => {
        e.preventDefault();
        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            lead: { ...group.allocations[0].lead, contact: group.contact }
        });
    };

    const handleCellClick = (e: React.MouseEvent) => {
        // e.stopPropagation(); // Allow row selection on cell click (User preference usually)
    };

    // Bulk Actions Helpers
    const getSelectedLeadIds = () => {
        return groupedLeads
            .filter(g => selectedContactIds.includes(g.contactId))
            .flatMap(g => g.allocations.map((a: any) => a.leadId));
    };

    const getSelectedObjects = () => {
        return groupedLeads.filter(g => selectedContactIds.includes(g.contactId));
    };


    const handleBulkAddToCampaign = async (targetCampaignId: string) => {
        try {
            const groupsToProcess = getSelectedObjects();
            if (groupsToProcess.length === 0) return;

            let addedCount = 0;
            let skippedCount = 0;

            for (const group of groupsToProcess) {
                const contactId = group.contactId;

                // Check if ANY of the contact's leads are already in this campaign
                // (Actually we just duplicate check against the DB table unique constraint logic)

                const { data: existing } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('campaign_id', targetCampaignId)
                    .eq('contact_id', contactId)
                    .single();

                if (!existing) {
                    const contact = group.contact;
                    const { error } = await supabase.from('leads').insert({
                        campaign_id: targetCampaignId,
                        contact_id: contactId,
                        status: 'new',
                        email: contact.email,
                        first_name: contact.first_name,
                        last_name: contact.last_name,
                        company_name: contact.company_name
                    });

                    if (!error) addedCount++;
                    else console.error("Error inserting:", error);
                } else {
                    skippedCount++;
                }
            }

            if (addedCount > 0) {
                toast.success(`${addedCount} contatti aggiunti alla nuova campagna!`);
                fetchLeads();
            }
            if (skippedCount > 0) {
                // Less intrusive info toast instead of warning
                if (addedCount === 0) toast.info("Tutti i contatti selezionati sono già in questa campagna.");
                else toast.info(`${skippedCount} contatti erano già presenti e sono stati saltati.`);
            }

            setSelectedContactIds([]);
            setIsSelectingCampaign(false);

        } catch (e: any) {
            console.error("Bulk add error:", e);
            toast.error("Errore: " + e.message);
        }
    };

    const handleBulkDelete = async () => {
        const leadIdsToDelete = getSelectedLeadIds();
        if (leadIdsToDelete.length === 0) return;

        setConfirmConfig({
            isOpen: true,
            title: "Elimina Contatti",
            description: `Sei sicuro di voler eliminare ${selectedContactIds.length} contatti (totale ${leadIdsToDelete.length} campagne) selezionati? Questa azione non può essere annullata.`,
            confirmText: "Elimina",
            variant: "destructive",
            onConfirm: async () => {
                const { error } = await supabase.from('leads').delete().in('id', leadIdsToDelete);
                if (error) {
                    toast.error("Errore eliminazione: " + error.message);
                } else {
                    toast.success(`${leadIdsToDelete.length} elementi eliminati`);
                    fetchLeads();
                    setSelectedContactIds([]);
                }
            }
        });
    };

    const handleSingleAddToCampaign = async (campaignId: string) => {
        if (!campaignSelectorTarget) return;

        try {
            // Check if already in campaign
            const { data: existing } = await supabase
                .from('leads')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('contact_id', campaignSelectorTarget.contact_id)
                .single();

            if (existing) {
                toast.warning("Contatto già presente in questa campagna");
                return;
            }

            const { error } = await supabase.from('leads').insert({
                campaign_id: campaignId,
                contact_id: campaignSelectorTarget.contact_id,
                status: 'new',
                company_name: campaignSelectorTarget.company_name // Legacy
            });

            if (error) throw error;

            toast.success("Aggiunto alla campagna!");
            setCampaignSelectorTarget(null);
            fetchLeads(); // Refresh to show new assignment
        } catch (e: any) {
            toast.error("Errore aggiunta: " + e.message);
        }
    };

    return (
        <div onClick={() => setShowColumnPicker(false)}>
            <Header title="Tutti i Leads" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-visible group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-16 h-16 text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Totale Contatti</p>
                            <div className="relative group/info cursor-help">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 text-center pointer-events-none">
                                    Numero totale di persone salvate nel database globale.
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</h3>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 opacity-50"></div>
                </div>

                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-visible group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Mail className="w-16 h-16 text-green-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Con Email</p>
                            <div className="relative group/info cursor-help">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 text-center pointer-events-none">
                                    Contatti che possiedono un indirizzo email valido.
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.withEmail}</h3>
                            <span className="text-xs font-medium text-green-500 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">
                                {stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-600 opacity-50"></div>
                </div>

                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-visible group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Linkedin className="w-16 h-16 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Con LinkedIn</p>
                            <div className="relative group/info cursor-help">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 text-center pointer-events-none">
                                    Contatti con un URL del profilo LinkedIn collegato.
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.withLinkedin}</h3>
                            <span className="text-xs font-medium text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">
                                {stats.total > 0 ? Math.round((stats.withLinkedin / stats.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-blue-700 opacity-50"></div>
                </div>

                <div className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-visible group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Building2 className="w-16 h-16 text-purple-500" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aziende Uniche</p>
                            <div className="relative group/info cursor-help">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                <div className="absolute right-0 bottom-full mb-2 w-56 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 text-center pointer-events-none">
                                    Numero di aziende distinte associate ai contatti. I campi vuoti non vengono conteggiati.
                                    <div className="absolute -bottom-1 right-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.companies}</h3>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-600 opacity-50"></div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center bg-white dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Cerca contatto o azienda..."
                        className="pl-9 bg-transparent border-0 focus-visible:ring-0 placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Toolbar Actions */}
                <div className="flex gap-2 items-center">
                    {/* Column Picker */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => setShowColumnPicker(!showColumnPicker)}>
                            <Settings className="w-4 h-4 mr-2" />
                            Colonne
                        </Button>
                        {showColumnPicker && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                                <div className="flex items-center justify-between mb-2 px-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gestione Colonne</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setVisibleColumns(new Set(allColumns)); }}
                                            className="text-xs text-blue-500 hover:text-blue-600 font-bold hover:underline"
                                        >
                                            TUTTI
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setVisibleColumns(new Set()); }}
                                            className="text-xs text-slate-400 hover:text-slate-500 font-bold hover:underline"
                                        >
                                            NESSUNO
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto space-y-1 custom-scrollbar">
                                    {columnOrder.map((col, index) => (
                                        <div key={col} className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg group/item">
                                            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleColumn(col)}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${visibleColumns.has(col) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                    {visibleColumns.has(col) && <CheckCircle2 className="w-3 h-3" />}
                                                </div>
                                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{formatHeader(col)}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                <button
                                                    disabled={index === 0}
                                                    onClick={(e) => { e.stopPropagation(); moveColumn(index, 'up'); }}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30"
                                                >
                                                    <ArrowUp className="w-3 h-3 text-slate-500" />
                                                </button>
                                                <button
                                                    disabled={index === columnOrder.length - 1}
                                                    onClick={(e) => { e.stopPropagation(); moveColumn(index, 'down'); }}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded disabled:opacity-30"
                                                >
                                                    <ArrowDown className="w-3 h-3 text-slate-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {selectedContactIds.length > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 w-full md:w-auto border-l border-slate-200 dark:border-white/10 pl-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-2">
                            {selectedContactIds.length} Contatti Selezionati
                        </span>

                        <div className="flex gap-1">
                            <div className="relative">
                                {isSelectingCampaign && (
                                    <div className="absolute top-10 right-0 z-50 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-white/10 rounded-xl p-2 w-64">
                                        <h4 className="text-xs font-bold text-slate-500 px-2 py-1 mb-1">AGGIUNGI A CAMPAGNA:</h4>
                                        <div className="max-h-60 overflow-y-auto space-y-1">
                                            {allCampaigns.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => handleBulkAddToCampaign(c.id)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg truncate flex items-center gap-2 group"
                                                >
                                                    {c.enrichment_enabled ? <Sparkles className="w-3 h-3 text-purple-500" /> : <Mail className="w-3 h-3 text-slate-400" />}
                                                    <span className={c.enrichment_enabled ? "text-purple-700 dark:text-purple-300 font-medium" : "text-slate-700 dark:text-slate-300"}>
                                                        {c.name}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsSelectingCampaign(!isSelectingCampaign)}
                                    className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-2 text-sm font-medium"
                                    title="Aggiungi a Campagna"
                                >
                                    <Users className="w-4 h-4" />
                                    <span className="hidden sm:inline">Aggiungi</span>
                                </button>
                            </div>

                            <button
                                onClick={handleBulkDelete}
                                className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                                title="Elimina da TUTTE le campagne"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Scrollbar (Synchronized) */}
            <div
                ref={topScrollRef}
                onScroll={() => handleScroll('top')}
                className="overflow-x-auto w-full mb-1"
                style={{ height: '12px' }} // Small height for just the scrollbar
            >
                <div style={{ width: tableWidth, height: '1px' }}></div>
            </div>

            <div
                ref={tableScrollRef}
                onScroll={() => handleScroll('table')}
                className="glass dark:glass-dark rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden overflow-x-auto"
            >
                <table className="w-full text-sm text-left min-w-max">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4 w-4">
                                <div
                                    className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedContactIds.length > 0 && selectedContactIds.length === filteredGroups.length ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 hover:border-purple-400'}`}
                                    onClick={() => setSelectedContactIds(selectedContactIds.length === filteredGroups.length ? [] : filteredGroups.map(g => g.contactId))}
                                >
                                    {selectedContactIds.length > 0 && selectedContactIds.length === filteredGroups.length && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </th>
                            {/* Unified Dynamic Headers */}
                            {columnOrder.filter(c => visibleColumns.has(c)).map(col => (
                                <th
                                    key={col}
                                    className={`relative px-6 py-4 font-medium whitespace-nowrap group/header overflow-hidden text-ellipsis ${STANDARD_COLUMNS.includes(col) ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}
                                    style={{ width: getColWidth(col), minWidth: getColWidth(col), maxWidth: getColWidth(col) }}
                                    title={formatHeader(col)}
                                >
                                    <span className="block truncate">{formatHeader(col)}</span>
                                    {/* Resizer Handle */}
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-200 dark:bg-white/10 hover:bg-blue-500 active:bg-blue-500 transition-colors z-20"
                                        onMouseDown={(e) => startResizing(e, col)}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            autoFitColumn(col);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Double-click to auto-fit"
                                    />
                                </th>
                            ))}

                            <th className="px-6 py-4 font-medium">Campagne Attive</th>
                            <th className="px-6 py-4 font-medium">Status Recente</th>
                            <th className="px-6 py-4 font-medium text-right sticky right-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-sm z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
                        ) : filteredGroups.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nessun contatto trovato.</td></tr>
                        ) : (
                            filteredGroups.map((group) => (
                                <tr
                                    key={group.contactId}
                                    className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer ${selectedContactIds.includes(group.contactId) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                                    onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                    onClick={(e) => handleRowClick(group, e)}
                                    onDoubleClick={(e) => handleRowDoubleClick(group, e)}
                                    onContextMenu={(e) => handleContextMenu(e, group)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div
                                            className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedContactIds.includes(group.contactId) ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 group-hover:border-purple-400'}`}
                                            onClick={() => {
                                                if (selectedContactIds.includes(group.contactId)) setSelectedContactIds(selectedContactIds.filter(id => id !== group.contactId));
                                                else setSelectedContactIds([...selectedContactIds, group.contactId]);
                                            }}
                                        >
                                            {selectedContactIds.includes(group.contactId) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </td>
                                    {/* Unified Dynamic Fields */}
                                    {columnOrder.filter(c => visibleColumns.has(c)).map(col => {
                                        const width = getColWidth(col);
                                        const widthStyle = { width, minWidth: width, maxWidth: width };

                                        if (col === 'first_name') {
                                            return (
                                                <td key={col}
                                                    className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 cursor-default whitespace-nowrap overflow-hidden text-ellipsis"
                                                    style={widthStyle}
                                                    onClick={handleCellClick}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRowDoubleClick(group, e, 'details');
                                                    }}
                                                    title={group.contact.first_name || ''}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs text-slate-500 font-bold shrink-0">
                                                            {group.contact.first_name?.[0]}
                                                        </div>
                                                        <span className="truncate">{group.contact.first_name}</span>
                                                    </div>
                                                </td>
                                            );
                                        }
                                        if (col === 'last_name') return (
                                            <td key={col}
                                                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 cursor-default whitespace-nowrap overflow-hidden text-ellipsis"
                                                style={widthStyle}
                                                onClick={handleCellClick}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowDoubleClick(group, e, 'details');
                                                }}
                                                title={group.contact.last_name || ''}
                                            >
                                                {group.contact.last_name}
                                            </td>
                                        );
                                        if (col === 'company_name') return (
                                            <td key={col}
                                                className="px-6 py-4 text-slate-500 cursor-default overflow-hidden text-ellipsis"
                                                style={widthStyle}
                                                onClick={handleCellClick}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowDoubleClick(group, e, 'details');
                                                }}
                                                title={group.contact.company_name || ''}
                                            >
                                                {group.contact.company_name}
                                            </td>
                                        );
                                        if (col === 'email') return (
                                            <td key={col}
                                                className="px-6 py-4 text-slate-500 cursor-default overflow-hidden text-ellipsis"
                                                style={widthStyle}
                                                onClick={handleCellClick}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowDoubleClick(group, e, 'details');
                                                }}
                                                title={group.contact.email || ''}
                                            >
                                                {group.contact.email}
                                            </td>
                                        );

                                        return (
                                            <td key={col}
                                                className="px-6 py-4 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis"
                                                style={widthStyle}
                                                title={String(group.contact.custom_fields?.[col] || '-')}
                                                onClick={handleCellClick}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowDoubleClick(group, e, 'details', col);
                                                }}
                                            >
                                                {String(group.contact.custom_fields?.[col] || '-')}
                                            </td>
                                        );
                                    })}

                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {group.allocations.map((a: any, i: number) => (
                                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                                                    <Megaphone className="w-3 h-3 text-slate-400" />
                                                    {a.campaignName}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {/* Show badges for unique statuses present */}
                                        <div className="flex flex-wrap gap-1">
                                            {Array.from(new Set(group.allocations.map((a: any) => a.status))).map((status: any, i) => (
                                                <span key={i} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                                    {translateStatus(status)}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 sticky right-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group-hover:bg-slate-50 dark:group-hover:bg-black/20 border-l border-transparent dark:border-white/5 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingLead(group.allocations[0].lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Vedi Dettagli"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLead(group.allocations[0].lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Modifica Info Contatto"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Campaign Selector Modal (Single) */}
            {campaignSelectorTarget && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setCampaignSelectorTarget(null)}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white">Aggiungi a Campagna</h3>
                            <button onClick={() => setCampaignSelectorTarget(null)}>
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto">
                            {allCampaigns.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleSingleAddToCampaign(c.id)}
                                    className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl flex items-center gap-3 group transition-colors"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${c.enrichment_enabled ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {c.enrichment_enabled ? <Sparkles className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <div className={`font-medium ${c.enrichment_enabled ? "text-purple-700 dark:text-purple-300" : "text-slate-700 dark:text-slate-300"}`}>
                                            {c.name}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {c.status || 'Active'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            <LeadEditor
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                // Refresh list on save
                onSave={fetchLeads}
            />

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                title={confirmConfig.title}
                description={confirmConfig.description}
                onConfirm={confirmConfig.onConfirm}
                variant={confirmConfig.variant}
                confirmText={confirmConfig.confirmText}
            />

            {/* View Details Modal */}
            <LeadDetailsModal
                lead={viewingLead}
                isOpen={!!viewingLead}
                onClose={() => setViewingLead(null)}
                onLeadUpdate={handleSaveLead}
                enrichmentEnabled={!!allCampaigns.find(c => c.id === viewingLead?.campaign_id)?.enrichment_enabled}
                initialTab={viewingLeadTab}
                initialFocusField={viewingFocusField}
                onEdit={() => setEditingLead(viewingLead)}
                onAddToCampaign={() => setCampaignSelectorTarget(viewingLead)}
            />
            {/* Custom Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1"
                    style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 250) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-xs font-semibold text-slate-400 px-2 py-1.5 uppercase tracking-wider">Copia</div>
                    <button onClick={() => { navigator.clipboard.writeText(contextMenu.lead.email); setContextMenu(null); toast.success("Email copiata!"); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" /> Copia Email
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(`${contextMenu.lead.first_name} ${contextMenu.lead.last_name}`); setContextMenu(null); toast.success("Nome copiato!"); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <Users className="w-4 h-4" /> Copia Nome
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />

                    <div className="text-xs font-semibold text-slate-400 px-2 py-1.5 uppercase tracking-wider">Apri</div>
                    {(contextMenu.lead.linkedin_url || contextMenu.lead.contact?.linkedin_url) && (
                        <button onClick={() => { window.open(contextMenu.lead.linkedin_url || contextMenu.lead.contact?.linkedin_url, '_blank'); setContextMenu(null); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                            <Linkedin className="w-4 h-4" /> Profilo LinkedIn
                        </button>
                    )}
                    <button onClick={() => {
                        // Try to find website in custom fields or use a google search if strictly needed, but mainly look for website keys
                        const contact = contextMenu.lead.contacts || contextMenu.lead;
                        const customFields = contact.custom_fields || {};
                        const findKey = (obj: any, keys: string[]) => {
                            const objKeys = Object.keys(obj).map(k => k.toLowerCase());
                            for (const key of keys) {
                                const index = objKeys.indexOf(key.toLowerCase());
                                if (index !== -1) return obj[Object.keys(obj)[index]];
                            }
                            return null;
                        };
                        const url = findKey(customFields, ['website', 'url', 'site', 'web', 'company website', 'company_website']);
                        if (url) {
                            window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
                        } else {
                            toast.error("Nessun sito web trovato");
                        }
                        setContextMenu(null);
                    }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <Globe className="w-4 h-4" /> Visita Sito Web
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />

                    <div className="text-xs font-semibold text-slate-400 px-2 py-1.5 uppercase tracking-wider">Gestione</div>
                    <button onClick={() => { setEditingLead(contextMenu.lead); setContextMenu(null); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" /> Modifica
                    </button>
                    <button onClick={() => {
                        if (confirm('Eliminare questo lead?')) {
                            // Delete logic
                            toast.info("Funzionalità eliminazione da collegare completamente allo stato");
                        }
                        setContextMenu(null);
                    }} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" /> Elimina
                    </button>
                </div>
            )}
        </div>
    );
}

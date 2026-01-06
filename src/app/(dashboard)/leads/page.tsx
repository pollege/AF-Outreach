"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { Loader2, Search, Eye, Edit2, Users, Sparkles, Mail, Check } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

import { LeadEditor } from "@/components/leads/LeadEditor";
import { LeadDetailsModal } from "@/components/leads/LeadDetailsModal";

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [viewingLead, setViewingLead] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        async function fetchLeads() {
            // Select all leads with campaign name AND their messages
            const { data } = await supabase
                .from('leads')
                .select('*, campaigns(name), messages(*)')
                .order('created_at', { ascending: false })
                .limit(100);

            setLeads(data || []);
            setLoading(false);
        }
        fetchLeads();
    }, []);

    const handleSaveLead = (updatedLead: any) => {
        setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
    };

    // Filter leads client-side
    const filteredLeads = leads.filter(lead =>
        lead.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const translateStatus = (status: string) => {
        if (status === 'draft') return 'Bozza';
        if (status === 'queued') return 'In Coda';
        if (status === 'sent') return 'Inviato';
        if (status === 'new') return 'Nuovo';
        if (status === 'researched') return 'Arricchito';
        if (status === 'message_generated') return 'Msg Generato';
        return status;
    };

    const [lastClick, setLastClick] = useState<{ id: string, time: number } | null>(null);
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

    const isDrag = (e: React.MouseEvent) => {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        return dx > 5 || dy > 5;
    };

    const handleRowClick = (lead: any, e: React.MouseEvent) => {
        if (isDrag(e)) return;
        setViewingLead(lead);
    };

    const handleCellClick = (e: React.MouseEvent, lead: any) => {
        e.stopPropagation();

        if (isDrag(e)) {
            setLastClick(null);
            return;
        }

        const now = Date.now();
        if (lastClick && lastClick.id === lead.id && now - lastClick.time < 200) {
            setViewingLead(lead);
            setLastClick(null);
        } else {
            setLastClick({ id: lead.id, time: now });
        }
    };

    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [isSelectingCampaign, setIsSelectingCampaign] = useState(false);
    const [allCampaigns, setAllCampaigns] = useState<any[]>([]);

    useEffect(() => {
        // Fetch campaigns for the dropdown with type info
        supabase.from('campaigns').select('id, name, enrichment_enabled, automation_mode').then(({ data }) => setAllCampaigns(data || []));
    }, []);

    const handleBulkAssign = async (campaignId: string) => {
        const { error } = await supabase.from('leads').update({ campaign_id: campaignId }).in('id', selectedLeads);
        if (error) {
            toast.error("Errore assegnazione: " + error.message);
        } else {
            toast.success(`${selectedLeads.length} lead spostati nella campagna!`);
            // Refresh leads
            const { data } = await supabase
                .from('leads')
                .select('*, campaigns(name), messages(*)')
                .order('created_at', { ascending: false })
                .limit(100);
            setLeads(data || []);
            setSelectedLeads([]);
            setIsSelectingCampaign(false);
        }
    };

    return (
        <div>
            <Header title="Tutti i Leads" />

            <div className="flex gap-4 mb-6 justify-between items-center">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Cerca per nome, email o azienda..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {selectedLeads.length > 0 && (
                    <div className="flex bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-lg border border-purple-100 dark:border-purple-800 animate-in fade-in slide-in-from-bottom-2 items-center gap-4">
                        <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">{selectedLeads.length} selezionati</span>
                        <div className="flex gap-2 relative">
                            {isSelectingCampaign ? (
                                <div className="absolute top-10 right-0 z-50 bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-white/10 rounded-xl p-2 w-64">
                                    <h4 className="text-xs font-bold text-slate-500 px-2 py-1 mb-1">SPOSTA IN CAMPAGNA:</h4>
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                        {allCampaigns.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleBulkAssign(c.id)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg truncate flex items-center gap-2 group"
                                            >
                                                {c.enrichment_enabled ? (
                                                    <Sparkles className="w-3 h-3 text-purple-500" />
                                                ) : (
                                                    <Mail className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                                                )}
                                                <span className={c.enrichment_enabled ? "text-purple-700 dark:text-purple-300 font-medium" : "text-slate-700 dark:text-slate-300"}>
                                                    {c.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <button onClick={() => setIsSelectingCampaign(!isSelectingCampaign)} className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
                                <Users className="w-4 h-4" /> Sposta in Campagna
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="glass dark:glass-dark rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4 w-4">
                                <div
                                    className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 hover:border-purple-400'}`}
                                    onClick={() => setSelectedLeads(selectedLeads.length === filteredLeads.length ? [] : filteredLeads.map(l => l.id))}
                                >
                                    {selectedLeads.length > 0 && selectedLeads.length === filteredLeads.length && <Check className="w-3 h-3 text-white" />}
                                </div>
                            </th>
                            <th className="px-6 py-4 font-medium">Nome</th>
                            <th className="px-6 py-4 font-medium">Azienda</th>
                            <th className="px-6 py-4 font-medium">Campagna</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Score</th>
                            <th className="px-6 py-4 font-medium text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">Nessun lead trovato.</td></tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr
                                    key={lead.id}
                                    className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer ${selectedLeads.includes(lead.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                                    onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                    onClick={(e) => handleRowClick(lead, e)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div
                                            className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedLeads.includes(lead.id) ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 group-hover:border-purple-400'}`}
                                            onClick={() => {
                                                if (selectedLeads.includes(lead.id)) setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                                                else setSelectedLeads([...selectedLeads, lead.id]);
                                            }}
                                        >
                                            {selectedLeads.includes(lead.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </td>
                                    <td
                                        className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 cursor-default"
                                        onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                        onClick={(e) => handleCellClick(e, lead)}
                                    >
                                        {lead.first_name} {lead.last_name}
                                    </td>
                                    <td
                                        className="px-6 py-4 text-slate-500 cursor-default"
                                        onMouseDown={(e) => setMouseDownPos({ x: e.clientX, y: e.clientY })}
                                        onClick={(e) => handleCellClick(e, lead)}
                                    >
                                        {lead.company_name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{lead.campaigns?.name || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                            {translateStatus(lead.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium">{lead.lead_score}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingLead(lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Vedi Dettagli & Messaggi"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingLead(lead);
                                            }}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                                            title="Modifica Lead"
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

            {/* Edit Modal */}
            <LeadEditor
                lead={editingLead}
                isOpen={!!editingLead}
                onClose={() => setEditingLead(null)}
                onSave={handleSaveLead}
            />

            {/* View Details Modal */}
            <LeadDetailsModal
                lead={viewingLead}
                isOpen={!!viewingLead}
                onClose={() => setViewingLead(null)}
            />
        </div>
    );
}

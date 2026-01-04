"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LeadDetailsModalProps {
    lead: any;
    isOpen: boolean;
    onClose: () => void;
}

export function LeadDetailsModal({ lead, isOpen, onClose }: LeadDetailsModalProps) {
    if (!isOpen || !lead) return null;

    const enrichment = lead.enrichment_data || {};
    const latestMessage = lead.messages && lead.messages.length > 0 ? lead.messages[0] : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 p-0 overflow-hidden max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{lead.first_name} {lead.last_name}</h3>
                        <p className="text-sm text-slate-500">{lead.company_name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 flex-1">

                    {/* Enrichment Data */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Dati Arricchimento
                        </h4>
                        {enrichment.recent_news ? (
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-medium text-slate-500 block mb-1">Notizie Recenti</span>
                                    <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">
                                        {enrichment.recent_news.map((news: string, i: number) => (
                                            <li key={i}>{news}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-slate-500 block mb-1">Pain Points</span>
                                    <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">
                                        {enrichment.pain_points?.map((pp: string, i: number) => (
                                            <li key={i}>{pp}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Nessun dato di arricchimento disponibile.</p>
                        )}
                    </div>

                    {/* Generated Message */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Messaggio Generato
                        </h4>
                        {latestMessage ? (
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                <div className="mb-2">
                                    <span className="text-xs text-slate-500 font-bold uppercase mr-2">Oggetto:</span>
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">{latestMessage.subject}</span>
                                </div>
                                <div className="border-t border-slate-200 dark:border-white/10 my-2"></div>
                                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: latestMessage.body }}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Nessun messaggio generato ancora.</p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

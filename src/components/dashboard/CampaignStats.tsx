"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function CampaignStats({ campaigns }: { campaigns: any[] }) {
    return (
        <Card className="border-slate-100 dark:border-white/5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">Top Campagne Attive</CardTitle>
                <Link href="/campaigns" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    Vedi tutte <ArrowUpRight className="w-3 h-3" />
                </Link>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {campaigns.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4 text-center">Nessuna campagna attiva</p>
                    ) : (
                        campaigns.map((camp) => (
                            <div key={camp.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-blue-500/30 transition-colors">
                                <div className="min-w-0">
                                    <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate pr-4">{camp.name}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                        <span>{camp.stats?.sent || 0} Inviate</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span>{camp.stats?.replies || 0} Risposte</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        {camp.stats?.sent > 0
                                            ? Math.round(((camp.stats?.replies || 0) / camp.stats.sent) * 100)
                                            : 0}%
                                    </div>
                                    <p className="text-[10px] text-slate-500">Reply Rate</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Loader2,
    Check,
    Eye,
    Edit2,
    Megaphone,
    Minus,
    Columns,
    Search,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface LeadsTableProps {
    data: any[];
    loading: boolean;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onView: (lead: any) => void;
    onEdit: (lead: any) => void;

    // Configuration
    settingsKey?: string;
    groupByContact?: boolean; // If true, group leads by contact_id
    allowedActions?: ('view' | 'edit')[]; // Control which actions to show
    showStatus?: boolean; // If false, hides the status column
    enableColumnConfig?: boolean; // If false, hides column picker and uses default columns
}

export function LeadsTable({
    data,
    loading,
    selectedIds,
    onSelectionChange,
    onView,
    onEdit,
    settingsKey = 'leads_table_settings_default',
    groupByContact = false,
    allowedActions = ['view', 'edit'],
    showStatus = true,
    enableColumnConfig = true
}: LeadsTableProps) {
    const STANDARD_COLUMNS = ['first_name', 'last_name', 'company_name', 'email', 'job_title', 'linkedin_url'];

    // State for Dynamic Columns
    const [allColumns, setAllColumns] = useState<string[]>(STANDARD_COLUMNS);
    const [columnOrder, setColumnOrder] = useState<string[]>(STANDARD_COLUMNS);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(STANDARD_COLUMNS));
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    // Grouping Logic
    const processedData = useMemo(() => {
        if (!groupByContact) return data;

        return data.reduce((acc: any[], lead) => {
            const contactId = lead.contact_id;
            if (!contactId) return acc; // Should not happen for valid cold outreach leads

            const existingGroup = acc.find(g => g.contactId === contactId);
            if (existingGroup) {
                existingGroup.allocations.push({
                    leadId: lead.id,
                    campaignName: lead.campaigns?.name,
                    status: lead.status,
                    lead: lead
                });
            } else {
                acc.push({
                    contactId: contactId,
                    contact: lead.contacts || lead, // Handling both joined and flat structure preference
                    allocations: [{
                        leadId: lead.id,
                        campaignName: lead.campaigns?.name,
                        status: lead.status,
                        lead: lead
                    }],
                    // For compatibility with non-grouped renderers, ensure top-level keys exist from the main contact
                    ...((lead.contacts || lead))
                });
            }
            return acc;
        }, []);
    }, [data, groupByContact]);

    // Initialize Columns based on data
    useEffect(() => {
        if (data.length > 0) {
            const keys = new Set<string>();
            data.forEach(lead => {
                // Check CONTACT custom fields first (if existing), else direct custom_fields
                const fields = lead.contacts?.custom_fields || lead.custom_fields || {};
                Object.keys(fields).forEach(key => keys.add(key));
            });

            const customKeys = Array.from(keys);
            const merged = [...STANDARD_COLUMNS, ...customKeys];
            setAllColumns(merged);

            // Add new columns to order if not present
            setColumnOrder(prev => {
                const newKeys = merged.filter(k => !prev.includes(k));
                if (newKeys.length > 0) return [...prev, ...newKeys];
                return prev;
            });

            // Auto-make visible if standard setting not loaded or empty? 
            // We'll let the saved settings take precedence, but add new cols to hidden by default? 
            // Actually usually better to show them.
            setVisibleColumns(prevVis => {
                if (prevVis.size === 0 && !isSettingsLoaded) return new Set(merged);

                // Add any truly NEW keys that we haven't seen before?
                // Simple approach: Only add if we're initializing fresh or explicitly need to
                return prevVis;
            });
        }
    }, [data, isSettingsLoaded]);


    // Load/Save Settings
    useEffect(() => {
        if (!enableColumnConfig) {
            setIsSettingsLoaded(true);
            return;
        }

        const saved = localStorage.getItem(settingsKey);
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
    }, [settingsKey, enableColumnConfig]);

    useEffect(() => {
        if (!isSettingsLoaded || !enableColumnConfig) return;
        localStorage.setItem(settingsKey, JSON.stringify({
            columnOrder,
            visibleColumns: Array.from(visibleColumns),
            columnWidths
        }));
    }, [columnOrder, visibleColumns, columnWidths, isSettingsLoaded, settingsKey, enableColumnConfig]);


    // Resizing Logic
    const resizingCol = useRef<string | null>(null);
    const startX = useRef<number>(0);
    const startWidth = useRef<number>(0);

    const startResizing = (e: React.MouseEvent, col: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizingCol.current = col;
        startX.current = e.clientX;
        startWidth.current = getColWidth(col);
        document.body.style.cursor = 'col-resize';

        // Add global listeners
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!resizingCol.current) return;
        const diff = e.clientX - startX.current;
        const newWidth = Math.max(50, startWidth.current + diff);
        setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
    };

    const handleGlobalMouseUp = () => {
        resizingCol.current = null;
        document.body.style.cursor = 'default';
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    // Cleanup global listeners on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, []);

    const getColWidth = (col: string) => {
        if (columnWidths[col]) return columnWidths[col];
        if (col === 'email') return 250;
        if (col === 'company_name') return 200;
        if (col === 'job_title') return 180;
        if (col === 'linkedin_url') return 180;
        return 150;
    };

    const autoFitColumn = (col: string) => {
        let maxWidth = 0;
        // Measure Header
        const headerText = formatHeader(col);
        maxWidth = Math.max(maxWidth, headerText.length * 8.5 + 32);

        // Measure Content (sample 50 rows)
        processedData.slice(0, 50).forEach(row => {
            let value = '';
            // Handle both flat and grouped structures by looking at row.contact or row directly
            const source = row.contact || row;

            if (col === 'first_name') value = source.first_name || '';
            else if (col === 'last_name') value = source.last_name || '';
            else if (col === 'email') value = source.email || '';
            else if (col === 'company_name') value = source.company_name || '';
            else if (col === 'job_title') value = source.job_title || '';
            else if (col === 'linkedin_url') value = source.linkedin_url || '';
            else {
                // Try to find in custom fields
                if (source.custom_fields?.[col]) value = source.custom_fields[col];
                else if (row.custom_fields?.[col]) value = row.custom_fields[col]; // check root too
            }

            if (value) {
                const width = String(value).length * 7.5 + 32;
                maxWidth = Math.max(maxWidth, width);
            }
        });

        maxWidth = Math.max(80, Math.min(maxWidth, 500));
        setColumnWidths(prev => ({ ...prev, [col]: maxWidth }));
    };

    const formatHeader = (key: string) => {
        if (key === 'first_name') return 'Nome';
        if (key === 'last_name') return 'Cognome';
        if (key === 'company_name') return 'Azienda';
        if (key === 'email') return 'Email';
        if (key === 'job_title') return 'Job Title';
        if (key === 'linkedin_url') return 'LinkedIn';
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const translateStatus = (status: string) => {
        if (status === 'draft') return 'Bozza';
        if (status === 'queued') return 'In Coda';
        if (status === 'sent') return 'Inviato';
        if (status === 'contacted') return 'Inviato';
        if (status === 'opened') return 'Aperto';
        if (status === 'responded') return 'Risposto';
        if (status === 'new') return 'Nuovo';
        if (status === 'researched') return 'Arricchito';
        if (status === 'message_generated') return 'Msg Generato';
        return status;
    };

    // Double Scrollbar Sync
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [scrollWidth, setScrollWidth] = useState(0);

    const syncScroll = () => {
        if (tableScrollRef.current) setScrollWidth(tableScrollRef.current.scrollWidth);
    };

    useEffect(() => {
        syncScroll();
        window.addEventListener('resize', syncScroll);
        // Observer for content changes
        if (tableScrollRef.current) {
            const observer = new ResizeObserver(syncScroll);
            observer.observe(tableScrollRef.current);
            return () => {
                window.removeEventListener('resize', syncScroll);
                observer.disconnect();
            }
        }
        return () => window.removeEventListener('resize', syncScroll);
    }, [processedData, visibleColumns]);

    const handleScroll = (source: 'top' | 'table') => {
        if (!topScrollRef.current || !tableScrollRef.current) return;
        if (source === 'top') {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        } else {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
    };

    // Selection Handling
    const toggleAll = () => {
        if (selectedIds.length === processedData.length && processedData.length > 0) {
            onSelectionChange([]);
        } else {
            // If grouped, use contactId. If flat, use id.
            const allIds = processedData.map(r => groupByContact ? r.contactId : r.id);
            onSelectionChange(allIds);
        }
    };

    const toggleRow = (row: any) => {
        const id = groupByContact ? row.contactId : row.id;
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(x => x !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };


    return (
        <div className="space-y-2">

            {/* Toolbar / Column Picker */}
            {enableColumnConfig && (
                <div className="flex justify-end mb-2">
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className="gap-2"
                        >
                            <Columns className="w-4 h-4" />
                            Colonne
                        </Button>

                        {showColumnPicker && (
                            <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <div className="p-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                                    <h4 className="font-semibold text-xs uppercase text-slate-500">Gestisci Colonne</h4>
                                    <button onClick={() => setShowColumnPicker(false)}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </button>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                    {allColumns.map(col => (
                                        <label key={col} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={visibleColumns.has(col)}
                                                onChange={() => {
                                                    const next = new Set(visibleColumns);
                                                    if (next.has(col)) next.delete(col);
                                                    else next.add(col);
                                                    setVisibleColumns(next);
                                                }}
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{formatHeader(col)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Top Scrollbar */}
            <div
                ref={topScrollRef}
                onScroll={() => handleScroll('top')}
                className="overflow-x-auto w-full"
                style={{ height: '12px' }}
            >
                <div style={{ width: scrollWidth, height: '1px' }}></div>
            </div>

            {/* Table Container */}
            <div
                ref={tableScrollRef}
                onScroll={() => handleScroll('table')}
                className="glass dark:glass-dark rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden overflow-x-auto"
            >
                <table className="w-full text-sm text-left min-w-max border-collapse">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            {/* Checkbox Column */}
                            <th className="px-6 py-4 w-4 sticky left-0 bg-slate-50 dark:bg-slate-900/90 z-10">
                                <div
                                    className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${selectedIds.length > 0 && selectedIds.length === processedData.length ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 hover:border-purple-400'}`}
                                    onClick={toggleAll}
                                >
                                    {selectedIds.length > 0 && selectedIds.length === processedData.length && <Check className="w-3 h-3 text-white" />}
                                    {selectedIds.length > 0 && selectedIds.length < processedData.length && <Minus className="w-3 h-3 text-white" />}
                                </div>
                            </th>

                            {/* Dynamic Columns */}
                            {columnOrder.filter(c => visibleColumns.has(c)).map(col => (
                                <th
                                    key={col}
                                    className="relative px-6 py-4 font-medium whitespace-nowrap group/header overflow-hidden text-ellipsis text-slate-700 dark:text-slate-300"
                                    style={{ width: getColWidth(col), minWidth: getColWidth(col), maxWidth: getColWidth(col) }}
                                    title={formatHeader(col)}
                                >
                                    <span className="block truncate">{formatHeader(col)}</span>
                                    {/* Resizer */}
                                    {enableColumnConfig && (
                                        <div
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-transparent group-hover/header:bg-slate-300 dark:group-hover/header:bg-white/20 hover:bg-blue-500 active:bg-blue-500 transition-colors z-20"
                                            onMouseDown={(e) => startResizing(e, col)}
                                            onDoubleClick={(e) => { e.stopPropagation(); autoFitColumn(col); }}
                                        />
                                    )}
                                </th>
                            ))}

                            {/* Specialized Columns (Allocations for Grouped) */}
                            {groupByContact && (
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Campagne Attive</th>
                            )}
                            {groupByContact && (
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Status Recente</th>
                            )}
                            {!groupByContact && showStatus && (
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Stato</th>
                            )}

                            {/* Actions Sticky */}
                            {allowedActions.length > 0 && (
                                <th className="px-6 py-4 font-medium text-right sticky right-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-sm z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                    Azioni
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                        {loading ? (
                            <tr><td colSpan={100} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></td></tr>
                        ) : processedData.length === 0 ? (
                            <tr><td colSpan={100} className="p-8 text-center text-slate-500">Nessun contatto trovato.</td></tr>
                        ) : (
                            processedData.map((row, i) => {
                                // Determine data source (grouped vs flat)
                                const contact = row.contact || row;
                                // Determine row ID for UI
                                const id = groupByContact ? row.contactId : row.id;
                                const isSelected = selectedIds.includes(id);

                                return (
                                    <tr
                                        key={id}
                                        className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                                        onClick={() => { onView(row.allocations?.[0]?.lead || row) }}
                                    >
                                        <td className="px-6 py-4 sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-white/5 z-0" onClick={(e) => e.stopPropagation()}>
                                            <div
                                                className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-white/20 hover:border-purple-400'}`}
                                                onClick={() => toggleRow(row)}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                        </td>

                                        {columnOrder.filter(c => visibleColumns.has(c)).map(col => {
                                            const width = getColWidth(col);
                                            const widthStyle = { width, minWidth: width, maxWidth: width };

                                            // Resolve value
                                            let val = '';
                                            if (col === 'first_name') val = contact.first_name;
                                            else if (col === 'last_name') val = contact.last_name;
                                            else if (col === 'email') val = contact.email;
                                            else if (col === 'company_name') val = contact.company_name;
                                            else if (col === 'job_title') val = contact.job_title;
                                            else if (col === 'linkedin_url') val = contact.linkedin_url;
                                            else {
                                                val = contact.custom_fields?.[col] || row.custom_fields?.[col] || '-';
                                            }

                                            // Render Cell with specific styles for Name/Company
                                            if (col === 'first_name') {
                                                return (
                                                    <td key={col} className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 overflow-hidden text-ellipsis" style={widthStyle}>
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs text-slate-500 font-bold shrink-0">
                                                                {(val && typeof val === 'string') ? val[0] : '?'}
                                                            </div>
                                                            <span className="truncate">{val}</span>
                                                        </div>
                                                    </td>
                                                )
                                            }

                                            return (
                                                <td key={col} className="px-6 py-4 text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis" style={widthStyle} title={String(val)}>
                                                    {String(val || '')}
                                                </td>
                                            )
                                        })}

                                        {/* Group Specific Columns */}
                                        {groupByContact && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {row.allocations.map((a: any, idx: number) => (
                                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                                                            <Megaphone className="w-3 h-3 text-slate-400" />
                                                            {a.campaignName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        )}
                                        {groupByContact && (
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.from(new Set(row.allocations.map((a: any) => a.status))).map((s: any, idx) => (
                                                        <span key={idx} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                                            {translateStatus(s)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        )}

                                        {/* Flat Specific Status */}
                                        {!groupByContact && showStatus && (
                                            <td className="px-6 py-4">
                                                {translateStatus(row.status)}
                                            </span>
                                            </td>
                                )
                            }


                                        {/* Actions */ }
                                        {
                                    allowedActions.length > 0 && (
                                        <td className="px-6 py-4 text-right flex justify-end gap-2 sticky right-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm group-hover:bg-slate-50 dark:group-hover:bg-black/20 border-l border-transparent dark:border-white/5 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                            {allowedActions.includes('view') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); onView(row.allocations?.[0]?.lead || row); }}
                                                    className="hover:text-blue-500"
                                                    title="Vedi Dettagli"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {allowedActions.includes('edit') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); onEdit(row.allocations?.[0]?.lead || row); }}
                                                    className="hover:text-blue-500"
                                                    title="Modifica"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </td>
                                    )
                                }
                                    </tr>
                    )
                            })
                        )}
                </tbody>
            </table>
        </div>
        </div >
    );
}

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";

interface ContactPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (contacts: any[]) => Promise<void>;
    existingLeadContactIds?: string[]; // IDs to exclude or gray out
}

export function ContactPickerModal({ isOpen, onClose, onImport, existingLeadContactIds = [] }: ContactPickerModalProps) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [importing, setImporting] = useState(false);
    // View Details State


    useEffect(() => {
        if (isOpen) {
            fetchContacts();
            setSelectedIds([]);
            // Reset view state when modal opens
        }
    }, [isOpen]);

    const fetchContacts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error("Errore nel caricamento dei contatti");
        } else {
            setContacts(data || []);
        }
        setLoading(false);
    };

    const filteredContacts = contacts.filter(contact => {
        // Exclude already imported contacts if needed
        if (existingLeadContactIds.includes(contact.id)) return false;

        const term = searchTerm.toLowerCase();
        return (
            (contact.first_name || '').toLowerCase().includes(term) ||
            (contact.last_name || '').toLowerCase().includes(term) ||
            (contact.company_name || '').toLowerCase().includes(term) ||
            (contact.email || '').toLowerCase().includes(term)
        );
    });

    const handleImport = async () => {
        if (selectedIds.length === 0) return;
        setImporting(true);
        try {
            const selectedContacts = contacts.filter(c => selectedIds.includes(c.id));
            await onImport(selectedContacts);
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Errore durante l'importazione");
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col resizable"> {/* Added resizable */}
                <DialogHeader>
                    <DialogTitle>Importa da Database</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Cerca contatti..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px]">
                    <LeadsTable
                        data={filteredContacts}
                        loading={loading}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        onView={() => { }}
                        onEdit={() => { }} // Disabled
                        settingsKey="contact_picker_table"
                        enableColumnConfig={true} // Changed to true
                        allowedActions={[]}
                        showStatus={false}
                        groupByContact={false}
                    />
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={importing}>
                        Annulla
                    </Button>
                    <Button onClick={handleImport} disabled={selectedIds.length === 0 || importing}>
                        {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Importa ({selectedIds.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

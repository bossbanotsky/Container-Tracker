import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, where, onSnapshot, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Receipt, CheckCircle, Undo2, Calendar, Box, Hash, ArrowRight, Archive, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

import { Checkbox } from '@/components/ui/checkbox';

interface BillingInvoicesProps {
    filterStatus: 'Pending' | 'Billing' | 'Billed';
}

export function BillingInvoices({ filterStatus }: BillingInvoicesProps) {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [editInvoiceData, setEditInvoiceData] = useState<any | null>(null);
    const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
    const [allContainers, setAllContainers] = useState<any[]>([]);
    const [editSelectedIds, setEditSelectedIds] = useState<Set<string>>(new Set());
    const [selectedContainerDetail, setSelectedContainerDetail] = useState<any | null>(null);
    const [editLocalCode, setEditLocalCode] = useState('');
    const [editForeignCode, setEditForeignCode] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editType, setEditType] = useState<'Local' | 'Foreign'>('Local');
    const [isSavingContainer, setIsSavingContainer] = useState(false);
    const [manualEntryInvoice, setManualEntryInvoice] = useState<any | null>(null);
    const [bulkInput, setBulkInput] = useState('');
    const [isProcessingManual, setIsProcessingManual] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, 'invoices'), 
            where('userId', '==', auth.currentUser?.uid),
            where('status', '==', filterStatus)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setInvoices(list);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'invoices'));
        return () => unsubscribe();
    }, [filterStatus]);

    useEffect(() => {
        const q = query(collection(db, 'containers'), where('userId', '==', auth.currentUser?.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setAllContainers(list);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'containers'));
        return () => unsubscribe();
    }, []);

    const toggleEditSelection = (id: string) => {
        const container = allContainers.find(c => c.id === id);
        if (container && container.type === 'Foreign' && !container.localCode) {
            alert("Please set the local code for this foreign container before adding it to an invoice.");
            return;
        }

        const newSet = new Set(editSelectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setEditSelectedIds(newSet);
    };

    const handleAction = async (invoice: any) => {
        try {
            const batch = writeBatch(db);
            const invoiceRef = doc(db, 'invoices', invoice.id);
            
            if (filterStatus === 'Pending') {
                batch.update(invoiceRef, { status: 'Billing' });
            } else if (filterStatus === 'Billing') {
                batch.update(invoiceRef, { status: 'Billed' });
            } else if (filterStatus === 'Billed') {
                batch.update(invoiceRef, { status: 'Archived' });
                // We keep container status as 'Invoiced' or 'Archived'? 
                // Let's set containers to Archived too
                for (const id of (invoice.containerIds || [])) {
                    batch.update(doc(db, 'containers', id), { status: 'Archived' });
                }
            }
            await batch.commit();
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        }
    };

    const undoInvoice = async (invoice: any) => {
        try {
            const batch = writeBatch(db);
            const invoiceRef = doc(db, 'invoices', invoice.id);
            
            if (filterStatus === 'Pending') {
                for (const id of (invoice.containerIds || [])) {
                    batch.update(doc(db, 'containers', id as string), { status: 'Repaired' });
                }
                batch.delete(invoiceRef);
            } else if (filterStatus === 'Billing') {
                batch.update(invoiceRef, { status: 'Pending' });
            } else if (filterStatus === 'Billed') {
                batch.update(invoiceRef, { status: 'Billing' });
            }
            await batch.commit();
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        }
    };

    const saveEdit = async () => {
        if (!editInvoiceData || !newInvoiceNumber.trim()) return;
        try {
            const batch = writeBatch(db);
            const invoiceRef = doc(db, 'invoices', editInvoiceData.id);

            const prices = { ...(editInvoiceData.containerPrices || {}) };
            let total = 0;

            if (editInvoiceData.isManual) {
                // If it is a manual invoice, we just update the prices mapping and recalculate total
                // Also update the invoiceNumber
                const qty = editInvoiceData.totalQuantity || 0;
                for (let i = 0; i < qty; i++) {
                    const priceKey = String(i);
                    if (prices[priceKey] === undefined) prices[priceKey] = 0;
                    total += prices[priceKey];
                }

                batch.update(invoiceRef, {
                    invoiceNumber: newInvoiceNumber.trim().toUpperCase(),
                    containerPrices: prices,
                    totalAmount: total
                });
            } else {
                const originalIds = new Set<string>(editInvoiceData.containerIds || []);
                const currentSelectedIds: string[] = Array.from(editSelectedIds);
                
                const addedIds = currentSelectedIds.filter((id: string) => !originalIds.has(id));
                const removedIds = Array.from(originalIds).filter((id: string) => !editSelectedIds.has(id));

                const containerMap: Record<string, any> = {};
                allContainers.forEach(c => {
                    containerMap[c.id as string] = c;
                });

                // Validation
                for (const id of currentSelectedIds) {
                    const c = containerMap[id];
                    if (c && c.type === 'Foreign' && !c.localCode) {
                        alert("Please set the local code for this foreign container before adding it to an invoice.");
                        return;
                    }
                }

                const actualCodes = currentSelectedIds.map((id: string) => {
                    const c = containerMap[id];
                    if (c) {
                        return `${c.type}|${c.localCode || c.containerCode}|${c.containerCode}`.toUpperCase();
                    }
                    return ''; 
                }).filter(code => code !== '');

                for (const id of currentSelectedIds) {
                    if (prices[id] === undefined) prices[id] = 0;
                    total += prices[id];
                }

                batch.update(invoiceRef, {
                    invoiceNumber: newInvoiceNumber.trim().toUpperCase(),
                    containerIds: currentSelectedIds,
                    containerCodes: actualCodes,
                    containerPrices: prices,
                    totalAmount: total
                });

                for (const id of addedIds) {
                    batch.update(doc(db, 'containers', id as string), { status: 'Invoiced' });
                }
                for (const id of removedIds) {
                    batch.update(doc(db, 'containers', id as string), { status: 'Repaired' });
                }
            }

            await batch.commit();
            setEditInvoiceData(null);
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        }
    };

    const deleteInvoice = async (invoice: any) => {
        try {
            const batch = writeBatch(db);
            for (const id of (invoice.containerIds || [])) {
                batch.update(doc(db, 'containers', id as string), { status: 'Repaired' });
            }
            batch.delete(doc(db, 'invoices', invoice.id));
            await batch.commit();
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        }
    };

    const processManualBatch = async () => {
        if (!manualEntryInvoice || !bulkInput.trim()) return;
        setIsProcessingManual(true);
        try {
            const lines = bulkInput.split('\n');
            const containers: any[] = [];
            let counter = 1;

            for (const line of lines) {
                if (!line.trim()) continue;
                const normalized = line.trim().toUpperCase();

                const exists = containers.some(c => c.rawText === normalized);
                if (exists) continue;

                const parts = normalized.split(" - ");
                const isLocal = parts.length === 2 && 
                                parts[0].trim().startsWith("KAR-") && 
                                parts[1].trim().startsWith("KAR-");
                const type = isLocal ? "LOCAL" : "FOREIGN";

                containers.push({
                    number: counter++,
                    rawText: normalized,
                    type: type,
                    batchId: manualEntryInvoice.id,
                    createdAt: new Date().toISOString()
                });
            }

            await updateDoc(doc(db, 'invoices', manualEntryInvoice.id), {
                manualContainers: containers,
                containerCodes: containers.map(c => c.rawText), // Updating for consistent referencing
                totalQuantity: containers.length,
                completionStatus: 'Completed',
                updatedAt: new Date().toISOString()
            });

            setManualEntryInvoice(null);
            setBulkInput('');
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        } finally {
            setIsProcessingManual(false);
        }
    };

    const getActionText = () => {
        if (filterStatus === 'Pending') return { label: 'Move to Billing', icon: ArrowRight, color: 'bg-indigo-600 hover:bg-indigo-700' };
        if (filterStatus === 'Billing') return { label: 'Mark as Paid', icon: CheckCircle, color: 'bg-emerald-600 hover:bg-emerald-700' };
        return { label: 'Archive Invoice', icon: Archive, color: 'bg-gray-800 hover:bg-gray-900' }; // Billed
    };

    const actionData = getActionText();
    const ActionIcon = actionData.icon;

    return (
        <div className="space-y-6">
            {filterStatus !== 'Pending' && (
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{filterStatus} Invoices</h1>
                    <p className="text-muted-foreground mt-2">Manage your {filterStatus.toLowerCase()} invoices here.</p>
                </div>
            )}

            {invoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center text-muted-foreground bg-background space-y-3 shadow-sm">
                    <Receipt className="w-12 h-12 text-gray-300" />
                    <p className="text-lg font-medium text-gray-800">No {filterStatus.toLowerCase()} invoices found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {invoices.map(invoice => (
                        <Card key={invoice.id} className="flex flex-col border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                                            <Receipt className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <CardTitle className="text-lg font-black uppercase tracking-tight truncate max-w-[200px] text-gray-900" title={invoice.invoiceNumber}>
                                                    {invoice.invoiceNumber}
                                                </CardTitle>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600" onClick={() => { 
                                                    setEditInvoiceData(invoice); 
                                                    setNewInvoiceNumber(invoice.invoiceNumber); 
                                                    setEditSelectedIds(new Set(invoice.containerIds || []));
                                                }}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 space-x-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <Badge variant="outline" className="bg-white text-gray-900 border-gray-200 shadow-inner uppercase tracking-widest font-black text-[9px] px-3 py-1 rounded-full">
                                            {filterStatus}
                                        </Badge>
                                        <AlertDialog>
                                            <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete Invoice" />}>
                                                <Trash2 className="w-4 h-4" />
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete this invoice. Containers will be returned to Repaired status.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteInvoice(invoice)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex-1 bg-white">
                                <div className="flex flex-col h-full space-y-5">
                                    <div className="flex items-center justify-between text-xs px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-gray-500 font-black flex items-center uppercase tracking-widest">
                                                <Box className="w-4 h-4 mr-2 text-gray-400" />
                                                Containers
                                            </span>
                                            {invoice.totalAmount !== undefined && (
                                                <span className="text-gray-500 font-black flex items-center uppercase tracking-widest">
                                                    <Hash className="w-4 h-4 mr-2 text-gray-400" />
                                                    Total Price
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className="font-black text-gray-900 px-3 py-1 bg-white rounded-lg border shadow-sm">
                                                {invoice.isManual ? (invoice.totalQuantity || 0) : (invoice.containerIds?.length || 0)}
                                            </span>
                                            {invoice.totalAmount !== undefined && (
                                                <span className="font-black text-blue-700 px-3 py-1 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                                                    ₱{invoice.totalAmount.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>


                                    {invoice.isManual && invoice.completionStatus !== 'Completed' && (
                                        <Button 
                                            variant="secondary" 
                                            className="w-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 font-black uppercase text-[10px] tracking-widest py-6 rounded-xl"
                                            onClick={() => setManualEntryInvoice(invoice)}
                                        >
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Input Container Details
                                        </Button>
                                    )}

                                    <Accordion className="w-full">
                                        <AccordionItem value="containers" className="border px-3 py-1.5 rounded-lg bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline py-2.5">
                                                <span className="text-sm font-semibold tracking-tight text-gray-700">View Containers</span>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-3 pb-2">
                                                <div className="flex flex-col space-y-2.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {(invoice.isManual ? invoice.manualContainers : (invoice.containerIds || []).map((id: string) => allContainers.find(c => c.id === id))).map((item: any, index: number) => {
                                                        if (!item) return null;
                                                        return (
                                                            <div 
                                                                key={`${index}`} 
                                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer"
                                                                onClick={() => {
                                                                    if (!invoice.isManual && item) {
                                                                        setSelectedContainerDetail(item);
                                                                        setEditLocalCode(item.localCode || '');
                                                                        setEditForeignCode(item.containerCode || '');
                                                                        setEditType(item.type || 'Local');
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex items-center text-sm font-bold text-gray-700 min-w-0 flex-1">
                                                                    <span className="w-8 h-8 flex items-center justify-center bg-white text-[10px] font-black rounded-xl border border-gray-200 mr-4 shrink-0 shadow-sm transition-all group-hover:border-blue-200 group-hover:text-blue-600">
                                                                        {invoice.isManual ? item.number : index + 1}
                                                                    </span>
                                                                    <div className="flex flex-col flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1.5">
                                                                            <div className={`px-2 py-0.5 rounded-md text-[8px] leading-none font-black uppercase tracking-widest border transition-all ${item.type === 'Foreign' ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'}`}>
                                                                                {item.type}
                                                                            </div>
                                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none opacity-60">Security Reference</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-4 w-full">
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter leading-none mb-1">Local Identity:</span>
                                                                                <span className="text-sm font-black text-gray-950 truncate tracking-tight">
                                                                                    {invoice.isManual ? item.rawText : (item.localCode || item.containerCode || "UNASSIGNED")}
                                                                                </span>
                                                                            </div>
                                                                            {!invoice.isManual && item.containerCode && item.type === 'Foreign' && (
                                                                                <div className="flex flex-col min-w-0 border-l border-gray-100 pl-4">
                                                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter leading-none mb-1">Foreign Serial:</span>
                                                                                    <span className="text-sm font-bold text-gray-400 font-mono truncate tracking-tighter leading-none">
                                                                                        {item.containerCode}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {invoice.containerPrices && invoice.containerPrices[invoice.isManual ? (item.number !== undefined ? String(item.number - 1) : String(index)) : item.id] !== undefined && (
                                                                                <div className="flex flex-col min-w-0 border-l border-gray-100 pl-4">
                                                                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter leading-none mb-1">Price:</span>
                                                                                    <span className="text-sm font-black text-emerald-700 truncate tracking-tight">
                                                                                        ₱{invoice.containerPrices[invoice.isManual ? (item.number !== undefined ? String(item.number - 1) : String(index)) : item.id].toFixed(2)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                 <div className="flex shrink-0 ml-2">
                                                                     <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                        <ArrowRight className="w-3 h-3" />
                                                                     </div>
                                                                 </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!invoice.containerCodes && !invoice.containerIds?.length) && (
                                                        <span className="text-xs text-muted-foreground italic px-2">No containers attached.</span>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 pb-4 px-4 border-t flex space-x-3 bg-white rounded-b-xl">
                                <AlertDialog>
                                    <AlertDialogTrigger render={<Button variant="outline" size="sm" className="flex-1 flex items-center justify-center space-x-2 text-gray-600 border-gray-300 hover:bg-gray-100 font-semibold shadow-sm" />}>
                                        <Undo2 className="w-4 h-4" />
                                        <span>Undo</span>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Revert Invoice?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to revert this invoice to the previous status?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => undoInvoice(invoice)}>Revert</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button size="sm" className={`flex-[2] flex items-center justify-center space-x-2 text-white shadow-sm font-bold tracking-wide ${actionData.color}`} onClick={() => handleAction(invoice)}>
                                    <ActionIcon className="w-4 h-4" />
                                    <span>{actionData.label}</span>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!editInvoiceData} onOpenChange={(open) => !open && setEditInvoiceData(null)}>
                <DialogContent className="max-w-[95vw] w-full max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Invoice</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Invoice Number</label>
                            <Input 
                                value={newInvoiceNumber} 
                                onChange={(e) => setNewInvoiceNumber(e.target.value)} 
                                placeholder="Invoice Number" 
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium">{editInvoiceData?.isManual ? "Manual Containers" : "Containers"}</label>
                                <div className="space-y-4">
                                    {(() => {
                                        if (!editInvoiceData) return null;
                                        
                                        if (editInvoiceData.isManual) {
                                            const mContainers = editInvoiceData.manualContainers || [];
                                            const placeholders = Array(editInvoiceData.totalQuantity || 0).fill(null);
                                            
                                            // Handle case where manual details aren't filled yet
                                            const itemsToRender = mContainers.length > 0 ? mContainers : placeholders.map((_, i) => ({ number: i + 1, rawText: 'Pending Details' }));

                                            return (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Containers in Batch</span>
                                                        <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{editInvoiceData.totalQuantity || 0}</span>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        {itemsToRender.map((item: any, i: number) => {
                                                            const priceKey = item.number !== undefined ? String(item.number - 1) : String(i);
                                                            return (
                                                                <div key={i} className="flex flex-col space-y-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-blue-900">{item.number ? `#${item.number}` : `#${i + 1}`} - {item.rawText}</span>
                                                                        <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Manual</span>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2 w-full justify-end">
                                                                        <span className="text-xs font-bold text-gray-500 uppercase">Price: ₱</span>
                                                                        <Input 
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            className="w-24 h-8 text-right font-black"
                                                                            placeholder="0.00"
                                                                            value={editInvoiceData.containerPrices?.[priceKey] || ''}
                                                                            onChange={(e) => {
                                                                                setEditInvoiceData({
                                                                                    ...editInvoiceData,
                                                                                    containerPrices: {
                                                                                        ...editInvoiceData.containerPrices,
                                                                                        [priceKey]: parseFloat(e.target.value) || 0
                                                                                    }
                                                                                });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const currentIds = new Set(editInvoiceData.containerIds || []);
                                        const currentContainers = allContainers.filter(c => currentIds.has(c.id));
                                        const repairedContainers = allContainers.filter(c => c.status === 'Repaired' && !currentIds.has(c.id));

                                        return (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Containers in Invoice</span>
                                                    <span className="text-[10px] font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{currentContainers.length}</span>
                                                </div>
                                                <div className="grid gap-2">
                                                    {currentContainers.map(c => (
                                                        <div key={c.id} className="flex flex-col space-y-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                                                            <div className="flex items-center space-x-3">
                                                                <Checkbox 
                                                                    checked={editSelectedIds.has(c.id)}
                                                                    onCheckedChange={() => toggleEditSelection(c.id)}
                                                                />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs font-bold text-red-900">{c.localCode || c.containerCode}</span>
                                                                    {c.type === 'Foreign' && c.localCode && c.localCode !== c.containerCode && (
                                                                        <span className="text-[10px] font-bold text-red-500 leading-none">Orig: {c.containerCode}</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded ml-auto">Linked</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2 w-full justify-end border-t border-red-100 pt-2">
                                                                <span className="text-xs font-bold text-gray-500 uppercase">Price: ₱</span>
                                                                <Input 
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    className="w-24 h-8 text-right font-black"
                                                                    placeholder="0.00"
                                                                    value={editInvoiceData.containerPrices?.[c.id] || ''}
                                                                    onChange={(e) => {
                                                                        setEditInvoiceData({
                                                                            ...editInvoiceData,
                                                                            containerPrices: {
                                                                                ...editInvoiceData.containerPrices,
                                                                                [c.id]: parseFloat(e.target.value) || 0
                                                                            }
                                                                        });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="flex items-center justify-between pt-4">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Repaired Units Available</span>
                                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] font-black uppercase" onClick={() => {
                                                        const newSet = new Set(editSelectedIds);
                                                        repairedContainers.forEach(c => newSet.add(c.id));
                                                        setEditSelectedIds(newSet);
                                                    }}>Select All Repaired</Button>
                                                </div>
                                                <div className="grid gap-2">
                                                    {repairedContainers.map(c => (
                                                        <div key={c.id} className="flex items-center space-x-3 p-3 bg-white border border-gray-100 rounded-lg">
                                                            <Checkbox 
                                                                checked={editSelectedIds.has(c.id)}
                                                                onCheckedChange={() => toggleEditSelection(c.id)}
                                                            />
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs font-bold text-gray-900">{c.localCode || c.containerCode || "UNASSIGNED"}</span>
                                                                {c.type === 'Foreign' && c.containerCode && (
                                                                    <span className="text-[10px] font-bold text-gray-400 leading-none">Orig: {c.containerCode}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-black uppercase text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-auto">Repaired</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                        </div>

                        <Button className="w-full" onClick={saveEdit}>Save Changes</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!manualEntryInvoice} onOpenChange={(open) => !open && setManualEntryInvoice(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Batch Data Entry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                            <div className="p-2 bg-blue-600 rounded-lg text-white">
                                <Box className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Target Quantity</p>
                                <p className="text-sm font-bold text-blue-900 uppercase">Input codes for <span className="text-xl">{manualEntryInvoice?.totalQuantity}</span> units</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Paste Container Codes (Newline or Comma separated)</label>
                            <textarea 
                                className="w-full h-48 rounded-2xl border border-gray-200 bg-gray-50 p-6 font-mono text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none uppercase font-bold"
                                placeholder={"KAR-001\nKAR-002\nTGHU-1234567..."}
                                value={bulkInput}
                                onChange={(e) => setBulkInput(e.target.value.toUpperCase())}
                            />
                            <p className="text-[10px] font-medium text-gray-400 uppercase italic">Tip: KAR- prefix automatically flags as LOCAL. All others are FOREIGN.</p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest border-gray-200" onClick={() => setManualEntryInvoice(null)}>Cancel</Button>
                            <Button 
                                className="flex-[2] h-12 rounded-xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20" 
                                onClick={processManualBatch}
                                disabled={isProcessingManual || !bulkInput.trim()}
                            >
                                {isProcessingManual ? "SYNCHRONIZING..." : "VERIFY & COMMIT BATCH"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedContainerDetail} onOpenChange={(open) => {
                if (!open) {
                    setSelectedContainerDetail(null);
                    setEditLocalCode('');
                    setEditForeignCode('');
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Technical Profile</DialogTitle>
                    </DialogHeader>
                    {selectedContainerDetail && (
                        <div className="space-y-6 py-4">
                            <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                                <Button 
                                    variant={editType === 'Local' ? 'default' : 'ghost'}
                                    className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Local' ? 'bg-blue-600 shadow-md' : 'text-gray-500'}`}
                                    onClick={() => setEditType('Local')}
                                >
                                    Local
                                </Button>
                                <Button 
                                    variant={editType === 'Foreign' ? 'default' : 'ghost'}
                                    className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Foreign' ? 'bg-amber-600 shadow-md' : 'text-gray-500'}`}
                                    onClick={() => setEditType('Foreign')}
                                >
                                    Foreign
                                </Button>
                            </div>

                            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Local Identity</label>
                                    <Input 
                                        value={editLocalCode} 
                                        onChange={(e) => setEditLocalCode(e.target.value.toUpperCase())}
                                        placeholder="Local Code"
                                        className="font-black text-lg h-12 rounded-xl bg-white border-gray-200"
                                    />
                                </div>
                                {(editType === 'Foreign' || editForeignCode) && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Serial Number (Foreign)</label>
                                        <Input 
                                            value={editForeignCode} 
                                            onChange={(e) => setEditForeignCode(e.target.value.toUpperCase())}
                                            placeholder="Foreign Code"
                                            className="font-black text-lg h-12 rounded-xl bg-white border-amber-200 focus:ring-amber-500"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Current Status</span>
                                    <p className="font-bold text-gray-900 uppercase">{selectedContainerDetail.status}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-1.5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Technical Notes</label>
                                <textarea 
                                    value={editNotes} 
                                    onChange={(e) => setEditNotes(e.target.value.toUpperCase())}
                                    placeholder="Condition, repairs, etc."
                                    className="w-full h-20 rounded-xl border-gray-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:outline-none uppercase"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span>Registration</span>
                                    <span className="text-gray-900">{selectedContainerDetail.createdAt ? new Date(selectedContainerDetail.createdAt).toLocaleString() : "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest" onClick={() => setSelectedContainerDetail(null)}>
                            Dismiss
                        </Button>
                        <Button 
                            className={`flex-[2] h-12 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${editType === 'Foreign' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                            disabled={isSavingContainer}
                            onClick={async () => {
                                if (!selectedContainerDetail) return;
                                setIsSavingContainer(true);
                                try {
                                    await updateDoc(doc(db, 'containers', selectedContainerDetail.id), {
                                        localCode: editLocalCode.toUpperCase(),
                                        containerCode: editForeignCode.toUpperCase(),
                                        type: editType,
                                        notes: editNotes.trim().toUpperCase() || null
                                    });
                                    setSelectedContainerDetail(null);
                                } catch (e) {
                                    handleFirestoreError(e, OperationType.WRITE, `containers/${selectedContainerDetail.id}`);
                                } finally {
                                    setIsSavingContainer(false);
                                }
                            }}
                        >
                            {isSavingContainer ? "SAVING..." : "UPDATE IDENTITY"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

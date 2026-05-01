import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, where, onSnapshot, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Archive, Calendar, Box, Hash, Undo2, Pencil, Trash2, ArrowRight } from 'lucide-react';
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
import { InlineContainerHistory } from './ContainerHistory';

export function ArchivedInvoices() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [editInvoiceData, setEditInvoiceData] = useState<any | null>(null);
    const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
    const [allContainers, setAllContainers] = useState<any[]>([]);
    const [editSelectedIds, setEditSelectedIds] = useState<Set<string>>(new Set());
    const [selectedContainerDetail, setSelectedContainerDetail] = useState<any | null>(null);
    const [editLocalCode, setEditLocalCode] = useState('');
    const [editForeignCode, setEditForeignCode] = useState('');
    const [editType, setEditType] = useState<'Local' | 'Foreign'>('Local');
    const [editNotes, setEditNotes] = useState('');
    const [isSavingContainer, setIsSavingContainer] = useState(false);

    useEffect(() => {
        const q = query(
            collection(db, 'invoices'), 
            where('userId', '==', auth.currentUser?.uid),
            where('status', '==', 'Archived')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setInvoices(list);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'invoices'));
        return () => unsubscribe();
    }, []);

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
        const newSet = new Set(editSelectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setEditSelectedIds(newSet);
    };

    const undoInvoice = async (invoice: any) => {
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'invoices', invoice.id), { status: 'Billed' });
            for (const id of (invoice.containerIds || [])) {
                batch.update(doc(db, 'containers', id as string), { status: 'Invoiced' });
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
            
            const originalIds = new Set<string>(editInvoiceData.containerIds || []);
            const currentSelectedIds = Array.from(editSelectedIds);
            
            const addedIds = currentSelectedIds.filter((id: string) => !originalIds.has(id));
            const removedIds = Array.from(originalIds).filter((id: string) => !editSelectedIds.has(id));

            const containerMap: Record<string, any> = {};
            allContainers.forEach(c => {
                containerMap[c.id as string] = c;
            });

            const actualCodes = currentSelectedIds.map((id: string) => {
                const c = containerMap[id];
                if (c) {
                    return `${c.type}|${c.localCode || c.containerCode}|${c.containerCode}`.toUpperCase();
                }
                return ''; 
            }).filter(code => code !== '');

            batch.update(invoiceRef, {
                invoiceNumber: newInvoiceNumber.trim().toUpperCase(),
                containerIds: currentSelectedIds,
                containerCodes: actualCodes
            });

            for (const id of addedIds) {
                batch.update(doc(db, 'containers', id as string), { status: 'Invoiced' });
            }
            for (const id of removedIds) {
                batch.update(doc(db, 'containers', id as string), { status: 'Repaired' });
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

    return (
        <div className="space-y-4">
            {invoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center text-muted-foreground bg-background space-y-3 shadow-sm">
                    <Archive className="w-12 h-12 text-gray-300" />
                    <p className="text-lg font-medium text-gray-800">No archived invoices found.</p>
                    <p className="text-sm">Paid invoices will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {invoices.map(invoice => (
                        <Card key={invoice.id} className="flex flex-col border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/30 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-3 bg-gray-500 rounded-xl text-white shadow-lg shadow-gray-500/20">
                                            <Archive className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <CardTitle className="text-lg font-black uppercase tracking-tight truncate max-w-[200px] text-gray-900" title={invoice.invoiceNumber || 'Manual Invoice'}>
                                                    {invoice.invoiceNumber || 'Manual Invoice'}
                                                </CardTitle>
                                            </div>
                                            <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1 space-x-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <Badge variant="secondary" className="uppercase tracking-widest font-black text-[9px] bg-gray-200 text-gray-700 rounded-full px-3 py-1">
                                            Paid
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


                                    <Accordion className="w-full">
                                        <AccordionItem value="containers" className="border px-3 py-1 rounded-md bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline py-2">
                                                <span className="text-sm font-semibold tracking-tight text-gray-700">View Containers</span>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 pb-1">
                                                 <div className="flex flex-col space-y-2.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {(invoice.isManual ? invoice.manualContainers : (invoice.containerIds || []).map((id: string) => allContainers.find(c => c.id === id))).map((item: any, index: number) => {
                                                        if (!item) return null;
                                                        return (
                                                            <div 
                                                                key={`${index}`} 
                                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer"
                                                                onClick={() => {
                                                                    if (item) {
                                                                        const priceKey = invoice.isManual ? (item.number !== undefined ? String(item.number - 1) : String(index)) : item.id;
                                                                        const invPrice = invoice.containerPrices ? invoice.containerPrices[priceKey] : undefined;
                                                                        setSelectedContainerDetail({
                                                                            ...item, 
                                                                            invoicePrice: invPrice,
                                                                            isManualItem: invoice.isManual,
                                                                            parentInvoiceId: invoice.id
                                                                        });
                                                                        setEditLocalCode(invoice.isManual ? item.rawText : (item.localCode || ''));
                                                                        setEditForeignCode(item.containerCode || '');
                                                                        setEditType(item.type || 'Local');
                                                                        setEditNotes(item.notes || '');
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
                                                        <span className="text-xs text-muted-foreground italic px-2">No containers found.</span>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t flex bg-muted/5">
                                <AlertDialog>
                                    <AlertDialogTrigger render={<Button variant="outline" size="sm" className="w-full flex items-center justify-center space-x-2 text-gray-600 border-gray-300 hover:bg-gray-100 font-semibold" />}>
                                        <Undo2 className="w-4 h-4" />
                                        <span>Revert to Pending</span>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Revert Invoice?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to revert this invoice to billed status?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => undoInvoice(invoice)}>Revert</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!editInvoiceData} onOpenChange={(open) => !open && setEditInvoiceData(null)}>
                <DialogContent className="max-w-2xl">
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
                            <label className="text-sm font-medium">Containers</label>
                            <div className="rounded-md border bg-muted/5 max-h-[300px] flex flex-col">
                                {(() => {
                                    if (!editInvoiceData) return null;
                                    const currentIds = new Set(editInvoiceData.containerIds || []);
                                    const relevantContainers = allContainers.filter(c => 
                                        currentIds.has(c.id) || c.status === 'Repaired'
                                    );

                                    if (relevantContainers.length > 0) {
                                        const isAllSelected = relevantContainers.every(c => editSelectedIds.has(c.id));
                                        return (
                                            <div className="p-3 border-b flex items-center space-x-3 bg-muted/20">
                                                <Checkbox 
                                                    checked={isAllSelected}
                                                    onCheckedChange={() => {
                                                        if (isAllSelected) {
                                                            setEditSelectedIds(new Set());
                                                        } else {
                                                            setEditSelectedIds(new Set(relevantContainers.map(c => c.id)));
                                                        }
                                                    }}
                                                />
                                                <span className="text-xs font-semibold">Select All Available</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                <div className="overflow-y-auto divide-y">
                                    {(() => {
                                        if (!editInvoiceData) return null;
                                        const currentIds = new Set(editInvoiceData.containerIds || []);
                                        const relevantContainers = allContainers.filter(c => 
                                            currentIds.has(c.id) || c.status === 'Repaired'
                                        );

                                        if (relevantContainers.length === 0) {
                                            return <div className="p-4 text-center text-sm text-muted-foreground italic">No containers available to add.</div>;
                                        }

                                        return relevantContainers.map(c => (
                                            <div key={c.id} className="p-3 text-sm flex items-center space-x-3">
                                                <Checkbox 
                                                    checked={editSelectedIds.has(c.id)}
                                                    onCheckedChange={() => toggleEditSelection(c.id)}
                                                />
                                                <div className="flex-1 flex justify-between items-center min-w-0">
                                                    <div className="flex flex-col truncate pr-2">
                                                        <span className="text-xs font-bold text-blue-600 uppercase leading-none mb-0.5 truncate">{c.localCode || c.containerCode || "UNASSIGNED"}</span>
                                                        {c.type === 'Foreign' && c.containerCode && c.localCode !== c.containerCode && (
                                                            <span className="text-[10px] font-bold text-gray-400 leading-none">Orig: {c.containerCode}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0">
                                                        <span className="text-[10px] font-black uppercase bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 mb-1">{c.type}</span>
                                                        {currentIds.has(c.id) && <span className="text-[9px] font-bold text-emerald-600 uppercase">Current</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>

                        <Button className="w-full" onClick={saveEdit}>Save Changes</Button>
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
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Current Status</span>
                                    <p className="font-bold text-gray-900 uppercase">{selectedContainerDetail.status}</p>
                                </div>
                                {selectedContainerDetail.invoicePrice !== undefined && (
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Assigned Price</span>
                                    <p className="font-bold text-emerald-900 uppercase">₱{selectedContainerDetail.invoicePrice.toFixed(2)}</p>
                                </div>
                                )}
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

                            <div className="pt-2 border-t border-gray-100 space-y-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Activity History</span>
                                {selectedContainerDetail.id && !selectedContainerDetail.isManualItem ? (
                                    <div className="bg-gray-50 p-2 rounded-xl h-40 overflow-y-auto custom-scrollbar border border-gray-100">
                                        <InlineContainerHistory containerId={selectedContainerDetail.id} />
                                    </div>
                                ) : (
                                    <div className="bg-gray-50/50 p-6 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Manual Entry - No Audit Trail</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-gray-100">
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
                                    if (selectedContainerDetail.isManualItem) {
                                        const invRef = doc(db, 'invoices', selectedContainerDetail.parentInvoiceId);
                                        const invoice = invoices.find(inv => inv.id === selectedContainerDetail.parentInvoiceId);
                                        if (invoice && invoice.manualContainers) {
                                            const updated = [...invoice.manualContainers];
                                            const idx = updated.findIndex(c => c.number === selectedContainerDetail.number);
                                            if (idx !== -1) {
                                                updated[idx] = {
                                                    ...updated[idx],
                                                    rawText: editLocalCode.toUpperCase(),
                                                    containerCode: editForeignCode.toUpperCase(),
                                                    type: editType,
                                                    notes: editNotes.trim().toUpperCase() || null
                                                };
                                                await updateDoc(invRef, { 
                                                    manualContainers: updated,
                                                    containerCodes: updated.map(c => c.rawText)
                                                });
                                            }
                                        }
                                    } else {
                                        await updateDoc(doc(db, 'containers', selectedContainerDetail.id), {
                                            localCode: editLocalCode.toUpperCase(),
                                            containerCode: editForeignCode.toUpperCase(),
                                            type: editType,
                                            notes: editNotes.trim().toUpperCase() || null
                                        });
                                    }
                                    setSelectedContainerDetail(null);
                                } catch (e) {
                                    handleFirestoreError(e, OperationType.WRITE, selectedContainerDetail.isManualItem ? `invoices/${selectedContainerDetail.parentInvoiceId}` : `containers/${selectedContainerDetail.id}`);
                                } finally {
                                    setIsSavingContainer(false);
                                }
                            }}
                        >
                            {isSavingContainer ? "SAVING..." : "SAVE PROFILE"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

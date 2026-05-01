import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Box, Layers, ReceiptText, Sparkles, Pencil, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export function InvoiceManager() {
    const [repairedContainers, setRepairedContainers] = useState<any[]>([]);
    const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [creationMode, setCreationMode] = useState('inventory'); // 'inventory' or 'manual'
    const [containerQuantity, setContainerQuantity] = useState('1');
    const [containerPrices, setContainerPrices] = useState<Record<string, string>>({});
    const [manualUnitPrice, setManualUnitPrice] = useState('');

    const [editingContainer, setEditingContainer] = useState<any | null>(null);
    const [editLocalCode, setEditLocalCode] = useState('');
    const [editForeignCode, setEditForeignCode] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editType, setEditType] = useState<'Local' | 'Foreign'>('Local');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'containers'), where('userId', '==', auth.currentUser?.uid), where('status', '==', 'Repaired'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setRepairedContainers(list);
            
            setSelectedContainerIds(prev => {
                const newSet = new Set<string>();
                list.forEach(c => {
                    if (prev.has(c.id)) newSet.add(c.id);
                });
                return newSet;
            });
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'containers'));
        return () => unsubscribe();
    }, []);

    const toggleSelection = (id: string) => {
        const container = repairedContainers.find(c => c.id === id);
        if (container && container.type === 'Foreign' && !container.localCode) {
            alert("Please set the local code for this foreign container before adding it to an invoice.");
            return;
        }

        const newSet = new Set(selectedContainerIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedContainerIds(newSet);
    };

    const selectAll = () => {
        if (selectedContainerIds.size === repairedContainers.length) {
            setSelectedContainerIds(new Set());
        } else {
            const validContainers = repairedContainers.filter(c => !(c.type === 'Foreign' && !c.localCode));
            if (validContainers.length < repairedContainers.length) {
                alert("Some foreign containers were skipped because they don't have a local code.");
            }
            setSelectedContainerIds(new Set(validContainers.map(c => c.id)));
        }
    };

    const archiveInvoice = async () => {
        if (!invoiceNumber.trim()) return;
        if (creationMode === 'manual' && (parseInt(containerQuantity) < 1 || isNaN(parseInt(containerQuantity)))) return;
        
        setIsCreating(true);

        try {
            const invoiceNum = invoiceNumber.trim().toUpperCase();
            const checkSnap = await getDocs(query(collection(db, 'invoices'), where('userId', '==', auth.currentUser?.uid), where('invoiceNumber', '==', invoiceNum)));
            if (!checkSnap.empty) {
                alert("An invoice with this number already exists. Please use a different number.");
                setIsCreating(false);
                return;
            }

            const batch = writeBatch(db);
            const newInvoiceRef = doc(collection(db, 'invoices'));
            
            if (creationMode === 'inventory') {
                const containersToArchive = repairedContainers.filter(c => selectedContainerIds.has(c.id));
                
                // Foreign container validation
                for (const c of containersToArchive) {
                    if (c.type === 'Foreign' && !c.localCode) {
                        alert(`Container ${c.containerCode} is Foreign but has no Local Code. Please set a local code before authorizing the dispatch.`);
                        setIsCreating(false);
                        return;
                    }
                }

                const containerIds = containersToArchive.map(c => c.id);
                // ALWAYS generate containerCodes based on newest ID data
                const containerCodes = containersToArchive.map(c => `${c.type}|${c.localCode || c.containerCode}|${c.containerCode}`.toUpperCase());
                
                const prices: Record<string, number> = {};
                let total = 0;
                for (const c of containersToArchive) {
                    const price = parseFloat(containerPrices[c.id]) || 0;
                    prices[c.id] = price;
                    total += price;
                }

                batch.set(newInvoiceRef, {
                    userId: auth.currentUser?.uid,
                    invoiceNumber: invoiceNum,
                    containerIds,
                    containerCodes,
                    containerPrices: prices,
                    totalAmount: total,
                    status: 'Pending',
                    createdAt: new Date().toISOString(),
                    isManual: false
                });
                
                for (const id of containerIds) {
                    batch.update(doc(db, 'containers', id), { status: 'Invoiced' });
                }
            } else {
                // Manual creation with placeholders
                const qty = parseInt(containerQuantity);
                const unitPrice = parseFloat(manualUnitPrice) || 0;
                const placeholders = Array(qty).fill(null).map(() => ({
                    localCode: '',
                    foreignCode: '',
                    completed: false
                }));

                batch.set(newInvoiceRef, {
                    userId: auth.currentUser?.uid,
                    invoiceNumber: invoiceNum,
                    status: 'Pending',
                    createdAt: new Date().toISOString(),
                    isManual: true,
                    manualContainers: placeholders,
                    totalQuantity: qty,
                    totalAmount: qty * unitPrice,
                    completionStatus: 'Pending Details'
                });
            }
            
            await batch.commit();
            
            setInvoiceNumber('');
            setSelectedContainerIds(new Set());
            setContainerQuantity('1');
            setContainerPrices({});
            setManualUnitPrice('');
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, 'invoices');
        } finally {
            setIsCreating(false);
        }
    }

    const startEditing = (c: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingContainer(c);
        setEditLocalCode(c.localCode || '');
        setEditForeignCode(c.containerCode || '');
        setEditNotes(c.notes || '');
        setEditType(c.type || 'Local');
    };

    const saveContainerEdit = async () => {
        if (!editingContainer) return;
        setIsSavingEdit(true);
        try {
            await updateDoc(doc(db, 'containers', editingContainer.id), {
                localCode: editLocalCode.toUpperCase(),
                containerCode: editForeignCode.toUpperCase(),
                type: editType,
                notes: editNotes.trim().toUpperCase() || null
            });
            setEditingContainer(null);
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `containers/${editingContainer.id}`);
        } finally {
            setIsSavingEdit(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 p-4">
            <Card className="rounded-3xl border-0 shadow-2xl shadow-blue-500/10 overflow-hidden bg-white/50 backdrop-blur-xl">
                <div className="p-8 border-b bg-white/60">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-600/20">
                            <ReceiptText className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-950 uppercase tracking-tighter">Draft Invoice</h2>
                            <p className="text-gray-500 font-medium text-xs uppercase tracking-widest mt-1">Initialize a new billing document</p>
                        </div>
                    </div>
                </div>
                
                <CardContent className="pt-4 p-4 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1 col-span-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Invoice Reference Number</label>
                             <Input 
                                placeholder="INV-2024-XXXX" 
                                value={invoiceNumber} 
                                onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())} 
                                className="rounded-xl border-gray-200 font-bold uppercase py-5 text-base bg-white"
                                required
                            />
                        </div>
                    </div>

                    <Tabs value={creationMode} onValueChange={setCreationMode} className="w-full">
                        <TabsList className="bg-gray-100/50 p-1 rounded-xl mb-4 border border-gray-200 w-full grid grid-cols-2 h-auto">
                            <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-black uppercase text-[10px] tracking-widest px-4 py-3 flex items-center gap-2">
                                <Box className="w-4 h-4" />
                                Inventory Ledger
                            </TabsTrigger>
                            <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-black uppercase text-[10px] tracking-widest px-4 py-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Manual Batch
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="inventory" className="focus:outline-none space-y-2">
                            <div className="rounded-xl border border-gray-200 bg-white/50 max-h-[300px] overflow-hidden flex flex-col">
                                <div className="p-3 border-b bg-white flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Available Repaired Units</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{repairedContainers.length} Items</span>
                                </div>
                                <div className="overflow-y-auto divide-y divide-gray-100">
                                    {repairedContainers.length === 0 ? (
                                        <div className="p-8 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No repaired units.</div>
                                    ) : (
                                        repairedContainers.map(c => (
                                            <div key={c.id} className="p-3 text-sm flex items-center gap-3 hover:bg-blue-50/50 transition-all border-b last:border-b-0 cursor-pointer" onClick={() => toggleSelection(c.id)}>
                                                <Checkbox 
                                                    checked={selectedContainerIds.has(c.id)}
                                                    onCheckedChange={() => toggleSelection(c.id)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <div className="flex-1 flex justify-between items-center gap-4 min-w-0">
                                                    <div className="flex flex-col items-start min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <div className={`px-2 py-0.5 rounded-md text-[8px] leading-none font-black uppercase tracking-widest border transition-all ${c.type === 'Foreign' ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'}`}>
                                                                {c.type}
                                                            </div>
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none opacity-60">Security Reference</span>
                                                        </div>
                                                        <div className="flex items-center gap-4 w-full">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter leading-none mb-1">Local Identity:</span>
                                                                <span className="font-black text-gray-950 text-sm tracking-tight truncate">
                                                                    {c.localCode || c.containerCode || "UNASSIGNED"}
                                                                </span>
                                                            </div>
                                                            {c.containerCode && c.type === 'Foreign' && (
                                                                <div className="flex flex-col min-w-0 border-l border-gray-100 pl-4">
                                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter leading-none mb-1">Foreign Serial:</span>
                                                                    <span className="text-sm font-bold text-gray-400 font-mono tracking-tighter truncate leading-none">
                                                                        {c.containerCode}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {c.notes && (
                                                                <div className="flex flex-col min-w-0 border-l border-gray-100 pl-4">
                                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Notes:</span>
                                                                    <span className="text-[10px] font-medium text-gray-600 truncate italic">
                                                                        {c.notes}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <div className="flex items-center gap-2">
                                                            {selectedContainerIds.has(c.id) && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">₱</span>
                                                                    <Input 
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        value={containerPrices[c.id] || ''}
                                                                        onChange={(e) => setContainerPrices({...containerPrices, [c.id]: e.target.value})}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="w-20 h-8 text-right font-bold"
                                                                    />
                                                                </div>
                                                            )}
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-9 w-9 text-gray-300 hover:text-blue-600 hover:bg-white hover:border-blue-200 hover:shadow-sm border border-transparent transition-all"
                                                                onClick={(e) => startEditing(c, e)}
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="manual" className="focus:outline-none">
                            <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col gap-6">
                                <div className="flex flex-col items-center text-center space-y-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Define Batch Size</h3>
                                        <p className="text-[10px] text-gray-500 max-w-[200px] mx-auto">Enter number of units for this manual invoice.</p>
                                    </div>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        value={containerQuantity}
                                        onChange={(e) => setContainerQuantity(e.target.value)}
                                        className="text-center font-black text-xl h-12 w-24 rounded-lg"
                                    />
                                </div>
                                <div className="w-full border-t border-gray-200/60 pt-4">
                                     <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Uniform Unit Price</label>
                                        <Input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={manualUnitPrice}
                                            onChange={(e) => setManualUnitPrice(e.target.value)}
                                            className="font-black h-12 rounded-lg bg-white"
                                        />
                                     </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                    
                    <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Projected Total</span>
                        <span className="text-xl font-black text-emerald-800">
                            ₱{creationMode === 'inventory' 
                                ? Array.from(selectedContainerIds).reduce((acc, id) => acc + (parseFloat(containerPrices[id]) || 0), 0).toFixed(2)
                                : ((parseInt(containerQuantity) || 0) * (parseFloat(manualUnitPrice) || 0)).toFixed(2)}
                        </span>
                    </div>

                    <Button 
                        className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20" 
                        size="lg" 
                        onClick={archiveInvoice} 
                        disabled={isCreating || !invoiceNumber.trim()}
                    >
                        {isCreating ? "PROCESSSING..." : "AUTHORIZE DISPATCH"}
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={!!editingContainer} onOpenChange={(open) => !open && setEditingContainer(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Container Identity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                             <Button 
                                variant={editType === 'Local' ? 'default' : 'ghost'}
                                className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Local' ? 'bg-blue-600 shadow-md' : 'text-gray-500'}`}
                                onClick={() => setEditType('Local')}
                             >
                                Local Unit
                             </Button>
                             <Button 
                                variant={editType === 'Foreign' ? 'default' : 'ghost'}
                                className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Foreign' ? 'bg-amber-600 shadow-md' : 'text-gray-500'}`}
                                onClick={() => setEditType('Foreign')}
                             >
                                Foreign Unit
                             </Button>
                        </div>

                        <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-colors">
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Local Identity (Internal ID)</label>
                                <Input 
                                    value={editLocalCode} 
                                    onChange={(e) => setEditLocalCode(e.target.value.toUpperCase())}
                                    placeholder="e.local KAR-XXXX"
                                    className="font-black text-lg h-12 rounded-xl bg-white transition-all focus:ring-2 focus:ring-blue-600/20"
                                />
                             </div>
                             
                             {(editType === 'Foreign' || editForeignCode) && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Foreign Serial (Owner ID)</label>
                                    <Input 
                                        value={editForeignCode} 
                                        onChange={(e) => setEditForeignCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. TGHUXXXX..."
                                        className="font-black text-lg h-12 rounded-xl bg-white transition-all focus:ring-2 focus:ring-amber-600/20 border-amber-200"
                                    />
                                    <p className="text-[9px] text-amber-700 font-bold uppercase tracking-tighter opacity-70 ml-1">Original serial from the manufacturer or owner</p>
                                </div>
                             )}
                        </div>

                        <div className="space-y-1.5 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                             <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Technical Notes</label>
                             <textarea 
                                value={editNotes} 
                                onChange={(e) => setEditNotes(e.target.value.toUpperCase())}
                                placeholder="Condition, repairs, etc."
                                className="w-full h-20 rounded-xl border-gray-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:outline-none uppercase"
                             />
                        </div>
                    </div>
                    <DialogFooter className="flex gap-3">
                        <Button 
                            variant="outline" 
                            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest border-gray-200"
                            onClick={() => setEditingContainer(null)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className={`flex-[2] h-12 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${editType === 'Foreign' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                            onClick={saveContainerEdit}
                            disabled={isSavingEdit}
                        >
                            {isSavingEdit ? "SAVING..." : "UPDATE IDENTITY"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


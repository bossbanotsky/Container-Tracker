import { ContainerItem } from "./ContainerItem";
import React, { useState, useEffect } from "react";
import { db, auth, handleFirestoreError, OperationType } from "../src/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

export function ContainersView({ statusFilter }: { statusFilter?: string }) {
    const [containers, setContainers] = useState<any[]>([]);
    const [newContainerCode, setNewContainerCode] = useState('');
    const [newContainerType, setNewContainerType] = useState<'Local' | 'Foreign'>('Local');
    const [newLocalCode, setNewLocalCode] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([]);

    const toggleSelection = (containerId: string) => {
        setSelectedContainerIds(prev => 
            prev.includes(containerId) ? prev.filter(id => id !== containerId) : [...prev, containerId]
        );
    };

    const deleteSelected = async () => {
        try {
            await Promise.all(selectedContainerIds.map(id => deleteDoc(doc(db, 'containers', id))));
            setSelectedContainerIds([]);
        } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'containers');
        }
    };

    const updateSelectedStatus = async (newStatus: string) => {
        try {
            await Promise.all(selectedContainerIds.map(id => updateDoc(doc(db, 'containers', id), { status: newStatus })));
            setSelectedContainerIds([]);
        } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, 'containers');
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'containers'), where('userId', '==', auth.currentUser?.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setContainers(list);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'containers'));
        return () => unsubscribe();
    }, []);

    const addContainer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContainerCode.trim()) return;
        
        setIsAdding(true);
        try {
            const containerRef = doc(collection(db, 'containers'));
            const finalContainerCode = newContainerCode.trim().toUpperCase();
            const finalLocalCode = (newContainerType === 'Foreign' ? newLocalCode.trim() : finalContainerCode).toUpperCase();
            
            await setDoc(containerRef, {
                userId: auth.currentUser?.uid,
                containerCode: finalContainerCode,
                type: newContainerType,
                localCode: finalLocalCode,
                status: 'Active',
                notes: newNotes.trim().toUpperCase() || null,
                createdAt: new Date().toISOString()
            });
            
            await setDoc(doc(collection(db, `containers/${containerRef.id}/history`)), {
                userId: auth.currentUser?.uid,
                containerId: containerRef.id,
                status: 'Active',
                timestamp: new Date().toISOString(),
                note: 'Container added'
            });

            setNewContainerCode('');
            setNewLocalCode('');
            setNewNotes('');
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'containers');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 uppercase">Containers</h1>
                    <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-wider">Vault & Tracking</p>
                </div>
                <div className="w-full md:w-80">
                    <Input 
                        placeholder="SEARCH CONTAINER CODE..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                        className="bg-white border-gray-200 rounded-xl font-bold placeholder:font-medium uppercase"
                    />
                </div>
            </div>

            {(!statusFilter || statusFilter === 'Active') && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
                    <h2 className="text-xs font-black mb-6 uppercase tracking-[0.2em] text-blue-600">Inventory Registration</h2>
                    <form onSubmit={addContainer} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Container Number</label>
                            <Input 
                                placeholder="E.G. TGHU1234567" 
                                value={newContainerCode} 
                                onChange={(e) => setNewContainerCode(e.target.value.toUpperCase())} 
                                className="rounded-xl border-gray-200 font-bold uppercase py-6"
                                required 
                            />
                        </div>
                        <div className="w-full md:w-[150px] space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Lease Type</label>
                            <Select value={newContainerType} onValueChange={(v: 'Local'|'Foreign') => setNewContainerType(v)}>
                                <SelectTrigger className="w-full rounded-xl border-gray-200 font-bold py-6">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Local" className="font-bold">LOCAL</SelectItem>
                                    <SelectItem value="Foreign" className="font-bold">FOREIGN</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newContainerType === 'Foreign' && (
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Local Identity Code</label>
                                <Input 
                                    placeholder="E.G. ABC-001" 
                                    value={newLocalCode} 
                                    onChange={(e) => setNewLocalCode(e.target.value.toUpperCase())} 
                                    className="rounded-xl border-gray-200 font-bold uppercase py-6"
                                />
                            </div>
                        )}
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Notes</label>
                            <Input 
                                placeholder="REPAIRS NEEDED, ETC." 
                                value={newNotes} 
                                onChange={(e) => setNewNotes(e.target.value.toUpperCase())} 
                                className="rounded-xl border-gray-200 font-bold uppercase py-6"
                            />
                        </div>
                        <div className="flex items-end h-full">
                            <Button type="submit" disabled={isAdding || !newContainerCode.trim()} className="bg-blue-600 hover:bg-blue-700 h-[50px] px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition-all mb-[1px]">
                                <Plus className="w-5 h-5 mr-2 stroke-[3]" />
                                Register
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-gray-900 uppercase">
                    {statusFilter ? `${statusFilter} Containers` : 'All Containers'}
                </h2>
                
                {selectedContainerIds.length > 0 && (
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border shadow-sm ml-4">
                        <span className="text-xs font-bold text-gray-500 px-2">{selectedContainerIds.length} Selected</span>
                        {statusFilter === 'Active' && (
                            <Button size="sm" onClick={() => updateSelectedStatus('Repairing')} className="bg-blue-600 hover:bg-blue-700 font-bold">
                                Move to Repairing
                            </Button>
                        )}
                        {statusFilter === 'Repairing' && (
                            <Button size="sm" onClick={() => updateSelectedStatus('Repaired')} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                                Move to Repaired
                            </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={deleteSelected} className="font-bold">Delete</Button>
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {containers
                    .filter(c => {
                        const matchesTab = !statusFilter || c.status.toLowerCase() === statusFilter.toLowerCase();
                        const matchesSearch = c.containerCode.includes(searchQuery) || (c.localCode && c.localCode.includes(searchQuery));
                        return matchesTab && matchesSearch;
                    })
                    .map(container => (
                        <ContainerItem 
                            key={container.id} 
                            container={container} 
                            isSelected={selectedContainerIds.includes(container.id)}
                            onToggleSelection={() => toggleSelection(container.id)}
                        />
                    ))}
                {containers.filter(c => {
                    const matchesTab = !statusFilter || c.status.toLowerCase() === statusFilter.toLowerCase();
                    const matchesSearch = c.containerCode.includes(searchQuery) || (c.localCode && c.localCode.includes(searchQuery));
                    return matchesTab && matchesSearch;
                }).length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center space-y-2">
                        <p className="text-gray-400 font-black uppercase text-xs tracking-[0.2em]">No containers found</p>
                        <p className="text-gray-400 text-xs font-medium uppercase">Try adjusting your filters or search query.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

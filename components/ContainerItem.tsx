import React, { useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { Box, Wrench, CheckCircle2, History, Trash2, Info, Pencil, ArrowRight } from 'lucide-react';
import { ContainerHistory, InlineContainerHistory } from './ContainerHistory';
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

interface Container {
  id: string;
  containerCode: string;
  type: 'Local' | 'Foreign';
  localCode?: string;
  status: 'Active' | 'Repairing' | 'Repaired' | 'Invoiced' | 'Archived';
  createdAt?: string;
  notes?: string;
}

export const ContainerItem: React.FC<{ 
  container: Container;
  isSelected: boolean;
  onToggleSelection: () => void;
}> = ({ container, isSelected, onToggleSelection }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [localCodeInput, setLocalCodeInput] = useState('');
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [containerCodeInput, setContainerCodeInput] = useState(container.containerCode);
  const [editNotes, setEditNotes] = useState(container.notes || '');
  const [editType, setEditType] = useState<'Local' | 'Foreign'>(container.type);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [statusToConfirm, setStatusToConfirm] = useState<Container['status'] | null>(null);

  React.useEffect(() => {
    setLocalCodeInput(container.localCode || '');
    setContainerCodeInput(container.containerCode);
    setEditNotes(container.notes || '');
    setEditType(container.type);
  }, [container]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid date';
    }
  };

  const handleSaveLocalCode = async () => {
    if (!localCodeInput.trim()) return;
    setIsSavingLocal(true);
    try {
        await updateDoc(doc(db, 'containers', container.id), { localCode: localCodeInput.trim().toUpperCase() });
    } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `containers/${container.id}`);
    } finally {
        setIsSavingLocal(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!containerCodeInput.trim()) return;
    setIsSavingEdit(true);
    try {
        await updateDoc(doc(db, 'containers', container.id), { 
          containerCode: containerCodeInput.trim().toUpperCase(),
          localCode: localCodeInput.trim().toUpperCase(),
          type: editType,
          notes: editNotes.trim().toUpperCase() || null
        });
        setShowEditDialog(false);
    } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `containers/${container.id}`);
    } finally {
        setIsSavingEdit(false);
    }
  };

  const updateStatus = async (newStatus: Container['status']) => {
    try {
      const containerRef = doc(db, 'containers', container.id);
      await updateDoc(containerRef, { status: newStatus });
      await addDoc(collection(db, `containers/${container.id}/history`), {
        userId: auth.currentUser?.uid,
        containerId: container.id,
        status: newStatus,
        details: `Status changed to ${newStatus}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `containers/${container.id}`);
    }
  };

  const deleteContainer = async () => {
    setIsDeleting(true);
    try {
        await deleteDoc(doc(db, 'containers', container.id));
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `containers/${container.id}`);
        setIsDeleting(false);
    }
  }

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'Active': 
              return 'bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-1 ring-blue-400/50';
          case 'Repairing': 
              return 'bg-amber-500 text-white border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-400/50';
          case 'Repaired': 
              return 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400/50';
          case 'Invoiced': 
              return 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.5)] ring-1 ring-indigo-400/50';
          case 'Archived': 
              return 'bg-slate-600 text-white border-slate-500 shadow-[0_0_15px_rgba(71,85,105,0.4)] ring-1 ring-slate-500/50';
          default: 
              return 'bg-gray-500 text-white border-gray-400 shadow-md ring-1 ring-gray-400/50';
      }
  }

  const getStatusIcon = (status: string) => {
      switch (status) {
          case 'Active': return <Box className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
          case 'Repairing': return <Wrench className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
          case 'Repaired': return <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
          case 'Invoiced': return <History className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
          case 'Archived': return <Trash2 className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
          default: return <Box className="w-3.5 h-3.5 mr-1.5 opacity-90" />;
      }
  }

  return (
    <>
      <Accordion className="border shadow-sm rounded-lg overflow-hidden">
        <AccordionItem value={container.id}>
            <AccordionTrigger className="p-0 border-0 hover:no-underline">
                <CardHeader className="w-full pb-3 border-b border-gray-100 bg-gray-50/30">
                    <div className="flex items-start justify-between gap-4 w-full">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={(e) => { e.stopPropagation(); onToggleSelection(); }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`px-1.5 py-0.5 rounded text-[8px] leading-none font-black uppercase tracking-widest border shrink-0 ${container.type === 'Foreign' ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'}`}>
                                        {container.type}
                                    </div>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none opacity-60">Security Reference</span>
                                </div>
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter leading-none mb-0.5">Local Identity:</span>
                                        <span className="text-sm font-black text-gray-950 truncate tracking-tight">
                                            {container.localCode || container.containerCode || "UNASSIGNED"}
                                        </span>
                                    </div>
                                    {container.containerCode && container.type === 'Foreign' && (
                                        <div className="flex flex-col min-w-0 border-l border-gray-100 pl-3">
                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter leading-none mb-0.5">Foreign Serial:</span>
                                            <span className="text-[12px] font-bold text-gray-400 font-mono tracking-tighter truncate leading-tight">
                                                {container.containerCode}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className={`flex items-center justify-center px-3.5 py-1.5 rounded-full text-[9px] uppercase tracking-widest font-black transition-transform duration-300 border h-fit shrink-0 min-w-[90px] ${getStatusColor(container.status)} group-hover:scale-105`}>
                          {getStatusIcon(container.status)}
                          <span className="leading-none">{container.status}</span>
                        </div>
                    </div>
                </CardHeader>
            </AccordionTrigger>
            
            <AccordionContent>
                <CardContent className="pt-3 pb-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          <span>Registered {formatDate(container.createdAt).split(',')[0]}</span>
                          {container.notes && <span className="text-blue-500 flex items-center"><Info className="w-2.5 h-2.5 mr-0.5"/> Notes</span>}
                      </div>
                      {(['Active', 'Repairing', 'Repaired'].includes(container.status)) && (
                          <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                              {container.status === 'Active' && (
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs font-bold" onClick={() => setStatusToConfirm('Repairing')}>
                                      Start Repair
                                  </Button>
                              )}
                              {container.status === 'Repairing' && (
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold" onClick={() => setStatusToConfirm('Repaired')}>
                                      Complete Repair
                                  </Button>
                              )}
                              {container.status === 'Repaired' && (
                                  <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 text-xs font-bold" onClick={() => setStatusToConfirm('Repairing')}>
                                      Undo Repair
                                  </Button>
                              )}
                          </div>
                      )}
                </CardContent>

                {/* Expandable Details */}
                <div className="border-t border-gray-100 bg-gray-50/30">
                  <CardContent className="pt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                    {container.notes && (
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-inner">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Logistics Notes</span>
                            <p className="text-sm font-medium text-gray-700 leading-relaxed italic">
                                {container.notes}
                            </p>
                        </div>
                    )}
                    
                    {container.type === 'Foreign' && !container.localCode && (
                        <div className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-gray-100">
                            <Input 
                                placeholder="SET LOCAL CODE" 
                                value={localCodeInput} 
                                onChange={(e) => setLocalCodeInput(e.target.value.toUpperCase())} 
                                className="h-9 text-sm font-bold uppercase"
                            />
                            <Button size="sm" onClick={handleSaveLocalCode} disabled={!localCodeInput.trim() || isSavingLocal} className="h-9 px-4 font-bold">Save</Button>
                        </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 pb-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex w-full justify-between items-center gap-2">
                        <div className="flex flex-wrap gap-2">
                            {/* Actions moved to CardContent */}
                        </div>

                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => setShowEditDialog(true)} title="Edit">
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => setShowFullDetails(true)} title="Details">
                                <Info className="w-4 h-4" />
                            </Button>
                            <ContainerHistory containerId={container.id} />
                            
                            {['Active', 'Repairing', 'Repaired'].includes(container.status) && (
                                <AlertDialog>
                                    <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-700 hover:bg-red-50" disabled={isDeleting} />}>
                                        <Trash2 className="w-4 h-4" />
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete this container.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={deleteContainer} className="bg-red-600">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                  </CardFooter>
                </div>
            </AccordionContent>
        </AccordionItem>
    </Accordion>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Container Identity</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                    <Button 
                        variant={editType === 'Local' ? 'default' : 'ghost'}
                        className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Local' ? 'bg-blue-600 shadow-md text-white' : 'text-gray-500'}`}
                        onClick={() => setEditType('Local')}
                    >
                        Local Unit
                    </Button>
                    <Button 
                        variant={editType === 'Foreign' ? 'default' : 'ghost'}
                        className={`flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest ${editType === 'Foreign' ? 'bg-amber-600 shadow-md text-white' : 'text-gray-500'}`}
                        onClick={() => setEditType('Foreign')}
                    >
                        Foreign Unit
                    </Button>
                </div>

                <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Local Identity (Internal ID)</label>
                        <Input 
                            value={localCodeInput} 
                            onChange={(e) => setLocalCodeInput(e.target.value.toUpperCase())}
                            placeholder="e.g. KAR-XXXX"
                            className="font-black text-lg h-12 rounded-xl bg-white"
                        />
                    </div>
                    
                    {(editType === 'Foreign' || containerCodeInput) && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Foreign Serial (Owner ID)</label>
                            <Input 
                                value={containerCodeInput} 
                                onChange={(e) => setContainerCodeInput(e.target.value.toUpperCase())}
                                placeholder="e.g. TGHUXXXX..."
                                className="font-black text-lg h-12 rounded-xl bg-white border-amber-200 focus:ring-amber-500"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-1.5 px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Technical Notes</label>
                    <textarea 
                        value={editNotes} 
                        onChange={(e) => setEditNotes(e.target.value.toUpperCase())}
                        placeholder="Condition, repairs, etc."
                        className="w-full h-20 rounded-xl border-gray-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-blue-600/20 focus:outline-none uppercase"
                    />
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest" onClick={() => setShowEditDialog(false)}>
                    Cancel
                </Button>
                <Button 
                    className={`flex-[2] h-12 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${editType === 'Foreign' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                    onClick={handleSaveIdentity}
                    disabled={isSavingEdit || !containerCodeInput.trim()}
                >
                    {isSavingEdit ? "SAVING..." : "UPDATE IDENTITY"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showFullDetails} onOpenChange={setShowFullDetails}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Full Container Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Serial Number</span>
                        <p className="text-xl font-black tracking-tight text-gray-900">{container.containerCode}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Local Identity</span>
                        <p className="text-xl font-black tracking-tight text-blue-600">{container.localCode || container.containerCode || "UNASSIGNED"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Lease Type</span>
                        <span className="font-bold text-gray-900">{container.type}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Current Status</span>
                        <span className="font-bold text-gray-900 uppercase">{container.status}</span>
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Technical Notes</span>
                    <p className="text-sm text-gray-700 italic leading-relaxed">
                        {container.notes || "No technical notes registered for this unit."}
                    </p>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Activity History</span>
                    <div className="bg-gray-50 p-2 rounded-xl h-40 overflow-y-auto custom-scrollbar border border-gray-100">
                        <InlineContainerHistory containerId={container.id} />
                    </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <span>Registration Date</span>
                        <span className="text-gray-900">{formatDate(container.createdAt)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <span>Database Identifier</span>
                        <span className="text-gray-900 font-mono select-all uppercase">{container.id}</span>
                    </div>
                </div>
            </div>
            <Button className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-gray-900" onClick={() => setShowFullDetails(false)}>
                Close Profile
            </Button>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!statusToConfirm} onOpenChange={(open) => !open && setStatusToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase font-black tracking-tight">Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-gray-600">
              Are you sure you want to change the status of <span className="font-black text-blue-600">{container.localCode || container.containerCode}</span> to <span className="font-black uppercase text-gray-900">{statusToConfirm}</span>? This action will be logged in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (statusToConfirm) {
                  updateStatus(statusToConfirm);
                  setStatusToConfirm(null);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl font-bold uppercase tracking-widest text-[10px]"
            >
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

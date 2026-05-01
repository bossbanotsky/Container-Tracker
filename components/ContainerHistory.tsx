import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export function InlineContainerHistory({ containerId }: { containerId: string }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (!containerId) return;
    const q = query(
        collection(db, `containers/${containerId}/history`), 
        where('userId', '==', auth.currentUser?.uid),
        orderBy('timestamp', 'desc')
    );
    try {
        unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            setHistory(list);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, `containers/${containerId}/history`);
        });
    } catch(e) {
    }
    return () => unsubscribe();
  }, [containerId]);

  return (
    <div className="pr-2 space-y-4 pt-2">
        {history.length === 0 ? (
            <p className="text-sm border border-dashed border-gray-200 bg-gray-50 uppercase tracking-widest font-black text-gray-400 p-4 rounded-xl text-center">No history records.</p>
        ) : (
            <div className="relative border-l-2 ml-3 pl-4 space-y-6 border-blue-100">
                {history.map((record) => (
                    <div key={record.id} className="relative">
                        <span className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-blue-100 border-2 border-blue-600 z-10" />
                        <div className="flex flex-col bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{new Date(record.timestamp).toLocaleString()}</span>
                            <span className="text-sm font-black text-blue-900 uppercase">{record.status}</span>
                            {record.details && <span className="text-xs font-bold text-gray-600 mt-1">{record.details}</span>}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}

export function ContainerHistory({ containerId }: { containerId: string }) {
  return (
    <Dialog>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="flex items-center gap-2 h-8 px-3 text-[10px] font-black uppercase tracking-widest border-gray-200 hover:border-blue-200 hover:text-blue-600 transition-all">
            <History className="w-3 h-3 text-blue-500" />
            History
        </Button>
      }>
        History
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-[2rem] border-0 shadow-2xl">
        <DialogHeader className="p-8 pb-4 bg-white border-b border-gray-50">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
                <History className="w-5 h-5 text-blue-600" />
            </div>
            Activity Logs
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-gray-50/50">
          <InlineContainerHistory containerId={containerId} />
        </div>
        <div className="p-6 bg-white border-t border-gray-50">
            <DialogClose render={
                <Button className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-gray-900 hover:bg-black text-white shadow-lg">
                    Close History
                </Button>
            }>
                Close
            </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

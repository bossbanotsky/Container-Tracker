import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export function ContainerHistory({ containerId }: { containerId: string }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribe = () => {};
    // Assuming history collection exists.
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
        // Wait, onSnapshot doesn't throw, it callbacks errors.
    }

    return () => unsubscribe();
  }, [containerId]);

  return (
    <Dialog>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
        </Button>
      }>
        History
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Container History</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto pr-2 space-y-4 pt-4">
            {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">No history recorded yet.</p>
            ) : (
                <div className="relative border-l ml-3 pl-4 space-y-6">
                    {history.map((record) => (
                        <div key={record.id} className="relative">
                            <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-primary/20 border border-primary z-10" />
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString()}</span>
                                <span className="text-sm font-medium">{record.status}</span>
                                <span className="text-sm text-muted-foreground">{record.details}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

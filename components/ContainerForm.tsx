import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ContainerForm({ onSave }: { onSave: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [containerCode, setContainerCode] = useState('');
  const [type, setType] = useState<'Local' | 'Foreign'>('Local');
  const [localCode, setLocalCode] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'Local' && !containerCode.startsWith('KAR')) {
        alert("Local containers must start with KAR");
        return;
    }
    const data: any = { 
        containerCode: containerCode.trim().toUpperCase(), 
        type, 
        status: 'Active', 
        createdAt: new Date().toISOString(),
        notes: notes.trim().toUpperCase() || null
    };
    if (type === 'Foreign') {
        data.localCode = localCode.trim().toUpperCase();
    }
    onSave(data);
    setOpen(false);
    setContainerCode('');
    setType('Local');
    setLocalCode('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        Add Container
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Container</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Container Code" value={containerCode} onChange={(e) => setContainerCode(e.target.value)} required />
          <Select onValueChange={(v: 'Local' | 'Foreign') => setType(v)} defaultValue="Local">
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Local">Local</SelectItem>
              <SelectItem value="Foreign">Foreign</SelectItem>
            </SelectContent>
          </Select>
          {type === 'Foreign' && (
            <Input placeholder="Associated Local Code" value={localCode} onChange={(e) => setLocalCode(e.target.value)} required />
          )}
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

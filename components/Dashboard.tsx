import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../src/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Box, Wrench, CheckCircle2, Receipt, CreditCard } from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState({
        active: 0,
        repairing: 0,
        repaired: 0,
        pendingInvoices: 0,
        billingInvoices: 0,
    });

    useEffect(() => {
        const unsubscribeContainers = onSnapshot(query(collection(db, 'containers'), where('userId', '==', auth.currentUser?.uid)), (snapshot) => {
            let active = 0;
            let repairing = 0;
            let repaired = 0;
            snapshot.forEach((doc) => {
                const status = doc.data().status;
                if (status === 'Active') active++;
                if (status === 'Repairing') repairing++;
                if (status === 'Repaired') repaired++;
            });
            setStats(prev => ({ ...prev, active, repairing, repaired }));
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'containers'));

        const unsubscribeInvoices = onSnapshot(query(collection(db, 'invoices'), where('userId', '==', auth.currentUser?.uid)), (snapshot) => {
            let pending = 0;
            let billing = 0;
            snapshot.forEach((doc) => {
                const status = doc.data().status;
                if (status === 'Pending') pending++;
                if (status === 'Billing') billing++;
            });
            setStats(prev => ({ ...prev, pendingInvoices: pending, billingInvoices: billing }));
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'invoices'));

        return () => {
            unsubscribeContainers();
            unsubscribeInvoices();
        };
    }, []);

    const statCards = [
        { title: "Active Containers", value: stats.active, icon: Box, color: "text-blue-600", bg: "bg-blue-100" },
        { title: "Repairing", value: stats.repairing, icon: Wrench, color: "text-orange-600", bg: "bg-orange-100" },
        { title: "Repaired", value: stats.repaired, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
        { title: "Pending Invoices", value: stats.pendingInvoices, icon: Receipt, color: "text-purple-600", bg: "bg-purple-100" },
        { title: "Billing Invoices", value: stats.billingInvoices, icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-100" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Overview of your container and invoice metrics.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={i} className="border shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {stat.title}
                                </CardTitle>
                                <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

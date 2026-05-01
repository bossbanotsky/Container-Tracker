/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { db, auth, login } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { ContainersView } from '@/components/ContainersView';
import { InvoiceManager } from '@/components/InvoiceManager';
import { BillingInvoices } from '@/components/BillingInvoices';
import { ArchivedInvoices } from '@/components/ArchivedInvoices';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [invoiceTab, setInvoiceTab] = useState('new');
  const [billingTab, setBillingTab] = useState('active');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authReady) {
    return <div className="flex h-screen items-center justify-center p-4 text-sm font-medium animate-pulse">Loading application...</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm space-y-8 rounded-3xl border border-gray-100 bg-white p-10 shadow-2xl shadow-blue-500/10">
          <div className="space-y-3 text-center">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-600/40 transform rotate-6">
               <span className="text-white font-black text-2xl -rotate-6">IV</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900">INVOICER</h1>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Enterprise Ledger</p>
          </div>
          <Button className="w-full bg-black hover:bg-gray-800 text-white font-bold py-6 rounded-xl transition-all active:scale-[0.98]" onClick={login}>SIGN IN WITH GOOGLE</Button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'containers_active':
        return <ContainersView statusFilter="Active" />;
      case 'containers_repairing':
        return <ContainersView statusFilter="Repairing" />;
      case 'containers_repaired':
        return <ContainersView statusFilter="Repaired" />;
      case 'invoices':
        return (
          <div className="space-y-8">

            <Tabs value={invoiceTab} onValueChange={setInvoiceTab} className="w-full">
                <TabsList className="bg-gray-100 p-1 rounded-xl mb-5 border border-gray-200 w-full h-auto flex flex-wrap gap-1">
                    <TabsTrigger value="new" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-bold uppercase text-[10px] tracking-widest px-4 py-2.5">New Invoice</TabsTrigger>
                    <TabsTrigger value="pending" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-bold uppercase text-[10px] tracking-widest px-4 py-2.5">Pending Invoices</TabsTrigger>
                </TabsList>

                <TabsContent value="new" className="focus:outline-none">
                    <InvoiceManager />
                </TabsContent>

                <TabsContent value="pending" className="focus:outline-none">
                    <BillingInvoices filterStatus="Pending" />
                </TabsContent>
            </Tabs>
          </div>
        );
      case 'billing_history':
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 uppercase">Billing & History</h1>
                    <p className="text-gray-500 font-medium text-sm mt-1 uppercase tracking-wider">Ledger Management</p>
                </div>
            </div>

            <Tabs value={billingTab} onValueChange={setBillingTab} className="w-full">
                <TabsList className="bg-gray-100 p-1 rounded-xl mb-5 border border-gray-200 w-full h-auto flex flex-wrap gap-1">
                    <TabsTrigger value="active" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-bold uppercase text-[10px] tracking-widest px-4 py-2.5">Active Billing</TabsTrigger>
                    <TabsTrigger value="billed" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-bold uppercase text-[10px] tracking-widest px-4 py-2.5">Billed (Paid)</TabsTrigger>
                    <TabsTrigger value="archive" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md font-bold uppercase text-[10px] tracking-widest px-4 py-2.5">Archive</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="focus:outline-none">
                    <BillingInvoices filterStatus="Billing" />
                </TabsContent>

                <TabsContent value="billed" className="focus:outline-none">
                    <BillingInvoices filterStatus="Billed" />
                </TabsContent>

                <TabsContent value="archive" className="focus:outline-none">
                    <ArchivedInvoices />
                </TabsContent>
            </Tabs>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}

import { ReactNode, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
    LayoutDashboard, 
    Box, 
    Receipt, 
    CreditCard, 
    CheckCircle, 
    Archive,
    Menu,
    LogOut,
    Wrench
} from "lucide-react";
import { auth } from "../src/lib/firebase";

interface LayoutProps {
    children: ReactNode;
    currentTab: string;
    onTabChange: (tab: string) => void;
}

export function Layout({ children, currentTab, onTabChange }: LayoutProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    
    const navItems = [
        { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
        { id: 'containers_active', label: 'ACTIVE CONTAINERS', icon: Box },
        { id: 'containers_repairing', label: 'REPAIRING', icon: Wrench },
        { id: 'containers_repaired', label: 'REPAIRED', icon: CheckCircle },
        { id: 'invoices', label: 'INVOICES', icon: Receipt },
        { id: 'billing_history', label: 'BILLING & HISTORY', icon: CreditCard },
    ];

    const handleTabClick = (id: string) => {
        onTabChange(id);
        setIsMobileOpen(false);
    };

    const logout = () => {
        auth.signOut();
    };

    const NavLinks = () => (
        <div className="space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                            isActive 
                                ? 'bg-blue-600 text-white font-medium shadow-md' 
                                : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="flex h-screen bg-gray-50/50">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 h-full bg-white border-r shadow-sm z-10">
                <div className="p-6 border-b flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner">
                        IN
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Invoicer</h1>
                        <p className="text-xs text-muted-foreground font-medium">Container Management System</p>
                    </div>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    <NavLinks />
                </div>
                <div className="p-4 border-t">
                    <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header & Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
                            IN
                        </div>
                        <h1 className="text-lg font-bold text-gray-900">Invoicer</h1>
                    </div>
                    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                        <SheetTrigger render={<Button variant="ghost" size="icon" className="hover:bg-blue-50 text-blue-900" />}>
                            <Menu className="w-6 h-6" />
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[80vw] sm:w-[350px] p-0">
                            <div className="p-6 border-b flex items-center space-x-3 bg-gray-50/50">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner">
                                    IN
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">Invoicer</h1>
                                    <p className="text-xs text-muted-foreground">Manager</p>
                                </div>
                            </div>
                            <div className="p-4">
                                <NavLinks />
                            </div>
                            <div className="absolute bottom-0 w-full p-4 border-t bg-white">
                                <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                                    <LogOut className="w-5 h-5" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </header>

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/30">
                    <div className="max-w-7xl mx-auto p-4 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

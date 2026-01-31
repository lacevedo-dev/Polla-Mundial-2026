
import React from 'react';
import { Home, Trophy, ListOrdered, Palette, ArrowLeftRight, Menu, X, HelpCircle, LogOut } from 'lucide-react';
import { AppView } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isPublicView = activeView === 'login' || activeView === 'register' || activeView === 'landing' || activeView === 'email-verification';

  if (isPublicView) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: Home },
    { id: 'predictions', label: 'Mis Pollas', icon: Trophy },
    { id: 'ranking', label: 'Ranking', icon: ListOrdered },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
    { id: 'design-system', label: 'Sistema', icon: Palette },
    { id: 'before-after', label: 'Antes/Después', icon: ArrowLeftRight },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="hidden md:flex flex-col w-64 bg-black text-white h-screen sticky top-0 shadow-xl z-20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => onViewChange('dashboard')}>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-brand text-black text-2xl font-black">26</div>
            <h1 className="font-brand text-lg tracking-tight">POLLA<span className="text-lime-400">2026</span></h1>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id as AppView)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeView === item.id 
                    ? 'bg-lime-400 text-black font-bold' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="https://picsum.photos/seed/user/40/40" className="rounded-full ring-2 ring-lime-400" alt="Avatar" />
              <div>
                <p className="text-sm font-bold">Administrador</p>
                <p className="text-xs text-slate-500">Miembro Premium</p>
              </div>
            </div>
            <button onClick={() => onViewChange('landing')} className="text-slate-400 hover:text-rose-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <header className="md:hidden flex items-center justify-between p-4 bg-black text-white sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2" onClick={() => onViewChange('dashboard')}>
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-brand text-black text-xl font-black">26</div>
          <span className="font-brand text-sm">POLLA<span className="text-lime-400">2026</span></span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black z-40 p-6 md:hidden overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-brand text-black text-xl font-black">26</div>
              <span className="font-brand text-xl text-white font-bold">POLLA<span className="text-lime-400">2026</span></span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-white"><X size={32} /></button>
          </div>
          <nav className="space-y-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id as AppView);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 text-2xl font-bold py-4 border-b border-slate-800 ${
                  activeView === item.id ? 'text-lime-400' : 'text-white'
                }`}
              >
                <item.icon size={28} />
                <span>{item.label}</span>
              </button>
            ))}
            <button
                onClick={() => onViewChange('landing')}
                className="w-full flex items-center gap-4 text-2xl font-bold py-4 border-b border-slate-800 text-rose-400"
              >
                <LogOut size={28} />
                <span>Cerrar Sesión</span>
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-30 shadow-lg">
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id as AppView)}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeView === item.id ? 'text-lime-600' : 'text-slate-400'
            }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;

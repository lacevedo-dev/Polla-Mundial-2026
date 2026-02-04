
import React from 'react';
import Layout from './components/Layout';
import Landing from './views/Landing';
import Dashboard from './views/Dashboard';
import DesignSystem from './views/DesignSystem';
import BeforeAfter from './views/BeforeAfter';
import Login from './views/Login';
import Register from './views/Register';
import Help from './views/Help';
import EmailVerification from './views/EmailVerification';
import Checkout from './views/Checkout';
import CreateLeague from './views/CreateLeague';
import ManagePayments from './views/ManagePayments';
import { AppView } from './types';
import { Trophy } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = React.useState<AppView>('landing');
  const [registeredEmail, setRegisteredEmail] = React.useState<string>('');

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <Landing onViewChange={setCurrentView} />;
      case 'login':
        return <Login onViewChange={setCurrentView} />;
      case 'register':
        return <Register onViewChange={setCurrentView} onRegisterSuccess={setRegisteredEmail} />;
      case 'email-verification':
        return <EmailVerification onViewChange={setCurrentView} email={registeredEmail} />;
      case 'checkout':
        return <Checkout onViewChange={setCurrentView} />;
      case 'create-league':
        return <CreateLeague onViewChange={setCurrentView} />;
      case 'manage-payments':
        return <ManagePayments onViewChange={setCurrentView} />;
      case 'help':
        return <Help />;
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'design-system':
        return <DesignSystem />;
      case 'before-after':
        return <BeforeAfter />;
      case 'predictions':
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="w-20 h-20 bg-lime-100 text-lime-600 rounded-full flex items-center justify-center mb-6">
                <Trophy size={40} />
             </div>
             <h2 className="text-3xl font-black font-brand uppercase tracking-tighter">MIS PRONÓSTICOS</h2>
             <p className="text-slate-500 max-w-sm mt-2 font-medium">Aquí aparecerán los torneos en los que participas. Actualmente el sistema está en modo demostración.</p>
          </div>
        );
      case 'ranking':
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-black font-brand uppercase tracking-tighter">Líderes de la Semana</h1>
             <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100">
                {[1,2,3,4,5].map((pos) => (
                  <div key={pos} className="flex items-center gap-4 p-6 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors cursor-pointer">
                    <span className={`w-12 h-12 flex items-center justify-center rounded-2xl font-black text-lg ${
                      pos === 1 ? 'bg-yellow-100 text-yellow-600' : 
                      pos === 2 ? 'bg-slate-100 text-slate-400' :
                      pos === 3 ? 'bg-orange-100 text-orange-600' : 'text-slate-300'
                    }`}>#{pos}</span>
                    <img src={`https://picsum.photos/seed/user${pos}/60/60`} className="w-12 h-12 rounded-full ring-2 ring-white shadow-sm" alt="Usuario" />
                    <div className="flex-1">
                      <p className="font-black text-slate-900">Usuario Ganador {pos}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">@liga_pro_crack</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-lime-600">{150 - pos * 5} pts</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Subiendo</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        );
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout activeView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;

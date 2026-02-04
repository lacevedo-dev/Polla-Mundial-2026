import React from 'react';
import { Card, Button, Badge } from '../components/UI';
import { AppView } from '../types';
import { 
  Trophy, 
  Calendar, 
  Wallet, 
  Users, 
  ShieldCheck, 
  ArrowRight,
  CheckCircle2,
  Lock,
  Globe
} from 'lucide-react';

interface JoinLeagueProps {
  onViewChange: (view: AppView) => void;
}

const JoinLeague: React.FC<JoinLeagueProps> = ({ onViewChange }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-500">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
           <div className="inline-flex items-center gap-2 bg-black text-white px-4 py-1.5 rounded-full mb-2 shadow-xl shadow-lime-400/20">
              <Trophy size={14} className="text-lime-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Te han invitado a jugar</span>
           </div>
        </div>

        {/* Main Ticket Card */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative">
            {/* Top Section */}
            <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <img src="https://picsum.photos/seed/admin/60/60" className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg" alt="Admin" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ADMINISTRADA POR</p>
                        <p className="text-sm font-black uppercase">LUIS MORALES</p>
                    </div>
                    <div className="h-px w-12 bg-white/20 my-2"></div>
                    <h2 className="text-3xl font-black font-brand uppercase tracking-tighter leading-none text-white">
                        LOS CRACKS DEL BARRIO
                    </h2>
                    <Badge color="bg-lime-400 text-black border border-lime-300">
                        <Lock size={10} className="mr-1" /> LIGA PRIVADA
                    </Badge>
                </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center h-8 bg-slate-50">
                 <div className="absolute left-0 w-6 h-6 bg-slate-50 rounded-full -translate-x-1/2 border border-slate-200"></div>
                 <div className="w-full border-t-2 border-dashed border-slate-300 mx-8"></div>
                 <div className="absolute right-0 w-6 h-6 bg-slate-50 rounded-full translate-x-1/2 border border-slate-200"></div>
            </div>

            {/* Info Body */}
            <div className="p-8 pt-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-1 text-center">
                        <Wallet size={18} className="text-lime-600 mb-1" />
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">ENTRADA</span>
                        <span className="text-sm font-black text-slate-900">$50.000</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col items-center gap-1 text-center">
                        <Users size={18} className="text-purple-600 mb-1" />
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">JUGADORES</span>
                        <span className="text-sm font-black text-slate-900">24 / 50</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">PREMIOS ACTIVOS</p>
                    <div className="space-y-2">
                        {['1er Puesto: $648.000', '2do Puesto: $324.000', '3er Puesto: $108.000'].map((prize, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                <CheckCircle2 size={14} className="text-lime-500" />
                                {prize}
                            </div>
                        ))}
                    </div>
                </div>

                <Button 
                    className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.15em] shadow-xl hover:scale-[1.02] transition-transform" 
                    variant="secondary"
                    onClick={() => onViewChange('register')}
                >
                    ACEPTAR INVITACIÓN <ArrowRight size={16} className="ml-2" />
                </Button>
                
                <button onClick={() => onViewChange('landing')} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                    No gracias, ir al inicio
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default JoinLeague;
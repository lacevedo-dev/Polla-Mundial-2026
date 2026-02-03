
import React from 'react';
import { Card, Button, Badge } from '../components/UI';
import { Match, AppView } from '../types';
import { 
  Trophy, 
  Target, 
  Coins, 
  CheckCircle2, 
  Share2, 
  ListChecks, 
  Zap,
  TrendingUp,
  Clock,
  Sparkles,
  Star,
  Users,
  Check
} from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: AppView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const nextMatches: Match[] = [
    { id: '1', homeTeam: 'EEUU', awayTeam: 'México', homeFlag: '🇺🇸', awayFlag: '🇲🇽', date: 'Hoy, 20:00', venue: 'SoFi Stadium' },
    { id: '2', homeTeam: 'Colombia', awayTeam: 'Argentina', homeFlag: '🇨🇴', awayFlag: '🇦🇷', date: 'Mañana, 18:00', venue: 'Azteca Stadium' },
  ];

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge color="bg-lime-400 text-black font-bold">Liga Gratuita</Badge>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID: #AMIGOS-2026</span>
          </div>
          <h1 className="text-4xl font-black font-brand uppercase tracking-tighter leading-tight text-slate-900">
            LOS CRACKS <span className="text-slate-400">DEL BARRIO</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl border-slate-200 group text-slate-900 font-bold hover:bg-slate-100">
            <Share2 size={18} className="mr-2 group-hover:text-lime-600" /> INVITAR
          </Button>
          <Button variant="secondary" className="rounded-2xl font-black px-8 shadow-lg shadow-lime-400/20">
            PRONOSTICAR <Zap size={18} className="ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <Card className="bg-black text-white p-8 border-0 shadow-2xl overflow-hidden relative group">
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bolsa Bruta</span>
                <Coins size={20} className="text-lime-400" />
              </div>
              <div className="text-5xl font-black font-brand tracking-tighter text-white">$1.200k</div>
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">FONDO NETO PREMIOS</span>
                  <span className="text-xs font-black text-lime-400">$1.080k</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">COMISIÓN ADMIN (10%)</span>
                  <span className="text-xs font-black text-rose-400">$120k</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 space-y-6">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Cupos de Liga</h3>
                <Users size={14} className="text-slate-400" />
             </div>
             <div className="space-y-2">
                <div className="flex justify-between text-xs font-black">
                   <span className="text-slate-700">24 / 50</span>
                   <span className="text-lime-600">48%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-lime-400 w-[48%] rounded-full"></div>
                </div>
             </div>
          </Card>

          <Card className="p-8 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2">
              <Trophy size={14} className="text-lime-500" /> Top Actual
            </h3>
            <div className="space-y-4">
              {[
                { pos: '1º', name: 'Luis Morales', pts: '85 pts', prize: '$648k', color: 'bg-yellow-400' },
                { pos: '2º', name: 'Leo Castiblanco', pts: '78 pts', prize: '$324k', color: 'bg-slate-200' },
                { pos: '3º', name: 'Nubia Sarmiento', pts: '72 pts', prize: '$108k', color: 'bg-orange-100 text-orange-600' },
              ].map((win, i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer hover:translate-x-1 transition-transform p-2 rounded-xl hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${win.color} text-black shadow-sm`}>
                    {win.pos}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase text-slate-900 leading-tight">{win.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{win.pts}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-lime-600">{win.prize}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-8 space-y-6 bg-slate-50 border-slate-200 shadow-none">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Reglas de Puntos</h3>
                <ListChecks size={14} className="text-slate-400" />
             </div>
             <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'Marcador Exacto', val: '5', color: 'text-lime-600', icon: Target },
                  { label: 'Ganador Acertado', val: '2', color: 'text-slate-700', icon: CheckCircle2 },
                  { label: 'Gol Acertado', val: '1', color: 'text-slate-500', icon: Zap },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-lime-400 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 ${rule.color}`}><rule.icon size={16} /></div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">{rule.label}</span>
                    </div>
                    <span className={`text-sm font-black ${rule.color}`}>{rule.val}</span>
                  </div>
                ))}
             </div>
          </Card>

          <Card className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Premios</h3>
              <Badge color="bg-slate-100 text-slate-600 font-bold">Neto: $1.080k</Badge>
            </div>
            <div className="space-y-5">
               {[
                 { label: '1er Puesto', perc: '60%', amount: '$648.000', width: '60%' },
                 { label: '2do Puesto', perc: '30%', amount: '$324.000', width: '30%' },
                 { label: '3er Puesto', perc: '10%', amount: '$108.000', width: '10%' },
               ].map((dist, i) => (
                 <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-900">
                      <span>{dist.label} ({dist.perc})</span>
                      <span className="text-lime-600">{dist.amount}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-lime-400 rounded-full shadow-sm" 
                        style={{ width: dist.width }}
                       ></div>
                    </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Próximos Partidos</h3>
             <Clock size={14} className="text-slate-400" />
           </div>
           
           {/* UNIFIED DESIGN CARDS */}
           {nextMatches.map((match) => (
             <Card key={match.id} className="group hover:border-lime-400 transition-all duration-500 overflow-hidden relative border-slate-200">
                <div className="flex justify-between items-center mb-6">
                   <Badge color="bg-slate-100 text-slate-500 uppercase tracking-widest font-black text-[9px]">{match.date}</Badge>
                   <span className="text-[9px] font-black text-lime-600 uppercase tracking-widest animate-pulse">ACTIVO</span>
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.homeFlag}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.homeTeam}</span>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-12 h-12 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                      />
                      <span className="text-slate-300 font-bold">-</span>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-12 h-12 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                      />
                   </div>
                   
                   <div className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.awayFlag}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.awayTeam}</span>
                   </div>
                </div>

                <div className="mt-6 flex justify-end">
                   <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-lime-600 transition-colors">
                      Guardar <CheckCircle2 size={12} />
                   </button>
                </div>
             </Card>
           ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


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
  Users
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
            <Badge color="bg-lime-400 text-black">Liga Gratuita</Badge>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: #AMIGOS-2026</span>
          </div>
          <h1 className="text-4xl font-black font-brand uppercase tracking-tighter leading-tight">
            LOS CRACKS <span className="text-slate-400">DEL BARRIO</span>
          </h1>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl border-slate-200 group">
            <Share2 size={18} className="mr-2 group-hover:text-lime-500" /> INVITAR
          </Button>
          <Button variant="secondary" className="rounded-2xl font-black px-8">
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
              <div className="text-5xl font-black font-brand tracking-tighter">$1.200k</div>
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
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Cupos de Liga</h3>
                <Users size={14} className="text-slate-400" />
             </div>
             <div className="space-y-2">
                <div className="flex justify-between text-xs font-black">
                   <span>24 / 50</span>
                   <span className="text-lime-600">48%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-lime-400 w-[48%] rounded-full"></div>
                </div>
             </div>
          </Card>

          <Card className="p-8 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
              <Trophy size={14} /> Top Actual
            </h3>
            <div className="space-y-4">
              {[
                { pos: '1º', name: 'Luis Morales', pts: '85 pts', prize: '$648k', color: 'bg-yellow-400' },
                { pos: '2º', name: 'Leo Castiblanco', pts: '78 pts', prize: '$324k', color: 'bg-slate-300' },
                { pos: '3º', name: 'Nubia Sarmiento', pts: '72 pts', prize: '$108k', color: 'bg-orange-400' },
              ].map((win, i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer hover:translate-x-1 transition-transform">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${win.color} text-black shadow-lg`}>
                    {win.pos}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase text-slate-900 leading-tight">{win.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{win.pts}</p>
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
          <Card className="p-8 space-y-6 bg-slate-50 border-slate-100 shadow-none">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Reglas de Puntos</h3>
                <ListChecks size={14} className="text-slate-400" />
             </div>
             <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'Marcador Exacto', val: '5', color: 'text-lime-600', icon: Target },
                  { label: 'Ganador Acertado', val: '2', color: 'text-slate-600', icon: CheckCircle2 },
                  { label: 'Gol Acertado', val: '1', color: 'text-slate-400', icon: Zap },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 ${rule.color}`}><rule.icon size={16} /></div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{rule.label}</span>
                    </div>
                    <span className={`text-sm font-black ${rule.color}`}>{rule.val}</span>
                  </div>
                ))}
             </div>
          </Card>

          <Card className="p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Distribución de Premios</h3>
              <Badge color="bg-slate-100 text-slate-500">Neto: $1.080k</Badge>
            </div>
            <div className="space-y-4">
               {[
                 { label: '1er Puesto', perc: '60%', amount: '$648.000' },
                 { label: '2do Puesto', perc: '30%', amount: '$324.000' },
                 { label: '3er Puesto', perc: '10%', amount: '$108.000' },
               ].map((dist, i) => (
                 <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-900">
                      <span>{dist.label} ({dist.perc})</span>
                      <span>{dist.amount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-lime-400 rounded-full" 
                        style={{ width: dist.perc }}
                       ></div>
                    </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>

        <div className="space-y-8">
           <div className="flex justify-between items-center">
             <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Próximos Partidos</h3>
             <Clock size={14} className="text-slate-400" />
           </div>
           {nextMatches.map((match) => (
             <Card key={match.id} className="group hover:border-lime-400 transition-all duration-500 overflow-hidden relative">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{match.date}</span>
                  <Badge color="bg-rose-50 text-rose-600">Quedan 2h</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                   <div className="text-center flex-1 space-y-2">
                      <span className="text-3xl block group-hover:scale-110 transition-transform">{match.homeFlag}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest block">{match.homeTeam}</span>
                   </div>
                   <div className="text-sm font-black bg-slate-50 px-3 py-1 rounded-lg">VS</div>
                   <div className="text-center flex-1 space-y-2">
                      <span className="text-3xl block group-hover:scale-110 transition-transform">{match.awayFlag}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest block">{match.awayTeam}</span>
                   </div>
                </div>
                <Button className="w-full mt-6 bg-slate-900 group-hover:bg-lime-400 group-hover:text-black transition-colors" size="sm">Hacer Pronóstico</Button>
             </Card>
           ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

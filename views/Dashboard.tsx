
import React from 'react';
import { Card, Button, Badge, Input } from '../components/UI';
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
  Users,
  ChevronDown,
  Shield,
  User,
  LayoutDashboard,
  Wallet,
  Settings,
  ArrowUpRight,
  AlertCircle,
  Pencil,
  X,
  Copy,
  QrCode,
  MessageCircle,
  Trash2,
  Crown
} from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: AppView) => void;
}

// Mock Data Structure for Multiple Leagues
interface LeagueContext {
  id: string;
  name: string;
  role: 'admin' | 'user';
  plan: 'free' | 'gold' | 'diamond';
  participants: { current: number; max: number };
  stats: {
    rank?: number;
    points?: number;
    collected?: string;
    totalPrize?: string;
  };
  code?: string;
}

// Extended Match interface for Dashboard state
interface DashboardMatch extends Match {
  status: 'active' | 'saved';
  userPrediction: {
    home: string;
    away: string;
  };
}

const MY_LEAGUES: LeagueContext[] = [
  {
    id: 'league-1',
    name: 'LOS CRACKS DEL BARRIO',
    role: 'admin',
    plan: 'gold',
    participants: { current: 24, max: 50 },
    stats: { collected: '$1.200k', totalPrize: '$1.080k' },
    code: 'CRACKS-2026'
  },
  {
    id: 'league-2',
    name: 'OFICINA 2026',
    role: 'user',
    plan: 'diamond',
    participants: { current: 156, max: 200 },
    stats: { rank: 12, points: 45, totalPrize: '$5.000k' }
  },
  {
    id: 'league-3',
    name: 'FAMILIA PEREZ',
    role: 'user',
    plan: 'free',
    participants: { current: 8, max: 10 },
    stats: { rank: 1, points: 12, totalPrize: '$0' }
  }
];

const MOCK_PARTICIPANTS = [
    { id: '1', name: 'Luis Morales', role: 'admin', status: 'active', avatar: 'https://picsum.photos/seed/luis/40/40' },
    { id: '2', name: 'Leo Castiblanco', role: 'user', status: 'active', avatar: 'https://picsum.photos/seed/leo/40/40' },
    { id: '3', name: 'Nubia Sarmiento', role: 'user', status: 'pending', avatar: 'https://picsum.photos/seed/nubia/40/40' },
    { id: '4', name: 'Carlos Ruiz', role: 'user', status: 'active', avatar: 'https://picsum.photos/seed/carlos/40/40' },
    { id: '5', name: 'Andres Cepeda', role: 'user', status: 'pending', avatar: 'https://picsum.photos/seed/andres/40/40' },
];

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const [activeLeague, setActiveLeague] = React.useState<LeagueContext>(MY_LEAGUES[0]);
  const [isLeagueMenuOpen, setIsLeagueMenuOpen] = React.useState(false);
  
  // Modal States
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [showConfigModal, setShowConfigModal] = React.useState(false);
  const [participants, setParticipants] = React.useState(MOCK_PARTICIPANTS);

  // State for Matches to handle predictions
  const [matches, setMatches] = React.useState<DashboardMatch[]>([
    { 
      id: '1', 
      homeTeam: 'EEUU', 
      awayTeam: 'México', 
      homeFlag: '🇺🇸', 
      awayFlag: '🇲🇽', 
      date: 'Hoy, 20:00', 
      venue: 'SoFi Stadium',
      status: 'active',
      userPrediction: { home: '', away: '' }
    },
    { 
      id: '2', 
      homeTeam: 'Colombia', 
      awayTeam: 'Argentina', 
      homeFlag: '🇨🇴', 
      awayFlag: '🇦🇷', 
      date: 'Mañana, 18:00', 
      venue: 'Azteca Stadium',
      status: 'active',
      userPrediction: { home: '', away: '' }
    },
  ]);

  const handleLeagueSwitch = (league: LeagueContext) => {
    setActiveLeague(league);
    setIsLeagueMenuOpen(false);
  };

  const handleScoreChange = (id: string, team: 'home' | 'away', value: string) => {
    // Validate numbers 0-9 only (and allow empty string)
    if (value !== '' && !/^[0-9]+$/.test(value)) return;
    
    // Optional: limit length if needed (e.g., max 2 digits)
    if (value.length > 2) return;

    setMatches(prev => prev.map(m => m.id === id ? {
      ...m,
      status: 'active', // Reset to active if edited
      userPrediction: { ...m.userPrediction, [team]: value }
    } : m));
  };

  const handleSavePrediction = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? {
      ...m,
      status: 'saved'
    } : m));
  };

  const handleRemoveParticipant = (id: string) => {
      if(window.confirm('¿Estás seguro de eliminar a este participante?')) {
          setParticipants(prev => prev.filter(p => p.id !== id));
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('¡Código copiado al portapapeles!');
  };

  // --- RENDER HELPERS ---

  const renderRoleBadge = () => {
    if (activeLeague.role === 'admin') {
      return (
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1 rounded-full border border-slate-700 shadow-sm">
          <Shield size={12} className="text-lime-400" />
          <span className="text-[9px] font-black uppercase tracking-widest">Administrador</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 bg-white text-slate-700 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
        <User size={12} className="text-blue-500" />
        <span className="text-[9px] font-black uppercase tracking-widest">Participante</span>
      </div>
    );
  };

  const renderAdminStats = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-black text-white p-8 border-0 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-20"><Wallet size={120} /></div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado Financiero</span>
            <Badge color="bg-lime-400 text-black">EN CURSO</Badge>
          </div>
          <div>
            <div className="text-5xl font-black font-brand tracking-tighter text-white">{activeLeague.stats.collected}</div>
            <p className="text-xs text-slate-400 font-bold mt-1">RECAUDO TOTAL</p>
          </div>
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">BOLSA PREMIOS (NETO)</span>
              <span className="text-xs font-black text-lime-400">{activeLeague.stats.totalPrize}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 text-[9px] uppercase">COMISIÓN ADMIN (10%)</span>
              <span className="text-xs font-black text-rose-400">$120k</span>
            </div>
          </div>
          <Button 
            variant="secondary" 
            className="w-full mt-4 font-black text-xs uppercase tracking-widest h-10"
            onClick={() => onViewChange('manage-payments')}
          >
            Gestionar Pagos
          </Button>
        </div>
      </Card>

      <Card className="p-8 space-y-6">
         <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Cupos de Liga</h3>
            <Users size={14} className="text-slate-400" />
         </div>
         <div className="space-y-2">
            <div className="flex justify-between text-xs font-black">
               <span className="text-slate-700">{participants.length} / {activeLeague.participants.max}</span>
               <span className="text-lime-600">{Math.round((participants.length / activeLeague.participants.max) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-lime-400 rounded-full transition-all duration-1000" style={{ width: `${(participants.length / activeLeague.participants.max) * 100}%` }}></div>
            </div>
         </div>
         <div className="flex gap-2">
            <Button 
                variant="outline" 
                className="flex-1 text-[10px] font-black h-10 border-slate-200"
                onClick={() => setShowConfigModal(true)}
            >
                <Settings size={14} className="mr-2"/> CONFIGURAR
            </Button>
            <Button 
                variant="primary" 
                className="flex-1 text-[10px] font-black h-10"
                onClick={() => setShowInviteModal(true)}
            >
                <Share2 size={14} className="mr-2"/> INVITAR
            </Button>
         </div>
      </Card>
    </div>
  );

  const renderUserStats = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 border-0 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={120} /></div>
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Mi Desempeño</span>
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                <Trophy size={10} className="text-yellow-300" />
                <span className="text-[9px] font-black">PUESTO #{activeLeague.stats.rank}</span>
            </div>
          </div>
          <div>
            <div className="text-6xl font-black font-brand tracking-tighter text-white">{activeLeague.stats.points}</div>
            <p className="text-xs text-blue-200 font-bold mt-1">PUNTOS ACUMULADOS</p>
          </div>
          <div className="pt-4 border-t border-white/10">
             <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-green-400 flex items-center justify-center text-black font-bold text-xs">+5</div>
                <div>
                   <p className="text-[9px] font-black uppercase text-blue-200">ÚLTIMO ACIERTO</p>
                   <p className="text-xs font-bold">Marcador Exacto (COL vs BRA)</p>
                </div>
             </div>
          </div>
        </div>
      </Card>

      <Card className="p-8 space-y-6 border-slate-200 bg-white">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Tu Próximo Reto</h3>
            <Clock size={14} className="text-slate-400" />
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇸</span>
                  <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900">USA</span>
                      <span className="text-[9px] font-bold text-slate-400">vs MEX</span>
                  </div>
              </div>
              <Button size="sm" variant="secondary" className="px-4 h-8 text-[9px] font-black uppercase tracking-widest shadow-none">
                  PRONOSTICAR
              </Button>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
             <Clock size={12} className="text-amber-500" />
             Cierre en 2 horas 30 min
          </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-700 relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      {/* --- MODAL: CONFIGURAR CUPOS --- */}
      {showConfigModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <Card className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 space-y-5 overflow-hidden flex flex-col max-h-[85vh]">
                 <div className="flex justify-between items-start shrink-0">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900">
                          <Users size={24} />
                       </div>
                       <div>
                          <h3 className="text-lg font-black font-brand uppercase text-slate-900">Gestión de Cupos</h3>
                          <p className="text-xs text-slate-500 font-medium">
                             {participants.length} de {activeLeague.participants.max} cupos usados
                          </p>
                       </div>
                    </div>
                    <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-black"><X size={24}/></button>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {participants.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <img src={user.avatar} className="w-10 h-10 rounded-xl" alt={user.name} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-black text-slate-900 uppercase">{user.name}</p>
                                        {user.role === 'admin' && <Crown size={12} className="text-amber-500 fill-amber-500" />}
                                    </div>
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${user.status === 'active' ? 'text-lime-600' : 'text-slate-400'}`}>
                                        {user.status === 'active' ? 'ACTIVO' : 'PENDIENTE'}
                                    </p>
                                </div>
                            </div>
                            {user.role !== 'admin' && (
                                <button 
                                    onClick={() => handleRemoveParticipant(user.id)}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                 </div>

                 <div className="shrink-0 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">PROGRESO DEL PLAN</span>
                        <span className="text-[10px] font-black text-slate-900 uppercase">{activeLeague.plan}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-slate-900 rounded-full" style={{ width: `${(participants.length / activeLeague.participants.max) * 100}%` }}></div>
                    </div>
                    {activeLeague.plan !== 'diamond' && (
                        <Button 
                            className="w-full h-10 rounded-xl font-black text-[9px] uppercase tracking-widest" 
                            variant="primary"
                            onClick={() => onViewChange('checkout')}
                        >
                            AUMENTAR CUPOS (MEJORAR PLAN)
                        </Button>
                    )}
                 </div>
             </Card>
          </div>
      )}

      {/* --- MODAL: INVITAR --- */}
      {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <Card className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative">
                 {/* Decorative header bg */}
                 <div className="h-24 bg-slate-900 absolute top-0 left-0 right-0"></div>
                 
                 <div className="relative z-10 px-6 pt-6 pb-8 flex flex-col items-center text-center space-y-6">
                     <button onClick={() => setShowInviteModal(false)} className="absolute top-0 right-0 text-white/50 hover:text-white"><X size={24}/></button>
                     
                     <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-900 mb-2">
                        <QrCode size={48} />
                     </div>
                     
                     <div className="space-y-1">
                        <h3 className="text-xl font-black font-brand uppercase text-slate-900">Invita Amigos</h3>
                        <p className="text-xs text-slate-500 font-medium">Comparte este código o enlace para que se unan a <br/><strong className="text-slate-900">{activeLeague.name}</strong></p>
                     </div>

                     <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center gap-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">CÓDIGO DE LIGA</span>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-black font-brand text-slate-900 tracking-widest">{activeLeague.code || 'CODE-123'}</span>
                            <button onClick={() => copyToClipboard(activeLeague.code || 'CODE-123')} className="text-lime-600 hover:text-lime-700">
                                <Copy size={18} />
                            </button>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 w-full">
                        <Button 
                            className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest bg-[#25D366] hover:bg-[#20bd5a] text-white border-none"
                            onClick={() => window.open(`https://wa.me/?text=Únete a mi polla mundialista con el código: ${activeLeague.code}`, '_blank')}
                        >
                            <MessageCircle size={18} className="mr-2" /> WhatsApp
                        </Button>
                        <Button 
                            className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            variant="secondary"
                            onClick={() => copyToClipboard(`https://polla2026.com/join/${activeLeague.code}`)}
                        >
                            <Copy size={18} className="mr-2" /> Copiar Link
                        </Button>
                     </div>
                 </div>
             </Card>
          </div>
      )}

      {/* HEADER WITH CONTEXT SWITCHER */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 relative">
            <div className="flex items-center gap-3">
              {renderRoleBadge()}
              <Badge color={activeLeague.plan === 'diamond' ? 'bg-cyan-100 text-cyan-700' : activeLeague.plan === 'gold' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                 PLAN {activeLeague.plan.toUpperCase()}
              </Badge>
            </div>
            
            {/* LEAGUE SELECTOR */}
            <div className="relative group">
                <button 
                  onClick={() => setIsLeagueMenuOpen(!isLeagueMenuOpen)}
                  className="flex items-center gap-3 text-3xl md:text-5xl font-black font-brand uppercase tracking-tighter leading-tight text-slate-900 hover:text-lime-600 transition-colors text-left"
                >
                  {activeLeague.name}
                  <ChevronDown size={32} className={`transition-transform duration-300 text-slate-300 group-hover:text-lime-400 ${isLeagueMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* DROPDOWN MENU */}
                {isLeagueMenuOpen && (
                  <div className="absolute top-full left-0 mt-4 w-full md:w-96 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tus Ligas Activas</span>
                          <span className="text-[10px] font-bold text-lime-600 bg-lime-50 px-2 py-1 rounded-lg cursor-pointer hover:bg-lime-100" onClick={() => onViewChange('create-league')}>+ NUEVA</span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {MY_LEAGUES.map(league => (
                           <button 
                             key={league.id}
                             onClick={() => handleLeagueSwitch(league)}
                             className={`w-full text-left p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${activeLeague.id === league.id ? 'bg-lime-50/50' : ''}`}
                           >
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${league.role === 'admin' ? 'bg-slate-900' : 'bg-blue-500'}`}>
                                    {league.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                                 </div>
                                 <div>
                                    <p className={`text-sm font-black uppercase ${activeLeague.id === league.id ? 'text-lime-700' : 'text-slate-900'}`}>{league.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{league.role === 'admin' ? 'Administrando' : `Puesto #${league.stats.rank || '-'}`}</p>
                                 </div>
                              </div>
                              {activeLeague.id === league.id && <CheckCircle2 size={18} className="text-lime-500" />}
                           </button>
                        ))}
                      </div>
                  </div>
                )}
            </div>
            {/* Backdrop for menu */}
            {isLeagueMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsLeagueMenuOpen(false)}></div>}

          </div>
          
          {/* Top Actions based on Role */}
          <div className="flex gap-3 pt-2">
            {activeLeague.role === 'admin' ? (
                <>
                  <Button variant="outline" className="rounded-2xl border-slate-200 group text-slate-900 font-bold hover:bg-slate-100" onClick={() => setShowInviteModal(true)}>
                    <Share2 size={18} className="mr-2 group-hover:text-lime-600" /> INVITAR
                  </Button>
                  <Button variant="secondary" className="rounded-2xl font-black px-6 shadow-lg shadow-lime-400/20" onClick={() => setShowConfigModal(true)}>
                    <LayoutDashboard size={18} className="mr-2" /> GESTIONAR
                  </Button>
                </>
            ) : (
                <Button variant="secondary" className="rounded-2xl font-black px-8 shadow-lg shadow-lime-400/20 h-12 text-sm">
                   PRONOSTICAR <Zap size={18} className="ml-2" />
                </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: PRIMARY STATS (Dynamic based on Role) */}
        {activeLeague.role === 'admin' ? renderAdminStats() : renderUserStats()}

        {/* MIDDLE COLUMN: LEAGUE INFO (Shared) */}
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
              <Badge color="bg-slate-100 text-slate-600 font-bold">Bolsa: {activeLeague.stats.totalPrize}</Badge>
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

        {/* RIGHT COLUMN: MATCHES & RANKING */}
        <div className="space-y-8">
           
           {/* RANKING CARD */}
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
            <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 h-8">Ver Ranking Completo <ArrowUpRight size={12} className="ml-1"/></Button>
          </Card>

           {/* MATCHES */}
           <div className="space-y-6">
             <div className="flex justify-between items-center">
               <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Próximos Partidos</h3>
               <Clock size={14} className="text-slate-400" />
             </div>
             
             {matches.map((match) => (
               <Card key={match.id} className={`group hover:border-lime-400 transition-all duration-500 overflow-hidden relative border-slate-200 ${match.status === 'saved' ? 'border-lime-400 shadow-md' : ''}`}>
                  <div className="flex justify-between items-center mb-6">
                     <Badge color="bg-slate-100 text-slate-500 uppercase tracking-widest font-black text-[9px]">{match.date}</Badge>
                     {match.status === 'saved' ? (
                       <div className="flex items-center gap-1.5 bg-lime-100 px-2 py-1 rounded-lg">
                          <CheckCircle2 size={12} className="text-lime-600" />
                          <span className="text-[9px] font-black text-lime-700 uppercase tracking-widest">GUARDADO</span>
                       </div>
                     ) : (
                       <span className="text-[9px] font-black text-lime-600 uppercase tracking-widest animate-pulse">ACTIVO</span>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                     <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.homeFlag}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.homeTeam}</span>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        {activeLeague.role === 'admin' ? (
                            <span className="text-xs font-black bg-slate-100 px-3 py-1 rounded-lg text-slate-400">VS</span>
                        ) : (
                          <>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0" 
                              value={match.userPrediction.home}
                              onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                              className="w-10 h-10 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                            />
                            <span className="text-slate-300 font-bold">-</span>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0" 
                              value={match.userPrediction.away}
                              onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                              className="w-10 h-10 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none text-slate-900 placeholder:text-slate-300 transition-all" 
                            />
                          </>
                        )}
                     </div>
                     
                     <div className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-3xl block group-hover:scale-110 transition-transform filter drop-shadow-sm">{match.awayFlag}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest block text-slate-900 leading-tight">{match.awayTeam}</span>
                     </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                     {activeLeague.role === 'admin' ? (
                       <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
                          Gestionar Resultado <Settings size={12} />
                       </button>
                     ) : (
                       <button 
                         onClick={() => handleSavePrediction(match.id)}
                         disabled={match.status === 'saved' && (match.userPrediction.home === '' || match.userPrediction.away === '')}
                         className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-colors ${match.status === 'saved' ? 'text-lime-600 hover:text-lime-700' : 'text-slate-400 hover:text-lime-600'}`}
                       >
                          {match.status === 'saved' ? (
                             <>Modificar <Pencil size={12} /></>
                          ) : (
                             <>Guardar <CheckCircle2 size={12} /></>
                          )}
                       </button>
                     )}
                  </div>
               </Card>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Button, Badge, Input } from '../components/UI';
import { AppView } from '../types';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Clock,
  CheckCircle2,
  Shield,
  User,
  Save,
  Lock,
  Search,
  LayoutGrid,
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  Plus,
  Ticket,
  Users,
  Globe,
  Coins,
  ArrowRight,
  Gift,
  ListOrdered,
  GitMerge,
  ArrowUp,
  ArrowDown,
  Medal,
  BarChart3,
  Target
} from 'lucide-react';

interface PredictionsProps {
  onViewChange: (view: AppView) => void;
}

// Interfaces Locales
interface LeagueSummary {
  id: string;
  name: string;
  role: 'admin' | 'participant';
  rank: number;
  points: number;
  startDate: string;
  totalPlayers: number;
  avatar: string;
  color: string;
  plan: 'free' | 'gold' | 'diamond';
}

interface PublicLeague {
    id: string;
    name: string;
    members: number;
    maxMembers: number;
    entryFee: string; // "Gratis" or "$50.000"
    prizePool: string;
    tags: string[];
}

interface Invite {
    id: string;
    leagueName: string;
    inviterName: string;
    avatar: string;
    expiresIn: string;
}

type MatchStatus = 'open' | 'closed' | 'live' | 'finished';
type Phase = 'group' | 'knockout';
type Round = 'group' | '32' | '16' | '8' | '4' | '3rd' | 'final';

interface AISuggestion {
    label: string;
    type: 'safe' | 'risky' | 'ai';
    score: { home: number; away: number };
    probability: string;
}

interface MatchPrediction {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string; // ISO Date for sorting
  displayDate: string; 
  time: string;
  closeTime: string; // "Cierre en..." text
  status: MatchStatus;
  venue: string;
  city: string;
  phase: Phase;
  group?: string;
  round?: Round;
  prediction: { home: string; away: string };
  result?: { home: number; away: number };
  pointsEarned?: number;
  saved?: boolean;
  // Premium Stats Data
  analysis?: {
    winProb: { home: number, draw: number, away: number };
    insight: string;
    recentForm: { home: string[], away: string[] };
    formConclusion: string; // New field for form analysis text
    formBet: string; // New field for specific bet based on form
    suggestions: AISuggestion[];
  };
}

// New Interfaces for Simulator
interface GroupTeam {
    id: string;
    name: string;
    flag: string;
}

interface GroupData {
    name: string;
    teams: GroupTeam[];
}

// Mock Data
const MY_LEAGUES: LeagueSummary[] = [
  { id: '1', name: 'Los Cracks del Barrio', role: 'admin', rank: 1, points: 120, startDate: '2026-06-11T14:00:00', totalPlayers: 24, avatar: 'LC', color: 'bg-black text-white', plan: 'gold' },
  { id: '2', name: 'Oficina 2026', role: 'participant', rank: 12, points: 45, startDate: '2026-06-11T14:00:00', totalPlayers: 156, avatar: 'OF', color: 'bg-slate-200 text-slate-600', plan: 'free' },
];

const PENDING_INVITES: Invite[] = [
    { id: 'i1', leagueName: 'Familia Perez 2026', inviterName: 'Tío Jorge', avatar: 'https://picsum.photos/seed/jorge/40/40', expiresIn: '2 días' }
];

const PUBLIC_LEAGUES: PublicLeague[] = [
    { id: 'p1', name: 'Colombia Oficial', members: 1240, maxMembers: 5000, entryFee: 'Gratis', prizePool: 'Camiseta Selección', tags: ['Oficial', 'Premios Físicos'] },
    { id: 'p2', name: 'High Rollers VIP', members: 45, maxMembers: 100, entryFee: '$200.000', prizePool: '$18.000.000', tags: ['Alta Apuesta', 'Expertos'] },
    { id: 'p3', name: 'Cerveceros FC', members: 89, maxMembers: 200, entryFee: '$20.000', prizePool: '$1.500.000', tags: ['Casual', 'Amigos'] },
];

const MOCK_MATCHES: MatchPrediction[] = [
  {
    id: 'm1', homeTeam: 'México', awayTeam: 'Sudáfrica', homeFlag: '🇲🇽', awayFlag: '🇿🇦',
    date: '2026-06-11T14:00:00', displayDate: 'Jueves 11 Junio', time: '14:00', closeTime: '2 horas y 30 minutos',
    status: 'open', venue: 'Estadio Azteca', city: 'Ciudad de México',
    phase: 'group', group: 'A', round: 'group',
    prediction: { home: '', away: '' },
    analysis: {
        winProb: { home: 60, draw: 25, away: 15 },
        insight: "México es fuerte en el Azteca. Sudáfrica sufre en altura.",
        recentForm: { home: ['W','W','D','L','W'], away: ['L','D','L','W','L'] },
        formConclusion: "México domina en casa (3 de 5 ganados). Sudáfrica muestra debilidad defensiva como visitante.",
        formBet: "Local anota +1.5 Goles",
        suggestions: [
            { label: 'Segura', type: 'safe', score: { home: 2, away: 0 }, probability: '65%' },
            { label: 'IA Model', type: 'ai', score: { home: 3, away: 1 }, probability: '45%' },
            { label: 'Arriesgada', type: 'risky', score: { home: 1, away: 1 }, probability: '15%' }
        ]
    }
  },
  {
    id: 'm2', homeTeam: 'Corea del Sur', awayTeam: 'Dinamarca', homeFlag: '🇰🇷', awayFlag: '🇩🇰',
    date: '2026-06-11T21:00:00', displayDate: 'Jueves 11 Junio', time: '21:00', closeTime: '9 horas',
    status: 'open', venue: 'Estadio Akron', city: 'Guadalajara',
    phase: 'group', group: 'A', round: 'group',
    prediction: { home: '', away: '' },
    analysis: {
        winProb: { home: 30, draw: 30, away: 40 },
        insight: "Partido muy cerrado táctica y físicamente.",
        recentForm: { home: ['W','L','D','W','D'], away: ['W','W','W','L','D'] },
        formConclusion: "Ambos equipos vienen irregulares. Dinamarca tiende a empatar en climas cálidos.",
        formBet: "Empate o Baja 2.5",
        suggestions: [
            { label: 'Lógica', type: 'safe', score: { home: 0, away: 1 }, probability: '55%' },
            { label: 'IA Model', type: 'ai', score: { home: 1, away: 1 }, probability: '35%' },
            { label: 'Sorpresa', type: 'risky', score: { home: 2, away: 1 }, probability: '10%' }
        ]
    }
  },
  {
    id: 'm3', homeTeam: 'Canadá', awayTeam: 'Francia', homeFlag: '🇨🇦', awayFlag: '🇫🇷',
    date: '2026-06-12T16:00:00', displayDate: 'Viernes 12 Junio', time: '16:00', closeTime: '1 día',
    status: 'open', venue: 'BMO Field', city: 'Toronto',
    phase: 'group', group: 'B', round: 'group',
    prediction: { home: '', away: '' },
    analysis: {
        winProb: { home: 10, draw: 20, away: 70 },
        insight: "Francia es clara favorita, pero cuidado con el frío.",
        recentForm: { home: ['L','L','W','D','L'], away: ['W','W','W','W','W'] },
        formConclusion: "Francia viene imparable (5/5 victorias). Canadá sufre contra equipos top europeos.",
        formBet: "Visitante gana a cero",
        suggestions: [
            { label: 'Segura', type: 'safe', score: { home: 0, away: 3 }, probability: '80%' },
            { label: 'IA Model', type: 'ai', score: { home: 1, away: 3 }, probability: '60%' },
            { label: 'Golpe', type: 'risky', score: { home: 1, away: 1 }, probability: '5%' }
        ]
    }
  }
];

// Mock Group Data for Simulator
const INITIAL_GROUPS: GroupData[] = [
    { name: 'Grupo A', teams: [{ id: 'mx', name: 'México', flag: '🇲🇽' }, { id: 'za', name: 'Sudáfrica', flag: '🇿🇦' }, { id: 'kr', name: 'Corea Sur', flag: '🇰🇷' }, { id: 'dk', name: 'Dinamarca', flag: '🇩🇰' }] },
    { name: 'Grupo B', teams: [{ id: 'fr', name: 'Francia', flag: '🇫🇷' }, { id: 'ca', name: 'Canadá', flag: '🇨🇦' }, { id: 'ng', name: 'Nigeria', flag: '🇳🇬' }, { id: 'jp', name: 'Japón', flag: '🇯🇵' }] },
    { name: 'Grupo C', teams: [{ id: 'us', name: 'USA', flag: '🇺🇸' }, { id: 'gb', name: 'Inglaterra', flag: '🇬🇧' }, { id: 'ir', name: 'Irán', flag: '🇮🇷' }, { id: 'cl', name: 'Chile', flag: '🇨🇱' }] },
    { name: 'Grupo D', teams: [{ id: 'br', name: 'Brasil', flag: '🇧🇷' }, { id: 'co', name: 'Colombia', flag: '🇨🇴' }, { id: 'pl', name: 'Polonia', flag: '🇵🇱' }, { id: 'sa', name: 'Arabia S.', flag: '🇸🇦' }] },
];

const FormBadge: React.FC<{ result: string }> = ({ result }) => {
    const colors = {
        'W': 'bg-green-500 text-white border-green-600',
        'L': 'bg-rose-500 text-white border-rose-600',
        'D': 'bg-slate-400 text-white border-slate-500'
    };
    return (
        <span 
            title={result === 'W' ? 'Ganado' : result === 'L' ? 'Perdido' : 'Empate'}
            className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center shadow-sm border-b-2 ${colors[result as keyof typeof colors] || 'bg-slate-200'}`}
        >
            {result}
        </span>
    );
};

// Trend Indicator with Arrow
const TrendArrow: React.FC<{ efficiency: number }> = ({ efficiency }) => {
    return efficiency >= 50 
        ? <div className="flex flex-col items-center justify-center text-lime-500"><ArrowUp size={24} strokeWidth={3} /><span className="text-[7px] font-black uppercase tracking-wider">Sube</span></div>
        : <div className="flex flex-col items-center justify-center text-rose-500"><ArrowDown size={24} strokeWidth={3} /><span className="text-[7px] font-black uppercase tracking-wider">Baja</span></div>;
};

const calculatePerformance = (form: string[]) => {
    let points = 0;
    form.forEach(r => {
        if(r === 'W') points += 3;
        if(r === 'D') points += 1;
    });
    return Math.round((points / (form.length * 3)) * 100);
};

const Predictions: React.FC<PredictionsProps> = ({ onViewChange }) => {
  const [viewState, setViewState] = useState<'list' | 'detail'>('list');
  const [selectedLeague, setSelectedLeague] = useState<LeagueSummary | null>(null);
  
  // NEW: Prediction Mode State
  const [predictionMode, setPredictionMode] = useState<'matches' | 'simulator'>('matches');
  const [simulatorTab, setSimulatorTab] = useState<'groups' | 'bracket'>('groups');
  const [groups, setGroups] = useState<GroupData[]>(INITIAL_GROUPS);
  const [bracketWinners, setBracketWinners] = useState<Record<string, GroupTeam | null>>({});

  // Filters
  const [activePhase, setActivePhase] = useState<Phase>('group');
  const [activeGroup, setActiveGroup] = useState<string>('ALL'); 
  const [searchTeam, setSearchTeam] = useState('');
  
  // State
  const [matches, setMatches] = useState<MatchPrediction[]>(MOCK_MATCHES);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const nextMatchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewState === 'detail' && nextMatchRef.current) {
        setTimeout(() => {
            nextMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    }
  }, [viewState, activeGroup, activePhase, predictionMode]);

  const handleSelectLeague = (league: LeagueSummary) => {
    setSelectedLeague(league);
    setViewState('detail');
  };

  const handleBack = () => {
    setViewState('list');
    setSelectedLeague(null);
    setSearchTeam('');
    setActiveGroup('ALL');
    setPredictionMode('matches');
  };

  const handleScoreChange = (id: string, team: 'home' | 'away', value: string) => {
    if (value !== '' && !/^[0-9]+$/.test(value)) return;
    if (value.length > 2) return;

    setMatches(prev => prev.map(m => m.id === id ? {
      ...m,
      saved: false,
      prediction: { ...m.prediction, [team]: value }
    } : m));
  };

  const handleSavePrediction = (id: string) => {
    setIsSaving(id);
    setTimeout(() => {
        setMatches(prev => prev.map(m => m.id === id ? { ...m, saved: true } : m));
        setIsSaving(null);
    }, 600);
  };

  const applySuggestion = (matchId: string, score: { home: number, away: number }) => {
      handleScoreChange(matchId, 'home', score.home.toString());
      handleScoreChange(matchId, 'away', score.away.toString());
  };

  const moveTeam = (groupIndex: number, fromIndex: number, direction: 'up' | 'down') => {
      const newGroups = [...groups];
      const team = newGroups[groupIndex].teams[fromIndex];
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;

      if (toIndex >= 0 && toIndex < newGroups[groupIndex].teams.length) {
          newGroups[groupIndex].teams.splice(fromIndex, 1);
          newGroups[groupIndex].teams.splice(toIndex, 0, team);
          setGroups(newGroups);
      }
  };

  const handleBracketPick = (matchId: string, team: GroupTeam) => {
      setBracketWinners(prev => ({ ...prev, [matchId]: team }));
  };

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (searchTeam) {
        const lowerSearch = searchTeam.toLowerCase();
        result = result.filter(m => 
            m.homeTeam.toLowerCase().includes(lowerSearch) || 
            m.awayTeam.toLowerCase().includes(lowerSearch)
        );
    }
    result = result.filter(m => m.phase === activePhase);
    if (activePhase === 'group' && activeGroup !== 'ALL') {
        result = result.filter(m => m.group === activeGroup);
    }
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, activePhase, activeGroup, searchTeam]);

  const groupedMatches = useMemo(() => {
      const groups: Record<string, MatchPrediction[]> = {};
      filteredMatches.forEach(match => {
          if (!groups[match.displayDate]) {
              groups[match.displayDate] = [];
          }
          groups[match.displayDate].push(match);
      });
      return groups;
  }, [filteredMatches]);

  const nextMatchId = useMemo(() => {
      const openMatches = matches.filter(m => m.status === 'open').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return openMatches.length > 0 ? openMatches[0].id : null;
  }, [matches]);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* VIEW: LEAGUE LIST */}
      {viewState === 'list' && (
        <div className="space-y-10">
           {/* ... (Existing code for list view remains unchanged) ... */}
           <div className="flex justify-between items-end">
              <div>
                 <h1 className="text-3xl font-black font-brand uppercase tracking-tighter text-slate-900">MIS POLLAS</h1>
                 <p className="text-slate-500 font-medium text-sm">Gestiona tus ligas y acepta nuevas invitaciones.</p>
              </div>
           </div>

           {/* 1. INVITACIONES PENDIENTES */}
           {PENDING_INVITES.length > 0 && (
               <div className="space-y-4">
                   <div className="flex items-center gap-2">
                       <Ticket size={16} className="text-purple-600" />
                       <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Invitaciones Pendientes</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {PENDING_INVITES.map(invite => (
                           <div key={invite.id} className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-[2rem] flex items-center justify-between shadow-xl relative overflow-hidden group">
                               <div className="flex items-center gap-4 relative z-10">
                                   <div className="w-12 h-12 rounded-2xl border-2 border-white/20 overflow-hidden">
                                       <img src={invite.avatar} className="w-full h-full object-cover" alt="inviter" />
                                   </div>
                                   <div>
                                       <p className="text-sm font-black uppercase">{invite.leagueName}</p>
                                       <p className="text-xs text-slate-300">Invitado por <span className="text-lime-400 font-bold">{invite.inviterName}</span></p>
                                       <p className="text-[10px] text-slate-500 mt-1">Expira en {invite.expiresIn}</p>
                                   </div>
                               </div>
                               <Button onClick={() => onViewChange('join-league')} size="sm" variant="secondary" className="h-9 px-4 text-[10px] font-black uppercase relative z-10">
                                   Unirme
                               </Button>
                               {/* Decoración */}
                               <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-lime-400/20 rounded-full blur-2xl group-hover:bg-lime-400/30 transition-all"></div>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {/* 2. LIGAS ACTIVAS + CREAR */}
           <div className="space-y-4">
               <div className="flex items-center gap-2">
                   <Trophy size={16} className="text-lime-600" />
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Mis Ligas Activas</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Create New Card */}
                  <div 
                    onClick={() => onViewChange('create-league')}
                    className="border-2 border-dashed border-slate-300 rounded-[2rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-lime-500 hover:bg-lime-50/10 transition-all group min-h-[220px]"
                  >
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-lime-400 group-hover:text-black transition-all mb-4">
                          <Plus size={32} />
                      </div>
                      <h3 className="text-lg font-black font-brand uppercase text-slate-900 group-hover:text-lime-700">Crear Nueva Polla</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-[150px]">Organiza tu propia liga con amigos o compañeros.</p>
                  </div>

                  {/* Existing Leagues */}
                  {MY_LEAGUES.map(league => (
                     <div 
                        key={league.id} 
                        onClick={() => handleSelectLeague(league)}
                        className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden min-h-[220px] flex flex-col justify-between"
                     >
                        <div>
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black font-brand shadow-sm ${league.color}`}>
                                  {league.avatar}
                                </div>
                                <Badge color={league.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}>
                                  {league.role === 'admin' ? <Shield size={12} className="mr-1 text-lime-400" /> : <User size={12} className="mr-1" />}
                                  {league.role === 'admin' ? 'ADMIN' : 'JUGADOR'}
                                </Badge>
                            </div>
                            
                            <div className="space-y-1 mb-6 relative z-10">
                               <h3 className="text-xl font-black font-brand uppercase leading-tight text-slate-900 group-hover:text-lime-600 transition-colors truncate">{league.name}</h3>
                               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{league.totalPlayers} Participantes</p>
                            </div>
                        </div>

                        <div className="flex gap-4 border-t border-slate-100 pt-4 relative z-10">
                           <div className="flex-1">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">RANKING</p>
                              <p className="text-2xl font-black font-brand text-slate-900">#{league.rank}</p>
                           </div>
                           <div className="flex-1 border-l border-slate-100 pl-4">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">PUNTOS</p>
                              <p className="text-2xl font-black font-brand text-lime-600">{league.points}</p>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
           </div>

           {/* 3. EXPLORAR PÚBLICAS */}
           <div className="space-y-4 pt-4 border-t border-slate-200">
               <div className="flex justify-between items-end">
                   <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Globe size={16} className="text-blue-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Explorar Ligas Públicas</h3>
                        </div>
                        <p className="text-xs text-slate-400">Únete a ligas globales y compite por premios mayores.</p>
                   </div>
                   <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-slate-400">Ver Todas</Button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {PUBLIC_LEAGUES.map(league => (
                       <div key={league.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 hover:border-blue-300 hover:shadow-lg transition-all relative overflow-hidden group">
                           {/* Highlight Tag if Prize Pool is big */}
                           {league.tags.includes('Alta Apuesta') && (
                               <div className="absolute top-0 right-0 bg-amber-400 text-black text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                                   High Stakes
                               </div>
                           )}

                           <div className="flex justify-between items-start mb-4">
                               <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                   <Globe size={20} />
                               </div>
                               <Badge color="bg-slate-100 text-slate-600">{league.entryFee === 'Gratis' ? 'GRATIS' : `${league.entryFee}`}</Badge>
                           </div>

                           <h3 className="text-lg font-black font-brand uppercase text-slate-900 mb-2 truncate">{league.name}</h3>
                           
                           <div className="space-y-3 mb-6">
                               <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                   <Users size={14} />
                                   <span>{league.members} / {league.maxMembers} Jugadores</span>
                               </div>
                               <div className="flex items-center gap-2 text-xs font-bold text-lime-600">
                                   <Gift size={14} />
                                   <span>Bolsa: {league.prizePool}</span>
                               </div>
                           </div>

                           <Button onClick={() => onViewChange('join-league')} variant="outline" className="w-full rounded-xl text-xs font-black uppercase hover:bg-slate-900 hover:text-white border-slate-200">
                               Ver Detalles <ArrowRight size={14} className="ml-2" />
                           </Button>
                       </div>
                   ))}
               </div>
           </div>

        </div>
      )}

      {/* VIEW: LEAGUE DETAIL */}
      {viewState === 'detail' && selectedLeague && (
         <div className="space-y-6">
            
            {/* Header Sticky & Mode Switcher */}
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md py-4 border-b border-slate-200 -mx-4 px-4 md:mx-0 md:px-0 md:bg-transparent md:border-0 md:relative">
               <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                         <Button variant="outline" className="w-10 h-10 rounded-xl p-0 border-slate-200 text-slate-500" onClick={handleBack}>
                            <ArrowLeft size={20} />
                         </Button>
                         <div>
                            <h2 className="text-xl font-black font-brand uppercase tracking-tight text-slate-900 leading-none">{selectedLeague.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                               <Badge color={selectedLeague.role === 'admin' ? "bg-slate-900 text-white border border-slate-700" : "bg-blue-100 text-blue-700 border border-blue-200"}>
                                  {selectedLeague.role === 'admin' ? <Shield size={10} className="mr-1 inline"/> : <User size={10} className="mr-1 inline"/>}
                                  {selectedLeague.role.toUpperCase()}
                               </Badge>
                               <Badge color="bg-slate-200 text-slate-600 text-[9px] px-1.5 py-0.5">
                                  {new Date(selectedLeague.startDate).toLocaleDateString()}
                               </Badge>
                            </div>
                         </div>
                      </div>

                      {/* NEW: Prediction Mode Switcher */}
                      <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
                          <button 
                             onClick={() => setPredictionMode('matches')}
                             className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${predictionMode === 'matches' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                             <ListOrdered size={14} /> Partidos
                          </button>
                          <button 
                             onClick={() => setPredictionMode('simulator')}
                             className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${predictionMode === 'simulator' ? 'bg-lime-400 text-black shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                             <GitMerge size={14} /> Simulador
                          </button>
                      </div>
                  </div>

                  {/* MATCHES FILTERS */}
                  {predictionMode === 'matches' && (
                      <div className="flex flex-col md:flex-row gap-3 animate-in fade-in slide-in-from-top-2">
                         <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-full md:max-w-sm shadow-sm relative">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                               type="text" 
                               placeholder="Buscar equipo..." 
                               className="w-full pl-10 pr-4 py-1.5 rounded-lg text-xs font-bold outline-none bg-transparent placeholder:text-slate-400 text-slate-900"
                               value={searchTeam}
                               onChange={(e) => setSearchTeam(e.target.value)}
                            />
                         </div>
                         <div className="flex p-1 bg-slate-100 rounded-xl w-full md:max-w-sm">
                            <button 
                               onClick={() => setActivePhase('group')}
                               className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activePhase === 'group' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                            >
                               <LayoutGrid size={14} /> Grupos
                            </button>
                            <button 
                               onClick={() => setActivePhase('knockout')}
                               className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activePhase === 'knockout' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                            >
                               <Trophy size={14} /> Fases
                            </button>
                         </div>
                      </div>
                  )}

                  {/* SIMULATOR TABS */}
                  {predictionMode === 'simulator' && (
                      <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                          <button 
                             onClick={() => setSimulatorTab('groups')}
                             className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${simulatorTab === 'groups' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
                          >
                             Fase de Grupos
                          </button>
                          <button 
                             onClick={() => setSimulatorTab('bracket')}
                             className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${simulatorTab === 'bracket' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
                          >
                             Eliminatorias
                          </button>
                      </div>
                  )}

                  {/* Sub-Filters (Groups) */}
                  {predictionMode === 'matches' && activePhase === 'group' && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                          <button 
                             onClick={() => setActiveGroup('ALL')}
                             className={`min-w-[60px] h-8 rounded-xl text-[10px] font-black border transition-all ${activeGroup === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                          >
                             GENERAL
                          </button>
                          {['A','B','C','D','E','F','G','H'].map(g => (
                              <button 
                                 key={g}
                                 onClick={() => setActiveGroup(g)}
                                 className={`min-w-[40px] h-8 rounded-xl text-xs font-black border transition-all ${activeGroup === g ? 'bg-lime-400 text-black border-lime-400 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-lime-400'}`}
                              >
                                 {g}
                              </button>
                          ))}
                      </div>
                  )}
               </div>
            </div>

            {/* CONTENT AREA */}
            
            {/* 1. MATCHES LIST */}
            {predictionMode === 'matches' && (
                <div className="space-y-6">
                   {Object.keys(groupedMatches).length > 0 ? Object.entries(groupedMatches).map(([date, dayMatches]) => (
                      <div key={date} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                          {/* Date Header */}
                          <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center gap-3">
                              <Calendar size={14} className="text-slate-400" />
                              <span className="text-xs font-black uppercase text-slate-700 tracking-widest">{date}</span>
                          </div>

                          <div className="divide-y divide-slate-100">
                          {(dayMatches as MatchPrediction[]).map(match => {
                              const isNext = match.id === nextMatchId;
                              const isAnalysisOpen = expandedAnalysis === match.id;
                              const isSaved = match.saved;
                              
                              return (
                                 <div 
                                    key={match.id} 
                                    ref={isNext ? nextMatchRef : null}
                                    className={`transition-colors ${isNext ? 'bg-lime-50/20' : 'hover:bg-slate-50'} relative`}
                                 >
                                    {isNext && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-lime-400"></div>}
                                    
                                    {/* Main Row */}
                                    <div className="p-4 flex flex-col md:flex-row items-center gap-4">
                                       
                                       {/* Status & Time */}
                                       <div className="flex items-center justify-between w-full md:w-auto md:flex-col md:items-start gap-1 min-w-[90px]">
                                          <span className="text-xs font-black text-slate-900">{match.time}</span>
                                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                                             <Clock size={10} className="text-amber-500" />
                                             <span className="truncate max-w-[100px]" title={match.closeTime}>Cierre: {match.closeTime}</span>
                                          </div>
                                          <span className="text-[8px] font-black text-slate-300 uppercase hidden md:block truncate max-w-[90px]">{match.city}</span>
                                       </div>

                                       {/* Matchup Center */}
                                       <div className="flex-1 flex items-center justify-between gap-4 w-full">
                                           <div className="flex items-center gap-3 flex-1 justify-end">
                                              {/* Fixed Visibility: Force black text */}
                                              <span className="text-xs md:text-sm font-black uppercase text-slate-900 text-right leading-tight hidden sm:block">{match.homeTeam}</span>
                                              <span className="text-xs font-black uppercase text-slate-900 text-right leading-tight sm:hidden">{match.homeTeam.substring(0,3)}</span>
                                              {/* UPDATED: Larger Flag & Alignment */}
                                              <span className="text-4xl md:text-5xl transition-all drop-shadow-sm">{match.homeFlag}</span>
                                           </div>

                                           {/* Score Inputs (Numeric 0-9) */}
                                           <div className="flex items-center gap-2">
                                              <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                placeholder="-" 
                                                value={match.prediction.home} 
                                                onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)} 
                                                className="w-10 h-10 text-center text-xl font-black bg-slate-50 border border-slate-200 rounded-xl focus:border-lime-500 focus:ring-2 focus:ring-lime-100 outline-none text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 transition-all placeholder:text-slate-300"
                                                disabled={match.saved}
                                              />
                                              <span className="text-slate-300 font-bold text-xs">-</span>
                                              <input 
                                                type="text" 
                                                inputMode="numeric" 
                                                pattern="[0-9]*" 
                                                placeholder="-" 
                                                value={match.prediction.away} 
                                                onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)} 
                                                className="w-10 h-10 text-center text-xl font-black bg-slate-50 border border-slate-200 rounded-xl focus:border-lime-500 focus:ring-2 focus:ring-lime-100 outline-none text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 transition-all placeholder:text-slate-300"
                                                disabled={match.saved}
                                              />
                                           </div>

                                           <div className="flex items-center gap-3 flex-1 justify-start">
                                              {/* UPDATED: Larger Flag & Alignment */}
                                              <span className="text-4xl md:text-5xl transition-all drop-shadow-sm">{match.awayFlag}</span>
                                              {/* Fixed Visibility: Force black text */}
                                              <span className="text-xs md:text-sm font-black uppercase text-slate-900 text-left leading-tight hidden sm:block">{match.awayTeam}</span>
                                              <span className="text-xs font-black uppercase text-slate-900 text-left leading-tight sm:hidden">{match.awayTeam.substring(0,3)}</span>
                                           </div>
                                       </div>

                                       {/* Actions Right */}
                                       <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                          {/* Premium AI Analysis Button */}
                                          <button 
                                            onClick={() => setExpandedAnalysis(isAnalysisOpen ? null : match.id)}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isAnalysisOpen ? 'bg-purple-100 text-purple-600 ring-2 ring-purple-200' : 'bg-slate-50 text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`}
                                            title="Smart Insights & Sugerencias"
                                            disabled={match.saved}
                                          >
                                             <Brain size={18} />
                                          </button>

                                          {/* Save Button (Toggle State) */}
                                          <Button 
                                            size="sm" 
                                            variant={isSaved ? "outline" : "secondary"} 
                                            onClick={() => isSaved ? setMatches(prev => prev.map(m => m.id === match.id ? { ...m, saved: false } : m)) : handleSavePrediction(match.id)}
                                            disabled={!match.prediction.home || !match.prediction.away || isSaving === match.id}
                                            isLoading={isSaving === match.id}
                                            className={`h-10 w-10 p-0 flex items-center justify-center rounded-xl transition-all ${isSaved ? 'bg-white border-lime-500 text-lime-600 hover:bg-lime-50' : 'shadow-md shadow-lime-400/20'}`}
                                            title={isSaved ? "Modificar" : "Guardar"}
                                          >
                                            {isSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                                          </Button>
                                       </div>
                                    </div>

                                    {/* PREMIUM ANALYSIS DRAWER */}
                                    {isAnalysisOpen && match.analysis && !match.saved && (
                                        <div className="bg-slate-50 border-t border-slate-100 p-4 sm:p-6 animate-in slide-in-from-top-2">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Sparkles size={16} className="text-purple-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">SMART INSIGHTS • IA POWERED</span>
                                                {selectedLeague.plan === 'free' && <Badge color="bg-slate-200 text-slate-500 text-[8px] ml-auto">PREMIUM ONLY</Badge>}
                                            </div>
                                            
                                            {selectedLeague.plan !== 'free' ? (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Win Probability Bar */}
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                                <span>{match.homeTeam}</span>
                                                                <span>Empate</span>
                                                                <span>{match.awayTeam}</span>
                                                            </div>
                                                            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                                                                <div className="bg-slate-900 h-full" style={{width: `${match.analysis.winProb.home}%`}}></div>
                                                                <div className="bg-slate-400 h-full" style={{width: `${match.analysis.winProb.draw}%`}}></div>
                                                                <div className="bg-lime-400 h-full" style={{width: `${match.analysis.winProb.away}%`}}></div>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-slate-500 bg-white p-2 rounded-lg border border-slate-200 leading-tight">
                                                                <Zap size={12} className="inline mr-1 text-amber-500"/>
                                                                "{match.analysis.insight}"
                                                            </p>
                                                        </div>

                                                        {/* 3 AI SUGGESTIONS (One-Click Apply) */}
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Sugerencias Automáticas</p>
                                                            <div className="flex gap-2">
                                                                {match.analysis.suggestions.map((sug, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => applySuggestion(match.id, sug.score)}
                                                                        className={`flex-1 p-2 rounded-xl border flex flex-col items-center gap-1 transition-all hover:shadow-md active:scale-95 ${
                                                                            sug.type === 'safe' ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :
                                                                            sug.type === 'ai' ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' :
                                                                            'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                        }`}
                                                                    >
                                                                        <span className="text-[9px] font-black uppercase tracking-wider">{sug.label}</span>
                                                                        <span className="text-lg font-black">{sug.score.home}-{sug.score.away}</span>
                                                                        <span className="text-[9px] font-bold opacity-70">{sug.probability} Prob.</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* NEW SECTION: Advanced Form Analysis (REDESIGNED) */}
                                                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                               <BarChart3 size={16} className="text-slate-400"/>
                                                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">ANÁLISIS DE RACHA (ÚLTIMOS 5)</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Tendencia</span>
                                                        </div>
                                                        
                                                        <div className="p-4 flex flex-col md:flex-row items-center gap-4 md:gap-8">
                                                            {/* Home Form (Left on Desktop, Top on Mobile) */}
                                                            <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-3 w-full md:w-auto">
                                                                <div className="flex flex-col items-start md:items-center gap-1">
                                                                    <span className="text-xs font-black uppercase text-slate-900">{match.homeTeam}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">{calculatePerformance(match.analysis.recentForm.home)}% Eficacia</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex gap-1">
                                                                        {match.analysis.recentForm.home.map((r, idx) => <FormBadge key={idx} result={r} />)}
                                                                    </div>
                                                                    <TrendArrow efficiency={calculatePerformance(match.analysis.recentForm.home)} />
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Insight Box (Center on Desktop, Bottom on Mobile) */}
                                                            <div className="w-full md:flex-1 order-last md:order-none bg-blue-50 border border-blue-100 rounded-xl p-3 relative overflow-hidden flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 relative z-10">
                                                                    <Target size={18} />
                                                                </div>
                                                                <div className="space-y-1 relative z-10">
                                                                    <p className="text-[10px] font-bold text-blue-800 leading-tight">
                                                                        "{match.analysis.formConclusion}"
                                                                    </p>
                                                                    <p className="text-xs font-black text-blue-900 uppercase">
                                                                        OPCIÓN INTELIGENTE: {match.analysis.formBet}
                                                                    </p>
                                                                </div>
                                                                {/* Decoration */}
                                                                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-200/50 rounded-full blur-xl"></div>
                                                            </div>

                                                            {/* Away Form (Right on Desktop, Middle on Mobile) */}
                                                            <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-3 w-full md:w-auto text-right">
                                                                <div className="flex items-center gap-2 order-2 md:order-2">
                                                                    <TrendArrow efficiency={calculatePerformance(match.analysis.recentForm.away)} />
                                                                    <div className="flex gap-1">
                                                                        {match.analysis.recentForm.away.map((r, idx) => <FormBadge key={idx} result={r} />)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end md:items-center gap-1 order-1 md:order-1">
                                                                    <span className="text-xs font-black uppercase text-slate-900">{match.awayTeam}</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">{calculatePerformance(match.analysis.recentForm.away)}% Eficacia</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6">
                                                    <Lock size={24} className="text-slate-300 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-slate-500 mb-4">Mejora tu plan para ver predicciones avanzadas.</p>
                                                    <Button variant="secondary" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => onViewChange('checkout')}>Obtener Premium</Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                 </div>
                              );
                          })}
                          </div>
                      </div>
                   )) : (
                      <div className="text-center py-16 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                         <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                            <Trophy size={24} className="text-slate-300" />
                         </div>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay partidos con estos filtros.</p>
                         <Button variant="ghost" size="sm" onClick={() => {setActiveGroup('ALL'); setSearchTeam('')}} className="mt-2 text-[10px] font-black">Limpiar Filtros</Button>
                      </div>
                   )}
                </div>
            )}

            {/* 2. SIMULATOR: GROUPS */}
            {predictionMode === 'simulator' && simulatorTab === 'groups' && (
                <div className="space-y-6">
                    <p className="text-xs text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <ListOrdered size={14} className="inline mr-2 text-lime-600"/>
                        Ordena los equipos para predecir la tabla final. Los dos primeros clasifican.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {groups.map((group, gIdx) => (
                            <div key={group.name} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase text-slate-700 tracking-widest">{group.name}</span>
                                    <div className="flex gap-2">
                                        <Badge color="bg-green-100 text-green-700 border border-green-200 text-[8px]">CL</Badge>
                                        <Badge color="bg-green-100 text-green-700 border border-green-200 text-[8px]">CL</Badge>
                                    </div>
                                </div>
                                <div>
                                    {group.teams.map((team, tIdx) => (
                                        <div key={team.id} className={`flex items-center justify-between p-3 px-6 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${tIdx < 2 ? 'bg-green-50/30' : ''}`}>
                                            <div className="flex items-center gap-4">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-black ${tIdx < 2 ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{tIdx + 1}</span>
                                                <span className="text-2xl">{team.flag}</span>
                                                <span className={`text-xs font-bold uppercase ${tIdx < 2 ? 'text-slate-900' : 'text-slate-500'}`}>{team.name}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {tIdx > 0 && <button onClick={() => moveTeam(gIdx, tIdx, 'up')} className="text-slate-400 hover:text-lime-600"><ArrowUp size={14} /></button>}
                                                {tIdx < 3 && <button onClick={() => moveTeam(gIdx, tIdx, 'down')} className="text-slate-400 hover:text-rose-500"><ArrowDown size={14} /></button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. SIMULATOR: BRACKET */}
            {predictionMode === 'simulator' && simulatorTab === 'bracket' && (
                <div className="space-y-6">
                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] text-center space-y-2">
                        <Medal size={32} className="text-lime-400 mx-auto" />
                        <h3 className="text-xl font-black font-brand uppercase tracking-widest">CAMINO A LA GLORIA</h3>
                        <p className="text-xs text-slate-400">Selecciona el ganador de cada llave para avanzar.</p>
                    </div>
                    
                    <div className="space-y-8">
                        {/* Round of 16 Demo */}
                        <div className="relative">
                            <h4 className="text-center text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">OCTAVOS DE FINAL</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative">
                                        <div className="space-y-2">
                                            {[{id: 't1', name: 'Brasil', flag: '🇧🇷'}, {id: 't2', name: 'Portugal', flag: '🇵🇹'}].map(team => {
                                                const isSelected = bracketWinners[`match-${i}`]?.id === team.id;
                                                return (
                                                    <button 
                                                        key={team.id}
                                                        onClick={() => handleBracketPick(`match-${i}`, team)}
                                                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all ${isSelected ? 'bg-lime-400 text-black shadow-md' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xl">{team.flag}</span>
                                                            <span className="text-xs font-black uppercase">{team.name}</span>
                                                        </div>
                                                        {isSelected && <CheckCircle2 size={16} />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {/* Connector Line Visual Mock */}
                                        <div className="absolute top-1/2 -right-4 w-4 h-0.5 bg-slate-300 hidden md:block"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

         </div>
      )}
    </div>
  );
};

export default Predictions;

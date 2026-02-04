
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Button, Badge, Input } from '../components/UI';
import { AppView } from '../types';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  Shield,
  User,
  Filter,
  Save,
  AlertCircle,
  TrendingUp,
  Lock,
  Medal,
  MapPin,
  ChevronDown,
  Search,
  Timer,
  Flag,
  LayoutGrid
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
  startDate: string; // ISO Date
  totalPlayers: number;
  avatar: string;
  color: string;
}

type MatchStatus = 'open' | 'closed' | 'live' | 'finished';
type Phase = 'group' | 'knockout';
type Round = 'group' | '32' | '16' | '8' | '4' | '3rd' | 'final';

interface MatchPrediction {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string; // ISO Date for sorting
  displayDate: string; // "Jueves 11 Junio 2026"
  time: string;
  status: MatchStatus;
  venue: string;
  city: string;
  phase: Phase;
  group?: string; // "A", "B", etc.
  round?: Round;
  prediction: { home: string; away: string };
  result?: { home: number; away: number };
  pointsEarned?: number;
  saved?: boolean;
}

// Mock Data - Realista Mundial 2026
const MY_LEAGUES: LeagueSummary[] = [
  { id: '1', name: 'Los Cracks del Barrio', role: 'admin', rank: 1, points: 120, startDate: '2026-06-11T14:00:00', totalPlayers: 24, avatar: 'LC', color: 'bg-black text-white' },
  { id: '2', name: 'Oficina 2026', role: 'participant', rank: 12, points: 45, startDate: '2026-06-11T14:00:00', totalPlayers: 156, avatar: 'OF', color: 'bg-slate-200 text-slate-600' },
];

// Fechas simuladas para que el countdown funcione (Asumimos fecha actual antes del mundial)
const MOCK_MATCHES: MatchPrediction[] = [
  // GRUPO A - Inaugural
  {
    id: 'm1', homeTeam: 'México', awayTeam: 'Sudáfrica', homeFlag: '🇲🇽', awayFlag: '🇿🇦',
    date: '2026-06-11T14:00:00', displayDate: 'Jueves 11 Junio', time: '14:00',
    status: 'open', venue: 'Estadio Azteca', city: 'Ciudad de México',
    phase: 'group', group: 'A', round: 'group',
    prediction: { home: '', away: '' }
  },
  {
    id: 'm2', homeTeam: 'Corea del Sur', awayTeam: 'Dinamarca', homeFlag: '🇰🇷', awayFlag: '🇩🇰',
    date: '2026-06-11T21:00:00', displayDate: 'Jueves 11 Junio', time: '21:00',
    status: 'open', venue: 'Estadio Akron', city: 'Guadalajara',
    phase: 'group', group: 'A', round: 'group',
    prediction: { home: '', away: '' }
  },
  // GRUPO B
  {
    id: 'm3', homeTeam: 'Canadá', awayTeam: 'Francia', homeFlag: '🇨🇦', awayFlag: '🇫🇷',
    date: '2026-06-12T16:00:00', displayDate: 'Viernes 12 Junio', time: '16:00',
    status: 'open', venue: 'BMO Field', city: 'Toronto',
    phase: 'group', group: 'B', round: 'group',
    prediction: { home: '', away: '' }
  },
  {
    id: 'm4', homeTeam: 'España', awayTeam: 'Marruecos', homeFlag: '🇪🇸', awayFlag: '🇲🇦',
    date: '2026-06-12T19:00:00', displayDate: 'Viernes 12 Junio', time: '19:00',
    status: 'open', venue: 'BC Place', city: 'Vancouver',
    phase: 'group', group: 'B', round: 'group',
    prediction: { home: '', away: '' }
  },
  // Partidos Pasados (Simulados)
  {
    id: 'm0', homeTeam: 'Amistoso', awayTeam: 'Prueba', homeFlag: '🏳️', awayFlag: '🏴',
    date: '2026-06-01T10:00:00', displayDate: 'Previo', time: '10:00',
    status: 'finished', venue: 'Training Ground', city: 'Miami',
    phase: 'group', group: 'A', round: 'group',
    prediction: { home: '1', away: '1' },
    result: { home: 2, away: 1 },
    pointsEarned: 0,
    saved: true
  }
];

const CountdownTimer: React.FC<{ targetDate: string, small?: boolean }> = ({ targetDate, small }) => {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, mins: number, secs: number} | null>(null);

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - new Date().getTime(); // Usar fecha real
      // Para demo visual, si la fecha ya pasó, mostraremos 0 o algo estático, o usaremos una fecha futura relativa
      // Hack para demo: Asumimos que targetDate es futuro para ver el contador
      // const diff = new Date(targetDate).getTime() - (new Date().getTime() - 10000000000); 
      
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          mins: Math.floor((diff / 1000 / 60) % 60),
          secs: Math.floor((diff / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
      }
    };
    calculate();
    const interval = setInterval(calculate, 60000); // Actualizar cada minuto para performance
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  if (small) {
    return (
      <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
        <Clock size={10} />
        <span>FALTAN {timeLeft.days}D {timeLeft.hours}H</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-center">
      {Object.entries(timeLeft).map(([label, val]) => (
         label !== 'secs' && (
          <div key={label} className="flex flex-col p-2 bg-slate-900/50 backdrop-blur-sm rounded-lg min-w-[50px] border border-white/10">
            <span className="text-xl font-black font-brand text-white leading-none">{val}</span>
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">{label === 'mins' ? 'min' : label === 'days' ? 'días' : 'hrs'}</span>
          </div>
         )
      ))}
    </div>
  );
};

const Predictions: React.FC<PredictionsProps> = ({ onViewChange }) => {
  const [viewState, setViewState] = useState<'list' | 'detail'>('list');
  const [selectedLeague, setSelectedLeague] = useState<LeagueSummary | null>(null);
  
  // New Filter States
  const [activePhase, setActivePhase] = useState<Phase>('group');
  const [activeGroup, setActiveGroup] = useState<string>('ALL'); // 'ALL' or 'A', 'B'...
  const [activeRound, setActiveRound] = useState<Round>('32');
  const [searchTeam, setSearchTeam] = useState('');
  
  const [matches, setMatches] = useState<MatchPrediction[]>(MOCK_MATCHES);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const nextMatchRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to next match on load
  useEffect(() => {
    if (viewState === 'detail' && nextMatchRef.current) {
        setTimeout(() => {
            nextMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 500);
    }
  }, [viewState, activeGroup, activePhase]);

  const handleSelectLeague = (league: LeagueSummary) => {
    setSelectedLeague(league);
    setViewState('detail');
  };

  const handleBack = () => {
    setViewState('list');
    setSelectedLeague(null);
    setSearchTeam('');
    setActiveGroup('ALL');
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
    }, 800);
  };

  // Logic: 1. Search Text -> 2. Phase -> 3. Group/Round
  const filteredMatches = useMemo(() => {
    let result = matches;

    // 1. Text Search (Team Name)
    if (searchTeam) {
        const lowerSearch = searchTeam.toLowerCase();
        result = result.filter(m => 
            m.homeTeam.toLowerCase().includes(lowerSearch) || 
            m.awayTeam.toLowerCase().includes(lowerSearch)
        );
    }

    // 2. Phase Filter
    result = result.filter(m => m.phase === activePhase);

    // 3. Sub-Filters
    if (activePhase === 'group' && activeGroup !== 'ALL') {
        result = result.filter(m => m.group === activeGroup);
    } else if (activePhase === 'knockout') {
        // Mock logic for rounds, in real app check m.round
        // result = result.filter(m => m.round === activeRound);
    }

    // 4. Sort by Date
    return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, activePhase, activeGroup, activeRound, searchTeam]);

  // Group Matches by Date for Display
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

  // Determine the next match to highlight/scroll to
  const nextMatchId = useMemo(() => {
      const openMatches = matches.filter(m => m.status === 'open').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return openMatches.length > 0 ? openMatches[0].id : null;
  }, [matches]);

  const getPointsColor = (points: number) => {
      if (points === 5) return 'bg-lime-400 text-black shadow-lg shadow-lime-400/30';
      if (points > 0) return 'bg-yellow-400 text-black';
      return 'bg-slate-200 text-slate-500';
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* VISTA: LISTA DE LIGAS */}
      {viewState === 'list' && (
        <div className="space-y-8">
           <div className="flex justify-between items-center">
              <div>
                 <h1 className="text-3xl font-black font-brand uppercase tracking-tighter text-slate-900">MIS POLLAS</h1>
                 <p className="text-slate-500 font-medium text-sm">Selecciona una liga para pronosticar.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onViewChange('join-league')} className="h-9 px-4 border-slate-200 text-slate-600 uppercase text-[10px] font-black">
                 <Trophy size={14} className="mr-2" /> Unirme
              </Button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MY_LEAGUES.map(league => (
                 <div 
                    key={league.id} 
                    onClick={() => handleSelectLeague(league)}
                    className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                 >
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
                       <h3 className="text-xl font-black font-brand uppercase leading-tight group-hover:text-lime-600 transition-colors">{league.name}</h3>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{league.totalPlayers} Participantes</p>
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

                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                       <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg">
                          <ChevronRight size={20} />
                       </div>
                    </div>
                 </div>
              ))}
              
              <button 
                onClick={() => onViewChange('create-league')}
                className="border-2 border-dashed border-slate-200 rounded-[2rem] p-6 flex flex-col items-center justify-center text-slate-400 hover:border-lime-400 hover:text-lime-600 hover:bg-lime-50/10 transition-all gap-3 min-h-[240px]"
              >
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Trophy size={32} />
                 </div>
                 <span className="font-black uppercase text-xs tracking-widest">Crear Nueva Liga</span>
              </button>
           </div>
        </div>
      )}

      {/* VISTA: DETALLE DE PARTIDOS (ESTILO FIFA MEJORADO) */}
      {viewState === 'detail' && selectedLeague && (
         <div className="space-y-6">
            
            {/* Countdown Hero */}
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                     <Badge color="bg-lime-400 text-black border-0">COPA MUNDIAL 2026</Badge>
                     <h2 className="text-3xl font-black font-brand uppercase tracking-tight">INICIO DE LA LIGA</h2>
                     <p className="text-slate-400 text-xs font-medium max-w-xs">Prepárate para demostrar tus conocimientos. El primer partido está por comenzar.</p>
                  </div>
                  <div className="flex-shrink-0">
                     <CountdownTimer targetDate={selectedLeague.startDate} />
                  </div>
               </div>
               {/* Background Pattern */}
               <div className="absolute top-0 right-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
               <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-lime-500/20 rounded-full blur-3xl"></div>
            </div>

            {/* Header Sticky & Filters */}
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md py-4 border-b border-slate-200 -mx-4 px-4 md:mx-0 md:px-0 md:bg-transparent md:border-0 md:relative">
               <div className="flex flex-col gap-4">
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
                              INICIA: {new Date(selectedLeague.startDate).toLocaleDateString()}
                           </Badge>
                           <Badge color="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5">
                              #{selectedLeague.rank} • {selectedLeague.points} PTS
                           </Badge>
                        </div>
                     </div>
                  </div>

                  {/* Level 1: Team Search & Phase Filter */}
                  <div className="flex flex-col md:flex-row gap-3">
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
                           <LayoutGrid size={14} /> Fase de Grupos
                        </button>
                        <button 
                           onClick={() => setActivePhase('knockout')}
                           className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activePhase === 'knockout' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                        >
                           <Trophy size={14} /> Fase Final
                        </button>
                     </div>
                  </div>

                  {/* Level 2: Sub-Filters (Groups or Rounds) */}
                  {activePhase === 'group' ? (
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
                  ) : (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                          {[
                              {id: '32', label: '16avos'},
                              {id: '16', label: 'Octavos'},
                              {id: '8', label: 'Cuartos'},
                              {id: '4', label: 'Semis'},
                              {id: 'final', label: 'Final'}
                          ].map(r => (
                              <button 
                                 key={r.id}
                                 onClick={() => setActiveRound(r.id as Round)}
                                 className={`px-4 h-8 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${activeRound === r.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                              >
                                 {r.label}
                              </button>
                          ))}
                      </div>
                  )}
               </div>
            </div>

            {/* Lista de Partidos Agrupada */}
            <div className="space-y-8">
               {Object.keys(groupedMatches).length > 0 ? Object.entries(groupedMatches).map(([date, dayMatches]) => (
                  <div key={date} className="space-y-4">
                      {/* Date Header Sticky Style */}
                      <div className="flex items-center gap-4 sticky top-[180px] md:static z-20 bg-slate-50/90 backdrop-blur py-2">
                          <div className="h-px bg-slate-200 flex-1"></div>
                          <div className="bg-slate-200 text-slate-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                             {date}
                          </div>
                          <div className="h-px bg-slate-200 flex-1"></div>
                      </div>

                      {dayMatches.map(match => {
                          const isClosed = match.status === 'closed' || match.status === 'finished' || match.status === 'live';
                          const isLive = match.status === 'live';
                          const isFinished = match.status === 'finished';
                          const isNext = match.id === nextMatchId;
                          
                          return (
                             <Card 
                                key={match.id} 
                                // Ref para auto-scroll al siguiente partido
                                ref={isNext ? nextMatchRef : null}
                                className={`overflow-hidden border-2 transition-all p-0 relative ${isNext ? 'ring-2 ring-lime-400 shadow-xl shadow-lime-400/10' : ''} ${isLive ? 'border-lime-400 shadow-lg shadow-lime-400/10' : 'border-slate-100 hover:border-slate-300'}`}
                             >
                                {/* Match Context Header */}
                                <div className="flex justify-between items-center bg-slate-50/50 px-5 py-3 border-b border-slate-100">
                                   <div className="flex items-center gap-2">
                                      {isNext && (
                                          <Badge color="bg-lime-400 text-black border-0 animate-pulse shadow-sm shadow-lime-400/50">PRÓXIMO</Badge>
                                      )}
                                      <div className="flex flex-col">
                                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                             <span>{match.phase === 'group' ? 'Primera Fase' : 'Eliminatorias'}</span>
                                             <span className="text-slate-300">•</span>
                                             <span>{match.phase === 'group' ? `Grupo ${match.group}` : 'Ronda Final'}</span>
                                          </div>
                                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5">
                                             <MapPin size={10} /> {match.city} • {match.venue}
                                          </div>
                                      </div>
                                   </div>
                                   <div className="text-right flex items-center gap-2">
                                       {!isClosed && !isFinished && (
                                          <CountdownTimer targetDate={match.date} small />
                                       )}
                                       {isLive ? (
                                          <Badge color="bg-red-500 text-white animate-pulse border-0">EN JUEGO</Badge>
                                       ) : (
                                          <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-lg">{match.time}</span>
                                       )}
                                   </div>
                                </div>

                                <div className="p-5">
                                    <div className="flex items-center justify-between gap-4">
                                       
                                       {/* Home Team */}
                                       <div className="flex items-center gap-3 flex-1 justify-end text-right">
                                          <span className="text-xs md:text-sm font-black uppercase text-slate-900 leading-tight hidden md:block">{match.homeTeam}</span>
                                          <span className="text-xs font-black uppercase text-slate-900 leading-tight md:hidden">{match.homeTeam.substring(0,3)}</span>
                                          <span className="text-4xl filter drop-shadow-sm">{match.homeFlag}</span>
                                       </div>

                                       {/* Score Inputs / Display */}
                                       <div className="flex flex-col items-center gap-2 shrink-0">
                                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                             {isClosed ? (
                                                <>
                                                   <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl font-black ${isLive || isFinished ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                      {match.prediction.home}
                                                   </div>
                                                   <span className="text-slate-300 font-bold text-xs">-</span>
                                                   <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl font-black ${isLive || isFinished ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                      {match.prediction.away}
                                                   </div>
                                                </>
                                             ) : (
                                                <>
                                                   <input 
                                                      type="text" 
                                                      inputMode="numeric" 
                                                      pattern="[0-9]*"
                                                      placeholder="-" 
                                                      value={match.prediction.home}
                                                      onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                                                      className="w-10 h-10 text-center text-xl font-black bg-white border-2 border-slate-200 rounded-xl focus:border-lime-500 focus:ring-4 focus:ring-lime-100 outline-none transition-all placeholder:text-slate-200 text-slate-900"
                                                   />
                                                   <span className="text-slate-300 font-bold text-xs">-</span>
                                                   <input 
                                                      type="text" 
                                                      inputMode="numeric" 
                                                      pattern="[0-9]*"
                                                      placeholder="-" 
                                                      value={match.prediction.away}
                                                      onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                                                      className="w-10 h-10 text-center text-xl font-black bg-white border-2 border-slate-200 rounded-xl focus:border-lime-500 focus:ring-4 focus:ring-lime-100 outline-none transition-all placeholder:text-slate-200 text-slate-900"
                                                   />
                                                </>
                                             )}
                                          </div>
                                       </div>

                                       {/* Away Team */}
                                       <div className="flex items-center gap-3 flex-1 justify-start">
                                          <span className="text-4xl filter drop-shadow-sm">{match.awayFlag}</span>
                                          <span className="text-xs md:text-sm font-black uppercase text-slate-900 leading-tight hidden md:block">{match.awayTeam}</span>
                                          <span className="text-xs font-black uppercase text-slate-900 leading-tight md:hidden">{match.awayTeam.substring(0,3)}</span>
                                       </div>
                                    </div>

                                    {/* Real Result Overlay */}
                                    {(isLive || isFinished) && match.result && (
                                       <div className="mt-4 flex justify-center">
                                          <div className="bg-slate-100 px-4 py-1.5 rounded-full flex items-center gap-3 border border-slate-200">
                                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">MARCADOR REAL</span>
                                             <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-900">{match.result.home}</span>
                                                <span className="text-slate-400 text-xs">-</span>
                                                <span className="font-bold text-sm text-slate-900">{match.result.away}</span>
                                             </div>
                                          </div>
                                       </div>
                                    )}

                                    {/* Footer Actions / Stats */}
                                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                                       {!isClosed ? (
                                          <div className="w-full flex justify-end">
                                             <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                onClick={() => handleSavePrediction(match.id)}
                                                disabled={!match.prediction.home || !match.prediction.away || match.saved || isSaving === match.id}
                                                isLoading={isSaving === match.id}
                                                className={`h-8 text-[9px] font-black uppercase tracking-widest px-4 ${match.saved ? 'bg-slate-100 text-slate-400 shadow-none' : 'shadow-lg shadow-lime-400/20'}`}
                                             >
                                                {match.saved ? <><CheckCircle2 size={12} className="mr-1" /> Pronóstico Guardado</> : <><Save size={12} className="mr-1" /> Guardar Pronóstico</>}
                                             </Button>
                                          </div>
                                       ) : (
                                          <div className="w-full flex justify-between items-center">
                                             <div className="flex items-center gap-1 text-slate-400">
                                                <Lock size={12} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest">PRONÓSTICO CERRADO</span>
                                             </div>
                                             {isFinished && match.pointsEarned !== undefined && (
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${getPointsColor(match.pointsEarned)}`}>
                                                   <Medal size={12} />
                                                   <span className="text-[10px] font-black">+{match.pointsEarned} PTS</span>
                                                </div>
                                             )}
                                          </div>
                                       )}
                                    </div>
                                </div>
                             </Card>
                          );
                      })}
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
         </div>
      )}
    </div>
  );
};

export default Predictions;

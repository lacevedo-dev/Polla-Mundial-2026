
import React from 'react';
import { Button, Card, Badge, Input, Checkbox } from '../components/UI';
import { AppView, PrizeWinner, StageType, LeagueData } from '../types';
import { 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Coins, 
  Calendar,
  ShieldCheck,
  Trophy, 
  Zap, 
  Globe, 
  Camera, 
  PieChart, 
  Lock, 
  Sparkles, 
  Award, 
  UserPlus,
  Users,
  Search,
  X,
  Mail,
  Phone,
  Eye,
  Info,
  CheckCircle2,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface CreateLeagueProps {
  onViewChange: (view: AppView) => void;
}

interface InvitedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'existing' | 'new';
  avatar?: string;
}

const MINOR_WORDS = ['de', 'la', 'del', 'el', 'los', 'las', 'y', 'en', 'por', 'con', 'a', 'para', 'o', 'u', 'e'];

const formatSpanishTitleCase = (str: string) => {
  if (!str) return '';
  const words = str.split(' ');
  return words
    .map((word, index) => {
      if (!word) return '';
      const lowerWord = word.toLowerCase();
      if (index === 0 || !MINOR_WORDS.includes(lowerWord)) {
        return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
      }
      return lowerWord;
    })
    .join(' ');
};

const getInitialDistribution = (winnersCount: number, adminFee: number): PrizeWinner[] => {
  const prizes: PrizeWinner[] = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    label: `${i + 1}º PUESTO`,
    percentage: 0,
    active: false
  }));

  const netPool = 100 - adminFee;
  
  const templates: Record<number, number[]> = {
    1: [100],
    2: [60, 40],
    3: [50, 30, 20],
    4: [40, 30, 20, 10],
    5: [35, 25, 20, 10, 10],
    6: [30, 20, 15, 15, 10, 10],
    7: [25, 20, 15, 10, 10, 10, 10],
    8: [20, 15, 15, 10, 10, 10, 10, 10],
    9: [20, 15, 10, 10, 10, 10, 10, 10, 5],
    10: [15, 15, 10, 10, 10, 10, 10, 10, 5, 5]
  };

  const weights = templates[winnersCount] || Array(winnersCount).fill(100 / winnersCount);
  let currentSum = 0;

  for (let i = 0; i < winnersCount; i++) {
    prizes[i].active = true;
    let val = Math.round((netPool * (weights[i] / 100)) / 5) * 5;
    if (i === winnersCount - 1) {
      val = netPool - currentSum;
    }
    prizes[i].percentage = val;
    currentSum += val;
  }
  return prizes;
};

const CreateLeague: React.FC<CreateLeagueProps> = ({ onViewChange }) => {
  const [step, setStep] = React.useState(1);
  const [activeCategory, setActiveCategory] = React.useState<StageType | 'general'>('general');
  const [invitedUsers, setInvitedUsers] = React.useState<InvitedUser[]>([]);
  const [newUserInput, setNewUserInput] = React.useState({ name: '', email: '', phone: '' });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [leagueId] = React.useState(() => Math.random().toString(36).substr(2, 6).toUpperCase());
  
  const [leagueData, setLeagueData] = React.useState<LeagueData>(() => {
    const adminFee = 20;
    const genWinners = 4;
    return {
      name: '',
      description: '',
      privacy: 'private',
      logo: null,
      participantsCount: 10,
      includeBaseFee: true,
      baseFeeAmount: '50000',
      includeStageFees: true,
      stageFees: {
        match: { active: true, amount: '2000' },
        round: { active: true, amount: '5000' },
        phase: { active: true, amount: '10000' }
      },
      adminFeePercent: adminFee,
      distributions: {
        general: { winnersCount: genWinners, distribution: getInitialDistribution(genWinners, adminFee) },
        match: { winnersCount: 1, distribution: getInitialDistribution(1, adminFee) },
        round: { winnersCount: 1, distribution: getInitialDistribution(1, adminFee) },
        phase: { winnersCount: 1, distribution: getInitialDistribution(1, adminFee) }
      },
      currency: 'COP',
      plan: 'free'
    };
  });

  const isCategoryEnabled = (cat: string) => {
    if (cat === 'general') return leagueData.includeBaseFee;
    return leagueData.includeStageFees && leagueData.stageFees[cat as StageType]?.active;
  };

  const calculateTotalGrossForCategory = (cat: StageType | 'general') => {
    const base = leagueData.includeBaseFee ? parseInt(leagueData.baseFeeAmount || '0') : 0;
    const participants = leagueData.participantsCount;
    if (cat === 'general') return base * participants;
    const amount = parseInt(leagueData.stageFees[cat as StageType].amount || '0');
    const multiplier = cat === 'match' ? 104 : cat === 'round' ? 15 : 1; 
    return amount * multiplier * participants;
  };

  const calculateNetForCategory = (cat: StageType | 'general') => {
    const gross = calculateTotalGrossForCategory(cat);
    return gross * ((100 - leagueData.adminFeePercent) / 100);
  };

  const calculateAdminCutForCategory = (cat: StageType | 'general') => {
    const gross = calculateTotalGrossForCategory(cat);
    return gross * (leagueData.adminFeePercent / 100);
  };

  const updateWinnerCount = (cat: string, newCount: number) => {
    const count = Math.max(1, Math.min(10, newCount));
    const newDist = getInitialDistribution(count, leagueData.adminFeePercent);
    setLeagueData(prev => ({
      ...prev,
      distributions: {
        ...prev.distributions,
        [cat]: { winnersCount: count, distribution: newDist }
      }
    }));
  };

  const handleAdminFeeChange = (val: number) => {
    setLeagueData(prev => {
      const newDists = { ...prev.distributions };
      Object.keys(newDists).forEach(key => {
        const k = key as keyof typeof newDists;
        newDists[k].distribution = getInitialDistribution(newDists[k].winnersCount, val);
      });
      return { ...prev, adminFeePercent: val, distributions: newDists };
    });
  };

  const handleToggleStageFees = (v: boolean) => {
    setLeagueData(prev => ({
      ...prev,
      includeStageFees: v,
      stageFees: {
        match: { ...prev.stageFees.match, active: v },
        round: { ...prev.stageFees.round, active: v },
        phase: { ...prev.stageFees.phase, active: v }
      }
    }));
    if (!v && activeCategory !== 'general') setActiveCategory('general');
  };

  const handleAddExistingUser = (name: string) => {
    const newUser: InvitedUser = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@gmail.com`,
      phone: '3000000000',
      type: 'existing',
      avatar: `https://picsum.photos/seed/${name}/40/40`
    };
    setInvitedUsers([...invitedUsers, newUser]);
    setSearchQuery('');
  };

  const handleAddNewUser = () => {
    if (!newUserInput.email || !newUserInput.phone) return;
    const newUser: InvitedUser = {
      id: Math.random().toString(36).substr(2, 9),
      name: newUserInput.name || 'Nuevo Usuario',
      email: newUserInput.email,
      phone: newUserInput.phone,
      type: 'new'
    };
    setInvitedUsers([...invitedUsers, newUser]);
    setNewUserInput({ name: '', email: '', phone: '' });
  };

  const currentDist = leagueData.distributions[activeCategory as keyof typeof leagueData.distributions];
  const activeWinners = currentDist.distribution.filter((p) => p.active);
  const totalPercent = activeWinners.reduce((acc, curr) => acc + (curr.percentage || 0), 0) + leagueData.adminFeePercent;
  const isFinancialValid = Math.round(totalPercent) === 100;
  
  const currentNetPoolValue = calculateNetForCategory(activeCategory);

  const existingUsersPool = ["Luis Morales", "Leo Castiblanco", "Nubia Sarmiento", "Carlos Ruiz", "Andres Cepeda"];
  const filteredSearch = existingUsersPool.filter(u => u.toLowerCase().includes(searchQuery.toLowerCase()) && !invitedUsers.some(i => i.name === u));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-2 md:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[720px] transition-all duration-700">
        
        {/* Lado Branding (Desktop) */}
        <div className="hidden md:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center font-brand text-black font-black mb-8 shadow-xl shadow-lime-500/10">26</div>
            <h2 className="text-5xl font-black font-brand leading-tight mb-8 uppercase tracking-tighter">DISEÑA <br/><span className="text-lime-400">GANANCIAS.</span></h2>
            <div className="space-y-6">
              {[
                { label: "Bolsa Base 100% Bruto", icon: Coins },
                { label: "Invitación a Amigos", icon: UserPlus },
                { label: "Validación Final Maestro", icon: ShieldCheck }
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-300">
                  <div className="w-8 h-8 rounded-xl bg-lime-400/20 flex items-center justify-center text-lime-400"><b.icon size={16} /></div>
                  <span className="font-medium text-sm">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-lime-400/10 rounded-full blur-3xl"></div>
          <div className="relative z-10"><Badge color="bg-lime-400 text-black text-[8px] px-3 py-1 font-black uppercase">MUNDIAL 2026</Badge></div>
        </div>

        {/* Formulario */}
        <div className="p-4 md:p-12 flex flex-col h-full relative">
          
          {/* Cabecera Pasos */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl md:text-2xl font-black font-brand uppercase tracking-tighter">CREA TU <span className="text-lime-500">POLLA.</span></h3>
              <Badge color="bg-slate-100 text-slate-500 text-[8px] px-3">PLAN {leagueData.plan.toUpperCase()}</Badge>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PASO {step} DE 5</span>
              <div className="flex gap-1.5 w-32 h-1.5">
                {[1, 2, 3, 4, 5].map(s => <div key={s} className={`flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-lime-400' : 'bg-slate-100'}`}></div>)}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
            
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center gap-6">
                  <button className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:border-lime-400 transition-all">
                    <Camera size={24} /><span className="text-[8px] font-black mt-2 uppercase">SUBIR LOGO</span>
                  </button>
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre de la Polla *</label>
                      <Input 
                        placeholder="Ej. Polla del Barrio" 
                        value={leagueData.name} 
                        onChange={(e) => setLeagueData({...leagueData, name: formatSpanishTitleCase(e.target.value)})}
                        className="h-12 text-center font-black rounded-2xl border-2" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setLeagueData({...leagueData, privacy: 'private'})} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${leagueData.privacy === 'private' ? 'border-lime-400 bg-lime-50/20' : 'border-slate-50 text-slate-400'}`}>
                        <Lock size={16} /><span className="text-[8px] font-black uppercase tracking-widest">Privada</span>
                      </button>
                      <button onClick={() => setLeagueData({...leagueData, privacy: 'public'})} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${leagueData.privacy === 'public' ? 'border-lime-400 bg-lime-50/20' : 'border-slate-50 text-slate-400'}`}>
                        <Globe size={16} /><span className="text-[8px] font-black uppercase tracking-widest">Pública</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <Card className={`p-6 rounded-[2.2rem] border-2 transition-all ${leagueData.includeBaseFee ? 'border-lime-400 shadow-xl shadow-lime-500/5' : 'border-slate-100 opacity-60 grayscale'}`}>
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3"><Coins size={20} className="text-lime-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">CUOTA GENERAL</span></div>
                      <Checkbox id="base-fee" label="" checked={leagueData.includeBaseFee} onChange={v => setLeagueData({...leagueData, includeBaseFee: v})} />
                   </div>
                   <div className={`relative h-16 rounded-2xl bg-slate-50 flex items-center justify-center border-2 border-slate-100 ${!leagueData.includeBaseFee ? 'pointer-events-none opacity-50' : ''}`}>
                      <span className="absolute left-6 text-slate-300 text-2xl font-black">$</span>
                      <input type="number" value={leagueData.baseFeeAmount} onChange={e => setLeagueData({...leagueData, baseFeeAmount: e.target.value})} className="w-full text-center text-4xl font-black font-brand tracking-tighter bg-transparent outline-none text-slate-900" />
                   </div>
                </Card>

                <Card className={`p-6 rounded-[2.2rem] border-2 transition-all ${leagueData.includeStageFees ? 'border-lime-400 shadow-xl shadow-lime-500/5' : 'border-slate-100 opacity-60 grayscale'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3"><Calendar size={20} className="text-lime-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">EXTRAS POR ETAPA</span></div>
                    <Checkbox id="stage-fees" label="" checked={leagueData.includeStageFees} onChange={handleToggleStageFees} />
                  </div>
                  <div className="space-y-2">
                    {(['match', 'round', 'phase'] as const).map(key => (
                      <div key={key} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${leagueData.includeStageFees && leagueData.stageFees[key].active ? 'border-lime-100 bg-lime-50/20' : 'opacity-40 grayscale pointer-events-none'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${leagueData.stageFees[key].active ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' : 'bg-slate-100'}`}><Zap size={16} /></div>
                        <span className="flex-1 text-[8px] font-black uppercase text-slate-900 tracking-widest">{key === 'match' ? 'PARTIDO' : key === 'round' ? 'RONDA' : 'FASE'}</span>
                        <div className="relative w-28">
                          <input type="number" value={leagueData.stageFees[key].amount} onChange={(e) => setLeagueData({...leagueData, stageFees: {...leagueData.stageFees, [key]: {...leagueData.stageFees[key], amount: e.target.value}}})} className="w-full h-10 text-right pr-4 font-black text-sm bg-white border border-slate-200 rounded-xl outline-none" />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-200 text-[10px] font-black">$</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-3">
                   <Card className="p-5 rounded-[2rem] flex flex-col items-center gap-2 border-slate-100">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">PARTICIPANTES</span>
                      <div className="flex items-center gap-6 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                         <button onClick={() => setLeagueData({...leagueData, participantsCount: Math.max(2, leagueData.participantsCount-1)})} className="p-1 hover:bg-white rounded-lg transition-all text-slate-300 hover:text-slate-900"><Minus size={18} /></button>
                         <span className="text-3xl font-black font-brand text-slate-900 leading-none">{leagueData.participantsCount}</span>
                         <button onClick={() => setLeagueData({...leagueData, participantsCount: leagueData.participantsCount+1})} className="p-1 hover:bg-white rounded-lg transition-all text-slate-300 hover:text-slate-900"><Plus size={18} /></button>
                      </div>
                   </Card>
                   <Card className="p-5 rounded-[2rem] space-y-3 border-slate-100">
                      <div className="flex justify-between items-center px-1"><span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">% ADMIN</span><span className="text-base font-black text-lime-600">{leagueData.adminFeePercent}%</span></div>
                      <input 
                        type="range" 
                        min="0" max="40" step="5" 
                        value={leagueData.adminFeePercent} 
                        onChange={e => handleAdminFeeChange(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none accent-lime-500 cursor-pointer" 
                      />
                   </Card>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-[1.8rem] gap-1 border border-slate-200">
                   {(['general', 'match', 'round', 'phase'] as const).map(cat => (
                     <button key={cat} disabled={!isCategoryEnabled(cat)} onClick={() => setActiveCategory(cat)} className={`flex-1 py-3 rounded-[1.5rem] font-black text-[9px] tracking-[0.15em] transition-all uppercase ${activeCategory === cat ? 'bg-white text-black shadow-lg shadow-black/5' : 'text-slate-400 opacity-50'}`}>
                      {cat === 'general' ? 'GRAL' : cat === 'match' ? 'PART' : cat === 'round' ? 'ROND' : 'FASE'}
                     </button>
                   ))}
                </div>

                <Card className="p-6 rounded-[2.8rem] shadow-2xl space-y-5 border-lime-400 border-2 relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-2"><PieChart size={20} className="text-lime-500" /><span className="text-[11px] font-black uppercase tracking-widest text-slate-900">PUESTOS A PREMIAR</span></div>
                      <div className="flex items-center gap-6 bg-slate-50 p-1.5 px-6 rounded-2xl border border-slate-100 shadow-inner">
                         <button onClick={() => updateWinnerCount(activeCategory, currentDist.winnersCount - 1)} className="text-slate-300 hover:text-slate-900 transition-colors"><Minus size={20}/></button>
                         <span className="text-4xl font-black font-brand text-slate-900 w-12 text-center">{currentDist.winnersCount}</span>
                         <button onClick={() => updateWinnerCount(activeCategory, currentDist.winnersCount + 1)} className="text-slate-300 hover:text-slate-900 transition-colors"><Plus size={20}/></button>
                      </div>
                   </div>

                   <div className="space-y-1.5 pt-3 border-t border-slate-100 relative z-10">
                      <div className="flex justify-between items-center px-1 mb-3">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">DISTRIBUCIÓN CATEGORÍA: {activeCategory === 'general' ? 'GENERAL' : activeCategory.toUpperCase()}</span>
                         <Badge color={`${isFinancialValid ? 'bg-lime-400 text-slate-900' : 'bg-rose-500 text-white'} text-[9px] font-black shadow-lg`}>{isFinancialValid ? '100% OK' : 'REVISAR'}</Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto scrollbar-hide">
                         {activeWinners.map((winner, idx) => (
                           <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-2xl hover:border-lime-200 transition-all hover:shadow-sm">
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{winner.label}</span>
                              <div className="flex items-center gap-6">
                                <span className="text-[11px] font-black text-slate-400">{winner.percentage}%</span>
                                <span className="text-[12px] font-black text-lime-600">${Math.round(currentNetPoolValue * (winner.percentage / 100)).toLocaleString()}</span>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="p-6 bg-[#0a0f1d] rounded-[2rem] flex justify-between items-center border border-white/10 shadow-2xl mt-4">
                      <div className="flex flex-col">
                        <p className="text-[8px] font-black uppercase text-lime-400 tracking-[0.2em] leading-none mb-1">FONDO NETO {activeCategory.toUpperCase()}</p>
                        <p className="text-2xl font-black text-white font-brand tracking-tighter leading-none">${Math.round(currentNetPoolValue).toLocaleString()}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-[8px] font-black uppercase text-rose-400 tracking-[0.2em] leading-none mb-1">ADMIN ({leagueData.adminFeePercent}%)</p>
                        <p className="text-lg font-black text-white/80 font-brand tracking-tighter leading-none">${Math.round(calculateAdminCutForCategory(activeCategory)).toLocaleString()}</p>
                      </div>
                   </div>
                </Card>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                   <h4 className="text-2xl font-black font-brand uppercase tracking-tighter">INVITA A TU <span className="text-lime-500">GRUPO.</span></h4>
                </div>

                <Card className="p-6 rounded-[2rem] border-slate-100 shadow-sm space-y-4">
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Buscar amigos en Polla2026..." 
                        className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-lime-400 font-bold text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                   </div>
                   {searchQuery && filteredSearch.length > 0 && (
                     <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                        {filteredSearch.map(name => (
                          <button key={name} onClick={() => handleAddExistingUser(name)} className="w-full flex items-center gap-3 p-3 hover:bg-lime-50 rounded-xl transition-all">
                             <img src={`https://picsum.photos/seed/${name}/40/40`} className="w-8 h-8 rounded-lg" />
                             <span className="text-xs font-black text-slate-900 uppercase">{name}</span>
                             <Plus size={14} className="ml-auto text-lime-500" />
                          </button>
                        ))}
                     </div>
                   )}
                </Card>

                <Card className="p-6 rounded-[2rem] border-slate-100 shadow-sm space-y-4">
                   <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">INVITAR NUEVO USUARIO</span>
                   <div className="grid grid-cols-1 gap-3">
                      <Input placeholder="Nombre (Opcional)" value={newUserInput.name} onChange={e => setNewUserInput({...newUserInput, name: e.target.value})} className="h-10 text-xs font-bold rounded-xl" />
                      <div className="grid grid-cols-2 gap-3">
                         <Input placeholder="Celular" value={newUserInput.phone} onChange={e => setNewUserInput({...newUserInput, phone: e.target.value})} className="h-10 text-xs font-bold rounded-xl" leftIcon={<Phone size={14}/>} />
                         <Input placeholder="Correo" value={newUserInput.email} onChange={e => setNewUserInput({...newUserInput, email: e.target.value})} className="h-10 text-xs font-bold rounded-xl" leftIcon={<Mail size={14}/>} />
                      </div>
                      <Button onClick={handleAddNewUser} variant="outline" className="h-10 rounded-xl font-black text-[9px] uppercase tracking-widest border-lime-400 text-lime-600 hover:bg-lime-50" disabled={!newUserInput.email || !newUserInput.phone}>
                         AGREGAR <Plus size={14} className="ml-2"/>
                      </Button>
                   </div>
                </Card>

                <div className="space-y-2">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">INVITADOS ({invitedUsers.length}/{leagueData.participantsCount})</span>
                   <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto scrollbar-hide">
                      {invitedUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl">
                           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                             {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-xl" /> : <UserPlus size={18}/>}
                           </div>
                           <div className="flex-1">
                              <p className="text-xs font-black text-slate-900 uppercase leading-none mb-1">{user.name}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{user.email}</p>
                           </div>
                           <button onClick={() => setInvitedUsers(invitedUsers.filter(u => u.id !== user.id))} className="text-rose-400"><X size={16}/></button>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 animate-in zoom-in duration-300 py-4 flex flex-col items-center">
                 <div className="text-center space-y-2 mb-2">
                    <h4 className="text-2xl font-black font-brand uppercase tracking-tighter leading-none">PREVIO DE <span className="text-lime-500">RESUMEN.</span></h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valida que toda la información sea correcta.</p>
                 </div>

                 <Card className="p-0 rounded-[2.8rem] bg-white shadow-3xl overflow-hidden flex flex-col w-full max-w-[360px] border border-slate-100 animate-in slide-in-from-bottom-8">
                    {/* Carnet Header (Dark Theme) */}
                    <div className="bg-[#0a0f1d] p-6 text-white space-y-4 relative overflow-hidden">
                       <div className="flex justify-between items-start relative z-10">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-950 shadow-2xl overflow-hidden">
                             {leagueData.logo ? <img src={leagueData.logo} className="w-full h-full object-cover" /> : <Award size={28} />}
                          </div>
                          <Badge color="bg-lime-400 text-black uppercase tracking-widest text-[9px] font-black shadow-lg shadow-lime-400/20 px-4 py-1.5">VALIDADO</Badge>
                       </div>
                       <div className="relative z-10">
                          <h4 className="text-2xl font-black font-brand uppercase tracking-tighter truncate leading-none mb-1.5">{leagueData.name || 'CREANDO LIGA...'}</h4>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">ID LIGA: #{leagueId}</span>
                       </div>
                       <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none -rotate-12"><Trophy size={140} /></div>
                    </div>

                    {/* Carnet Body (Detailed Info) */}
                    <div className="p-6 space-y-6 bg-white max-h-[400px] overflow-y-auto scrollbar-hide">
                       
                       {/* Configuración Base */}
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                             <div className="flex items-center gap-1.5 text-slate-400"><Lock size={12}/><span className="text-[8px] font-black uppercase tracking-widest">PRIVACIDAD</span></div>
                             <p className="text-xs font-black uppercase text-slate-900">{leagueData.privacy === 'private' ? 'Liga Privada' : 'Liga Pública'}</p>
                          </div>
                          <div className="space-y-1.5">
                             <div className="flex items-center gap-1.5 text-slate-400"><Sparkles size={12}/><span className="text-[8px] font-black uppercase tracking-widest">PLAN ACTUAL</span></div>
                             <p className="text-xs font-black uppercase text-lime-600">{leagueData.plan.toUpperCase()} PLAN</p>
                          </div>
                       </div>

                       {/* Desglose de Costos */}
                       <div className="pt-6 border-t border-slate-50 space-y-4">
                          <div className="flex items-center gap-2 mb-2"><Coins size={14} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">COSTOS POR JUGADOR</span></div>
                          <div className="space-y-2">
                             {leagueData.includeBaseFee && (
                               <div className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                                  <span className="text-[10px] font-black text-slate-500 uppercase">CUOTA ÚNICA BASE</span>
                                  <span className="text-sm font-black text-slate-950">${parseInt(leagueData.baseFeeAmount).toLocaleString()}</span>
                               </div>
                             )}
                             {leagueData.includeStageFees && (['match', 'round', 'phase'] as StageType[]).map(key => (
                               leagueData.stageFees[key].active && (
                                 <div key={key} className="flex justify-between items-center px-3 py-1 border-b border-slate-50">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">EXTRA POR {key === 'match' ? 'PARTIDO' : key === 'round' ? 'RONDA' : 'FASE'}</span>
                                    <span className="text-[11px] font-black text-slate-700">${parseInt(leagueData.stageFees[key].amount).toLocaleString()}</span>
                                 </div>
                               )
                             ))}
                          </div>
                       </div>

                       {/* Premiación Detallada */}
                       <div className="pt-6 border-t border-slate-50 space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2"><PieChart size={14} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">PLAN DE PREMIOS ({activeCategory === 'general' ? 'GRAL' : activeCategory.toUpperCase()})</span></div>
                             <button onClick={() => setStep(3)} className="text-[8px] font-black text-lime-600 uppercase">CAMBIAR</button>
                          </div>
                          <div className="space-y-1.5">
                             {activeWinners.map((winner, idx) => (
                               <div key={idx} className="flex justify-between items-center px-3 py-2 bg-lime-50/30 rounded-xl">
                                  <span className="text-[10px] font-black text-slate-600 uppercase">{winner.label} ({winner.percentage}%)</span>
                                  <span className="text-xs font-black text-lime-600">${Math.round(currentNetPoolValue * (winner.percentage / 100)).toLocaleString()}</span>
                               </div>
                             ))}
                          </div>
                       </div>

                       {/* Participantes */}
                       <div className="pt-6 border-t border-slate-50 space-y-4">
                          <div className="flex items-center gap-2"><Users size={14} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">PARTICIPANTES</span></div>
                          <div className="grid grid-cols-2 gap-3">
                             <div className="p-4 bg-slate-900 rounded-[1.8rem] text-center">
                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">CUPOS TOTALES</p>
                                <p className="text-xl font-black text-white">{leagueData.participantsCount}</p>
                             </div>
                             <div className="p-4 bg-lime-400 rounded-[1.8rem] text-center">
                                <p className="text-[8px] font-black text-slate-950/40 uppercase mb-1">INVITADOS</p>
                                <p className="text-xl font-black text-slate-950">{invitedUsers.length}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Carnet Footer - Total Gross (Calculated from all active) */}
                    <div className="p-8 bg-slate-50 border-t border-slate-100 text-center space-y-1">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">RECAUDO BRUTO POTENCIAL</p>
                       <span className="text-4xl font-black font-brand text-slate-950 tracking-tighter leading-none">
                        ${(
                          calculateTotalGrossForCategory('general') + 
                          (leagueData.includeStageFees ? (calculateTotalGrossForCategory('match') + calculateTotalGrossForCategory('round') + calculateTotalGrossForCategory('phase')) : 0)
                        ).toLocaleString()}
                       </span>
                       <div className="pt-4 flex flex-col items-center">
                          <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-lime-500"/><span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">COMISIÓN ADMIN ({leagueData.adminFeePercent}%) INCLUIDA</span></div>
                       </div>
                    </div>
                 </Card>
              </div>
            )}
          </div>

          {/* Botones de Navegación */}
          <div className="mt-6 flex gap-3 pt-6 border-t border-slate-100">
             {step > 1 && (
               <Button variant="outline" className="w-16 h-16 rounded-[1.8rem] border-slate-200" onClick={() => setStep(step - 1)}>
                  <ArrowLeft size={24} className="text-slate-400" />
               </Button>
             )}
             <Button 
              variant="secondary"
              className={`flex-1 h-16 rounded-[1.8rem] font-black text-[12px] tracking-[0.2em] shadow-2xl bg-lime-400 text-slate-950 hover:bg-lime-500 active:scale-95 transition-all ${step === 3 && !isFinancialValid ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} 
              onClick={() => {
                if (step === 3 && !isFinancialValid) return;
                step < 5 ? setStep(step + 1) : onViewChange('dashboard');
              }}
              disabled={step === 1 && leagueData.name.length < 3}
             >
                {step === 5 ? 'CONFIRMAR Y ACTIVAR LIGA' : 'SIGUIENTE PASO'} <ArrowRight size={24} className="ml-2" />
             </Button>
          </div>

          <div className="mt-4 flex justify-center gap-10 text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">
             <div className="flex items-center gap-2"><ShieldCheck size={12}/> ENCRIPTADO</div>
             <div className="flex items-center gap-2"><Globe size={12}/> SOPORTE GLOBAL</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateLeague;

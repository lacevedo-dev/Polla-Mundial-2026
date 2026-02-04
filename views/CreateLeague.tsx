
import React from 'react';
import { Button, Card, Badge, Input, Checkbox, EmailAutocompleteInput } from '../components/UI';
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
  CheckCircle2,
  QrCode,
  Share2,
  Download,
  Ticket,
  Instagram,
  MessageCircle,
  Twitter,
  Diamond,
  AlertCircle,
  FileText,
  Crown,
  Info,
  Wallet,
  Megaphone,
  RefreshCw,
  AlertTriangle,
  Calculator,
  ChevronDown,
  Check
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

interface Country {
  code: string;
  name: string;
  iso: string;
  length: number;
  placeholder: string;
  regex?: RegExp;
}

const COUNTRY_CODES: Country[] = [
  { code: '+57', name: 'Colombia', iso: 'co', length: 10, placeholder: '310 123 4567', regex: /^3\d{9}$/ },
  { code: '+52', name: 'México', iso: 'mx', length: 10, placeholder: '55 1234 5678' },
  { code: '+1', name: 'USA / Canadá', iso: 'us', length: 10, placeholder: '202 555 0123' },
  { code: '+34', name: 'España', iso: 'es', length: 9, placeholder: '612 345 678' },
  { code: '+54', name: 'Argentina', iso: 'ar', length: 10, placeholder: '11 1234 5678' },
  { code: '+56', name: 'Chile', iso: 'cl', length: 9, placeholder: '9 1234 5678' },
  { code: '+58', name: 'Venezuela', iso: 've', length: 10, placeholder: '412 123 4567' },
  { code: '+51', name: 'Perú', iso: 'pe', length: 9, placeholder: '912 345 678' },
  { code: '+55', name: 'Brasil', iso: 'br', length: 11, placeholder: '11 91234 5678' },
];

// Mock database for existing users validation
const MOCK_DB = [
  { phone: '3001234567', name: 'Carlos Gomez', email: 'carlos.g@email.com', avatar: 'https://picsum.photos/seed/carlos/40/40' },
  { phone: '3109876543', name: 'Ana Maria', email: 'ana.m@email.com', avatar: 'https://picsum.photos/seed/ana/40/40' },
  { phone: '3205551234', name: 'David Torres', email: 'david.t@email.com', avatar: 'https://picsum.photos/seed/david/40/40' },
];

const MINOR_WORDS = ['de', 'la', 'del', 'el', 'los', 'las', 'y', 'en', 'por', 'con', 'a', 'para', 'o', 'u', 'e'];

const formatSpanishTitleCase = (str: string) => {
  if (!str) return '';
  const hasTrailingSpace = str.endsWith(' ');
  const words = str.trim().split(/\s+/);
  
  const formatted = words
    .map((word, index) => {
      if (!word) return '';
      const lowerWord = word.toLowerCase();
      if (index === 0 || !MINOR_WORDS.includes(lowerWord)) {
        return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
      }
      return lowerWord;
    })
    .join(' ');
    
  return hasTrailingSpace ? `${formatted} ` : formatted;
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
    1: [100], 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 10, 10],
    6: [30, 20, 15, 15, 10, 10], 7: [25, 20, 15, 10, 10, 10, 10], 8: [20, 15, 15, 10, 10, 10, 10, 10],
    9: [20, 15, 10, 10, 10, 10, 10, 10, 5], 10: [15, 15, 10, 10, 10, 10, 10, 10, 5, 5]
  };
  const weights = templates[winnersCount] || Array(winnersCount).fill(100 / winnersCount);
  let currentSum = 0;
  for (let i = 0; i < winnersCount; i++) {
    prizes[i].active = true;
    let val = Math.round((netPool * (weights[i] / 100)) / 5) * 5;
    if (i === winnersCount - 1) val = netPool - currentSum;
    prizes[i].percentage = val;
    currentSum += val;
  }
  return prizes;
};

const PLAN_LIMITS = {
  free: 10,
  gold: 50,
  diamond: 500
};

const STORAGE_KEY = 'polla_league_wizard_state';

const CreateLeague: React.FC<CreateLeagueProps> = ({ onViewChange }) => {
  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  
  const saved = getSavedState();

  const [step, setStep] = React.useState<number>(saved?.step || 1);
  const [activeCategory, setActiveCategory] = React.useState<StageType | 'general'>(saved?.activeCategory || 'general');
  const [invitedUsers, setInvitedUsers] = React.useState<InvitedUser[]>(saved?.invitedUsers || []);
  const [newUserInput, setNewUserInput] = React.useState(saved?.newUserInput || { name: '', email: '', phone: '' });
  const [inputErrors, setInputErrors] = React.useState({ email: '', phone: '' });
  const [searchQuery, setSearchQuery] = React.useState(saved?.searchQuery || '');
  const [leagueId] = React.useState<string>(saved?.leagueId || Math.random().toString(36).substr(2, 6).toUpperCase());
  const [foundExistingUser, setFoundExistingUser] = React.useState<boolean>(false);
  
  // Phone selection state
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(COUNTRY_CODES[0]);
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const selectorRef = React.useRef<HTMLDivElement>(null);

  // DEFAULT SETTINGS UPDATED: 10% Admin Fee, 3 Winners
  const [leagueData, setLeagueData] = React.useState<LeagueData>(() => saved?.leagueData || {
    name: '', description: '', privacy: 'private', logo: null, participantsCount: 10,
    includeBaseFee: true, baseFeeAmount: '50000', includeStageFees: true,
    stageFees: { match: { active: true, amount: '2000' }, round: { active: true, amount: '5000' }, phase: { active: true, amount: '10000' } },
    adminFeePercent: 10, // Default 10%
    distributions: {
      general: { winnersCount: 3, distribution: getInitialDistribution(3, 10) }, // Default 3 winners
      match: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
      round: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
      phase: { winnersCount: 1, distribution: getInitialDistribution(1, 10) }
    },
    currency: 'COP', plan: 'free'
  });

  React.useEffect(() => {
    const state = {
      step,
      activeCategory,
      invitedUsers,
      newUserInput,
      searchQuery,
      leagueId,
      leagueData
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [step, activeCategory, invitedUsers, newUserInput, searchQuery, leagueId, leagueData]);

  // Click outside for country selector
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsCountrySelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validar si la categoría actual sigue activa, sino cambiar a una disponible
  React.useEffect(() => {
    if (step === 3) {
      const isCurrentActive = activeCategory === 'general' ? leagueData.includeBaseFee : leagueData.includeStageFees && leagueData.stageFees[activeCategory as StageType]?.active;
      if (!isCurrentActive) {
        if (leagueData.includeBaseFee) setActiveCategory('general');
        else if (leagueData.includeStageFees) {
          if (leagueData.stageFees.match.active) setActiveCategory('match');
          else if (leagueData.stageFees.round.active) setActiveCategory('round');
          else if (leagueData.stageFees.phase.active) setActiveCategory('phase');
        }
      }
    }
  }, [step, leagueData.includeBaseFee, leagueData.includeStageFees, leagueData.stageFees]);

  const handleFinish = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    onViewChange('dashboard');
  };

  const isCategoryEnabled = (cat: string) => cat === 'general' ? leagueData.includeBaseFee : leagueData.includeStageFees && leagueData.stageFees[cat as StageType]?.active;
  const calculateTotalGrossForCategory = (cat: StageType | 'general') => {
    const base = leagueData.includeBaseFee ? parseInt(leagueData.baseFeeAmount || '0') : 0;
    const participants = leagueData.participantsCount;
    if (cat === 'general') return base * participants;
    const amount = parseInt(leagueData.stageFees[cat as StageType].amount || '0');
    const multiplier = cat === 'match' ? 104 : cat === 'round' ? 15 : 1; 
    return amount * multiplier * participants;
  };
  const calculateNetForCategory = (cat: StageType | 'general') => calculateTotalGrossForCategory(cat) * ((100 - leagueData.adminFeePercent) / 100);
  
  // GLOBAL CALCULATIONS (Sum of all active tabs)
  const totalPotentialGross = calculateTotalGrossForCategory('general') + (leagueData.includeStageFees ? (calculateTotalGrossForCategory('match') + calculateTotalGrossForCategory('round') + calculateTotalGrossForCategory('phase')) : 0);
  const totalNetPrizes = calculateNetForCategory('general') + (leagueData.includeStageFees ? (calculateNetForCategory('match') + calculateNetForCategory('round') + calculateNetForCategory('phase')) : 0);
  const totalAdminFee = totalPotentialGross * (leagueData.adminFeePercent / 100);

  const requiredPlan = leagueData.participantsCount > 50 ? 'diamond' : leagueData.participantsCount > 10 ? 'gold' : 'free';
  const isLimitExceeded = (leagueData.plan === 'free' && leagueData.participantsCount > 10) || 
                          (leagueData.plan === 'gold' && leagueData.participantsCount > 50);

  const updateWinnerCount = (category: StageType | 'general', count: number) => {
    if (count < 1 || count > 10) return;
    setLeagueData(prev => {
      const newDists = { ...prev.distributions };
      const catKey = category as keyof typeof newDists;
      newDists[catKey] = {
        ...newDists[catKey],
        winnersCount: count,
        distribution: getInitialDistribution(count, prev.adminFeePercent)
      };
      return { ...prev, distributions: newDists };
    });
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

  const handleIncrementParticipants = () => {
    if (leagueData.participantsCount >= 500) return; 
    setLeagueData({...leagueData, participantsCount: leagueData.participantsCount+1});
  };

  const handleDecrementParticipants = () => {
    setLeagueData({...leagueData, participantsCount: Math.max(2, leagueData.participantsCount-1)});
  }

  const handleResetToFreeLimit = () => {
      setLeagueData({...leagueData, participantsCount: 10});
  }

  const handleAddExistingUser = (name: string) => {
    const newUser: InvitedUser = { id: Math.random().toString(36).substr(2, 9), name, email: `${name.toLowerCase().replace(' ', '.')}@gmail.com`, phone: '3000000000', type: 'existing', avatar: `https://picsum.photos/seed/${name}/40/40` };
    setInvitedUsers([...invitedUsers, newUser]);
    setSearchQuery('');
  };

  // VALIDATION LOGIC
  const validateAndCheckUser = (phone: string, country: Country) => {
      let isValidLength = false;
      if (country.regex) {
        isValidLength = country.regex.test(phone);
      } else {
        isValidLength = phone.length === country.length;
      }
      
      if (!isValidLength) {
          setInputErrors(prev => ({ ...prev, phone: `El número debe tener ${country.length} dígitos` }));
          if (foundExistingUser) setFoundExistingUser(false);
          return true; // Error exists
      } else {
          setInputErrors(prev => ({ ...prev, phone: '' }));
          // Check DB
          const existing = MOCK_DB.find(u => u.phone === phone);
          if (existing) {
             setNewUserInput({ name: existing.name, email: existing.email, phone: phone });
             setFoundExistingUser(true);
             setInputErrors(prev => ({ ...prev, email: '' }));
          } else {
             if (foundExistingUser) {
                setNewUserInput(prev => ({ ...prev, name: '', email: '' }));
                setFoundExistingUser(false);
             }
          }
          return false; // No error
      }
  };

  const validatePhone = (phone: string) => {
    // This is now handled by validateAndCheckUser mainly, but kept for submit check
    if (inputErrors.phone) return inputErrors.phone;
    if (!phone) return "Campo requerido";
    return "";
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Formato de correo inválido.";
    return "";
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Check for country code paste (e.g. +57300...)
    const matchedCountry = COUNTRY_CODES.find(c => val.startsWith(c.code));
    if (matchedCountry) {
        setSelectedCountry(matchedCountry);
        const stripped = val.replace(matchedCountry.code, '').trim().replace(/\D/g, '');
        
        setNewUserInput(prev => ({ ...prev, phone: stripped }));
        validateAndCheckUser(stripped, matchedCountry);
    } else {
        const cleanVal = val.replace(/\D/g, '');
        if (cleanVal.length <= selectedCountry.length) { 
            setNewUserInput(prev => ({ ...prev, phone: cleanVal }));
            validateAndCheckUser(cleanVal, selectedCountry);
        }
    }
  };

  const handleEmailChange = (email: string) => {
    setNewUserInput(prev => ({ ...prev, email }));
    const error = validateEmail(email);
    setInputErrors(prev => ({ ...prev, email: error }));
  };

  const handleAddUser = () => {
    // Final Validation
    const phoneError = validateAndCheckUser(newUserInput.phone, selectedCountry) ? inputErrors.phone : "";
    const emailError = validateEmail(newUserInput.email);

    if (phoneError || emailError) {
      setInputErrors({ phone: phoneError, email: emailError });
      return;
    }

    if(newUserInput.email && newUserInput.phone) { 
        setInvitedUsers([
          ...invitedUsers, 
          {
            id: Math.random().toString(), 
            name: newUserInput.name || 'Invitado', 
            email: newUserInput.email, 
            phone: `${selectedCountry.code} ${newUserInput.phone}`, 
            type: foundExistingUser ? 'existing' : 'new',
            avatar: foundExistingUser ? MOCK_DB.find(u => u.phone === newUserInput.phone)?.avatar : undefined
          }
        ]); 
        setNewUserInput({name: '', email: '', phone: ''}); 
        setFoundExistingUser(false); 
        setInputErrors({ email: '', phone: '' });
    }
  };

  const handleStageFeeActiveChange = (key: StageType, isActive: boolean) => {
    setLeagueData(prev => ({
      ...prev,
      stageFees: {
        ...prev.stageFees,
        [key]: {
          ...prev.stageFees[key],
          active: isActive
        }
      }
    }));
  };

  const existingUsersPool = ["Luis Morales", "Leo Castiblanco", "Nubia Sarmiento", "Carlos Ruiz", "Andres Cepeda"];
  const filteredSearch = existingUsersPool.filter(u => u.toLowerCase().includes(searchQuery.toLowerCase()) && !invitedUsers.some(i => i.name === u));
  
  const filteredCountries = COUNTRY_CODES.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.includes(countrySearch)
  );

  const currentDist = leagueData.distributions[activeCategory as keyof typeof leagueData.distributions];
  const activeWinners = currentDist.distribution.filter((p) => p.active);
  const totalPercent = activeWinners.reduce((acc, curr) => acc + (curr.percentage || 0), 0) + leagueData.adminFeePercent;
  const isFinancialValid = Math.round(totalPercent) === 100;

  // Logic for 30% suggestion
  const suggestedMaxWinners = Math.max(1, Math.floor(leagueData.participantsCount * 0.3));
  const isWinnerCountHigh = currentDist.winnersCount > suggestedMaxWinners;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-2 md:p-8">
      <style>{`
        .scrollbar-custom::-webkit-scrollbar {
            width: 4px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
            background: transparent;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
            background-color: #cbd5e1;
            border-radius: 20px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
            background-color: #94a3b8;
        }
      `}</style>
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[720px] transition-all duration-700">
        
        {/* Lado Branding (Desktop) */}
        <div className="hidden md:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center font-brand text-black font-black mb-8 shadow-xl shadow-lime-500/10">26</div>
            <h2 className="text-5xl font-black font-brand leading-tight mb-8 uppercase tracking-tighter">EL PASO <br/><span className="text-lime-400">FINAL.</span></h2>
            <div className="space-y-6">
              {[{ label: "Diseño FIFA Pass", icon: Ticket }, { label: "QR de Invitación", icon: QrCode }, { label: "Compartir en Redes", icon: Share2 }].map((b, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-300">
                  <div className="w-8 h-8 rounded-xl bg-lime-400/20 flex items-center justify-center text-lime-400"><b.icon size={16} /></div>
                  <span className="font-medium text-sm">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-lime-400/10 rounded-full blur-3xl"></div>
          <div className="relative z-10"><Badge color="bg-lime-400 text-black text-[8px] px-3 py-1 font-black uppercase">POLLA DIGITAL</Badge></div>
        </div>

        {/* Formulario */}
        <div className="p-4 md:p-12 flex flex-col h-full relative overflow-hidden">
          
          {/* Cabecera Pasos RE-DISEÑADA */}
          <div className="mb-6 flex items-end justify-between">
             <div>
                <h3 className="text-2xl font-black font-brand uppercase tracking-tighter text-slate-900">
                  CREA TU <span className="text-lime-600">POLLA.</span>
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 block">PASO {step} DE 6</span>
             </div>
             <div className="mb-1">
               <Badge color="bg-slate-100 text-slate-600 font-bold text-[9px] px-3 border border-slate-200">
                  PLAN {leagueData.plan === 'free' ? 'GRATUITO' : leagueData.plan.toUpperCase()}
               </Badge>
             </div>
          </div>
          <div className="flex gap-1 h-1 w-full mb-6">
             {[1, 2, 3, 4, 5, 6].map(s => <div key={s} className={`flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-lime-500' : 'bg-slate-200'}`}></div>)}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
            
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="flex flex-col items-center gap-6">
                  <button className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-500 hover:border-lime-500 hover:text-lime-600 transition-all">
                    <Camera size={24} /><span className="text-[8px] font-black mt-2 uppercase">SUBIR LOGO</span>
                  </button>
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Nombre de la Polla *</label>
                        <span className={`text-[9px] font-bold ${leagueData.name.length >= 50 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {leagueData.name.length}/50
                        </span>
                      </div>
                      <Input 
                        placeholder="Ej. Polla del Barrio" 
                        value={leagueData.name} 
                        maxLength={50}
                        onChange={(e) => setLeagueData({...leagueData, name: formatSpanishTitleCase(e.target.value)})} 
                        className={`h-12 text-center font-black rounded-2xl border-2 transition-all ${leagueData.name.length >= 3 ? 'border-lime-400 focus:border-lime-500 bg-lime-50/10' : 'border-slate-300'}`} 
                        rightIcon={leagueData.name.length >= 3 ? <CheckCircle2 size={18} className="text-lime-600" /> : undefined}
                      />
                    </div>

                    {leagueData.name.length >= 3 && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center ml-1">
                           <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Descripción (Opcional)</label>
                           <span className="text-[9px] font-bold text-slate-400">{leagueData.description?.length || 0}/100</span>
                        </div>
                        <Input 
                           placeholder="¿De qué trata tu liga?" 
                           value={leagueData.description} 
                           onChange={(e) => setLeagueData({...leagueData, description: e.target.value})} 
                           className="h-10 text-center font-medium rounded-xl border-slate-300 text-sm"
                           maxLength={100}
                           leftIcon={<FileText size={14} />}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => setLeagueData({...leagueData, privacy: 'private'})} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${leagueData.privacy === 'private' ? 'border-lime-500 bg-lime-50/20 text-lime-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><Lock size={16} /><span className="text-[8px] font-black uppercase tracking-widest">Privada</span></button>
                      <button onClick={() => setLeagueData({...leagueData, privacy: 'public'})} className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${leagueData.privacy === 'public' ? 'border-lime-500 bg-lime-50/20 text-lime-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><Globe size={16} /><span className="text-[8px] font-black uppercase tracking-widest">Pública</span></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <Card className={`p-6 rounded-[2.2rem] border-2 transition-all ${leagueData.includeBaseFee ? 'border-lime-500 shadow-xl shadow-lime-500/5' : 'border-slate-200 opacity-60 grayscale'}`}>
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3"><Coins size={20} className="text-lime-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">CUOTA GENERAL</span></div>
                      <Checkbox id="base-fee" label="" checked={leagueData.includeBaseFee} onChange={v => setLeagueData({...leagueData, includeBaseFee: v})} />
                   </div>
                   <div className={`relative h-16 rounded-2xl bg-slate-50 flex items-center justify-center border-2 border-slate-200 ${!leagueData.includeBaseFee ? 'pointer-events-none opacity-50' : ''}`}>
                      <span className="absolute left-6 text-slate-400 text-2xl font-black">$</span>
                      <input type="number" value={leagueData.baseFeeAmount} onChange={e => setLeagueData({...leagueData, baseFeeAmount: e.target.value})} className="w-full text-center text-4xl font-black font-brand tracking-tighter bg-transparent outline-none text-slate-900" />
                   </div>
                </Card>
                <Card className={`p-6 rounded-[2.2rem] border-2 transition-all ${leagueData.includeStageFees ? 'border-lime-500 shadow-xl shadow-lime-500/5' : 'border-slate-200 opacity-60 grayscale'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3"><Calendar size={20} className="text-lime-600" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-900">EXTRAS POR ETAPA</span></div>
                    <Checkbox id="stage-fees" label="" checked={leagueData.includeStageFees} onChange={v => setLeagueData({...leagueData, includeStageFees: v})} />
                  </div>
                  <div className="space-y-2">
                    {(['match', 'round', 'phase'] as const).map(key => (
                      <div key={key} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${!leagueData.includeStageFees ? 'opacity-40 grayscale pointer-events-none' : leagueData.stageFees[key].active ? 'border-lime-200 bg-lime-50/20' : 'border-slate-200 bg-slate-50 opacity-80'}`}>
                        <div className={`${!leagueData.includeStageFees ? 'pointer-events-none' : ''}`}>
                             <Checkbox 
                                id={`check-${key}`} 
                                label="" 
                                checked={leagueData.stageFees[key].active} 
                                onChange={(v) => handleStageFeeActiveChange(key, v)}
                                disabled={!leagueData.includeStageFees}
                             />
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${leagueData.includeStageFees && leagueData.stageFees[key].active ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' : 'bg-slate-200 text-slate-400'}`}><Zap size={16} /></div>
                        <span className="flex-1 text-[8px] font-black uppercase text-slate-900 tracking-widest">{key === 'match' ? 'PARTIDO' : key === 'round' ? 'RONDA' : 'FASE'}</span>
                        <div className={`relative w-28 transition-all ${leagueData.stageFees[key].active ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          <input 
                            type="number" 
                            value={leagueData.stageFees[key].amount} 
                            onChange={(e) => setLeagueData({...leagueData, stageFees: {...leagueData.stageFees, [key]: {...leagueData.stageFees[key], amount: e.target.value}}})} 
                            className={`w-full h-10 text-right pr-4 font-black text-sm border rounded-xl outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-100 transition-all ${leagueData.stageFees[key].active ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-400'}`} 
                          />
                          <span className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-black ${leagueData.stageFees[key].active ? 'text-slate-400' : 'text-slate-300'}`}>$</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                
                {/* Indicador de Plan de Suscripción RE-DISEÑADO */}
                <div className="border border-slate-200 rounded-3xl p-4 flex items-center justify-between bg-white shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <ShieldCheck size={20} className="text-slate-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nivel de Cuenta</p>
                            <p className="text-sm font-black text-slate-900 uppercase">
                                {leagueData.plan === 'free' ? 'Plan Gratuito' : leagueData.plan.toUpperCase()}
                            </p>
                        </div>
                    </div>
                    {leagueData.plan === 'free' && (
                        <Button variant="outline" size="sm" onClick={() => onViewChange('checkout')} className="h-8 text-[10px] font-black uppercase tracking-widest px-4 border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400">Mejorar</Button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   {/* PARTICIPANTES - NUEVO DISEÑO */}
                   <Card className="p-4 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-slate-100 shadow-sm border">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Participantes</span>
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                         <button onClick={handleDecrementParticipants} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"><Minus size={18}/></button>
                         <span className="text-2xl font-black font-brand text-slate-900 w-10 text-center">{leagueData.participantsCount}</span>
                         <button onClick={handleIncrementParticipants} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"><Plus size={18}/></button>
                      </div>
                      {isLimitExceeded && (
                          <div className="flex items-center gap-1.5">
                              <AlertCircle size={10} className="text-rose-500" />
                              <span className="text-[8px] font-bold text-rose-500">Límite: {PLAN_LIMITS[leagueData.plan]}</span>
                          </div>
                      )}
                   </Card>

                   {/* % ADMIN - NUEVO DISEÑO */}
                   <Card className="p-4 flex flex-col justify-center gap-4 rounded-[2rem] border-slate-100 shadow-sm border">
                      <div className="flex justify-between w-full px-1 items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">% Admin</span>
                          <span className="text-sm font-black text-lime-600">{leagueData.adminFeePercent}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="40" 
                        step="5" 
                        value={leagueData.adminFeePercent} 
                        onChange={e => handleAdminFeeChange(parseInt(e.target.value))} 
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none accent-lime-500 cursor-pointer" 
                      />
                   </Card>
                </div>
                
                {/* Pestañas Filtradas - DISEÑO CAPSULA */}
                <div className="flex p-1 bg-white rounded-[2rem] gap-1 border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide">
                   {([
                     { id: 'general', label: 'GENERAL', active: leagueData.includeBaseFee },
                     { id: 'match', label: 'PARTIDO', active: leagueData.includeStageFees && leagueData.stageFees.match.active },
                     { id: 'round', label: 'RONDA', active: leagueData.includeStageFees && leagueData.stageFees.round.active },
                     { id: 'phase', label: 'FASE', active: leagueData.includeStageFees && leagueData.stageFees.phase.active }
                   ] as const).filter(t => t.active).map(cat => (
                     <button key={cat.id} onClick={() => setActiveCategory(cat.id as StageType | 'general')} className={`flex-1 py-2.5 px-4 rounded-[1.8rem] font-black text-[9px] tracking-widest transition-all uppercase whitespace-nowrap ${activeCategory === cat.id ? 'bg-white text-black shadow-md border border-slate-100' : 'text-slate-400 hover:bg-slate-50'}`}>{cat.label}</button>
                   ))}
                </div>

                <Card className="p-0 rounded-[2.5rem] shadow-xl border-lime-500 border relative overflow-hidden flex flex-col flex-1 bg-white">
                   <div className="flex justify-between items-center p-6 bg-white">
                      <div className="flex items-center gap-2">
                        <PieChart size={18} className="text-lime-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">PUESTOS A PREMIAR</span>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-1 px-4 rounded-xl border border-slate-200">
                         <button onClick={() => updateWinnerCount(activeCategory, currentDist.winnersCount - 1)} className="text-slate-400 hover:text-slate-900"><Minus size={16}/></button>
                         <span className="text-2xl font-black font-brand text-slate-900 w-8 text-center">{currentDist.winnersCount}</span>
                         <button onClick={() => updateWinnerCount(activeCategory, currentDist.winnersCount + 1)} className="text-slate-400 hover:text-slate-900"><Plus size={16}/></button>
                      </div>
                   </div>

                   {/* Linea Separadora */}
                   <div className="h-px bg-slate-100 mx-6"></div>
                   
                   <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-3 bg-white mb-20">
                      {activeWinners.map((winner, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                           <span className="text-[10px] font-black text-slate-900 uppercase">{winner.label}</span>
                           <div className="flex items-center gap-6">
                             <span className="text-[10px] font-black text-slate-400">{winner.percentage}%</span>
                             <span className="text-sm font-black text-lime-600">${Math.round(calculateNetForCategory(activeCategory) * (winner.percentage / (100 - leagueData.adminFeePercent))).toLocaleString()}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                   
                   {/* FOOTER TOTAL - DARK THEME */}
                   <div className="absolute bottom-0 left-0 right-0 px-6 py-5 bg-slate-900 flex justify-between items-center border-t border-white/10 z-20 rounded-b-[2.3rem]">
                      <div className="space-y-1">
                          <p className="text-[7px] font-black uppercase text-lime-500 tracking-widest">FONDO NETO GENERAL</p>
                          <p className="text-2xl font-black text-white font-brand leading-none">${Math.round(calculateNetForCategory(activeCategory)).toLocaleString()}</p>
                      </div>
                      <div className="text-right space-y-1">
                          <p className="text-[7px] font-black uppercase text-rose-400 tracking-widest">ADMIN ({leagueData.adminFeePercent}%)</p>
                          <p className="text-lg font-black text-white/80 font-brand leading-none">${Math.round(calculateTotalGrossForCategory(activeCategory) * (leagueData.adminFeePercent / 100)).toLocaleString()}</p>
                      </div>
                   </div>
                </Card>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                <div className="text-center space-y-1"><h4 className="text-xl font-black font-brand uppercase tracking-tighter text-slate-900">INVITA A TU <span className="text-lime-600">GRUPO.</span></h4></div>
                <Card className="p-5 rounded-[1.8rem] border-slate-200 shadow-sm space-y-3 relative z-10">
                   <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Buscar amigos..." className="w-full h-11 pl-11 pr-4 bg-white border border-slate-300 rounded-xl outline-none focus:border-lime-500 font-bold text-xs text-slate-900 placeholder:text-slate-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                   {searchQuery && filteredSearch.length > 0 && (
                     <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                        {filteredSearch.map(name => (
                          <button key={name} onClick={() => handleAddExistingUser(name)} className="w-full flex items-center gap-3 p-2.5 hover:bg-lime-50 rounded-xl transition-all"><img src={`https://picsum.photos/seed/${name}/40/40`} className="w-8 h-8 rounded-lg" /><span className="text-xs font-black text-slate-900 uppercase">{name}</span><Plus size={14} className="ml-auto text-lime-500" /></button>
                        ))}
                     </div>
                   )}
                </Card>
                <Card className={`p-5 rounded-[1.8rem] border-2 shadow-sm space-y-3 relative transition-all duration-500 z-20 overflow-visible ${foundExistingUser ? 'bg-lime-50 border-lime-400' : 'bg-white border-slate-200'}`}>
                   <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block">INVITAR NUEVO</span>
                   <div className="grid grid-cols-1 gap-2 relative">
                      
                      <div className="space-y-1 relative" ref={selectorRef}>
                         <div className="flex gap-2">
                             <button 
                                type="button"
                                className="flex items-center gap-2 px-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors min-w-[100px]"
                                onClick={() => setIsCountrySelectorOpen(!isCountrySelectorOpen)}
                              >
                                 <img 
                                   src={`https://flagcdn.com/w40/${selectedCountry.iso}.png`}
                                   srcSet={`https://flagcdn.com/w80/${selectedCountry.iso}.png 2x`}
                                   width="24"
                                   alt={selectedCountry.name}
                                   className="rounded-sm object-cover shadow-sm"
                                 />
                                 <span className="text-xs font-bold text-slate-700">{selectedCountry.code}</span>
                                 <ChevronDown size={14} className="text-slate-400 ml-auto" />
                              </button>
                             <Input 
                                placeholder="Celular" 
                                value={newUserInput.phone} 
                                onChange={handlePhoneChange} 
                                className={`h-10 text-xs font-bold rounded-xl ${inputErrors.phone ? 'border-rose-400 focus:border-rose-500' : ''}`} 
                                // leftIcon={<Phone size={14}/>} 
                             />
                         </div>
                         {isCountrySelectorOpen && (
                            <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 w-72 p-2 animate-in fade-in slide-in-from-top-2">
                               <div className="relative mb-2">
                                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input 
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-lime-100" 
                                    placeholder="Buscar país..." 
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                  />
                               </div>
                               <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-custom">
                                  {filteredCountries.map(c => (
                                     <button 
                                       key={c.name}
                                       type="button"
                                       className="w-full flex items-center gap-3 p-2 hover:bg-lime-50 rounded-xl transition-colors text-left group"
                                       onClick={() => { setSelectedCountry(c); setIsCountrySelectorOpen(false); setCountrySearch(''); }}
                                     >
                                        <img 
                                          src={`https://flagcdn.com/w40/${c.iso}.png`}
                                          srcSet={`https://flagcdn.com/w80/${c.iso}.png 2x`}
                                          width="24"
                                          alt={c.name}
                                          className="rounded-sm shadow-sm group-hover:scale-110 transition-transform"
                                        />
                                        <div className="flex-1">
                                           <p className="text-xs font-bold text-slate-900">{c.name}</p>
                                           <p className="text-[10px] font-medium text-slate-500">{c.code}</p>
                                        </div>
                                        {selectedCountry.code === c.code && <Check size={14} className="text-lime-600" />}
                                     </button>
                                  ))}
                               </div>
                            </div>
                         )}
                         {inputErrors.phone && <p className="text-[9px] text-rose-500 font-bold ml-1 mt-1 animate-in slide-in-from-top-1">{inputErrors.phone}</p>}
                      </div>

                      <div className="space-y-1 relative z-0">
                        <EmailAutocompleteInput 
                          placeholder="Correo" 
                          value={newUserInput.email} 
                          onValueChange={handleEmailChange} 
                          className={`h-10 text-xs font-bold rounded-xl ${inputErrors.email ? 'border-rose-400 focus:border-rose-500' : ''}`} 
                          leftIcon={<Mail size={14}/>} 
                          disabled={foundExistingUser} 
                        />
                        {inputErrors.email && <p className="text-[9px] text-rose-500 font-bold ml-1 animate-in slide-in-from-top-1">{inputErrors.email}</p>}
                      </div>
                      
                      {foundExistingUser && (
                         <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-lime-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <img src={MOCK_DB.find(u => u.phone === newUserInput.phone)?.avatar} className="w-10 h-10 rounded-lg shadow-sm" />
                            <div>
                               <p className="text-[10px] font-black text-lime-700 uppercase tracking-tight">¡Usuario Encontrado!</p>
                               <p className="text-[10px] font-bold text-slate-600">{newUserInput.name}</p>
                            </div>
                            <div className="ml-auto bg-lime-100 rounded-full p-1">
                                <CheckCircle2 size={16} className="text-lime-600" />
                            </div>
                         </div>
                      )}

                      <Button 
                        onClick={handleAddUser} 
                        variant={foundExistingUser ? 'secondary' : 'outline'} 
                        className={`h-10 rounded-xl font-black text-[9px] uppercase tracking-widest mt-2 ${foundExistingUser ? 'shadow-lg shadow-lime-500/20' : 'border-slate-300 text-slate-500 hover:text-lime-700 hover:border-lime-400'}`}
                        disabled={!!inputErrors.email || !!inputErrors.phone || !newUserInput.email || !newUserInput.phone}
                      >
                        {foundExistingUser ? 'AGREGAR USUARIO' : 'AGREGAR INVITADO'} <Plus size={14} className="ml-2"/>
                      </Button>
                   </div>
                </Card>
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">INVITADOS ({invitedUsers.length}/{leagueData.participantsCount})</span>
                   <div className="grid grid-cols-1 gap-2 overflow-y-auto scrollbar-hide pb-2">
                      {invitedUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl"><div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">{user.avatar ? <img src={user.avatar} className="w-full h-full rounded-lg" /> : <UserPlus size={14}/>}</div><div className="flex-1"><p className="text-[11px] font-black text-slate-900 uppercase leading-none mb-1">{user.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{user.phone} • {user.email}</p></div><button onClick={() => setInvitedUsers(invitedUsers.filter(u => u.id !== user.id))} className="text-rose-400 hover:text-rose-600"><X size={14}/></button></div>
                      ))}
                   </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {/* Summary Card RE-DESIGNED */}
                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl mt-4">
                    {/* Header */}
                    <div className="bg-slate-900 p-6 flex justify-between items-center">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                              <Trophy size={24} />
                            </div>
                            <h3 className="text-2xl font-black font-brand text-white uppercase truncate">
                              {leagueData.name || 'MI LIGA'}
                            </h3>
                        </div>
                        <div className="shrink-0">
                           <Badge color={leagueData.privacy === 'private' ? 'bg-slate-800 text-slate-200 border border-slate-700 pl-2 pr-3' : 'bg-lime-400 text-black border border-lime-300 pl-2 pr-3'}>
                             <div className="flex items-center gap-1.5">
                               {leagueData.privacy === 'private' ? <Lock size={10} /> : <Globe size={10} />}
                               <span className="text-[9px]">{leagueData.privacy === 'private' ? 'PRIVADA' : 'PÚBLICA'}</span>
                             </div>
                           </Badge>
                        </div>
                    </div>

                    {/* Details Body */}
                    <div className="p-6 space-y-6">
                        {/* Sub-header info */}
                        <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">ID DE LIGA</p>
                                <p className="text-sm font-mono font-bold text-slate-700">#{leagueId}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">PLAN</p>
                                <div className="flex items-center gap-1.5 justify-end">
                                   {leagueData.plan === 'diamond' ? <Diamond size={12} className="text-cyan-500"/> : <Sparkles size={12} className="text-amber-500"/>}
                                   <span className="text-xs font-black text-slate-900 uppercase">{leagueData.plan === 'free' ? 'GRATUITO' : leagueData.plan}</span>
                                </div>
                            </div>
                        </div>

                        {/* Costos de Entrada */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                <Coins size={12} /> COSTOS POR JUGADOR
                            </div>
                            <div className="bg-slate-50 rounded-xl p-1 space-y-1">
                                {!leagueData.includeBaseFee && !leagueData.includeStageFees ? (
                                   <div className="p-2 text-center text-xs font-black text-lime-600 uppercase">SIN COSTO DE INSCRIPCIÓN</div>
                                ) : (
                                  <>
                                    {leagueData.includeBaseFee && (
                                      <div className="flex justify-between items-center p-2 px-3 bg-white rounded-lg shadow-sm">
                                        <span className="text-[10px] font-black uppercase text-slate-700">CUOTA BASE</span>
                                        <span className="text-xs font-bold text-slate-900">${parseInt(leagueData.baseFeeAmount).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {leagueData.includeStageFees && leagueData.stageFees.match.active && (
                                      <div className="flex justify-between items-center p-2 px-3 bg-white rounded-lg shadow-sm border border-slate-100/50">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">POR PARTIDO</span>
                                        <span className="text-xs font-bold text-slate-900">${parseInt(leagueData.stageFees.match.amount).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {leagueData.includeStageFees && leagueData.stageFees.round.active && (
                                      <div className="flex justify-between items-center p-2 px-3 bg-white rounded-lg shadow-sm border border-slate-100/50">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">POR RONDA</span>
                                        <span className="text-xs font-bold text-slate-900">${parseInt(leagueData.stageFees.round.amount).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {leagueData.includeStageFees && leagueData.stageFees.phase.active && (
                                      <div className="flex justify-between items-center p-2 px-3 bg-white rounded-lg shadow-sm border border-slate-100/50">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">POR FASE</span>
                                        <span className="text-xs font-bold text-slate-900">${parseInt(leagueData.stageFees.phase.amount).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                            </div>
                        </div>
                        
                        {/* Totals Breakdown */}
                        <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
                           <div className="relative z-10 space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Calculator size={14} className="text-lime-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">DISTRIBUCIÓN DE FONDOS</span>
                              </div>
                              
                              <div className="flex justify-between items-center text-xs opacity-80">
                                 <span>Recaudo Bruto</span>
                                 <span className="font-mono">${totalPotentialGross.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs text-rose-400">
                                 <span>Admin ({leagueData.adminFeePercent}%)</span>
                                 <span className="font-mono">-${totalAdminFee.toLocaleString()}</span>
                              </div>
                              <div className="h-px bg-white/10 my-2"></div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase text-lime-400">BOLSA DE PREMIOS</span>
                                 <span className="text-xl font-black font-brand">${totalNetPrizes.toLocaleString()}</span>
                              </div>
                           </div>
                           {/* Decoration */}
                           <div className="absolute -top-10 -right-10 w-32 h-32 bg-lime-500/10 rounded-full blur-2xl"></div>
                        </div>

                        <button onClick={() => setStep(2)} className="w-full text-center text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 pt-2">
                            <Eye size={12} /> REVISAR CONFIGURACIÓN
                        </button>
                    </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 flex flex-col items-center">
                <div className="text-center space-y-2">
                    <h4 className="text-2xl font-black font-brand uppercase tracking-tighter text-slate-900">
                    ¡LIGA <span className="text-lime-600">LISTA!</span>
                    </h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">COMPARTE TU TICKET DE INVITACIÓN.</p>
                </div>

                {/* Ticket Card - EXTENDED VERSION */}
                <div className="w-full max-w-sm bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl text-white transform transition-all hover:scale-[1.01] duration-500">
                    
                    {/* Top Part */}
                    <div className="p-8 flex flex-col items-center text-center space-y-6 relative pb-8">
                        
                        {/* Glossy effect */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        {/* Icon */}
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-lime-600 shadow-lg shadow-lime-900/50 relative z-10">
                            <Trophy size={40} strokeWidth={1.5} />
                        </div>
                        
                        <div className="space-y-2 relative z-10">
                            <h3 className="text-2xl font-black font-brand uppercase leading-tight tracking-tight text-white">
                              {leagueData.name || 'POLLA MUNDIALISTA'}
                            </h3>
                            <p className="text-[10px] font-black text-lime-500 uppercase tracking-[0.2em]">INVITACIÓN EXCLUSIVA</p>
                        </div>

                        {/* Grid Info High Level */}
                        <div className="grid grid-cols-2 gap-4 w-full pt-2">
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col items-center gap-1">
                                <Calendar size={14} className="text-slate-400 mb-1" />
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">INICIO</p>
                                <p className="text-xs font-bold text-white">11 JUN 2026</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col items-center gap-1">
                                <Wallet size={14} className="text-slate-400 mb-1" />
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CUOTA</p>
                                <p className="text-xs font-bold text-lime-400">
                                  {leagueData.includeBaseFee 
                                    ? `$${parseInt(leagueData.baseFeeAmount).toLocaleString()}` 
                                    : 'GRATIS'}
                                </p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col items-center gap-1">
                                <Trophy size={14} className="text-slate-400 mb-1" />
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">BOLSA EST.</p>
                                <p className="text-xs font-bold text-white">${totalNetPrizes.toLocaleString()}</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-3 border border-white/10 flex flex-col items-center gap-1">
                                {leagueData.privacy === 'private' ? <Lock size={14} className="text-slate-400 mb-1" /> : <Globe size={14} className="text-slate-400 mb-1" />}
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">TIPO</p>
                                <p className="text-xs font-bold text-white">{leagueData.privacy === 'private' ? 'PRIVADA' : 'PÚBLICA'}</p>
                            </div>
                        </div>

                        {/* Detailed Breakdown Section (The "Complete" Information) */}
                        <div className="w-full space-y-4 pt-4 border-t border-white/10 mt-2">
                             
                             {/* Costos Detallados */}
                             {(leagueData.includeBaseFee || leagueData.includeStageFees) && (
                               <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                                  <div className="flex items-center gap-2 mb-3">
                                     <Coins size={12} className="text-lime-400" />
                                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DESGLOSE DE APORTES</span>
                                  </div>
                                  <div className="space-y-2">
                                     {leagueData.includeBaseFee && (
                                       <div className="flex justify-between text-[10px] font-bold">
                                          <span className="text-slate-300">CUOTA BASE</span>
                                          <span className="text-white">${parseInt(leagueData.baseFeeAmount).toLocaleString()}</span>
                                       </div>
                                     )}
                                     {leagueData.includeStageFees && leagueData.stageFees.match.active && (
                                       <div className="flex justify-between text-[10px] font-bold">
                                          <span className="text-slate-300">POR PARTIDO</span>
                                          <span className="text-white">${parseInt(leagueData.stageFees.match.amount).toLocaleString()}</span>
                                       </div>
                                     )}
                                     {leagueData.includeStageFees && leagueData.stageFees.round.active && (
                                       <div className="flex justify-between text-[10px] font-bold">
                                          <span className="text-slate-300">POR RONDA</span>
                                          <span className="text-white">${parseInt(leagueData.stageFees.round.amount).toLocaleString()}</span>
                                       </div>
                                     )}
                                     {leagueData.includeStageFees && leagueData.stageFees.phase.active && (
                                       <div className="flex justify-between text-[10px] font-bold">
                                          <span className="text-slate-300">POR FASE</span>
                                          <span className="text-white">${parseInt(leagueData.stageFees.phase.amount).toLocaleString()}</span>
                                       </div>
                                     )}
                                  </div>
                               </div>
                             )}

                             {/* Distribución de Fondos */}
                             <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left">
                                  <div className="flex items-center gap-2 mb-3">
                                     <Calculator size={12} className="text-lime-400" />
                                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DISTRIBUCIÓN ESTIMADA</span>
                                  </div>
                                  <div className="space-y-2">
                                     <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-slate-400">RECAUDO BRUTO</span>
                                        <span className="text-slate-300 font-mono">${totalPotentialGross.toLocaleString()}</span>
                                     </div>
                                     <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-rose-400">ADMIN ({leagueData.adminFeePercent}%)</span>
                                        <span className="text-rose-400 font-mono">-${totalAdminFee.toLocaleString()}</span>
                                     </div>
                                     <div className="h-px bg-white/10 my-1"></div>
                                     <div className="flex justify-between text-xs font-black">
                                        <span className="text-lime-400 uppercase">BOLSA PREMIOS</span>
                                        <span className="text-white font-brand">${totalNetPrizes.toLocaleString()}</span>
                                     </div>
                                  </div>
                             </div>
                        </div>

                    </div>

                    {/* Divider with notches */}
                    <div className="relative flex items-center justify-center h-6 bg-slate-900">
                         <div className="absolute left-0 w-8 h-8 bg-white rounded-full -translate-x-1/2"></div>
                         <div className="w-full border-t-2 border-dashed border-white/10 mx-10"></div>
                         <div className="absolute right-0 w-8 h-8 bg-white rounded-full translate-x-1/2"></div>
                    </div>

                    {/* Bottom Part */}
                    <div className="p-8 pt-6 flex items-center justify-between bg-slate-900 relative">
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">CÓDIGO DE ACCESO</p>
                            <p className="text-3xl font-black font-brand text-white tracking-widest">{leagueId}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">A</div>
                                <p className="text-[10px] font-bold text-slate-400">Admin: Tú</p>
                            </div>
                         </div>
                         <div className="bg-white p-2 rounded-xl">
                            <QrCode size={64} className="text-black" />
                         </div>
                    </div>
                </div>
                
                {/* Share Buttons */}
                <div className="flex gap-3 w-full max-w-sm justify-between">
                    <button className="flex-1 h-14 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform hover:shadow-[#25D366]/30">
                        <MessageCircle size={24} fill="white" />
                    </button>
                    <button className="flex-1 h-14 rounded-2xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform hover:shadow-purple-500/30">
                        <Instagram size={24} />
                    </button>
                    <button className="flex-1 h-14 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform hover:shadow-black/30">
                        <Twitter size={24} fill="white" />
                    </button>
                    <button onClick={() => {navigator.clipboard.writeText(leagueId)}} className="flex-1 h-14 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center shadow-lg hover:scale-105 transition-transform hover:bg-slate-300">
                        <Download size={24} />
                    </button>
                </div>

                <div className="w-full pt-4 flex gap-4">
                     <Button 
                        variant="outline" 
                        className="w-16 h-16 rounded-full border-2 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 p-0 flex items-center justify-center shrink-0" 
                        onClick={() => setStep(5)}
                    >
                        <ArrowLeft size={24} />
                    </Button>
                    <Button 
                        variant="secondary" 
                        className="flex-1 h-16 rounded-[2rem] font-black text-[12px] tracking-[0.2em] shadow-2xl hover:bg-lime-500 hover:scale-[1.02] transition-all" 
                        onClick={handleFinish}
                    >
                        FINALIZAR E IR AL TABLERO 
                        <ArrowRight size={24} className="ml-2" />
                    </Button>
                </div>

                <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest text-slate-300">
                    <span className="flex items-center gap-1"><ShieldCheck size={12} /> ENCRIPTADO</span>
                    <span className="flex items-center gap-1"><Globe size={12} /> MUNDIAL 2026</span>
                </div>
              </div>
            )}
            
          </div>

          {step !== 6 && (
            <div className="mt-6 flex gap-3 pt-6 border-t border-slate-200 relative z-20">
               {step > 1 && <Button variant="outline" className="w-16 h-16 rounded-[1.8rem] border-slate-300 text-slate-500 hover:text-slate-900" onClick={() => setStep(step - 1)}><ArrowLeft size={24} /></Button>}
               {step < 6 && (
                  <Button 
                      variant="secondary" 
                      className={`flex-1 h-16 rounded-[1.8rem] font-black text-[12px] tracking-[0.2em] shadow-2xl transition-all ${
                      step === 3 && isLimitExceeded && leagueData.plan === 'free' 
                          ? 'bg-slate-200 text-slate-400 hover:bg-slate-200 shadow-none' 
                          : 'bg-lime-400 text-slate-950 hover:bg-lime-500'
                      } ${step === 3 && !isFinancialValid && !isLimitExceeded ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} 
                      onClick={() => { 
                      if (step === 3) {
                          if (isLimitExceeded && leagueData.plan === 'free') {
                              onViewChange('checkout');
                              return;
                          }
                          if (!isFinancialValid) return;
                      }
                      step < 6 ? setStep(step + 1) : handleFinish(); 
                      }} 
                      disabled={step === 1 && leagueData.name.length < 3}
                  >
                      {step === 3 && isLimitExceeded && leagueData.plan === 'free' ? 'MEJORAR PLAN PARA CONTINUAR' : 'SIGUIENTE PASO'} 
                      <ArrowRight size={24} className="ml-2" />
                  </Button>
               )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CreateLeague;

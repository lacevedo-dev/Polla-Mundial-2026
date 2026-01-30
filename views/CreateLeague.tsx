
import React from 'react';
import { Button, Card, Badge, Input } from '../components/UI';
import { AppView } from '../types';
import { 
  Trophy, 
  Users, 
  Settings, 
  Share2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  QrCode, 
  MessageCircle,
  Sparkles,
  Zap,
  Lock,
  Globe,
  Target,
  Camera,
  Search,
  UserPlus,
  Check,
  X,
  ShieldCheck,
  Coins,
  CalendarDays,
  ListFilter,
  Smartphone
} from 'lucide-react';

interface CreateLeagueProps {
  onViewChange: (view: AppView) => void;
}

const CreateLeague: React.FC<CreateLeagueProps> = ({ onViewChange }) => {
  const [step, setStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [invitedFriends, setInvitedFriends] = React.useState<string[]>([]);
  const [inviteLink] = React.useState(`polla2026.co/invite/${Math.random().toString(36).substring(7)}`);
  
  const [leagueData, setLeagueData] = React.useState({
    name: '',
    privacy: 'private',
    logo: null as string | null,
    logoFile: null as File | null,
    feeType: 'general' as 'general' | 'variable',
    generalFee: '0',
    variableType: 'match' as 'match' | 'round' | 'phase',
    variableAmount: '0',
    currency: 'COP'
  });

  const currencies = [
    { code: 'COP', label: 'Peso Colombiano', symbol: '$' },
    { code: 'USD', label: 'Dólar (USD)', symbol: 'u$s' },
    { code: 'MXN', label: 'Peso Mexicano', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: '€' }
  ];

  // Amigos sugeridos (Mock data)
  const friendsList = [
    { id: '1', name: 'Carlos Rodríguez', handle: '@crodriguez', avatar: '11' },
    { id: '2', name: 'Ana María Silva', handle: '@amsilva', avatar: '12' },
    { id: '3', name: 'Juan Diego Gómez', handle: '@jdgomez', avatar: '13' },
    { id: '4', name: 'Laura Beltrán', handle: '@lbeltran', avatar: '14' },
    { id: '5', name: 'Andrés Felipe', handle: '@afelipe', avatar: '15' },
  ].filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.handle.toLowerCase().includes(searchQuery.toLowerCase()));

  // Lógica de formateo inteligente (Title Case con excepciones en minúscula)
  const formatLeagueName = (str: string) => {
    const exceptions = ['de', 'la', 'del', 'el', 'en', 'y', 'los', 'las', 'con', 'para', 'o', 'a'];
    return str.toLowerCase().split(' ').map((word, index) => {
      if (index > 0 && exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const handleNameChange = (val: string) => {
    const formatted = formatLeagueName(val);
    setLeagueData({ ...leagueData, name: formatted });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLeagueData({ ...leagueData, logo: reader.result as string, logoFile: file });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleInvite = (id: string) => {
    setInvitedFriends(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const getInviteMessage = () => {
    const cost = leagueData.feeType === 'general' 
      ? `${currencies.find(c => c.code === leagueData.currency)?.symbol}${leagueData.generalFee} ${leagueData.currency}`
      : `${currencies.find(c => c.code === leagueData.currency)?.symbol}${leagueData.variableAmount} ${leagueData.currency} por ${leagueData.variableType === 'match' ? 'partido' : leagueData.variableType === 'round' ? 'ronda' : 'fase'}`;
    
    return encodeURIComponent(`🏆 ¡Hola! Te invito a mi polla oficial del Mundial 2026: *${leagueData.name}*. \n\n⚽ Participar cuesta: ${cost}. \n\nÚnete aquí y haz tus pronósticos: ${inviteLink}`);
  };

  const handleWhatsAppShare = () => {
    window.open(`https://wa.me/?text=${getInviteMessage()}`, '_blank');
  };

  const handleNext = () => {
    if (step < 4) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setStep(step + 1);
      }, 600);
    } else {
      onViewChange('dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-700">
        
        {/* Stepper Header */}
        <div className="flex justify-between items-end px-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black font-brand uppercase tracking-tighter">CREA TU <span className="text-lime-500">POLLA.</span></h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Configuración Mundial 2026</p>
          </div>
          <div className="flex gap-1.5 mb-1">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${step >= s ? 'bg-lime-400' : 'bg-slate-200'}`}></div>
            ))}
          </div>
        </div>

        <Card className="p-8 md:p-12 shadow-2xl relative overflow-hidden border-0 bg-white">
          <div className="absolute top-0 left-0 w-full h-2 bg-lime-400"></div>
          
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2 text-center md:text-left">
                <Badge color="bg-lime-100 text-lime-700">Paso 1: Identidad</Badge>
                <h2 className="text-2xl font-black font-brand uppercase">Identidad de la Polla</h2>
                <p className="text-slate-500 text-sm font-medium">Dale un nombre épico y una imagen que los represente.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                {/* Logo Upload Section */}
                <div className="relative group shrink-0">
                  <div className={`w-32 h-32 rounded-3xl border-2 border-dashed flex items-center justify-center transition-all overflow-hidden ${leagueData.logo ? 'border-lime-400 bg-lime-50' : 'border-slate-200 bg-slate-50 hover:border-slate-400 shadow-inner'}`}>
                    {leagueData.logo ? (
                      <img src={leagueData.logo} className="w-full h-full object-cover" alt="Logo preview" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <Camera size={24} />
                        <span className="text-[8px] font-black uppercase tracking-widest mt-2">Logo Opcional</span>
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={() => document.getElementById('logo-up')?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">Cambiar</span>
                    </button>
                  </div>
                  <input id="logo-up" type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>

                <div className="flex-1 space-y-6 w-full">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre de la Polla *</label>
                    <Input 
                      placeholder="Ej: Los Cracks de la Cuadra" 
                      value={leagueData.name} 
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="text-lg font-bold h-14"
                      autoFocus
                    />
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Formateo automático profesional activo</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Privacidad de la Liga</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        type="button"
                        onClick={() => setLeagueData({...leagueData, privacy: 'private'})}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${leagueData.privacy === 'private' ? 'border-lime-400 bg-lime-50/50 shadow-lg shadow-lime-400/10' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <Lock size={20} className={leagueData.privacy === 'private' ? 'text-lime-600' : 'text-slate-400'} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Privada</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setLeagueData({...leagueData, privacy: 'public'})}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${leagueData.privacy === 'public' ? 'border-lime-400 bg-lime-50/50 shadow-lg shadow-lime-400/10' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <Globe size={20} className={leagueData.privacy === 'public' ? 'text-lime-600' : 'text-slate-400'} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Pública</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <Badge color="bg-lime-100 text-lime-700">Paso 2: Finanzas</Badge>
                <h2 className="text-2xl font-black font-brand uppercase leading-tight">Costos de Participación</h2>
                <p className="text-slate-500 text-sm font-medium">Define la moneda y cuánto deben aportar los jugadores.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Moneda del Torneo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currencies.map(curr => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => setLeagueData({...leagueData, currency: curr.code})}
                        className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${leagueData.currency === curr.code ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                      >
                        <span className="text-xs font-black">{curr.code}</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">{curr.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setLeagueData({...leagueData, feeType: 'general'})}
                    className={`p-6 rounded-3xl border-2 text-left transition-all space-y-2 ${leagueData.feeType === 'general' ? 'border-lime-400 bg-lime-50/50 shadow-lg shadow-lime-400/10' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <Coins size={24} className={leagueData.feeType === 'general' ? 'text-lime-600' : 'text-slate-400'} />
                      {leagueData.feeType === 'general' && <CheckCircle2 size={16} className="text-lime-600" />}
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-widest">Costo Único</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Se paga una sola vez por todo el Mundial.</p>
                  </button>

                  <button 
                    type="button"
                    onClick={() => setLeagueData({...leagueData, feeType: 'variable'})}
                    className={`p-6 rounded-3xl border-2 text-left transition-all space-y-2 ${leagueData.feeType === 'variable' ? 'border-lime-400 bg-lime-50/50 shadow-lg shadow-lime-400/10' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <CalendarDays size={24} className={leagueData.feeType === 'variable' ? 'text-lime-600' : 'text-slate-400'} />
                      {leagueData.feeType === 'variable' && <CheckCircle2 size={16} className="text-lime-600" />}
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-widest">Costo por Etapa</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-tight">Pagos por cada partido, ronda o fase.</p>
                  </button>
                </div>

                {leagueData.feeType === 'general' ? (
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-300">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Valor de Inscripción ({leagueData.currency}) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                        {currencies.find(c => c.code === leagueData.currency)?.symbol}
                      </span>
                      <Input 
                        type="number"
                        placeholder="Ej: 50000"
                        className="pl-8 text-xl font-black h-14"
                        value={leagueData.generalFee}
                        onChange={(e) => setLeagueData({...leagueData, generalFee: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Frecuencia Seleccionable</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'match', label: 'Partido', icon: Zap },
                          { id: 'round', label: 'Ronda', icon: ListFilter },
                          { id: 'phase', label: 'Fase', icon: Trophy }
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setLeagueData({...leagueData, variableType: item.id as any})}
                            className={`py-4 px-1 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${leagueData.variableType === item.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 shadow-sm'}`}
                          >
                            <item.icon size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Valor por {leagueData.variableType === 'match' ? 'Partido' : leagueData.variableType === 'round' ? 'Ronda' : 'Fase'} ({leagueData.currency}) *</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                          {currencies.find(c => c.code === leagueData.currency)?.symbol}
                        </span>
                        <Input 
                          type="number"
                          placeholder="Ej: 5000"
                          className="pl-8 text-xl font-black h-14"
                          value={leagueData.variableAmount}
                          onChange={(e) => setLeagueData({...leagueData, variableAmount: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <Badge color="bg-lime-100 text-lime-700">Paso 3: Comunidad</Badge>
                <h2 className="text-2xl font-black font-brand uppercase leading-tight">Invita a tus Amigos</h2>
                <p className="text-slate-500 text-sm font-medium">Tú eres el Administrador. Selecciona a quién quieres invitar.</p>
              </div>

              {/* Buscar y Agregar Amigos */}
              <div className="space-y-4">
                <div className="relative group">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre o @usuario..." 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-lime-400 transition-all text-sm font-bold shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar scroll-smooth">
                  {friendsList.length > 0 ? friendsList.map((friend) => (
                    <div key={friend.id} className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${invitedFriends.includes(friend.id) ? 'bg-lime-50 border-lime-200 shadow-md translate-x-1' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3">
                        <img src={`https://picsum.photos/seed/user${friend.avatar}/40/40`} className="w-10 h-10 rounded-full ring-2 ring-white" />
                        <div>
                          <p className="text-sm font-black text-slate-900">{friend.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{friend.handle}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => toggleInvite(friend.id)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${invitedFriends.includes(friend.id) ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {invitedFriends.includes(friend.id) ? <Check size={18} /> : <UserPlus size={18} />}
                      </button>
                    </div>
                  )) : (
                    <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay coincidencias</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Roles Section */}
              <div className="p-5 bg-slate-900 rounded-[2rem] flex items-center justify-between text-white overflow-hidden relative shadow-2xl">
                <ShieldCheck size={100} className="absolute -right-6 -bottom-6 opacity-10 rotate-12" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-12 h-12 bg-lime-400 text-black rounded-2xl flex items-center justify-center font-black shadow-lg">AD</div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-400 mb-0.5">Rol Confirmado</p>
                    <p className="text-sm font-black uppercase tracking-tight">Tú eres el Administrador Principal</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center">
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 bg-lime-400/20 rounded-full animate-ping"></div>
                <div className="w-32 h-32 bg-lime-400 text-black rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-lime-400/30 relative z-10 overflow-hidden border-4 border-white rotate-3">
                  {leagueData.logo ? (
                    <img src={leagueData.logo} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl font-black font-brand leading-none">{leagueData.name.charAt(0)}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Badge color="bg-lime-100 text-lime-700">¡Polla Activada!</Badge>
                <h2 className="text-3xl font-black font-brand uppercase tracking-tighter leading-[0.9]">EL TORNEO <br/>ESTÁ LISTO</h2>
                <p className="text-slate-500 font-bold italic text-xl">"{leagueData.name}"</p>
                
                <div className="mt-6 flex flex-col items-center">
                   <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl">
                      <Coins size={16} className="text-lime-400" />
                      Costo: {leagueData.feeType === 'general' 
                        ? `${currencies.find(c => c.code === leagueData.currency)?.symbol}${leagueData.generalFee} ${leagueData.currency} Total` 
                        : `${currencies.find(c => c.code === leagueData.currency)?.symbol}${leagueData.variableAmount} ${leagueData.currency} por ${leagueData.variableType === 'match' ? 'Partido' : leagueData.variableType === 'round' ? 'Ronda' : 'Fase'}`}
                   </div>
                </div>
              </div>

              <div className="space-y-6 max-w-sm mx-auto pt-4">
                <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-start gap-2 shadow-inner">
                  <div className="flex justify-between w-full items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enlace de Invitación</p>
                    <button 
                      type="button"
                      className="text-[9px] font-black text-lime-600 uppercase tracking-widest hover:underline"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('¡Enlace copiado con éxito!');
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 break-all">{inviteLink}</span>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="secondary" 
                    className="w-full gap-3 bg-[#25D366] hover:bg-[#20bd5c] text-white border-none h-16 rounded-[2rem] font-black text-sm uppercase shadow-2xl shadow-[#25D366]/30 group"
                    onClick={handleWhatsAppShare}
                  >
                    <MessageCircle size={20} className="group-hover:scale-110 transition-transform" /> 
                    INVITAR POR WHATSAPP
                  </Button>
                  <Button variant="outline" className="w-full gap-3 border-slate-200 h-16 rounded-[2rem] font-black text-xs uppercase tracking-widest text-slate-500 hover:text-black transition-all">
                    <Smartphone size={18} /> COMPARTIR POR SMS
                  </Button>
                  <div className="flex justify-center gap-4 pt-2">
                    <button type="button" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 hover:text-black">
                      <QrCode size={14} /> DESCARGAR QR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-50 flex gap-4">
            {step > 1 && step < 4 && (
              <Button 
                variant="ghost" 
                onClick={() => setStep(step - 1)} 
                className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 hover:text-black" 
                disabled={isLoading}
              >
                <ArrowLeft size={16} className="mr-2" /> Atrás
              </Button>
            )}
            <Button 
              className={`flex-1 h-16 rounded-[2rem] font-black text-sm gap-2 tracking-[0.2em] shadow-xl transition-all ${step === 4 ? 'bg-black text-white' : 'shadow-lime-400/20'}`} 
              variant={step === 4 ? "primary" : "secondary"}
              onClick={handleNext}
              isLoading={isLoading}
              disabled={(step === 1 && !leagueData.name) || (step === 2 && (leagueData.feeType === 'general' ? !leagueData.generalFee : !leagueData.variableAmount))}
            >
              {step === 4 ? 'IR AL TABLERO' : 'CONTINUAR'} <ArrowRight size={20} />
            </Button>
          </div>
        </Card>

        {step < 4 && (
          <div className="flex justify-center gap-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-300" />
              <span>Límite: 10 Jugadores</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={14} className="text-slate-300" />
              <span>Predet: {currencies.find(c => c.code === leagueData.currency)?.code}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateLeague;

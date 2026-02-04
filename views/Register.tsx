
import React from 'react';
import { Button, Input, EmailAutocompleteInput, AutocompleteInput, Badge, Checkbox } from '../components/UI';
import { AppView } from '../types';
import { 
  CheckCircle2, 
  CheckCircle, 
  User, 
  Lock, 
  ArrowLeft,
  UploadCloud,
  XCircle,
  AlertCircle,
  Sparkles,
  Calendar,
  ArrowRight,
  ChevronDown,
  Search,
  RefreshCcw,
  FileWarning,
  LogIn,
  Check
} from 'lucide-react';

interface RegisterProps {
  onViewChange: (view: AppView) => void;
  onRegisterSuccess: (email: string) => void;
}

type RegisterStep = 1 | 2 | 3;

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
const EXISTING_USERS = [
  { email: 'juan@gmail.com', phone: '3001234567', name: 'Juan Perez', avatar: 'https://picsum.photos/seed/juan/40/40' },
  { email: 'maria@hotmail.com', phone: '3109876543', name: 'Maria Gomez', avatar: 'https://picsum.photos/seed/maria/40/40' },
  { email: 'carlos@outlook.com', phone: '5512345678', name: 'Carlos Ruiz', avatar: 'https://picsum.photos/seed/carlos/40/40' }
];

const Register: React.FC<RegisterProps> = ({ onViewChange, onRegisterSuccess }) => {
  const [step, setStep] = React.useState<RegisterStep>(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  
  // Validation states
  const [nombreStatus, setNombreStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [emailStatus, setEmailStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [phoneStatus, setPhoneStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');
  const [birthDateStatus, setBirthDateStatus] = React.useState<'idle' | 'valid' | 'underage' | 'invalid'>('idle');
  
  // Existing user detected state
  const [existingUser, setExistingUser] = React.useState<{name: string, avatar: string} | null>(null);

  // File upload state
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);
  
  // Phone selection state
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(COUNTRY_CODES[0]);
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const selectorRef = React.useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = React.useState({
    nombre: '',
    celular: '',
    email: '',
    fechaNacimiento: '',
    usuario: '',
    password: '',
    confirmPassword: '',
    foto: null as File | null,
    fotoPreview: '' as string,
    rememberMe: false
  });

  const [dragActive, setDragActive] = React.useState(false);

  // Helper for Title Case formatting
  const formatToTitleCase = (str: string) => {
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsCountrySelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validation for Name
  React.useEffect(() => {
    if (!formData.nombre) {
      setNombreStatus('idle');
      return;
    }
    setNombreStatus(formData.nombre.trim().length >= 3 ? 'valid' : 'invalid');
  }, [formData.nombre]);

  // Validation for Email with Debounce and Mock Check
  React.useEffect(() => {
    const emailValue = formData.email;
    if (!emailValue) {
      setEmailStatus('idle');
      if (phoneStatus !== 'taken') setExistingUser(null);
      return;
    }

    const timer = setTimeout(() => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        setEmailStatus('invalid');
      } else {
        // Check Mock DB
        const found = EXISTING_USERS.find(u => u.email.toLowerCase() === emailValue.toLowerCase());
        if (found) {
          setEmailStatus('taken');
          setExistingUser({ name: found.name, avatar: found.avatar });
        } else {
          setEmailStatus('valid');
          if (phoneStatus !== 'taken') setExistingUser(null);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.email, phoneStatus]);

  // Validation for Phone with Debounce and Mock Check
  React.useEffect(() => {
    const cleanPhone = formData.celular.replace(/\D/g, '');
    if (!formData.celular) {
      setPhoneStatus('idle');
      if (emailStatus !== 'taken') setExistingUser(null);
      return;
    }
    
    const timer = setTimeout(() => {
      let isValidLength = false;
      if (selectedCountry.regex) {
        isValidLength = selectedCountry.regex.test(cleanPhone);
      } else {
        isValidLength = cleanPhone.length === selectedCountry.length;
      }

      if (isValidLength) {
        // Check Mock DB
        const found = EXISTING_USERS.find(u => u.phone === cleanPhone);
        if (found) {
          setPhoneStatus('taken');
          setExistingUser({ name: found.name, avatar: found.avatar });
        } else {
          setPhoneStatus('valid');
          if (emailStatus !== 'taken') setExistingUser(null);
        }
      } else {
        setPhoneStatus('invalid');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.celular, selectedCountry, emailStatus]);

  React.useEffect(() => {
    if (!formData.fechaNacimiento) { setBirthDateStatus('idle'); return; }
    const birthDate = new Date(formData.fechaNacimiento);
    if (isNaN(birthDate.getTime())) { setBirthDateStatus('invalid'); return; }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    setBirthDateStatus(age >= 18 ? 'valid' : 'underage');
  }, [formData.fechaNacimiento]);

  React.useEffect(() => {
    if (!formData.usuario || formData.usuario.length < 3) { setUsernameStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      await new Promise(r => setTimeout(r, 600));
      const taken = ['admin', 'fifa', 'root', 'polla2026'];
      setUsernameStatus(taken.includes(formData.usuario.toLowerCase()) ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.usuario]);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'nombre') {
      const formatted = formatToTitleCase(value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Check for country code paste (e.g. +57300...)
    const matchedCountry = COUNTRY_CODES.find(c => val.startsWith(c.code));
    if (matchedCountry) {
        setSelectedCountry(matchedCountry);
        const stripped = val.replace(matchedCountry.code, '').trim().replace(/\D/g, '');
        // Only update if detecting a paste to avoid overriding user typing
        handleInputChange('celular', stripped);
    } else {
        const cleanVal = val.replace(/\D/g, '');
        if (cleanVal.length <= selectedCountry.length) { 
            handleInputChange('celular', cleanVal); 
        }
    }
  };

  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setFormData(prev => ({ ...prev, foto: null, fotoPreview: '' }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadError("El archivo no es una imagen válida. Usa JPG, PNG o WebP.");
      return;
    }

    const MAX_SIZE_MB = 2;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`La imagen es muy pesada. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    setIsProcessingFile(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setTimeout(() => {
        if (Math.random() < 0.1) {
          setUploadError("Error de procesamiento. Inténtalo de nuevo.");
          setIsProcessingFile(false);
          return;
        }

        setFormData(prev => ({ 
          ...prev, 
          foto: file, 
          fotoPreview: reader.result as string 
        }));
        setIsProcessingFile(false);
      }, 800);
    };

    reader.onerror = () => {
      setUploadError("Error al leer el archivo. Inténtalo de nuevo.");
      setIsProcessingFile(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailStatus === 'taken' || phoneStatus === 'taken') return;

    if (step < 3) {
      setIsNavigating(true);
      setTimeout(() => { setStep((step + 1) as RegisterStep); setIsNavigating(false); }, 400);
      return;
    }
    setIsLoading(true);
    setTimeout(() => { 
      setIsLoading(false); 
      onRegisterSuccess(formData.email); 
      onViewChange('create-league'); 
    }, 2000);
  };

  const requirements = [
    { label: '8+ caracteres', test: (p: string) => p.length >= 8 },
    { label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Coinciden', test: (p: string) => p === formData.confirmPassword && p !== '' },
  ];
  const metCount = requirements.filter(r => r.test(formData.password)).length;

  const isStepValid = () => {
    if (step === 1) return nombreStatus === 'valid' && phoneStatus === 'valid' && emailStatus === 'valid' && birthDateStatus === 'valid';
    if (step === 2) return metCount === requirements.length && usernameStatus === 'available';
    if (step === 3) return !uploadError && !isProcessingFile;
    return true;
  };

  const getImageQuality = () => {
    if (!formData.foto) return null;
    const size = formData.foto.size / 1024;
    if (size < 50) return { label: 'Baja Resolución', color: 'bg-amber-100 text-amber-700', icon: AlertCircle };
    if (size < 500) return { label: 'Óptima', color: 'bg-lime-100 text-lime-700', icon: CheckCircle };
    return { label: 'Alta Definición', color: 'bg-cyan-100 text-cyan-700', icon: Sparkles };
  };
  const quality = getImageQuality();

  const filteredCountries = COUNTRY_CODES.filter(c => 
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || 
    c.code.includes(countrySearch)
  );

  const usernameSuggestions = React.useMemo(() => {
    if (!formData.nombre || formData.nombre.length < 3) return [];
    const cleanName = formData.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "");
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return [];
    const suggestions = new Set<string>();
    const first = parts[0];
    const last = parts[parts.length - 1] || 'user';
    suggestions.add(`${first}${last}`);
    suggestions.add(`${first}.${last}`);
    suggestions.add(`${first}_${last}`);
    suggestions.add(`${first}2026`);
    return Array.from(suggestions).filter(s => s !== formData.usuario).slice(0, 4);
  }, [formData.nombre, formData.usuario]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 py-12">
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
      <div className="max-w-5xl w-full mb-6">
        <button 
          onClick={() => onViewChange('landing')} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Inicio
        </button>
      </div>

      <div className={`max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl min-h-[650px] transition-all duration-700 ${isLoading ? 'scale-[0.98] blur-sm opacity-50' : 'scale-100'}`}>
        
        {/* Lado Izquierdo Branding */}
        <div className="hidden md:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden md:rounded-l-[2.5rem]">
          <div className="relative z-10">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center font-brand text-black font-black mb-8">26</div>
            <h2 className="text-5xl font-black font-brand leading-tight mb-8">CREA TU <span className="text-lime-400">LEGADO.</span></h2>
            <div className="space-y-6">
              {["Predicciones 2026", "Grupos Privados", "Premios Reales", "Seguridad Total"].map((b, i) => (
                <div key={i} className="flex items-center gap-4 text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-lime-400/20 flex items-center justify-center"><CheckCircle2 size={16} className="text-lime-400" /></div>
                  <span className="font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-lime-400/10 rounded-full blur-3xl"></div>
        </div>

        {/* Lado Derecho Formulario */}
        <div className="p-8 md:p-16 flex flex-col h-full relative rounded-[2.5rem] md:rounded-l-none md:rounded-r-[2.5rem]">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black font-brand uppercase tracking-tight">Registro</h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paso {step} de 3</span>
            </div>
            <div className="flex gap-2 h-1.5 mb-8">
              {[1, 2, 3].map(s => <div key={s} className={`flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-lime-400' : 'bg-slate-100'}`}></div>)}
            </div>
          </div>

          <form className={`flex-1 flex flex-col transition-all duration-300 ${isNavigating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`} onSubmit={handleSubmit}>
            
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre Completo *</label>
                  <Input 
                    placeholder="Ej. Juan Pérez" 
                    required 
                    disabled={isLoading} 
                    value={formData.nombre} 
                    onChange={e => handleInputChange('nombre', e.target.value)} 
                    className={nombreStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : ''}
                    rightIcon={nombreStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha de Nacimiento *</label>
                    <span className="text-[9px] font-bold text-slate-400">18+ años</span>
                  </div>
                  <Input type="date" value={formData.fechaNacimiento} onChange={e => handleInputChange('fechaNacimiento', e.target.value)} leftIcon={<Calendar size={16} />}
                    className={birthDateStatus === 'underage' || birthDateStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20' : birthDateStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : ''}
                    rightIcon={birthDateStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                  />
                  {birthDateStatus === 'underage' && <p className="text-[9px] font-bold text-rose-500 ml-1">Debes ser mayor de 18 años.</p>}
                </div>

                <div className={`space-y-2 relative ${isCountrySelectorOpen ? 'z-50' : 'z-0'}`} ref={selectorRef}>
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Celular *</label>
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
                           className="rounded-sm object-cover"
                         />
                         <span className="text-xs font-bold text-slate-700">{selectedCountry.code}</span>
                         <ChevronDown size={14} className="text-slate-400 ml-auto" />
                      </button>
                      <Input 
                        placeholder={selectedCountry.placeholder}
                        value={formData.celular}
                        onChange={handlePhoneChange}
                        className={phoneStatus === 'taken' ? 'border-rose-400 bg-rose-50/20' : phoneStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : ''}
                        rightIcon={phoneStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                      />
                   </div>
                   
                   {isCountrySelectorOpen && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 p-2 animate-in fade-in slide-in-from-top-2">
                         <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-lime-100" 
                              placeholder="Buscar país..." 
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                            />
                         </div>
                         <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-custom">
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
                   {phoneStatus === 'taken' && existingUser && (
                      <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-1">
                         <img src={existingUser.avatar} className="w-8 h-8 rounded-full" alt="User" />
                         <div>
                            <p className="text-[10px] font-bold text-rose-700">Este número ya está registrado.</p>
                            <p className="text-[9px] text-rose-500">Pertenece a {existingUser.name}</p>
                         </div>
                      </div>
                   )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email *</label>
                  <EmailAutocompleteInput 
                    placeholder="tu@email.com" 
                    value={formData.email} 
                    onValueChange={(val) => handleInputChange('email', val)} 
                    className={emailStatus === 'taken' ? 'border-rose-400 bg-rose-50/20' : emailStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : ''}
                    rightIcon={emailStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                  />
                  {emailStatus === 'taken' && existingUser && (
                      <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-1">
                         <img src={existingUser.avatar} className="w-8 h-8 rounded-full" alt="User" />
                         <div>
                            <p className="text-[10px] font-bold text-rose-700">Este correo ya está registrado.</p>
                            <p className="text-[9px] text-rose-500">Pertenece a {existingUser.name}</p>
                         </div>
                      </div>
                   )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuario Único *</label>
                     <span className={`text-[9px] font-bold uppercase ${usernameStatus === 'available' ? 'text-lime-600' : usernameStatus === 'taken' ? 'text-rose-500' : 'text-slate-400'}`}>
                        {usernameStatus === 'checking' ? 'Verificando...' : usernameStatus === 'available' ? '¡Disponible!' : usernameStatus === 'taken' ? 'No disponible' : ''}
                     </span>
                  </div>
                  <AutocompleteInput 
                    placeholder="@usuario" 
                    value={formData.usuario}
                    onValueChange={(val) => handleInputChange('usuario', val.replace(/\s/g, '').toLowerCase())}
                    suggestions={usernameSuggestions}
                    suggestionTitle="Sugerencias Disponibles"
                    leftIcon={<User size={16} />}
                    className={usernameStatus === 'available' ? 'border-lime-400 bg-lime-50/20' : usernameStatus === 'taken' ? 'border-rose-400 bg-rose-50/20' : ''}
                    rightIcon={usernameStatus === 'available' ? <CheckCircle size={16} className="text-lime-500" /> : usernameStatus === 'taken' ? <XCircle size={16} className="text-rose-500" /> : null}
                  />
                  <p className="text-[9px] text-slate-400 pl-1">Será tu identidad en los rankings y grupos.</p>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contraseña *</label>
                   <Input type="password" placeholder="••••••••" value={formData.password} onChange={e => handleInputChange('password', e.target.value)} leftIcon={<Lock size={16} />} />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar Contraseña *</label>
                   <Input type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={e => handleInputChange('confirmPassword', e.target.value)} leftIcon={<Lock size={16} />} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                   {requirements.map((req, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${req.test(formData.password) ? 'bg-lime-50 border-lime-200 text-lime-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                         {req.test(formData.password) ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-300" />}
                         <span className="text-[9px] font-bold uppercase tracking-wide">{req.label}</span>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                 <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <div 
                      className={`relative w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group ${formData.fotoPreview ? 'border-4 border-lime-400 shadow-2xl shadow-lime-400/20' : dragActive ? 'border-4 border-dashed border-lime-500 bg-lime-50 scale-105' : 'border-2 border-dashed border-slate-300 bg-slate-50 hover:border-lime-400 hover:bg-white'}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                       {formData.fotoPreview ? (
                          <div className="relative w-full h-full">
                             <img src={formData.fotoPreview} className="w-full h-full rounded-full object-cover" alt="Preview" />
                             <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest backdrop-blur-sm">
                                <RefreshCcw size={20} className="mb-1" /> Cambiar
                             </div>
                             {quality && (
                                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg border border-white/50 ${quality.color}`}>
                                   <quality.icon size={10} />
                                   <span className="text-[8px] font-black uppercase tracking-widest">{quality.label}</span>
                                </div>
                             )}
                          </div>
                       ) : (
                          <div className="text-center space-y-2 p-4">
                             <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400 group-hover:scale-110 transition-transform"><UploadCloud size={24} /></div>
                             <p className="text-xs font-black text-slate-500 uppercase">Arrastra tu foto</p>
                             <p className="text-[9px] text-slate-400">o haz clic para buscar</p>
                          </div>
                       )}
                       <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
                    </div>

                    {uploadError && (
                       <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-2">
                          <FileWarning size={16} />
                          <span className="text-xs font-bold">{uploadError}</span>
                       </div>
                    )}

                    <div className="text-center max-w-xs">
                       <h4 className="text-lg font-black font-brand text-slate-900 uppercase">TU IDENTIDAD</h4>
                       <p className="text-xs text-slate-500 mt-1">Esta imagen será visible en los rankings y tablas de posiciones.</p>
                    </div>
                 </div>

                 <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                    <Checkbox id="terms" label="" checked={formData.rememberMe} onChange={(c) => setFormData({...formData, rememberMe: c})} />
                    <label htmlFor="terms" className="text-[10px] text-slate-500 font-medium leading-relaxed cursor-pointer">
                       Acepto los <span className="font-bold text-slate-900 underline">Términos y Condiciones</span> y la <span className="font-bold text-slate-900 underline">Política de Privacidad</span>. Entiendo que los juegos de azar requieren mayoría de edad.
                    </label>
                 </div>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="mt-8 flex items-center gap-4 relative z-0">
            {step > 1 && (
               <Button variant="outline" className="w-14 h-14 rounded-2xl border-slate-200 text-slate-400 hover:text-slate-900" onClick={() => setStep((step - 1) as RegisterStep)}>
                  <ArrowLeft size={20} />
               </Button>
            )}
            <Button 
               onClick={handleSubmit} 
               disabled={!isStepValid() || (step === 3 && !formData.rememberMe) || isLoading} 
               isLoading={isLoading} 
               className="flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl hover:shadow-2xl transition-all"
               variant="secondary"
            >
               {step === 3 ? 'FINALIZAR REGISTRO' : 'CONTINUAR'} <ArrowRight size={18} className="ml-2" />
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;

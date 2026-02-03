
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
  FileWarning
} from 'lucide-react';

interface RegisterProps {
  onViewChange: (view: AppView) => void;
  onRegisterSuccess: (email: string) => void;
}

type RegisterStep = 1 | 2 | 3;

interface Country {
  code: string;
  name: string;
  flag: string;
  length: number;
  placeholder: string;
  regex?: RegExp;
}

const COUNTRY_CODES: Country[] = [
  { code: '+57', name: 'Colombia', flag: '🇨🇴', length: 10, placeholder: '310 123 4567', regex: /^3\d{9}$/ },
  { code: '+52', name: 'México', flag: '🇲🇽', length: 10, placeholder: '55 1234 5678' },
  { code: '+1', name: 'USA / Canadá', flag: '🇺🇸', length: 10, placeholder: '202 555 0123' },
  { code: '+34', name: 'España', flag: '🇪🇸', length: 9, placeholder: '612 345 678' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷', length: 10, placeholder: '11 1234 5678' },
  { code: '+56', name: 'Chile', flag: '🇨🇱', length: 9, placeholder: '9 1234 5678' },
  { code: '+58', name: 'Venezuela', flag: '🇻🇪', length: 10, placeholder: '412 123 4567' },
  { code: '+51', name: 'Perú', flag: '🇵🇪', length: 9, placeholder: '912 345 678' },
  { code: '+55', name: 'Brasil', flag: '🇧🇷', length: 11, placeholder: '11 91234 5678' },
];

const Register: React.FC<RegisterProps> = ({ onViewChange, onRegisterSuccess }) => {
  const [step, setStep] = React.useState<RegisterStep>(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  
  // Validation states
  const [nombreStatus, setNombreStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [emailStatus, setEmailStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [phoneStatus, setPhoneStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [birthDateStatus, setBirthDateStatus] = React.useState<'idle' | 'valid' | 'underage' | 'invalid'>('idle');
  
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

  // Validation for Email
  React.useEffect(() => {
    if (!formData.email) {
      setEmailStatus('idle');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailStatus(emailRegex.test(formData.email) ? 'valid' : 'invalid');
  }, [formData.email]);

  React.useEffect(() => {
    const cleanPhone = formData.celular.replace(/\D/g, '');
    if (!formData.celular) {
      setPhoneStatus('idle');
      return;
    }
    
    if (selectedCountry.regex) {
      setPhoneStatus(selectedCountry.regex.test(cleanPhone) ? 'valid' : 'invalid');
    } else {
      setPhoneStatus(cleanPhone.length === selectedCountry.length ? 'valid' : 'invalid');
    }
  }, [formData.celular, selectedCountry]);

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
      <div className="max-w-5xl w-full mb-6">
        <button 
          onClick={() => onViewChange('landing')} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Inicio
        </button>
      </div>

      <div className={`max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[650px] transition-all duration-700 ${isLoading ? 'scale-[0.98] blur-sm opacity-50' : 'scale-100'}`}>
        
        {/* Lado Izquierdo Branding */}
        <div className="hidden md:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
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
        <div className="p-8 md:p-16 flex flex-col h-full relative">
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
                    rightIcon={birthDateStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : birthDateStatus === 'underage' ? <XCircle size={16} className="text-rose-500" /> : null}
                  />
                  {birthDateStatus === 'underage' && <p className="text-[10px] font-bold text-rose-500 ml-1">Debes ser mayor de 18 años para jugar.</p>}
                </div>

                <div className="space-y-2 relative" ref={selectorRef}>
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Celular *</label>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button type="button" onClick={() => setIsCountrySelectorOpen(!isCountrySelectorOpen)} className={`h-11 px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all focus:ring-2 focus:ring-lime-400 ${isCountrySelectorOpen ? 'ring-2 ring-lime-400 bg-slate-50' : ''}`}>
                        <span className="text-xl leading-none">{selectedCountry.flag}</span>
                        <span className="font-bold text-sm text-slate-700">{selectedCountry.code}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isCountrySelectorOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isCountrySelectorOpen && (
                        <div className="absolute z-50 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200 origin-top-left overflow-hidden">
                          <div className="p-3 bg-slate-50 border-b border-slate-100">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input autoFocus value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="País o código..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-lime-400" />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredCountries.map((c) => (
                              <button key={c.code} type="button" onClick={() => { setSelectedCountry(c); setIsCountrySelectorOpen(false); setCountrySearch(''); setFormData(prev => ({ ...prev, celular: '' })); }} className={`w-full flex items-center justify-between px-4 py-3 hover:bg-lime-50 transition-colors border-b border-slate-50 last:border-0 ${selectedCountry.code === c.code ? 'bg-lime-50/50' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{c.flag}</span>
                                  <div className="flex flex-col items-start">
                                    <span className="text-xs font-black text-slate-900 leading-tight">{c.name}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Código {c.code}</span>
                                  </div>
                                </div>
                                {selectedCountry.code === c.code && <CheckCircle size={14} className="text-lime-500" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input placeholder={selectedCountry.placeholder} required type="tel" disabled={isLoading} value={formData.celular} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= selectedCountry.length) { handleInputChange('celular', val); } }} className={phoneStatus === 'invalid' ? 'border-rose-400' : phoneStatus === 'valid' ? 'border-lime-400' : ''} rightIcon={phoneStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-mail *</label>
                  <EmailAutocompleteInput 
                    placeholder="tu@correo.com" 
                    required 
                    value={formData.email} 
                    onValueChange={v => handleInputChange('email', v)}
                    className={emailStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : emailStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20' : ''}
                    rightIcon={emailStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : emailStatus === 'invalid' ? <XCircle size={16} className="text-rose-500" /> : null}
                  />
                  {emailStatus === 'invalid' && <p className="text-[10px] font-bold text-rose-500 ml-1">Ingresa un correo electrónico válido.</p>}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <div className="flex justify-between ml-1"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuario *</label><span className="text-[9px] font-bold text-slate-400">{formData.usuario.length}/20</span></div>
                  <AutocompleteInput leftIcon={<User size={16} />} placeholder="usuario_crack" required maxLength={20} value={formData.usuario} onValueChange={v => handleInputChange('usuario', v)} suggestions={usernameSuggestions} suggestionTitle="Sugerencias inteligentes"
                    rightIcon={usernameStatus === 'available' ? <CheckCircle size={16} className="text-lime-500" /> : usernameStatus === 'taken' ? <XCircle size={16} className="text-rose-500" /> : null}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contraseña *</label>
                  <Input type="password" leftIcon={<Lock size={16} />} placeholder="••••••••" required value={formData.password} onChange={e => handleInputChange('password', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar Contraseña *</label>
                  <Input type="password" placeholder="Reingresa contraseña" required value={formData.confirmPassword} onChange={e => handleInputChange('confirmPassword', e.target.value)} />
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-inner">
                  <div className="flex gap-1 mb-4">{[1, 2, 3, 4].map(s => <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${metCount >= s ? 'bg-lime-500' : 'bg-slate-200'}`}></div>)}</div>
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase text-slate-400">
                    {requirements.map((r, i) => <div key={i} className={`flex items-center gap-1.5 ${r.test(formData.password) ? 'text-lime-600' : ''}`}>{r.test(formData.password) ? <CheckCircle size={10} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}{r.label}</div>)}
                  </div>
                </div>
                <div className="py-2">
                  <Checkbox 
                    id="reg-remember-me" 
                    label="Recordarme en este dispositivo" 
                    checked={formData.rememberMe} 
                    onChange={v => handleInputChange('rememberMe', v)} 
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-700">Tu Credencial de Jugador</h4>
                  <p className="text-xs text-slate-500">Sube una foto para tu carnet oficial de la Polla 2026.</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`relative w-56 h-56 border-2 border-dashed rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden group ${dragActive ? 'border-lime-500 bg-lime-50 scale-105' : uploadError ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:border-slate-400'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => !isProcessingFile && document.getElementById('file-up')?.click()}>
                    {isProcessingFile ? (
                      <div className="flex flex-col items-center p-6 text-center animate-in zoom-in">
                        <RefreshCcw size={32} className="text-lime-500 animate-spin mb-4" />
                        <p className="text-[10px] font-black text-lime-600 uppercase tracking-widest">Escaneando Imagen...</p>
                      </div>
                    ) : uploadError ? (
                      <div className="flex flex-col items-center p-6 text-center">
                        <FileWarning size={32} className="text-rose-500 mb-4" />
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Error de Carga</p>
                        <button type="button" className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest" onClick={(e) => { e.stopPropagation(); document.getElementById('file-up')?.click(); }}>Reintentar</button>
                      </div>
                    ) : formData.fotoPreview ? (
                      <div className="w-full h-full relative group">
                        <img src={formData.fotoPreview} className="w-full h-full object-cover" alt="Avatar" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span className="text-white text-[10px] font-black uppercase tracking-widest">Cambiar Foto</span></div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center p-6 text-center text-slate-400">
                        <UploadCloud size={32} className="group-hover:text-lime-500 transition-colors" />
                        <p className="text-[10px] font-black uppercase tracking-widest mt-4">Sube tu Avatar</p>
                      </div>
                    )}
                    <input id="file-up" type="file" className="hidden" accept="image/*" onChange={e => e.target.files && handleFileChange(e.target.files[0])} />
                  </div>
                  <div className="h-10 mt-6 overflow-hidden">
                    {uploadError ? (
                      <div className="flex items-center gap-2 p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl">
                        <XCircle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{uploadError}</span>
                      </div>
                    ) : quality ? (
                      <div className={`flex items-center gap-3 p-3 border rounded-2xl ${quality.color}`}>
                        <quality.icon size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{quality.label}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-12 flex gap-4 pt-4">
              {step > 1 && <Button type="button" variant="outline" className="px-4" onClick={() => { setStep((step - 1) as RegisterStep); setUploadError(null); }} disabled={isLoading}><ArrowLeft size={18} /></Button>}
              <Button className="flex-1 gap-2" size="lg" variant={step === 3 ? "secondary" : "primary"} isLoading={isLoading || isNavigating} type="submit" disabled={!isStepValid()}>{step === 3 ? "Finalizar Registro" : "Siguiente"} {step < 3 && <ArrowRight size={18} />}</Button>
            </div>
          </form>

          <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-center text-xs">
            <p className="text-slate-500">¿Ya tienes cuenta?</p>
            <button onClick={() => onViewChange('login')} className="font-black text-lime-600 uppercase tracking-widest hover:underline transition-all">Entrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

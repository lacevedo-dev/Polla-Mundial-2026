
import React from 'react';
import { Button, Input, EmailAutocompleteInput, AutocompleteInput, Checkbox } from '../components/UI';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CheckCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  XCircle,
  Check,
  AlertCircle as AlertIcon,
  Calendar,
  ChevronDown,
  Search,
  RefreshCcw,
  Camera,
  FileWarning,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { LegalDialog } from '../components/legal/LegalDialog';
import type { LegalDocumentKey } from '../components/legal/legal-documents';

// Props eliminadas — navegación vía useNavigate

type RegisterStep = 1 | 2 | 3 | 'verification';

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

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<RegisterStep>(1);
  const { register, isLoading } = useAuthStore();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeLegalDocument, setActiveLegalDocument] = React.useState<LegalDocumentKey | null>(null);

  // Validation states
  const [nombreStatus, setNombreStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [emailStatus, setEmailStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [phoneStatus, setPhoneStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle');
  const [birthDateStatus, setBirthDateStatus] = React.useState<'idle' | 'valid' | 'underage' | 'invalid'>('idle');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Existing user detected state
  const [existingUser, setExistingUser] = React.useState<{ name: string, avatar: string } | null>(null);

  // File upload state
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);

  // Phone selection state
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(COUNTRY_CODES[0]);
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const selectorRef = React.useRef<HTMLDivElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    return str
      .toLocaleLowerCase('es-CO')
      .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, character: string) =>
        `${separator}${character.toLocaleUpperCase('es-CO')}`,
      );
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

  const handleAvatarInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleFileChange(file);
    event.target.value = '';
  };

  const openCameraPicker = () => {
    cameraInputRef.current?.click();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const openLegalDocument = (documentKey: LegalDocumentKey) => {
    setActiveLegalDocument(documentKey);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailStatus === 'taken' || phoneStatus === 'taken') return;

    if (step < 3) {
      setIsNavigating(true);
      setTimeout(() => { setStep((step + 1) as RegisterStep); setIsNavigating(false); }, 400);
      return;
    }

    setError(null);
    try {
      const response = await register({
        email: formData.email,
        username: formData.usuario,
        password: formData.password,
        name: formData.nombre,
        phone: formData.celular,
        countryCode: selectedCountry.code
      });
      // Store email in sessionStorage for EmailVerification view
      sessionStorage.setItem('registrationEmail', formData.email);
      // Show verification step instead of navigating directly
      setStep('verification');
    } catch (err: any) {
      setError(err.message || 'Error al completar el registro.');
    }
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
    if (size < 50) return { label: 'Baja resolución', color: 'bg-amber-100 text-amber-700', icon: AlertIcon };
    if (size < 500) return { label: 'Óptima', color: 'bg-lime-100 text-lime-700', icon: CheckCircle };
    return { label: 'Alta definición', color: 'bg-cyan-100 text-cyan-700', icon: Sparkles };
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

  const renderPasswordVisibilityToggle = (isVisible: boolean, onToggle: () => void, fieldLabel: string) => (
    <button
      type="button"
      aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} ${fieldLabel}`}
      aria-pressed={isVisible}
      onClick={onToggle}
      className="rounded-full p-1 -m-1 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-1"
    >
      {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 py-4 md:py-6">
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
      <div className="max-w-5xl w-full mb-4 md:mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Inicio
        </button>
      </div>

      <div className={`max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl md:min-h-[620px] transition-all duration-700 ${isLoading ? 'scale-[0.98] blur-sm opacity-50' : 'scale-100'}`}>

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
        <div className="p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col h-full relative rounded-[2.5rem] md:rounded-l-none md:rounded-r-[2.5rem]">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black font-brand uppercase tracking-tight">Registro</h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paso {step} de 3</span>
            </div>
            <div className="flex gap-2 h-1.5 mb-6">
              {[1, 2, 3].map(s => <div key={s} className={`flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-lime-400' : 'bg-slate-100'}`}></div>)}
            </div>
            {error && (
              <div role="alert" aria-live="polite" className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center gap-2 rounded-r-xl">
                <AlertIcon size={18} /> {error}
              </div>
            )}
          </div>

          <form className={`flex-1 flex flex-col transition-all duration-300 ${isNavigating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`} onSubmit={handleSubmit}>

            {step === 'verification' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 flex-1 flex flex-col justify-center">
                <div className="text-center">
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-lime-100 rounded-full flex items-center justify-center animate-in scale-in duration-500">
                      <CheckCircle2 size={48} className="text-lime-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-black font-brand uppercase tracking-tight mb-2">
                    ¡Verifica tu Email!
                  </h2>
                  <p className="text-slate-600 text-sm mb-4">
                    Hemos enviado un enlace de verificación a:
                  </p>
                  <div className="inline-block bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-900">{formData.email}</p>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Haz clic en el enlace para activar tu cuenta. Si no lo ves, revisa tu carpeta de <span className="font-bold">SPAM</span>.
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/verify-email')}
                  variant="secondary"
                  className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl hover:shadow-2xl transition-all"
                >
                  Ir a Verificar Email <ArrowRight size={18} className="ml-2" />
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-[0.15em]"
                  onClick={() => navigate('/login')}
                >
                  Volver a Iniciar Sesión
                </Button>
              </div>
            )}

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
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuario único *</label>
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
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    leftIcon={<Lock size={16} />}
                    rightIcon={renderPasswordVisibilityToggle(showPassword, () => setShowPassword(prev => !prev), 'contrase\u00f1a')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar contraseña *</label>
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                    value={formData.confirmPassword}
                    onChange={e => handleInputChange('confirmPassword', e.target.value)}
                    leftIcon={<Lock size={16} />}
                    rightIcon={renderPasswordVisibilityToggle(showConfirmPassword, () => setShowConfirmPassword(prev => !prev), 'confirmaci\u00f3n de contrase\u00f1a')}
                  />
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
              <div className="animate-in slide-in-from-right-4 duration-300 flex-1">
                <div className="grid gap-4 xl:items-center xl:gap-6">
                  <div className="flex w-full flex-col items-center gap-4">
                  <div
                    className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group ${formData.fotoPreview ? 'border-4 border-lime-400 shadow-2xl shadow-lime-400/20' : dragActive ? 'border-4 border-dashed border-lime-500 bg-lime-50 scale-105' : 'border-2 border-dashed border-slate-300 bg-slate-50 hover:border-lime-400 hover:bg-white'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={openFilePicker}
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
                      <div className="text-center space-y-1.5 p-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400 group-hover:scale-110 transition-transform"><UploadCloud size={22} /></div>
                        <p className="text-[11px] font-black text-slate-500 uppercase leading-tight">Sube tu foto</p>
                      </div>
                    )}
                  </div>

                  <input
                    ref={cameraInputRef}
                    id="avatar-camera-input"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="user"
                    onChange={handleAvatarInputChange}
                  />
                  <input
                    ref={fileInputRef}
                    id="avatar-file-input"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarInputChange}
                  />

                  <div className="grid w-full max-w-sm xl:max-w-none grid-cols-2 xl:grid-cols-1 gap-2 xl:gap-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 rounded-xl px-3 font-black text-[10px] uppercase tracking-[0.12em]"
                      onClick={openCameraPicker}
                    >
                      <Camera size={15} className="mr-1.5" /> Tomar foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-slate-200 px-3 font-black text-[10px] uppercase tracking-[0.12em]"
                      onClick={openFilePicker}
                    >
                      <UploadCloud size={15} className="mr-1.5" /> Adjuntar
                    </Button>
                  </div>

                  {uploadError && (
                    <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-2">
                      <FileWarning size={16} />
                      <span className="text-xs font-bold">{uploadError}</span>
                    </div>
                  )}
                  </div>

                  <div className="w-full max-w-sm space-y-2 justify-self-center xl:max-w-none">
                    <p className="text-center text-[11px] text-slate-500 leading-4">
                      Foto visible en rankings y posiciones.
                    </p>

                    <div className="w-full rounded-3xl border border-slate-100 bg-slate-50 p-3.5">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms"
                          label="Acepto los documentos legales"
                          checked={formData.rememberMe}
                          onChange={(c) => setFormData({ ...formData, rememberMe: c })}
                        />
                      </div>
                      <div className="mt-3 pl-0 sm:pl-8">
                        <p id="register-legal-description" className="text-[10px] leading-4 text-slate-500">
                          Confirmas mayoría de edad y aceptas el uso básico de tus datos. Consulta{' '}
                          <button
                            type="button"
                            className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-black focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 rounded-sm"
                            onClick={() => openLegalDocument('terms')}
                          >
                            Términos y Condiciones
                          </button>{' '}
                          y{' '}
                          <button
                            type="button"
                            className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-black focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 rounded-sm"
                            onClick={() => openLegalDocument('privacy')}
                          >
                            Política de Privacidad
                          </button>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          {step !== 'verification' && (
            <div className="mt-6 md:mt-4 flex items-center gap-4 relative z-0">
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
          )}

        </div>
      </div>

      <LegalDialog
        documentKey={activeLegalDocument}
        open={activeLegalDocument !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveLegalDocument(null);
          }
        }}
      />
    </div>
  );
};

export default Register;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Camera, Lock, Eye, EyeOff, Save, ArrowLeft,
  CheckCircle2, CheckCircle, AlertCircle as AlertIcon, Calendar,
  UploadCloud, RefreshCcw, ChevronDown, Search, Check,
  FileWarning, Sparkles, XCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';
import { Input, AutocompleteInput, Button } from '../components/UI';

const COUNTRY_CODES = [
  { code: '+57', name: 'Colombia', iso: 'co', length: 10, placeholder: '310 123 4567', regex: /^3\d{9}$/ },
  { code: '+52', name: 'México', iso: 'mx', length: 10, placeholder: '55 1234 5678' },
  { code: '+1',  name: 'USA / Canadá', iso: 'us', length: 10, placeholder: '202 555 0123' },
  { code: '+34', name: 'España', iso: 'es', length: 9, placeholder: '612 345 678' },
  { code: '+54', name: 'Argentina', iso: 'ar', length: 10, placeholder: '11 1234 5678' },
  { code: '+56', name: 'Chile', iso: 'cl', length: 9, placeholder: '9 1234 5678' },
  { code: '+58', name: 'Venezuela', iso: 've', length: 10, placeholder: '412 123 4567' },
  { code: '+51', name: 'Perú', iso: 'pe', length: 9, placeholder: '912 345 678' },
  { code: '+55', name: 'Brasil', iso: 'br', length: 11, placeholder: '11 91234 5678' },
];

type Tab = 'datos' | 'cuenta' | 'foto' | 'seguridad';

const TABS: { id: Tab; label: string }[] = [
  { id: 'datos',     label: 'Datos' },
  { id: 'cuenta',    label: 'Cuenta' },
  { id: 'foto',      label: 'Foto' },
  { id: 'seguridad', label: 'Seguridad' },
];

const formatToTitleCase = (str: string) =>
  str.toLocaleLowerCase('es-CO').replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => `${sep}${ch.toLocaleUpperCase('es-CO')}`);

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, isLoading } = useAuthStore();

  /* ─── Tab ─── */
  const [activeTab, setActiveTab] = React.useState<Tab>('datos');

  /* ─── Datos personales ─── */
  const [name, setName] = React.useState(user?.name || '');
  const [nameStatus, setNameStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [birthDate, setBirthDate] = React.useState(
    user?.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : ''
  );
  const [birthStatus, setBirthStatus] = React.useState<'idle' | 'valid' | 'underage' | 'invalid'>('idle');

  /* ─── Cuenta ─── */
  const [username, setUsername] = React.useState(user?.username || '');
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [phone, setPhone] = React.useState(user?.phone || '');
  const [phoneStatus, setPhoneStatus] = React.useState<'idle' | 'valid' | 'invalid'>('idle');
  const [selectedCountry, setSelectedCountry] = React.useState(
    COUNTRY_CODES.find(c => c.code === user?.countryCode) || COUNTRY_CODES[0]
  );
  const [countryOpen, setCountryOpen] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const selectorRef = React.useRef<HTMLDivElement>(null);

  /* ─── Foto ─── */
  const [avatarPreview, setAvatarPreview] = React.useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  /* ─── Seguridad ─── */
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [pwLoading, setPwLoading] = React.useState(false);

  /* ─── Feedback global ─── */
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = React.useState('');
  const [pwStatus, setPwStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [pwMsg, setPwMsg] = React.useState('');

  /* ─── Effects ─── */
  React.useEffect(() => {
    if (!name) { setNameStatus('idle'); return; }
    setNameStatus(name.trim().length >= 3 ? 'valid' : 'invalid');
  }, [name]);

  React.useEffect(() => {
    if (!birthDate) { setBirthStatus('idle'); return; }
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) { setBirthStatus('invalid'); return; }
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    setBirthStatus(age >= 18 ? 'valid' : 'underage');
  }, [birthDate]);

  React.useEffect(() => {
    if (!username || username.length < 3) { setUsernameStatus('idle'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setUsernameStatus('invalid'); return; }
    if (username === user?.username) { setUsernameStatus('available'); return; }
    const timer = setTimeout(async () => {
      setUsernameStatus('checking');
      await new Promise(r => setTimeout(r, 600));
      const reserved = ['admin', 'fifa', 'root', 'polla2026', 'superadmin'];
      setUsernameStatus(reserved.includes(username) ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(timer);
  }, [username, user?.username]);

  React.useEffect(() => {
    if (!phone) { setPhoneStatus('idle'); return; }
    const clean = phone.replace(/\D/g, '');
    const timer = setTimeout(() => {
      const ok = selectedCountry.regex
        ? selectedCountry.regex.test(clean)
        : clean.length === selectedCountry.length;
      setPhoneStatus(ok ? 'valid' : 'invalid');
    }, 400);
    return () => clearTimeout(timer);
  }, [phone, selectedCountry]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ─── Sugerencias de username ─── */
  const usernameSuggestions = React.useMemo(() => {
    if (!name || name.length < 3) return [];
    const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (!parts.length) return [];
    const first = parts[0];
    const last = parts[parts.length - 1] || 'user';
    return Array.from(new Set([`${first}${last}`, `${first}.${last}`, `${first}_${last}`, `${first}2026`]))
      .filter(s => s !== username).slice(0, 4);
  }, [name, username]);

  /* ─── Requisitos de contraseña ─── */
  const pwReqs = [
    { label: '8+ caracteres',  test: (p: string) => p.length >= 8 },
    { label: 'Una mayúscula',  test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Un número',      test: (p: string) => /[0-9]/.test(p) },
    { label: 'Coinciden',      test: (p: string) => p === confirmPw && p !== '' },
  ];
  const metPw = pwReqs.filter(r => r.test(newPw)).length;

  /* ─── Calidad de imagen ─── */
  const getImageQuality = () => {
    if (!avatarFile) return null;
    const kb = avatarFile.size / 1024;
    if (kb < 50)  return { label: 'Baja resolución', color: 'bg-amber-100 text-amber-700', Icon: AlertIcon };
    if (kb < 500) return { label: 'Óptima',           color: 'bg-lime-100 text-lime-700',   Icon: CheckCircle };
    return               { label: 'Alta definición',  color: 'bg-cyan-100 text-cyan-700',   Icon: Sparkles };
  };
  const imgQuality = getImageQuality();

  /* ─── Handlers ─── */
  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    if (!file) { setAvatarFile(null); setAvatarPreview(user?.avatar || ''); return; }
    if (!file.type.startsWith('image/')) { setUploadError('El archivo no es una imagen válida. Usa JPG, PNG o WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('La imagen es muy pesada. Máximo 5 MB.'); return; }
    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setTimeout(() => {
        setAvatarFile(file);
        setAvatarPreview(reader.result as string);
        setIsProcessingFile(false);
      }, 800);
    };
    reader.onerror = () => { setUploadError('Error al leer el archivo.'); setIsProcessingFile(false); };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const matched = COUNTRY_CODES.find(c => val.startsWith(c.code));
    if (matched) {
      setSelectedCountry(matched);
      setPhone(val.replace(matched.code, '').trim().replace(/\D/g, ''));
    } else {
      const clean = val.replace(/\D/g, '');
      if (clean.length <= selectedCountry.length) setPhone(clean);
    }
  };

  const handleSave = async () => {
    setSaveStatus('idle'); setSaveMsg('');
    const tab = activeTab;

    if (tab === 'datos') {
      if (nameStatus !== 'valid') { setSaveStatus('error'); setSaveMsg('El nombre debe tener al menos 3 caracteres.'); return; }
      if (birthDate && birthStatus === 'underage') { setSaveStatus('error'); setSaveMsg('Debes ser mayor de 18 años.'); return; }
    }
    if (tab === 'cuenta') {
      if (usernameStatus !== 'available') { setSaveStatus('error'); setSaveMsg('Elige un nombre de usuario válido y disponible.'); return; }
    }
    if (tab === 'foto') {
      if (isProcessingFile) return;
    }

    try {
      const fd = new FormData();
      if (tab === 'datos') {
        fd.append('name', name.trim());
        if (birthDate) fd.append('birthDate', birthDate);
      }
      if (tab === 'cuenta') {
        fd.append('username', username.trim());
        if (phone) { fd.append('phone', phone); fd.append('countryCode', selectedCountry.code); }
      }
      if (tab === 'foto' && avatarFile) {
        fd.append('avatar', avatarFile);
      }

      await updateProfile(fd);
      setSaveStatus('success');
      setSaveMsg('¡Guardado correctamente!');
      if (tab === 'foto') setAvatarFile(null);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMsg(err.message || 'Error al guardar.');
    }
  };

  const handleChangePassword = async () => {
    setPwStatus('idle'); setPwMsg('');
    if (metPw < pwReqs.length) { setPwStatus('error'); setPwMsg('La contraseña no cumple todos los requisitos.'); return; }
    setPwLoading(true);
    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setPwStatus('success'); setPwMsg('¡Contraseña actualizada exitosamente!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwStatus('error'); setPwMsg(err.message || 'Error al cambiar la contraseña.');
    } finally {
      setPwLoading(false);
    }
  };

  const avatarSrc = avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=84cc16&color=000&size=200`;
  const filteredCountries = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)
  );

  const isSaveDisabled = () => {
    if (isLoading || isProcessingFile) return true;
    if (activeTab === 'datos') return nameStatus !== 'valid' || (!!birthDate && birthStatus === 'underage');
    if (activeTab === 'cuenta') return usernameStatus !== 'available';
    if (activeTab === 'foto') return !avatarFile;
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style>{`.scrollbar-custom::-webkit-scrollbar{width:4px}.scrollbar-custom::-webkit-scrollbar-track{background:transparent}.scrollbar-custom::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:20px}`}</style>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-black transition-colors shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight font-brand">Mi Perfil</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Edita tu información</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

          {/* Avatar header */}
          <div className="bg-black px-8 pt-8 pb-6 flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => { setActiveTab('foto'); fileInputRef.current?.click(); }}>
              <img src={avatarSrc} alt="Avatar" className="w-24 h-24 rounded-full object-cover ring-4 ring-lime-400 shadow-xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={22} className="text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-black text-lg">{user?.name}</p>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">@{user?.username}</p>
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{user?.email}</div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setSaveStatus('idle'); setSaveMsg(''); }}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === t.id
                    ? 'text-black border-b-2 border-lime-400'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6 md:p-8">

            {/* ─── TAB: DATOS ─── */}
            {activeTab === 'datos' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre Completo *</label>
                  <Input
                    placeholder="Ej. Juan Pérez"
                    value={name}
                    onChange={e => setName(formatToTitleCase(e.target.value))}
                    leftIcon={<User size={16} />}
                    className={nameStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : nameStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20' : ''}
                    rightIcon={nameStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                  />
                  {nameStatus === 'invalid' && <p className="text-[9px] font-bold text-rose-500 ml-1">Mínimo 3 caracteres.</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha de Nacimiento</label>
                    <span className="text-[9px] font-bold text-slate-400 italic">Opcional · para personalizar tu experiencia</span>
                  </div>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    leftIcon={<Calendar size={16} />}
                    className={birthStatus === 'underage' || birthStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20' : birthStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : ''}
                    rightIcon={birthStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                  />
                  {birthStatus === 'underage' && <p className="text-[9px] font-bold text-rose-500 ml-1">Debes ser mayor de 18 años.</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Correo electrónico</label>
                  <Input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="opacity-60 cursor-not-allowed bg-slate-50"
                    rightIcon={<CheckCircle size={16} className="text-lime-500" />}
                  />
                  <p className="text-[9px] text-slate-400 ml-1">El email no se puede cambiar desde aquí.</p>
                </div>
              </div>
            )}

            {/* ─── TAB: CUENTA ─── */}
            {activeTab === 'cuenta' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuario único *</label>
                    <span className={`text-[9px] font-bold uppercase ${
                      usernameStatus === 'available' ? 'text-lime-600'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-rose-500'
                      : 'text-slate-400'
                    }`}>
                      {usernameStatus === 'checking' ? 'Verificando...'
                       : usernameStatus === 'available' ? '¡Disponible!'
                       : usernameStatus === 'taken' ? 'No disponible'
                       : usernameStatus === 'invalid' ? 'Solo letras, números y _'
                       : ''}
                    </span>
                  </div>
                  <AutocompleteInput
                    placeholder="@usuario"
                    value={username}
                    onValueChange={val => setUsername(val.replace(/\s/g, '').toLowerCase())}
                    suggestions={usernameSuggestions}
                    suggestionTitle="Sugerencias"
                    leftIcon={<User size={16} />}
                    className={
                      usernameStatus === 'available' ? 'border-lime-400 bg-lime-50/20'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20'
                      : ''
                    }
                    rightIcon={
                      usernameStatus === 'available' ? <CheckCircle size={16} className="text-lime-500" />
                      : usernameStatus === 'taken' || usernameStatus === 'invalid' ? <XCircle size={16} className="text-rose-500" />
                      : null
                    }
                  />
                  <p className="text-[9px] text-slate-400 ml-1">Tu identidad en rankings y grupos.</p>
                </div>

                <div className={`space-y-1.5 relative ${countryOpen ? 'z-50' : 'z-0'}`} ref={selectorRef}>
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Celular</label>
                    <span className="text-[9px] font-bold text-slate-400 italic">Opcional</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors min-w-[100px]"
                      onClick={() => setCountryOpen(!countryOpen)}
                    >
                      <img src={`https://flagcdn.com/w40/${selectedCountry.iso}.png`} srcSet={`https://flagcdn.com/w80/${selectedCountry.iso}.png 2x`} width="24" alt={selectedCountry.name} className="rounded-sm" />
                      <span className="text-xs font-bold text-slate-700">{selectedCountry.code}</span>
                      <ChevronDown size={14} className="text-slate-400 ml-auto" />
                    </button>
                    <Input
                      placeholder={selectedCountry.placeholder}
                      value={phone}
                      onChange={handlePhoneChange}
                      className={phoneStatus === 'valid' ? 'border-lime-400 bg-lime-50/20' : phoneStatus === 'invalid' ? 'border-rose-400 bg-rose-50/20' : ''}
                      rightIcon={phoneStatus === 'valid' ? <CheckCircle size={16} className="text-lime-500" /> : null}
                    />
                  </div>
                  {countryOpen && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl w-[min(18rem,calc(100vw-2rem))] p-2 animate-in fade-in slide-in-from-top-2">
                      <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-lime-100" placeholder="Buscar país..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)} />
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1 scrollbar-custom">
                        {filteredCountries.map(c => (
                          <button key={c.name} type="button" className="w-full flex items-center gap-3 p-2 hover:bg-lime-50 rounded-xl transition-colors text-left group"
                            onClick={() => { setSelectedCountry(c); setCountryOpen(false); setCountrySearch(''); }}>
                            <img src={`https://flagcdn.com/w40/${c.iso}.png`} srcSet={`https://flagcdn.com/w80/${c.iso}.png 2x`} width="24" alt={c.name} className="rounded-sm shadow-sm group-hover:scale-110 transition-transform" />
                            <div className="flex-1"><p className="text-xs font-bold text-slate-900">{c.name}</p><p className="text-[10px] text-slate-500">{c.code}</p></div>
                            {selectedCountry.code === c.code && <Check size={14} className="text-lime-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {phoneStatus === 'invalid' && <p className="text-[9px] font-bold text-rose-500 ml-1">Número inválido para {selectedCountry.name}.</p>}
                </div>
              </div>
            )}

            {/* ─── TAB: FOTO ─── */}
            {activeTab === 'foto' && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-200 flex flex-col items-center gap-5">
                <div
                  className={`relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group ${
                    avatarPreview ? 'border-4 border-lime-400 shadow-2xl shadow-lime-400/20'
                    : dragActive ? 'border-4 border-dashed border-lime-500 bg-lime-50 scale-105'
                    : 'border-2 border-dashed border-slate-300 bg-slate-50 hover:border-lime-400 hover:bg-white'
                  }`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag}
                  onDrop={e => { handleDrag(e); if (e.dataTransfer.files[0]) handleFileChange(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <div className="relative w-full h-full">
                      <img src={avatarPreview} className="w-full h-full rounded-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm gap-1">
                        <RefreshCcw size={18} /> Cambiar
                      </div>
                      {imgQuality && (
                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg border border-white/50 whitespace-nowrap ${imgQuality.color}`}>
                          <imgQuality.Icon size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">{imgQuality.label}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-2 p-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-400 group-hover:scale-110 transition-transform">
                        <UploadCloud size={22} />
                      </div>
                      <p className="text-[11px] font-black text-slate-500 uppercase leading-tight">Sube tu foto</p>
                    </div>
                  )}
                </div>

                <input ref={cameraInputRef} type="file" className="hidden" accept="image/*" capture="user" onChange={e => { handleFileChange(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => { handleFileChange(e.target.files?.[0] ?? null); e.target.value = ''; }} />

                <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                  <Button type="button" variant="secondary" className="h-10 rounded-xl px-3 font-black text-[10px] uppercase tracking-[0.12em]" onClick={() => cameraInputRef.current?.click()}>
                    <Camera size={15} className="mr-1.5" /> Tomar foto
                  </Button>
                  <Button type="button" variant="outline" className="h-10 rounded-xl border-slate-200 px-3 font-black text-[10px] uppercase tracking-[0.12em]" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud size={15} className="mr-1.5" /> Adjuntar
                  </Button>
                </div>

                {uploadError && (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-top-2 w-full max-w-xs">
                    <FileWarning size={16} /><span className="text-xs font-bold">{uploadError}</span>
                  </div>
                )}
                {isProcessingFile && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-lime-500 rounded-full animate-spin" /> Procesando imagen...
                  </div>
                )}
                <p className="text-center text-[11px] text-slate-400 leading-4 max-w-xs">
                  Foto visible en rankings y posiciones. JPG, PNG o WebP · Máx 5 MB
                </p>
              </div>
            )}

            {/* ─── TAB: SEGURIDAD ─── */}
            {activeTab === 'seguridad' && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                {!user?.avatar?.includes('googleapis') ? (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Contraseña actual *</label>
                      <Input
                        type={showCurrent ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={currentPw}
                        onChange={e => setCurrentPw(e.target.value)}
                        leftIcon={<Lock size={16} />}
                        rightIcon={
                          <button type="button" aria-label="Ver contraseña" onClick={() => setShowCurrent(s => !s)} className="text-slate-400 hover:text-slate-700">
                            {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nueva contraseña *</label>
                      <Input
                        type={showNew ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        leftIcon={<Lock size={16} />}
                        rightIcon={
                          <button type="button" aria-label="Ver contraseña" onClick={() => setShowNew(s => !s)} className="text-slate-400 hover:text-slate-700">
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Confirmar contraseña *</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        leftIcon={<Lock size={16} />}
                        className={confirmPw && confirmPw !== newPw ? 'border-rose-400 bg-rose-50/20' : ''}
                      />
                      {confirmPw && confirmPw !== newPw && <p className="text-[9px] font-bold text-rose-500 ml-1">Las contraseñas no coinciden.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {pwReqs.map((req, i) => (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${req.test(newPw) ? 'bg-lime-50 border-lime-200 text-lime-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          {req.test(newPw) ? <CheckCircle2 size={12} /> : <div className="w-3 h-3 rounded-full border-2 border-slate-300" />}
                          <span className="text-[9px] font-bold uppercase tracking-wide">{req.label}</span>
                        </div>
                      ))}
                    </div>

                    {pwStatus !== 'idle' && (
                      <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${pwStatus === 'success' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {pwStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertIcon size={16} />}
                        {pwMsg}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl"
                      disabled={pwLoading || metPw < pwReqs.length || !currentPw}
                      isLoading={pwLoading}
                      onClick={handleChangePassword}
                    >
                      <Lock size={16} className="mr-2" /> Actualizar Contraseña
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Lock size={28} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">Cuenta vinculada a Google</p>
                      <p className="text-sm text-slate-500 mt-1">El cambio de contraseña se gestiona desde tu cuenta de Google.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Feedback + Botón guardar (excepto seguridad) ─── */}
            {activeTab !== 'seguridad' && (
              <div className="mt-6 space-y-3">
                {saveStatus !== 'idle' && (
                  <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in ${saveStatus === 'success' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {saveStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertIcon size={16} />}
                    {saveMsg}
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl hover:shadow-2xl transition-all"
                  disabled={isSaveDisabled()}
                  isLoading={isLoading}
                  onClick={handleSave}
                >
                  <Save size={16} className="mr-2" /> Guardar Cambios
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

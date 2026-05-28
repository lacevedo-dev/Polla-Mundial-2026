import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Camera, Lock, Eye, EyeOff, Save, ArrowLeft,
  CheckCircle2, AlertCircle, Phone, Calendar, AtSign,
  UploadCloud, Trash2
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

const COUNTRY_CODES = [
  { code: '+57', name: 'Colombia', iso: 'co' },
  { code: '+52', name: 'México', iso: 'mx' },
  { code: '+1', name: 'USA / Canadá', iso: 'us' },
  { code: '+34', name: 'España', iso: 'es' },
  { code: '+54', name: 'Argentina', iso: 'ar' },
  { code: '+56', name: 'Chile', iso: 'cl' },
  { code: '+58', name: 'Venezuela', iso: 've' },
  { code: '+51', name: 'Perú', iso: 'pe' },
  { code: '+55', name: 'Brasil', iso: 'br' },
];

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, isLoading } = useAuthStore();

  const [avatarPreview, setAvatarPreview] = React.useState<string>(user?.avatar || '');
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [form, setForm] = React.useState({
    name: user?.name || '',
    username: user?.username || '',
    phone: '',
    countryCode: '+57',
    birthDate: '',
  });

  const [pwForm, setPwForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = React.useState(false);
  const [showNewPw, setShowNewPw] = React.useState(false);

  const [profileStatus, setProfileStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [profileMsg, setProfileMsg] = React.useState('');
  const [pwStatus, setPwStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [pwMsg, setPwMsg] = React.useState('');
  const [pwLoading, setPwLoading] = React.useState(false);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileMsg('Solo se permiten imágenes JPG, PNG o WebP.');
      setProfileStatus('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg('La imagen no puede superar 5 MB.');
      setProfileStatus('error');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileStatus('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files[0] ?? null);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus('idle');
    setProfileMsg('');

    if (!form.name.trim() || form.name.trim().length < 3) {
      setProfileMsg('El nombre debe tener al menos 3 caracteres.');
      setProfileStatus('error');
      return;
    }
    if (!form.username.trim() || !/^[a-zA-Z0-9_]{3,30}$/.test(form.username)) {
      setProfileMsg('El usuario debe tener 3-30 caracteres alfanuméricos o guión bajo.');
      setProfileStatus('error');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('username', form.username.trim());
      if (form.phone) {
        fd.append('phone', form.phone);
        fd.append('countryCode', form.countryCode);
      }
      if (form.birthDate) fd.append('birthDate', form.birthDate);
      if (avatarFile) fd.append('avatar', avatarFile);

      await updateProfile(fd);
      setProfileStatus('success');
      setProfileMsg('¡Perfil actualizado exitosamente!');
      setAvatarFile(null);
    } catch (err: any) {
      setProfileStatus('error');
      setProfileMsg(err.message || 'Error al actualizar el perfil.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus('idle');
    setPwMsg('');

    if (pwForm.newPassword.length < 8) {
      setPwMsg('La nueva contraseña debe tener al menos 8 caracteres.');
      setPwStatus('error');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg('Las contraseñas no coinciden.');
      setPwStatus('error');
      return;
    }

    setPwLoading(true);
    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      setPwStatus('success');
      setPwMsg('¡Contraseña actualizada exitosamente!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPwStatus('error');
      setPwMsg(err.message || 'Error al cambiar la contraseña.');
    } finally {
      setPwLoading(false);
    }
  };

  const avatarSrc = avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=84cc16&color=000&size=200`;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-black transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Mi Perfil</h1>
            <p className="text-sm text-slate-500">Administra tu información personal</p>
          </div>
        </div>

        {/* Avatar + Datos personales */}
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Información Personal</h2>

          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-lime-400 shadow-lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={24} className="text-white" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <div
              className={`mt-4 w-full border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-lime-400 bg-lime-50' : 'border-slate-200 hover:border-lime-300 hover:bg-slate-50'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <UploadCloud size={20} className="mx-auto mb-1 text-slate-400" />
              <p className="text-xs text-slate-500 font-medium">
                {avatarFile ? <span className="text-lime-600 font-bold">{avatarFile.name}</span> : 'Arrastra una foto o haz click para subir'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">JPG, PNG o WebP · Máx 5 MB</p>
            </div>
            {avatarFile && (
              <button
                type="button"
                onClick={() => { setAvatarFile(null); setAvatarPreview(user?.avatar || ''); }}
                className="mt-2 flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 font-bold"
              >
                <Trash2 size={12} /> Quitar foto seleccionada
              </button>
            )}
          </div>

          {/* Nombre */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Nombre completo
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                  placeholder="Tu nombre completo"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Nombre de usuario
              </label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                  placeholder="usuario_unico"
                />
              </div>
            </div>

            {/* Email (solo lectura) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Correo electrónico <span className="text-slate-300 normal-case font-normal">(no editable)</span>
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Celular
              </label>
              <div className="flex gap-2">
                <select
                  value={form.countryCode}
                  onChange={(e) => setForm(f => ({ ...f, countryCode: e.target.value }))}
                  className="px-3 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.iso.toUpperCase()} {c.code}</option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                    placeholder="3001234567"
                  />
                </div>
              </div>
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Fecha de nacimiento
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm(f => ({ ...f, birthDate: e.target.value }))}
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Feedback */}
          {profileStatus !== 'idle' && (
            <div className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${profileStatus === 'success' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {profileStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {profileMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-black text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>

        {/* Cambio de contraseña */}
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Cambiar Contraseña</h2>

          {user && !user.avatar?.includes('googleapis') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Contraseña actual
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowCurrentPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black">
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowNewPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Indicador de fuerza */}
                {pwForm.newPassword && (
                  <div className="mt-2 flex gap-1">
                    {[1,2,3,4].map(n => (
                      <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${
                        pwForm.newPassword.length >= n * 3
                          ? n <= 2 ? 'bg-red-400' : n === 3 ? 'bg-amber-400' : 'bg-lime-500'
                          : 'bg-slate-200'
                      }`} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent ${
                      pwForm.confirmPassword && pwForm.confirmPassword !== pwForm.newPassword
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-200'
                    }`}
                    placeholder="Repite la contraseña"
                  />
                </div>
                {pwForm.confirmPassword && pwForm.confirmPassword !== pwForm.newPassword && (
                  <p className="text-xs text-red-500 mt-1 ml-1">Las contraseñas no coinciden</p>
                )}
              </div>

              {/* Feedback contraseña */}
              {pwStatus !== 'idle' && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${pwStatus === 'success' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {pwStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {pwMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Lock size={16} />}
                {pwLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          )}

          {/* Usuarios OAuth no pueden cambiar contraseña */}
          {user?.avatar?.includes('googleapis') && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-500 text-center">
              Tu cuenta está vinculada a Google. El cambio de contraseña se gestiona desde tu cuenta de Google.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Profile;

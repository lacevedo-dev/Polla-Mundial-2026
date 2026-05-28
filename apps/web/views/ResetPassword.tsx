import React from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { request } from '../api';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      await request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'No fue posible restablecer la contraseña. El enlace puede haber expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-black text-slate-900">Enlace inválido</h2>
          <p className="text-slate-500 text-sm">El enlace de restablecimiento es inválido. Por favor solicita uno nuevo.</p>
          <Button className="w-full" onClick={() => navigate('/forgot-password')}>
            Solicitar nuevo enlace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full mb-6">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Volver al login
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-black p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-brand text-black text-2xl font-black">26</div>
            <h1 className="font-brand text-xl tracking-tight">POLLA<span className="text-lime-400">2026</span></h1>
          </div>
          <h2 className="text-2xl font-black font-brand uppercase">Nueva contraseña</h2>
          <p className="text-slate-400 mt-2 text-sm">Elige una contraseña segura de al menos 8 caracteres.</p>
        </div>

        <div className="p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-lime-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-lime-600" />
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-900">¡Contraseña actualizada!</h3>
              <p className="text-sm text-slate-500">Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.</p>
              <Button className="w-full mt-4 gap-2" onClick={() => navigate('/login')}>
                Iniciar sesión <ArrowRight size={16} />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center gap-2 rounded-r-xl">
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Confirmar Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent disabled:opacity-60"
                />
              </div>

              <Button className="w-full gap-2" size="lg" isLoading={isLoading} type="submit">
                Actualizar contraseña <ArrowRight size={18} />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

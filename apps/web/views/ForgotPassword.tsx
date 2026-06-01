import React from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { request } from '../api';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'No fue posible procesar la solicitud. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h2 className="text-2xl font-black font-brand uppercase">¿Olvidaste tu contraseña?</h2>
          <p className="text-slate-400 mt-2 text-sm">Ingresa tu correo o documento y te enviaremos las instrucciones para restablecerla.</p>
        </div>

        <div className="p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-lime-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-lime-600" />
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-900">¡Correo enviado!</h3>
              <p className="text-sm text-slate-500">
                Si <strong>{identifier}</strong> está registrado, recibirás las instrucciones en los próximos minutos.
              </p>
              <p className="text-xs text-slate-400">Revisa también tu carpeta de spam.</p>
              <Button className="w-full mt-4" onClick={() => navigate('/login')}>
                Volver al login
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
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Correo o documento</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isLoading}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="tu@email.com o cédula"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent disabled:opacity-60"
                  />
                </div>
              </div>

              <Button className="w-full gap-2" size="lg" isLoading={isLoading} type="submit">
                Enviar instrucciones <ArrowRight size={18} />
              </Button>

              <p className="text-center text-xs text-slate-400">
                ¿Recordaste tu contraseña?{' '}
                <button type="button" onClick={() => navigate('/login')} className="text-slate-700 font-bold hover:underline">
                  Iniciar sesión
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

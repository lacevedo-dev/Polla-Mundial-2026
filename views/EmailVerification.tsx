
import React from 'react';
import { Button, Card, Badge } from '../components/UI';
import { AppView } from '../types';
import { Mail, ArrowRight, RefreshCw, LogIn, CheckCircle2, Inbox, MousePointerClick } from 'lucide-react';

interface EmailVerificationProps {
  onViewChange: (view: AppView) => void;
  email?: string;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ onViewChange, email }) => {
  const [isResending, setIsResending] = React.useState(false);
  const [hasResent, setHasResent] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);

  const handleResend = () => {
    setIsResending(true);
    setTimeout(() => {
      setIsResending(false);
      setHasResent(true);
    }, 1500);
  };

  const simulateLinkClick = () => {
    setIsVerifying(true);
    setTimeout(() => {
      onViewChange('dashboard');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
        <Card className="p-8 md:p-12 text-center relative overflow-hidden flex flex-col items-center">
          {/* Decorative Pattern */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-lime-400/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>

          <div className="w-24 h-24 bg-lime-400/10 rounded-full flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-lime-400/20 rounded-full animate-ping"></div>
            <div className="bg-lime-400 text-black w-16 h-16 rounded-full flex items-center justify-center relative z-10 shadow-lg shadow-lime-400/30">
              <Mail size={32} />
            </div>
          </div>

          <Badge color="bg-lime-100 text-lime-700 mb-4">Casi Listo</Badge>
          
          <h2 className="text-3xl font-black font-brand leading-tight uppercase mb-4 tracking-tighter">
            VERIFICA TU <span className="text-lime-500">CORREO</span>
          </h2>
          
          <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Enviamos un enlace a:</p>
            <p className="text-sm font-bold text-slate-900 break-all">{email || 'tu@email.com'}</p>
          </div>
          
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Haz clic en el enlace único que recibiste para activar tu cuenta. Si no lo ves, revisa tu carpeta de <span className="font-bold">SPAM</span>.
          </p>

          <div className="space-y-4 w-full">
            <Button 
              className="w-full gap-2 shadow-lime-400/20" 
              variant="secondary" 
              size="lg"
              onClick={() => window.open(`https://${email?.split('@')[1] || 'mail.google.com'}`, '_blank')}
            >
              <Inbox size={20} /> Abrir mi Correo
            </Button>
            
            <div className="relative py-4">
               <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
               <span className="relative bg-white px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Demo Mode</span>
            </div>

            <Button 
              className="w-full gap-2 border-dashed" 
              variant="outline" 
              isLoading={isVerifying}
              onClick={simulateLinkClick}
            >
              <MousePointerClick size={18} /> Simular click en el enlace
            </Button>
            
            <div className="pt-4">
              <button 
                onClick={handleResend}
                disabled={isResending || hasResent || isVerifying}
                className="flex items-center justify-center gap-2 w-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-all disabled:opacity-50"
              >
                {isResending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : hasResent ? (
                  <CheckCircle2 size={14} className="text-lime-500" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {hasResent ? 'Enlace reenviado con éxito' : 'Reenviar enlace de confirmación'}
              </button>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 w-full flex flex-col gap-4">
             <div className="flex justify-center gap-4">
                <button 
                  onClick={() => onViewChange('login')}
                  disabled={isVerifying}
                  className="text-xs font-bold text-slate-600 hover:text-black flex items-center gap-1 transition-colors disabled:opacity-0"
                >
                  <LogIn size={14} /> Volver al Login
                </button>
             </div>
          </div>
        </Card>

        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
            El enlace expira en 24 horas
          </p>
          <div className="flex gap-1 h-1 w-24">
            <div className="h-full bg-lime-500 flex-[0.7] rounded-full"></div>
            <div className="h-full bg-slate-200 flex-[0.3] rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;

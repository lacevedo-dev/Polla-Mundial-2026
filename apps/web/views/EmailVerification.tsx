import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Badge } from '../components/UI';
import { Input } from '../components/UI';
import {
  Mail,
  RefreshCw,
  LogIn,
  CheckCircle2,
  Inbox,
  MousePointerClick,
  Loader,
  AlertCircle,
  Copy,
  Check as CheckIcon
} from 'lucide-react';
import { useAuthStore } from '../stores/auth.store';

interface EmailVerificationProps {
  email?: string;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ email: propEmail }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyEmail, resendVerification, isLoading, user } = useAuthStore();

  const [token, setToken] = React.useState('');
  const [manualToken, setManualToken] = React.useState('');
  const [verificationError, setVerificationError] = React.useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [showTokenInput, setShowTokenInput] = React.useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = React.useState(false);
  const [isSimulating, setIsSimulating] = React.useState(false);

  // Get email from props, user store, or sessionStorage
  const displayEmail = propEmail || user?.email || sessionStorage.getItem('registrationEmail') || '';

  // Auto-detect token from URL query param
  React.useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      // Auto-submit verification if token is in URL
      handleVerifyWithToken(urlToken);
    }
  }, [searchParams]);

  const handleVerifyWithToken = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setVerificationError('Por favor ingresa un token válido.');
      return;
    }

    setVerificationError(null);
    setResendMessage(null);

    try {
      await verifyEmail(tokenToVerify);
      setVerificationSuccess(true);
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.message || 'Error al verificar el token.';
      if (errorMessage.includes('expirado') || errorMessage.includes('expired')) {
        setVerificationError('El token ha expirado. Por favor solicita uno nuevo.');
      } else if (errorMessage.includes('inválido') || errorMessage.includes('invalid')) {
        setVerificationError('El token es inválido. Por favor verifica y vuelve a intentar.');
      } else {
        setVerificationError(errorMessage);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerifyWithToken(manualToken);
  };

  const handleResend = async () => {
    if (!displayEmail) {
      setResendMessage('Error: No se encontró el email del usuario.');
      return;
    }

    setResendLoading(true);
    setResendMessage(null);

    try {
      await resendVerification();
      setResendMessage('¡Hemos reenviado el enlace de verificación! Revisa tu email.');
      setVerificationError(null);
    } catch (err: any) {
      setResendMessage(`Error al reenviar: ${err.message || 'Intenta más tarde.'}`);
    } finally {
      setResendLoading(false);
    }
  };

  const copyTokenToClipboard = () => {
    if (manualToken) {
      navigator.clipboard.writeText(manualToken);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  const simulateLinkClick = () => {
    setIsSimulating(true);
    setTimeout(() => {
      navigate('/dashboard');
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
            {verificationSuccess ? (
              <div className="bg-lime-400 text-black w-16 h-16 rounded-full flex items-center justify-center relative z-10 shadow-lg shadow-lime-400/30 animate-in scale-in duration-500">
                <CheckCircle2 size={32} />
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-lime-400/20 rounded-full animate-ping"></div>
                <div className="bg-lime-400 text-black w-16 h-16 rounded-full flex items-center justify-center relative z-10 shadow-lg shadow-lime-400/30">
                  <Mail size={32} />
                </div>
              </>
            )}
          </div>

          <Badge color={verificationSuccess ? "bg-lime-100 text-lime-700 mb-4" : "bg-lime-100 text-lime-700 mb-4"}>
            {verificationSuccess ? 'Verificado' : 'Casi Listo'}
          </Badge>

          <h2 className="text-3xl font-black font-brand leading-tight uppercase mb-4 tracking-tighter">
            {verificationSuccess ? (
              <>CORREO <span className="text-lime-600">VERIFICADO</span></>
            ) : (
              <>VERIFICA TU <span className="text-lime-600">CORREO</span></>
            )}
          </h2>

          <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Enviamos un enlace a:</p>
            <p className="text-sm font-bold text-slate-900 break-all">{displayEmail || 'tu@email.com'}</p>
          </div>

          {/* Error Message */}
          {verificationError && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-start gap-2 rounded-r-xl animate-in fade-in slide-in-from-left-2 w-full"
            >
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-bold">{verificationError}</p>
                {verificationError.includes('expirado') && (
                  <p className="text-[10px] mt-1 text-red-600">Solicita un nuevo enlace abajo.</p>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {resendMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-4 p-3 bg-lime-50 border-l-4 border-lime-500 text-lime-700 text-xs flex items-start gap-2 rounded-r-xl animate-in fade-in slide-in-from-left-2 w-full"
            >
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <p className="font-bold text-left">{resendMessage}</p>
            </div>
          )}

          {!verificationSuccess && (
            <>
              {/* Token Display from URL (if auto-detected) */}
              {token && !showTokenInput && (
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 w-full">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-widest text-left">
                    Detectamos un token
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-300">
                    <code className="flex-1 text-xs font-mono text-slate-700 break-all text-left">
                      {token.substring(0, 20)}...
                    </code>
                    <button
                      type="button"
                      onClick={() => setShowTokenInput(true)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Token Input Form */}
              {showTokenInput && (
                <form onSubmit={handleManualSubmit} className="space-y-3 mb-6 w-full">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-widest text-left block">
                      Código de Verificación
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Pega el código del email"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        disabled={isLoading}
                        className="flex-1"
                      />
                      {manualToken && (
                        <button
                          type="button"
                          onClick={copyTokenToClipboard}
                          className="px-3 h-10 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          title="Copiar al portapapeles"
                        >
                          {copiedToClipboard ? (
                            <CheckIcon size={16} className="text-lime-600" />
                          ) : (
                            <Copy size={16} className="text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 ml-1 text-left">
                      El código se encuentra en el email que te enviamos
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={!manualToken.trim() || isLoading}
                    isLoading={isLoading}
                    variant="secondary"
                    size="lg"
                    className="w-full gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin" /> Verificando...
                      </>
                    ) : (
                      'Verificar Email'
                    )}
                  </Button>
                </form>
              )}
            </>
          )}

          {verificationSuccess ? (
            <div className="space-y-4 w-full">
              <p className="text-slate-600 text-sm">
                Serás redirigido al dashboard en unos segundos...
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="secondary"
                size="lg"
                className="w-full gap-2"
              >
                Ir a Dashboard Ahora
              </Button>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              <Button
                className="w-full gap-2 shadow-lime-400/20"
                variant="secondary"
                size="lg"
                onClick={() => window.open(`https://${displayEmail?.split('@')[1] || 'mail.google.com'}`, '_blank')}
              >
                <Inbox size={20} /> Abrir mi Correo
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <span className="relative bg-white px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">O Ingresa el Código</span>
              </div>

              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => setShowTokenInput(!showTokenInput)}
              >
                <Copy size={18} /> {showTokenInput ? 'Ocultar' : 'Ingresar'} Código Manualmente
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <span className="relative bg-white px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Demo Mode</span>
              </div>

              <Button
                className="w-full gap-2 border-dashed"
                variant="outline"
                isLoading={isSimulating}
                onClick={simulateLinkClick}
              >
                <MousePointerClick size={18} /> Simular click en enlace
              </Button>

              <div className="pt-2">
                <button
                  onClick={handleResend}
                  disabled={resendLoading || isLoading}
                  className="flex items-center justify-center gap-2 w-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-all disabled:opacity-50"
                >
                  {resendLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {resendLoading ? 'Reenviando...' : 'Reenviar enlace de confirmación'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 w-full flex flex-col gap-4">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/login')}
                disabled={isSimulating}
                className="text-xs font-bold text-slate-600 hover:text-black flex items-center gap-1 transition-colors disabled:opacity-0"
              >
                <LogIn size={14} /> Volver al Login
              </button>
            </div>
          </div>
        </Card>

        {!verificationSuccess && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
              El enlace expira en 24 horas
            </p>
            <div className="flex gap-1 h-1 w-24">
              <div className="h-full bg-lime-500 flex-[0.7] rounded-full"></div>
              <div className="h-full bg-slate-200 flex-[0.3] rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;

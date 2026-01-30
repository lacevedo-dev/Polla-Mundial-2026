
import React from 'react';
import { Button, Input, EmailAutocompleteInput, Checkbox } from '../components/UI';
import { AppView } from '../types';
import { LogIn, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';

interface LoginProps {
  onViewChange: (view: AppView) => void;
}

const Login: React.FC<LoginProps> = ({ onViewChange }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API delay for demo
    setTimeout(() => {
      setIsLoading(false);
      onViewChange('dashboard');
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-5xl w-full mb-6">
        <button 
          onClick={() => onViewChange('landing')} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Inicio
        </button>
      </div>
      
      <div className={`max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[600px] transition-all duration-500 ${isLoading ? 'scale-[0.99] opacity-95' : 'scale-100 opacity-100'}`}>
        {/* Visual Brand Side */}
        <div className="hidden md:flex flex-col justify-between bg-black p-12 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-brand text-black text-3xl font-black">26</div>
              <h1 className="font-brand text-2xl tracking-tight text-white">POLLA<span className="text-lime-400">2026</span></h1>
            </div>
            <h2 className="text-5xl font-black font-brand leading-tight text-white mb-6 uppercase">
              BIENVENIDO AL <span className="text-lime-400">MAÑANA.</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-sm">
              Inicia sesión para acceder a tus predicciones y competir por premios exclusivos del Mundial 2026.
            </p>
          </div>
          
          <div className="relative z-10 flex gap-6 text-sm">
             <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck size={18} className="text-lime-400" />
                Seguro & Cifrado
             </div>
          </div>

          {/* Decorative background pattern */}
          <div className="absolute top-1/2 -right-20 transform -translate-y-1/2 opacity-10 pointer-events-none">
             <div className="w-[500px] h-[500px] border-[40px] border-lime-400 rounded-full"></div>
          </div>
        </div>

        {/* Form Side */}
        <div className="p-8 md:p-16 flex flex-col justify-center">
          <div className="md:hidden flex justify-center mb-8">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center font-brand text-white text-3xl font-black">26</div>
          </div>
          <div className="mb-10 text-center md:text-left">
            <h3 className="text-3xl font-black font-brand mb-2">INICIAR SESIÓN</h3>
            <p className="text-slate-500">¿No tienes cuenta? <button onClick={() => onViewChange('register')} className="text-lime-600 font-bold hover:underline" disabled={isLoading}>Regístrate gratis</button></p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-1">Correo Electrónico</label>
              <EmailAutocompleteInput 
                placeholder="tu@email.com" 
                required 
                disabled={isLoading}
                value={email}
                onValueChange={setEmail}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Contraseña</label>
                <button type="button" className="text-[10px] font-bold text-slate-400 hover:text-black transition-colors uppercase tracking-wider" disabled={isLoading}>¿Olvidaste tu contraseña?</button>
              </div>
              <Input type="password" placeholder="••••••••" required disabled={isLoading} />
            </div>

            <div className="flex items-center justify-between py-2">
              <Checkbox 
                id="remember-me" 
                label="Mantenerme conectado" 
                checked={rememberMe} 
                onChange={setRememberMe} 
                disabled={isLoading}
              />
            </div>

            <Button className="w-full gap-2" size="lg" isLoading={isLoading} type="submit">
              Entrar al Estadio <ArrowRight size={18} />
            </Button>
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold tracking-widest">O continúa con</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <Button variant="outline" className="gap-2 text-slate-600" disabled={isLoading}>
                  <img src="https://github.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt="G" /> GitHub
               </Button>
               <Button variant="outline" className="gap-2 text-slate-600" disabled={isLoading}>
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt="G" /> Google
               </Button>
            </div>
          </form>
          
          <p className="mt-12 text-[10px] text-center text-slate-400 uppercase tracking-widest font-medium">
            Al ingresar, aceptas nuestros <span className="text-slate-600 cursor-pointer hover:underline">Términos de Servicio</span> y <span className="text-slate-600 cursor-pointer hover:underline">Privacidad</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

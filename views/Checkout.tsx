
import React from 'react';
import { Button, Card, Badge, Input } from '../components/UI';
import { AppView } from '../types';
import { 
  ArrowLeft, 
  CreditCard, 
  ShieldCheck, 
  Lock, 
  Globe, 
  CheckCircle2,
  Crown,
  Zap
} from 'lucide-react';

interface CheckoutProps {
  onViewChange: (view: AppView) => void;
}

const Checkout: React.FC<CheckoutProps> = ({ onViewChange }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [step, setStep] = React.useState(1);

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => onViewChange('landing')} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-black mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Landing
        </button>

        {step === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Formulario de Pago */}
            <Card className="p-8 md:p-12 space-y-8 shadow-2xl">
              <div className="space-y-2">
                <h2 className="text-2xl font-black font-brand uppercase tracking-tight">Finalizar Compra</h2>
                <p className="text-slate-500 text-sm font-medium">Estás a un paso de liderar tu propia Liga Pro.</p>
              </div>

              <form onSubmit={handlePayment} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Número de Tarjeta</label>
                    <Input leftIcon={<CreditCard size={16} />} placeholder="0000 0000 0000 0000" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Expira</label>
                      <Input placeholder="MM/YY" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">CVC</label>
                      <Input placeholder="123" required />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                   <div className="flex justify-between text-xs font-bold uppercase tracking-tight text-slate-500">
                      <span>Subtotal Liga Pro</span>
                      <span>$29.00</span>
                   </div>
                   <div className="flex justify-between text-xs font-bold uppercase tracking-tight text-slate-500">
                      <span>Impuestos (0%)</span>
                      <span>$0.00</span>
                   </div>
                   <div className="h-px bg-slate-200"></div>
                   <div className="flex justify-between text-lg font-black uppercase tracking-tighter text-black">
                      <span>Total a Pagar</span>
                      <span>$29.00</span>
                   </div>
                </div>

                <Button type="submit" size="lg" className="w-full h-16 rounded-2xl font-black text-lg gap-2" variant="secondary" isLoading={isLoading}>
                   <Lock size={20} /> PAGAR AHORA
                </Button>

                <div className="flex items-center justify-center gap-4 text-slate-400">
                   <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                      <ShieldCheck size={12} className="text-lime-500" /> Secure SSL
                   </div>
                   <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest">
                      <Globe size={12} className="text-lime-500" /> Global Support
                   </div>
                </div>
              </form>
            </Card>

            {/* Resumen del Producto */}
            <div className="space-y-8">
               <Card className="bg-black text-white p-8 space-y-6 relative overflow-hidden border-0">
                  <Crown size={150} className="absolute -bottom-10 -right-10 opacity-10 text-lime-400" />
                  <Badge color="bg-lime-400 text-black">Plan Pro Seleccionado</Badge>
                  <h3 className="text-3xl font-black font-brand uppercase tracking-tighter">LIGA PRO <br/>ACTIVA.</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Incluye todas las herramientas para gestionar tu comunidad sin límites durante todo el Mundial 2026.</p>
                  
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    {[
                      'Jugadores Ilimitados',
                      'Dashboard de Admin Pro',
                      'Publicidad Eliminada',
                      'Soporte Prioritario',
                      'Exportación de Datos'
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-300">
                         <CheckCircle2 size={14} className="text-lime-400" /> {item}
                      </div>
                    ))}
                  </div>
               </Card>

               <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-lime-50 text-lime-600 rounded-2xl flex items-center justify-center">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest">Activación Instantánea</h4>
                    <p className="text-xs text-slate-500">Tu liga estará lista inmediatamente después del pago.</p>
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-in zoom-in duration-500">
            <Card className="p-12 text-center space-y-8 shadow-2xl overflow-hidden relative border-0">
               <div className="absolute top-0 left-0 w-full h-2 bg-lime-400"></div>
               <div className="w-24 h-24 bg-lime-100 text-lime-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={56} />
               </div>
               <div className="space-y-2">
                 <h2 className="text-3xl font-black font-brand uppercase tracking-tighter">¡COMPRA EXITOSA!</h2>
                 <p className="text-slate-500 font-medium">Tu licencia Pro ha sido activada y vinculada a tu cuenta.</p>
               </div>
               
               <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Orden</p>
                  <div className="flex justify-between font-bold text-sm">
                    <span>Orden #</span>
                    <span className="font-mono">POL-26-4829</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm">
                    <span>Producto</span>
                    <span>Licencia Liga Pro</span>
                  </div>
               </div>

               <div className="space-y-4">
                 <Button onClick={() => onViewChange('dashboard')} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest" size="lg">Ir al Dashboard</Button>
                 <Button onClick={() => onViewChange('register')} variant="outline" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest border-slate-300" size="lg">Crear Mi Primera Liga</Button>
               </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;

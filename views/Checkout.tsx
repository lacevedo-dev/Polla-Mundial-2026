
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
  Diamond,
  Check,
  Sparkles,
  ArrowRight,
  Shield,
  User,
  Calendar
} from 'lucide-react';

interface CheckoutProps {
  onViewChange: (view: AppView) => void;
  initialPlan?: 'gold' | 'diamond';
}

const Checkout: React.FC<CheckoutProps> = ({ onViewChange, initialPlan = 'gold' }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = React.useState<'gold' | 'diamond'>(initialPlan);
  
  // DEMO DATA
  const [paymentData, setPaymentData] = React.useState({
    holder: 'JUAN MUNDIALISTA',
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/26',
    cvc: '123'
  });

  const plans = {
    gold: {
      id: 'gold',
      name: 'PREMIUM GOLD',
      price: '29.900',
      icon: <Sparkles size={20} className="text-amber-400" />,
      theme: 'amber',
      badge: 'bg-amber-400 text-slate-950',
      description: 'Ideal para grupos de amigos y pequeñas ligas.',
      features: ['Uso de IA Ilimitado', 'Hasta 50 Jugadores', 'Estética Gold', 'Soporte Estándar']
    },
    diamond: {
      id: 'diamond',
      name: 'EMPRESA DIAMOND',
      price: '89.900',
      icon: <Diamond size={20} className="text-cyan-400" />,
      theme: 'cyan',
      badge: 'bg-cyan-400 text-slate-950',
      description: 'Nivel profesional para empresas y marcas.',
      features: ['Logo Personalizado', 'Jugadores Ilimitados', 'Dashboard Analytics', 'Soporte 24/7 VIP']
    }
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(3);
    }, 2000);
  };

  const currentPlan = plans[selectedPlan];

  return (
    <div className="min-h-screen bg-slate-50 py-4 px-4 flex flex-col items-center justify-center overflow-hidden">
      <div className="max-w-4xl w-full space-y-3">
        
        <div className="flex justify-between items-center px-2">
          <button onClick={() => step === 1 ? onViewChange('create-league') : setStep(1)} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400"><ArrowLeft size={12} /> {step === 1 ? 'VOLVER' : 'REGRESAR'}</button>
          <div className="flex gap-1">{[1, 2, 3].map(s => <div key={s} className={`w-5 h-1 rounded-full ${step >= s ? 'bg-lime-500' : 'bg-slate-200'}`}></div>)}</div>
        </div>

        {step === 1 && (
          <div className="space-y-3 animate-in fade-in duration-500">
            <div className="text-center"><h2 className="text-2xl font-black font-brand uppercase tracking-tighter">MEJORA TU <span className="text-lime-600">PLAN.</span></h2></div>

            <div className="flex p-1 bg-slate-200 rounded-2xl gap-1 max-w-[320px] mx-auto">
               <button onClick={() => setSelectedPlan('gold')} className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${selectedPlan === 'gold' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>GOLD</button>
               <button onClick={() => setSelectedPlan('diamond')} className={`flex-1 py-2 rounded-xl font-black text-[9px] uppercase transition-all ${selectedPlan === 'diamond' ? 'bg-[#0a0f1d] text-white shadow-md' : 'text-slate-500'}`}>DIAMOND</button>
            </div>

            <Card className={`p-0 overflow-hidden border-2 rounded-[2.5rem] transition-all duration-700 ${selectedPlan === 'gold' ? 'border-amber-400 bg-white' : 'border-cyan-400 bg-[#0a0f1d] text-white'}`}>
               <div className="p-6 md:p-8 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1"><Badge color={currentPlan.badge}>OFERTA</Badge><h3 className="text-2xl font-black font-brand uppercase leading-none">{currentPlan.name}</h3></div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedPlan === 'gold' ? 'bg-amber-50' : 'bg-white/5'}`}>{currentPlan.icon}</div>
                  </div>

                  <div className={`p-4 rounded-[1.5rem] flex items-center justify-between border ${selectedPlan === 'gold' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10'}`}>
                    <div className="shrink-0">
                      <p className="text-[7px] font-black uppercase text-slate-400 mb-0.5">INVERSIÓN ÚNICA</p>
                      <div className="flex items-baseline gap-1"><span className="text-2xl font-black font-brand tracking-tighter leading-none">${currentPlan.price}</span><span className="text-[8px] font-black text-slate-400">COP</span></div>
                    </div>
                    <Button onClick={() => setStep(2)} className={`h-10 px-5 rounded-xl font-black text-[9px] uppercase tracking-widest ${selectedPlan === 'gold' ? 'bg-amber-400 text-slate-950' : 'bg-cyan-400 text-slate-950'}`}>SELECCIONAR <ArrowRight size={12} className="ml-1" /></Button>
                  </div>

                  <div className="space-y-4 pt-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-relaxed">{currentPlan.description}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {currentPlan.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2"><Check size={10} className={selectedPlan === 'gold' ? 'text-amber-500' : 'text-cyan-400'} /><span className="text-[9px] font-black uppercase text-slate-400">{feat}</span></div>
                      ))}
                    </div>
                  </div>
               </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in duration-500 space-y-4">
             <div className={`p-4 rounded-[1.5rem] flex justify-between items-center ${selectedPlan === 'gold' ? 'bg-amber-400' : 'bg-cyan-400'} text-slate-950`}>
                 <span className="text-[10px] font-black uppercase tracking-widest">{currentPlan.name}</span>
                 <span className="text-lg font-black font-brand">${currentPlan.price}</span>
             </div>
             <Card className="p-6 md:p-10 space-y-6 rounded-[2.5rem] border-0">
                <div className="flex items-center gap-3"><Shield size={20} className="text-lime-600" /><h2 className="text-xl font-black font-brand uppercase tracking-tight">PAGO SEGURO</h2></div>
                <form onSubmit={handlePayment} className="space-y-4">
                   <div className="space-y-3">
                      <Input placeholder="Nombre del Titular" required value={paymentData.holder} onChange={e => setPaymentData({...paymentData, holder: e.target.value.toUpperCase()})} leftIcon={<User size={16}/>} className="text-xs font-bold" />
                      <Input placeholder="Número de Tarjeta" required value={paymentData.cardNumber} leftIcon={<CreditCard size={16}/>} className="text-xs font-mono" />
                      <div className="grid grid-cols-2 gap-3">
                         <Input placeholder="MM / YY" required value={paymentData.expiry} leftIcon={<Calendar size={14}/>} className="text-xs text-center font-bold" />
                         <Input placeholder="CVC" required value={paymentData.cvc} leftIcon={<Lock size={14}/>} className="text-xs text-center font-bold" />
                      </div>
                   </div>
                   <Button type="submit" className="w-full h-14 rounded-[2rem] font-black text-[10px] tracking-widest shadow-xl" variant="primary" isLoading={isLoading}><ShieldCheck size={16} className="mr-2" /> FINALIZAR COMPRA</Button>
                </form>
             </Card>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-md mx-auto animate-in zoom-in duration-500">
            <Card className="p-8 text-center space-y-6 rounded-[3rem] border-0">
               <div className="w-16 h-16 bg-lime-100 text-lime-600 rounded-3xl flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
               <h2 className="text-2xl font-black font-brand uppercase tracking-tighter">¡ÉXITO TOTAL!</h2>
               <div className="bg-slate-50 p-5 rounded-[2rem] text-left space-y-3 border border-slate-100">
                  <div className="flex justify-between font-black text-[9px] uppercase text-slate-600"><span>PLAN ACTIVADO</span><span className="text-slate-900">{currentPlan.name}</span></div>
                  <div className="flex justify-between font-black text-[9px] uppercase text-slate-600 border-t border-slate-200 pt-2"><span>VALOR</span><span className="text-lime-600">${currentPlan.price} COP</span></div>
               </div>
               <Button onClick={() => onViewChange('dashboard')} className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em]">IR AL TABLERO</Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;

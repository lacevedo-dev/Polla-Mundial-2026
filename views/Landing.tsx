
import React, { useEffect, useState, useRef } from 'react';
import { Button, Badge, Card } from '../components/UI';
import { AppView } from '../types';
import { 
  Trophy, 
  Target, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Globe, 
  TrendingUp,
  Award,
  Smartphone,
  Sparkles,
  MessageSquare,
  Lock,
  Instagram,
  Facebook,
  ChevronUp,
  PlayCircle,
  UserPlus,
  LogIn,
  Settings2,
  X
} from 'lucide-react';

interface LandingProps {
  onViewChange: (view: AppView) => void;
}

const Landing: React.FC<LandingProps> = ({ onViewChange }) => {
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    });

    const sections = ['hero', 'how-it-works', 'prizes', 'community', 'pricing'];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.current?.observe(el);
    });

    return () => {
      observer.current?.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col relative">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToTop()}>
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center font-brand text-white text-2xl font-black shadow-lg">26</div>
            <span className="font-brand text-xl font-black tracking-tighter uppercase">POLLA<span className="text-lime-500">2026</span></span>
          </div>
          
          <div className="hidden lg:flex items-center gap-8">
            {[
              { id: 'how-it-works', label: 'Cómo Funciona' },
              { id: 'prizes', label: 'Premios' },
              { id: 'community', label: 'Comunidad' },
              { id: 'pricing', label: 'Precios' }
            ].map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className={`text-xs font-black uppercase tracking-widest transition-all relative py-1 ${
                  activeSection === link.id ? 'text-lime-600' : 'text-slate-500 hover:text-black'
                }`}
              >
                {link.label}
                {activeSection === link.id && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-lime-500 animate-in fade-in zoom-in duration-300" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => onViewChange('login')} className="text-xs font-black uppercase tracking-widest text-slate-900 hover:text-lime-600 transition-colors">Entrar</button>
            <Button onClick={() => onViewChange('register')} variant="secondary" size="md" className="px-6 rounded-full font-black">¡JUGAR YA!</Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero" className="relative px-6 pt-16 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
              <Badge color="bg-lime-100 text-lime-700 border border-lime-200 px-4 py-2 uppercase tracking-widest">MUNDIAL 2026 • ACCESO ANTICIPADO</Badge>
              <h1 className="text-6xl lg:text-8xl font-black font-brand leading-[0.85] tracking-tighter uppercase text-slate-900">
                PRONOSTICA <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500">GANA & DOMINA.</span>
              </h1>
              <p className="text-slate-500 text-xl max-w-xl leading-relaxed font-medium">
                La plataforma más estética y potente para gestionar tu polla mundialista. Desde grupos de amigos hasta ligas corporativas masivas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={() => onViewChange('register')} size="lg" className="px-10 py-7 text-lg rounded-full group shadow-2xl shadow-lime-500/20" variant="secondary">
                  REGISTRARME <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                </Button>
                <Button variant="ghost" size="lg" className="rounded-full px-10 py-7 text-lg border-2 border-slate-100 text-slate-500 hover:text-lime-600 hover:border-lime-200 font-black gap-2 transition-all" onClick={() => onViewChange('dashboard')}>
                  <PlayCircle size={22} className="text-lime-500" /> VER DEMO
                </Button>
                <Button variant="outline" size="lg" className="rounded-full px-10 py-7 text-lg border-slate-200" onClick={() => scrollTo('how-it-works')}>
                  CÓMO FUNCIONA
                </Button>
              </div>
            </div>
            <div className="relative animate-in zoom-in duration-1000">
              <div className="relative bg-slate-900 rounded-[3rem] p-4 shadow-3xl border border-white/10 rotate-2 hover:rotate-0 transition-transform duration-700 overflow-hidden">
                <img src="https://picsum.photos/seed/polla-ui-v2/1200/800" className="rounded-[2.5rem] opacity-90 w-full h-auto" alt="App Preview" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-3xl shadow-2xl border border-slate-50 flex items-center gap-4 animate-bounce">
                   <div className="w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center text-black shadow-lg"><TrendingUp /></div>
                   <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Liderando</p><p className="text-lg font-black uppercase">Juan (+15pts)</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content sections for scrollability */}
        <section id="how-it-works" className="py-32 bg-slate-50 border-y border-slate-100 px-6">
          <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <Badge color="bg-lime-100 text-lime-700">GUÍA PASO A PASO</Badge>
              <h3 className="text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter">¿CÓMO FUNCIONA LA <span className="text-lime-500">POLLA 2026?</span></h3>
              <p className="text-slate-500 text-xl font-medium leading-relaxed">Configura tu perfil, únete a una liga y empieza a predecir marcadores reales.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: '01', title: 'Registro y Perfil', icon: UserPlus },
                { step: '02', title: 'Únete a Ligas', icon: Globe },
                { step: '03', title: 'Tus Marcadores', icon: Target },
                { step: '04', title: 'Gana Premios', icon: Award },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-6 items-start p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:shadow-xl transition-all group">
                  <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center group-hover:bg-lime-400 group-hover:text-black transition-colors">
                    <item.icon size={28} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-black text-lime-600 uppercase tracking-[0.3em]">{item.step}</span>
                    <h3 className="text-xl font-black font-brand uppercase tracking-tight">{item.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="prizes" className="py-32 px-6">
          <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <Badge color="bg-purple-100 text-purple-700">RECOMPENSAS REALES</Badge>
              <h3 className="text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none text-slate-900">GRANDES <span className="text-purple-600">PREMIOS.</span></h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-800 rounded-[3rem] p-12 text-white space-y-6 relative overflow-hidden shadow-2xl flex flex-col justify-center">
                <Trophy size={400} className="absolute -bottom-20 -right-20 opacity-10" />
                <div className="relative z-10 space-y-4">
                  <Badge color="bg-white/20 text-white backdrop-blur-md uppercase">Primer Puesto Global</Badge>
                  <h2 className="text-5xl lg:text-7xl font-black font-brand uppercase leading-[0.9] tracking-tighter">VIAJE A LA <br/>GRAN FINAL</h2>
                  <Button variant="secondary" className="bg-white text-purple-600 font-black px-12 py-4 rounded-full mt-6 shadow-xl">DETALLES</Button>
                </div>
              </div>
              <div className="flex flex-col gap-8">
                {[
                  { title: 'iPhone 15 Pro Max', icon: Smartphone, color: 'bg-slate-900 text-white' },
                  { title: '$5,000 USD Cash', icon: Sparkles, color: 'bg-lime-400 text-black' },
                  { title: 'Consola PS5 Pro', icon: Zap, color: 'bg-cyan-500 text-white' },
                ].map((p, i) => (
                  <div key={i} className={`p-10 rounded-[2.5rem] flex items-center justify-between ${p.color} shadow-lg flex-1`}>
                    <h3 className="text-2xl font-black font-brand uppercase tracking-tight">{p.title}</h3>
                    <p.icon size={48} className="opacity-30" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER AREA WITH PERSISTENT STICKY LEGAL BAR */}
      <footer className="relative flex flex-col bg-white overflow-hidden">
        {/* Main Footer Links */}
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-4 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center font-brand text-white text-3xl font-black shadow-lg">26</div>
              <span className="font-brand text-2xl font-black tracking-tighter uppercase leading-none">POLLA<span className="text-lime-500">2026</span></span>
            </div>
            <p className="text-slate-500 text-base leading-relaxed font-medium max-w-sm">La plataforma oficial para el Mundial 2026. Unificando la pasión y el diseño en cada detalle.</p>
            <div className="flex gap-4">
              {[Instagram, Facebook, Globe, MessageSquare].map((Icon, i) => (
                <button key={i} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-black hover:text-white transition-all shadow-sm">
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h5 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-6">Navegación</h5>
            <ul className="space-y-4">
              {['Cómo Funciona', 'Premios 2026', 'Comunidad', 'Planes'].map((label, i) => (
                <li key={i}><button className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-lime-600 transition-colors">{label}</button></li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h5 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-6">Plataforma</h5>
            <ul className="space-y-4">
              {['Login', 'Registro', 'Ayuda'].map((label, i) => (
                <li key={i}><button className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-lime-600 transition-colors" onClick={() => onViewChange(label.toLowerCase() as any)}>{label}</button></li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <Card className="bg-slate-50 border border-slate-100 p-8 space-y-6 shadow-xl relative overflow-hidden group rounded-[2.5rem]">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-lime-400/10 rounded-full group-hover:scale-110 transition-transform duration-700"></div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <Lock size={20} className="text-lime-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal Seguro</span>
                </div>
                <p className="text-slate-800 text-sm font-bold leading-tight uppercase">¿Necesitas ayuda con tu liga? Nuestro equipo está listo.</p>
                <Button variant="secondary" className="w-full rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-lime-400/20">SOPORTE</Button>
              </div>
            </Card>
          </div>
        </div>

        {/* STICKY BOTTOM LEGAL BAR - Persistent from start */}
        <div className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 py-6 px-6 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1">
                  © 2026 POLLA MUNDIALISTA. UNA MARCA DE <span className="text-slate-900 font-black">AGILDESARROLLO</span>. <span className="hidden sm:inline">TODOS LOS DERECHOS RESERVADOS.</span>
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  {['PRIVACIDAD', 'TÉRMINOS', 'COOKIES', 'SEGURIDAD'].map(legal => (
                    <button key={legal} className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors">{legal}</button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-end gap-4 sm:gap-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                <ShieldCheck size={18} className="text-lime-500" />
                <div className="text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">SECURITY</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">PLATFORM CERTIFIED</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                <Globe size={18} className="text-slate-400" />
                <div className="text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">ACCESS</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">GLOBAL SERVICE</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Demo Quick Access Floating Menu */}
      <div className="fixed bottom-8 left-8 z-[70] flex flex-col items-start gap-3">
        {showDemoMenu && (
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-5 rounded-[2rem] shadow-2xl space-y-4 animate-in slide-in-from-left-4 fade-in duration-300 w-64">
             <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-600">Acceso Rápido Demo</h4>
                <button onClick={() => setShowDemoMenu(false)} className="text-slate-400 hover:text-black transition-colors"><X size={16}/></button>
             </div>
             <div className="grid grid-cols-1 gap-2">
                <button onClick={() => onViewChange('login')} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-lime-50 rounded-2xl border border-slate-100 transition-all group">
                   <LogIn size={16} className="text-slate-400 group-hover:text-lime-500"/>
                   <span className="text-xs font-black uppercase tracking-widest">Probar Login</span>
                </button>
                <button onClick={() => onViewChange('register')} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-lime-50 rounded-2xl border border-slate-100 transition-all group">
                   <UserPlus size={16} className="text-slate-400 group-hover:text-lime-500"/>
                   <span className="text-xs font-black uppercase tracking-widest">Probar Registro</span>
                </button>
                <button onClick={() => onViewChange('create-league')} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-lime-50 rounded-2xl border border-slate-100 transition-all group">
                   <Trophy size={16} className="text-slate-400 group-hover:text-lime-500"/>
                   <span className="text-xs font-black uppercase tracking-widest">Crear Liga (Directo)</span>
                </button>
                <button onClick={() => onViewChange('dashboard')} className="flex items-center gap-3 p-3 bg-black text-white rounded-2xl transition-all group shadow-lg shadow-black/10">
                   <Smartphone size={16} className="text-lime-400"/>
                   <span className="text-xs font-black uppercase tracking-widest">Omitir e ir a App</span>
                </button>
             </div>
             <p className="text-[9px] font-bold text-slate-400 uppercase text-center leading-tight">Usa estas opciones para validar las vistas rápidamente.</p>
          </div>
        )}
        <button
          onClick={() => setShowDemoMenu(!showDemoMenu)}
          className={`w-14 h-14 bg-white border-2 border-slate-100 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:border-lime-400 hover:shadow-lime-400/20 active:scale-95 group ${showDemoMenu ? 'rotate-90 bg-slate-50 border-lime-400' : ''}`}
        >
          <Settings2 size={24} className={`text-slate-500 transition-colors group-hover:text-lime-600 ${showDemoMenu ? 'text-lime-600' : ''}`} />
        </button>
      </div>

      {/* Floating Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-28 right-8 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 z-[60] hover:bg-slate-800 hover:-translate-y-2 active:scale-95 border-2 border-lime-400/30 ${
          showScrollTop ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-50 pointer-events-none'
        }`}
        aria-label="Volver arriba"
      >
        <ChevronUp size={28} strokeWidth={3} className="text-lime-400" />
      </button>
    </div>
  );
};

export default Landing;

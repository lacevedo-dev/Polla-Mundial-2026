
import React, { useEffect, useState, useRef } from 'react';
import { Button, Badge, Card } from '../components/UI';
import { AppView } from '../types';
import { 
  Trophy, 
  Users, 
  Target, 
  ShieldCheck, 
  ArrowRight, 
  Star, 
  Zap, 
  Globe, 
  CheckCircle2,
  TrendingUp,
  Award,
  Smartphone,
  ZapOff,
  Crown,
  Building2,
  Rocket,
  UserPlus,
  ChevronRight,
  Sparkles,
  Search,
  MessageSquare,
  Play,
  Lock
} from 'lucide-react';

interface LandingProps {
  onViewChange: (view: AppView) => void;
}

const Landing: React.FC<LandingProps> = ({ onViewChange }) => {
  const [activeSection, setActiveSection] = useState<string>('hero');
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
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

    return () => observer.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80; // height of sticky nav
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollTo('hero')}>
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

      {/* Hero Section */}
      <section id="hero" className="relative px-6 pt-16 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
            <Badge color="bg-lime-100 text-lime-700 border border-lime-200 px-4 py-2">Mundial 2026 • Acceso Anticipado</Badge>
            <h1 className="text-6xl lg:text-8xl font-black font-brand leading-[0.85] tracking-tighter uppercase text-slate-900">
              PRONOSTICA <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-emerald-500">GANA & DOMINA.</span>
            </h1>
            <p className="text-slate-500 text-xl max-w-xl leading-relaxed font-medium">
              La plataforma más estética y potente para gestionar tu polla mundialista. Desde grupos de amigos hasta ligas corporativas masivas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => onViewChange('register')} size="lg" className="px-12 py-8 text-xl rounded-full group shadow-2xl shadow-lime-500/20" variant="secondary">
                REGISTRARME <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-12 py-8 text-xl border-slate-200" onClick={() => scrollTo('how-it-works')}>
                VER CÓMO FUNCIONA
              </Button>
            </div>
          </div>
          <div className="relative animate-in zoom-in duration-1000">
             <div className="relative bg-slate-900 rounded-[3rem] p-4 shadow-3xl border border-white/10 rotate-2 hover:rotate-0 transition-transform duration-700">
                <img src="https://picsum.photos/seed/polla-ui/1200/800" className="rounded-[2.5rem] opacity-90" alt="App Preview" />
                <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl border border-slate-50 flex items-center gap-4 animate-bounce">
                   <div className="w-12 h-12 bg-lime-400 rounded-2xl flex items-center justify-center text-black shadow-lg"><TrendingUp /></div>
                   <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Liderando la Liga</p><p className="text-xl font-bold">Juan Pérez (+15pts)</p></div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-slate-50 px-6 border-y border-slate-100">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <Badge color="bg-lime-100 text-lime-700">Guía Paso a Paso</Badge>
            <h3 className="text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter">¿CÓMO FUNCIONA LA <span className="text-lime-500">POLLA 2026?</span></h3>
            <p className="text-slate-500 text-xl font-medium leading-relaxed">Dominar la tabla de posiciones requiere estrategia. Aquí te explicamos el sistema.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Registro y Perfil', desc: 'Crea tu cuenta y personaliza tu avatar. Tu perfil es tu carnet oficial de competencia.', icon: UserPlus },
              { step: '02', title: 'Únete a Ligas', desc: 'Participa en la Liga Global o crea ligas privadas para tus amigos y colegas de trabajo.', icon: Globe },
              { step: '03', title: 'Tus Predicciones', desc: 'Ingresa tus marcadores. Tienes hasta 15 minutos antes del pitazo inicial para cambiar de opinión.', icon: Target },
              { step: '04', title: 'Suma Puntos', desc: '5 pts por marcador exacto, 2 pts por acertar ganador, y 1 pto si aciertas los goles de un equipo.', icon: Award },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-6 items-start p-8 rounded-[2.5rem] bg-white border border-slate-100 hover:shadow-xl transition-all group">
                <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-lime-400 group-hover:text-black transition-colors">
                  <item.icon size={28} />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-black text-lime-600 uppercase tracking-[0.3em]">{item.step}</span>
                  <h3 className="text-xl font-black font-brand uppercase leading-tight">{item.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prizes Section */}
      <section id="prizes" className="py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <Badge color="bg-purple-100 text-purple-700">Recompensas Reales</Badge>
            <h3 className="text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter">GRANDES <span className="text-purple-600">PREMIOS 2026.</span></h3>
            <p className="text-slate-500 text-xl font-medium">No solo juegas por honor. Juegas por experiencias que durarán toda la vida.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-800 rounded-[3rem] p-12 text-white space-y-6 relative overflow-hidden shadow-2xl flex flex-col justify-center">
              <Trophy size={400} className="absolute -bottom-20 -right-20 opacity-10" />
              <div className="relative z-10 space-y-4">
                <Badge color="bg-white/20 text-white backdrop-blur-md">Primer Puesto Global</Badge>
                <h2 className="text-5xl lg:text-7xl font-black font-brand uppercase leading-[0.9] tracking-tighter">VIAJE A LA <br/>GRAN FINAL</h2>
                <p className="text-purple-100 text-lg max-w-md">Incluye tiquetes, hospedaje de lujo y entradas VIP para la final en el MetLife Stadium.</p>
                <div className="pt-8">
                  <Button variant="secondary" className="bg-white text-purple-600 hover:bg-slate-50 font-black px-12 py-4 rounded-full">DETALLES DEL VIAJE</Button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-8">
              {[
                { title: 'iPhone 15 Pro Max', desc: 'Sorteo quincenal entre los mejores de cada fase.', icon: Smartphone, color: 'bg-slate-900 text-white' },
                { title: '$5,000 USD en Efectivo', desc: 'Premio para el ganador de la fase de grupos.', icon: Sparkles, color: 'bg-lime-400 text-black' },
                { title: 'Consola PS5 Pro', desc: 'Para el ganador de la Gran Final de Ligas Pro.', icon: Zap, color: 'bg-cyan-500 text-white' },
              ].map((p, i) => (
                <div key={i} className={`p-10 rounded-[2.5rem] flex items-center justify-between ${p.color} shadow-lg flex-1`}>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black font-brand uppercase tracking-tight">{p.title}</h3>
                    <p className="opacity-70 text-sm font-medium">{p.desc}</p>
                  </div>
                  <p.icon size={48} className="opacity-30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section id="community" className="py-32 bg-black text-white px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
             <div className="space-y-6 text-center lg:text-left">
                <Badge color="bg-emerald-100 text-emerald-700">Comunidad Global</Badge>
                <h3 className="text-5xl lg:text-8xl font-black font-brand uppercase tracking-tighter leading-[0.85]">ÚNETE A LA <br/><span className="text-emerald-500">CONVERSACIÓN.</span></h3>
                <p className="text-slate-400 text-xl font-medium max-w-lg leading-relaxed">Más de 150,000 fanáticos ya están prediciendo. No te quedes fuera de la red social de fútbol más grande del 2026.</p>
             </div>
             <div className="flex flex-col items-center gap-6">
                <div className="flex -space-x-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <img key={i} src={`https://picsum.photos/seed/user${i}/100/100`} className="w-20 h-20 rounded-full border-4 border-black ring-2 ring-lime-400 shadow-2xl" alt="user" />
                  ))}
                  <div className="w-20 h-20 rounded-full bg-lime-400 border-4 border-black flex items-center justify-center text-black font-black text-lg">+15K</div>
                </div>
                <Button variant="secondary" size="lg" className="rounded-full px-12" onClick={() => onViewChange('register')}>UNIRME AHORA</Button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
             {[
               { icon: MessageSquare, title: 'Chat en Vivo', desc: 'Habla con tu liga en cada gol.' },
               { icon: Search, title: 'Estadísticas', desc: 'Analiza datos históricos de cada selección.' },
               { icon: TrendingUp, title: 'Tendencias', desc: 'Mira qué opina la mayoría de los expertos.' },
               { icon: ShieldCheck, title: 'Fair Play', desc: 'Comunidad libre de bots y juego justo certificado.' },
             ].map((feat, i) => (
               <Card key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                  <div className="w-12 h-12 bg-emerald-500 text-black rounded-xl flex items-center justify-center mb-6"><feat.icon /></div>
                  <h4 className="text-xl font-black font-brand uppercase mb-2 tracking-tight">{feat.title}</h4>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">{feat.desc}</p>
               </Card>
             ))}
          </div>

          <div className="bg-white/5 rounded-[3rem] p-12 border border-white/10 mt-20">
             <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="space-y-4 max-w-md text-center md:text-left">
                  <h3 className="text-3xl lg:text-4xl font-black font-brand uppercase tracking-tighter">LLEVA EL MUNDIAL <br/> EN TU BOLSILLO.</h3>
                  <p className="text-slate-400 text-lg">Predice desde cualquier lugar con nuestra aplicación optimizada.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                   <button className="bg-white text-black px-10 py-5 rounded-3xl flex items-center gap-4 hover:scale-105 transition-all shadow-xl group">
                      <Smartphone size={32} className="group-hover:rotate-12 transition-transform" />
                      <div className="text-left">
                         <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Download on the</p>
                         <p className="text-xl font-black font-brand tracking-tighter">App Store</p>
                      </div>
                   </button>
                   <button className="bg-white text-black px-10 py-5 rounded-3xl flex items-center gap-4 hover:scale-105 transition-all shadow-xl group">
                      <Play size={32} className="group-hover:rotate-12 transition-transform" />
                      <div className="text-left">
                         <p className="text-[10px] uppercase font-black tracking-widest opacity-60">Get it on</p>
                         <p className="text-xl font-black font-brand tracking-tighter">Google Play</p>
                      </div>
                   </button>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge color="bg-lime-100 text-lime-600">Monetización & Ligas</Badge>
            <h3 className="text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">PLANES DE <span className="text-slate-400">COMPETICIÓN.</span></h3>
            <p className="text-slate-500 text-xl font-medium">Monetiza tu comunidad o juega con amigos. Tenemos el plan perfecto para cada tipo de polla.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Plan Gratuito */}
            <Card className="p-10 flex flex-col justify-between border-2 border-transparent hover:border-slate-100 transition-all bg-white shadow-sm">
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Badge color="bg-slate-100 text-slate-500">Amigos</Badge>
                    <Rocket className="text-slate-300" />
                  </div>
                  <h4 className="text-4xl font-black font-brand tracking-tighter uppercase">GRATIS</h4>
                  <p className="text-slate-500 text-sm font-medium">Perfecto para pequeños parches que buscan diversión básica y casual.</p>
                  <ul className="space-y-4 py-6">
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Hasta 10 jugadores</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Marcadores Básicos</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 opacity-30 tracking-wide"><ZapOff size={16} /> Sin soporte IA</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 opacity-30 tracking-wide"><ZapOff size={16} /> Con Publicidad</li>
                  </ul>
               </div>
               <Button variant="outline" className="mt-8 w-full rounded-2xl h-14 font-black tracking-widest" onClick={() => onViewChange('register')}>EMPEZAR GRATIS</Button>
            </Card>

            {/* Plan Pro - RECOMENDADO */}
            <Card className="p-10 flex flex-col justify-between border-2 border-lime-400 shadow-2xl scale-105 relative bg-white overflow-hidden ring-4 ring-lime-400/10 z-10">
               <div className="absolute top-0 right-0 bg-lime-400 text-black px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-bl-2xl shadow-lg">Más Vendido</div>
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Badge color="bg-lime-100 text-lime-700">Ligas Pro</Badge>
                    <Crown className="text-lime-500" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black font-brand tracking-tighter uppercase">$29</span>
                    <span className="text-slate-400 text-sm font-black uppercase tracking-widest">/ Liga</span>
                  </div>
                  <p className="text-slate-600 text-sm font-bold">Ideal para influencers, marcas locales y comunidades competitivas.</p>
                  <ul className="space-y-4 py-6">
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-900 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Jugadores Ilimitados</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-900 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Dashboard de Admin Pro</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-900 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Sin Publicidad</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-900 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Exportar a Excel/PDF</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-900 tracking-wide"><CheckCircle2 size={16} className="text-lime-500" /> Notificaciones Push</li>
                  </ul>
               </div>
               <Button variant="secondary" className="mt-8 w-full rounded-2xl h-16 font-black tracking-widest shadow-xl shadow-lime-400/40 hover:scale-[1.02]" onClick={() => onViewChange('checkout')}>ADQUIRIR LIGA PRO</Button>
            </Card>

            {/* Plan Corporativo */}
            <Card className="p-10 flex flex-col justify-between border-2 border-transparent hover:border-slate-100 transition-all bg-white shadow-sm">
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <Badge color="bg-black text-white">Enterprise</Badge>
                    <Building2 className="text-slate-400" />
                  </div>
                  <h4 className="text-4xl font-black font-brand tracking-tighter uppercase">CUSTOM</h4>
                  <p className="text-slate-500 text-sm font-medium">Fidelización masiva para empleados y clientes corporativos.</p>
                  <ul className="space-y-4 py-6">
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-black" /> Branding Personalizado</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-black" /> Soporte Dedicado 24/7</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-black" /> Integración Slack/Teams</li>
                    <li className="flex items-center gap-3 text-xs font-black uppercase text-slate-600 tracking-wide"><CheckCircle2 size={16} className="text-black" /> Seguridad SSO / SAML</li>
                  </ul>
               </div>
               <Button variant="outline" className="mt-8 w-full rounded-2xl h-14 font-black bg-black text-white hover:bg-slate-900 border-none tracking-widest" onClick={() => onViewChange('register')}>CONTACTAR VENTAS</Button>
            </Card>
          </div>
          
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-lime-50 text-lime-600 rounded-2xl flex items-center justify-center shrink-0">
                   <Zap size={32} />
                </div>
                <div>
                   <h4 className="text-xl font-black font-brand uppercase tracking-tighter">¿TIENES UNA COMUNIDAD GRANDE?</h4>
                   <p className="text-slate-500 font-medium">Únete a nuestro programa de afiliados y gana por cada liga referida.</p>
                </div>
             </div>
             <Button variant="ghost" className="font-black uppercase tracking-widest text-lime-600 hover:text-lime-700 underline decoration-2 underline-offset-4">Saber Más</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center font-brand text-white text-3xl font-black shadow-lg">26</div>
                <span className="font-brand text-2xl font-black tracking-tighter uppercase leading-none">POLLA<span className="text-lime-500">2026</span></span>
              </div>
              <p className="text-slate-500 text-lg leading-relaxed font-medium">
                La plataforma definitiva de predicciones para el Mundial 2026. Unificando la pasión con diseño de clase mundial.
              </p>
              <div className="flex gap-4">
                 {[Globe, smartphoneIcon, MessageSquare].map((Icon, i) => (
                   <button key={i} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-black hover:text-white transition-all">
                     <Icon size={20} />
                   </button>
                 ))}
              </div>
            </div>

            <div>
              <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 mb-8">Navegación</h5>
              <ul className="space-y-6">
                {['how-it-works', 'prizes', 'community', 'pricing'].map((id) => (
                  <li key={id}>
                    <button 
                      onClick={() => scrollTo(id)} 
                      className="text-slate-900 font-black uppercase text-sm tracking-widest hover:text-lime-600 transition-colors"
                    >
                      {id.replace(/-/g, ' ')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h5 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 mb-8">Plataforma</h5>
              <ul className="space-y-6">
                <li><button onClick={() => onViewChange('login')} className="text-slate-900 font-black uppercase text-sm tracking-widest hover:text-lime-600 transition-colors">Iniciar Sesión</button></li>
                <li><button onClick={() => onViewChange('register')} className="text-slate-900 font-black uppercase text-sm tracking-widest hover:text-lime-600 transition-colors">Crear Cuenta</button></li>
                <li><button className="text-slate-900 font-black uppercase text-sm tracking-widest hover:text-lime-600 transition-colors">Privacidad</button></li>
                <li><button className="text-slate-900 font-black uppercase text-sm tracking-widest hover:text-lime-600 transition-colors">Términos</button></li>
              </ul>
            </div>

            <Card className="bg-slate-900 text-white p-8 space-y-6 border-0 shadow-2xl">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-lime-400" />
                <h5 className="font-black text-xs uppercase tracking-[0.3em]">Soporte Oficial</h5>
              </div>
              <p className="text-slate-400 text-sm font-medium">¿Necesitas ayuda con tu liga corporativa?</p>
              <p className="text-xl font-black font-brand uppercase tracking-tighter">soporte@polla2026.co</p>
              <Button variant="secondary" className="w-full rounded-xl py-3 text-[10px] font-black uppercase tracking-widest">Enviar Ticket</Button>
            </Card>
          </div>

          <div className="pt-16 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">© 2026 POLLA MUNDIALISTA. UNA MARCA DE AGILDESARROLLO.</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-lime-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Certified</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-slate-300" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Access</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Internal icon wrapper since Smartphone is imported differently above
const smartphoneIcon = Smartphone;

export default Landing;

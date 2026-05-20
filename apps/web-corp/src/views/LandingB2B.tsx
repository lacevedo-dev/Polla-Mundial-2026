import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy, Building2, Users, Palette, BarChart3, Shield, Globe,
    ArrowRight, CheckCircle2, Sparkles, ChevronDown, ChevronUp,
    Mail, Phone, MessageSquare, Instagram, Facebook, Lock,
    LogIn, Menu, X, PlayCircle, Star, ShieldCheck, TrendingUp,
} from 'lucide-react';

/* ─── Data ────────────────────────────────────────────────── */
const NAV_LINKS = [
    { id: 'features', label: 'Plataforma' },
    { id: 'how-it-works', label: 'Cómo Funciona' },
    { id: 'pricing', label: 'Planes' },
    { id: 'testimonials', label: 'Clientes' },
    { id: 'faq', label: 'FAQ' },
];

const PLANS = [
    {
        tier: 'STARTER',
        name: 'STARTER',
        price: '250k',
        priceFull: '$250.000',
        period: '/ MES',
        accent: 'slate',
        badge: '',
        features: [
            'Hasta 50 usuarios',
            'Hasta 3 pollas simultáneas',
            'Branding básico (colores y logo)',
            'Subdominio empresa.zonapronosticos.com',
            'Panel de administración',
            'Soporte por email',
        ],
        cta: 'EMPEZAR PRUEBA',
    },
    {
        tier: 'BUSINESS',
        name: 'BUSINESS',
        price: '600k',
        priceFull: '$600.000',
        period: '/ MES',
        accent: 'lime',
        badge: 'POPULAR',
        features: [
            'Hasta 300 usuarios',
            'Hasta 10 pollas simultáneas',
            'Branding completo (colores, fuentes, CSS)',
            'Dominio propio (polla.tuempresa.com)',
            'Carga masiva de invitaciones (CSV)',
            'Reportes y estadísticas en tiempo real',
            'Soporte prioritario',
            'Análisis IA de pronósticos',
        ],
        cta: 'SOLICITAR DEMO',
    },
    {
        tier: 'ENTERPRISE',
        name: 'ENTERPRISE',
        price: 'Custom',
        priceFull: 'A medida',
        period: '',
        accent: 'amber',
        badge: '',
        features: [
            'Usuarios ilimitados',
            'Pollas ilimitadas',
            'SSO (Google Workspace / Azure AD)',
            'Dominio propio con SSL incluido',
            'SLA garantizado 99.9%',
            'Gerente de cuenta dedicado',
            'Integración con HRMS / Slack',
            'Facturación corporativa',
        ],
        cta: 'CONTACTAR VENTAS',
    },
];

const FEATURES = [
    { icon: Palette, title: 'Identidad de tu marca', desc: 'Tus colores, tu logo, tu fuente. Los empleados ven la plataforma como si fuera tuya.', color: 'lime' },
    { icon: Users, title: 'Gestión de equipos', desc: 'Invita a toda la empresa con un clic. Roles de admin, jugador y owner por organización.', color: 'amber' },
    { icon: Trophy, title: 'Pollas corporativas', desc: 'Crea pollas privadas por departamento, ciudad o empresa completa.', color: 'purple' },
    { icon: BarChart3, title: 'Reportes en tiempo real', desc: 'Quién participa, cuántos puntos tienen y cómo va el ranking en vivo.', color: 'cyan' },
    { icon: Shield, title: 'Datos aislados', desc: 'Cada organización con datos completamente separados. Cumplimiento GDPR.', color: 'rose' },
    { icon: Globe, title: 'Subdominio propio', desc: 'empresa.zonapronosticos.com o tu propio dominio (polla.empresa.com) con SSL.', color: 'lime' },
];

const STEPS = [
    { step: '01', title: 'Crea tu organización', desc: 'Elige nombre, subdominio y plan. Sin tarjeta de crédito para empezar.', icon: Building2 },
    { step: '02', title: 'Personaliza el branding', desc: 'Sube tu logo y configura tus colores. Tu equipo verá tu marca, no la nuestra.', icon: Palette },
    { step: '03', title: 'Invita a tu equipo', desc: 'Carga un CSV con emails o invita uno a uno. Reciben un enlace directo.', icon: Users },
    { step: '04', title: 'Activa el engagement', desc: 'Mide participación, premia a los mejores y conecta a toda tu organización.', icon: TrendingUp },
];

const TESTIMONIALS = [
    { quote: 'Fue la actividad de integración más exitosa del año. 280 empleados conectados durante todo el Mundial.', name: 'Andrea Morales', role: 'Directora de Cultura', company: 'Bavaria S.A.', avatar: 'A', color: 'bg-amber-400' },
    { quote: 'Lo usamos para fidelizar a nuestros clientes B2B. La personalización con nuestro branding fue clave.', name: 'Carlos Gutiérrez', role: 'Gerente Comercial', company: 'Grupo Éxito', avatar: 'C', color: 'bg-emerald-500' },
    { quote: 'Montamos la polla en 10 minutos. El equipo de soporte respondió en menos de una hora.', name: 'María Ríos', role: 'Líder RRHH', company: 'Bancolombia', avatar: 'M', color: 'bg-blue-500' },
];

const COMPANIES = ['Bavaria', 'Grupo Éxito', 'Bancolombia', 'Coopcanapro', 'AgilDesarrollo', 'Postobón'];

const FAQS = [
    { q: '¿Cuánto tiempo toma configurar la plataforma?', a: 'Menos de 15 minutos. Creas el tenant, personalizas el branding e invitas a tu equipo. Nada de instalaciones ni código.' },
    { q: '¿Los datos de mi empresa están separados de otros clientes?', a: 'Sí. Cada organización tiene aislamiento lógico completo. Ningún usuario puede ver datos de otra empresa.' },
    { q: '¿Puedo usar mi propio dominio?', a: 'En los planes Business y Enterprise puedes apuntar tu propio subdominio (polla.tuempresa.com) con SSL incluido.' },
    { q: '¿Qué pasa si termina el Mundial?', a: 'Puedes mantener el plan para otros torneos (Copa América, Libertadores, Champions) o cancelar sin penalización.' },
    { q: '¿Pueden participar empleados de otras ciudades o países?', a: 'Totalmente. La plataforma es 100% online y funciona desde cualquier dispositivo y ubicación.' },
    { q: '¿Necesito que mi equipo de IT instale algo?', a: 'No. Es 100% SaaS. Lo único que necesitas es enviar un correo a tus empleados con el enlace.' },
];

const FEATURE_COLORS: Record<string, { bg: string; text: string; chip: string }> = {
    lime: { bg: 'bg-lime-50 group-hover:bg-lime-100', text: 'text-lime-600', chip: 'bg-lime-100 text-lime-800' },
    amber: { bg: 'bg-amber-50 group-hover:bg-amber-100', text: 'text-amber-600', chip: 'bg-amber-100 text-amber-800' },
    purple: { bg: 'bg-purple-50 group-hover:bg-purple-100', text: 'text-purple-600', chip: 'bg-purple-100 text-purple-800' },
    cyan: { bg: 'bg-cyan-50 group-hover:bg-cyan-100', text: 'text-cyan-600', chip: 'bg-cyan-100 text-cyan-800' },
    rose: { bg: 'bg-rose-50 group-hover:bg-rose-100', text: 'text-rose-600', chip: 'bg-rose-100 text-rose-800' },
};

/* ─── Component ──────────────────────────────────────────── */
export default function LandingB2B() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('hero');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [contactForm, setContactForm] = useState({ name: '', company: '', email: '', employees: '', message: '' });
    const [contactSent, setContactSent] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    /* — IntersectionObserver para nav activa — */
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);

        observerRef.current = new IntersectionObserver(
            entries => entries.forEach(e => e.isIntersecting && setActiveSection(e.target.id)),
            { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
        );
        ['hero', ...NAV_LINKS.map(l => l.id), 'contact'].forEach(id => {
            const el = document.getElementById(id);
            if (el) observerRef.current?.observe(el);
        });
        return () => {
            observerRef.current?.disconnect();
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const offsetPos = el.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: offsetPos, behavior: 'smooth' });
        setIsMobileNavOpen(false);
    };

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const handleContact = (e: React.FormEvent) => {
        e.preventDefault();
        setContactSent(true);
    };

    /* — Render — */
    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col relative">

            {/* ═══ NAV ═══════════════════════════════════════════ */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <button onClick={scrollToTop} className="flex items-center gap-2 cursor-pointer">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center font-brand text-amber-400 text-2xl font-black shadow-lg">Z</div>
                        <span className="font-brand text-xl font-black tracking-tighter uppercase">ZONA<span className="text-amber-500">PRONÓSTICOS</span></span>
                    </button>

                    <div className="hidden lg:flex items-center gap-8">
                        {NAV_LINKS.map(link => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className={`text-xs font-black uppercase tracking-widest transition-all relative py-1 ${
                                    activeSection === link.id ? 'text-amber-700' : 'text-slate-500 hover:text-black'
                                }`}
                            >
                                {link.label}
                                {activeSection === link.id && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <button onClick={() => navigate('/login')} className="hidden sm:block text-xs font-black uppercase tracking-widest text-slate-900 hover:text-amber-700 transition-colors">
                            Entrar
                        </button>
                        <button
                            onClick={() => scrollTo('contact')}
                            className="hidden sm:flex h-10 px-4 sm:px-6 rounded-full font-black text-xs sm:text-sm bg-amber-400 text-slate-900 hover:bg-amber-500 transition-all shadow-lg shadow-amber-400/20 items-center"
                        >
                            SOLICITAR DEMO
                        </button>
                        <button
                            onClick={() => setIsMobileNavOpen(true)}
                            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            aria-label="Abrir menú"
                        >
                            <Menu size={20} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ═══ MOBILE NAV ════════════════════════════════════ */}
            {isMobileNavOpen && (
                <div className="fixed inset-0 bg-slate-950 z-[80] flex flex-col lg:hidden" role="dialog" aria-modal="true">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center font-brand text-black text-xl font-black">Z</div>
                            <span className="font-brand text-sm text-white uppercase font-black tracking-tighter">ZONA<span className="text-amber-400">PRONÓSTICOS</span></span>
                        </div>
                        <button
                            onClick={() => setIsMobileNavOpen(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            aria-label="Cerrar menú"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="px-4 pt-5 pb-4 border-b border-slate-800 shrink-0 space-y-3">
                        <button
                            onClick={() => { scrollTo('contact'); }}
                            className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-sm bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20"
                        >
                            SOLICITAR DEMO
                        </button>
                        <button
                            onClick={() => { navigate('/login'); setIsMobileNavOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700"
                        >
                            <LogIn size={16} /> Entrar al portal
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                        {NAV_LINKS.map(link => (
                            <button
                                key={link.id}
                                onClick={() => scrollTo(link.id)}
                                className="w-full flex items-center px-4 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>
                </div>
            )}

            {/* ═══ MAIN ══════════════════════════════════════════ */}
            <main className="flex-1">

                {/* ─── HERO ──────────────────────────────────────── */}
                <section id="hero" className="relative px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        {/* Texto */}
                        <div className="relative z-10 space-y-6 sm:space-y-8">
                            <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 px-3 sm:px-4 py-1.5 sm:py-2 uppercase tracking-widest text-[10px] sm:text-xs font-black rounded-full">
                                <Sparkles size={12} /> Mundial 2026 · Polla corporativa
                            </span>
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-brand leading-[0.95] sm:leading-[0.9] tracking-tighter uppercase text-slate-900">
                                LA POLLA DEL MUNDIAL <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">CON TU MARCA.</span>
                            </h1>
                            <p className="text-slate-500 text-base sm:text-xl max-w-xl leading-relaxed font-medium">
                                Activa el engagement de tus empleados y clientes con una plataforma de pronósticos
                                completamente personalizada. Sin código. Lista en 15 minutos.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <button
                                    onClick={() => scrollTo('contact')}
                                    className="group h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base rounded-full bg-amber-400 text-slate-900 hover:bg-amber-500 transition-all shadow-2xl shadow-amber-500/20 font-black uppercase tracking-widest inline-flex items-center justify-center gap-2"
                                >
                                    SOLICITAR DEMO <ArrowRight className="ml-1 group-hover:translate-x-1 transition-transform" size={18} />
                                </button>
                                <button
                                    onClick={() => scrollTo('how-it-works')}
                                    className="h-14 sm:h-16 px-6 sm:px-10 text-sm sm:text-base rounded-full border-2 border-slate-200 text-slate-600 hover:text-amber-700 hover:border-amber-300 font-black uppercase tracking-widest gap-2 transition-all inline-flex items-center justify-center"
                                >
                                    <PlayCircle size={18} className="text-amber-500" /> CÓMO FUNCIONA
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-sm text-slate-500 font-medium">
                                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-lime-500" /> Sin tarjeta</span>
                                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-lime-500" /> 14 días gratis</span>
                                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-lime-500" /> Cancela cuando quieras</span>
                            </div>
                        </div>

                        {/* Mock visual */}
                        <div className="relative">
                            <div className="relative bg-slate-900 rounded-[2rem] sm:rounded-[3rem] p-3 sm:p-4 shadow-3xl border border-white/10 rotate-2 hover:rotate-0 transition-transform duration-700 overflow-hidden">
                                {/* Faux portal preview */}
                                <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-gradient-to-br from-slate-800 via-slate-900 to-black p-6 sm:p-8 aspect-[4/3] flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center font-brand font-black text-slate-900">B</div>
                                            <div>
                                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none">PORTAL</p>
                                                <p className="text-sm font-black text-white">Bavaria S.A.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-400/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-[9px] font-black text-emerald-300 uppercase">EN VIVO</span>
                                        </div>
                                    </div>
                                    <div className="relative space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ranking general</p>
                                        {[
                                            { pos: 1, name: 'María R.', pts: 248, c: 'bg-amber-400' },
                                            { pos: 2, name: 'Carlos M.', pts: 235, c: 'bg-slate-300' },
                                            { pos: 3, name: 'Laura T.', pts: 221, c: 'bg-amber-700' },
                                        ].map(p => (
                                            <div key={p.pos} className="flex items-center gap-3 bg-white/5 backdrop-blur border border-white/10 rounded-xl px-3 py-2">
                                                <div className={`w-7 h-7 rounded-lg ${p.c} flex items-center justify-center font-black text-slate-900 text-xs`}>{p.pos}</div>
                                                <p className="flex-1 text-sm font-bold text-white">{p.name}</p>
                                                <p className="text-sm font-black text-amber-400">{p.pts}<span className="text-[10px] text-slate-400 ml-1">PTS</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Floating stat card */}
                            <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex items-center gap-3 sm:gap-4 max-w-[230px]">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-lime-400 rounded-xl sm:rounded-2xl flex items-center justify-center text-black shadow-lg shrink-0">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Engagement</p>
                                    <p className="text-sm sm:text-lg font-black uppercase">+92% activos</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── LOGOS BAR ─────────────────────────────────── */}
                <section className="border-y border-slate-100 py-10 sm:py-12 px-4 sm:px-6 bg-slate-50">
                    <div className="max-w-7xl mx-auto">
                        <p className="text-center text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6">
                            EMPRESAS QUE YA CONFÍAN EN NOSOTROS
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
                            {COMPANIES.map(c => (
                                <span key={c} className="font-brand text-lg sm:text-2xl font-black tracking-tighter uppercase text-slate-300 hover:text-slate-900 transition-colors cursor-default">
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── STATS ─────────────────────────────────────── */}
                <section className="bg-amber-400 px-4 sm:px-6 py-10 sm:py-14">
                    <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
                        {[
                            { value: '+500', label: 'Empresas activas' },
                            { value: '+80K', label: 'Empleados jugando' },
                            { value: '15 min', label: 'Tiempo de activación' },
                            { value: '99.9%', label: 'Uptime garantizado' },
                        ].map(s => (
                            <div key={s.label} className="text-center">
                                <p className="font-brand text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-slate-900">{s.value}</p>
                                <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-700 mt-1">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── FEATURES ──────────────────────────────────── */}
                <section id="features" className="py-16 lg:py-32 px-4 sm:px-6">
                    <div className="max-w-7xl mx-auto space-y-12 lg:space-y-20">
                        <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
                            <span className="inline-block bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">PLATAFORMA</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">
                                TODO LO QUE NECESITAS, <br /><span className="text-amber-500">NADA DE LO QUE NO.</span>
                            </h2>
                            <p className="text-slate-500 text-base sm:text-xl font-medium leading-relaxed">
                                Una plataforma completa para que RRHH y marketing activen el engagement sin depender de IT.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {FEATURES.map(({ icon: Icon, title, desc, color }) => {
                                const c = FEATURE_COLORS[color];
                                return (
                                    <div key={title} className="group p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${c.bg} flex items-center justify-center mb-4 sm:mb-5 transition-colors`}>
                                            <Icon size={24} className={c.text} />
                                        </div>
                                        <h3 className="text-base sm:text-xl font-black font-brand uppercase tracking-tight mb-2">{title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed font-medium">{desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ─── HOW IT WORKS ──────────────────────────────── */}
                <section id="how-it-works" className="py-16 lg:py-32 px-4 sm:px-6 bg-slate-50 border-y border-slate-100">
                    <div className="max-w-7xl mx-auto space-y-12 lg:space-y-20">
                        <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
                            <span className="inline-block bg-lime-100 text-lime-800 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">CÓMO FUNCIONA</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">
                                DE CERO A ACTIVO <br /><span className="text-lime-600">EN 4 PASOS.</span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                            {STEPS.map(({ step, title, desc, icon: Icon }) => (
                                <div key={step} className="group p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-slate-100 hover:shadow-xl transition-all relative overflow-hidden">
                                    <div className="absolute -top-2 -right-2 text-[80px] sm:text-[100px] font-black font-brand text-slate-100 leading-none select-none pointer-events-none">{step}</div>
                                    <div className="relative space-y-4 sm:space-y-5">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black text-amber-400 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:bg-amber-400 group-hover:text-black transition-colors">
                                            <Icon size={24} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.3em]">PASO {step}</span>
                                            <h3 className="text-base sm:text-xl font-black font-brand uppercase tracking-tight mt-1">{title}</h3>
                                            <p className="text-sm text-slate-500 leading-relaxed font-medium mt-2">{desc}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── PRICING ───────────────────────────────────── */}
                <section id="pricing" className="py-16 lg:py-32 px-4 sm:px-6">
                    <div className="max-w-7xl mx-auto space-y-10 sm:space-y-16">
                        <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
                            <span className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">PLANES 2026</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">
                                ELIGE EL PLAN <br /><span className="text-amber-500">DE TU EMPRESA.</span>
                            </h2>
                            <p className="text-slate-500 text-base sm:text-xl font-medium">Sin letra pequeña. Sin costos ocultos por usuario.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:items-center">
                            {PLANS.map(plan => {
                                const isPopular = plan.badge === 'POPULAR';
                                return (
                                    <div
                                        key={plan.tier}
                                        className={`relative p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] space-y-5 sm:space-y-6 transition-all ${
                                            isPopular
                                                ? 'bg-slate-900 text-white shadow-2xl md:scale-105 lg:p-10 lg:rounded-[3rem]'
                                                : 'bg-white border border-slate-200 hover:shadow-xl'
                                        }`}
                                    >
                                        {plan.badge && (
                                            <div className="absolute top-0 right-0 px-3 sm:px-4 py-2 sm:py-3 bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-bl-2xl rounded-tr-[2rem] sm:rounded-tr-[2.5rem] lg:rounded-tr-[3rem]">
                                                {plan.badge}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <h3 className={`font-brand font-black uppercase ${isPopular ? 'text-2xl text-amber-400' : 'text-2xl text-slate-900'}`}>{plan.name}</h3>
                                            <p className={`font-brand font-black ${isPopular ? 'text-4xl sm:text-5xl text-white' : 'text-3xl sm:text-4xl text-slate-900'}`}>
                                                {plan.price === 'Custom' ? 'A medida' : <>${plan.price}</>}
                                                {plan.period && <span className={`text-sm font-bold ml-1 ${isPopular ? 'text-slate-500' : 'text-slate-400'}`}>{plan.period}</span>}
                                            </p>
                                            {isPopular && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Hasta 300 empleados</p>}
                                        </div>
                                        <ul className="space-y-3 sm:space-y-4">
                                            {plan.features.map(f => (
                                                <li key={f} className={`flex items-start gap-3 text-sm font-medium ${isPopular ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    <CheckCircle2 size={18} className={`shrink-0 mt-0.5 ${isPopular ? 'text-amber-400' : 'text-lime-500'}`} />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            onClick={() => scrollTo('contact')}
                                            className={`w-full h-12 sm:h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                                                isPopular
                                                    ? 'bg-amber-400 text-slate-900 hover:bg-amber-500 shadow-lg shadow-amber-500/20'
                                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                            }`}
                                        >
                                            {plan.cta}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ─── TESTIMONIALS ──────────────────────────────── */}
                <section id="testimonials" className="py-16 lg:py-32 bg-black text-white px-4 sm:px-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #f59e0b 0%, transparent 50%)' }} />
                    <div className="max-w-7xl mx-auto relative z-10 space-y-12 lg:space-y-20">
                        <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 sm:gap-8 border-b border-white/10 pb-10 sm:pb-12">
                            <div className="space-y-4">
                                <span className="inline-block bg-amber-400 text-black px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">CLIENTES</span>
                                <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black font-brand uppercase tracking-tighter leading-none">
                                    EMPRESAS QUE <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">YA JUEGAN.</span>
                                </h2>
                            </div>
                            <p className="text-slate-400 text-base sm:text-xl font-medium max-w-md md:text-right">
                                Más de 500 empresas activan el engagement de sus equipos con nuestra plataforma.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                            {TESTIMONIALS.map(t => (
                                <div key={t.name} className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] hover:bg-white/10 transition-colors">
                                    <div className="flex gap-1 mb-4">
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
                                    </div>
                                    <p className="text-base sm:text-lg font-medium text-slate-200 leading-relaxed mb-6">"{t.quote}"</p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center font-black text-slate-900 shrink-0`}>{t.avatar}</div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{t.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{t.role} · {t.company}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── FAQ ───────────────────────────────────────── */}
                <section id="faq" className="py-16 lg:py-32 px-4 sm:px-6">
                    <div className="max-w-3xl mx-auto space-y-10 sm:space-y-16">
                        <div className="text-center space-y-4 sm:space-y-6">
                            <span className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">FAQ</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">
                                PREGUNTAS <br /><span className="text-amber-500">FRECUENTES.</span>
                            </h2>
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                            {FAQS.map((f, i) => (
                                <div key={i} className="border border-slate-100 rounded-2xl sm:rounded-3xl overflow-hidden bg-white hover:border-slate-200 transition-colors">
                                    <button
                                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-slate-50 transition-colors gap-4"
                                    >
                                        <span className="font-black text-slate-900 text-sm sm:text-base font-brand uppercase tracking-tight">{f.q}</span>
                                        <ChevronDown
                                            size={20}
                                            className={`text-amber-500 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {openFaq === i && (
                                        <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm sm:text-base text-slate-500 leading-relaxed font-medium border-t border-slate-100 pt-4">
                                            {f.a}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── CONTACT ───────────────────────────────────── */}
                <section id="contact" className="py-16 lg:py-32 px-4 sm:px-6 bg-slate-50 border-t border-slate-100">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
                        <div className="space-y-6 sm:space-y-8">
                            <span className="inline-block bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">CONTACTO</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black font-brand uppercase tracking-tighter leading-none">
                                ACTIVA EL MUNDIAL <br /><span className="text-amber-500">EN TU EMPRESA.</span>
                            </h2>
                            <p className="text-slate-500 text-base sm:text-xl font-medium leading-relaxed">
                                Cuéntanos sobre tu empresa y te hacemos una demo personalizada. Sin compromiso.
                            </p>
                            <div className="space-y-4 pt-2">
                                <a href="mailto:b2b@zonapronosticos.com" className="flex items-center gap-4 group">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-amber-300 group-hover:bg-amber-50 transition-colors">
                                        <Mail size={18} className="text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EMAIL</p>
                                        <p className="font-bold text-slate-900">b2b@zonapronosticos.com</p>
                                    </div>
                                </a>
                                <a href="https://wa.me/573100000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-lime-300 group-hover:bg-lime-50 transition-colors">
                                        <Phone size={18} className="text-lime-500" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WHATSAPP</p>
                                        <p className="font-bold text-slate-900">+57 310 000 0000</p>
                                    </div>
                                </a>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-xl border border-slate-100">
                            {contactSent ? (
                                <div className="text-center py-10 space-y-4">
                                    <div className="w-16 h-16 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto">
                                        <CheckCircle2 size={32} className="text-lime-500" />
                                    </div>
                                    <h3 className="font-black font-brand uppercase text-xl tracking-tight">¡MENSAJE RECIBIDO!</h3>
                                    <p className="text-slate-500 font-medium">Te contactamos en menos de 24 horas para agendar la demo.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleContact} className="space-y-4">
                                    <h3 className="font-black font-brand uppercase text-xl tracking-tight mb-2">SOLICITAR DEMO GRATUITA</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <Field label="TU NOMBRE" required value={contactForm.name} onChange={v => setContactForm(f => ({ ...f, name: v }))} placeholder="Andrea Morales" />
                                        <Field label="EMPRESA" required value={contactForm.company} onChange={v => setContactForm(f => ({ ...f, company: v }))} placeholder="Bavaria S.A." />
                                    </div>
                                    <Field label="EMAIL CORPORATIVO" required type="email" value={contactForm.email} onChange={v => setContactForm(f => ({ ...f, email: v }))} placeholder="andrea@bavaria.com" />

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">EMPLEADOS</label>
                                        <select
                                            value={contactForm.employees}
                                            onChange={e => setContactForm(f => ({ ...f, employees: e.target.value }))}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-medium bg-white"
                                        >
                                            <option value="">Selecciona un rango</option>
                                            <option>1 - 50</option>
                                            <option>51 - 150</option>
                                            <option>151 - 500</option>
                                            <option>500 - 2000</option>
                                            <option>Más de 2000</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">MENSAJE (OPCIONAL)</label>
                                        <textarea
                                            rows={3}
                                            value={contactForm.message}
                                            onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                                            placeholder="Cuéntanos sobre tu empresa…"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none font-medium"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full h-14 rounded-2xl bg-amber-400 text-slate-900 font-black uppercase tracking-widest text-sm hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20 inline-flex items-center justify-center gap-2"
                                    >
                                        SOLICITAR DEMO <ArrowRight size={16} />
                                    </button>
                                    <p className="text-[10px] text-slate-400 text-center font-medium">Sin spam · Sin compromiso · Respondemos en &lt;24h</p>
                                </form>
                            )}
                        </div>
                    </div>
                </section>
            </main>

            {/* ═══ FOOTER ════════════════════════════════════════ */}
            <footer className="relative flex flex-col bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-12 lg:pt-24 lg:pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-12">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center font-brand text-amber-400 text-3xl font-black shadow-lg">Z</div>
                            <span className="font-brand text-2xl font-black tracking-tighter uppercase leading-none">ZONA<span className="text-amber-500">PRONÓSTICOS</span></span>
                        </div>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed font-medium max-w-sm">
                            La plataforma B2B de pronósticos del Mundial 2026 para empresas que quieren activar el engagement de sus equipos.
                        </p>
                        <div className="flex gap-3">
                            {[Instagram, Facebook, Globe, MessageSquare].map((Icon, i) => (
                                <button key={i} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-black hover:text-amber-400 transition-all">
                                    <Icon size={18} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <h5 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-5">Plataforma</h5>
                        <ul className="space-y-3">
                            {NAV_LINKS.map(l => (
                                <li key={l.id}>
                                    <button onClick={() => scrollTo(l.id)} className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-amber-700 transition-colors">{l.label}</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h5 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-5">Acceso</h5>
                        <ul className="space-y-3">
                            <li><button onClick={() => navigate('/login')} className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-amber-700 transition-colors">Portal clientes</button></li>
                            <li><button onClick={() => scrollTo('contact')} className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-amber-700 transition-colors">Solicitar demo</button></li>
                            <li><a href="https://tupollamundial.com" target="_blank" rel="noopener noreferrer" className="text-slate-800 font-bold uppercase text-xs tracking-widest hover:text-amber-700 transition-colors">Versión B2C</a></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-4">
                        <div className="bg-slate-50 border border-slate-100 p-6 sm:p-8 space-y-4 shadow-sm relative overflow-hidden group rounded-[2rem] sm:rounded-[2.5rem]">
                            <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-400/10 rounded-full group-hover:scale-110 transition-transform duration-700" />
                            <div className="relative space-y-4">
                                <div className="flex items-center gap-2">
                                    <Lock size={18} className="text-amber-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal directo</span>
                                </div>
                                <p className="text-slate-800 text-sm font-bold leading-tight uppercase">¿Necesitas activarlo para tu empresa? Hablemos hoy.</p>
                                <button
                                    onClick={() => scrollTo('contact')}
                                    className="w-full h-12 rounded-2xl bg-amber-400 text-slate-900 font-black uppercase tracking-widest text-xs hover:bg-amber-500 transition-all shadow-lg shadow-amber-500/20"
                                >
                                    AGENDAR DEMO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky bottom legal bar */}
                <div className="sticky bottom-0 z-40 w-full bg-white/95 backdrop-blur-md border-t border-slate-100 py-4 sm:py-6 px-4 sm:px-6 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.08)]">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1 text-center md:text-left">
                                © 2026 ZONAPRONOSTICOS. UNA MARCA DE <span className="text-slate-900">AGILDESARROLLO</span>.
                            </p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4">
                                {['PRIVACIDAD', 'TÉRMINOS', 'COOKIES', 'SEGURIDAD'].map(legal => (
                                    <button key={legal} className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors">{legal}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-end gap-3">
                            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                                <ShieldCheck size={18} className="text-amber-500" />
                                <div className="text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">SECURITY</p>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">CERTIFIED</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-2xl border border-slate-200/50">
                                <Globe size={18} className="text-slate-400" />
                                <div className="text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">UPTIME</p>
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">99.9% SLA</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ═══ FLOATING SCROLL TOP ═══════════════════════════ */}
            <button
                onClick={scrollToTop}
                className={`fixed bottom-6 sm:bottom-8 right-4 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 z-[60] hover:bg-slate-800 hover:-translate-y-2 active:scale-95 border-2 border-amber-400/30 ${
                    showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
                }`}
                aria-label="Volver arriba"
            >
                <ChevronUp size={24} strokeWidth={3} className="text-amber-400" />
            </button>
        </div>
    );
}

/* ─── Subcomponents ──────────────────────────────────────── */
interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: FieldProps) {
    return (
        <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">{label}</label>
            <input
                type={type}
                required={required}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 font-medium"
            />
        </div>
    );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, Trophy, Shield, Zap, Globe, CheckCircle2,
    ArrowRight, Mail, Phone, ChevronDown, Palette, BarChart3,
    Lock, Sparkles, Building, Star, Menu, X,
} from 'lucide-react';

/* ─── Data ────────────────────────────────────────────────── */
const PLANS = [
    {
        tier: 'STARTER',
        name: 'Starter',
        price: '250.000',
        period: 'COP / mes',
        description: 'Ideal para empresas pequeñas que quieren comenzar',
        color: 'border-slate-200',
        badge: '',
        features: [
            'Hasta 50 usuarios',
            'Hasta 3 pollas simultáneas',
            'Branding básico (colores y logo)',
            'Subdominio propio (empresa.zonapronosticos.com)',
            'Panel de administración',
            'Invitaciones por email',
            'Soporte por email',
        ],
        cta: 'Empezar gratis 14 días',
    },
    {
        tier: 'BUSINESS',
        name: 'Business',
        price: '600.000',
        period: 'COP / mes',
        description: 'Para empresas medianas con equipos activos',
        color: 'border-amber-400',
        badge: 'Más popular',
        features: [
            'Hasta 300 usuarios',
            'Hasta 10 pollas simultáneas',
            'Branding completo (colores, fuentes, CSS)',
            'Dominio propio (polla.tuempresa.com)',
            'Carga masiva de invitaciones (CSV)',
            'Reportes y estadísticas de participación',
            'Soporte prioritario',
            'Análisis IA de pronósticos',
        ],
        cta: 'Solicitar demo',
    },
    {
        tier: 'ENTERPRISE',
        name: 'Enterprise',
        price: 'A medida',
        period: '',
        description: 'Solución completa para grandes organizaciones',
        color: 'border-slate-200',
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
        cta: 'Contactar ventas',
    },
];

const FEATURES = [
    {
        icon: Palette,
        title: 'Identidad de tu empresa',
        desc: 'Tus colores, tu logo, tu fuente. Los empleados verán la plataforma como si fuera tuya.',
    },
    {
        icon: Users,
        title: 'Gestión de equipos',
        desc: 'Invita a toda la empresa con un clic. Roles de admin, jugador y owner por organización.',
    },
    {
        icon: Trophy,
        title: 'Pollas corporativas',
        desc: 'Crea pollas privadas por departamento, ciudad o empresa completa. Control total de acceso.',
    },
    {
        icon: BarChart3,
        title: 'Reportes de participación',
        desc: 'Ve quiénes participan, cuántos puntos tienen y cómo va el ranking en tiempo real.',
    },
    {
        icon: Shield,
        title: 'Datos seguros y aislados',
        desc: 'Cada organización tiene sus datos completamente separados. Cumplimiento GDPR.',
    },
    {
        icon: Globe,
        title: 'Subdominio propio',
        desc: 'empresa.zonapronosticos.com o tu propio dominio (polla.empresa.com) con SSL.',
    },
];

const TESTIMONIALS = [
    {
        quote: 'Fue la actividad de integración más exitosa del año. 280 empleados conectados durante todo el Mundial.',
        name: 'Andrea Morales',
        role: 'Directora de Cultura · Bavaria S.A.',
        avatar: 'A',
        color: 'bg-amber-400',
    },
    {
        quote: 'Lo usamos para fidelizar a nuestros clientes B2B. La personalización con nuestro branding fue clave.',
        name: 'Carlos Gutiérrez',
        role: 'Gerente Comercial · Grupo Éxito',
        avatar: 'C',
        color: 'bg-emerald-500',
    },
    {
        quote: 'Montamos la polla en 10 minutos. El equipo de soporte respondió en menos de una hora.',
        name: 'María Ríos',
        role: 'RRHH · Bancolombia',
        avatar: 'M',
        color: 'bg-blue-500',
    },
];

const FAQS = [
    {
        q: '¿Cuánto tiempo toma configurar la plataforma?',
        a: 'Menos de 15 minutos. Creas el tenant, personalizas el branding e invitas a tu equipo. Nada de instalaciones ni código.',
    },
    {
        q: '¿Los datos de mi empresa están separados de otros clientes?',
        a: 'Sí. Cada organización tiene un aislamiento lógico completo. Ningún usuario puede ver datos de otra empresa.',
    },
    {
        q: '¿Puedo usar mi propio dominio?',
        a: 'En el plan Business y Enterprise puedes apuntar tu propio subdominio (polla.tuempresa.com) con SSL incluido.',
    },
    {
        q: '¿Qué pasa si termina el Mundial?',
        a: 'Puedes mantener el plan para otros torneos (Copa América, Libertadores, Champions) o cancelar sin penalización.',
    },
    {
        q: '¿Pueden participar empleados de otras ciudades o países?',
        a: 'Totalmente. La plataforma es 100% online y funciona desde cualquier dispositivo y ubicación.',
    },
];

/* ─── Component ──────────────────────────────────────────── */
export default function LandingB2B() {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [contactForm, setContactForm] = useState({ name: '', company: '', email: '', employees: '', message: '' });
    const [contactSent, setContactSent] = useState(false);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        setMenuOpen(false);
    };

    const handleContact = (e: React.FormEvent) => {
        e.preventDefault();
        setContactSent(true);
    };

    return (
        <div className="min-h-screen bg-white font-sans antialiased">

            {/* ── Navbar ─────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
                            <Trophy size={16} className="text-slate-900" />
                        </div>
                        <div>
                            <span className="font-black text-slate-900 text-sm">ZonaPronosticos</span>
                            <span className="ml-1.5 text-[10px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">B2B</span>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        {[['Características', 'features'], ['Precios', 'pricing'], ['Testimonios', 'testimonials'], ['FAQ', 'faq']].map(([label, id]) => (
                            <button key={id} onClick={() => scrollTo(id)} className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <button onClick={() => navigate('/login')} className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2">
                            Iniciar sesión
                        </button>
                        <button onClick={() => scrollTo('contact')} className="text-sm font-bold bg-amber-400 text-slate-900 px-4 py-2 rounded-xl hover:bg-amber-500 transition-all">
                            Solicitar demo
                        </button>
                    </div>

                    <button onClick={() => setMenuOpen(o => !o)} className="md:hidden p-2 rounded-xl bg-slate-100">
                        {menuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
                {menuOpen && (
                    <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
                        {[['Características', 'features'], ['Precios', 'pricing'], ['FAQ', 'faq']].map(([label, id]) => (
                            <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left text-sm font-semibold text-slate-700 py-2">
                                {label}
                            </button>
                        ))}
                        <button onClick={() => scrollTo('contact')} className="w-full text-sm font-bold bg-amber-400 text-slate-900 px-4 py-2.5 rounded-xl">
                            Solicitar demo
                        </button>
                    </div>
                )}
            </nav>

            {/* ── Hero ───────────────────────────────────────── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
                <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
                            <Sparkles size={12} />
                            Mundial 2026 — Activa tu polla corporativa hoy
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
                            La polla del Mundial<br />
                            <span className="text-amber-400">con el logo de tu empresa</span>
                        </h1>
                        <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-8 max-w-2xl">
                            Activa el engagement de tus empleados y clientes con una plataforma de pronósticos completamente personalizada. 
                            Sin código. Lista en 15 minutos.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => scrollTo('contact')}
                                className="flex items-center justify-center gap-2 bg-amber-400 text-slate-900 font-black px-6 py-3.5 rounded-2xl hover:bg-amber-300 transition-all text-base">
                                Solicitar demo gratuita <ArrowRight size={18} />
                            </button>
                            <button onClick={() => scrollTo('pricing')}
                                className="flex items-center justify-center gap-2 bg-white/10 text-white font-bold px-6 py-3.5 rounded-2xl hover:bg-white/20 transition-all text-base border border-white/20">
                                Ver planes y precios
                            </button>
                        </div>
                        <div className="flex items-center gap-6 mt-8 text-sm text-slate-400">
                            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Sin tarjeta de crédito</span>
                            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> 14 días gratis</span>
                            <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Cancela cuando quieras</span>
                        </div>
                    </div>
                </div>

                {/* Floating cards decoration */}
                <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 space-y-3 opacity-80">
                    {[
                        { name: 'Bavaria', members: 284, color: '#f59e0b' },
                        { name: 'Grupo Éxito', members: 156, color: '#10b981' },
                        { name: 'Bancolombia', members: 412, color: '#3b82f6' },
                    ].map(t => (
                        <div key={t.name} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-3 w-52">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-slate-900" style={{ background: t.color }}>
                                {t.name[0]}
                            </div>
                            <div>
                                <p className="text-xs font-black text-white">{t.name}</p>
                                <p className="text-[10px] text-slate-400">{t.members} empleados activos</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Stats bar ──────────────────────────────────── */}
            <section className="bg-amber-400">
                <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { value: '+500', label: 'Empresas activas' },
                        { value: '+80K', label: 'Empleados participando' },
                        { value: '15 min', label: 'Tiempo de activación' },
                        { value: '99.9%', label: 'Uptime garantizado' },
                    ].map(({ value, label }) => (
                        <div key={label} className="text-center">
                            <p className="text-2xl md:text-3xl font-black text-slate-900">{value}</p>
                            <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ───────────────────────────────────── */}
            <section id="features" className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-2">Características</p>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900">Todo lo que necesitas,<br />nada de lo que no</h2>
                        <p className="text-slate-500 mt-3 max-w-xl mx-auto">Una plataforma completa para que RRHH y marketing activen el engagement sin depender de IT.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="p-6 rounded-2xl border border-slate-100 hover:border-amber-200 hover:shadow-md transition-all group">
                                <div className="w-11 h-11 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center mb-4 transition-colors">
                                    <Icon size={20} className="text-amber-500" />
                                </div>
                                <h3 className="font-black text-slate-900 mb-1">{title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ───────────────────────────────── */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-2">¿Cómo funciona?</p>
                        <h2 className="text-3xl font-black text-slate-900">De cero a activo en 3 pasos</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Crea tu organización', desc: 'Elige un nombre, subdominio y plan. Sin tarjeta de crédito para empezar.', icon: Building2 },
                            { step: '02', title: 'Personaliza el branding', desc: 'Sube tu logo, configura tus colores. Tu equipo verá tu marca, no la nuestra.', icon: Palette },
                            { step: '03', title: 'Invita a tu equipo', desc: 'Carga un CSV con emails o invita individualmente. Los empleados reciben un enlace directo.', icon: Users },
                        ].map(({ step, title, desc, icon: Icon }) => (
                            <div key={step} className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
                                    <Icon size={22} className="text-amber-400" />
                                </div>
                                <div className="text-[10px] font-black text-slate-400 mb-1">PASO {step}</div>
                                <h3 className="font-black text-slate-900 mb-2">{title}</h3>
                                <p className="text-sm text-slate-500">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Pricing ────────────────────────────────────── */}
            <section id="pricing" className="py-20 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-2">Planes</p>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900">Precios transparentes</h2>
                        <p className="text-slate-500 mt-3">Sin letra pequeña. Sin costos ocultos por usuario.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {PLANS.map((plan) => (
                            <div key={plan.tier} className={`relative rounded-3xl border-2 p-7 flex flex-col ${plan.color} ${plan.badge ? 'shadow-xl shadow-amber-100' : ''}`}>
                                {plan.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide">
                                        {plan.badge}
                                    </div>
                                )}
                                <div className="mb-5">
                                    <h3 className="font-black text-slate-900 text-lg">{plan.name}</h3>
                                    <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
                                </div>
                                <div className="mb-6">
                                    <span className="text-3xl font-black text-slate-900">{plan.price === 'A medida' ? '' : '$'}{plan.price}</span>
                                    {plan.period && <span className="text-sm text-slate-500 ml-1">{plan.period}</span>}
                                    {plan.price === 'A medida' && <span className="text-2xl font-black text-slate-900">A medida</span>}
                                </div>
                                <ul className="space-y-2.5 flex-1 mb-7">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                                            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <button onClick={() => scrollTo('contact')}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${plan.badge ? 'bg-amber-400 text-slate-900 hover:bg-amber-500' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                                    {plan.cta}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Testimonials ───────────────────────────────── */}
            <section id="testimonials" className="py-20 bg-slate-900">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Testimonios</p>
                        <h2 className="text-3xl font-black text-white">Empresas que ya confían en nosotros</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map(({ quote, name, role, avatar, color }) => (
                            <div key={name} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <div className="flex mb-4">
                                    {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{quote}"</p>
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center font-black text-white`}>{avatar}</div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{name}</p>
                                        <p className="text-[11px] text-slate-400">{role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FAQ ────────────────────────────────────────── */}
            <section id="faq" className="py-20 bg-white">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="text-center mb-14">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-500 mb-2">FAQ</p>
                        <h2 className="text-3xl font-black text-slate-900">Preguntas frecuentes</h2>
                    </div>
                    <div className="space-y-3">
                        {FAQS.map(({ q, a }, i) => (
                            <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden">
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
                                    <span className="font-bold text-slate-900 text-sm">{q}</span>
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">{a}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Contact / CTA ──────────────────────────────── */}
            <section id="contact" className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-start">
                    <div className="text-white">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-3">Contacto</p>
                        <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">¿Listo para activar el Mundial en tu empresa?</h2>
                        <p className="text-slate-300 mb-8">Cuéntanos sobre tu empresa y te hacemos una demo personalizada. Sin compromiso.</p>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Mail size={16} /></div>
                                <div>
                                    <p className="text-xs text-slate-400">Email</p>
                                    <p className="font-semibold text-sm">b2b@zonapronosticos.com</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><Phone size={16} /></div>
                                <div>
                                    <p className="text-xs text-slate-400">WhatsApp</p>
                                    <p className="font-semibold text-sm">+57 310 000 0000</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-7 shadow-2xl">
                        {contactSent ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                </div>
                                <h3 className="font-black text-slate-900 text-xl mb-2">¡Mensaje recibido!</h3>
                                <p className="text-slate-500 text-sm">Te contactamos en menos de 24 horas para agendar la demo.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleContact} className="space-y-4">
                                <h3 className="font-black text-slate-900 text-lg">Solicitar demo gratuita</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tu nombre</label>
                                        <input required value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="Andrea Morales" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Empresa</label>
                                        <input required value={contactForm.company} onChange={e => setContactForm(f => ({ ...f, company: e.target.value }))}
                                            placeholder="Bavaria S.A." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Email corporativo</label>
                                    <input required type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="andrea@bavaria.com" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Número de empleados</label>
                                    <select value={contactForm.employees} onChange={e => setContactForm(f => ({ ...f, employees: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                        <option value="">Selecciona un rango</option>
                                        <option>1 - 50</option>
                                        <option>51 - 150</option>
                                        <option>151 - 500</option>
                                        <option>500 - 2000</option>
                                        <option>Más de 2000</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Mensaje (opcional)</label>
                                    <textarea rows={3} value={contactForm.message} onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                                        placeholder="Cuéntanos sobre tu empresa y qué necesitas..."
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                                </div>
                                <button type="submit"
                                    className="w-full flex items-center justify-center gap-2 bg-amber-400 text-slate-900 font-black py-3 rounded-xl hover:bg-amber-500 transition-all">
                                    Solicitar demo gratuita <ArrowRight size={16} />
                                </button>
                                <p className="text-[10px] text-slate-400 text-center">Sin spam. Sin compromiso. Respondemos en &lt;24h.</p>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────── */}
            <footer className="bg-slate-950 text-slate-400 py-10">
                <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center">
                            <Trophy size={13} className="text-slate-900" />
                        </div>
                        <span className="font-black text-white text-sm">ZonaPronosticos B2B</span>
                    </div>
                    <p className="text-xs text-center">© 2026 ZonaPronosticos. Todos los derechos reservados.</p>
                    <div className="flex items-center gap-4 text-xs">
                        <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Portal clientes</button>
                        <span>·</span>
                        <a href="mailto:b2b@zonapronosticos.com" className="hover:text-white transition-colors">Contacto</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

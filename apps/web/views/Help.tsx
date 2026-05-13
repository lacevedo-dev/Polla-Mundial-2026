
import React from 'react';
import { generateHelpPDF } from '../utils/generateHelpPDF';
import { Card, Button, Badge } from '../components/UI';
import {
  Trophy,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Settings,
  Coins,
  UserPlus,
  ArrowRight,
  ListFilter,
  DollarSign,
  MessageCircle,
  Star,
  Target,
  Zap,
} from 'lucide-react';

const Help: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'rules' | 'points' | 'groups'>('rules');

  return (
    <div className="space-y-12 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-black text-white p-10 md:p-16 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Badge color="bg-lime-400 text-black">Guía Oficial 2026</Badge>
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <img key={i} className="w-6 h-6 rounded-full border-2 border-black" src={`https://picsum.photos/seed/${i}/30/30`} alt="user" />
              ))}
              <div className="w-6 h-6 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center text-[8px] font-bold">+10k</div>
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black font-brand mb-6 leading-tight uppercase tracking-tighter">
            DOMINA TU <br/><span className="text-lime-400">ESTRATEGIA.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed max-w-lg font-medium">
            Aprende cómo configurar tu liga, administrar los costos y maximizar tus puntos para ganar premios reales en el Mundial 2026.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="secondary" size="lg" className="gap-2 group rounded-2xl h-14 font-black uppercase tracking-widest text-xs">
              CREAR MI LIGA <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="ghost" onClick={generateHelpPDF} className="text-white border border-white/10 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]">Descargar Guía PDF</Button>
          </div>
        </div>
        <div className="absolute top-1/2 -right-20 transform -translate-y-1/2 opacity-20 hidden lg:block">
           <Trophy size={400} strokeWidth={0.5} className="text-white" />
        </div>
      </section>

      {/* Tabs de Navegación */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2.5rem] max-w-3xl mx-auto shadow-inner border border-slate-200">
        {[
          { id: 'rules', label: 'Finanzas & Dinámica', icon: DollarSign },
          { id: 'points', label: 'Sistema de Puntos', icon: TrendingUp },
          { id: 'groups', label: 'Gestión de Administrador', icon: ShieldCheck },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-black shadow-xl border border-slate-100 scale-[1.02]' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENIDO DINÁMICO */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* SECCIÓN: FINANZAS & DINÁMICA */}
        {activeTab === 'rules' && (
          <div className="space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h3 className="text-3xl font-black font-brand uppercase tracking-tighter leading-none text-slate-900">DINERO Y REGLAS</h3>
              <p className="text-slate-500 font-medium">Configura cómo participan tus amigos. El sistema utiliza el **Peso Colombiano (COP)** como moneda predeterminada.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-8 space-y-4 border-2 border-slate-50">
                <div className="w-12 h-12 bg-lime-100 text-lime-600 rounded-2xl flex items-center justify-center mb-4">
                  <Coins size={24} />
                </div>
                <h4 className="text-xl font-black font-brand uppercase tracking-tight">Costo General</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">Un único aporte por jugador que cubre todo el transcurso de la Copa del Mundo. Ideal para premios finales de gran volumen.</p>
                <div className="pt-4 flex items-center gap-2">
                   <Badge color="bg-slate-900 text-white">Recomendado</Badge>
                   <span className="text-[10px] font-black uppercase text-slate-400">Pago Único</span>
                </div>
              </Card>

              <Card className="p-8 space-y-4 border-2 border-slate-50">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <Calendar size={24} />
                </div>
                <h4 className="text-xl font-black font-brand uppercase tracking-tight">Costos Variables</h4>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">Selecciona si el cobro es por **Partido, Ronda o Fase**. El administrador define el valor exacto para cada etapa del torneo.</p>
                <div className="flex gap-2">
                   {['Partido', 'Ronda', 'Fase'].map(t => (
                     <span key={t} className="text-[8px] font-black uppercase tracking-widest border border-slate-200 px-2 py-1 rounded-lg text-slate-400">{t}</span>
                   ))}
                </div>
              </Card>
            </div>

            <div className="bg-slate-900 text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
               <ShieldCheck size={150} className="absolute -bottom-10 -right-10 opacity-10" />
               <div className="max-w-xl space-y-4 relative z-10">
                  <Badge color="bg-lime-400 text-black">Fair Play</Badge>
                  <h3 className="text-3xl font-black font-brand uppercase tracking-tighter">TIEMPOS Y CIERRES</h3>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">
                    Todas las predicciones se bloquean exactamente **15 minutos antes** de que inicie el partido. No se permiten cambios una vez cerrada la ventana, garantizando transparencia total entre todos los competidores.
                  </p>
                  <ul className="space-y-2 pt-4">
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-300"><CheckCircle2 size={16} className="text-lime-400" /> Resultados a 90' + Adición</li>
                    <li className="flex items-center gap-3 text-xs font-bold text-slate-300"><CheckCircle2 size={16} className="text-lime-400" /> Clasificados en rondas eliminatorias</li>
                  </ul>
               </div>
            </div>
          </div>
        )}

        {/* SECCIÓN: PUNTUACIÓN */}
        {activeTab === 'points' && (
          <div className="space-y-10 max-w-4xl mx-auto">

            {/* Intro */}
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-black font-brand uppercase tracking-tighter text-slate-900">Sistema de Puntuación</h3>
              <p className="text-slate-500 text-base leading-relaxed max-w-xl mx-auto">
                Cada partido vale hasta <strong className="text-slate-800">5 puntos base</strong> más bonos adicionales.
                Los puntos de ganador y gol se <strong className="text-slate-800">suman entre sí</strong>; el marcador exacto es una categoría independiente.
              </p>
            </div>

            {/* ── 1. Puntos por resultado ── */}
            <section aria-labelledby="sec-resultado">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">1</span>
                <h4 id="sec-resultado" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">Puntos por resultado del partido</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Marcador exacto */}
                <div className="rounded-[2rem] border-2 border-lime-200 bg-lime-50 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">🎯</span>
                      <span className="text-sm font-black uppercase tracking-wide text-lime-800">Marcador exacto</span>
                    </div>
                    <span className="text-3xl font-black text-lime-700 tabular-nums">5</span>
                  </div>
                  <p className="text-sm text-lime-700 leading-relaxed">
                    Predijiste los goles de ambos equipos con exactitud. Es la mayor puntuación posible por partido.
                  </p>
                  <div className="rounded-xl bg-lime-100 px-3 py-2">
                    <p className="text-xs text-lime-700 font-medium italic">
                      Predijiste <strong>2‑1</strong> y el partido terminó <strong>2‑1</strong> → 5 pts
                    </p>
                  </div>
                  <p className="text-[10px] text-lime-600 font-semibold">
                    ⚠️ No se acumula con los puntos de ganador ni gol — es independiente.
                  </p>
                </div>

                {/* Ganador acertado */}
                <div className="rounded-[2rem] border-2 border-blue-200 bg-blue-50 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">✅</span>
                      <span className="text-sm font-black uppercase tracking-wide text-blue-800">Ganador acertado</span>
                    </div>
                    <span className="text-3xl font-black text-blue-700 tabular-nums">2</span>
                  </div>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    Acertaste quién ganó el partido o que terminaría en empate, aunque los goles no coincidan exactamente.
                  </p>
                  <div className="rounded-xl bg-blue-100 px-3 py-2">
                    <p className="text-xs text-blue-700 font-medium italic">
                      Predijiste <strong>2‑0</strong> y el resultado fue <strong>3‑1</strong> → ganador correcto → 2 pts
                    </p>
                  </div>
                </div>

                {/* Gol acertado */}
                <div className="rounded-[2rem] border-2 border-purple-200 bg-purple-50 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">⚽</span>
                      <span className="text-sm font-black uppercase tracking-wide text-purple-800">Gol acertado</span>
                    </div>
                    <span className="text-3xl font-black text-purple-700 tabular-nums">1</span>
                  </div>
                  <p className="text-sm text-purple-700 leading-relaxed">
                    Al menos uno de los dos marcadores (local <em>o</em> visitante) coincide exactamente con el resultado real.
                  </p>
                  <div className="rounded-xl bg-purple-100 px-3 py-2">
                    <p className="text-xs text-purple-700 font-medium italic">
                      Predijiste <strong>1‑2</strong> y el resultado fue <strong>1‑0</strong> → el gol local (1) coincide → 1 pt
                    </p>
                  </div>
                </div>

                {/* Tabla de combinaciones */}
                <div className="rounded-[2rem] border-2 border-teal-200 bg-teal-50 p-6 space-y-3">
                  <div className="flex items-center gap-3 mb-1">
                    <Zap size={20} className="text-teal-600 shrink-0" />
                    <span className="text-sm font-black uppercase tracking-wide text-teal-800">Combinaciones aditivas</span>
                  </div>
                  <p className="text-xs text-teal-700 leading-relaxed">
                    Ganador y gol se <strong>suman</strong>. Puedes obtener hasta 3 puntos combinados por partido (sin contar marcador exacto).
                  </p>
                  <div className="space-y-2 pt-1">
                    {[
                      { combo: 'Ganador + gol acertado', total: '3 pts', detail: '2 + 1', accent: 'text-teal-700' },
                      { combo: 'Solo ganador acertado',  total: '2 pts', detail: '2 + 0', accent: 'text-blue-700' },
                      { combo: 'Solo gol acertado',      total: '1 pt',  detail: '0 + 1', accent: 'text-purple-700' },
                      { combo: 'Ninguno acertado',       total: '0 pts', detail: '—',     accent: 'text-slate-400' },
                    ].map((c) => (
                      <div key={c.combo} className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">{c.combo}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 tabular-nums">{c.detail}</span>
                          <span className={`text-xs font-black tabular-nums ${c.accent}`}>{c.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. Bonos ── */}
            <section aria-labelledby="sec-bonos">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">2</span>
                <h4 id="sec-bonos" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">Bonos adicionales</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Predicción única */}
                <div className="rounded-[2rem] border-2 border-amber-200 bg-amber-50 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">⭐</span>
                      <span className="text-sm font-black uppercase tracking-wide text-amber-800">Predicción única</span>
                    </div>
                    <span className="text-3xl font-black text-amber-700 tabular-nums">+5</span>
                  </div>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Si acertaste el marcador exacto <strong>y eres el único jugador de la liga</strong> que predijo ese marcador, recibes 5 puntos extra automáticamente.
                  </p>
                  <div className="rounded-xl bg-amber-100 px-3 py-2">
                    <p className="text-xs text-amber-700 font-medium italic">
                      Solo tú predijiste <strong>2‑1</strong> y terminó <strong>2‑1</strong> → 5 base + 5 único = <strong>10 pts</strong>
                    </p>
                  </div>
                </div>

                {/* Bono clasificados */}
                <div className="rounded-[2rem] border-2 border-slate-200 bg-slate-50 p-6 space-y-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl" aria-hidden="true">🏆</span>
                    <span className="text-sm font-black uppercase tracking-wide text-slate-800">Bono clasificados</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    En cada partido de eliminatoria, elige qué equipo clasifica a la siguiente ronda.
                    Si <strong className="text-slate-800">aciertas todos los picks de una fase completa</strong>, recibes el bono de esa fase.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {[
                      { phase: 'Octavos',   sub: '16 → 8',  pts: '8 pts', icon: '🥈' },
                      { phase: 'Cuartos',   sub: '8 → 4',   pts: '4 pts', icon: '🥉' },
                      { phase: 'Semifinal', sub: '4 → 2',   pts: '2 pts', icon: '🏅' },
                      { phase: 'Campeón',   sub: 'El ganador', pts: '5 pts', icon: '🏆' },
                    ].map((b) => (
                      <div key={b.phase} className="flex flex-col rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-sm" aria-hidden="true">{b.icon}</span>
                          <span className="text-sm font-black text-lime-600">{b.pts}</span>
                        </div>
                        <p className="text-[11px] font-black text-slate-700 mt-1">{b.phase}</p>
                        <p className="text-[10px] text-slate-400">{b.sub}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug pt-1">
                    Si fallas aunque sea uno de los picks de la fase, no obtienes el bono de esa ronda.
                  </p>
                </div>
              </div>
            </section>

            {/* ── 3. Ejemplo completo ── */}
            <section aria-labelledby="sec-ejemplo">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">3</span>
                <h4 id="sec-ejemplo" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">Ejemplo de calificación</h4>
              </div>
              <Card className="!p-0 overflow-hidden shadow-xl rounded-[2.5rem] border-0">
                {/* Header resultado real */}
                <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-lime-400 text-black flex items-center justify-center font-brand text-xs font-black">26</div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-white">Resultado: COL 2 – 1 ARG</span>
                  </div>
                  <Badge color="bg-lime-400 text-black">Final</Badge>
                </div>
                {/* Filas jugadores */}
                <div className="bg-white divide-y divide-slate-50">
                  {[
                    {
                      initials: 'C', color: 'bg-lime-400 text-slate-900',
                      user: 'Crack_2026', pred: '2 – 1',
                      pts: '10 pts', label: 'Marcador exacto + predicción única',
                      detail: '5 base + 5 único', highlight: true,
                    },
                    {
                      initials: 'F', color: 'bg-blue-400 text-white',
                      user: 'FifaLover', pred: '3 – 1',
                      pts: '3 pts', label: 'Ganador + gol acertado',
                      detail: '2 + 1', highlight: false,
                    },
                    {
                      initials: 'G', color: 'bg-purple-400 text-white',
                      user: 'Goleador9', pred: '2 – 2',
                      pts: '1 pt', label: 'Solo gol acertado (COL = 2)',
                      detail: '0 + 1', highlight: false,
                    },
                    {
                      initials: 'N', color: 'bg-slate-300 text-slate-700',
                      user: 'Novato99', pred: '0 – 0',
                      pts: '0 pts', label: 'Ningún acierto',
                      detail: '—', highlight: false,
                    },
                  ].map((item) => (
                    <div key={item.user} className={`flex items-center gap-4 px-5 py-4 sm:px-6 ${item.highlight ? 'bg-lime-50/60' : ''}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${item.color}`}>
                        {item.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 leading-tight">{item.user}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${item.highlight ? 'text-lime-600' : 'text-slate-400'}`}>
                          {item.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pronóstico</span>
                          <span className="font-mono font-bold bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-sm">{item.pred}</span>
                        </div>
                        <div className={`text-lg font-black tabular-nums ${item.highlight ? 'text-lime-600' : 'text-slate-800'}`}>
                          {item.pts}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* ── 4. Desempate ── */}
            <section aria-labelledby="sec-desempate">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">4</span>
                <h4 id="sec-desempate" className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-700">Criterio de desempate en el ranking</h4>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500 leading-relaxed mb-5">
                  Cuando dos jugadores tienen los mismos puntos, el ranking se decide con estos criterios <strong className="text-slate-700">en orden</strong> — se avanza al siguiente solo si persiste el empate.
                </p>
                <ol className="space-y-2" aria-label="Criterios de desempate en orden">
                  {[
                    { icon: '🏅', label: 'Mayor puntaje total',      desc: 'El que más puntos acumuló durante el torneo.' },
                    { icon: '🏆', label: 'Campeón acertado',          desc: 'Predijiste correctamente al campeón del torneo (bono clasificados, fase Final).' },
                    { icon: '🎯', label: 'Más marcadores exactos',    desc: 'Cantidad de veces que acertaste el resultado completo (ambos goles).' },
                    { icon: '✅', label: 'Más ganadores acertados',   desc: 'Cuántos ganadores o empates predijiste correctamente.' },
                    { icon: '⚽', label: 'Más goles acertados',       desc: 'Cuántos marcadores individuales coincidieron con el resultado real.' },
                    { icon: '⭐', label: 'Más predicciones únicas',   desc: 'Cuántas veces fuiste el único participante con ese marcador exacto.' },
                  ].map((c, idx) => (
                    <li key={c.label} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-600 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">{c.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-800">{c.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{c.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

          </div>
        )}

        {/* SECCIÓN: GESTIÓN DE ADMINISTRADOR */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
               <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full">
                  <ShieldCheck size={14} className="text-lime-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Centro de Administración</span>
               </div>
               <h3 className="text-4xl md:text-5xl font-black font-brand uppercase leading-[0.9] text-slate-900 tracking-tighter">
                 LIDERA TU <br/><span className="text-lime-600">COMUNIDAD.</span>
               </h3>
               <p className="text-slate-500 text-lg leading-relaxed max-w-md font-medium">
                 Como creador de la polla, tienes acceso a herramientas exclusivas para invitar, cobrar y premiar a tus jugadores.
               </p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Invitación WhatsApp', desc: 'Envia enlaces personalizados con costos y reglas claras.', icon: MessageCircle },
                    { title: 'Cobro Parametrizable', desc: 'Configura COP como moneda y define montos por fases.', icon: DollarSign },
                    { title: 'Buscador de Amigos', desc: 'Agregue contactos directamente desde la plataforma.', icon: UserPlus },
                    { title: 'Exportación Pro', desc: 'Descarga reportes de pagos y puntos en tiempo real.', icon: ListFilter },
                  ].map((feat, i) => (
                    <div key={i} className="p-6 border border-slate-100 rounded-[2rem] hover:bg-white hover:shadow-xl hover:border-lime-100 transition-all space-y-3 group">
                       <div className="w-10 h-10 rounded-xl bg-slate-50 shadow-inner flex items-center justify-center text-slate-400 group-hover:bg-lime-400 group-hover:text-black transition-colors">
                          <feat.icon size={18} />
                       </div>
                       <div>
                          <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-900">{feat.title}</h4>
                          <p className="text-xs text-slate-500 leading-tight mt-1 font-medium">{feat.desc}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="relative pt-10">
               <Card className="bg-slate-900 text-white shadow-3xl relative z-20 border-0 p-10 rounded-[3rem] rotate-1">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-lime-400 text-black rounded-2xl flex items-center justify-center font-brand font-black text-lg">AD</div>
                        <div>
                           <h4 className="font-black text-xs uppercase tracking-widest">Tablero Admin</h4>
                           <p className="text-[10px] text-lime-400 font-black uppercase tracking-widest">Moneda: COP</p>
                        </div>
                     </div>
                     <Settings size={20} className="text-slate-500 hover:text-white cursor-pointer" />
                  </div>
                  
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3">
                           <Trophy size={16} className="text-lime-400" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Bolsa Actual</span>
                        </div>
                        <span className="text-sm font-black">$1.200.000 COP</span>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3">
                           <Users size={16} className="text-purple-400" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Participantes</span>
                        </div>
                        <span className="text-sm font-black">24 Jugadores</span>
                     </div>
                  </div>

                  <Button className="w-full mt-8 rounded-[2rem] h-14 font-black uppercase tracking-[0.2em] text-[10px]" variant="secondary">
                     GESTIONAR PAGOS
                  </Button>
               </Card>
               {/* Decoración Flotante */}
               <div className="absolute -top-10 -right-10 w-48 h-48 bg-lime-400/20 rounded-full blur-3xl -z-10"></div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Help;

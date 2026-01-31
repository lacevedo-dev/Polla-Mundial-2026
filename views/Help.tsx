
import React from 'react';
import { Card, Button, Badge } from '../components/UI';
import { 
  Trophy, 
  Users, 
  Target, 
  ShieldCheck, 
  Smartphone, 
  TrendingUp, 
  Zap, 
  ChevronRight, 
  CheckCircle2,
  Calendar,
  Settings,
  Coins,
  Share2,
  UserPlus,
  ArrowRight,
  ListFilter,
  DollarSign,
  // Added MessageCircle to fix the 'Cannot find name MessageCircle' error
  MessageCircle
} from 'lucide-react';

const Help: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'rules' | 'points' | 'groups'>('rules');

  const pointRules = [
    { label: 'Marcador Exacto', points: '+5', desc: 'Aciertas goles de ambos equipos.' },
    { label: 'Ganador Acertado', points: '+2', desc: 'Aciertas quién gana pero no el marcador.' },
    { label: 'Goles de un Equipo', points: '+1', desc: 'No aciertas resultado, pero sí goles de uno.' },
    { label: 'Predicción Única', points: '+5', desc: 'Bono si eres el único de tu grupo en acertar.' },
  ];

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
            <Button variant="ghost" className="text-white border border-white/10 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]">Descargar Guía PDF</Button>
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
          <div className="space-y-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {pointRules.map((rule, i) => (
                <div key={i} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] text-center space-y-3 hover:shadow-2xl transition-all hover:-translate-y-2 group shadow-sm border-b-4 border-b-transparent hover:border-b-lime-400">
                  <div className="text-5xl font-black font-brand text-slate-900 group-hover:text-lime-500 transition-colors mb-2 leading-none">{rule.points}</div>
                  <h4 className="font-black text-[10px] text-slate-900 uppercase tracking-widest">{rule.label}</h4>
                  <p className="text-[9px] text-slate-400 uppercase font-bold leading-tight">{rule.desc}</p>
                </div>
              ))}
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                 <div className="h-px bg-slate-200 flex-1"></div>
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Ejemplo de Calificación</h3>
                 <div className="h-px bg-slate-200 flex-1"></div>
              </div>
              
              <Card className="border-2 border-slate-50 !p-0 overflow-hidden shadow-2xl rounded-[3rem]">
                <div className="bg-slate-900 p-6 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-lime-400 text-black flex items-center justify-center font-brand text-xs font-black shadow-lg">26</div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Resultado Final: COL 2 - 1 ARG</span>
                   </div>
                   <Badge color="bg-lime-400 text-black">VALIDADO</Badge>
                </div>
                <div className="bg-white divide-y divide-slate-50">
                   {[
                     { user: 'Crack_2026', pred: '2 - 1', points: '5 pts', reason: 'MARCADOR EXACTO', status: 'perfect' },
                     { user: 'FifaLover', pred: '1 - 0', points: '2 pts', reason: 'Ganador Acertado', status: 'normal' },
                     { user: 'Goleador9', pred: '2 - 2', points: '1 pts', reason: 'Goles de un equipo', status: 'normal' },
                   ].map((item, i) => (
                     <div key={i} className={`flex items-center gap-6 p-6 transition-colors ${item.status === 'perfect' ? 'bg-lime-50/50' : ''}`}>
                        <img src={`https://picsum.photos/seed/${item.user}/40/40`} className="w-12 h-12 rounded-full ring-2 ring-white shadow-sm" alt="avatar" />
                        <div className="flex-1">
                           <p className="font-black text-slate-900 text-sm tracking-tight">{item.user}</p>
                           <p className={`text-[9px] font-black uppercase tracking-[0.15em] ${item.status === 'perfect' ? 'text-lime-600' : 'text-slate-400'}`}>
                             {item.reason}
                           </p>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="hidden sm:flex flex-col items-end">
                              <span className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Su Pronóstico</span>
                              <span className="font-mono font-bold bg-white border border-slate-100 px-3 py-1 rounded-lg text-sm">{item.pred}</span>
                           </div>
                           <div className={`text-xl font-black ${item.status === 'perfect' ? 'text-lime-600' : 'text-slate-900'}`}>
                              {item.points}
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </Card>
            </div>
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

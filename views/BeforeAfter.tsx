
import React from 'react';
import { Card, Badge } from '../components/UI';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const BeforeAfter: React.FC = () => {
  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-black font-brand mb-2">TRANSFORMACIÓN <span className="text-lime-500">UI</span></h1>
        <p className="text-slate-500 text-lg">Evolución de una interfaz fragmentada a un sistema unificado.</p>
      </header>

      {/* Case 1: Match Prediction Card */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          1. Tarjeta de Predicción
          <Badge color="bg-blue-50 text-blue-600">Componente Crítico</Badge>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* OLD */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rose-500 font-bold uppercase text-xs">
              <XCircle size={14} /> Estado Anterior (Legacy)
            </div>
            <div className="bg-gray-100 p-4 border rounded shadow-none opacity-80 pointer-events-none grayscale">
              <h4 className="text-sm font-serif">Grupo A - 11/06/2026</h4>
              <div className="flex justify-between my-2">
                <span>EEUU</span>
                <input type="text" className="w-8 border" />
                <span>-</span>
                <input type="text" className="w-8 border" />
                <span>MEX</span>
              </div>
              <button className="bg-blue-500 text-white w-full text-xs py-1">Guardar</button>
            </div>
            <ul className="text-sm text-slate-500 space-y-1 bg-rose-50 p-4 rounded-xl border border-rose-100">
              <li>❌ Inconsistencia en bordes (cuadrados).</li>
              <li>❌ Tipografía serif fuera de marca.</li>
              <li>❌Inputs pequeños y difíciles de tocar en móvil.</li>
              <li>❌ Falta de jerarquía visual.</li>
            </ul>
          </div>

          {/* NEW */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-lime-600 font-bold uppercase text-xs">
              <CheckCircle size={14} /> Propuesta Unificada (2026)
            </div>
            <Card>
               <div className="flex justify-between items-center mb-4">
                  <Badge color="bg-slate-100 text-slate-500">GRUPO A • 11 JUN</Badge>
                  <span className="text-xs font-bold text-lime-600">ACTIVO</span>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-2xl">🇺🇸</span>
                    <span className="font-bold text-xs">EEUU</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="0" className="w-12 h-12 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none" />
                    <span className="text-slate-400 font-bold">-</span>
                    <input type="number" placeholder="0" className="w-12 h-12 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-lime-400 outline-none" />
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-2xl">🇲🇽</span>
                    <span className="font-bold text-xs">MEXICO</span>
                  </div>
               </div>
            </Card>
            <ul className="text-sm text-slate-500 space-y-1 bg-lime-50 p-4 rounded-xl border border-lime-100">
              <li>✅ Sistema de bordes suaves (3xl).</li>
              <li>✅ Tipografía Montserrat/Inter unificada.</li>
              <li>✅ Inputs optimizados para pantallas táctiles.</li>
              <li>✅ Uso de Badges para estados claros.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* UI Notes */}
      <section className="bg-slate-900 text-white p-8 rounded-[2.5rem]">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Info className="text-lime-400" />
          Reglas de Diseño para el Futuro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-lime-400 font-bold mb-2">Escalabilidad</h4>
            <p className="text-sm text-slate-400">Todos los nuevos componentes deben heredar de la paleta principal. No se permiten colores "inline" fuera de los tokens definidos.</p>
          </div>
          <div>
            <h4 className="text-lime-400 font-bold mb-2">Interactividad</h4>
            <p className="text-sm text-slate-400">Cualquier elemento interactivo debe tener un estado hover de escala (active:scale-95) y un feedback visual de carga.</p>
          </div>
          <div>
            <h4 className="text-lime-400 font-bold mb-2">Contraste</h4>
            <p className="text-sm text-slate-400">Se prioriza el fondo blanco con texto Slate-900 para máxima legibilidad, usando el Lime Green solo para acentos y CTAs principales.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BeforeAfter;

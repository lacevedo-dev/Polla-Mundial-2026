
import React from 'react';
import { Card, Button, Input, Badge } from '../components/UI';
import { COLORS } from '../constants';

const DesignSystem: React.FC = () => {
  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-black font-brand mb-2 uppercase tracking-tighter text-slate-900">DESIGN SYSTEM <span className="text-lime-500">V1.0</span></h1>
        <p className="text-slate-500 text-lg">Guía de unificación visual para Polla Mundial 2026.</p>
      </header>

      {/* Colors */}
      <section>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
          <div className="w-1.5 h-6 bg-lime-400 rounded-full"></div>
          Paleta de Colores
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(COLORS).map(([name, val]) => (
             typeof val === 'string' && (
              <div key={name} className="space-y-2">
                <div className="h-24 rounded-3xl shadow-inner border border-slate-200" style={{ backgroundColor: val }}></div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500 tracking-wider">{name}</p>
                  <p className="text-sm font-mono font-bold text-slate-900">{val}</p>
                </div>
              </div>
             )
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full"></div>
            Tipografía
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-widest">Brand / Headings</p>
              <h3 className="font-brand text-4xl font-black uppercase text-slate-900">Montserrat Black</h3>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2 font-bold uppercase tracking-widest">Body / Interface</p>
              <h3 className="text-2xl font-black text-slate-900">Inter Sans Regular/Bold</h3>
              <p className="text-slate-600 mt-2">Usado para legibilidad en datos, formularios y textos largos.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
            <div className="w-1.5 h-6 bg-cyan-500 rounded-full"></div>
            Componentes Base
          </h2>
          <div className="space-y-8">
            <div className="flex flex-wrap gap-4">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="space-y-4">
              <Input placeholder="Input de texto unificado..." />
              <div className="flex gap-2">
                <Badge color="bg-lime-100 text-lime-700">Aprobado</Badge>
                <Badge color="bg-rose-100 text-rose-700">Vencido</Badge>
                <Badge color="bg-blue-100 text-blue-700">En curso</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tokens Table */}
      <section>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900">
          <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
          Design Tokens
        </h2>
        <Card className="overflow-hidden !p-0 border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-wider">Valor Token</th>
                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-wider">Uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-6 py-4 font-bold text-slate-900">Borders</td>
                <td className="px-6 py-4 font-mono text-sm text-slate-700">rounded-3xl (24px)</td>
                <td className="px-6 py-4 text-slate-600">Tarjetas principales</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-bold text-slate-900">Shadows</td>
                <td className="px-6 py-4 font-mono text-sm text-slate-700">shadow-sm / hover:shadow-md</td>
                <td className="px-6 py-4 text-slate-600">Elevación consistente</td>
              </tr>
              <tr>
                <td className="px-6 py-4 font-bold text-slate-900">Grid</td>
                <td className="px-6 py-4 font-mono text-sm text-slate-700">gap-6 (1.5rem)</td>
                <td className="px-6 py-4 text-slate-600">Espaciado base entre elementos</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
};

export default DesignSystem;

import { renderPhaseBonusHelpCardsHtml, renderPhaseBonusHelpTableRowsHtml } from '@polla-2026/shared';

export function generateHelpPDF(orgName = 'Portal Corporativo', primaryColor = '#f59e0b'): void {
  const year = new Date().getFullYear();
  const phaseBonusTableRows = renderPhaseBonusHelpTableRowsHtml();
  const phaseBonusCards = renderPhaseBonusHelpCardsHtml();
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guía Oficial Polla Mundial ${year} — ${orgName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      background: #fff;
      line-height: 1.5;
    }
    .page { max-width: 750px; margin: 0 auto; padding: 28px 32px 40px; }

    /* Portada */
    .cover {
      background: #0f172a;
      color: #fff;
      border-radius: 16px;
      padding: 40px 36px 36px;
      margin-bottom: 28px;
    }
    .cover-badge {
      display: inline-block;
      background: ${primaryColor};
      color: #000;
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    .cover h1 {
      font-size: 30pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 12px;
    }
    .cover h1 span { color: ${primaryColor}; }
    .cover-sub { color: #94a3b8; font-size: 10pt; max-width: 480px; line-height: 1.6; }
    .cover-footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #64748b;
    }
    .cover-footer strong { color: ${primaryColor}; }

    /* Secciones */
    .section { margin-bottom: 28px; break-inside: avoid; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f1f5f9;
    }
    .section-number {
      width: 24px; height: 24px;
      background: #0f172a;
      color: #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 9pt; font-weight: 900; flex-shrink: 0;
    }
    .section-title {
      font-size: 11pt; font-weight: 900;
      text-transform: uppercase; letter-spacing: 0.12em; color: #0f172a;
    }

    /* Tarjetas de puntos */
    .points-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .point-card { border-radius: 12px; padding: 12px 14px; break-inside: avoid; }
    .point-card.lime   { background: #f7fee7; border: 1.5px solid #bef264; }
    .point-card.blue   { background: #eff6ff; border: 1.5px solid #bfdbfe; }
    .point-card.purple { background: #faf5ff; border: 1.5px solid #e9d5ff; }
    .point-card.amber  { background: #fffbeb; border: 1.5px solid #fde68a; }
    .point-card.teal   { background: #f0fdfa; border: 1.5px solid #99f6e4; }
    .point-card.slate  { background: #f8fafc; border: 1.5px solid #e2e8f0; }

    .point-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .point-card-title { font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
    .point-card.lime   .point-card-title { color: #3f6212; }
    .point-card.blue   .point-card-title { color: #1e40af; }
    .point-card.purple .point-card-title { color: #6b21a8; }
    .point-card.amber  .point-card-title { color: #92400e; }
    .point-card.teal   .point-card-title { color: #134e4a; }
    .point-card.slate  .point-card-title { color: #1e293b; }

    .point-card-pts { font-size: 20pt; font-weight: 900; line-height: 1; }
    .point-card.lime   .point-card-pts { color: #4d7c0f; }
    .point-card.blue   .point-card-pts { color: #1d4ed8; }
    .point-card.purple .point-card-pts { color: #7c3aed; }
    .point-card.amber  .point-card-pts { color: #b45309; }

    .point-card p { font-size: 8.5pt; line-height: 1.5; }
    .point-card.lime   p { color: #365314; }
    .point-card.blue   p { color: #1e3a8a; }
    .point-card.purple p { color: #4c1d95; }
    .point-card.amber  p { color: #78350f; }
    .point-card.teal   p { color: #134e4a; }
    .point-card.slate  p { color: #475569; }

    .point-card-example { margin-top: 6px; padding: 5px 8px; border-radius: 6px; font-size: 8pt; font-style: italic; }
    .point-card.lime   .point-card-example { background: #d9f99d; color: #365314; }
    .point-card.blue   .point-card-example { background: #dbeafe; color: #1e3a8a; }
    .point-card.purple .point-card-example { background: #ede9fe; color: #4c1d95; }
    .point-card.amber  .point-card-example { background: #fef3c7; color: #78350f; }

    .point-card-warning { margin-top: 5px; font-size: 7.5pt; font-weight: 700; }
    .point-card.lime .point-card-warning { color: #4d7c0f; }

    /* Tabla resumen */
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9pt; }
    .summary-table th { background: #0f172a; color: #fff; padding: 7px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; }
    .summary-table th:last-child { text-align: center; }
    .summary-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    .summary-table td:last-child { text-align: center; font-weight: 900; font-size: 11pt; }
    .summary-table tr:nth-child(even) td { background: #f8fafc; }
    .pts-lime   { color: #4d7c0f; }
    .pts-blue   { color: #1d4ed8; }
    .pts-purple { color: #7c3aed; }
    .pts-amber  { color: #b45309; }
    .pts-slate  { color: #475569; }

    /* Ejemplos */
    .example-block { margin-bottom: 18px; break-inside: avoid; }
    .example-header { background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 10px 10px 0 0; display: flex; align-items: center; justify-content: space-between; }
    .example-header span { font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }
    .example-badge { background: ${primaryColor}; color: #000; font-size: 7pt; font-weight: 800; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.1em; }
    .example-result { background: #1e293b; color: #94a3b8; font-size: 8.5pt; padding: 5px 14px; font-weight: 600; }
    .example-result strong { color: ${primaryColor}; }
    .example-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    .example-table th { background: #f8fafc; color: #64748b; padding: 5px 10px; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; }
    .example-table th:nth-child(3), .example-table th:nth-child(4) { text-align: center; }
    .example-table td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .example-table td:nth-child(3), .example-table td:nth-child(4) { text-align: center; }
    .example-table tr.highlight td { background: #f7fee7; }
    .example-table tr.highlight .pts-cell { color: #4d7c0f; font-weight: 900; }
    .pts-cell { font-weight: 900; font-size: 10pt; }
    .pred-cell { font-family: monospace; font-weight: 700; }

    /* Desempate */
    .tiebreak-list { list-style: none; }
    .tiebreak-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 6px; break-inside: avoid; }
    .tiebreak-num { width: 20px; height: 20px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8pt; font-weight: 900; color: #475569; flex-shrink: 0; }
    .tiebreak-icon { font-size: 14pt; flex-shrink: 0; line-height: 1.2; }
    .tiebreak-text { flex: 1; min-width: 0; }
    .tiebreak-text strong { display: block; font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-bottom: 1px; }
    .tiebreak-text p { font-size: 8.5pt; color: #64748b; line-height: 1.4; }

    /* Bonos */
    .bonus-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .bonus-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; text-align: center; }
    .bonus-card .bonus-icon { font-size: 14pt; }
    .bonus-card .bonus-phase { font-size: 8pt; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-top: 3px; }
    .bonus-card .bonus-sub { font-size: 7.5pt; color: #94a3b8; }
    .bonus-card .bonus-pts { font-size: 14pt; font-weight: 900; color: #4d7c0f; line-height: 1; margin-top: 2px; }

    /* Info box */
    .info-box { background: #0f172a; color: #fff; border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; }
    .info-box h3 { font-size: 12pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.01em; color: ${primaryColor}; margin-bottom: 6px; }
    .info-box p { color: #94a3b8; font-size: 9pt; line-height: 1.6; }
    .info-box ul { padding-left: 18px; margin-top: 8px; }
    .info-box ul li { color: #cbd5e1; font-size: 9pt; margin-bottom: 4px; }

    /* FAQ */
    .faq-item { margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border-left: 3px solid ${primaryColor}; break-inside: avoid; }
    .faq-q { font-size: 9.5pt; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .faq-a { font-size: 9pt; color: #475569; line-height: 1.6; }

    /* Admin */
    .admin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .admin-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .admin-card-title { font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-bottom: 3px; }
    .admin-card p { font-size: 8.5pt; color: #64748b; line-height: 1.4; }

    /* Combos */
    .combos { list-style: none; }
    .combo-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #f1f5f9; font-size: 9pt; }
    .combo-row:last-child { border-bottom: none; }
    .combo-right { display: flex; align-items: center; gap: 8px; }
    .combo-detail { font-size: 8pt; color: #94a3b8; }
    .combo-total { font-weight: 900; font-size: 10pt; }

    .bono-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; font-size: 8.5pt; color: #78350f; margin-top: 8px; line-height: 1.5; }

    .example-table.four-col th:nth-child(3),
    .example-table.four-col th:nth-child(4),
    .example-table.four-col th:nth-child(5) { text-align: center; }
    .example-table.four-col td:nth-child(3),
    .example-table.four-col td:nth-child(4),
    .example-table.four-col td:nth-child(5) { text-align: center; }

    /* Footer */
    .pdf-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 8pt; color: #94a3b8; }
    .pdf-footer strong { color: ${primaryColor}; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 10px 16px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- PORTADA -->
  <div class="cover">
    <div class="cover-badge">Guía Oficial ${year}</div>
    <h1>DOMINA TU <span>ESTRATEGIA.</span></h1>
    <p class="cover-sub">
      Guía completa del sistema de puntuación, reglas de predicción, bonos, criterios de desempate
      y administración de grupos para la Polla del Mundial ${year} — ${orgName}.
    </p>
    <div class="cover-footer">
      <span>${orgName}</span>
      <span>Generado el <strong>${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
    </div>
  </div>

  <!-- SECCIÓN 1: REGLAS GENERALES -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">1</div>
      <span class="section-title">Reglas Generales</span>
    </div>
    <div class="info-box">
      <h3>Cálculo de Puntos</h3>
      <p>Para el cálculo de puntos se utiliza el resultado real del partido al finalizar los <strong>90 o 120 minutos</strong>. <strong>No incluye definición por penaltis.</strong></p>
    </div>
    <div class="info-box">
      <h3>Predicciones</h3>
      <p>El usuario puede realizar y cambiar sus predicciones hasta <strong>15 minutos antes de iniciar el partido</strong>, momento en el cual el sistema no permitirá modificar la predicción. Realiza las predicciones con tiempo. Se usa la hora del sistema.</p>
      <ul>
        <li>Si el jugador no realiza la predicción para un partido, no se sumarán puntos.</li>
        <li>En fases de dieciseisavos, octavos, cuartos, etc., el usuario podrá seleccionar el equipo que clasificará a la siguiente ronda. Esta selección solo influye en los bonos de cada fase.</li>
      </ul>
    </div>
  </div>

  <!-- SECCIÓN 2: SISTEMA DE PUNTUACIÓN -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">2</div>
      <span class="section-title">Sistema de Puntuación</span>
    </div>
    <table class="summary-table">
      <thead>
        <tr><th>Regla</th><th>Descripción</th><th>Puntaje</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>🎯 Marcador Exacto</strong></td><td>Aciertas exactamente el marcador del partido</td><td class="pts-lime">5</td></tr>
        <tr><td><strong>✅ Ganador Acertado</strong></td><td>Aciertas el ganador o el empate (sin marcador exacto)</td><td class="pts-blue">2</td></tr>
        <tr><td><strong>⚽ Gol Acertado</strong></td><td>Aciertas el número de goles de uno de los equipos</td><td class="pts-purple">1</td></tr>
        <tr><td><strong>⭐ Predicción Única</strong></td><td>Fuiste el único que acertó el marcador exacto en el grupo</td><td class="pts-amber">+5</td></tr>
        <tr><td><strong>🔥 Multiplicador Eliminatorias</strong></td><td>En rondas finales, marcador, ganador y gol ×1.5 (no en grupos ni al bono único)</td><td class="pts-slate">×1.5</td></tr>
        ${phaseBonusTableRows}
      </tbody>
    </table>

    <div class="points-grid">
      <div class="point-card lime">
        <div class="point-card-header">
          <div><span style="font-size:16pt">🎯</span><span class="point-card-title">Marcador Exacto</span></div>
          <span class="point-card-pts">5</span>
        </div>
        <p>Predijiste los goles de ambos equipos con exactitud. Es la mayor puntuación posible por partido.</p>
        <div class="point-card-example">Predijiste <strong>2-1</strong> y el partido terminó <strong>2-1</strong> → 5 pts</div>
        <p class="point-card-warning">⚠️ No se acumula con ganador ni gol — es independiente.</p>
      </div>
      <div class="point-card blue">
        <div class="point-card-header">
          <div><span style="font-size:16pt">✅</span><span class="point-card-title">Ganador Acertado</span></div>
          <span class="point-card-pts">2</span>
        </div>
        <p>Acertaste quién ganó o que terminaría en empate, aunque los goles no coincidan exactamente.</p>
        <div class="point-card-example">Predijiste <strong>2-0</strong> y el resultado fue <strong>3-1</strong> → ganador correcto → 2 pts</div>
      </div>
      <div class="point-card purple">
        <div class="point-card-header">
          <div><span style="font-size:16pt">⚽</span><span class="point-card-title">Gol Acertado</span></div>
          <span class="point-card-pts">1</span>
        </div>
        <p>Al menos uno de los dos marcadores (local <em>o</em> visitante) coincide exactamente con el resultado real.</p>
        <div class="point-card-example">Predijiste <strong>1-2</strong> y el resultado fue <strong>1-0</strong> → el gol local coincide → 1 pt</div>
      </div>
      <div class="point-card amber">
        <div class="point-card-header">
          <div><span style="font-size:16pt">⭐</span><span class="point-card-title">Predicción Única</span></div>
          <span class="point-card-pts">+5</span>
        </div>
        <p>Si acertaste el marcador exacto <strong>y eres el único jugador de la liga</strong> que predijo ese marcador, recibes 5 puntos extra automáticamente.</p>
        <div class="point-card-example">Solo tú predijiste <strong>2-1</strong> y terminó <strong>2-1</strong> → 5 base + 5 único = <strong>10 pts</strong></div>
      </div>
    </div>

    <div class="point-card teal" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:13pt">⚡</span>
        <span class="point-card-title">Combinaciones Aditivas (Ganador + Gol)</span>
      </div>
      <p>Ganador y gol se <strong>suman</strong>. Puedes obtener hasta 3 puntos combinados por partido (sin contar marcador exacto).</p>
      <ul class="combos" style="margin-top:8px">
        <li class="combo-row"><span>Ganador + gol acertado</span><div class="combo-right"><span class="combo-detail">2 + 1</span><span class="combo-total" style="color:#0d9488">3 pts</span></div></li>
        <li class="combo-row"><span>Solo ganador acertado</span><div class="combo-right"><span class="combo-detail">2 + 0</span><span class="combo-total" style="color:#1d4ed8">2 pts</span></div></li>
        <li class="combo-row"><span>Solo gol acertado</span><div class="combo-right"><span class="combo-detail">0 + 1</span><span class="combo-total" style="color:#7c3aed">1 pt</span></div></li>
        <li class="combo-row"><span>Ninguno acertado</span><div class="combo-right"><span class="combo-detail">—</span><span class="combo-total" style="color:#94a3b8">0 pts</span></div></li>
      </ul>
    </div>

    <div class="point-card" style="margin-bottom:12px;border-color:#bae6fd;background:#f0f9ff">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16pt">🔥</span>
          <span class="point-card-title" style="color:#0c4a6e">Multiplicador Eliminatorias</span>
        </div>
        <span class="point-card-pts" style="color:#0369a1">×1.5</span>
      </div>
      <p style="color:#0369a1">En rondas finales, los puntos de marcador, ganador y gol se multiplican por <strong>1.5</strong>. No aplica en fase de grupos.</p>
      <div class="point-card-example" style="background:#e0f2fe;color:#0369a1">Predijiste <strong>0-1</strong> en dieciseisavos y terminó <strong>0-1</strong> → 5 pts × 1.5 = <strong>7.5 pts</strong></div>
      <p class="point-card-warning" style="color:#0284c7">El bono de predicción única (+5) se suma después, sin multiplicar.</p>
    </div>

    <div class="point-card slate">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16pt">🏆</span>
        <span class="point-card-title">Bono Clasificados por Fase</span>
      </div>
      <p>En cada partido de eliminatoria, elige qué equipo clasifica a la siguiente ronda. Si <strong>aciertas todos los picks de una fase completa</strong>, recibes el bono de esa fase.</p>
      <div class="bonus-grid">
        ${phaseBonusCards}
      </div>
    </div>
  </div>

  <!-- SECCIÓN 3: EJEMPLOS -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">3</div>
      <span class="section-title">Ejemplos de Puntuación</span>
    </div>

    <div class="example-block">
      <div class="example-header">
        <span>🇺🇾 Uruguay vs Francia 🇫🇷</span>
        <span class="example-badge">Fase de Grupos</span>
      </div>
      <div class="example-result"><strong>Marcador real: Uruguay 2 – 0 Francia</strong></div>
      <table class="example-table">
        <thead><tr><th>Usuario</th><th>Predicción</th><th>Puntaje</th><th>Explicación</th></tr></thead>
        <tbody>
          <tr><td>Valderrama</td><td class="pred-cell">3-1</td><td class="pts-cell pts-blue">2</td><td>Acertó el ganador del partido</td></tr>
          <tr><td>Zidane</td><td class="pred-cell">1-0</td><td class="pts-cell pts-blue">3</td><td>Acertó el ganador y el número de goles de un equipo</td></tr>
          <tr><td>Pelé</td><td class="pred-cell">0-0</td><td class="pts-cell pts-purple">1</td><td>Acertó el número de goles de un equipo</td></tr>
          <tr><td>Baggio</td><td class="pred-cell">1-2</td><td class="pts-cell" style="color:#94a3b8">0</td><td>Ningún acierto</td></tr>
          <tr class="highlight"><td>Francescoli</td><td class="pred-cell">2-0</td><td class="pts-cell pts-lime">5</td><td>Acertó el Marcador Exacto</td></tr>
          <tr class="highlight"><td>Batistuta</td><td class="pred-cell">2-0</td><td class="pts-cell pts-lime">5</td><td>Acertó el Marcador Exacto</td></tr>
        </tbody>
      </table>
    </div>

    <div class="example-block">
      <div class="example-header">
        <span>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra vs Portugal 🇵🇹</span>
        <span class="example-badge">Fase de Grupos</span>
      </div>
      <div class="example-result"><strong>Marcador real: Inglaterra 1 – 3 Portugal</strong></div>
      <table class="example-table">
        <thead><tr><th>Usuario</th><th>Predicción</th><th>Puntaje</th><th>Explicación</th></tr></thead>
        <tbody>
          <tr><td>Valderrama</td><td class="pred-cell">3-1</td><td class="pts-cell" style="color:#94a3b8">0</td><td>Ningún acierto</td></tr>
          <tr><td>Zidane</td><td class="pred-cell">1-0</td><td class="pts-cell pts-purple">1</td><td>Acertó el número de goles de un equipo</td></tr>
          <tr class="highlight"><td>Pelé</td><td class="pred-cell">1-3</td><td class="pts-cell pts-amber">10</td><td>Marcador exacto y predicción única (5+5)</td></tr>
          <tr><td>Baggio</td><td class="pred-cell">2-2</td><td class="pts-cell" style="color:#94a3b8">0</td><td>Ningún acierto</td></tr>
          <tr><td>Francescoli</td><td class="pred-cell">2-0</td><td class="pts-cell" style="color:#94a3b8">0</td><td>Ningún acierto</td></tr>
          <tr><td>Batistuta</td><td class="pred-cell">1-2</td><td class="pts-cell pts-blue">3</td><td>Acertó el ganador y el número de goles de un equipo</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- SECCIÓN 4: DESEMPATE -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">4</div>
      <span class="section-title">Tabla de Posiciones — Criterios de Desempate</span>
    </div>
    <p style="font-size:9pt;color:#475569;margin-bottom:12px;line-height:1.6">
      Cuando dos jugadores tienen los mismos puntos, el ranking se decide con estos criterios <strong>en orden</strong>. <strong>No es posible modificar los criterios de desempate.</strong>
    </p>
    <ol class="tiebreak-list">
      <li class="tiebreak-item"><div class="tiebreak-num">1</div><span class="tiebreak-icon">🏅</span><div class="tiebreak-text"><strong>Mayor puntaje total</strong><p>El que más puntos acumuló durante el torneo.</p></div></li>
      <li class="tiebreak-item"><div class="tiebreak-num">2</div><span class="tiebreak-icon">🏆</span><div class="tiebreak-text"><strong>Campeón acertado</strong><p>El usuario que haya acertado el campeón del torneo gana la posición.</p></div></li>
      <li class="tiebreak-item"><div class="tiebreak-num">3</div><span class="tiebreak-icon">🎯</span><div class="tiebreak-text"><strong>Más marcadores exactos</strong><p>Cantidad de veces que acertaste el resultado completo.</p></div></li>
      <li class="tiebreak-item"><div class="tiebreak-num">4</div><span class="tiebreak-icon">✅</span><div class="tiebreak-text"><strong>Más ganadores acertados</strong><p>Cuántos ganadores o empates predijiste correctamente.</p></div></li>
      <li class="tiebreak-item"><div class="tiebreak-num">5</div><span class="tiebreak-icon">⚽</span><div class="tiebreak-text"><strong>Más goles acertados</strong><p>Cuántos marcadores individuales coincidieron con el resultado real.</p></div></li>
      <li class="tiebreak-item"><div class="tiebreak-num">6</div><span class="tiebreak-icon">⭐</span><div class="tiebreak-text"><strong>Más predicciones únicas</strong><p>Cuántas veces fuiste el único participante con ese marcador exacto.</p></div></li>
    </ol>
  </div>

  <!-- SECCIÓN 5: ADMINISTRACIÓN -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">5</div>
      <span class="section-title">Administración de Grupos</span>
    </div>
    <p style="font-size:9pt;color:#475569;margin-bottom:12px;line-height:1.6">
      El administrador del grupo tendrá acceso a un módulo exclusivo donde podrá:
    </p>
    <div class="admin-grid">
      <div class="admin-card"><div class="admin-card-title">⚙️ Modificar Reglas</div><p>Podrá modificar las reglas del grupo para el próximo cálculo de puntos.</p></div>
      <div class="admin-card"><div class="admin-card-title">👥 Gestionar Usuarios</div><p>Podrá aceptar y rechazar miembros. No se recalcularán los puntajes bajo ninguna circunstancia.</p></div>
      <div class="admin-card"><div class="admin-card-title">💰 Registro de Pagos</div><p>Si el grupo apuesta dinero, podrás registrar los pagos en la plataforma.</p></div>
      <div class="admin-card"><div class="admin-card-title">↩️ Devolución de Pago</div><p>Si un miembro pide la baja, podrás registrar la devolución del dinero.</p></div>
    </div>
  </div>

  <!-- SECCIÓN 6: FAQ -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">6</div>
      <span class="section-title">Preguntas Frecuentes</span>
    </div>
    <div class="faq-item"><div class="faq-q">¿Cuántas veces puedo modificar mi predicción?</div><div class="faq-a">Puedes modificar las veces que desees tus predicciones hasta <strong>15 minutos antes</strong> de que inicie el partido.</div></div>
    <div class="faq-item"><div class="faq-q">¿Cuánto tiempo debo esperar para que se actualice la tabla de posiciones?</div><div class="faq-a">Esperamos actualizar la tabla en el menor tiempo posible. Definimos un tiempo máximo de <strong>60 minutos</strong> para ver los cambios.</div></div>
    <div class="faq-item"><div class="faq-q">¿Por qué en fases eliminatorias aparece NA?</div><div class="faq-a">Porque todavía no se conocen los equipos que van a jugar ese partido. A medida que avance el torneo aparecerán los equipos confirmados.</div></div>
    <div class="faq-item"><div class="faq-q">¿Puedo realizar todas las predicciones antes de iniciar el torneo?</div><div class="faq-a">Sí, puedes realizar y guardar las predicciones de todos los partidos, incluso de aquellos donde aún se desconocen los equipos.</div></div>
    <div class="faq-item"><div class="faq-q">¿Por qué no puedo ver las predicciones de otros participantes?</div><div class="faq-a">Las predicciones son secretas hasta que se cierre la apuesta del partido. Esto evita que alguien copie las predicciones de otros.</div></div>
  </div>

  <!-- FOOTER -->
  <div class="pdf-footer">
    <span>Polla Mundial ${year} — <strong>${orgName}</strong></span>
    <span>Guía Oficial del Participante</span>
  </div>

</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para descargar el PDF.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}

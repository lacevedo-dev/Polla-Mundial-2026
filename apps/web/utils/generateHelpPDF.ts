export function generateHelpPDF(): void {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guía Oficial Polla Mundial 2026</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Tipografía ── */
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      background: #fff;
      line-height: 1.5;
    }

    /* ── Layout ── */
    .page {
      max-width: 750px;
      margin: 0 auto;
      padding: 28px 32px 40px;
    }

    /* ── Portada ── */
    .cover {
      background: #0f172a;
      color: #fff;
      border-radius: 16px;
      padding: 40px 36px 36px;
      margin-bottom: 28px;
      position: relative;
      overflow: hidden;
    }
    .cover-badge {
      display: inline-block;
      background: #a3e635;
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
      font-size: 32pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 12px;
    }
    .cover h1 span { color: #a3e635; }
    .cover-sub {
      color: #94a3b8;
      font-size: 10pt;
      max-width: 480px;
      line-height: 1.6;
    }
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
    .cover-footer strong { color: #a3e635; }

    /* ── Secciones ── */
    .section {
      margin-bottom: 28px;
      break-inside: avoid;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f1f5f9;
    }
    .section-number {
      width: 24px;
      height: 24px;
      background: #0f172a;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      font-weight: 900;
      flex-shrink: 0;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #0f172a;
    }

    /* ── Tarjetas de puntos ── */
    .points-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .point-card {
      border-radius: 12px;
      padding: 12px 14px;
      break-inside: avoid;
    }
    .point-card.lime   { background: #f7fee7; border: 1.5px solid #bef264; }
    .point-card.blue   { background: #eff6ff; border: 1.5px solid #bfdbfe; }
    .point-card.purple { background: #faf5ff; border: 1.5px solid #e9d5ff; }
    .point-card.amber  { background: #fffbeb; border: 1.5px solid #fde68a; }
    .point-card.teal   { background: #f0fdfa; border: 1.5px solid #99f6e4; }
    .point-card.slate  { background: #f8fafc; border: 1.5px solid #e2e8f0; }

    .point-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .point-card-title {
      font-size: 9pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .point-card.lime   .point-card-title { color: #3f6212; }
    .point-card.blue   .point-card-title { color: #1e40af; }
    .point-card.purple .point-card-title { color: #6b21a8; }
    .point-card.amber  .point-card-title { color: #92400e; }
    .point-card.teal   .point-card-title { color: #134e4a; }
    .point-card.slate  .point-card-title { color: #1e293b; }

    .point-card-pts {
      font-size: 20pt;
      font-weight: 900;
      line-height: 1;
    }
    .point-card.lime   .point-card-pts { color: #4d7c0f; }
    .point-card.blue   .point-card-pts { color: #1d4ed8; }
    .point-card.purple .point-card-pts { color: #7c3aed; }
    .point-card.amber  .point-card-pts { color: #b45309; }

    .point-card p {
      font-size: 8.5pt;
      line-height: 1.5;
    }
    .point-card.lime   p { color: #365314; }
    .point-card.blue   p { color: #1e3a8a; }
    .point-card.purple p { color: #4c1d95; }
    .point-card.amber  p { color: #78350f; }
    .point-card.teal   p { color: #134e4a; }
    .point-card.slate  p { color: #475569; }

    .point-card-example {
      margin-top: 6px;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 8pt;
      font-style: italic;
    }
    .point-card.lime   .point-card-example { background: #d9f99d; color: #365314; }
    .point-card.blue   .point-card-example { background: #dbeafe; color: #1e3a8a; }
    .point-card.purple .point-card-example { background: #ede9fe; color: #4c1d95; }
    .point-card.amber  .point-card-example { background: #fef3c7; color: #78350f; }

    .point-card-warning {
      margin-top: 5px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .point-card.lime .point-card-warning { color: #4d7c0f; }

    /* ── Tabla de resumen de puntos ── */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
    }
    .summary-table th {
      background: #0f172a;
      color: #fff;
      padding: 7px 10px;
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .summary-table th:last-child { text-align: center; }
    .summary-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
    }
    .summary-table td:last-child {
      text-align: center;
      font-weight: 900;
      font-size: 11pt;
    }
    .summary-table tr:nth-child(even) td { background: #f8fafc; }
    .pts-lime   { color: #4d7c0f; }
    .pts-blue   { color: #1d4ed8; }
    .pts-purple { color: #7c3aed; }
    .pts-amber  { color: #b45309; }
    .pts-slate  { color: #475569; }

    /* ── Tabla de ejemplos ── */
    .example-block {
      margin-bottom: 18px;
      break-inside: avoid;
    }
    .example-header {
      background: #0f172a;
      color: #fff;
      padding: 8px 14px;
      border-radius: 10px 10px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .example-header span {
      font-size: 9pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .example-badge {
      background: #a3e635;
      color: #000;
      font-size: 7pt;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      letter-spacing: 0.1em;
    }
    .example-result {
      background: #1e293b;
      color: #94a3b8;
      font-size: 8.5pt;
      padding: 5px 14px;
      font-weight: 600;
    }
    .example-result strong { color: #a3e635; }
    .example-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .example-table th {
      background: #f8fafc;
      color: #64748b;
      padding: 5px 10px;
      text-align: left;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #e2e8f0;
    }
    .example-table th:nth-child(3),
    .example-table th:nth-child(4) { text-align: center; }
    .example-table td {
      padding: 5px 10px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .example-table td:nth-child(3),
    .example-table td:nth-child(4) { text-align: center; }
    .example-table tr.highlight td { background: #f7fee7; }
    .example-table tr.highlight .pts-cell { color: #4d7c0f; font-weight: 900; }
    .pts-cell { font-weight: 900; font-size: 10pt; }
    .pred-cell { font-family: monospace; font-weight: 700; }

    /* ── Desempate ── */
    .tiebreak-list {
      list-style: none;
    }
    .tiebreak-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      margin-bottom: 6px;
      break-inside: avoid;
    }
    .tiebreak-num {
      width: 20px;
      height: 20px;
      background: #e2e8f0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: 900;
      color: #475569;
      flex-shrink: 0;
    }
    .tiebreak-icon { font-size: 14pt; flex-shrink: 0; line-height: 1.2; }
    .tiebreak-text { flex: 1; min-width: 0; }
    .tiebreak-text strong {
      display: block;
      font-size: 9pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f172a;
      margin-bottom: 1px;
    }
    .tiebreak-text p { font-size: 8.5pt; color: #64748b; line-height: 1.4; }

    /* ── Bonos ── */
    .bonus-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .bonus-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      text-align: center;
    }
    .bonus-card .bonus-icon { font-size: 14pt; }
    .bonus-card .bonus-phase {
      font-size: 8pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      margin-top: 3px;
    }
    .bonus-card .bonus-sub { font-size: 7.5pt; color: #94a3b8; }
    .bonus-card .bonus-pts {
      font-size: 14pt;
      font-weight: 900;
      color: #4d7c0f;
      line-height: 1;
      margin-top: 2px;
    }

    /* ── Info box ── */
    .info-box {
      background: #0f172a;
      color: #fff;
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 10px;
    }
    .info-box h3 {
      font-size: 12pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #a3e635;
      margin-bottom: 6px;
    }
    .info-box p { color: #94a3b8; font-size: 9pt; line-height: 1.6; }
    .info-box ul { padding-left: 18px; margin-top: 8px; }
    .info-box ul li { color: #cbd5e1; font-size: 9pt; margin-bottom: 4px; }

    /* ── FAQ ── */
    .faq-item {
      margin-bottom: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 10px;
      border-left: 3px solid #a3e635;
      break-inside: avoid;
    }
    .faq-q {
      font-size: 9.5pt;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .faq-a { font-size: 9pt; color: #475569; line-height: 1.6; }

    /* ── Admin features ── */
    .admin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .admin-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .admin-card-title {
      font-size: 9pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f172a;
      margin-bottom: 3px;
    }
    .admin-card p { font-size: 8.5pt; color: #64748b; line-height: 1.4; }

    /* ── Combinaciones aditivas ── */
    .combos {
      list-style: none;
    }
    .combo-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 9pt;
    }
    .combo-row:last-child { border-bottom: none; }
    .combo-right { display: flex; align-items: center; gap: 8px; }
    .combo-detail { font-size: 8pt; color: #94a3b8; }
    .combo-total { font-weight: 900; font-size: 10pt; }

    /* ── Bono explicación ── */
    .bono-note {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 8.5pt;
      color: #78350f;
      margin-top: 8px;
      line-height: 1.5;
    }

    /* ── Octavos table (4 cols) ── */
    .example-table.four-col th:nth-child(3),
    .example-table.four-col th:nth-child(4),
    .example-table.four-col th:nth-child(5) { text-align: center; }
    .example-table.four-col td:nth-child(3),
    .example-table.four-col td:nth-child(4),
    .example-table.four-col td:nth-child(5) { text-align: center; }

    /* ── Footer ── */
    .pdf-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #94a3b8;
    }
    .pdf-footer a { color: #4d7c0f; font-weight: 700; text-decoration: none; }

    /* ── Print ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .page { padding: 10px 16px; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- PORTADA -->
  <div class="cover">
    <div class="cover-badge">Guía Oficial 2026</div>
    <h1>DOMINA TU <span>ESTRATEGIA.</span></h1>
    <p class="cover-sub">
      Guía completa del sistema de puntuación, reglas de predicción, bonos, criterios de desempate y administración de grupos para la Polla del Mundial 2026.
    </p>
    <div class="cover-footer">
      <span>polla.agildesarrollo.com.co</span>
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
      <p>El usuario puede realizar y cambiar sus predicciones hasta <strong>15 minutos antes de iniciar el partido</strong>, momento en el cual el sistema no permitirá modificar la predicción para ese partido. Realiza las predicciones con tiempo. Se usa la hora del sistema.</p>
      <ul>
        <li>Si el jugador no realiza la predicción para un partido, no se sumarán puntos.</li>
        <li>En fases de octavos, cuartos, etc., el usuario podrá seleccionar el equipo que clasificará a la siguiente ronda. Esta selección solo influye en los bonos que serán entregados en cada fase.</li>
      </ul>
    </div>
  </div>

  <!-- SECCIÓN 2: SISTEMA DE PUNTUACIÓN -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">2</div>
      <span class="section-title">Sistema de Puntuación</span>
    </div>

    <!-- Tabla resumen -->
    <table class="summary-table">
      <thead>
        <tr>
          <th>Regla</th>
          <th>Descripción</th>
          <th>Puntaje</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>🎯 Marcador Exacto</strong></td>
          <td>Aciertas exactamente el marcador del partido</td>
          <td class="pts-lime">5</td>
        </tr>
        <tr>
          <td><strong>✅ Ganador Acertado</strong></td>
          <td>Aciertas el ganador o el empate (sin marcador exacto)</td>
          <td class="pts-blue">2</td>
        </tr>
        <tr>
          <td><strong>⚽ Gol Acertado</strong></td>
          <td>Aciertas el número de goles de uno de los equipos</td>
          <td class="pts-purple">1</td>
        </tr>
        <tr>
          <td><strong>⭐ Predicción Única</strong></td>
          <td>Fuiste el único que acertó el marcador exacto dentro del grupo</td>
          <td class="pts-amber">+5</td>
        </tr>
        <tr>
          <td><strong>🥈 Bono Octavos</strong></td>
          <td>Aciertas todos los equipos clasificados a cuartos</td>
          <td class="pts-slate">8</td>
        </tr>
        <tr>
          <td><strong>🥉 Bono Cuartos</strong></td>
          <td>Aciertas todos los equipos clasificados a semifinal</td>
          <td class="pts-slate">4</td>
        </tr>
        <tr>
          <td><strong>🏅 Bono Semifinal</strong></td>
          <td>Aciertas todos los equipos clasificados a la final</td>
          <td class="pts-slate">2</td>
        </tr>
        <tr>
          <td><strong>🏆 Bono Final / Campeón</strong></td>
          <td>Aciertas el campeón del torneo</td>
          <td class="pts-lime">5</td>
        </tr>
      </tbody>
    </table>

    <!-- Tarjetas detalle -->
    <div class="points-grid">
      <div class="point-card lime">
        <div class="point-card-header">
          <div>
            <span style="font-size:16pt">🎯</span>
            <span class="point-card-title">Marcador Exacto</span>
          </div>
          <span class="point-card-pts">5</span>
        </div>
        <p>Predijiste los goles de ambos equipos con exactitud. Es la mayor puntuación posible por partido.</p>
        <div class="point-card-example">Predijiste <strong>2-1</strong> y el partido terminó <strong>2-1</strong> → 5 pts</div>
        <p class="point-card-warning">⚠️ No se acumula con ganador ni gol — es independiente.</p>
      </div>

      <div class="point-card blue">
        <div class="point-card-header">
          <div>
            <span style="font-size:16pt">✅</span>
            <span class="point-card-title">Ganador Acertado</span>
          </div>
          <span class="point-card-pts">2</span>
        </div>
        <p>Acertaste quién ganó el partido o que terminaría en empate, aunque los goles no coincidan exactamente.</p>
        <div class="point-card-example">Predijiste <strong>2-0</strong> y el resultado fue <strong>3-1</strong> → ganador correcto → 2 pts</div>
      </div>

      <div class="point-card purple">
        <div class="point-card-header">
          <div>
            <span style="font-size:16pt">⚽</span>
            <span class="point-card-title">Gol Acertado</span>
          </div>
          <span class="point-card-pts">1</span>
        </div>
        <p>Al menos uno de los dos marcadores (local <em>o</em> visitante) coincide exactamente con el resultado real.</p>
        <div class="point-card-example">Predijiste <strong>1-2</strong> y el resultado fue <strong>1-0</strong> → el gol local (1) coincide → 1 pt</div>
      </div>

      <div class="point-card amber">
        <div class="point-card-header">
          <div>
            <span style="font-size:16pt">⭐</span>
            <span class="point-card-title">Predicción Única</span>
          </div>
          <span class="point-card-pts">+5</span>
        </div>
        <p>Si acertaste el marcador exacto <strong>y eres el único jugador de la liga</strong> que predijo ese marcador, recibes 5 puntos extra automáticamente.</p>
        <div class="point-card-example">Solo tú predijiste <strong>2-1</strong> y terminó <strong>2-1</strong> → 5 base + 5 único = <strong>10 pts</strong></div>
      </div>
    </div>

    <!-- Combinaciones aditivas -->
    <div class="point-card teal" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:13pt">⚡</span>
        <span class="point-card-title">Combinaciones Aditivas (Ganador + Gol)</span>
      </div>
      <p>Ganador y gol se <strong>suman</strong>. Puedes obtener hasta 3 puntos combinados por partido (sin contar marcador exacto).</p>
      <ul class="combos" style="margin-top:8px">
        <li class="combo-row">
          <span>Ganador + gol acertado</span>
          <div class="combo-right"><span class="combo-detail">2 + 1</span><span class="combo-total" style="color:#0d9488">3 pts</span></div>
        </li>
        <li class="combo-row">
          <span>Solo ganador acertado</span>
          <div class="combo-right"><span class="combo-detail">2 + 0</span><span class="combo-total" style="color:#1d4ed8">2 pts</span></div>
        </li>
        <li class="combo-row">
          <span>Solo gol acertado</span>
          <div class="combo-right"><span class="combo-detail">0 + 1</span><span class="combo-total" style="color:#7c3aed">1 pt</span></div>
        </li>
        <li class="combo-row">
          <span>Ninguno acertado</span>
          <div class="combo-right"><span class="combo-detail">—</span><span class="combo-total" style="color:#94a3b8">0 pts</span></div>
        </li>
      </ul>
    </div>

    <!-- Bonos clasificados -->
    <div class="point-card slate">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16pt">🏆</span>
        <span class="point-card-title">Bono Clasificados por Fase</span>
      </div>
      <p>En cada partido de eliminatoria, elige qué equipo clasifica a la siguiente ronda. Si <strong>aciertas todos los picks de una fase completa</strong>, recibes el bono de esa fase. Si fallas aunque sea uno, no obtienes el bono de esa ronda.</p>
      <div class="bonus-grid">
        <div class="bonus-card">
          <div class="bonus-icon">🥈</div>
          <div class="bonus-phase">Octavos</div>
          <div class="bonus-sub">16 → 8</div>
          <div class="bonus-pts">8 pts</div>
        </div>
        <div class="bonus-card">
          <div class="bonus-icon">🥉</div>
          <div class="bonus-phase">Cuartos</div>
          <div class="bonus-sub">8 → 4</div>
          <div class="bonus-pts">4 pts</div>
        </div>
        <div class="bonus-card">
          <div class="bonus-icon">🏅</div>
          <div class="bonus-phase">Semifinal</div>
          <div class="bonus-sub">4 → 2</div>
          <div class="bonus-pts">2 pts</div>
        </div>
        <div class="bonus-card">
          <div class="bonus-icon">🏆</div>
          <div class="bonus-phase">Campeón</div>
          <div class="bonus-sub">El ganador</div>
          <div class="bonus-pts">5 pts</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 3: EJEMPLOS DE PUNTUACIÓN -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">3</div>
      <span class="section-title">Ejemplos de Puntuación</span>
    </div>

    <!-- Ejemplo 1 -->
    <div class="example-block">
      <div class="example-header">
        <span>🇺🇾 Uruguay vs Francia 🇫🇷</span>
        <span class="example-badge">Fase de Grupos</span>
      </div>
      <div class="example-result"><strong>Marcador real: Uruguay 2 – 0 Francia</strong></div>
      <table class="example-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Predicción</th>
            <th>Puntaje</th>
            <th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valderrama</td>
            <td class="pred-cell">3-1</td>
            <td class="pts-cell pts-blue">2</td>
            <td>Acertó el ganador del partido</td>
          </tr>
          <tr>
            <td>Zidane</td>
            <td class="pred-cell">1-0</td>
            <td class="pts-cell pts-blue">3</td>
            <td>Acertó el ganador y el número de goles de un equipo</td>
          </tr>
          <tr>
            <td>Pelé</td>
            <td class="pred-cell">0-0</td>
            <td class="pts-cell pts-purple">1</td>
            <td>Acertó el número de goles de un equipo</td>
          </tr>
          <tr>
            <td>Baggio</td>
            <td class="pred-cell">1-2</td>
            <td class="pts-cell" style="color:#94a3b8">0</td>
            <td>Ningún acierto</td>
          </tr>
          <tr class="highlight">
            <td>Francescoli</td>
            <td class="pred-cell">2-0</td>
            <td class="pts-cell pts-lime">5</td>
            <td>Acertó el Marcador Exacto</td>
          </tr>
          <tr class="highlight">
            <td>Batistuta</td>
            <td class="pred-cell">2-0</td>
            <td class="pts-cell pts-lime">5</td>
            <td>Acertó el Marcador Exacto</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ejemplo 2 -->
    <div class="example-block">
      <div class="example-header">
        <span>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra vs Portugal 🇵🇹</span>
        <span class="example-badge">Fase de Grupos</span>
      </div>
      <div class="example-result"><strong>Marcador real: Inglaterra 1 – 3 Portugal</strong></div>
      <table class="example-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Predicción</th>
            <th>Puntaje</th>
            <th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valderrama</td>
            <td class="pred-cell">3-1</td>
            <td class="pts-cell" style="color:#94a3b8">0</td>
            <td>Ningún acierto</td>
          </tr>
          <tr>
            <td>Zidane</td>
            <td class="pred-cell">1-0</td>
            <td class="pts-cell pts-purple">1</td>
            <td>Acertó el número de goles de un equipo</td>
          </tr>
          <tr class="highlight">
            <td>Pelé</td>
            <td class="pred-cell">1-3</td>
            <td class="pts-cell pts-amber">10</td>
            <td>Acertó el marcador exacto y fue predicción única (5+5)</td>
          </tr>
          <tr>
            <td>Baggio</td>
            <td class="pred-cell">2-2</td>
            <td class="pts-cell" style="color:#94a3b8">0</td>
            <td>Ningún acierto</td>
          </tr>
          <tr>
            <td>Francescoli</td>
            <td class="pred-cell">2-0</td>
            <td class="pts-cell" style="color:#94a3b8">0</td>
            <td>Ningún acierto</td>
          </tr>
          <tr>
            <td>Batistuta</td>
            <td class="pred-cell">1-2</td>
            <td class="pts-cell pts-blue">3</td>
            <td>Acertó el ganador y el número de goles de un equipo</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ejemplo 3: Octavos -->
    <div class="example-block">
      <div class="example-header">
        <span>🇨🇷 Costa Rica vs México 🇲🇽</span>
        <span class="example-badge">Octavos de Final</span>
      </div>
      <div class="example-result"><strong>Marcador real (120 min): Costa Rica 0 – 0 México · Clasificado: Costa Rica</strong></div>
      <table class="example-table four-col">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Predicción</th>
            <th>Clasificado</th>
            <th>Puntaje</th>
            <th>Explicación</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valderrama</td>
            <td class="pred-cell">1-1</td>
            <td>México</td>
            <td class="pts-cell pts-blue">2</td>
            <td>Acertó el empate (Ganador Acertado). No acierta clasificado</td>
          </tr>
          <tr class="highlight">
            <td>Zidane</td>
            <td class="pred-cell">0-0</td>
            <td>México</td>
            <td class="pts-cell pts-amber">10</td>
            <td>Acertó marcador exacto y fue predicción única. No acierta clasificado</td>
          </tr>
          <tr>
            <td>Pelé</td>
            <td class="pred-cell">1-0</td>
            <td>Costa Rica</td>
            <td class="pts-cell pts-purple">1</td>
            <td>Acertó el número de goles de un equipo. Acierta clasificado</td>
          </tr>
          <tr>
            <td>Baggio</td>
            <td class="pred-cell">1-1</td>
            <td>Costa Rica</td>
            <td class="pts-cell pts-blue">2</td>
            <td>Acertó el empate (Ganador Acertado). Acierta clasificado</td>
          </tr>
          <tr>
            <td>Francescoli</td>
            <td class="pred-cell">0-2</td>
            <td>México</td>
            <td class="pts-cell pts-purple">1</td>
            <td>Acertó el número de goles de un equipo. No acierta clasificado</td>
          </tr>
          <tr>
            <td>Batistuta</td>
            <td class="pred-cell">3-2</td>
            <td>Costa Rica</td>
            <td class="pts-cell" style="color:#94a3b8">0</td>
            <td>Ningún acierto. Acierta clasificado</td>
          </tr>
        </tbody>
      </table>
      <div class="bono-note">
        <strong>Bono Octavos:</strong> Pelé, Baggio y Batistuta han acertado 1 equipo clasificado en octavos de final. Si logran acertar los 8 equipos que pasan en esta fase, se sumará el bono de 8 puntos. La misma filosofía aplica para cuartos, semifinal y final.
      </div>
    </div>
  </div>

  <!-- SECCIÓN 4: CRITERIOS DE DESEMPATE -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">4</div>
      <span class="section-title">Tabla de Posiciones — Criterios de Desempate</span>
    </div>
    <p style="font-size:9pt;color:#475569;margin-bottom:12px;line-height:1.6">
      Cuando dos jugadores tienen los mismos puntos, el ranking se decide con estos criterios <strong>en orden</strong> — se avanza al siguiente solo si persiste el empate. Si al finalizar todos los criterios todavía persiste el empate, los jugadores se ubicarán en la misma posición. <strong>No es posible modificar los criterios de desempate.</strong>
    </p>
    <ol class="tiebreak-list">
      <li class="tiebreak-item">
        <div class="tiebreak-num">1</div>
        <span class="tiebreak-icon">🏅</span>
        <div class="tiebreak-text">
          <strong>Mayor puntaje total</strong>
          <p>El que más puntos acumuló durante el torneo.</p>
        </div>
      </li>
      <li class="tiebreak-item">
        <div class="tiebreak-num">2</div>
        <span class="tiebreak-icon">🏆</span>
        <div class="tiebreak-text">
          <strong>Campeón acertado</strong>
          <p>El usuario que haya acertado el campeón del torneo ganará la posición.</p>
        </div>
      </li>
      <li class="tiebreak-item">
        <div class="tiebreak-num">3</div>
        <span class="tiebreak-icon">🎯</span>
        <div class="tiebreak-text">
          <strong>Más marcadores exactos</strong>
          <p>Cantidad de veces que acertaste el resultado completo (ambos goles).</p>
        </div>
      </li>
      <li class="tiebreak-item">
        <div class="tiebreak-num">4</div>
        <span class="tiebreak-icon">✅</span>
        <div class="tiebreak-text">
          <strong>Más ganadores acertados</strong>
          <p>Cuántos ganadores o empates predijiste correctamente.</p>
        </div>
      </li>
      <li class="tiebreak-item">
        <div class="tiebreak-num">5</div>
        <span class="tiebreak-icon">⚽</span>
        <div class="tiebreak-text">
          <strong>Más goles acertados</strong>
          <p>Cuántos marcadores individuales coincidieron con el resultado real.</p>
        </div>
      </li>
      <li class="tiebreak-item">
        <div class="tiebreak-num">6</div>
        <span class="tiebreak-icon">⭐</span>
        <div class="tiebreak-text">
          <strong>Más predicciones únicas</strong>
          <p>Cuántas veces fuiste el único participante con ese marcador exacto.</p>
        </div>
      </li>
    </ol>
  </div>

  <!-- SECCIÓN 5: APUESTAS -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">5</div>
      <span class="section-title">Apuestas</span>
    </div>
    <div class="info-box">
      <h3>Dinero y Premios</h3>
      <p>El administrador del grupo es el encargado de recoger el dinero y de entregar los premios. La plataforma registra los pagos, pero la entrega del premio es responsabilidad del administrador.</p>
    </div>
  </div>

  <!-- SECCIÓN 6: ADMINISTRACIÓN DE GRUPOS -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">6</div>
      <span class="section-title">Administración de Grupos</span>
    </div>
    <p style="font-size:9pt;color:#475569;margin-bottom:12px;line-height:1.6">
      El creador del grupo tendrá acceso a un módulo exclusivo de administración donde podrá:
    </p>
    <div class="admin-grid">
      <div class="admin-card">
        <div class="admin-card-title">⚙️ Modificar Reglas</div>
        <p>Podrá modificar las reglas del grupo, las cuales se tendrán en cuenta para el próximo cálculo de puntos.</p>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">👥 Gestionar Usuarios</div>
        <p>El administrador podrá aceptar y rechazar usuarios. Usuarios rechazados no podrán ser aceptados nuevamente. No se recalcularán los puntajes del grupo bajo ninguna circunstancia.</p>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">💰 Registro de Pagos</div>
        <p>Si con tus amigos vas a apostar dinero, podrás registrar sus pagos en la página. Una vez registres el pago, el acumulado de tu grupo se incrementará.</p>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">↩️ Devolución de Pago</div>
        <p>Si uno de tus amigos pide la baja del grupo, podrás devolver el dinero y registrar este evento en la página.</p>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 7: PREGUNTAS FRECUENTES -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">7</div>
      <span class="section-title">Preguntas Frecuentes</span>
    </div>

    <div class="faq-item">
      <div class="faq-q">¿Cuántas veces puedo modificar mi predicción?</div>
      <div class="faq-a">Puedes modificar las veces que desees tus predicciones hasta <strong>15 minutos antes</strong> de que inicie el partido.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">¿Cuánto tiempo debo esperar para que se actualice la tabla de posiciones después de un partido?</div>
      <div class="faq-a">Esperamos actualizar la tabla de posiciones en el menor tiempo posible. Sin embargo definimos un tiempo de <strong>60 minutos</strong> para ver los cambios.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">¿Por qué en fases de octavos, cuartos, semifinal, final aparece NA?</div>
      <div class="faq-a">Porque todavía no se conocen los equipos que van a jugar el partido. A medida que avance el torneo, aparecerán los equipos que van a jugar esos partidos. Las predicciones de los usuarios no influyen en la conformación del partido, las apuestas siempre son sobre partidos reales.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">¿Puedo realizar todas las predicciones de los partidos antes de iniciar el torneo?</div>
      <div class="faq-a">Sí, puedes realizar y guardar las predicciones de todos los partidos, incluso de aquellos donde se desconoce los equipos que se enfrentarán.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">¿Por qué no puedo ver los resultados de los otros usuarios de mi grupo?</div>
      <div class="faq-a">Las predicciones serán secretas hasta que se cierre la apuesta; una vez cerrada se podrán ver los resultados. Esto se realiza para evitar que una persona utilice los resultados de otras.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">¿Cómo comparto mi grupo?</div>
      <div class="faq-a">Con el <strong>código asignado a cada grupo</strong> y la dirección del portal <strong>https://polla.agildesarrollo.com.co</strong>.</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="pdf-footer">
    <span>Polla Mundial 2026 — Guía Oficial</span>
    <a href="https://polla.agildesarrollo.com.co">polla.agildesarrollo.com.co</a>
  </div>

</div>

<script>
  window.onload = function() { window.print(); };
</script>
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

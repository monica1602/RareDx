/* ── ArIAdne.Dx Dashboard.js ── */

/* ── Sidebar tab switching ── */
function switchTab(name) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
}

document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    switchTab(link.dataset.tab);
  });
});

/* ── Load symptoms & family conditions ── */
let allSymptomsData = [];
let allDiseasesData = [];

async function initDashboard() {
  await Promise.all([loadSymptomsGrid(), loadFamilyConditions(), loadDiseasesTable()]);
  tryRestoreSession();
}

async function loadSymptomsGrid() {
  try {
    const r = await fetch('/api/symptoms');
    const d = await r.json();
    allSymptomsData = d.symptoms || [];
    renderSymptomsGrid(allSymptomsData);
  } catch (e) {
    document.getElementById('symptoms-grid-dash').innerHTML = '<div class="loading-msg">Erro ao carregar sintomas.</div>';
  }
}

function renderSymptomsGrid(symptoms) {
  const grid = document.getElementById('symptoms-grid-dash');
  if (!grid) return;
  grid.innerHTML = '';
  if (!symptoms.length) {
    grid.innerHTML = '<div class="loading-msg">Nenhum sintoma encontrado.</div>';
    return;
  }
  for (const s of symptoms) {
    const label = document.createElement('label');
    label.className = 'cb-item';
    label.innerHTML = `<input type="checkbox" value="${s.id}" onchange="updateSymptomCount()" /> ${s.label}`;
    grid.appendChild(label);
  }
}

function dashFilterSymptoms(q) {
  const filtered = allSymptomsData.filter(s =>
    s.label.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  );
  renderSymptomsGrid(filtered);
}

function updateSymptomCount() {
  const count = document.querySelectorAll('#symptoms-grid-dash input:checked').length;
  const badge = document.getElementById('d-symptom-count');
  if (badge) badge.textContent = `${count} selecionado${count !== 1 ? 's' : ''}`;
}

async function loadFamilyConditions() {
  try {
    const r = await fetch('/api/diseases');
    const d = await r.json();
    allDiseasesData = d.diseases || [];
    const grid = document.getElementById('family-conditions-dash');
    if (!grid) return;
    grid.innerHTML = '';
    const conditions = new Set();
    for (const disease of allDiseasesData) {
      conditions.add(disease.id);
    }
    for (const id of conditions) {
      const disease = allDiseasesData.find(d => d.id === id);
      if (!disease) continue;
      const label = document.createElement('label');
      label.className = 'cb-item';
      label.innerHTML = `<input type="checkbox" value="${id}" /> ${disease.name}`;
      grid.appendChild(label);
    }
  } catch (e) {
    document.getElementById('family-conditions-dash').innerHTML = '<div class="loading-msg">Erro ao carregar.</div>';
  }
}

async function loadDiseasesTable() {
  try {
    if (!allDiseasesData.length) {
      const r = await fetch('/api/diseases');
      const d = await r.json();
      allDiseasesData = d.diseases || [];
    }
    renderDiseaseTable(allDiseasesData);
  } catch (e) {}
}

function renderDiseaseTable(diseases) {
  const tbody = document.getElementById('disease-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const d of diseases) {
    const rarityClass = d.rarity?.includes('ultra') ? 'rarity-ultra' :
                        d.rarity?.includes('rara') ? 'rarity-rara' : 'rarity-incomum';
    const rarityLabel = d.rarity?.includes('ultra') ? 'Ultra Rara' :
                        d.rarity?.includes('rara') ? 'Rara' : 'Incomum';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td>
      <td style="color:var(--text-muted)">${d.category}</td>
      <td><span class="rarity-badge ${rarityClass}">${rarityLabel}</span></td>
      <td style="color:var(--text-muted)">${d.prevalence || '—'}</td>
      <td style="color:var(--accent);font-size:12px">${d.orphanet_code || '—'}</td>
      <td style="color:var(--text-muted);font-size:12px">${(d.inheritance || []).join(', ') || '—'}</td>
      <td><button class="btn-detail" onclick="openDiseaseModal('${d.id}')">Ver</button></td>`;
    tbody.appendChild(tr);
  }
}

function filterDiseaseTable(q) {
  const filtered = allDiseasesData.filter(d =>
    d.name.toLowerCase().includes(q.toLowerCase()) ||
    d.category.toLowerCase().includes(q.toLowerCase())
  );
  renderDiseaseTable(filtered);
}

/* ── Disease modal ── */
async function openDiseaseModal(id) {
  const modal = document.getElementById('disease-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content) return;
  modal.style.display = 'flex';

  try {
    const r = await fetch(`/api/disease/${id}`);
    const data = await r.json();
    const d = data.disease;
    content.innerHTML = `
      <div class="modal-title">${d.name}</div>
      <div class="modal-orphan">${d.orphanet_code} · ${d.category}</div>
      <div class="modal-section">
        <div class="modal-section-title">Descrição</div>
        <p class="modal-desc">${d.description}</p>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Sintomas</div>
        <div class="modal-tags">${(d.symptoms||[]).map(s=>`<span class="modal-tag">${s.replace(/_/g,' ')}</span>`).join('')}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Genes Envolvidos</div>
        <div class="modal-tags">${(d.family_history_genes||[]).map(g=>`<span class="modal-tag" style="color:var(--accent)">${g}</span>`).join('') || '<span style="color:var(--text-dim)">Não especificado</span>'}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Herança Genética</div>
        <div class="modal-tags">${(d.inheritance||[]).map(i=>`<span class="modal-tag">${i.replace(/_/g,' ')}</span>`).join('') || '—'}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Informações Clínicas</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><div class="modal-section-title" style="margin-bottom:4px">Prevalência</div><div style="color:var(--text-muted);font-size:14px">${d.prevalence||'—'}</div></div>
          <div><div class="modal-section-title" style="margin-bottom:4px">Início Típico</div><div style="color:var(--text-muted);font-size:14px">${(d.age_of_onset||'—').replace(/_/g,' ')}</div></div>
          <div><div class="modal-section-title" style="margin-bottom:4px">Urgência</div><div style="color:var(--text-muted);font-size:14px">${d.urgency||'—'}</div></div>
          <div><div class="modal-section-title" style="margin-bottom:4px">Raridade</div><div style="color:var(--text-muted);font-size:14px">${d.rarity||'—'}</div></div>
        </div>
      </div>
      ${d.red_flags?.length ? `<div class="modal-section">
        <div class="modal-section-title" style="color:var(--red)">⚠ Sinais de Alerta (Red Flags)</div>
        <div class="modal-tags">${d.red_flags.map(f=>`<span class="modal-tag" style="background:var(--red-light);color:var(--red);border:1px solid rgba(239,68,68,.2)">${f.replace(/_/g,' ')}</span>`).join('')}</div>
      </div>` : ''}`;
  } catch (e) {
    content.innerHTML = '<p style="color:var(--text-muted)">Erro ao carregar detalhes.</p>';
  }
}

function closeModal() {
  const modal = document.getElementById('disease-modal');
  if (modal) modal.style.display = 'none';
}

document.getElementById('disease-modal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('disease-modal')) closeModal();
});

/* ── Diagnose button ── */
document.getElementById('btn-diagnose-dash')?.addEventListener('click', runDashDiagnosis);
document.getElementById('btn-clear-dash')?.addEventListener('click', clearDashForm);

async function runDashDiagnosis() {
  const age = parseInt(document.getElementById('d-age')?.value);
  const sex = document.getElementById('d-sex')?.value;
  const symptoms = [...document.querySelectorAll('#symptoms-grid-dash input:checked')].map(i => i.value);

  if (!age || age < 0 || age > 120) {
    alert('Por favor, insira uma idade válida.');
    return;
  }
  if (!sex) {
    alert('Por favor, selecione o sexo biológico.');
    return;
  }
  if (!symptoms.length) {
    alert('Por favor, selecione ao menos um sintoma.');
    return;
  }

  const riskFactors = [...document.querySelectorAll('#risk-grid input:checked')].map(i => i.value);
  const familyConditions = [...document.querySelectorAll('#family-conditions-dash input:checked')].map(i => i.value);
  const consanguinity = document.getElementById('d-consanguinity')?.checked || false;
  if (consanguinity) riskFactors.push('consanguinidade');

  const payload = {
    patient: {
      name: document.getElementById('d-name')?.value || '',
      age,
      sex,
      ethnicity: document.getElementById('d-ethnicity')?.value || '',
      chief_complaint: document.getElementById('d-complaint')?.value || '',
    },
    family_history: {
      conditions: familyConditions,
      consanguinity,
      notes: document.getElementById('d-family-notes')?.value || '',
    },
    symptoms,
    risk_factors: riskFactors,
  };

  const btn = document.getElementById('btn-diagnose-dash');
  btn.disabled = true;
  btn.textContent = 'Analisando...';

  try {
    const resp = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    window._lastResults = data;
    window._lastPayload = payload;
    sessionStorage.setItem('ariadne_results', JSON.stringify(data));
    sessionStorage.setItem('ariadne_payload', JSON.stringify(payload));

    renderDashResults(data, payload);
    generateReport(data, payload);
  } catch (e) {
    alert('Erro ao processar diagnóstico. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Gerar Diagnóstico Diferencial`;
  }
}

function renderDashResults(data, payload) {
  const area = document.getElementById('dash-results');
  if (!area) return;
  area.style.display = 'block';

  if (!data.success || !data.results?.length) {
    area.innerHTML = '<div class="dash-card"><div class="empty-state"><h3>Nenhuma correspondência relevante encontrada</h3><p>Tente adicionar mais sintomas ou verifique os dados inseridos.</p></div></div>';
    return;
  }

  let html = `<div class="results-header-row">
    <div class="results-title">
      Diagnóstico Diferencial
      <span class="results-count">${data.total_found} condições</span>
    </div>
    <button class="btn-print" onclick="switchTab('relatorio')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      Ver Relatório
    </button>
  </div><div class="results-grid">`;

  for (const r of data.results) {
    const scoreClass = r.score >= 50 ? 'high' : r.score >= 25 ? 'med' : 'low';
    html += `<div class="result-card ${r.has_red_flags ? 'has-red-flag' : ''}">
      <div class="result-card-header">
        <div>
          <div class="result-card-name">${r.name}</div>
          <div class="result-card-cat">${r.category} · ${r.orphanet_code}</div>
        </div>
        <div class="score-ring ${scoreClass}">
          ${r.score}%<span>match</span>
        </div>
      </div>
      <div class="result-card-body">
        <div class="result-desc">${r.description}</div>
        ${r.matched_symptoms.length ? `<div>
          <div class="modal-section-title" style="margin-bottom:6px">Sintomas compatíveis</div>
          <div class="result-tags">${r.matched_symptoms.slice(0, 6).map(s=>`<span class="result-tag tag-symptom">${s.replace(/_/g,' ')}</span>`).join('')}</div>
        </div>` : ''}
        ${r.red_flags.length ? `<div class="result-tags">${r.red_flags.map(f=>`<span class="result-tag tag-flag">⚠ ${f.replace(/_/g,' ')}</span>`).join('')}</div>` : ''}
        <div class="result-meta">
          <div class="meta-item"><div class="meta-label">Prevalência</div><div class="meta-val">${r.prevalence}</div></div>
          <div class="meta-item"><div class="meta-label">Raridade</div><div class="meta-val">${r.rarity}</div></div>
          <div class="meta-item"><div class="meta-label">Herança</div><div class="meta-val">${(r.inheritance||[]).join(', ').replace(/_/g,' ') || '—'}</div></div>
          <div class="meta-item"><div class="meta-label">Início Típico</div><div class="meta-val">${(r.age_of_onset||'—').replace(/_/g,' ')}</div></div>
        </div>
        <div class="urgency-bar ${r.urgency.color === 'danger' ? 'high' : r.urgency.color === 'warning' ? 'med' : 'low'}">
          ${r.urgency.icon} ${r.urgency.label}
        </div>
      </div>
    </div>`;
  }

  html += '</div>';
  area.innerHTML = html;
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearDashForm() {
  document.getElementById('d-name').value = '';
  document.getElementById('d-age').value = '';
  document.getElementById('d-sex').value = '';
  document.getElementById('d-ethnicity').value = '';
  document.getElementById('d-complaint').value = '';
  document.getElementById('d-family-notes').value = '';
  document.getElementById('d-consanguinity').checked = false;
  document.querySelectorAll('#risk-grid input').forEach(i => i.checked = false);
  document.querySelectorAll('#family-conditions-dash input').forEach(i => i.checked = false);
  document.querySelectorAll('#symptoms-grid-dash input').forEach(i => i.checked = false);
  updateSymptomCount();
  const area = document.getElementById('dash-results');
  if (area) area.style.display = 'none';
}

/* ── Generate Report ── */
function generateReport(data, payload) {
  const card = document.getElementById('report-card');
  if (!card || !data.success || !data.results?.length) return;

  const now = new Date().toLocaleString('pt-BR');
  const patient = payload.patient;
  const top5 = data.results.slice(0, 5);

  let genesSet = new Set();
  for (const r of top5) {
    (r.inheritance || []).forEach(g => {});
  }

  let tableRows = top5.map((r, i) => `
    <tr>
      <td>${i + 1}. ${r.name}</td>
      <td>${r.score}%</td>
      <td>${r.orphanet_code}</td>
      <td>${(r.inheritance||[]).join(', ').replace(/_/g,' ') || '—'}</td>
      <td style="color:${r.urgency.color === 'danger' ? 'var(--red)' : r.urgency.color === 'warning' ? 'var(--yellow)' : 'var(--green)'}">
        ${r.urgency.icon} ${r.urgency.label}
      </td>
    </tr>`).join('');

  const symptomsList = payload.symptoms.slice(0, 15).map(s => s.replace(/_/g, ' ')).join(', ');
  const disclaimer = data.disclaimer;

  card.innerHTML = `
    <div class="report-doc" id="printable-report">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h2>Relatório de Triagem · Doenças Raras</h2>
          <div class="report-date">Gerado em: ${now} · ArIAdne.Dx v1.0 · Orphanet/OMIM</div>
        </div>
        <div style="text-align:right;font-size:12px;color:var(--text-dim)">
          <div style="font-size:18px;font-weight:800;color:var(--accent)">ArIAdne.Dx</div>
          Ferramenta de apoio clínico
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">1. Dados do Paciente</div>
        <table class="report-table">
          <tr><th>Campo</th><th>Valor</th></tr>
          <tr><td>Nome</td><td>${patient.name || 'Não informado'}</td></tr>
          <tr><td>Idade</td><td>${patient.age} anos</td></tr>
          <tr><td>Sexo Biológico</td><td>${patient.sex}</td></tr>
          <tr><td>Etnia / Ancestralidade</td><td>${patient.ethnicity || 'Não informado'}</td></tr>
          <tr><td>Queixa Principal</td><td>${patient.chief_complaint || 'Não informado'}</td></tr>
          <tr><td>Fatores de Risco</td><td>${payload.risk_factors.join(', ').replace(/_/g,' ') || 'Nenhum'}</td></tr>
        </table>
      </div>

      <div class="report-section">
        <div class="report-section-title">2. Sintomas Mapeados (HPO)</div>
        <p style="font-size:13px;color:var(--text-muted);line-height:1.6">${symptomsList || 'Não especificado'}</p>
        <p style="font-size:12px;color:var(--text-dim);margin-top:6px">Total: ${payload.symptoms.length} sintomas identificados</p>
      </div>

      <div class="report-section">
        <div class="report-section-title">3. Hipóteses Diagnósticas (Top ${top5.length})</div>
        <table class="report-table">
          <thead><tr><th>Condição</th><th>Score</th><th>Orphanet</th><th>Herança</th><th>Prioridade</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      <div class="report-section">
        <div class="report-section-title">4. Recomendação de Encaminhamento</div>
        <div style="background:var(--accent-light);border:1px solid var(--accent-glow);border-radius:var(--radius);padding:16px;font-size:13px;color:var(--text-muted);line-height:1.7">
          <p>Com base na triagem automatizada, sugere-se avaliação por <strong style="color:var(--text)">geneticista clínico</strong> e/ou especialista na área de ${top5[0]?.category || 'doenças raras'}.</p>
          <p style="margin-top:8px">Exames iniciais sugeridos (a critério do médico responsável): análise genética molecular, painel de erros inatos do metabolismo, avaliação laboratorial específica por condição suspeita.</p>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">5. Disclaimer</div>
        <p style="font-size:12px;color:var(--text-dim);line-height:1.6">${disclaimer}</p>
      </div>
    </div>

    <div class="report-actions">
      <button class="btn-diagnose-dash" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / PDF
      </button>
      <button class="btn-clear-dash" onclick="switchTab('triagem')">Nova Triagem</button>
    </div>`;
}

/* ── Restore session from chat ── */
function tryRestoreSession() {
  try {
    const results = sessionStorage.getItem('ariadne_results');
    const payload = sessionStorage.getItem('ariadne_payload');
    if (results && payload) {
      const r = JSON.parse(results);
      const p = JSON.parse(payload);
      renderDashResults(r, p);
      generateReport(r, p);
      // Pre-fill patient fields
      if (p.patient) {
        if (document.getElementById('d-name')) document.getElementById('d-name').value = p.patient.name || '';
        if (document.getElementById('d-age')) document.getElementById('d-age').value = p.patient.age || '';
        if (document.getElementById('d-sex')) document.getElementById('d-sex').value = p.patient.sex || '';
        if (document.getElementById('d-complaint')) document.getElementById('d-complaint').value = p.patient.chief_complaint || '';
      }
    }
  } catch (e) {}
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', initDashboard);

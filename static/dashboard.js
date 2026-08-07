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
  if (q.length >= 3) {
    // Busca em tempo real na raras.org
    clearTimeout(window._diseaseSearchTimer);
    window._diseaseSearchTimer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (d.results?.length) {
          renderRarasSearchResults(d.results, q);
          return;
        }
      } catch (e) {}
      // fallback local
      const filtered = allDiseasesData.filter(d =>
        d.name.toLowerCase().includes(q.toLowerCase()) ||
        d.category.toLowerCase().includes(q.toLowerCase())
      );
      renderDiseaseTable(filtered);
    }, 400);
  } else if (q.length === 0) {
    renderDiseaseTable(allDiseasesData);
  }
}

function renderRarasSearchResults(results, q) {
  const tbody = document.getElementById('disease-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Badge indicando fonte
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `<td colspan="7" style="padding:8px 12px;background:var(--accent-light);color:var(--accent);font-size:12px;font-weight:600">
    🔬 ${results.length} resultado(s) da raras.org para "${q}"
  </td>`;
  tbody.appendChild(headerRow);

  for (const d of results) {
    const rarityRaw = (d.rarity || '').toLowerCase();
    const rarityClass = rarityRaw.includes('1.000.000') ? 'rarity-ultra' : 'rarity-rara';
    const rarityLabel = rarityRaw.includes('1.000.000') ? 'Ultra Rara' : 'Rara';
    const orphaNum = d.orpha_number || '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${d.url || `https://raras.org/doenca/${orphaNum}`}" target="_blank" style="color:var(--text);text-decoration:none">${d.name}</a></td>
      <td style="color:var(--text-muted)">Doença Rara</td>
      <td><span class="rarity-badge ${rarityClass}">${rarityLabel}</span></td>
      <td style="color:var(--text-muted)">${d.rarity || '—'}</td>
      <td style="color:var(--accent);font-size:12px">${d.orpha_code || '—'}</td>
      <td style="color:var(--text-muted);font-size:12px">—</td>
      <td>
        ${orphaNum ? `<button class="btn-detail" onclick="openRarasModal('${orphaNum}', '${d.name.replace(/'/g,"\\'")}')">Ver</button>` : '—'}
        ${d.has_sus ? `<span class="sus-tag" style="margin-left:4px">SUS</span>` : ''}
        ${d.trial_count > 0 ? `<span class="sus-tag" style="background:var(--purple-light);color:var(--purple);border-color:rgba(139,92,246,.2)">🧪 ${d.trial_count}</span>` : ''}
      </td>`;
    tbody.appendChild(tr);
  }
}

async function openRarasModal(orphaNum, name) {
  const modal = document.getElementById('disease-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content) return;
  modal.style.display = 'flex';
  content.innerHTML = `<div class="modal-title">${name}</div><div class="loading-msg" style="padding:20px 0">Consultando raras.org...</div>`;

  try {
    const [detailResp, susResp, centersResp, trialsResp] = await Promise.all([
      fetch(`/api/detail/${orphaNum}`).then(r => r.json()).catch(() => null),
      fetch(`/api/sus/${orphaNum}`).then(r => r.json()).catch(() => null),
      fetch(`/api/centers/${orphaNum}`).then(r => r.json()).catch(() => null),
      fetch(`/api/trials/${orphaNum}`).then(r => r.json()).catch(() => null),
    ]);

    const detail = detailResp?.raw || '';
    const sus    = susResp;
    const centers = centersResp?.centers || [];
    const trials  = trialsResp?.trials || [];

    const susHtml = sus && !sus.error
      ? `<div class="sus-status ${sus.covered ? 'sus-yes' : 'sus-no'}" style="margin-bottom:8px">
          ${sus.covered ? '✅ Possui cobertura SUS' : '❌ Sem cobertura SUS confirmada'}
        </div>
        ${sus.covered ? `<div class="sus-programs">${['CEAF','SIGTAP','PNTN','PCDT'].filter(p=>sus[p.toLowerCase()]).map(p=>`<span class="sus-tag">${p}</span>`).join('')}</div>` : ''}`
      : '<span style="color:var(--text-dim);font-size:12px">Não disponível</span>';

    const centersHtml = centers.length
      ? `<ul class="centers-list">${centers.slice(0,5).map(c=>`<li class="center-item"><span class="center-name">${c.name}</span>${c.uf?`<span class="center-uf">${c.uf}</span>`:''}</li>`).join('')}</ul>`
      : '<span style="color:var(--text-dim);font-size:12px">Nenhum encontrado</span>';

    const trialsHtml = trials.length
      ? `<ul class="trials-list">${trials.slice(0,4).map(t=>`<li class="trial-item"><span class="trial-title">${t.title}</span>${t.nct_id?`<a href="https://clinicaltrials.gov/study/${t.nct_id}" target="_blank" class="nct-link">${t.nct_id}</a>`:''}</li>`).join('')}</ul>`
      : '<span style="color:var(--text-dim);font-size:12px">Nenhum trial ativo</span>';

    content.innerHTML = `
      <div class="modal-title">${name}</div>
      <div class="modal-orphan">ORPHA:${orphaNum} · <a href="https://raras.org/doenca/${orphaNum}" target="_blank" style="color:var(--accent)">raras.org →</a></div>

      ${detail ? `<div class="modal-section">
        <div class="modal-section-title">Detalhes Clínicos</div>
        <pre class="modal-desc" style="white-space:pre-wrap;font-family:inherit;font-size:13px">${detail.substring(0, 1200)}${detail.length > 1200 ? '...' : ''}</pre>
      </div>` : ''}

      <div class="modal-section">
        <div class="modal-section-title">Cobertura SUS</div>
        ${susHtml}
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Centros de Referência</div>
        ${centersHtml}
      </div>

      <div class="modal-section">
        <div class="modal-section-title">Ensaios Clínicos Ativos</div>
        ${trialsHtml}
      </div>`;
  } catch (e) {
    content.innerHTML = `<div class="modal-title">${name}</div><p style="color:var(--red);font-size:13px">Erro ao carregar dados da raras.org.</p>`;
  }
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

  const sourceLabel = data.source === 'raras.org'     ? '🔬 raras.org · 10.468 doenças'
                    : data.source === 'raras.org/hpo' ? '🔬 raras.org · HPO match'
                    : '📦 Base local';
  const sourceClass = data.source?.startsWith('raras') ? 'source-raras' : 'source-local';

  let html = `<div class="results-header-row">
    <div class="results-title">
      Diagnóstico Diferencial
      <span class="results-count">${data.total_found} condições</span>
      <span class="source-badge ${sourceClass}">${sourceLabel}</span>
    </div>
    <button class="btn-print" onclick="switchTab('relatorio')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      Ver Relatório
    </button>
  </div><div class="results-grid">`;

  for (const r of data.results) {
    const scoreClass  = r.score >= 50 ? 'high' : r.score >= 25 ? 'med' : 'low';
    const orphaNum    = r.orpha_number || r.orphanet_code?.replace('ORPHA:', '') || '';
    const rarasLink   = r.raras_url || (orphaNum ? `https://raras.org/doenca/${orphaNum}` : '');

    const susTag = r.has_sus
      ? `<span class="result-tag tag-sus">✅ Cobre pelo SUS</span>`
      : '';
    const trialsTag = r.trial_count > 0
      ? `<span class="result-tag tag-trials">🧪 ${r.trial_count} trials</span>`
      : '';

    html += `<div class="result-card ${r.has_red_flags ? 'has-red-flag' : ''}" id="card-${orphaNum}">
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

        ${(r.matched_symptoms||[]).length ? `<div>
          <div class="modal-section-title" style="margin-bottom:6px">Sintomas compatíveis</div>
          <div class="result-tags">${r.matched_symptoms.slice(0, 6).map(s=>`<span class="result-tag tag-symptom">${s.replace(/_/g,' ')}</span>`).join('')}</div>
        </div>` : ''}

        ${(r.red_flags||[]).length ? `<div class="result-tags">${r.red_flags.map(f=>`<span class="result-tag tag-flag">⚠ ${f.replace(/_/g,' ')}</span>`).join('')}</div>` : ''}

        <div class="result-meta">
          <div class="meta-item"><div class="meta-label">Prevalência</div><div class="meta-val">${r.prevalence}</div></div>
          <div class="meta-item"><div class="meta-label">Raridade</div><div class="meta-val">${r.rarity}</div></div>
          <div class="meta-item"><div class="meta-label">Herança</div><div class="meta-val">${(r.inheritance||[]).join(', ').replace(/_/g,' ') || '—'}</div></div>
          <div class="meta-item"><div class="meta-label">Início Típico</div><div class="meta-val">${(r.age_of_onset||'—').replace(/_/g,' ')}</div></div>
        </div>

        ${susTag || trialsTag ? `<div class="result-tags" style="margin-top:4px">${susTag}${trialsTag}</div>` : ''}

        <div class="urgency-bar ${r.urgency.color === 'danger' ? 'high' : r.urgency.color === 'warning' ? 'med' : 'low'}">
          ${r.urgency.icon} ${r.urgency.label}
        </div>

        ${orphaNum ? `<div class="result-actions-row">
          <button class="btn-load-extra" onclick="loadEnrichment('${orphaNum}', this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            SUS · Centros · Trials
          </button>
          ${rarasLink ? `<a href="${rarasLink}" target="_blank" class="btn-raras-link">
            raras.org →
          </a>` : ''}
        </div>
        <div class="enrichment-area" id="enrich-${orphaNum}"></div>` : ''}

      </div>
    </div>`;
  }

  html += '</div>';
  area.innerHTML = html;
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Enrichment: SUS + Centros + Trials on demand ── */
async function loadEnrichment(orphaNum, btn) {
  const area = document.getElementById(`enrich-${orphaNum}`);
  if (!area) return;

  btn.disabled = true;
  btn.textContent = 'Consultando raras.org...';
  area.innerHTML = '<div class="loading-msg" style="padding:8px 0">Buscando cobertura SUS, centros e trials...</div>';

  try {
    const [susResp, centersResp, trialsResp] = await Promise.all([
      fetch(`/api/sus/${orphaNum}`).then(r => r.json()).catch(() => null),
      fetch(`/api/centers/${orphaNum}`).then(r => r.json()).catch(() => null),
      fetch(`/api/trials/${orphaNum}`).then(r => r.json()).catch(() => null),
    ]);

    let html = '<div class="enrichment-grid">';

    // ── SUS ──
    html += '<div class="enrich-block">';
    html += '<div class="enrich-title">Cobertura SUS</div>';
    if (susResp && !susResp.error) {
      const covered = susResp.covered;
      html += `<div class="sus-status ${covered ? 'sus-yes' : 'sus-no'}">
        ${covered ? '✅ Possui cobertura' : '❌ Sem cobertura confirmada'}
      </div>`;
      if (covered) {
        const programs = [];
        if (susResp.ceaf)   programs.push('CEAF');
        if (susResp.sigtap) programs.push('SIGTAP');
        if (susResp.pntn)   programs.push('PNTN');
        if (susResp.pcdt)   programs.push('PCDT');
        if (programs.length) html += `<div class="sus-programs">${programs.map(p => `<span class="sus-tag">${p}</span>`).join('')}</div>`;
      }
    } else {
      html += '<div style="color:var(--text-dim);font-size:12px">Não disponível</div>';
    }
    html += '</div>';

    // ── Centros de Referência ──
    html += '<div class="enrich-block">';
    html += '<div class="enrich-title">Centros de Referência</div>';
    const centers = centersResp?.centers || [];
    if (centers.length) {
      html += '<ul class="centers-list">';
      for (const c of centers.slice(0, 5)) {
        html += `<li class="center-item">
          <span class="center-name">${c.name}</span>
          ${c.uf ? `<span class="center-uf">${c.uf}</span>` : ''}
        </li>`;
      }
      html += '</ul>';
    } else {
      html += '<div style="color:var(--text-dim);font-size:12px">Nenhum centro encontrado</div>';
    }
    html += '</div>';

    // ── Trials ──
    html += '<div class="enrich-block enrich-full">';
    html += '<div class="enrich-title">Ensaios Clínicos Ativos (Brasil)</div>';
    const trials = trialsResp?.trials || [];
    if (trials.length) {
      html += '<ul class="trials-list">';
      for (const t of trials.slice(0, 4)) {
        const nctLink = t.nct_id
          ? `<a href="https://clinicaltrials.gov/study/${t.nct_id}" target="_blank" class="nct-link">${t.nct_id}</a>`
          : '';
        html += `<li class="trial-item">
          <span class="trial-title">${t.title}</span>
          ${nctLink}
        </li>`;
      }
      html += '</ul>';
    } else {
      html += '<div style="color:var(--text-dim);font-size:12px">Nenhum trial ativo encontrado</div>';
    }
    html += '</div>';

    html += '</div>'; // enrichment-grid
    area.innerHTML = html;
    btn.style.display = 'none';

  } catch (e) {
    area.innerHTML = '<div style="color:var(--red);font-size:12px;padding:8px 0">Erro ao carregar dados externos.</div>';
    btn.disabled = false;
    btn.innerHTML = 'Tentar novamente';
  }
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
          <thead><tr><th>Condição</th><th>Score</th><th>Orphanet</th><th>Herança</th><th>SUS</th><th>Prioridade</th></tr></thead>
          <tbody>${top5.map((r, i) => `
            <tr>
              <td>${i + 1}. ${r.name}</td>
              <td>${r.score}%</td>
              <td>${r.orphanet_code}</td>
              <td>${(r.inheritance||[]).join(', ').replace(/_/g,' ') || '—'}</td>
              <td>${r.has_sus ? '✅ Sim' : '—'}</td>
              <td style="color:${r.urgency.color === 'danger' ? 'var(--red)' : r.urgency.color === 'warning' ? 'var(--yellow)' : 'var(--green)'}">
                ${r.urgency.icon} ${r.urgency.label}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="report-section">
        <div class="report-section-title">4. Cobertura SUS e Centros de Referência</div>
        <div style="background:var(--green-light);border:1px solid rgba(16,185,129,.2);border-radius:var(--radius);padding:14px;font-size:13px;color:var(--text-muted);line-height:1.7">
          ${top5.filter(r => r.has_sus).length
            ? `<p>✅ <strong style="color:var(--green)">${top5.filter(r=>r.has_sus).length} condição(ões)</strong> possuem cobertura confirmada pelo SUS (CEAF/PCDT):</p>
               <ul style="margin-top:6px;padding-left:16px">${top5.filter(r=>r.has_sus).map(r=>`<li>${r.name} — <a href="${r.raras_url||'#'}" style="color:var(--accent)">${r.orphanet_code}</a></li>`).join('')}</ul>`
            : '<p>Nenhuma das hipóteses listadas possui cobertura SUS confirmada nesta triagem. Consulte o médico para verificação atualizada.</p>'
          }
          <p style="margin-top:10px">Para centros de referência por UF, consulte a aba <strong>Nova Triagem</strong> → botão "SUS · Centros · Trials" em cada hipótese.</p>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">5. Recomendação de Encaminhamento</div>
        <div style="background:var(--accent-light);border:1px solid var(--accent-glow);border-radius:var(--radius);padding:16px;font-size:13px;color:var(--text-muted);line-height:1.7">
          <p>Com base na triagem automatizada, sugere-se avaliação por <strong style="color:var(--text)">geneticista clínico</strong> e/ou especialista na área de ${top5[0]?.category || 'doenças raras'}.</p>
          <p style="margin-top:8px">Exames iniciais sugeridos (a critério do médico responsável): análise genética molecular, painel de erros inatos do metabolismo, avaliação laboratorial específica por condição suspeita.</p>
          ${data.source?.startsWith('raras') ? `<p style="margin-top:8px;color:var(--accent);font-size:12px">🔬 Triagem realizada via raras.org · Knowledge Graph Brasileiro de Doenças Raras · CC-BY-4.0</p>` : ''}
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">6. Disclaimer</div>
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

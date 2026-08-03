/* =========================================
   RareDx — Frontend JavaScript
   ========================================= */

"use strict";

// --- Estado global ---
let allSymptoms = [];
let selectedSymptoms = new Set();
let familyConditionOptions = [];

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    loadSymptoms();
    loadFamilyConditions();
    setupCheckboxListeners();
});

// --- Carregamento de sintomas via API ---
async function loadSymptoms() {
    try {
        const res = await fetch("/api/symptoms");
        const data = await res.json();
        allSymptoms = data.symptoms;
        renderSymptoms(allSymptoms);
    } catch (e) {
        document.getElementById("symptoms-grid").innerHTML =
            `<p style="color:red;padding:16px;">Erro ao carregar sintomas. Verifique a conexão com o servidor.</p>`;
    }
}

function renderSymptoms(list) {
    const grid = document.getElementById("symptoms-grid");
    if (!list.length) {
        grid.innerHTML = `<p style="color:var(--text-muted);padding:16px;">Nenhum sintoma encontrado para esta busca.</p>`;
        return;
    }
    grid.innerHTML = list.map(s => `
        <label class="checkbox-item ${selectedSymptoms.has(s.id) ? "checked" : ""}" data-id="${s.id}">
            <input type="checkbox" value="${s.id}" ${selectedSymptoms.has(s.id) ? "checked" : ""}
                onchange="toggleSymptom('${s.id}', this)" />
            ${escapeHtml(s.label)}
        </label>
    `).join("");
}

function toggleSymptom(id, checkbox) {
    if (checkbox.checked) {
        selectedSymptoms.add(id);
        checkbox.closest(".checkbox-item").classList.add("checked");
    } else {
        selectedSymptoms.delete(id);
        checkbox.closest(".checkbox-item").classList.remove("checked");
    }
    document.getElementById("selected-count").textContent = selectedSymptoms.size;
}

function filterSymptoms(query) {
    const q = query.toLowerCase().trim();
    const filtered = q ? allSymptoms.filter(s => s.label.toLowerCase().includes(q)) : allSymptoms;
    renderSymptoms(filtered);
}

function clearSearch() {
    document.getElementById("symptom-search").value = "";
    renderSymptoms(allSymptoms);
}

function clearAllSymptoms() {
    selectedSymptoms.clear();
    document.getElementById("selected-count").textContent = "0";
    renderSymptoms(allSymptoms);
}

// --- Carregamento de condições familiares ---
async function loadFamilyConditions() {
    try {
        const res = await fetch("/api/diseases");
        const data = await res.json();
        familyConditionOptions = data.diseases;
        renderFamilyConditions(data.diseases);
    } catch (e) {
        document.getElementById("family-conditions-grid").innerHTML =
            `<p style="color:red;">Erro ao carregar condições.</p>`;
    }
}

function renderFamilyConditions(diseases) {
    const grid = document.getElementById("family-conditions-grid");
    grid.innerHTML = diseases.map(d => `
        <label class="checkbox-item" data-fam="${d.id}">
            <input type="checkbox" value="${d.id}" onchange="toggleCheckboxStyle(this)" />
            ${escapeHtml(d.name)}
        </label>
    `).join("");
}

function toggleCheckboxStyle(checkbox) {
    const item = checkbox.closest(".checkbox-item");
    item.classList.toggle("checked", checkbox.checked);
}

// --- Listeners genéricos para checkboxes de fatores de risco ---
function setupCheckboxListeners() {
    document.querySelectorAll("#risk-factors-grid .checkbox-item input").forEach(input => {
        input.addEventListener("change", () => toggleCheckboxStyle(input));
    });
}

// --- Navegação entre etapas ---
function nextStep(step) {
    // Validar etapa atual antes de avançar
    if (step === 2 && !validateStep1()) return;
    if (step === 4) { runDiagnosis(); return; }

    // Esconder todas as etapas
    document.querySelectorAll(".form-step").forEach(el => el.classList.add("hidden"));
    document.getElementById(`step-${step}`).classList.remove("hidden");

    // Atualizar stepper
    document.querySelectorAll(".step").forEach((el, i) => {
        const n = i / 2 + 1; // steps intercalados com linhas
        el.classList.remove("active", "done");
    });

    const steps = document.querySelectorAll(".step[data-step]");
    steps.forEach(el => {
        const n = parseInt(el.dataset.step);
        el.classList.remove("active", "done");
        if (n < step) el.classList.add("done");
        if (n === step) el.classList.add("active");
    });

    // Atualizar ícone nos steps concluídos
    steps.forEach(el => {
        const circle = el.querySelector(".step-circle");
        const n = parseInt(el.dataset.step);
        if (n < step) circle.innerHTML = "✓";
        else circle.innerHTML = n;
    });

    window.scrollTo({ top: document.getElementById("form-section").offsetTop - 70, behavior: "smooth" });
}

// --- Validação da etapa 1 ---
function validateStep1() {
    let valid = true;
    clearErrors();

    const age = document.getElementById("patient-age").value;
    const sex = document.getElementById("patient-sex").value;

    if (!age || isNaN(age) || parseInt(age) < 0 || parseInt(age) > 120) {
        showError("patient-age", "Informe uma idade válida (0–120).");
        valid = false;
    }
    if (!sex) {
        showError("patient-sex", "Selecione o sexo biológico.");
        valid = false;
    }
    return valid;
}

function showError(fieldId, msg) {
    const field = document.getElementById(fieldId);
    field.classList.add("error");
    const err = document.createElement("p");
    err.className = "field-error";
    err.textContent = msg;
    field.parentElement.appendChild(err);
}

function clearErrors() {
    document.querySelectorAll(".field-error").forEach(el => el.remove());
    document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
}

// --- Coletar dados do formulário ---
function collectFormData() {
    const riskFactors = Array.from(
        document.querySelectorAll("#risk-factors-grid input:checked")
    ).map(el => el.value);

    const familyConditions = Array.from(
        document.querySelectorAll("#family-conditions-grid input:checked")
    ).map(el => el.value);

    const ethnicity = document.getElementById("patient-ethnicity").value;
    if (ethnicity === "judaica_ashkenazi" && !riskFactors.includes("ascendência_judaica_ashkenazi")) {
        riskFactors.push("ascendência_judaica_ashkenazi");
    }
    if (ethnicity === "africana" && !riskFactors.includes("ascendência_africana")) {
        riskFactors.push("ascendência_africana");
    }
    if (ethnicity === "mediterranea" && !riskFactors.includes("ascendência_mediterrânea")) {
        riskFactors.push("ascendência_mediterrânea");
    }

    return {
        patient: {
            name: document.getElementById("patient-name").value,
            age: parseInt(document.getElementById("patient-age").value) || 0,
            sex: document.getElementById("patient-sex").value,
            ethnicity: ethnicity,
            chief_complaint: document.getElementById("chief-complaint").value,
        },
        family_history: {
            conditions: familyConditions,
            consanguinity: document.getElementById("consanguinity").checked,
            notes: document.getElementById("family-notes").value,
        },
        symptoms: Array.from(selectedSymptoms),
        risk_factors: riskFactors,
    };
}

// --- Executar diagnóstico ---
async function runDiagnosis() {
    if (selectedSymptoms.size === 0) {
        alert("Por favor, selecione pelo menos um sintoma antes de continuar.");
        return;
    }

    // Ir para etapa 4 e mostrar loading
    document.querySelectorAll(".form-step").forEach(el => el.classList.add("hidden"));
    document.getElementById("step-4").classList.remove("hidden");

    const steps = document.querySelectorAll(".step[data-step]");
    steps.forEach(el => {
        el.classList.remove("active", "done");
        const n = parseInt(el.dataset.step);
        const circle = el.querySelector(".step-circle");
        if (n < 4) { el.classList.add("done"); circle.innerHTML = "✓"; }
        else { el.classList.add("active"); circle.innerHTML = "4"; }
    });

    const container = document.getElementById("results-container");
    container.innerHTML = `
        <div class="loading-spinner" style="min-height:200px;justify-content:center;">
            <div class="spinner" style="width:48px;height:48px;border-width:4px;"></div>
            <p>Analisando dados clínicos...</p>
        </div>
    `;

    window.scrollTo({ top: document.getElementById("form-section").offsetTop - 70, behavior: "smooth" });

    const payload = collectFormData();

    try {
        const res = await fetch("/api/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || "Erro ao processar diagnóstico.");
        }
        renderResults(data, payload);
    } catch (e) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--danger);">
                <p style="font-size:2rem;">⚠️</p>
                <h3>Erro ao gerar diagnóstico</h3>
                <p>${escapeHtml(e.message)}</p>
            </div>`;
    }
}

// --- Renderizar resultados ---
function renderResults(data, payload) {
    const container = document.getElementById("results-container");
    const results = data.results;
    const patientName = payload.patient.name || "Paciente";
    const totalSymptoms = payload.symptoms.length;

    let html = `
        <div class="results-header">
            <h2>Diagnóstico Diferencial</h2>
            <p class="results-meta">
                Paciente: <strong>${escapeHtml(patientName)}</strong> &bull;
                ${totalSymptoms} sintoma(s) informado(s) &bull;
                ${results.length} condição(ões) identificada(s)
            </p>
        </div>

        <div class="disclaimer-box">
            <span class="disclaimer-icon">⚠️</span>
            <span>${escapeHtml(data.disclaimer)}</span>
        </div>
    `;

    if (!results.length) {
        html += `
            <div class="no-results">
                <div class="no-results-icon">🔬</div>
                <h3>Nenhuma correspondência encontrada</h3>
                <p>Os sintomas informados não correspondem suficientemente a nenhuma doença na base de dados. Tente adicionar mais sintomas ou consulte um especialista.</p>
            </div>`;
    } else {
        html += `<div class="results-list">`;
        results.forEach((r, i) => {
            html += buildDiseaseCard(r, i + 1);
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

function buildDiseaseCard(r, rank) {
    const score = r.score;
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (score / 100) * circumference;
    const scoreColor = score >= 60 ? "#ef4444" : score >= 35 ? "#f59e0b" : "#4f46e5";

    const rarityBadge = r.rarity.includes("Ultra")
        ? `<span class="badge badge-ultra">🧬 ${escapeHtml(r.rarity)}</span>`
        : `<span class="badge badge-primary">🧬 ${escapeHtml(r.rarity)}</span>`;

    const urgencyBadge = `<span class="badge badge-${r.urgency.color}">${r.urgency.icon} ${escapeHtml(r.urgency.label)}</span>`;

    const matchedSymptomsHtml = r.matched_symptoms.length
        ? r.matched_symptoms.map(s => `<span class="tag tag-green">✓ ${formatSymptomId(s)}</span>`).join("")
        : `<span class="tag tag-gray">Nenhum sintoma direto</span>`;

    const familyHtml = r.matched_family.length
        ? r.matched_family.map(f => `<span class="tag tag-blue">👨‍👩‍👧 ${escapeHtml(f.replace(/_/g, " "))}</span>`).join("")
        : `<span class="tag tag-gray">Nenhum</span>`;

    const redFlagsHtml = r.red_flags.length ? `
        <div class="red-flags-alert">
            <span>🚨</span>
            <span><strong>Sinal de Alerta:</strong> ${r.red_flags.map(f => escapeHtml(formatSymptomId(f))).join(", ")} — Recomenda-se avaliação médica urgente.</span>
        </div>` : "";

    const inheritanceMap = {
        "autossômica_dominante": "Autossômica Dominante",
        "autossômica_recessiva": "Autossômica Recessiva",
        "ligada_ao_x": "Ligada ao X",
        "ligada_ao_x_dominante": "Ligada ao X Dominante",
        "autossômica_codominante": "Autossômica Codominante",
        "cromossômica": "Cromossômica",
        "autoimune": "Autoimune (não hereditária)",
        "geralmente_esporádica": "Geralmente esporádica",
    };
    const inheritanceHtml = (r.inheritance || [])
        .map(i => inheritanceMap[i] || i)
        .join(", ") || "Não definida";

    const orphanetUrl = r.orphanet_code
        ? `https://www.orpha.net/consor/cgi-bin/OC_Exp.php?lng=PT&Expert=${r.orphanet_code.replace("ORPHA:", "")}`
        : null;

    return `
    <div class="disease-card ${r.has_red_flags ? "has-red-flags" : ""}" id="card-${r.id}">
        <div class="card-header" onclick="toggleCard('${r.id}')">
            <div class="card-title-group">
                <div class="card-rank">#${rank} correspondência</div>
                <div class="card-name">${escapeHtml(r.name)}</div>
                <div class="card-meta">
                    ${rarityBadge}
                    ${urgencyBadge}
                    <span class="badge badge-neutral">📁 ${escapeHtml(r.category)}</span>
                </div>
            </div>
            <div class="card-score-group">
                <div class="score-ring" title="${score}% de correspondência">
                    <svg width="56" height="56" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border)" stroke-width="5"/>
                        <circle cx="28" cy="28" r="22" fill="none" stroke="${scoreColor}" stroke-width="5"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                            stroke-linecap="round"/>
                    </svg>
                    <div class="score-text">${score}%</div>
                </div>
                <span class="card-expand-icon" id="expand-${r.id}">▼ Ver detalhes</span>
            </div>
        </div>

        <div class="card-body" id="body-${r.id}">
            <p class="card-description">${escapeHtml(r.description)}</p>

            <div class="card-sections">
                <div>
                    <div class="card-section-title">✅ Sintomas Correspondentes (${r.matched_symptoms.length})</div>
                    <div class="tags-list">${matchedSymptomsHtml}</div>
                </div>
                <div>
                    <div class="card-section-title">👨‍👩‍👧 Histórico Familiar</div>
                    <div class="tags-list">${familyHtml}</div>
                </div>
            </div>

            <div class="card-sections" style="margin-top:16px;">
                <div>
                    <div class="card-section-title">📋 Informações Clínicas</div>
                    <div class="card-info-row">
                        <div class="info-item"><span class="info-label">Prevalência:</span><span class="info-value">${escapeHtml(r.prevalence)}</span></div>
                        <div class="info-item"><span class="info-label">Herança:</span><span class="info-value">${escapeHtml(inheritanceHtml)}</span></div>
                        <div class="info-item"><span class="info-label">Início:</span><span class="info-value">${formatOnset(r.age_of_onset)}</span></div>
                        <div class="info-item"><span class="info-label">Cobertura:</span><span class="info-value">${r.symptom_coverage}% dos sintomas típicos</span></div>
                    </div>
                </div>
                <div>
                    <div class="card-section-title">⚙️ Código Orphanet</div>
                    <div class="card-info-row">
                        <div class="info-item"><span class="info-label">Código:</span><span class="info-value">${escapeHtml(r.orphanet_code || "N/A")}</span></div>
                    </div>
                    ${orphanetUrl ? `<a href="${orphanetUrl}" target="_blank" rel="noopener noreferrer" class="orphanet-link">🔗 Ver no Orphanet</a>` : ""}
                </div>
            </div>

            ${redFlagsHtml}
        </div>
    </div>`;
}

function toggleCard(id) {
    const body = document.getElementById(`body-${id}`);
    const icon = document.getElementById(`expand-${id}`);
    const isOpen = body.classList.toggle("open");
    icon.textContent = isOpen ? "▲ Fechar" : "▼ Ver detalhes";
}

// --- Reset do formulário ---
function resetForm() {
    if (!confirm("Deseja iniciar uma nova avaliação? Todos os dados serão perdidos.")) return;
    document.getElementById("patient-name").value = "";
    document.getElementById("patient-age").value = "";
    document.getElementById("patient-sex").value = "";
    document.getElementById("patient-ethnicity").value = "";
    document.getElementById("chief-complaint").value = "";
    document.getElementById("family-notes").value = "";
    document.getElementById("consanguinity").checked = false;
    document.querySelectorAll(".checkbox-item input").forEach(el => {
        el.checked = false;
        el.closest(".checkbox-item").classList.remove("checked");
    });
    selectedSymptoms.clear();
    document.getElementById("selected-count").textContent = "0";
    clearErrors();
    nextStep(1);
}

// --- Utilitários ---
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatSymptomId(id) {
    // Tenta buscar o label do sintoma na lista carregada
    const found = allSymptoms.find(s => s.id === id);
    if (found) return found.label;
    return id.replace(/_/g, " ");
}

function formatOnset(onset) {
    const map = {
        "qualquer_idade": "Qualquer idade",
        "infância": "Infância",
        "infância_precoce": "Infância precoce (< 6 anos)",
        "infância_ou_adolescência": "Infância ou adolescência",
        "adolescência": "Adolescência",
        "adulto_jovem": "Adulto jovem",
        "adulto": "Adulto",
        "30_a_50_anos": "Entre 30–50 anos",
        "5_a_35_anos": "Entre 5–35 anos",
        "nascimento_ou_infância": "Nascimento ou infância",
    };
    return map[onset] || onset?.replace(/_/g, " ") || "Não definido";
}

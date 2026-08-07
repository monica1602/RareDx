/* ── ArIAdne.Dx App.js ── */

/* ── Priority thresholds ── */
const PRIORITY = {
  alta:  { min: 75,   label: 'Alta Prioridade',   scoreClass: 'score-high', barClass: 'score-high-bar', txtClass: 'score-high-txt', color: 'var(--red)'    },
  media: { min: 50,   label: 'Prioridade Média',  scoreClass: 'score-med',  barClass: 'score-med-bar',  txtClass: 'score-med-txt',  color: 'var(--yellow)' },
  baixa: { min: 25,   label: 'Prioridade Baixa',  scoreClass: 'score-low',  barClass: 'score-low-bar',  txtClass: 'score-low-txt',  color: 'var(--green)'  },
  sem:   { min: 0,    label: 'Sem Prioridade',    scoreClass: 'score-none', barClass: 'score-none-bar', txtClass: 'score-none-txt', color: 'var(--text-dim)'},
};
function getPriority(score) {
  if (score >= 75) return PRIORITY.alta;
  if (score >= 50) return PRIORITY.media;
  if (score >= 25) return PRIORITY.baixa;
  return PRIORITY.sem;
}

/* ── Header scroll ── */
window.addEventListener('scroll', () => {
  document.getElementById('header')?.classList.toggle('scrolled', window.scrollY > 20);
});

/* ── Mobile nav ── */
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('mobile-nav')?.classList.toggle('open');
});

/* ── Open/close chat ── */
const overlay   = document.getElementById('chat-overlay');
const fab       = document.getElementById('chat-fab');
const btnOpen   = document.getElementById('btn-open-chat');
const btnClose  = document.getElementById('btn-close-chat');
const btnNew    = document.getElementById('btn-new-chat');

function openChat() {
  overlay?.classList.add('open');
  fab?.classList.add('hidden');
  if (!chatStarted) startChat();
}
function closeChat() {
  overlay?.classList.remove('open');
  fab?.classList.remove('hidden');
}

fab?.addEventListener('click', openChat);
btnOpen?.addEventListener('click', openChat);
btnClose?.addEventListener('click', closeChat);
btnNew?.addEventListener('click', () => { resetChat(); startChat(); });

overlay?.addEventListener('click', e => {
  if (e.target === overlay) closeChat();
});

/* ────────────────────────────────────────────
   CHAT FLOW ENGINE
   State machine with conversational steps
   ──────────────────────────────────────────── */

const STEPS = [
  'welcome',       // 0
  'ask_name',      // 1
  'ask_age',       // 2
  'ask_sex',       // 3
  'ask_location',  // 4  NEW
  'ask_symptoms',  // 5
  'ask_more',      // 6
  'ask_duration',  // 7
  'ask_exams',     // 8  NEW
  'ask_family',    // 9
  'ask_family_cond',// 10
  'ask_risk',      // 11
  'processing',    // 12
  'results',       // 13
];

let chatState = {};
let currentStep = 0;
let chatStarted = false;
let allSymptoms = [];

async function loadSymptoms() {
  if (allSymptoms.length) return;
  try {
    const r = await fetch('/api/symptoms');
    const d = await r.json();
    allSymptoms = d.symptoms || [];
  } catch (e) {
    console.warn('Could not load symptoms', e);
  }
}

function resetChat() {
  chatState = {
    name: '',
    age: null,
    sex: '',
    location: '',
    symptomsRaw: '',
    matchedSymptoms: [],
    duration: '',
    examsRaw: '',
    familyHistory: false,
    familyConditions: [],
    riskFactors: [],
  };
  currentStep = 0;
  chatStarted = false;
  clearMessages();
  clearQuickReplies();
  setProgress(0);
  enableInput(false);
}

function startChat() {
  chatStarted = true;
  loadSymptoms();
  setTimeout(() => {
    showTyping(800, () => {
      addBotMessage('Olá! 👋 Sou o Ari, assistente de triagem do ArIAdne.Dx.');
      setTimeout(() => {
        showTyping(1000, () => {
          addBotMessage('Estou aqui para te ajudar a descrever seus sintomas de forma simples. Com base no que você me contar, vou gerar um relatório para o seu médico.');
          setTimeout(() => {
            showTyping(600, () => {
              currentStep = 1;
              askCurrentStep();
            });
          }, 400);
        });
      }, 400);
    });
  }, 300);
}

function askCurrentStep() {
  setProgress((currentStep / (STEPS.length - 1)) * 100);

  if (currentStep === 1) {
    addBotMessage('Para começar, qual é o seu nome? <span style="color:var(--text-dim);font-size:12px">(pode deixar em branco)</span>');
    enableInput(true, 'Seu nome ou "prefiro não dizer"...');
    setQuickReplies(['Prefiro não dizer']);

  } else if (currentStep === 2) {
    addBotMessage(`Legal, ${chatState.name || 'tudo bem'} 😊 Quantos anos você tem?`);
    enableInput(true, 'Sua idade...');

  } else if (currentStep === 3) {
    addBotMessage('Qual é o seu sexo biológico? Isso ajuda na análise clínica.');
    enableInput(false);
    setQuickReplies(['Feminino', 'Masculino', 'Prefiro não informar']);

  } else if (currentStep === 4) {
    addBotMessage('Em qual cidade e estado você mora? Isso vai ajudar a identificar o agente de saúde responsável pela sua região.');
    enableInput(true, 'Ex: São Paulo - SP, Fortaleza - CE...');
    setQuickReplies(['Prefiro não informar']);

  } else if (currentStep === 5) {
    addBotMessage('Agora me conta: <strong>o que você está sentindo?</strong> Descreva como se estivesse falando com um amigo. Pode ser uma lista ou frase.');
    enableInput(true, 'Ex: cansaço extremo, dores nas articulações, manchas roxas...');
    setQuickReplies([]);

  } else if (currentStep === 6) {
    addBotMessage('Tem algum outro sintoma que gostaria de adicionar? Problemas de visão, respiração, cognição ou pele?');
    enableInput(true, 'Mais sintomas ou "não, é só isso"...');
    setQuickReplies(['Não, é só isso', 'Problemas de visão', 'Dificuldade para respirar', 'Alterações na pele', 'Fraqueza muscular', 'Convulsões']);

  } else if (currentStep === 7) {
    addBotMessage('Há quanto tempo você tem esses sintomas?');
    enableInput(true, 'Ex: 3 meses, 2 anos...');
    setQuickReplies(['Menos de 1 mês', '1 a 6 meses', '6 meses a 2 anos', 'Mais de 2 anos', 'Desde a infância']);

  } else if (currentStep === 8) {
    addBotMessage('Você já realizou algum exame relacionado a esses sintomas? Se sim, quais e qual foi o resultado?');
    enableInput(true, 'Ex: hemograma, ressonância, exame genético... ou "não realizei nenhum"');
    setQuickReplies(['Não realizei nenhum', 'Hemograma', 'Exame de imagem (RX / RM / TC)', 'Exame genético', 'Biopsia', 'Exames laboratoriais']);

  } else if (currentStep === 9) {
    addBotMessage('Alguém na sua família — pais, irmãos, avós — tem ou teve sintomas parecidos ou alguma doença genética?');
    enableInput(false);
    setQuickReplies(['Sim', 'Não sei', 'Não']);

  } else if (currentStep === 10) {
    if (chatState.familyHistory) {
      addBotMessage('Que tipo de condição? Pode descrever ou escolher uma das opções.');
      enableInput(true, 'Ex: anemia, problemas cardíacos, doença neurológica...');
      setQuickReplies(['Anemia / sangue', 'Problemas cardíacos', 'Doença neurológica', 'Problemas musculares', 'Doença hepática', 'Outro / não sei o nome']);
    } else {
      currentStep = 11;
      askCurrentStep();
    }

  } else if (currentStep === 11) {
    addBotMessage('Algum desses fatores se aplica a você?');
    enableInput(false);
    setQuickReplies(['Histórico familiar de doenças genéticas', 'Doenças autoimunes', 'Ascendência africana', 'Ascendência mediterrânea', 'Ascendência judaica', 'Uso de medicamentos contínuos', 'Nenhum desses', 'Pular']);

  } else if (currentStep === 12) {
    processDiagnosis();
  }
}

async function handleUserInput(text) {
  if (!text.trim()) return;
  addUserMessage(text);
  enableInput(false);
  clearQuickReplies();

  if (currentStep === 1) {
    chatState.name = text.trim() === 'Prefiro não dizer' ? '' : text.trim();
    currentStep = 2;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 2) {
    const age = parseInt(text);
    if (isNaN(age) || age < 0 || age > 120) {
      showTyping(400, () => {
        addBotMessage('Hmm, não entendi essa idade 😅 Por favor, insira um número válido, como 28.');
        enableInput(true, 'Sua idade...');
      });
      return;
    }
    chatState.age = age;
    currentStep = 3;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 3) {
    const sexMap = { 'feminino': 'feminino', 'masculino': 'masculino', 'prefiro não informar': 'outro' };
    chatState.sex = sexMap[text.toLowerCase()] || 'outro';
    currentStep = 4;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 4) {
    chatState.location = text.trim() === 'Prefiro não informar' ? '' : text.trim();
    currentStep = 5;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 5) {
    chatState.symptomsRaw = text;
    chatState.matchedSymptoms = matchSymptoms(text);
    currentStep = 6;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 6) {
    const lower = text.toLowerCase();
    if (!lower.includes('não') && !lower.includes('nao') && !lower.includes('só isso') && !lower.includes('so isso')) {
      const extra = matchSymptoms(text);
      chatState.matchedSymptoms = [...new Set([...chatState.matchedSymptoms, ...extra])];
      chatState.symptomsRaw += ', ' + text;
    }
    currentStep = 7;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 7) {
    chatState.duration = text;
    currentStep = 8;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 8) {
    chatState.examsRaw = text.trim() === 'Não realizei nenhum' ? '' : text.trim();
    currentStep = 9;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 9) {
    const lower = text.toLowerCase();
    chatState.familyHistory = lower === 'sim' || lower.includes('sim');
    if (chatState.familyHistory) chatState.riskFactors.push('historico_familiar');
    currentStep = 10;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 10) {
    if (chatState.familyHistory) {
      chatState.familyConditions = parseFamilyConditions(text);
    }
    currentStep = 11;
    setTimeout(() => askCurrentStep(), 500);

  } else if (currentStep === 11) {
    const lower = text.toLowerCase();
    if (!lower.includes('nenhum') && !lower.includes('pular')) {
      const factors = parseRiskFactors(text);
      chatState.riskFactors = [...new Set([...chatState.riskFactors, ...factors])];
    }
    currentStep = 12;
    setTimeout(() => askCurrentStep(), 500);
  }
}

/* ── Symptom matching ── */
function matchSymptoms(text) {
  const lower = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matched = [];

  const keywordMap = {
    'cansaço': 'fadiga', 'cansado': 'fadiga', 'fadiga': 'fadiga', 'fraqueza': 'fraqueza_muscular',
    'fraqueza muscular': 'fraqueza_muscular', 'dor muscular': 'dor_muscular', 'dor nas juntas': 'dor_nas_articulações',
    'dor articular': 'dor_nas_articulações', 'articulacoes': 'dor_nas_articulações', 'articulações': 'dor_nas_articulações',
    'mancha roxa': 'equimoses_frequentes', 'hematoma': 'equimoses_frequentes', 'roxo': 'equimoses_frequentes',
    'roxos': 'equimoses_frequentes', 'visao': 'visao_embaçada', 'visão': 'visao_embaçada',
    'vista': 'visao_embaçada', 'enxergar': 'visao_embaçada', 'tunel do carpo': 'síndrome_do_túnel_do_carpo',
    'respirar': 'dificuldade_para_respirar', 'falta de ar': 'falta_de_ar', 'dispneia': 'falta_de_ar',
    'tosse': 'tosse_crônica', 'pele': 'eczema', 'ictericia': 'icterícia', 'icterícia': 'icterícia',
    'amarelado': 'icterícia', 'dor abdominal': 'dor_abdominal', 'dor de barriga': 'dor_abdominal',
    'barriga': 'dor_abdominal', 'tremor': 'tremores', 'tremer': 'tremores', 'convulsao': 'convulsões',
    'convulsão': 'convulsões', 'convulsoes': 'convulsões', 'epilepsia': 'convulsões',
    'memoria': 'problemas_de_memória', 'memória': 'problemas_de_memória', 'esquecer': 'problemas_de_memória',
    'ansiedade': 'ansiedade', 'depressao': 'depressão', 'depressão': 'depressão',
    'rigidez': 'rigidez_muscular', 'rigido': 'rigidez_muscular', 'caminhar': 'dificuldade_para_caminhar',
    'andar': 'dificuldade_para_caminhar', 'quedas': 'quedas_frequentes', 'cair': 'quedas_frequentes',
    'palpitacoes': 'palpitações', 'palpitações': 'palpitações', 'cardiaco': 'palpitações',
    'cardíaco': 'palpitações', 'escoliose': 'escoliose', 'coluna': 'dor_nas_costas',
    'costas': 'dor_nas_costas', 'olhos': 'visao_embaçada', 'ptose': 'ptose_palpebral',
    'palpebra': 'ptose_palpebral', 'pálpebra': 'ptose_palpebral', 'fraqueza facial': 'fraqueza_facial',
    'fala': 'dificuldade_para_falar', 'falar': 'dificuldade_para_falar', 'engolir': 'dificuldade_para_engolir',
    'baço': 'esplenomegalia', 'figado': 'hepatomegalia', 'fígado': 'hepatomegalia',
    'dor osso': 'dor_óssea', 'osso': 'dor_óssea', 'fratura': 'fraturas_frequentes',
    'sangramento': 'sangramento_excessivo', 'anemia': 'anemia', 'febre': 'febre_recorrente',
    'hipermobilidade': 'hipermobilidade_articular', 'articulacao flexivel': 'hipermobilidade_articular',
    'pele elastica': 'pele_hiperelástica', 'cicatriz': 'cicatrização_lenta', 'insonia': 'insônia',
    'insônia': 'insônia', 'dormir': 'insônia', 'perda de peso': 'perda_de_peso',
    'emagrecer': 'perda_de_peso', 'autismo': 'atraso_no_desenvolvimento_intelectual',
    'atraso': 'atraso_no_desenvolvimento_motor', 'desenvolvimento': 'atraso_no_desenvolvimento_motor',
    'altura': 'estatura_alta', 'alto': 'estatura_alta', 'braços longos': 'membros_longos',
    'pernas longas': 'membros_longos', 'coração': 'palpitações', 'sopro': 'sopro_cardíaco',
    'urina escura': 'urina_avermelhada', 'urina': 'urina_avermelhada', 'dor extremidade': 'dor_nas_extremidades',
    'mao': 'crescimento_das_mãos_e_pés', 'pé grande': 'crescimento_das_mãos_e_pés',
  };

  for (const [keyword, symptomId] of Object.entries(keywordMap)) {
    const kNorm = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(kNorm)) {
      matched.push(symptomId);
    }
  }

  // Also try fuzzy match against loaded symptom list
  if (allSymptoms.length) {
    for (const s of allSymptoms) {
      const lbl = s.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = lbl.split(/\s+/);
      for (const w of words) {
        if (w.length > 4 && lower.includes(w)) {
          matched.push(s.id);
          break;
        }
      }
    }
  }

  return [...new Set(matched)];
}

function parseFamilyConditions(text) {
  const lower = text.toLowerCase();
  const map = {
    'anemia': 'anemia_falciforme', 'sangue': 'anemia_hemolítica', 'cardiaco': 'problemas_cardíacos',
    'cardíaco': 'problemas_cardíacos', 'coração': 'problemas_cardíacos', 'neurologica': 'problemas_neurológicos',
    'neurológica': 'problemas_neurológicos', 'neurologico': 'problemas_neurológicos',
    'muscular': 'doença_muscular', 'musculo': 'doença_muscular', 'hepatica': 'doença_hepática',
    'hepática': 'doença_hepática', 'figado': 'doença_hepática', 'fígado': 'doença_hepática',
    'autoimune': 'doenças_autoimunes', 'genetica': 'historico_familiar', 'genética': 'historico_familiar',
  };
  const found = [];
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) found.push(v);
  }
  return found.length ? found : ['doença_não_especificada'];
}

function parseRiskFactors(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map = {
    'familiar': 'historico_familiar', 'genetica': 'historico_familiar', 'genetico': 'historico_familiar',
    'autoimune': 'doenças_autoimunes', 'africana': 'ascendência_africana', 'africano': 'ascendência_africana',
    'mediterranea': 'ascendência_mediterrânea', 'mediterraneo': 'ascendência_mediterrânea',
    'judaica': 'ascendência_judaica_ashkenazi', 'ashkenazi': 'ascendência_judaica_ashkenazi',
    'medicamento': 'uso_de_certos_medicamentos', 'remedio': 'uso_de_certos_medicamentos',
    'tabagismo': 'tabagismo', 'fumo': 'tabagismo', 'fumante': 'tabagismo',
  };
  const found = [];
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) found.push(v);
  }
  return found;
}

async function processDiagnosis() {
  setProgress(90);
  clearQuickReplies();
  enableInput(false);

  showTyping(1200, async () => {
    addBotMessage('Analisando suas informações... 🔬');

    const payload = {
      patient: {
        name: chatState.name,
        age: chatState.age || 30,
        sex: chatState.sex || 'outro',
        ethnicity: '',
        chief_complaint: chatState.symptomsRaw,
        location: chatState.location,
        exams: chatState.examsRaw,
        duration: chatState.duration,
      },
      family_history: {
        conditions: chatState.familyConditions,
        consanguinity: false,
        notes: '',
      },
      symptoms: chatState.matchedSymptoms.length ? chatState.matchedSymptoms : ['fadiga'],
      risk_factors: chatState.riskFactors,
    };

    try {
      const resp = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      setProgress(100);

      setTimeout(() => {
        if (!data.success || !data.results?.length) {
          addBotMessage('Não encontrei correspondências relevantes com os sintomas informados. Por favor, consulte um médico.');
          return;
        }

        window._lastResults = data;
        window._lastPayload = payload;
        sessionStorage.setItem('ariadne_results', JSON.stringify(data));
        sessionStorage.setItem('ariadne_payload', JSON.stringify(payload));

        // Filtra só Alta Prioridade (>= 75%) para mostrar ao paciente
        const highPriority = data.results.filter(r => r.score >= 75);
        const total = data.total_found;

        showTyping(1000, () => {
          if (highPriority.length === 0) {
            addBotMessage(`Analisei <strong>${total}</strong> possível(is) condição(ões). Nenhuma atingiu alta compatibilidade com seus sintomas (acima de 75%).`);
            setTimeout(() => {
              addBotMessage('Isso pode indicar que sua condição precisa de mais sintomas para uma triagem precisa, ou que está fora do nosso banco atual. <strong>Procure um médico para avaliação.</strong>');
              addBotMessage('O relatório completo com todas as hipóteses foi enviado para o agente de saúde da sua região. 📋');
              setQuickReplies(['Nova triagem', 'Ver relatório completo']);
              enableInput(true, 'Sua pergunta...');
            }, 800);
          } else {
            addBotMessage(`De <strong>${total}</strong> condição(ões) analisadas, <strong>${highPriority.length}</strong> apresentou alta compatibilidade (acima de 75%) com seus sintomas:`);
            setTimeout(() => {
              addResultsCard(highPriority);
            }, 600);
          }
        });
      }, 800);

    } catch (err) {
      addBotMessage('Ocorreu um erro ao processar sua triagem. Por favor, tente novamente.');
      enableInput(false);
    }
  });
}

function addResultsCard(results) {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;

  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.style.maxWidth = '100%';
  div.style.width = '100%';

  let html = `<div class="results-summary-card">
    <div class="results-summary-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      🔴 Alta Prioridade — acima de 75% de compatibilidade
    </div>`;

  for (const r of results) {
    const p = getPriority(r.score);
    const patientDesc = simplifyDescription(r.description);
    const symMatched  = (r.matched_symptoms || []).slice(0, 4).map(s => s.replace(/_/g, ' ')).join(', ');

    html += `
    <div class="result-item-full">
      <div class="result-item-top">
        <div class="result-info">
          <div class="result-name">${r.name}</div>
          <div class="result-cat">${r.category}${r.orphanet_code ? ' · ' + r.orphanet_code : ''}</div>
        </div>
        <div class="prob-badge-wrap">
          <div class="result-score-badge ${p.scoreClass}">${r.score}%</div>
          <div class="prob-label ${p.txtClass}">${p.label}</div>
        </div>
      </div>
      <div class="result-item-body">
        <p class="result-patient-desc">${patientDesc}</p>
        ${symMatched ? `<div class="result-matched-sym"><span class="matched-label">Sintomas em comum:</span> ${symMatched}</div>` : ''}
        <div class="prob-bar-wrap">
          <div class="prob-bar-track">
            <div class="prob-bar-fill ${p.barClass}" style="width:${r.score}%"></div>
          </div>
          <span class="prob-bar-pct">${r.score}%</span>
        </div>
        <p class="prob-hint">Seus sintomas têm forte correspondência com essa condição — leve ao médico com atenção.</p>
        ${r.has_red_flags ? `<div class="red-flag-pill">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Sinal de alerta — mencione ao médico com urgência
        </div>` : ''}
      </div>
    </div>`;
  }

  html += `
    <div class="results-footer-note">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Estas são <strong>hipóteses de triagem</strong>, não diagnósticos. Apenas um médico pode confirmar.
    </div>
    <button class="report-btn" onclick="openDashboardReport()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      Ver relatório completo para o agente de saúde
    </button>
  </div>`;

  div.innerHTML = html;
  wrap.appendChild(div);

  setTimeout(() => {
    showTyping(900, () => {
      addBotMessage('📋 <strong>Próximo passo:</strong> Um relatório completo foi preparado para o agente de saúde da sua região' + (chatState.location ? ` <strong>(${chatState.location})</strong>` : '') + '. Ele vai encaminhar você ao especialista correto.');
      setTimeout(() => {
        addBotMessage('Posso ajudar com mais alguma coisa?');
        setQuickReplies(['Nova triagem', 'Ver relatório completo', 'O que significa cada doença?']);
        enableInput(true, 'Sua pergunta...');
      }, 900);
    });
  }, 400);

  scrollToBottom();
}

/* Simplifica descrições técnicas para linguagem do paciente */
function simplifyDescription(desc) {
  if (!desc) return '';
  // Trunca em 120 chars e remove jargão excessivo
  let s = desc
    .replace(/Distúrbio hereditário/gi, 'Condição hereditária')
    .replace(/Distúrbio genético/gi, 'Condição genética')
    .replace(/Distúrbio metabólico/gi, 'Problema no metabolismo')
    .replace(/Distúrbio cromossômico/gi, 'Alteração cromossômica')
    .replace(/Distúrbio neurológico/gi, 'Condição neurológica')
    .replace(/Distúrbio endócrino/gi, 'Problema hormonal')
    .replace(/causada pela deficiência da enzima/gi, 'onde falta a enzima')
    .replace(/caracterizado por/gi, 'que causa');
  return s.length > 140 ? s.substring(0, 137) + '...' : s;
}

function openDashboardReport() {
  if (window._lastResults) {
    sessionStorage.setItem('ariadne_results', JSON.stringify(window._lastResults));
    sessionStorage.setItem('ariadne_payload', JSON.stringify(window._lastPayload));
  }
  window.open('/dashboard', '_blank');
}

/* ── Chat UI helpers ── */
function addBotMessage(html) {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `
    <div class="msg-avatar">A</div>
    <div class="msg-bubble">${html}</div>`;
  wrap.appendChild(div);
  scrollToBottom();
}

function addUserMessage(text) {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.innerHTML = `
    <div class="msg-avatar">Eu</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>`;
  wrap.appendChild(div);
  scrollToBottom();
}

function showTyping(delay, cb) {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) { cb?.(); return; }
  const dot = document.createElement('div');
  dot.className = 'chat-msg bot';
  dot.id = 'typing-indicator';
  dot.innerHTML = `
    <div class="msg-avatar">A</div>
    <div class="typing-indicator"><span></span><span></span><span></span></div>`;
  wrap.appendChild(dot);
  scrollToBottom();
  setTimeout(() => {
    dot.remove();
    cb?.();
  }, delay);
}

function clearMessages() {
  const wrap = document.getElementById('chat-messages');
  if (wrap) wrap.innerHTML = '';
}

function enableInput(on, placeholder) {
  const inp = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send');
  if (!inp || !btn) return;
  inp.disabled = !on;
  btn.disabled = !on;
  if (placeholder) inp.placeholder = placeholder;
  if (on) setTimeout(() => inp.focus(), 100);
}

function setQuickReplies(options) {
  const wrap = document.getElementById('quick-replies');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.className = 'quick-chip';
    btn.textContent = opt;
    btn.addEventListener('click', () => handleUserInput(opt));
    wrap.appendChild(btn);
  }
}

function clearQuickReplies() {
  const wrap = document.getElementById('quick-replies');
  if (wrap) wrap.innerHTML = '';
}

function setProgress(pct) {
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = pct + '%';
}

function scrollToBottom() {
  const wrap = document.getElementById('chat-messages');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Chat send button & enter ── */
document.getElementById('chat-send')?.addEventListener('click', () => {
  const inp = document.getElementById('chat-input');
  if (!inp || inp.disabled) return;
  const val = inp.value.trim();
  if (!val) return;
  inp.value = '';
  inp.style.height = 'auto';
  handleUserInput(val);
});

document.getElementById('chat-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('chat-send')?.click();
  }
});

// Auto-resize textarea
document.getElementById('chat-input')?.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

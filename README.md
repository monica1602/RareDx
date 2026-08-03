# ⚕️ RareDx — Diagnóstico Diferencial de Doenças Raras

> Ferramenta web de apoio clínico para identificação de possíveis doenças raras com base em dados do paciente, histórico familiar e sintomas.

🔗 **Site ao vivo:** [https://raredx.onrender.com](https://raredx.onrender.com)

---

## 📋 Sobre o Projeto

O **RareDx** é uma aplicação web que auxilia na triagem de doenças raras por meio de um formulário estruturado em 4 etapas. O sistema cruza os dados inseridos com uma base clínica de referência e retorna uma lista ranqueada de possíveis condições, com informações detalhadas sobre cada uma.

Doenças raras afetam menos de 1 em cada 2.000 pessoas e frequentemente levam anos para serem diagnosticadas. O RareDx foi criado para apoiar esse processo de forma rápida e acessível.

> ⚠️ **Aviso:** Esta ferramenta é apenas informativa e **não substitui avaliação médica especializada**. Em caso de sintomas graves, procure atendimento médico imediatamente.

---

## ✨ Funcionalidades

- **Formulário em 4 etapas guiadas**
  - Dados do paciente (idade, sexo, etnia, queixa principal)
  - Histórico familiar (condições hereditárias, consanguinidade)
  - Seleção de sintomas com busca em tempo real
  - Resultado com ranking de doenças

- **Motor de diagnóstico ponderado**
  - Sintomas: 60% do score
  - Histórico familiar: 25% do score
  - Fatores de risco: 15% do score
  - Bônus por sinais de alerta clínicos (red flags)

- **Cards de resultado detalhados**
  - Score visual em anel circular
  - Sintomas correspondentes destacados
  - Informações clínicas (prevalência, herança genética, idade de início)
  - Link direto para o Orphanet
  - Alertas visuais para red flags

- **Base de dados com 20 doenças raras catalogadas**
- **199 sintomas disponíveis em português**
- **Design responsivo** para desktop e mobile

---

## 🧬 Doenças na Base de Dados

| Doença | Categoria | Prevalência |
|--------|-----------|-------------|
| Síndrome de Marfan | Tecido Conjuntivo | 1:5.000 |
| Síndrome de Ehlers-Danlos | Tecido Conjuntivo | 1:5.000 |
| Doença de Wilson | Distúrbio Metabólico | 1:30.000 |
| Doença de Pompe | Depósito Lisossômico | 1:40.000 |
| Doença de Huntington | Neurodegenerativa | 1:10.000 |
| Fenilcetonúria (PKU) | Distúrbio Metabólico | 1:10.000 |
| Doença de Niemann-Pick | Depósito Lisossômico | 1:250.000 |
| Doença de Gaucher | Depósito Lisossômico | 1:40.000 |
| Doença de Fabry | Depósito Lisossômico | 1:117.000 |
| Síndrome de Turner | Cromossômica | 1:2.500 |
| Síndrome de Progéria | Envelhecimento | 1:8.000.000 |
| Acromegalia | Endócrino | 1:20.000 |
| Síndrome da Pessoa Rígida | Neurológico Autoimune | 1:1.000.000 |
| Deficiência de Alfa-1 Antitripsina | Genético | 1:2.500 |
| Miastenia Grave | Neuromuscular | 1:5.000 |
| Síndrome de Rett | Neurodesenvolvimento | 1:10.000 |
| Porfiria Aguda Intermitente | Distúrbio Metabólico | 1:20.000 |
| Anemia Falciforme | Hemoglobinopatia | variável |
| Fibrose Cística | Genético Multissistêmico | 1:2.500 |
| Síndromes de Febre Periódica | Autoinflamatório | desconhecida |

---

## 🛠️ Tecnologias

**Backend**
- [Python 3.10](https://www.python.org/)
- [Flask 3.0](https://flask.palletsprojects.com/)
- [Flask-CORS](https://flask-cors.readthedocs.io/)
- [Gunicorn](https://gunicorn.org/) (produção)

**Frontend**
- HTML5 + CSS3 (puro, sem frameworks)
- JavaScript ES6+ (vanilla, sem dependências)
- Google Fonts — Inter

**Deploy**
- [Render](https://render.com) (hosting)
- [GitHub](https://github.com/monica1602/RareDx) (repositório)

---

## 🚀 Rodar Localmente

**Pré-requisitos:** Python 3.10+

```bash
# 1. Clone o repositório
git clone https://github.com/monica1602/RareDx.git
cd RareDx

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Inicie o servidor
python app.py
```

Acesse **http://localhost:5000** no navegador.

---

## 📡 API REST

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/symptoms` | Lista todos os sintomas disponíveis |
| `GET` | `/api/diseases` | Lista todas as doenças na base |
| `GET` | `/api/disease/<id>` | Detalhes de uma doença específica |
| `POST` | `/api/diagnose` | Executa o diagnóstico diferencial |

**Exemplo de requisição — POST /api/diagnose:**
```json
{
  "patient": { "age": 30, "sex": "masculino" },
  "family_history": { "conditions": ["wilson"], "consanguinity": false },
  "symptoms": ["fadiga", "tremores", "icterícia", "hepatomegalia"],
  "risk_factors": ["historico_familiar"]
}
```

**Exemplo de resposta:**
```json
{
  "success": true,
  "total_found": 5,
  "results": [
    {
      "name": "Doença de Wilson",
      "score": 53.7,
      "rarity": "Rara (< 1:2.000)",
      "matched_symptoms": ["fadiga", "tremores", "icterícia", "hepatomegalia"],
      "red_flags": ["anéis_de_kayser_fleischer"],
      "urgency": { "label": "Alta Prioridade", "icon": "🔴" }
    }
  ]
}
```

---

## 📁 Estrutura do Projeto

```
RareDx/
├── app.py                  # Backend Flask — rotas REST
├── disease_data.py         # Base de dados de doenças e sintomas
├── diagnosis_engine.py     # Motor de pontuação e diagnóstico
├── requirements.txt        # Dependências Python
├── Procfile                # Configuração Gunicorn
├── render.yaml             # Configuração de deploy no Render
├── templates/
│   └── index.html          # Interface principal (4 etapas)
└── static/
    ├── styles.css          # Estilos responsivos
    └── app.js              # Lógica do frontend
```

---

## 📚 Fontes de Referência

- [Orphanet](https://www.orpha.net) — Base de dados europeia de doenças raras
- [OMIM](https://www.omim.org) — Catálogo de doenças genéticas humanas
- [NORD](https://rarediseases.org) — Organização Nacional para Doenças Raras

---

## 📄 Licença

Este projeto é de uso educacional e informativo. Distribuído sob a licença MIT.

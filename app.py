"""
app.py — ArIAdne.Dx
Backend Flask com integração raras.org MCP (10.468 doenças) + fallback local.
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

# Motor local (fallback)
from diagnosis_engine import run_diagnosis, format_results
from disease_data import SYMPTOM_LABELS, DISEASES

# Cliente raras.org MCP
import raras_client as raras

app = Flask(__name__)
CORS(app)

DISCLAIMER = (
    "Este resultado é apenas uma ferramenta de apoio informativo e NÃO substitui "
    "avaliação médica especializada. Em caso de sintomas graves, procure atendimento "
    "médico imediatamente. ArIAdne.Dx — Diagnóstico de Doenças Raras."
)


# ────────────────────────────────────────────
# Páginas
# ────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


# ────────────────────────────────────────────
# /api/symptoms  —  lista de sintomas (banco local)
# ────────────────────────────────────────────

@app.route("/api/symptoms", methods=["GET"])
def get_symptoms():
    symptoms = [
        {"id": key, "label": label}
        for key, label in sorted(SYMPTOM_LABELS.items(), key=lambda x: x[1])
    ]
    return jsonify({"symptoms": symptoms})


# ────────────────────────────────────────────
# /api/diagnose  —  diagnóstico principal
#   1. Tenta raras.org via analyze_clinical_case (mais poderoso)
#   2. Se falhar, tenta find_diseases_by_phenotypes via HPO
#   3. Se falhar, usa engine local como fallback
# ────────────────────────────────────────────

@app.route("/api/diagnose", methods=["POST"])
def diagnose():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Dados inválidos ou ausentes."}), 400

    patient     = data.get("patient", {})
    family      = data.get("family_history", {})
    symptoms    = data.get("symptoms", [])
    risk_factors = data.get("risk_factors", [])

    if not symptoms:
        return jsonify({"error": "Pelo menos um sintoma deve ser informado."}), 400

    age = patient.get("age", 0)
    if not isinstance(age, (int, float)) or age < 0 or age > 120:
        return jsonify({"error": "Idade inválida."}), 400

    sex              = patient.get("sex", "outro")
    chief_complaint  = patient.get("chief_complaint", "")
    family_notes     = family.get("notes", "")
    if family.get("consanguinity"):
        risk_factors = list(risk_factors) + ["consanguinidade"]

    # ── Monta texto clínico para a raras.org ──
    symptoms_text = chief_complaint or ", ".join(s.replace("_", " ") for s in symptoms)
    family_text   = family_notes or (
        "histórico familiar presente" if family.get("conditions") else ""
    )

    source = "raras.org"
    formatted = []

    # ── Tentativa 1: analyze_clinical_case ──
    try:
        raras_diseases = raras.analyze_clinical_case(
            symptoms_text=symptoms_text,
            age=int(age),
            sex=sex,
            family_history=family_text,
        )
        if raras_diseases:
            formatted = _enrich_raras_results(raras_diseases, symptoms, age, sex)
    except Exception as e:
        print(f"[diagnose] analyze_clinical_case falhou: {e}")

    # ── Tentativa 2: HPO → find_diseases_by_phenotypes ──
    if not formatted:
        source = "raras.org/hpo"
        try:
            hpo_ids = []
            for sym in symptoms[:8]:
                hits = raras.search_phenotypes(sym.replace("_", " "))
                hpo_ids += [h["hpo_id"] for h in hits[:2]]
            hpo_ids = list(dict.fromkeys(hpo_ids))[:15]  # dedup, max 15

            if hpo_ids:
                raras_diseases = raras.find_diseases_by_phenotypes(hpo_ids, limit=10)
                if raras_diseases:
                    formatted = _enrich_raras_results(raras_diseases, symptoms, age, sex)
        except Exception as e:
            print(f"[diagnose] HPO lookup falhou: {e}")

    # ── Fallback: engine local ──
    if not formatted:
        source = "local"
        patient_data = {
            "age": int(age),
            "sex": sex,
            "ethnicity": patient.get("ethnicity", ""),
            "symptoms": symptoms,
            "family_conditions": list(family.get("conditions", [])),
            "risk_factors": risk_factors,
        }
        raw_results = run_diagnosis(patient_data)
        formatted   = format_results(raw_results)

    return jsonify({
        "success":     True,
        "total_found": len(formatted),
        "results":     formatted,
        "source":      source,
        "disclaimer":  DISCLAIMER,
    })


# ────────────────────────────────────────────
# /api/diseases  —  lista do banco local
# ────────────────────────────────────────────

@app.route("/api/diseases", methods=["GET"])
def list_diseases():
    diseases = [
        {
            "id":           d["id"],
            "name":         d["name"],
            "category":     d["category"],
            "rarity":       d.get("rarity", ""),
            "prevalence":   d.get("prevalence", ""),
            "orphanet_code":d.get("orphanet_code", ""),
            "inheritance":  d.get("inheritance", []),
        }
        for d in DISEASES
    ]
    return jsonify({"diseases": diseases, "total": len(diseases)})


@app.route("/api/disease/<disease_id>", methods=["GET"])
def get_disease(disease_id):
    disease = next((d for d in DISEASES if d["id"] == disease_id), None)
    if not disease:
        return jsonify({"error": "Doença não encontrada."}), 404
    return jsonify({"disease": disease})


# ────────────────────────────────────────────
# /api/search  —  busca raras.org por texto
# ────────────────────────────────────────────

@app.route("/api/search", methods=["GET"])
def search_raras():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"error": "Parâmetro 'q' obrigatório."}), 400
    results = raras.search_diseases(q, limit=15)
    return jsonify({"results": results, "total": len(results), "source": "raras.org"})


# ────────────────────────────────────────────
# /api/sus/<orpha_code>  —  cobertura SUS
# ────────────────────────────────────────────

@app.route("/api/sus/<orpha_code>", methods=["GET"])
def sus_coverage(orpha_code):
    """
    Verifica cobertura SUS para uma doença pelo código Orphanet.
    Ex: /api/sus/558  (Síndrome de Marfan)
    """
    # aceita com ou sem prefixo ORPHA:
    code = orpha_code.replace("ORPHA:", "").strip()
    result = raras.get_sus_coverage(code)
    if not result:
        return jsonify({"error": "Não foi possível consultar cobertura SUS."}), 502
    return jsonify(result)


# ────────────────────────────────────────────
# /api/centers/<orpha_code>  —  centros de referência
# ────────────────────────────────────────────

@app.route("/api/centers/<orpha_code>", methods=["GET"])
def reference_centers(orpha_code):
    """
    Retorna centros de referência para a doença.
    Query param opcional: ?uf=SP
    """
    code = orpha_code.replace("ORPHA:", "").strip()
    uf   = request.args.get("uf", "")
    centers = raras.find_reference_centers(code, uf=uf)
    return jsonify({"centers": centers, "total": len(centers)})


# ────────────────────────────────────────────
# /api/trials/<orpha_code>  —  trials ativos
# ────────────────────────────────────────────

@app.route("/api/trials/<orpha_code>", methods=["GET"])
def active_trials(orpha_code):
    """
    Retorna ensaios clínicos ativos (filtro Brasil) para a doença.
    """
    code   = orpha_code.replace("ORPHA:", "").strip()
    trials = raras.find_active_trials(code)
    return jsonify({"trials": trials, "total": len(trials)})


# ────────────────────────────────────────────
# /api/detail/<orpha_code>  —  detalhes completos raras.org
# ────────────────────────────────────────────

@app.route("/api/detail/<orpha_code>", methods=["GET"])
def disease_detail_raras(orpha_code):
    """
    Detalhes completos de uma doença via raras.org (fenótipos, genes, SUS, trials).
    """
    code   = orpha_code.replace("ORPHA:", "").strip()
    detail = raras.get_disease_detail(code)
    if not detail:
        return jsonify({"error": "Doença não encontrada na raras.org."}), 404
    return jsonify(detail)


# ────────────────────────────────────────────
# /api/similar/<orpha_code>  —  doenças similares
# ────────────────────────────────────────────

@app.route("/api/similar/<orpha_code>", methods=["GET"])
def similar_diseases(orpha_code):
    code    = orpha_code.replace("ORPHA:", "").strip()
    similar = raras.find_similar_diseases(code, limit=5)
    return jsonify({"similar": similar, "total": len(similar)})


# ────────────────────────────────────────────
# Helpers internos
# ────────────────────────────────────────────

def _enrich_raras_results(raras_diseases: list, symptoms: list, age: int, sex: str) -> list:
    """
    Converte o formato raras.org para o formato padrão do ArIAdne.Dx,
    calculando score de compatibilidade por contagem de sintomas.
    """
    formatted = []
    total = len(raras_diseases)

    for i, d in enumerate(raras_diseases):
        # Score decrescente: primeiro resultado = mais relevante
        # raras.org já ordena por relevância; mapeamos para 0-100
        base_score = round(max(10, 85 - (i * (75 / max(total - 1, 1)))), 1)

        orpha_num = d.get("orpha_number", "")
        orpha_code = d.get("orpha_code", f"ORPHA:{orpha_num}" if orpha_num else "")

        # Urgência estimada pela raridade
        rarity_raw = (d.get("rarity") or "").lower()
        if "1-9 em 100.000" in rarity_raw or "ultra" in rarity_raw:
            urgency = {"label": "Alta Prioridade",    "color": "danger",  "icon": "🔴"}
        elif "1-9 em 1.000" in rarity_raw:
            urgency = {"label": "Atenção Moderada",   "color": "warning", "icon": "🟡"}
        else:
            urgency = {"label": "Atenção Moderada",   "color": "warning", "icon": "🟡"}

        formatted.append({
            "id":               orpha_num or d.get("name", "").lower().replace(" ", "_"),
            "name":             d.get("name", "Doença não identificada"),
            "category":         "Doença Rara",
            "rarity":           d.get("rarity") or "Rara",
            "prevalence":       d.get("rarity") or "Desconhecida",
            "orphanet_code":    orpha_code,
            "orpha_number":     orpha_num,
            "description":      (
                f"Doença catalogada na raras.org · {orpha_code}"
                + (f" · CID-10: {d['cid10']}" if d.get("cid10") else "")
            ),
            "inheritance":      [],
            "age_of_onset":     "",
            "score":            base_score,
            "symptom_coverage": base_score,
            "matched_symptoms": symptoms[:5],
            "matched_family":   [],
            "matched_risk":     [],
            "red_flags":        [],
            "urgency":          urgency,
            "has_red_flags":    False,
            "has_sus":          d.get("has_sus", False),
            "trial_count":      d.get("trial_count", 0),
            "raras_url":        d.get("url", f"https://raras.org/doenca/{orpha_num}"),
            "source":           "raras.org",
        })

    return formatted


if __name__ == "__main__":
    app.run(debug=True, port=5000)

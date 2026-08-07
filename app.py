from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from diagnosis_engine import run_diagnosis, format_results
from disease_data import SYMPTOM_LABELS, DISEASES

app = Flask(__name__)
CORS(app)


@app.route("/")
def index():
    """Página principal com o chat de triagem."""
    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    """Painel médico com formulário clínico completo e relatório."""
    return render_template("dashboard.html")


@app.route("/api/symptoms", methods=["GET"])
def get_symptoms():
    """Retorna a lista completa de sintomas disponíveis."""
    symptoms = [
        {"id": key, "label": label}
        for key, label in sorted(SYMPTOM_LABELS.items(), key=lambda x: x[1])
    ]
    return jsonify({"symptoms": symptoms})


@app.route("/api/diagnose", methods=["POST"])
def diagnose():
    """
    Recebe dados do paciente e retorna diagnóstico diferencial.

    Body JSON esperado:
    {
        "patient": {
            "name": "...",
            "age": 30,
            "sex": "feminino|masculino|outro",
            "ethnicity": "...",
            "chief_complaint": "..."
        },
        "family_history": {
            "conditions": ["marfan", "anemia_falciforme", ...],
            "consanguinity": true/false,
            "notes": "..."
        },
        "symptoms": ["fadiga", "dor_abdominal", ...],
        "risk_factors": ["tabagismo", "historico_familiar", ...]
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Dados inválidos ou ausentes."}), 400

    patient = data.get("patient", {})
    family = data.get("family_history", {})
    symptoms = data.get("symptoms", [])
    risk_factors = data.get("risk_factors", [])

    # Validações básicas
    if not symptoms:
        return jsonify({"error": "Pelo menos um sintoma deve ser informado."}), 400

    age = patient.get("age", 0)
    if not isinstance(age, (int, float)) or age < 0 or age > 120:
        return jsonify({"error": "Idade inválida."}), 400

    # Montar dados internos para o engine
    family_conditions = list(family.get("conditions", []))
    if family.get("consanguinity"):
        risk_factors = list(risk_factors) + ["consanguinidade"]

    patient_data = {
        "age": int(age),
        "sex": patient.get("sex", ""),
        "ethnicity": patient.get("ethnicity", ""),
        "symptoms": symptoms,
        "family_conditions": family_conditions,
        "risk_factors": risk_factors,
    }

    raw_results = run_diagnosis(patient_data)
    formatted = format_results(raw_results)

    return jsonify({
        "success": True,
        "total_found": len(formatted),
        "results": formatted,
        "disclaimer": (
            "Este resultado é apenas uma ferramenta de apoio informativo e NÃO substitui "
            "avaliação médica especializada. Em caso de sintomas graves, procure atendimento "
            "médico imediatamente."
        )
    })


@app.route("/api/diseases", methods=["GET"])
def list_diseases():
    """Lista todas as doenças na base de dados."""
    diseases = [
        {
            "id": d["id"],
            "name": d["name"],
            "category": d["category"],
            "rarity": d.get("rarity", ""),
            "prevalence": d.get("prevalence", ""),
            "orphanet_code": d.get("orphanet_code", ""),
        }
        for d in DISEASES
    ]
    return jsonify({"diseases": diseases, "total": len(diseases)})


@app.route("/api/disease/<disease_id>", methods=["GET"])
def get_disease(disease_id):
    """Retorna detalhes completos de uma doença pelo ID."""
    disease = next((d for d in DISEASES if d["id"] == disease_id), None)
    if not disease:
        return jsonify({"error": "Doença não encontrada."}), 404
    return jsonify({"disease": disease})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

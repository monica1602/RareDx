# Motor de diagnóstico diferencial para doenças raras
# Usa sistema de pontuação ponderada considerando sintomas, histórico familiar,
# idade, sexo e fatores de risco

from disease_data import DISEASES


def calculate_score(disease: dict, patient_data: dict) -> dict:
    """
    Calcula a pontuação de correspondência entre os dados do paciente e uma doença.
    Retorna um dict com score total e detalhes da correspondência.
    """
    score = 0
    max_possible = 0
    matched_symptoms = []
    matched_family = []
    matched_risk = []
    red_flags_found = []

    patient_symptoms = set(patient_data.get("symptoms", []))
    patient_age = patient_data.get("age", 0)
    patient_sex = patient_data.get("sex", "")
    family_conditions = set(patient_data.get("family_conditions", []))
    risk_factors = set(patient_data.get("risk_factors", []))

    disease_symptoms = set(disease.get("symptoms", []))

    # --- Pontuação por sintomas (peso maior) ---
    total_disease_symptoms = len(disease_symptoms)
    if total_disease_symptoms > 0:
        max_possible += 60
        symptom_overlap = patient_symptoms & disease_symptoms
        matched_symptoms = list(symptom_overlap)
        symptom_ratio = len(symptom_overlap) / total_disease_symptoms
        score += symptom_ratio * 60

    # --- Pontuação por histórico familiar (peso alto) ---
    family_conds = set(disease.get("family_history_conditions", []))
    if family_conds:
        max_possible += 25
        family_overlap = family_conditions & family_conds
        matched_family = list(family_overlap)
        if family_overlap:
            score += min(len(family_overlap) / max(len(family_conds), 1), 1) * 25

    # --- Pontuação por fatores de risco ---
    disease_risks = set(disease.get("risk_factors", []))
    if disease_risks:
        max_possible += 15
        risk_overlap = risk_factors & disease_risks
        matched_risk = list(risk_overlap)
        if risk_overlap:
            score += min(len(risk_overlap) / max(len(disease_risks), 1), 1) * 15

    # --- Bônus por sexo compatível ---
    if patient_sex == "feminino" and "sexo_feminino" in disease.get("risk_factors", []):
        score += 5
    if patient_sex == "masculino" and "sexo_masculino" in disease.get("risk_factors", []):
        score += 5

    # --- Verificar red flags (aumenta score drasticamente se presente) ---
    disease_red_flags = set(disease.get("red_flags", []))
    for flag in disease_red_flags:
        if flag in patient_symptoms:
            red_flags_found.append(flag)
            score += 20  # bônus significativo por red flag

    # --- Ajuste por idade ---
    onset = disease.get("age_of_onset", "qualquer_idade")
    age_bonus = _age_match(patient_age, onset)
    score += age_bonus

    # Normalizar para 0-100
    if max_possible > 0:
        normalized = min((score / (max_possible + 25)) * 100, 100)
    else:
        normalized = 0

    # Mínimo de sintomas para considerar relevante
    if len(matched_symptoms) == 0:
        normalized = 0

    return {
        "disease": disease,
        "score": round(normalized, 1),
        "matched_symptoms": matched_symptoms,
        "matched_family": matched_family,
        "matched_risk": matched_risk,
        "red_flags": red_flags_found,
        "symptom_coverage": round(len(matched_symptoms) / max(len(disease_symptoms), 1) * 100, 1),
    }


def _age_match(age: int, onset: str) -> float:
    """Retorna bônus de pontuação conforme compatibilidade da idade."""
    if onset == "qualquer_idade":
        return 3
    if onset == "infância" and age < 12:
        return 8
    if onset == "infância_precoce" and age < 6:
        return 8
    if onset == "infância_ou_adolescência" and age < 18:
        return 8
    if onset == "adolescência" and 10 <= age <= 20:
        return 8
    if onset == "adulto_jovem" and 15 <= age <= 35:
        return 8
    if onset == "adulto" and age >= 18:
        return 5
    if onset == "30_a_50_anos" and 25 <= age <= 55:
        return 8
    if onset == "5_a_35_anos" and 5 <= age <= 40:
        return 8
    if onset == "nascimento_ou_infância" and age <= 15:
        return 8
    return 0


def run_diagnosis(patient_data: dict) -> list:
    """
    Executa o diagnóstico diferencial para todos os dados do paciente.
    Retorna lista ordenada por score (maior primeiro), filtrando resultados relevantes.
    """
    results = []

    for disease in DISEASES:
        result = calculate_score(disease, patient_data)
        if result["score"] > 0:
            results.append(result)

    # Ordenar por score decrescente
    results.sort(key=lambda x: x["score"], reverse=True)

    # Retornar top 10 resultados com score > 5
    filtered = [r for r in results if r["score"] > 5]
    return filtered[:10]


def get_urgency_label(urgency: str) -> dict:
    """Retorna label e cor para o nível de urgência."""
    map_ = {
        "alta": {"label": "Alta Prioridade", "color": "danger", "icon": "🔴"},
        "moderada": {"label": "Atenção Moderada", "color": "warning", "icon": "🟡"},
        "baixa": {"label": "Baixa Urgência", "color": "success", "icon": "🟢"},
    }
    return map_.get(urgency, {"label": "Desconhecida", "color": "secondary", "icon": "⚪"})


def get_rarity_label(rarity: str) -> str:
    """Retorna descrição amigável da raridade."""
    map_ = {
        "ultra_rara": "Ultra Rara (< 1:100.000)",
        "rara": "Rara (< 1:2.000)",
        "incomum": "Incomum",
    }
    return map_.get(rarity, rarity)


def format_results(raw_results: list) -> list:
    """Formata os resultados para exibição no frontend."""
    formatted = []
    for r in raw_results:
        d = r["disease"]
        urgency_info = get_urgency_label(d.get("urgency", "baixa"))
        formatted.append({
            "id": d["id"],
            "name": d["name"],
            "category": d["category"],
            "rarity": get_rarity_label(d.get("rarity", "")),
            "prevalence": d.get("prevalence", "Desconhecida"),
            "orphanet_code": d.get("orphanet_code", ""),
            "description": d["description"],
            "inheritance": d.get("inheritance", []),
            "age_of_onset": d.get("age_of_onset", ""),
            "score": r["score"],
            "symptom_coverage": r["symptom_coverage"],
            "matched_symptoms": r["matched_symptoms"],
            "matched_family": r["matched_family"],
            "matched_risk": r["matched_risk"],
            "red_flags": r["red_flags"],
            "urgency": urgency_info,
            "has_red_flags": len(r["red_flags"]) > 0,
        })
    return formatted

"""
raras_client.py
Cliente para a API MCP da raras.org (Brazilian Rare Disease Knowledge Graph)
Endpoint: https://raras.org/api/mcp  —  JSON-RPC 2.0 over streamable-HTTP
"""

import json
import re
import requests
from typing import Optional

MCP_URL = "https://raras.org/api/mcp"
TIMEOUT = 12  # segundos

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "User-Agent": "ArIAdne.Dx/1.0",
}

_id_counter = 0


def _next_id() -> int:
    global _id_counter
    _id_counter += 1
    return _id_counter


def _call(tool: str, arguments: dict) -> Optional[dict]:
    """
    Faz uma chamada JSON-RPC ao MCP e devolve o resultado parseado.
    O MCP devolve text/event-stream; extrai o payload do campo 'data:'.
    Retorna None em caso de erro.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": _next_id(),
        "method": "tools/call",
        "params": {"name": tool, "arguments": arguments},
    }
    try:
        resp = requests.post(MCP_URL, json=payload, headers=HEADERS, timeout=TIMEOUT)
        raw = resp.text or ""

        # Extrai JSON do campo "data: {...}" do event-stream
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                json_str = line[5:].strip()
                obj = json.loads(json_str)
                # Chega como {"result": {"content": [{"type":"text","text":"..."}]}, ...}
                content = obj.get("result", {}).get("content", [])
                if content and content[0].get("type") == "text":
                    return content[0]["text"]

        # Fallback: tenta parsear direto
        return json.loads(raw).get("result", {}).get("content", [{}])[0].get("text")
    except Exception as e:
        print(f"[raras_client] Erro em {tool}: {e}")
        return None


# ──────────────────────────────────────────────
# Funções públicas
# ──────────────────────────────────────────────

def search_phenotypes(query: str) -> list[dict]:
    """
    Converte texto livre (PT/EN) em HPO IDs.
    Retorna lista de {"hpo_id": "HP:XXXXXXX", "label": "..."}
    """
    raw = _call("search_phenotypes", {"query": query, "limit": 10})
    if not raw:
        return []
    results = []
    # Formato do MCP: linhas "HP:XXXXXXX — Label"
    for line in raw.splitlines():
        line = line.strip()
        m = re.match(r"(HP:\d+)[^\w]+(.*)", line)
        if m:
            results.append({"hpo_id": m.group(1), "label": m.group(2).strip()})
    return results


def find_diseases_by_phenotypes(hpo_ids: list[str], limit: int = 10) -> list[dict]:
    """
    Busca doenças compatíveis com uma lista de HPO IDs.
    Retorna lista de doenças parseadas.
    """
    if not hpo_ids:
        return []
    raw = _call("find_diseases_by_phenotypes", {
        "hpo_ids": hpo_ids,
        "limit": limit,
    })
    return _parse_disease_list(raw)


def search_diseases(query: str, limit: int = 10) -> list[dict]:
    """
    Full-text search por nome de doença.
    """
    raw = _call("search_diseases", {"query": query, "limit": limit})
    return _parse_disease_list(raw)


def get_disease_detail(orpha_code: str) -> Optional[dict]:
    """
    Retorna detalhes completos de uma doença pelo código Orphanet.
    """
    raw = _call("get_disease_detail", {"orphaCode": orpha_code})
    if not raw:
        return None
    return {"raw": raw, "orpha_code": orpha_code}


def get_sus_coverage(orpha_code: str) -> Optional[dict]:
    """
    Verifica cobertura pelo SUS: CEAF, SIGTAP, PNTN, PCDT.
    """
    raw = _call("get_sus_coverage", {"orphaCode": orpha_code})
    if not raw:
        return None
    return _parse_sus(raw, orpha_code)


def find_reference_centers(orpha_code: str, uf: str = "") -> list[dict]:
    """
    Busca centros de referência para uma doença, opcionalmente por UF.
    """
    args = {"orphaCode": orpha_code}
    if uf:
        args["uf"] = uf.upper()
    raw = _call("find_reference_centers", args)
    return _parse_centers(raw)


def find_active_trials(orpha_code: str) -> list[dict]:
    """
    Trials clínicos ativos com filtro Brasil.
    """
    raw = _call("find_active_trials", {"orphaCode": orpha_code, "country": "BR"})
    return _parse_trials(raw)


def analyze_clinical_case(
    symptoms_text: str,
    age: int,
    sex: str,
    family_history: str = "",
) -> list[dict]:
    """
    Análise de caso clínico completo: texto livre → doenças + literatura.
    Mais poderoso que busca por HPO — usa LLM interno da raras.org.
    """
    case_text = f"Paciente: {age} anos, sexo {sex}.\nSintomas: {symptoms_text}."
    if family_history:
        case_text += f"\nHistórico familiar: {family_history}."
    raw = _call("analyze_clinical_case", {"text": case_text, "limit": 10})
    return _parse_disease_list(raw)


def find_similar_diseases(orpha_code: str, limit: int = 5) -> list[dict]:
    """
    Doenças similares por similaridade semântica (vector).
    """
    raw = _call("find_similar_diseases", {"orphaCode": orpha_code, "limit": limit})
    return _parse_disease_list(raw)


# ──────────────────────────────────────────────
# Parsers internos
# ──────────────────────────────────────────────

def _parse_disease_list(raw: Optional[str]) -> list[dict]:
    """
    Extrai lista de doenças do texto markdown retornado pelo MCP.
    Formato típico:
      **Nome da Doença** (ORPHA:XXXX · MONDO:XXXX · CID10:XXX)
        Rara (1-9 em 100.000) — SUS 🧪 N trials
        https://raras.org/doenca/XXXX
    """
    if not raw:
        return []
    diseases = []
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Linha de nome começa com **
        m_name = re.match(r"\*\*(.+?)\*\*\s*\(([^)]+)\)", line)
        if m_name:
            name = m_name.group(1).strip()
            codes_str = m_name.group(2)

            # Extrai códigos
            orpha = re.search(r"ORPHA:(\d+)", codes_str)
            cid10 = re.search(r"CID10:([\w.]+)", codes_str)
            mondo = re.search(r"MONDO:(\S+)", codes_str)

            orpha_code = orpha.group(1) if orpha else ""
            cid10_code = cid10.group(1) if cid10 else ""
            mondo_code = mondo.group(1) if mondo else ""

            # Linha seguinte: raridade, SUS, trials
            rarity = ""
            has_sus = False
            trial_count = 0
            url = ""

            for j in range(i + 1, min(i + 4, len(lines))):
                sub = lines[j].strip()
                if not sub:
                    continue
                if "rara" in sub.lower() or "comum" in sub.lower() or "unknown" in sub.lower():
                    rarity = sub.split("—")[0].strip()
                    has_sus = "SUS" in sub or "sus" in sub
                    m_trials = re.search(r"(\d+)\s+trials?", sub, re.IGNORECASE)
                    if m_trials:
                        trial_count = int(m_trials.group(1))
                if sub.startswith("http"):
                    url = sub

            diseases.append({
                "orpha_code": f"ORPHA:{orpha_code}" if orpha_code else "",
                "orpha_number": orpha_code,
                "name": name,
                "cid10": cid10_code,
                "mondo": mondo_code,
                "rarity": rarity,
                "has_sus": has_sus,
                "trial_count": trial_count,
                "url": url,
            })
        i += 1
    return diseases


def _parse_sus(raw: str, orpha_code: str) -> dict:
    """
    Extrai informações de cobertura SUS do texto retornado.
    """
    result = {
        "orpha_code": orpha_code,
        "covered": False,
        "ceaf": False,
        "sigtap": False,
        "pntn": False,
        "pcdt": False,
        "raw": raw,
    }
    if not raw:
        return result

    lower = raw.lower()
    result["covered"]  = any(k in lower for k in ["ceaf", "sigtap", "pntn", "pcdt", "sus"])
    result["ceaf"]     = "ceaf" in lower
    result["sigtap"]   = "sigtap" in lower
    result["pntn"]     = "pntn" in lower
    result["pcdt"]     = "pcdt" in lower
    return result


def _parse_centers(raw: Optional[str]) -> list[dict]:
    """
    Extrai lista de centros de referência do texto.
    """
    if not raw:
        return []
    centers = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Formato esperado: "Nome do Centro — UF — Cidade"
        parts = [p.strip() for p in re.split(r"[—–\-]{1,2}", line) if p.strip()]
        if parts:
            centers.append({
                "name": parts[0],
                "uf": parts[1] if len(parts) > 1 else "",
                "city": parts[2] if len(parts) > 2 else "",
                "raw": line,
            })
    return centers[:10]


def _parse_trials(raw: Optional[str]) -> list[dict]:
    """
    Extrai trials clínicos ativos do texto.
    """
    if not raw:
        return []
    trials = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"\*?\*?(.+?)\*?\*?\s*[\-—]?\s*(NCT\w+)?", line)
        if m and len(line) > 10:
            nct = re.search(r"NCT\d+", line)
            trials.append({
                "title": m.group(1).strip(" *"),
                "nct_id": nct.group(0) if nct else "",
                "raw": line,
            })
    return trials[:8]

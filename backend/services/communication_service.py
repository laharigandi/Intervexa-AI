import re
import math
from typing import Dict, List, Any, Optional

# Curated filler words and phrases with contextual boundary rules
FILLER_PATTERNS = {
    "um": re.compile(r"\b(um+)\b", re.IGNORECASE),
    "uh": re.compile(r"\b(uh+|er+)\b", re.IGNORECASE),
    "you know": re.compile(r"\b(you\s+know)\b", re.IGNORECASE),
    "basically": re.compile(r"\b(basically)\b", re.IGNORECASE),
    "actually": re.compile(r"\b(actually)\b", re.IGNORECASE),
    "i mean": re.compile(r"\b(i\s+mean)\b", re.IGNORECASE),
}

# Contextual pattern for "like" as a filler:
# Avoids counting "like" when used as a preposition ("such as / like"),
# or comparison ("looks like", "sounds like", "feels like", "would like", "like to").
_LIKE_LEGITIMATE_PRECEDING = re.compile(
    r"\b(look|looks|looked|sound|sounds|sounded|feel|feels|felt|seem|seems|seemed|would|should|could|i|we|they|you)\s+like\b",
    re.IGNORECASE
)
_LIKE_LEGITIMATE_FOLLOWING = re.compile(
    r"\blike\s+(to|a|an|the|this|that|these|those)\b",
    re.IGNORECASE
)
_LIKE_ALL = re.compile(r"\b(like)\b", re.IGNORECASE)

BEHAVIORAL_KEYWORDS = [
    "tell me about a time",
    "describe a situation",
    "describe a time",
    "how did you handle",
    "give an example of",
    "walk me through an instance",
    "conflict",
    "challenge you faced",
    "disagreement",
    "failure",
    "leadership",
    "deadline",
    "mistake you made",
]


def detect_filler_words(text: str) -> Dict[str, Any]:
    """
    Analyzes text for common filler words and phrases using word-boundary matching.
    Applies contextual checks to prevent overcounting valid grammatical uses.
    Returns counts per filler, total count, density percentage, and actionable tips.
    """
    if not text or not isinstance(text, str):
        return {
            "total_fillers": 0,
            "counts": {"um": 0, "uh": 0, "like": 0, "you know": 0, "basically": 0, "actually": 0},
            "density_percent": 0.0,
            "detected_list": [],
            "tips": [],
            "is_estimate": True,
        }

    cleaned = text.strip()
    words = re.findall(r"\b[A-Za-z0-9'-]+\b", cleaned)
    total_words = len(words)

    counts = {}
    total_fillers = 0

    # 1. Match direct patterns: um, uh, you know, basically, actually
    for name, pattern in FILLER_PATTERNS.items():
        matches = pattern.findall(cleaned)
        count = len(matches)
        counts[name] = count
        total_fillers += count

    # 2. Match contextual "like" as a filler:
    # A filler "like" is typically used as verbal hesitation (e.g., ", like,", "^Like,", "um, like", "like um").
    # It is NOT a filler when used as a preposition ("tools like Docker", "caching like Redis") or verb ("would like", "looks like").
    all_likes = list(_LIKE_ALL.finditer(cleaned))
    filler_like_count = 0
    for m in all_likes:
        start, end = m.start(), m.end()
        prefix = cleaned[max(0, start - 25):start]
        suffix = cleaned[end:min(len(cleaned), end + 25)]

        if _LIKE_LEGITIMATE_PRECEDING.search(prefix + "like"):
            continue
        if _LIKE_LEGITIMATE_FOLLOWING.search("like" + suffix):
            continue

        has_comma_before = bool(re.search(r"[,;]\s*$", prefix))
        has_comma_after = bool(re.search(r"^\s*[,;]", suffix))
        has_hesitation_before = bool(re.search(r"\b(um+|uh+|er+)\s*$", prefix, re.IGNORECASE))
        has_hesitation_after = bool(re.search(r"^\s*(um+|uh+|er+)\b", suffix, re.IGNORECASE))
        is_sentence_start = bool(re.search(r"(?:^|[.!?]\s*)$", prefix)) and has_comma_after

        if (has_comma_before and has_comma_after) or is_sentence_start or has_hesitation_before or has_hesitation_after:
            filler_like_count += 1
        elif has_comma_before and re.search(r"^\s*(you know|basically|actually|kind of|sort of)\b", suffix, re.IGNORECASE):
            filler_like_count += 1

    counts["like"] = filler_like_count
    total_fillers += filler_like_count

    density = round((total_fillers / total_words * 100), 1) if total_words > 0 else 0.0

    detected_list = [f"{word} ({count}x)" for word, count in counts.items() if count > 0]

    tips = []
    if counts.get("um", 0) + counts.get("uh", 0) > 0:
        tips.append("Replace vocal pauses like 'um' or 'uh' with a silent 1-second pause to formulate your next thought calmly.")
    if counts.get("like", 0) > 0:
        tips.append("Be conscious of using 'like' as a verbal bridge; state comparisons directly or pause briefly.")
    if counts.get("basically", 0) + counts.get("actually", 0) > 0:
        tips.append("Eliminate qualifiers like 'basically' or 'actually'; speaking directly projects clarity and conviction.")
    if counts.get("you know", 0) > 0:
        tips.append("Avoid 'you know' to seek validation; trust that your structured explanation stands on its own.")
    if not tips and total_words >= 15:
        tips.append("Excellent fluency with minimal verbal fillers. Maintain this natural, controlled pacing.")

    return {
        "total_fillers": total_fillers,
        "counts": counts,
        "density_percent": density,
        "detected_list": detected_list,
        "tips": tips,
        "is_estimate": True,
    }


def is_behavioral_question(question: str) -> bool:
    """Detects if the question prompts a behavioral or situational response."""
    if not question:
        return False
    q_lower = question.lower()
    return any(k in q_lower for k in BEHAVIORAL_KEYWORDS)


def evaluate_answer_structure(question: str, answer: str) -> Dict[str, Any]:
    """
    Evaluates whether the candidate's answer follows a coherent structure:
    - Direct opening statement
    - Logical explanation/progression
    - Concrete example/evidence
    - Clear conclusion/summary
    For behavioral questions, evaluates and guides the STAR format.
    """
    if not answer or len(answer.strip().split()) < 4:
        return {
            "score": 0,
            "has_opening": False,
            "has_explanation": False,
            "has_example": False,
            "has_conclusion": False,
            "star_format": None,
            "summary": "Answer is too short to evaluate structure.",
            "suggestions": ["Provide a complete response with opening, explanation, and conclusion."],
        }

    cleaned = answer.strip()
    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if len(s.strip()) > 0]
    words = cleaned.split()
    total_words = len(words)
    is_behavioral = is_behavioral_question(question)

    # 1. Opening: First sentence is reasonably decisive and not pure filler
    first_sentence = sentences[0] if sentences else ""
    has_opening = len(first_sentence.split()) >= 4 and not first_sentence.lower().startswith(("um", "uh", "i don't know", "so basically"))

    # 2. Logical Explanation / Connectors
    explanation_markers = [
        "because", "since", "due to", "how it works", "specifically", "the reason",
        "which means", "in order to", "therefore", "firstly", "first", "secondly", "next",
        "primary", "mechanism", "architect", "approach"
    ]
    has_explanation = any(m in cleaned.lower() for m in explanation_markers) or total_words >= 25

    # 3. Example / Evidence Markers
    example_markers = [
        "for example", "for instance", "such as", "in my project", "in one project",
        "we implemented", "we built", "we used", "i built", "i designed", "i created",
        "in a previous", "case study", "one scenario", "demonstrated"
    ]
    has_example = any(m in cleaned.lower() for m in example_markers)

    # 4. Conclusion / Summary Markers
    conclusion_markers = [
        "in summary", "overall", "in conclusion", "to summarize", "as a result",
        "ultimately", "this resulted in", "this led to", "hence", "finally", "to wrap up"
    ]
    has_conclusion = any(m in cleaned.lower() for m in conclusion_markers) or (len(sentences) >= 3 and len(sentences[-1].split()) >= 5)

    # Calculate structure score (0 - 25)
    structure_points = 0
    if has_opening:
        structure_points += 7
    if has_explanation:
        structure_points += 8
    if has_example:
        structure_points += 5
    elif not is_behavioral and total_words >= 40:
        # Technical question may explain mechanisms deeply without an explicit anecdotal example
        structure_points += 3
    if has_conclusion:
        structure_points += 5

    structure_points = min(25, max(0, structure_points))

    # STAR assessment for behavioral questions
    star_format = None
    if is_behavioral:
        has_situation = any(k in cleaned.lower() for k in ["when", "during", "at", "in my previous", "working on", "project where", "team had", "client had", "scenario where"])
        has_task = any(k in cleaned.lower() for k in ["my task", "my role", "responsible for", "objective", "needed to", "goal was", "challenge was", "target was"])
        has_action = any(k in cleaned.lower() for k in [
            "i did", "i resolved", "i initiated", "i built", "i researched", "i communicated",
            "i led", "i organized", "i implemented", "i designed", "i developed", "i scheduled",
            "i refactored", "i proposed", "i created", "i tested", "i decided", "i stepped in"
        ])
        has_result = any(k in cleaned.lower() for k in [
            "result", "outcome", "improved", "reduced", "delivered", "successful",
            "learned", "%", "metric", "increased", "decreased", "saved", "ahead of schedule", "uptime"
        ])

        star_count = sum([has_situation, has_task, has_action, has_result])
        star_format = {
            "is_applicable": True,
            "situation": has_situation,
            "task": has_task,
            "action": has_action,
            "result": has_result,
            "star_score": f"{star_count}/4 components present",
            "recommendation": "Use STAR: Situation (context), Task (your goal), Action (what you specifically did), Result (quantifiable outcome)."
        }

    suggestions = []
    if not has_opening:
        suggestions.append("Begin with a strong, direct topic sentence that directly answers the core question.")
    if not has_explanation:
        suggestions.append("Provide a clear step-by-step technical explanation explaining 'why' or 'how'.")
    if not has_example and is_behavioral:
        suggestions.append("Anchor your answer with a concrete past project or internship experience.")
    if not has_conclusion:
        suggestions.append("Close with a brief 1-sentence wrap-up summarizing the main takeaway.")

    return {
        "score": structure_points,
        "has_opening": has_opening,
        "has_explanation": has_explanation,
        "has_example": has_example,
        "has_conclusion": has_conclusion,
        "star_format": star_format,
        "summary": "Well-structured flow" if structure_points >= 20 else "Moderate structure, could improve progression" if structure_points >= 14 else "Needs clearer structural organization",
        "suggestions": suggestions,
    }


def evaluate_clarity_and_conciseness(answer: str) -> Dict[str, Any]:
    """
    Evaluates readability, sentence lengths, repetition, and conciseness.
    Flags overly long run-on sentences and overly repetitive phrasing.
    """
    if not answer or len(answer.strip().split()) < 4:
        return {
            "score": 0,
            "clarity_rating": "Insufficient Content",
            "long_sentences": [],
            "repetition_found": False,
            "suggestions": ["Answer was too brief to evaluate clarity."],
        }

    cleaned = answer.strip()
    sentences = [s.strip() for s in re.split(r"[.!?]+", cleaned) if len(s.strip()) > 0]
    words = cleaned.split()
    total_words = len(words)

    # 1. Identify overly long run-on sentences (> 32 words)
    long_sentences = []
    for s in sentences:
        s_words = s.split()
        if len(s_words) > 32:
            snippet = " ".join(s_words[:12]) + "..."
            long_sentences.append({
                "word_count": len(s_words),
                "snippet": snippet,
                "suggestion": f"Sentence with {len(s_words)} words is run-on; split into two focused thoughts."
            })

    # 2. Check keyword/phrase repetition
    word_freq = {}
    for w in words:
        wl = w.lower().strip(".,;:?!\"'()")
        if len(wl) > 3 and wl not in {"this", "that", "with", "have", "from", "they", "will", "would", "about", "which"}:
            word_freq[wl] = word_freq.get(wl, 0) + 1

    repetitive_words = [f"'{k}' ({v}x)" for k, v in word_freq.items() if v >= 4 and total_words < 100]
    has_repetition = len(repetitive_words) > 0

    # Score clarity out of 25
    clarity_points = 25
    if len(long_sentences) > 0:
        clarity_points -= min(10, len(long_sentences) * 4)
    if has_repetition:
        clarity_points -= 4
    if total_words < 15:
        clarity_points -= 8

    clarity_points = min(25, max(0, clarity_points))

    suggestions = []
    if long_sentences:
        suggestions.append(f"Found {len(long_sentences)} overly long sentence(s). Break long explanations into concise, punchy sentences.")
    if has_repetition:
        suggestions.append(f"Varied vocabulary recommended; frequently repeated words: {', '.join(repetitive_words[:3])}.")
    if not suggestions and total_words >= 20:
        suggestions.append("Sentences are well-balanced and easy to follow.")

    return {
        "score": clarity_points,
        "clarity_rating": "Clear & Articulate" if clarity_points >= 20 else "Moderate Clarity" if clarity_points >= 14 else "Needs Simpler Phrasing",
        "long_sentences_count": len(long_sentences),
        "long_sentences": long_sentences,
        "repetition_found": has_repetition,
        "repetitive_terms": repetitive_words[:4],
        "suggestions": suggestions,
    }


def evaluate_speaking_pace(word_count: int, duration_seconds: Optional[float]) -> Dict[str, Any]:
    """
    Evaluates speaking pace if reliable timing/duration in seconds is provided.
    If duration is None, <= 0, or timing is unavailable, displays neutral 'Speaking pace unavailable'
    without inventing scores.
    """
    if duration_seconds is None or duration_seconds <= 0 or word_count < 5:
        return {
            "wpm": None,
            "status": "unavailable",
            "display": "Speaking pace unavailable",
            "recommendation": "Speaking pace estimation requires active voice recording timing. For text-submitted responses, pace is omitted.",
            "is_measured": False,
        }

    minutes = duration_seconds / 60.0
    wpm = int(round(word_count / minutes)) if minutes > 0 else 0

    if wpm < 100:
        status = "slow"
        category = "Slow"
        display = f"{wpm} WPM (Slow)"
        recommendation = "Your speaking pace is on the slower side (< 100 WPM). Aim for a slightly more conversational delivery (100–160 WPM)."
    elif 100 <= wpm <= 160:
        status = "moderate"
        category = "Moderate"
        display = f"{wpm} WPM (Moderate / Ideal)"
        recommendation = "Your speaking speed is within the ideal conversational range (100–160 WPM), making technical explanations easy to absorb."
    elif 161 <= wpm <= 190:
        status = "fast"
        category = "Fast"
        display = f"{wpm} WPM (Fast)"
        recommendation = "You spoke quickly (161–190 WPM). Consider pausing slightly between major concepts to let the interviewer digest key points."
    else:
        status = "very_fast"
        category = "Very Fast"
        display = f"{wpm} WPM (Very Fast)"
        recommendation = "Your pace was very fast (> 190 WPM). Slow down deliberately to prevent words from slurring together during complex explanations."

    return {
        "wpm": wpm,
        "status": status,
        "category": category,
        "display": display,
        "recommendation": recommendation,
        "is_measured": True,
    }


def compute_communication_score(
    structure_score: int,
    clarity_score: int,
    filler_density: float,
    word_count: int,
    candidate_answer: str,
) -> Dict[str, Any]:
    """
    Computes an objective, clearly labeled Communication Score out of 100 based on:
    - Answer Structure & Organization (0-25 pts)
    - Clarity & Expression (0-25 pts)
    - Conciseness & Completeness (0-25 pts)
    - Fluency & Filler Control (0-25 pts)
    """
    if not candidate_answer or word_count < 4:
        return {
            "total_score": 0,
            "rubric_breakdown": {
                "structure": 0,
                "clarity": 0,
                "conciseness": 0,
                "fluency": 0,
            },
            "rating": "No Attempt / Incomplete",
            "explanation": "No substantial response provided to analyze communication dimensions."
        }

    # 1. Structure: 0-25
    s_pts = min(25, max(0, structure_score))

    # 2. Clarity: 0-25
    c_pts = min(25, max(0, clarity_score))

    # 3. Conciseness & Completeness: 0-25
    # Ideal interview answer length is typically 40 - 160 words
    if 40 <= word_count <= 180:
        conciseness_pts = 25
    elif 25 <= word_count < 40:
        conciseness_pts = 19
    elif 15 <= word_count < 25:
        conciseness_pts = 14
    elif word_count > 240:
        # Overly long / rambling
        conciseness_pts = 17
    else:
        conciseness_pts = 9

    # 4. Fluency & Filler Control: 0-25
    if filler_density == 0:
        fluency_pts = 25
    elif filler_density <= 2.0:
        fluency_pts = 22
    elif filler_density <= 4.0:
        fluency_pts = 18
    elif filler_density <= 7.0:
        fluency_pts = 13
    else:
        fluency_pts = 7

    total = int(round(s_pts + c_pts + conciseness_pts + fluency_pts))
    total = max(0, min(100, total))

    if total >= 85:
        rating = "Excellent Professional Communication"
    elif total >= 70:
        rating = "Proficient Interview Communication"
    elif total >= 50:
        rating = "Developing Communication Skills"
    else:
        rating = "Needs Focused Communication Practice"

    explanation = (
        f"Assesses clarity ({c_pts}/25), structure ({s_pts}/25), conciseness ({conciseness_pts}/25), "
        f"and verbal fluency ({fluency_pts}/25) on your submitted transcript."
    )

    return {
        "total_score": total,
        "rubric_breakdown": {
            "structure": s_pts,
            "clarity": c_pts,
            "conciseness": conciseness_pts,
            "fluency": fluency_pts,
        },
        "rating": rating,
        "explanation": explanation,
    }


def analyze_single_answer_communication(
    question: str,
    answer: str,
    duration_seconds: Optional[float] = None
) -> Dict[str, Any]:
    """
    Performs full deterministic communication and speaking analysis on a single answer.
    """
    words = re.findall(r"\b[A-Za-z0-9'-]+\b", answer or "")
    word_count = len(words)

    filler_data = detect_filler_words(answer)
    structure_data = evaluate_answer_structure(question, answer)
    clarity_data = evaluate_clarity_and_conciseness(answer)
    pace_data = evaluate_speaking_pace(word_count, duration_seconds)

    speaking_coach_data = analyze_speaking_coach_metrics(
        text=answer,
        duration_seconds=duration_seconds,
    )

    score_data = compute_communication_score(
        structure_score=structure_data["score"],
        clarity_score=clarity_data["score"],
        filler_density=filler_data["density_percent"],
        word_count=word_count,
        candidate_answer=answer,
    )

    # Compile actionable personalized suggestions
    all_suggestions = []
    all_suggestions.extend(structure_data.get("suggestions", []))
    all_suggestions.extend(clarity_data.get("suggestions", []))
    all_suggestions.extend(filler_data.get("tips", [])[:2])
    all_suggestions.extend(speaking_coach_data.get("coaching_recommendations", [])[:2])

    # Deduplicate suggestions preserving order
    seen = set()
    deduped_suggestions = []
    for s in all_suggestions:
        if s not in seen:
            seen.add(s)
            deduped_suggestions.append(s)

    return {
        "communication_score": score_data["total_score"],
        "communication_rating": score_data["rating"],
        "rubric_breakdown": score_data["rubric_breakdown"],
        "score_explanation": score_data["explanation"],
        "word_count": word_count,
        "filler_analysis": filler_data,
        "structure_analysis": structure_data,
        "clarity_analysis": clarity_data,
        "speaking_pace": pace_data,
        "speaking_coach": speaking_coach_data,
        "suggestions": deduped_suggestions[:4],
        "is_voice_recorded": pace_data["is_measured"],
    }


def generate_overall_communication_summary(
    question_feedbacks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Aggregates question-level feedback into an overall interview communication assessment.
    """
    if not question_feedbacks:
        return {
            "overall_score": 0,
            "rating": "No Data",
            "total_fillers": 0,
            "top_fillers": [],
            "avg_wpm": None,
            "pace_status": "unavailable",
            "pace_display": "Speaking pace unavailable",
            "clarity_average": 0,
            "structure_average": 0,
            "conciseness_average": 0,
            "fluency_average": 0,
            "key_recommendations": ["Complete interview questions to generate communication feedback."],
            "summary_statement": "No completed responses available for communication assessment."
        }

    valid_feedbacks = [f for f in question_feedbacks if f.get("word_count", 0) >= 3]
    feedbacks_to_use = valid_feedbacks if valid_feedbacks else question_feedbacks

    scores = [f.get("communication_score", 0) for f in feedbacks_to_use]
    overall_score = int(round(sum(scores) / len(scores))) if scores else 0

    # Aggregate filler words
    combined_filler_counts: Dict[str, int] = {}
    total_fillers = 0
    for f in question_feedbacks:
        fa = f.get("filler_analysis", {})
        counts = fa.get("counts", {})
        for w, c in counts.items():
            combined_filler_counts[w] = combined_filler_counts.get(w, 0) + c
            total_fillers += c

    top_fillers = [
        {"word": w, "count": c}
        for w, c in sorted(combined_filler_counts.items(), key=lambda item: item[1], reverse=True)
        if c > 0
    ]

    # Speaking Pace aggregation
    wpm_list = [
        f["speaking_pace"]["wpm"]
        for f in question_feedbacks
        if f.get("speaking_pace", {}).get("is_measured") and f.get("speaking_pace", {}).get("wpm")
    ]
    if wpm_list:
        avg_wpm = int(round(sum(wpm_list) / len(wpm_list)))
        if 120 <= avg_wpm <= 160:
            pace_status = "optimal"
            pace_display = f"{avg_wpm} WPM (Ideal Conversational Pace)"
        elif avg_wpm > 160:
            pace_status = "fast"
            pace_display = f"{avg_wpm} WPM (Fast Delivery)"
        else:
            pace_status = "slow"
            pace_display = f"{avg_wpm} WPM (Deliberate Delivery)"
    else:
        avg_wpm = None
        pace_status = "unavailable"
        pace_display = "Speaking pace unavailable"

    # Averages for rubric bars
    clarity_avg = int(round(sum(f.get("rubric_breakdown", {}).get("clarity", 0) for f in feedbacks_to_use) / len(feedbacks_to_use))) if feedbacks_to_use else 0
    structure_avg = int(round(sum(f.get("rubric_breakdown", {}).get("structure", 0) for f in feedbacks_to_use) / len(feedbacks_to_use))) if feedbacks_to_use else 0
    conciseness_avg = int(round(sum(f.get("rubric_breakdown", {}).get("conciseness", 0) for f in feedbacks_to_use) / len(feedbacks_to_use))) if feedbacks_to_use else 0
    fluency_avg = int(round(sum(f.get("rubric_breakdown", {}).get("fluency", 0) for f in feedbacks_to_use) / len(feedbacks_to_use))) if feedbacks_to_use else 0

    # Key recommendations
    recommendations = []
    if total_fillers > 5:
        recommendations.append(f"Practice pausing silently to reduce verbal filler habits (detected ~{total_fillers} filler occurrences).")
    if structure_avg < 18:
        recommendations.append("Structure answers with clear signposts: Direct Opening Statement -> Technical Rationale -> Concrete Outcome.")
    if clarity_avg < 18:
        recommendations.append("Shorten sentences and eliminate run-on phrases for punchier, clearer delivery.")
    if conciseness_avg < 18:
        recommendations.append("Keep answers focused directly on the core question, aiming for 1–2 minutes per response.")
    if not recommendations:
        recommendations.append("Consistently clear and well-structured responses. Maintain this steady composure in real interviews.")

    if overall_score >= 85:
        summary_stmt = "Strong communication mastery. You articulately convey technical concepts with clarity, concise structure, and minimal verbal hesitation."
    elif overall_score >= 70:
        summary_stmt = "Solid communication capabilities. Your answers are informative and logical, with minor opportunities to refine conciseness and verbal flow."
    elif overall_score >= 50:
        summary_stmt = "Developing interview communication. Focus on structuring each response around a core point and reducing filler phrasing."
    else:
        summary_stmt = "Early communication practice. Prioritize answering directly, breaking thoughts into bite-sized sentences, and citing concrete examples."

    return {
        "overall_score": overall_score,
        "rating": "Interview Ready" if overall_score >= 80 else "Proficient" if overall_score >= 65 else "Developing",
        "total_fillers": total_fillers,
        "top_fillers": top_fillers,
        "avg_wpm": avg_wpm,
        "pace_status": pace_status,
        "pace_display": pace_display,
        "clarity_average": clarity_avg,
        "structure_average": structure_avg,
        "conciseness_average": conciseness_avg,
        "fluency_average": fluency_avg,
        "key_recommendations": recommendations,
        "summary_statement": summary_stmt,
        "explanation": "Calculated out of 100 assessing clarity, conciseness, logical structure, and verbal fluency across all interview answers.",
    }


def analyze_speaking_coach_metrics(
    text: str = "",
    duration_seconds: Optional[float] = None,
    pause_data: Optional[Dict[str, Any]] = None,
    audio_meta: Optional[Dict[str, Any]] = None,
    pause_threshold_seconds: float = 2.0,
    transcript: Optional[str] = None,
    pause_count: Optional[int] = None,
    pause_duration: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Computes observable speaking metrics for real-time and post-interview coaching:
    - Words Per Minute (WPM) categorized into: Slow (<100), Moderate (100-160), Fast (161-190), Very Fast (>190)
    - Long Pauses (>= 2s threshold) and duration metrics
    - Filler Word counts and contextual breakdown
    - Immediate repeated words / speech hesitation
    - Speech clarity and vocabulary indicators
    """
    if transcript and not text:
        text = transcript

    if pause_data is None and (pause_count is not None or pause_duration is not None):
        p_cnt = pause_count or 0
        p_dur = pause_duration or 0.0
        p_avg = round(p_dur / p_cnt, 2) if p_cnt > 0 else 0.0
        pause_data = {
            "long_pauses_count": p_cnt,
            "total_pause_duration": p_dur,
            "average_pause_duration": p_avg,
        }

    cleaned_text = (text or "").strip()
    words = re.findall(r"\b[A-Za-z0-9'-]+\b", cleaned_text)
    word_count = len(words)

    # 1. WPM & Speed Categorization
    wpm_val = None
    speed_cat = "Unavailable"
    display_speed = "Speaking pace unavailable"

    if duration_seconds is not None and duration_seconds > 0 and word_count >= 3:
        mins = duration_seconds / 60.0
        wpm_val = int(round(word_count / mins)) if mins > 0 else 0
        if wpm_val < 100:
            speed_cat = "Slow"
        elif 100 <= wpm_val <= 160:
            speed_cat = "Moderate"
        elif 161 <= wpm_val <= 190:
            speed_cat = "Fast"
        else:
            speed_cat = "Very Fast"
        display_speed = f"{wpm_val} WPM ({speed_cat})"

    # 2. Filler word analysis
    filler_res = detect_filler_words(cleaned_text)

    # 3. Pause & Silence Analysis
    long_pauses = 0
    total_pause_sec = 0.0
    avg_pause_sec = 0.0
    silence_sec = 0.0
    speaking_sec = duration_seconds or 0.0

    if isinstance(pause_data, dict):
        long_pauses = int(pause_data.get("long_pauses_count", 0))
        total_pause_sec = round(float(pause_data.get("total_pause_duration", 0.0)), 2)
        avg_pause_sec = round(float(pause_data.get("average_pause_duration", 0.0)), 2)
        silence_sec = total_pause_sec
        speaking_sec = max(0.0, (duration_seconds or 0.0) - silence_sec)
    elif duration_seconds and duration_seconds > 0 and word_count > 0:
        # Heuristic estimation if client hardware didn't send raw pause telemetry
        # Conversational pace is ~135 WPM (~2.25 words/sec)
        expected_speaking_sec = word_count / 2.25
        silence_diff = max(0.0, duration_seconds - expected_speaking_sec)
        if silence_diff >= pause_threshold_seconds:
            long_pauses = int(silence_diff // pause_threshold_seconds)
            total_pause_sec = round(silence_diff, 1)
            avg_pause_sec = round(total_pause_sec / long_pauses, 1) if long_pauses > 0 else 0.0
            silence_sec = total_pause_sec
            speaking_sec = max(0.0, duration_seconds - silence_sec)

    # 4. Immediate Word Repetition
    repeated_words_list = []
    for i in range(len(words) - 1):
        w1 = words[i].lower()
        w2 = words[i + 1].lower()
        if w1 == w2 and len(w1) > 1 and w1 not in {"that", "had"}:
            repeated_words_list.append(w1)

    # 5. Speech Clarity & Vocabulary
    unique_words = set(w.lower() for w in words)
    vocab_richness = round(len(unique_words) / word_count, 2) if word_count > 0 else 0.0

    # 6. Actionable Coaching Recommendations
    coaching_tips = []
    if speed_cat == "Slow":
        coaching_tips.append("Aim for a slightly more conversational tempo (100–160 WPM) to keep the interviewer engaged.")
    elif speed_cat == "Fast" or speed_cat == "Very Fast":
        coaching_tips.append("Slow down slightly on technical details (100–160 WPM) so critical architecture trade-offs are easy to absorb.")
    
    if filler_res["total_fillers"] >= 3:
        top_name = max(filler_res["counts"], key=filler_res["counts"].get, default="filler")
        coaching_tips.append(f"Notice verbal pauses like '{top_name}'. Replace them with a silent 1-second pause while organizing thoughts.")
    
    if long_pauses >= 3:
        coaching_tips.append(f"Detected {long_pauses} long pauses (>= 2s). Practice outlining your thoughts upfront using the STAR framework to maintain conversational momentum.")
    
    if len(repeated_words_list) >= 2:
        coaching_tips.append(f"Identified repeated consecutive words ({', '.join(set(repeated_words_list))}). Speak in structured sentences to reduce word repetition.")

    if not coaching_tips and word_count >= 15:
        coaching_tips.append("Excellent vocal delivery! Steady conversational pace, minimal hesitation, and clear sentence structure.")

    clarity_score_val = max(50, min(100, int(100 - (filler_res["density_percent"] * 4) - (long_pauses * 2))))

    return {
        "word_count": word_count,
        "total_duration_seconds": round(duration_seconds, 1) if duration_seconds is not None else None,
        "speaking_duration_seconds": round(speaking_sec, 1) if duration_seconds is not None else None,
        "silence_duration_seconds": round(silence_sec, 1) if duration_seconds is not None else None,
        "wpm": wpm_val,
        "speed_category": speed_cat,
        "pace_category": speed_cat,
        "speed_display": display_speed,
        "clarity_score": clarity_score_val,
        "filler_count": filler_res["total_fillers"],
        "filler_words": {
            "total_count": filler_res["total_fillers"],
            "density_percent": filler_res["density_percent"],
            "counts": filler_res["counts"],
            "tips": filler_res["tips"],
        },
        "pause_analysis": {
            "long_pauses_count": long_pauses,
            "total_pause_seconds": total_pause_sec,
            "average_pause_seconds": avg_pause_sec,
            "threshold_seconds": pause_threshold_seconds,
            "is_measured": duration_seconds is not None and duration_seconds > 0,
        },
        "long_pauses": {
            "count": long_pauses,
            "total_seconds": total_pause_sec,
        },
        "repeated_words": {
            "count": len(repeated_words_list),
            "words": list(set(repeated_words_list)),
        },
        "clarity_indicators": {
            "vocabulary_diversity": vocab_richness,
            "is_complete_sentence": bool(re.search(r"[.!?]$", cleaned_text)),
            "unrecognized_segments_count": int(audio_meta.get("unrecognized_segments", 0)) if isinstance(audio_meta, dict) else 0,
        },
        "coaching_recommendations": coaching_tips,
    }


def aggregate_session_speaking_metrics(
    question_metrics: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Aggregates per-question speaking coach metrics into a comprehensive session communication summary.
    """
    if not question_metrics:
        return {
            "average_wpm": None,
            "overall_speed_category": "Unavailable",
            "speed_display": "Speaking pace unavailable",
            "total_filler_words": 0,
            "top_filler_words": [],
            "total_long_pauses": 0,
            "total_speaking_duration": 0.0,
            "total_silence_duration": 0.0,
            "repeated_words_count": 0,
            "key_recommendations": ["Complete voice responses to unlock real-time speech analytics."],
        }

    total_words = 0
    total_duration = 0.0
    total_speaking = 0.0
    total_silence = 0.0
    total_pauses = 0
    total_repeated = 0
    filler_counts = {}

    measured_wpms = []

    for qm in question_metrics:
        total_words += qm.get("word_count", 0)
        dur = qm.get("total_duration_seconds")
        if dur:
            total_duration += dur
        spk = qm.get("speaking_duration_seconds")
        if spk:
            total_speaking += spk
        sil = qm.get("silence_duration_seconds")
        if sil:
            total_silence += sil

        pauses = qm.get("pause_analysis", {}).get("long_pauses_count", 0)
        total_pauses += pauses

        rep = qm.get("repeated_words", {}).get("count", 0)
        total_repeated += rep

        wpm = qm.get("wpm")
        if wpm:
            measured_wpms.append(wpm)

        f_counts = qm.get("filler_words", {}).get("counts", {})
        for w, c in f_counts.items():
            filler_counts[w] = filler_counts.get(w, 0) + c

    avg_wpm = int(round(sum(measured_wpms) / len(measured_wpms))) if measured_wpms else None
    speed_cat = "Unavailable"
    if avg_wpm:
        if avg_wpm < 100:
            speed_cat = "Slow"
        elif 100 <= avg_wpm <= 160:
            speed_cat = "Moderate"
        elif 161 <= avg_wpm <= 190:
            speed_cat = "Fast"
        else:
            speed_cat = "Very Fast"

    top_fillers = [
        {"word": w, "count": c}
        for w, c in sorted(filler_counts.items(), key=lambda x: x[1], reverse=True)
        if c > 0
    ]

    recommendations = []
    if speed_cat == "Slow":
        recommendations.append("Increase your speaking tempo slightly toward 120–150 WPM to sound more confident and decisive.")
    elif speed_cat in {"Fast", "Very Fast"}:
        recommendations.append("Slow down slightly on core technical explanations (aim for 120–150 WPM) to allow interviewers to digest your architecture choices.")
    
    total_f_count = sum(filler_counts.values())
    if total_f_count >= 5:
        recommendations.append(f"Consciously pause silently instead of saying '{top_fillers[0]['word'] if top_fillers else 'fillers'}' when thinking between points.")

    if total_pauses >= 4:
        recommendations.append(f"Observed {total_pauses} pauses >= 2s. Outline your talking points in 3 bullets before starting to speak.")

    if not recommendations:
        recommendations.append("Balanced, articulate verbal delivery throughout the mock session. Maintain this steady composure.")

    return {
        "average_wpm": avg_wpm,
        "overall_speed_category": speed_cat,
        "speed_display": f"{avg_wpm} WPM ({speed_cat})" if avg_wpm else "Speaking pace unavailable",
        "total_filler_words": total_f_count,
        "top_filler_words": top_fillers[:5],
        "total_long_pauses": total_pauses,
        "total_speaking_duration": round(total_speaking, 1),
        "total_silence_duration": round(total_silence, 1),
        "repeated_words_count": total_repeated,
        "key_recommendations": recommendations,
    }

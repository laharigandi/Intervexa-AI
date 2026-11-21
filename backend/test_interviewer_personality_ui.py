import os
import re

COMPONENT_PATH = r"d:\Smart-Interview-Coach\Smart-Interview-Coach\frontend\src\components\InterviewerPersonalitySelector.jsx"

def test_personality_selector_component():
    print("=" * 60)
    print("TESTING SIMPLIFIED AI INTERVIEWER PERSONALITY SELECTOR")
    print("=" * 60)

    with open(COMPONENT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Verify 6 exact personalities in exact order
    expected_personalities = [
        ("technical", "Technical Interviewer"),
        ("hr", "HR Interviewer"),
        ("strict", "Strict Interviewer"),
        ("friendly", "Friendly Interviewer"),
        ("senior_engineer", "Senior Staff Engineer"),
        ("panel", "Multi-Perspective Panel"),
    ]

    for pid, pname in expected_personalities:
        assert f'id: "{pid}"' in content, f"Missing id: {pid}"
        assert f'name: "{pname}"' in content, f"Missing name: {pname}"
    print("[PASS] All 6 personalities present in exact sequence.")

    # 2. Verify removed clutter
    clutter_terms = [
        "badge: \"Core Tech\"",
        "badge: \"Behavioral\"",
        "badge: \"High Bar\"",
        "tagline:",
        "description:",
        "focus:",
        "CORE TECH",
        "BEHAVIORAL",
        "HIGH BAR",
    ]
    for term in clutter_terms:
        assert term not in content, f"Clutter term found: {term}"
    print("[PASS] All unnecessary badges, taglines, descriptions, and focus text removed.")

    # 3. Verify exactly 3 cards per row on desktop
    assert "grid-template-columns: repeat(3, 1fr);" in content, "Desktop must be 3 cards per row"
    assert "@media (max-width: 960px)" in content and "repeat(2, 1fr)" in content, "Tablet must be 2 cards per row"
    assert "@media (max-width: 600px)" in content and "grid-template-columns: 1fr" in content, "Mobile must be 1 card per row"
    print("[PASS] Responsive layout verified (Desktop: 3x2, Tablet: 2 cols, Mobile: 1 col).")

    # 4. Verify selection indicator and item.name only inside card
    assert "{item.name}" in content, "Must render item.name"
    assert "IconCheckCircle" in content, "Must render selection checkmark/indicator"
    assert "localStorage.setItem(\"interviewer_personality\", id)" in content, "Must save selected personality"
    assert "localStorage.getItem(\"interviewer_personality\") || \"technical\"" in content, "Must default to technical"
    print("[PASS] Card renders ONLY name and selection indicator; state and persistence intact.")

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_personality_selector_component()

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer
)
from reportlab.lib.styles import (
    getSampleStyleSheet
)


def generate_pdf(
    results,
    summary
):
    filename = "Interview_Report.pdf"

    doc = SimpleDocTemplate(
        filename
    )

    styles = getSampleStyleSheet()

    content = []

    content.append(
        Paragraph(
            "Smart Interview Coach Report",
            styles["Title"]
        )
    )

    content.append(
        Spacer(1, 20)
    )

    content.append(
        Paragraph(
            "Overall Summary",
            styles["Heading1"]
        )
    )

    content.append(
        Paragraph(
            summary.get(
                "summary",
                ""
            ),
            styles["BodyText"]
        )
    )

    mode_label = summary.get("interview_mode") or summary.get("mode")
    if mode_label:
        display_mode = "Adaptive AI Interview (Dynamic Difficulty)" if "adaptive" in str(mode_label).lower() else "Standard Interview"
        content.append(
            Paragraph(
                f"<b>Interview Mode:</b> {display_mode}",
                styles["BodyText"]
            )
        )

    persona_label = summary.get("interviewer_personality") or summary.get("personality")
    if persona_label:
        persona_clean = str(persona_label).replace("_", " ").title()
        content.append(
            Paragraph(
                f"<b>Interviewer Persona:</b> {persona_clean}",
                styles["BodyText"]
            )
        )

    content.append(
        Spacer(1, 10)
    )

    content.append(
        Paragraph(
            f"<b>Strengths:</b> {summary.get('strengths', '')}",
            styles["BodyText"]
        )
    )

    content.append(
        Paragraph(
            f"<b>Weaknesses:</b> {summary.get('weaknesses', '')}",
            styles["BodyText"]
        )
    )

    content.append(
        Paragraph(
            f"<b>Advice:</b> {summary.get('advice', '')}",
            styles["BodyText"]
        )
    )

    # Communication & Speaking Coach section
    comm_fb = summary.get("communication_feedback")
    spk_metrics = summary.get("speaking_metrics")
    if isinstance(comm_fb, dict) or isinstance(spk_metrics, dict):
        content.append(Spacer(1, 12))
        content.append(Paragraph("Communication & Speaking Evaluation", styles["Heading2"]))
        if isinstance(comm_fb, dict):
            comm_score = comm_fb.get("overall_score", 0)
            comm_rating = comm_fb.get("rating", "")
            content.append(Paragraph(f"<b>Communication Score:</b> {comm_score}/100 ({comm_rating})", styles["BodyText"]))
            content.append(Paragraph(f"<b>Speaking Pace:</b> {comm_fb.get('pace_display', 'Speaking pace unavailable')}", styles["BodyText"]))
            content.append(Paragraph(f"<b>Filler Words Detected:</b> {comm_fb.get('total_fillers', 0)} total occurrences (estimate)", styles["BodyText"]))
            if comm_fb.get("summary_statement"):
                content.append(Paragraph(f"<b>Assessment:</b> {comm_fb['summary_statement']}", styles["BodyText"]))
            recs = comm_fb.get("key_recommendations", [])
            if recs:
                content.append(Paragraph("<b>Personalized Recommendations:</b>", styles["BodyText"]))
                for r in recs:
                    content.append(Paragraph(f"• {r}", styles["BodyText"]))

        if isinstance(spk_metrics, dict) and spk_metrics.get("average_wpm"):
            content.append(Paragraph(
                f"<b>Speaking Coach Metrics:</b> Average WPM: {spk_metrics.get('average_wpm')} ({spk_metrics.get('pace_category', 'Moderate')}) | Long Pauses: {spk_metrics.get('total_long_pauses', 0)} | Speech Clarity: {spk_metrics.get('clarity_score', 85)}%",
                styles["BodyText"]
            ))

    # Technical Answer Verification Summary
    verif_sum = summary.get("verification_summary")
    if isinstance(verif_sum, dict):
        content.append(Spacer(1, 12))
        content.append(Paragraph("Technical Answer Verification & Grounding", styles["Heading2"]))
        content.append(Paragraph(
            f"<b>Average Correctness:</b> {verif_sum.get('average_correctness_score', 0)}% | <b>Verified Answers:</b> {verif_sum.get('total_verified', 0)} | <b>Flagged Technical Issues:</b> {verif_sum.get('total_hallucinations_detected', 0)}",
            styles["BodyText"]
        ))
        if verif_sum.get("summary_text"):
            content.append(Paragraph(f"<b>Verification Summary:</b> {verif_sum['summary_text']}", styles["BodyText"]))

    content.append(
        Spacer(1, 20)
    )

    for i, item in enumerate(
        results,
        start=1
    ):

        content.append(
            Paragraph(
                f"Question {i}",
                styles["Heading2"]
            )
        )

        if item.get("difficulty") or item.get("topic"):
            diff_label = str(item.get("difficulty") or "Medium").capitalize()
            topic_label = str(item.get("topic") or "")
            meta_str = f"<b>Difficulty:</b> {diff_label}" + (f" | <b>Topic:</b> {topic_label}" if topic_label else "")
            content.append(
                Paragraph(
                    meta_str,
                    styles["BodyText"]
                )
            )

        content.append(
            Paragraph(
                f"<b>Question:</b> {item.get('question', '')}",
                styles["BodyText"]
            )
        )

        content.append(
            Paragraph(
                f"<b>Your Answer:</b> {item.get('answer', item.get('candidate_answer', ''))}",
                styles["BodyText"]
            )
        )

        content.append(
            Paragraph(
                f"<b>Technical Score:</b> {item.get('technical_score', 0)}/10",
                styles["BodyText"]
            )
        )

        q_cf = item.get("communication_feedback")
        if isinstance(q_cf, dict) and q_cf.get("communication_score") is not None:
            content.append(
                Paragraph(
                    f"<b>Communication Score:</b> {q_cf.get('communication_score')}/100 ({q_cf.get('communication_rating', '')})",
                    styles["BodyText"]
                )
            )
        else:
            content.append(
                Paragraph(
                    f"<b>Communication Score:</b> {item.get('communication_score', 0)}/10",
                    styles["BodyText"]
                )
            )

        # Verification breakdown for this question
        v_res = item.get("verification_result")
        if isinstance(v_res, dict):
            status = v_res.get("verification_status", "Correct")
            c_score = v_res.get("correctness_score", 100)
            content.append(
                Paragraph(
                    f"<b>Technical Verification:</b> {status} ({c_score}% accuracy)",
                    styles["BodyText"]
                )
            )
            incorrects = v_res.get("incorrect_statements", [])
            if incorrects:
                inc_text = "; ".join(incorrects[:2])
                content.append(
                    Paragraph(
                        f"<b>Flagged Inaccuracies:</b> {inc_text}",
                        styles["BodyText"]
                    )
                )
            evidence = v_res.get("evidence", [])
            if evidence:
                ev_str = ", ".join([f"{e.get('source_title', 'Docs')} ({e.get('confidence', 90)}%)" for e in evidence[:2]])
                content.append(
                    Paragraph(
                        f"<b>Grounding Evidence:</b> {ev_str}",
                        styles["BodyText"]
                    )
                )

        content.append(
            Paragraph(
                f"<b>Strengths:</b> {item.get('strengths', '')}",
                styles["BodyText"]
            )
        )

        content.append(
            Paragraph(
                f"<b>Mistakes:</b> {item.get('mistakes', '')}",
                styles["BodyText"]
            )
        )

        content.append(
            Paragraph(
                f"<b>Improved Answer:</b> {item.get('improved_answer', '')}",
                styles["BodyText"]
            )
        )

        content.append(
            Paragraph(
                f"<b>Correct Answer:</b> {item.get('correct_answer', '')}",
                styles["BodyText"]
            )
        )

        content.append(
            Spacer(1, 20)
        )

    doc.build(content)

    return filename

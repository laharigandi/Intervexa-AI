"""
Personalized Learning Roadmap PDF Generation Service
Intervexa AI – Smart Interview Coach

Generates compact, professional, print-friendly A4 PDF reports for AI Learning Roadmaps
and Study Plans with optimal whitespace utilization and smart pagination.

Features:
- Compact, balanced page margins (36 pt) and clean typography.
- Immediate flow from Header/Overview directly into the Daily Learning Schedule (no forced blank pages).
- Individual day-card grouping with smart page-break protection to prevent awkward card splits.
- Continuous daily schedule displaying topic, focus, tasks, practice questions, key concepts, and resources.
- Professional branding, progress metrics, identified skill gaps, and strategic AI recommendations.
"""

import io
import json
import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

try:
    from services.roadmap_structured_content import normalize_task_structured_fields, clean_bullet_text
except ImportError:
    try:
        from roadmap_structured_content import normalize_task_structured_fields, clean_bullet_text
    except ImportError:
        def normalize_task_structured_fields(t):
            return t
        def clean_bullet_text(v):
            return str(v or "")


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print accurate total page count
    and render consistent Intervexa AI headers and footers across all pages
    without overlapping printable content.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running Top Header on page 2 onwards (outside printable margin y > 805)
        if self._pageNumber > 1:
            self.drawString(36, 814, "INTERVEXA AI  |  Personalized Learning Roadmap")
            self.drawRightString(559, 814, datetime.date.today().strftime("%B %d, %Y"))
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 807, 559, 807)

        # Running Bottom Footer on all pages (outside printable margin y < 36)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 28, 559, 28)
        self.drawString(36, 17, "Intervexa AI -- Smart Interview Coach  |  Personalized Preparation Curriculum")
        self.drawRightString(559, 17, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def _get_pdf_styles():
    """Build and return compact, professional typography styles."""
    styles = getSampleStyleSheet()

    c_primary = colors.HexColor("#4C1D95")
    c_accent = colors.HexColor("#6366F1")
    c_dark = colors.HexColor("#0F172A")
    c_muted = colors.HexColor("#64748B")

    custom_styles = {
        "BrandBadge": ParagraphStyle(
            "BrandBadge",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=c_accent,
            textTransform="uppercase",
            spaceAfter=2,
        ),
        "DocTitle": ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            textColor=c_primary,
            spaceAfter=1,
        ),
        "DocSubtitle": ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=c_muted,
            spaceAfter=0,
        ),
        "SectionHeading": ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=c_primary,
            spaceBefore=6,
            spaceAfter=3,
        ),
        "WeekTitle": ParagraphStyle(
            "WeekTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#1E1B4B"),
            spaceAfter=1,
        ),
        "WeekMeta": ParagraphStyle(
            "WeekMeta",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=c_muted,
        ),
        "BodyDark": ParagraphStyle(
            "BodyDark",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=c_dark,
        ),
        "CalloutText": ParagraphStyle(
            "CalloutText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11.5,
            textColor=colors.HexColor("#1E293B"),
        ),
        "MetaLabel": ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#64748B"),
            textTransform="uppercase",
        ),
        "MetaValue": ParagraphStyle(
            "MetaValue",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=c_dark,
        ),
        "DayCardTitle": ParagraphStyle(
            "DayCardTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0F172A"),
        ),
        "DayCardMeta": ParagraphStyle(
            "DayCardMeta",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            alignment=2,
            textColor=colors.HexColor("#475569"),
        ),
        "DayCardBody": ParagraphStyle(
            "DayCardBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=11,
            textColor=colors.HexColor("#1E293B"),
        ),
        "DayCardBullet": ParagraphStyle(
            "DayCardBullet",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9.8,
            textColor=colors.HexColor("#334155"),
            leftIndent=6,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.5,
            textColor=c_dark,
        ),
        "TableCellMuted": ParagraphStyle(
            "TableCellMuted",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9.5,
            textColor=c_muted,
        ),
        "BigStat": ParagraphStyle(
            "BigStat",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=c_primary,
            alignment=1,
        ),
    }

    for name, s in custom_styles.items():
        styles.add(s)

    return styles


def _clean_str(val: Any) -> str:
    """Helper to convert any input into a clean non-empty string."""
    if val is None:
        return ""
    return str(val).strip()


def generate_roadmap_pdf(plan_data: Dict[str, Any], user_info: Optional[Dict[str, Any]] = None) -> bytes:
    """
    Renders an A4 PDF document containing the full learning roadmap with compact,
    clean spacing, smart page breaks, and zero unnecessary whitespace.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,           # 595.28 x 841.89 points
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=38,
    )

    styles = _get_pdf_styles()
    story = []
    usable_width = 523  # 595.28 - 72

    # -------------------------------------------------------------------------
    # Safe Attribute Extraction & Normalization
    # -------------------------------------------------------------------------
    user_info = user_info or {}
    candidate_name = _clean_str(user_info.get("name") or plan_data.get("candidate_name") or "Candidate")
    candidate_email = _clean_str(user_info.get("email") or plan_data.get("candidate_email") or "")
    requested_topic = _clean_str(plan_data.get("requested_topic"))
    target_role = requested_topic if requested_topic else _clean_str(plan_data.get("target_role") or plan_data.get("role") or "Software Engineer")
    duration_days = int(plan_data.get("duration_days") or 14)
    daily_minutes = int(plan_data.get("daily_study_minutes") or 60)
    prep_level = _clean_str(plan_data.get("preparation_level") or "Intermediate")
    summary = _clean_str(plan_data.get("summary") or f"Curated AI interview preparation schedule targeting core {target_role} competencies.")

    start_date = _clean_str(plan_data.get("start_date") or datetime.date.today().isoformat())
    end_date = _clean_str(plan_data.get("end_date") or "Self-Paced")

    # Extract Skill Gaps
    raw_skill_gaps = plan_data.get("skill_gaps") or plan_data.get("weak_skills") or []
    if isinstance(raw_skill_gaps, str):
        try:
            raw_skill_gaps = json.loads(raw_skill_gaps)
        except Exception:
            raw_skill_gaps = [raw_skill_gaps]
    skill_gaps = [str(s).strip() for s in raw_skill_gaps if str(s).strip()]

    # Extract Strong Skills
    raw_strong_skills = plan_data.get("strong_skills") or []
    if isinstance(raw_strong_skills, str):
        try:
            raw_strong_skills = json.loads(raw_strong_skills)
        except Exception:
            raw_strong_skills = [raw_strong_skills]
    strong_skills = [str(s).strip() for s in raw_strong_skills if str(s).strip()]

    # Parse and sort raw tasks
    raw_tasks = plan_data.get("tasks") or []
    # If the input is from curriculum format with "days":
    if not raw_tasks and plan_data.get("days"):
        for d in plan_data.get("days", []):
            d_num = d.get("day", 1)
            f_title = d.get("focus") or d.get("title") or "Technical Focus"
            practice_q = d.get("practice_question") or ""
            key_c = d.get("key_concept") or ""
            tasks_list = d.get("tasks") or []

            task_desc = ", ".join([t.get("title") for t in tasks_list if t.get("title")]) if tasks_list else f_title
            raw_tasks.append({
                "day_number": d_num,
                "task_date": f"Day {d_num}",
                "topic": f_title,
                "description": task_desc,
                "learning_objective": f"Master core principles and trade-offs of {f_title}.",
                "recommended_practice": practice_q or "Complete technical challenges and architectural review.",
                "completion_criteria": key_c or "Verbalize concepts clearly and pass technical checks.",
                "estimated_minutes": daily_minutes,
                "priority": "High" if d_num <= 3 else "Medium",
                "difficulty": prep_level,
                "status": "pending",
            })

    total_tasks = int(plan_data.get("total_tasks") or len(raw_tasks))
    completed_tasks = int(plan_data.get("completed_tasks") or sum(1 for t in raw_tasks if str(t.get("status", "")).lower() == "completed"))
    pending_tasks = max(0, total_tasks - completed_tasks)

    completion_rate_pct = plan_data.get("completion_rate_pct")
    if completion_rate_pct is None:
        completion_rate_pct = round((completed_tasks / total_tasks * 100.0), 1) if total_tasks > 0 else 0.0

    total_est_minutes = plan_data.get("total_estimated_minutes")
    if not total_est_minutes:
        total_est_minutes = sum(int(t.get("estimated_minutes") or daily_minutes) for t in raw_tasks) or (duration_days * daily_minutes)
    total_est_hours = round(total_est_minutes / 60.0, 1)

    streak_days = int(plan_data.get("streak_days") or 0)

    # =========================================================================
    # SECTION 1: COMPACT HEADER & ROADMAP OVERVIEW
    # =========================================================================

    # Title & Metadata Table
    header_data = [
        [
            Paragraph("<b>INTERVEXA AI</b>", styles["BrandBadge"]),
            Paragraph(datetime.date.today().strftime("%B %d, %Y"), ParagraphStyle("DateMeta", fontName="Helvetica", fontSize=8, alignment=2, textColor=colors.HexColor("#64748B"))),
        ],
        [
            Paragraph(f"Personalized Learning Roadmap: {target_role}", styles["DocTitle"]),
            "",
        ],
        [
            Paragraph(f"Structured {duration_days}-Day Curriculum • {daily_minutes} Mins/Day • {prep_level} Level • {total_est_hours} Total Hours", styles["DocSubtitle"]),
            "",
        ],
    ]
    t_header = Table(header_data, colWidths=[395, 128])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("SPAN", (0, 1), (1, 1)),
        ("SPAN", (0, 2), (1, 2)),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
    ]))
    story.append(t_header)

    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#6366F1"), spaceBefore=3, spaceAfter=6))

    # Candidate & Role Parameters (Compact 4-Box Grid)
    meta_box_data = [
        [
            Paragraph("CANDIDATE NAME", styles["MetaLabel"]),
            Paragraph("TARGET JOB ROLE", styles["MetaLabel"]),
        ],
        [
            Paragraph(f"<b>{candidate_name}</b>" + (f" ({candidate_email})" if candidate_email else ""), styles["MetaValue"]),
            Paragraph(f"<b>{target_role}</b>", styles["MetaValue"]),
        ],
        [
            Paragraph("LEARNING DURATION", styles["MetaLabel"]),
            Paragraph("DAILY STUDY TIME", styles["MetaLabel"]),
        ],
        [
            Paragraph(f"<b>{duration_days} Days</b> ({prep_level} Level)", styles["MetaValue"]),
            Paragraph(f"<b>{daily_minutes} Minutes / Day</b>", styles["MetaValue"]),
        ],
        [
            Paragraph("PLAN GENERATION DATE", styles["MetaLabel"]),
            Paragraph("TARGET COMPLETION", styles["MetaLabel"]),
        ],
        [
            Paragraph(f"<b>{start_date}</b>", styles["MetaValue"]),
            Paragraph(f"<b>{end_date or 'Flexible Pace'}</b>", styles["MetaValue"]),
        ],
    ]
    t_meta = Table(meta_box_data, colWidths=[255, 268])
    t_meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t_meta)

    # Executive Curriculum Summary & Skill Gaps Box
    summary_content = [
        Paragraph(f"<b>Curriculum Focus:</b> {summary}", styles["CalloutText"]),
    ]
    if skill_gaps:
        gaps_snippet = ", ".join(skill_gaps[:6])
        summary_content.append(
            Paragraph(f"<b>Identified Skill Gaps Targeted:</b> <font color='#DC2626'>{gaps_snippet}</font>", styles["CalloutText"])
        )

    t_summary = Table([[summary_content]], colWidths=[usable_width])
    t_summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EEF2FF")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#C7D2FE")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(Spacer(1, 5))
    story.append(t_summary)

    # Quantitative Scope Metrics Row (4 Compact Cards)
    metric_cards = [
        [
            Paragraph("TOTAL TASKS", styles["MetaLabel"]),
            Paragraph("EST. HOURS", styles["MetaLabel"]),
            Paragraph("PREPARATION LEVEL", styles["MetaLabel"]),
            Paragraph("COMPLETION RATE", styles["MetaLabel"]),
        ],
        [
            Paragraph(f"<b>{total_tasks} Tasks</b>", styles["BigStat"]),
            Paragraph(f"<b>{total_est_hours}h Total</b>", styles["BigStat"]),
            Paragraph(f"<b>{prep_level}</b>", styles["BigStat"]),
            Paragraph(f"<b>{completion_rate_pct}%</b>", styles["BigStat"]),
        ],
        [
            Paragraph(f"{completed_tasks} completed &bull; {pending_tasks} pending", styles["TableCellMuted"]),
            Paragraph(f"{daily_minutes} min/day study", styles["TableCellMuted"]),
            Paragraph(f"{duration_days}-day timeline", styles["TableCellMuted"]),
            Paragraph(f"{streak_days} day streak active", styles["TableCellMuted"]),
        ],
    ]
    t_metrics = Table(metric_cards, colWidths=[130, 130, 130, 133])
    t_metrics.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(Spacer(1, 5))
    story.append(t_metrics)

    # Spacing before Daily Learning Schedule (NO FORCED PAGE BREAK)
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 2: CONTINUOUS DAILY LEARNING SCHEDULE
    # =========================================================================
    story.append(Paragraph("<b>Daily Learning Schedule & Action Plan</b>", styles["SectionHeading"]))

    # Group tasks by week
    weeks_dict: Dict[int, List[Dict[str, Any]]] = {}
    for task in raw_tasks:
        day_num = int(task.get("day_number") or 1)
        week_idx = (day_num - 1) // 7 + 1
        weeks_dict.setdefault(week_idx, []).append(task)

    for week_num in sorted(weeks_dict.keys()):
        week_tasks = weeks_dict[week_num]
        week_topics = list(dict.fromkeys([_clean_str(t.get("topic")) for t in week_tasks if _clean_str(t.get("topic"))]))
        week_est_hours = round(sum(int(t.get("estimated_minutes") or daily_minutes) for t in week_tasks) / 60.0, 1)

        # Weekly Banner Header
        week_header_data = [
            [
                Paragraph(f"<b>WEEK {week_num}: {target_role} Skill Milestones</b>", styles["WeekTitle"]),
                Paragraph(f"<b>{week_est_hours}h Total</b> &bull; {len(week_tasks)} Commitments", ParagraphStyle("WHRight", fontName="Helvetica-Bold", fontSize=8, alignment=2, textColor=colors.HexColor("#4C1D95"))),
            ],
            [
                Paragraph(f"<b>Focus Areas:</b> {', '.join(week_topics[:4]) if week_topics else 'Core technical competency development'}", styles["WeekMeta"]),
                "",
            ],
        ]
        t_week_banner = Table(week_header_data, colWidths=[385, 138])
        t_week_banner.setStyle(TableStyle([
            ("SPAN", (0, 1), (1, 1)),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ]))

        # Render each day of the week as a grouped compact card
        day_cards = []
        for row_idx, raw_t in enumerate(week_tasks, start=1):
            t = normalize_task_structured_fields(raw_t)
            day_num = int(t.get("day_number") or row_idx)
            topic_name = _clean_str(t.get("topic") or f"Day {day_num} Topic")
            description = _clean_str(t.get("description") or t.get("learning_objective") or "Systematic study of key concepts.")
            objective = _clean_str(t.get("learning_objective") or "")
            practice = _clean_str(t.get("recommended_practice") or "")
            key_concept = _clean_str(t.get("completion_criteria") or t.get("explanation") or t.get("key_concept") or "")

            est_mins = int(t.get("estimated_minutes") or daily_minutes)
            priority = _clean_str(t.get("priority") or "Medium").upper()
            status = _clean_str(t.get("status") or "pending").lower()

            priority_color = "#DC2626" if priority in ("HIGH", "CRITICAL") else ("#2563EB" if priority == "MEDIUM" else "#059669")
            status_tag = "<font color='#16A34A'><b>[DONE]</b></font>" if status == "completed" else "<font color='#D97706'><b>[PENDING]</b></font>"

            # Structured fields from normalized task
            what_learn_list = t.get("what_you_will_learn") or []
            steps_list = t.get("learning_steps") or []
            examples_list = t.get("practical_examples") or []
            practice_list = t.get("practice_activities") or []
            goals_list = t.get("completion_goals") or []

            # Subtopics
            subtopics_raw = t.get("subtopics") or []
            if isinstance(subtopics_raw, str):
                try:
                    subtopics_raw = json.loads(subtopics_raw)
                except Exception:
                    subtopics_raw = [subtopics_raw]
            subtopics_text = ", ".join([str(s).strip() for s in subtopics_raw if str(s).strip()][:4])

            # Resources
            resources_raw = t.get("recommended_resources") or []
            if isinstance(resources_raw, str):
                try:
                    resources_raw = json.loads(resources_raw)
                except Exception:
                    resources_raw = []
            resources_snippets = []
            if isinstance(resources_raw, list):
                for r in resources_raw:
                    if isinstance(r, dict) and r.get("title"):
                        resources_snippets.append(r.get("title"))
                    elif isinstance(r, str) and r.strip():
                        resources_snippets.append(r.strip())
            resources_text = " &bull; ".join(resources_snippets[:2])

            # Assemble compact Day Card body paragraphs with clear bullet points
            body_paragraphs = []

            # Section B: What You Will Learn (Bullet points)
            if what_learn_list and isinstance(what_learn_list, list):
                body_paragraphs.append(Paragraph("<b>What You Will Learn:</b>", styles["DayCardBody"]))
                for b_item in what_learn_list[:3]:
                    b_clean = clean_bullet_text(b_item)
                    if b_clean:
                        body_paragraphs.append(Paragraph(f"&bull; {b_clean}", styles["DayCardBullet"]))
            else:
                focus_line = f"<b>Focus:</b> {description}"
                if objective and objective != description:
                    focus_line += f" <font color='#64748B'>({objective})</font>"
                body_paragraphs.append(Paragraph(focus_line, styles["DayCardBody"]))

            # Section D: Step-by-Step Instructions
            if steps_list and isinstance(steps_list, list):
                steps_inline = " &nbsp;|&nbsp; ".join([clean_bullet_text(s) for s in steps_list[:3]])
                body_paragraphs.append(Paragraph(f"<b>Instructions:</b> <font color='#475569'>{steps_inline}</font>", styles["DayCardBody"]))

            # Section E: Practical Example (if available)
            if examples_list and isinstance(examples_list, list) and len(examples_list) > 0:
                first_ex = examples_list[0]
                if isinstance(first_ex, dict):
                    ex_title = first_ex.get("title") or "Code Implementation"
                    ex_out = first_ex.get("output") or ""
                    ex_summary = f"<b>Practical Example:</b> <font color='#4C1D95'>{ex_title}</font>"
                    if ex_out:
                        ex_summary += f" &bull; <font color='#059669'>Output: {ex_out[:40]}</font>"
                    body_paragraphs.append(Paragraph(ex_summary, styles["DayCardBody"]))

            # Section F: Practice Activity
            if practice_list and isinstance(practice_list, list):
                p_text = " &bull; ".join([clean_bullet_text(p) for p in practice_list[:2]])
                body_paragraphs.append(Paragraph(f"<b>Practice Activity:</b> {p_text}", styles["DayCardBody"]))
            elif practice:
                body_paragraphs.append(Paragraph(f"<b>Practice Activity:</b> {practice}", styles["DayCardBody"]))

            # Section G: Completion Goal
            if goals_list and isinstance(goals_list, list):
                g_text = " &bull; ".join([clean_bullet_text(g) for g in goals_list[:2]])
                body_paragraphs.append(Paragraph(f"<b>Completion Goal:</b> <font color='#0F172A'>{g_text}</font>", styles["DayCardBody"]))
            elif key_concept:
                body_paragraphs.append(Paragraph(f"<b>Completion Goal:</b> <font color='#0F172A'>{key_concept}</font>", styles["DayCardBody"]))

            # Section H: Curated Resources
            if resources_text:
                body_paragraphs.append(Paragraph(f"<b>Curated Resources:</b> <font color='#475569'>{resources_text}</font>", styles["DayCardBody"]))

            # Construct Card Table (2 rows: Header bar + Body content)
            card_data = [
                [
                    Paragraph(f"<b>Day {day_num}: {topic_name}</b>", styles["DayCardTitle"]),
                    Paragraph(f"{est_mins} mins &bull; <font color='{priority_color}'><b>{priority}</b></font> &bull; {status_tag}", styles["DayCardMeta"]),
                ],
                [
                    body_paragraphs,
                    "",
                ],
            ]

            t_day = Table(card_data, colWidths=[375, 148])
            t_day.setStyle(TableStyle([
                ("SPAN", (0, 1), (1, 1)),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#FFFFFF")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor("#E2E8F0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2.5),
                ("TOPPADDING", (0, 1), (-1, 1), 3.5),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 4),
            ]))

            day_cards.append(t_day)

        # Smart Page Break:
        # Group week banner with the first day to prevent orphaned banners
        if day_cards:
            story.append(KeepTogether([
                t_week_banner,
                Spacer(1, 4),
                day_cards[0],
            ]))
            story.append(Spacer(1, 5))

            # Subsequent days flow with individual KeepTogether cards
            for card in day_cards[1:]:
                story.append(KeepTogether(card))
                story.append(Spacer(1, 5))
        else:
            story.append(t_week_banner)
            story.append(Spacer(1, 5))

    # =========================================================================
    # SECTION 3: PROGRESS & STRATEGIC RECOMMENDATIONS
    # =========================================================================
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Roadmap Progress & Strategic Recommendations</b>", styles["SectionHeading"]))

    # Progress Summary Stats Bar
    prog_data = [
        [
            Paragraph("TOTAL TASKS", styles["MetaLabel"]),
            Paragraph("COMPLETED", styles["MetaLabel"]),
            Paragraph("PENDING", styles["MetaLabel"]),
            Paragraph("OVERALL COMPLETION", styles["MetaLabel"]),
        ],
        [
            Paragraph(f"<b>{total_tasks}</b>", styles["BigStat"]),
            Paragraph(f"<b>{completed_tasks}</b>", styles["BigStat"]),
            Paragraph(f"<b>{pending_tasks}</b>", styles["BigStat"]),
            Paragraph(f"<b>{completion_rate_pct}%</b>", styles["BigStat"]),
        ],
    ]
    t_prog = Table(prog_data, colWidths=[130, 130, 130, 133])
    t_prog.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t_prog)

    # Strong Skills vs Priority Focus (2-Column Box)
    skills_box_data = [
        [
            Paragraph("<b>ASSESSED STRONG SKILLS</b>", ParagraphStyle("S1", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#16A34A"))),
            Paragraph("<b>PRIORITY IMPROVEMENT FOCUS</b>", ParagraphStyle("S2", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#DC2626"))),
        ],
        [
            Paragraph(
                ", ".join(strong_skills) if strong_skills else "Solid conceptual foundation demonstrated across core interview topics.",
                styles["TableCell"]
            ),
            Paragraph(
                ", ".join(skill_gaps) if skill_gaps else f"Targeted interview competencies for {target_role}.",
                styles["TableCell"]
            ),
        ],
    ]
    t_skills = Table(skills_box_data, colWidths=[255, 268])
    t_skills.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 1), colors.HexColor("#F0FDF4")),
        ("BACKGROUND", (1, 0), (1, 1), colors.HexColor("#FEF2F2")),
        ("BOX", (0, 0), (0, 1), 0.75, colors.HexColor("#BBF7D0")),
        ("BOX", (1, 0), (1, 1), 0.75, colors.HexColor("#FECACA")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Spacer(1, 5))
    story.append(t_skills)

    # AI-Generated Recommendations Box
    rec_list = plan_data.get("recommendations") or [
        f"Consistently complete the {daily_minutes}-minute daily task commitments to build lasting interview muscle memory.",
        f"Prioritize High and Critical priority milestones before moving to advanced edge-case topics.",
        f"Rehearse answers out loud using Intervexa AI's Practice Assistant to reinforce structured communication.",
        f"Take an adaptive mock interview upon completing each weekly milestone to measure score gains.",
    ]

    recs_content = [
        Paragraph("<b>AI Recommendations & Preparation Strategy:</b>", styles["WeekTitle"]),
    ]
    for r in rec_list:
        recs_content.append(Paragraph(f"&bull; {r}", styles["BodyDark"]))

    t_recs = Table([[recs_content]], colWidths=[usable_width])
    t_recs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF5FF")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E9D5FF")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    story.append(Spacer(1, 5))
    story.append(t_recs)

    # Build PDF with custom NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()

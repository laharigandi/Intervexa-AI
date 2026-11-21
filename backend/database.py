import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "interview_history.db")


def get_db_connection(db_path=None):
    """Returns a SQLite connection to the centralized database file with foreign keys enabled."""
    path = db_path or DB_PATH
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Interviews Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interviews(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT,
        avg_score REAL,
        summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # Interview Details Table (Question-level breakdown)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interview_details(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        candidate_answer TEXT,
        technical_score REAL,
        communication_score REAL,
        strengths TEXT,
        mistakes TEXT,
        improved_answer TEXT,
        ideal_answer TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )
    """)

    # Index for fast lookup of question details by interview_id
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_interview_details_interview_id 
    ON interview_details(interview_id)
    """)

    # Idempotent column migrations for interviews table
    cursor.execute("PRAGMA table_info(interviews)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    additional_columns = [
        ("recommendation", "TEXT"),
        ("strengths", "TEXT"),
        ("weaknesses", "TEXT"),
        ("advice", "TEXT"),
        ("interview_mode", "TEXT DEFAULT 'standard'"),
        ("interview_type", "TEXT DEFAULT 'Standard'"),
        ("duration_minutes", "REAL DEFAULT 0"),
        ("status", "TEXT DEFAULT 'completed'"),
        ("communication_score", "REAL"),
        ("communication_feedback", "TEXT"),
        ("interviewer_personality", "TEXT DEFAULT 'technical'"),
        ("speaking_metrics", "TEXT"),
        ("verification_summary", "TEXT"),
    ]
    for col_name, col_type in additional_columns:
        if col_name not in existing_columns:
            cursor.execute(f"ALTER TABLE interviews ADD COLUMN {col_name} {col_type}")

    # Idempotent column migrations for interview_details table
    cursor.execute("PRAGMA table_info(interview_details)")
    existing_detail_columns = {row[1] for row in cursor.fetchall()}

    additional_detail_columns = [
        ("difficulty", "TEXT DEFAULT 'medium'"),
        ("topic", "TEXT"),
        ("assesses_skill", "TEXT"),
        ("reason", "TEXT"),
        ("communication_feedback", "TEXT"),
        ("correct_concepts", "TEXT"),
        ("missing_concepts", "TEXT"),
        ("improvement_suggestions", "TEXT"),
        ("key_takeaways", "TEXT"),
        ("follow_up_questions", "TEXT"),
        ("verification_result", "TEXT"),
        ("speaking_metrics", "TEXT"),
    ]
    for col_name, col_type in additional_detail_columns:
        if col_name not in existing_detail_columns:
            cursor.execute(f"ALTER TABLE interview_details ADD COLUMN {col_name} {col_type}")

    # Answer Verifications Table (Evidence-based verification & hallucination detection audit)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS answer_verifications(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        interview_id INTEGER,
        question_index INTEGER,
        question TEXT NOT NULL,
        candidate_answer TEXT,
        correctness_score REAL DEFAULT 0,
        verification_status TEXT DEFAULT 'Unverified',
        claims_json TEXT,
        incorrect_statements_json TEXT,
        explanation TEXT,
        corrected_answer TEXT,
        evidence_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_answer_verifications_interview_id
    ON answer_verifications(interview_id)
    """)

    # Learning Roadmaps Table (User-specific persistent roadmap)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS learning_roadmaps(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        roadmap_data TEXT NOT NULL,
        completed_tasks TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_learning_roadmaps_user_id 
    ON learning_roadmaps(user_id)
    """)

    # =========================================================================
    # AI INTERVIEW MEMORY & PERSONALIZED FOLLOW-UP ENGINE TABLES
    # =========================================================================

    # 1. Interview Memory (High-level memory summary per user & role)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interview_memory(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_role TEXT NOT NULL,
        total_completed_interviews INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        summary_notes TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, target_role)
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_interview_memory_user_id
    ON interview_memory(user_id)
    """)

    # 2. Candidate Skill Progress (Topic-level mastery tracking across interviews)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidate_skill_progress(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        previous_score REAL DEFAULT 0,
        latest_score REAL DEFAULT 0,
        average_score REAL DEFAULT 0,
        attempt_count INTEGER DEFAULT 1,
        improvement_trend REAL DEFAULT 0,
        mastery_status TEXT DEFAULT 'Needs Practice',
        last_practiced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, topic)
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_candidate_skill_progress_user
    ON candidate_skill_progress(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_candidate_skill_progress_topic
    ON candidate_skill_progress(user_id, topic)
    """)

    # 3. Topic Performance History (Granular audit log of each question's evaluation per interview)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS topic_performance_history(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        interview_id INTEGER,
        topic TEXT NOT NULL,
        score REAL DEFAULT 0,
        identified_mistakes TEXT,
        improvement_suggestions TEXT,
        missing_concepts TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_topic_perf_history_user
    ON topic_performance_history(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_topic_perf_history_interview
    ON topic_performance_history(interview_id)
    """)

    # Safe migration: ensure interview_id in topic_performance_history allows NULL
    try:
        cursor.execute("PRAGMA table_info(topic_performance_history)")
        t_cols = cursor.fetchall()
        inv_col = next((c for c in t_cols if c[1] == "interview_id"), None)
        if inv_col and inv_col[3] == 1:  # notnull flag is set
            cursor.execute("""
            CREATE TABLE topic_performance_history_new(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                interview_id INTEGER,
                topic TEXT NOT NULL,
                score REAL DEFAULT 0,
                identified_mistakes TEXT,
                improvement_suggestions TEXT,
                missing_concepts TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(interview_id) REFERENCES interviews(id) ON DELETE CASCADE
            )
            """)
            cursor.execute("""
            INSERT INTO topic_performance_history_new
            SELECT id, user_id, interview_id, topic, score, identified_mistakes, improvement_suggestions, missing_concepts, created_at
            FROM topic_performance_history
            """)
            cursor.execute("DROP TABLE topic_performance_history")
            cursor.execute("ALTER TABLE topic_performance_history_new RENAME TO topic_performance_history")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_topic_perf_history_user ON topic_performance_history(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_topic_perf_history_interview ON topic_performance_history(interview_id)")
    except Exception:
        pass

    # 4. Personalized Question History (Tracks memory-generated follow-up questions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS personalized_question_history(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        interview_id INTEGER,
        question TEXT NOT NULL,
        topic TEXT,
        difficulty TEXT DEFAULT 'medium',
        question_type TEXT DEFAULT 'conceptual',
        reason TEXT,
        memory_reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_personalized_q_user
    ON personalized_question_history(user_id)
    """)

    # =========================================================================
    # AI INTERVIEW READINESS PREDICTION & SKILL GAP RADAR TABLES
    # =========================================================================
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS readiness_history(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        interview_id INTEGER,
        overall_score REAL NOT NULL,
        readiness_category TEXT NOT NULL,
        technical_score REAL,
        communication_score REAL,
        problem_solving_score REAL,
        role_skills_score REAL,
        resume_match_score REAL,
        consistency_score REAL,
        metrics_breakdown TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_readiness_history_user
    ON readiness_history(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_readiness_history_interview
    ON readiness_history(interview_id)
    """)

    # =========================================================================
    # AI PERSONALIZED STUDY PLANNER TABLES
    # =========================================================================
    # 1. Study Plans Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plans(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_role TEXT NOT NULL,
        duration_days INTEGER NOT NULL DEFAULT 14,
        daily_study_minutes INTEGER NOT NULL DEFAULT 60,
        preparation_level TEXT NOT NULL DEFAULT 'Intermediate',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_plans_user
    ON study_plans(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_plans_status
    ON study_plans(status)
    """)

    # Safe migrations for study_plans
    try:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN plan_title TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN summary TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_plans ADD COLUMN requested_topic TEXT DEFAULT ''")
    except Exception:
        pass

    # 2. Study Tasks Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_tasks(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        task_date DATE NOT NULL,
        topic TEXT NOT NULL,
        description TEXT,
        learning_objective TEXT,
        estimated_minutes INTEGER DEFAULT 60,
        priority TEXT DEFAULT 'Medium',
        difficulty TEXT DEFAULT 'Intermediate',
        status TEXT DEFAULT 'pending',
        completion_criteria TEXT,
        recommended_practice TEXT,
        why_recommended TEXT,
        rescheduled_date DATE,
        skip_reason TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_tasks_plan
    ON study_tasks(plan_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date
    ON study_tasks(user_id, task_date)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_tasks_status
    ON study_tasks(status)
    """)

    # Safe migrations for study_tasks
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN subtopics TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN recommended_resources TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN explanation TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN what_you_will_learn TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN learning_steps TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN practical_examples TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN topic_breakdown TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN practice_activities TEXT DEFAULT '[]'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE study_tasks ADD COLUMN completion_goals TEXT DEFAULT '[]'")
    except Exception:
        pass

    # 3. Learning Activities Table (Tracks practice sessions, MCQs, coding exercises)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS learning_activities(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER,
        topic TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        practice_score REAL,
        total_questions INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        activity_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES study_tasks(id) ON DELETE SET NULL
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_learning_activities_user
    ON learning_activities(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_learning_activities_task
    ON learning_activities(task_id)
    """)

    # 4. Study Topic Mastery Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_topic_mastery(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        total_attempts INTEGER DEFAULT 0,
        completed_tasks_count INTEGER DEFAULT 0,
        latest_score REAL DEFAULT 0.0,
        average_score REAL DEFAULT 0.0,
        mastery_status TEXT DEFAULT 'Not Started',
        last_practiced_at TIMESTAMP,
        UNIQUE(user_id, topic),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_study_topic_mastery_user
    ON study_topic_mastery(user_id)
    """)

    # 5. User Resumes Table (Strict resume-specific tracking & analysis records)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resumes(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT,
        extracted_text TEXT,
        skills TEXT,
        analysis TEXT,
        jd_match TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_resumes_user
    ON resumes(user_id)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_resumes_active
    ON resumes(user_id, is_active)
    """)

    # Ensure backward-compatible columns exist on resumes table
    cursor.execute("PRAGMA table_info(resumes)")
    existing_cols = {col[1] for col in cursor.fetchall()}
    if "file_hash" not in existing_cols:
        cursor.execute("ALTER TABLE resumes ADD COLUMN file_hash TEXT")
    if "target_role" not in existing_cols:
        cursor.execute("ALTER TABLE resumes ADD COLUMN target_role TEXT")
    if "ats_score" not in existing_cols:
        cursor.execute("ALTER TABLE resumes ADD COLUMN ats_score INTEGER")
    if "scoring_version" not in existing_cols:
        cursor.execute("ALTER TABLE resumes ADD COLUMN scoring_version TEXT DEFAULT '2.0-deterministic'")
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_resumes_hash
    ON resumes(user_id, file_hash)
    """)

    # 6. Chatbot Conversations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chatbot_conversations(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_chatbot_conv_user
    ON chatbot_conversations(user_id, updated_at)
    """)

    # 7. Chatbot Messages Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chatbot_messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        page_context TEXT,
        evidence_sources TEXT,
        suggested_followups TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_chatbot_messages_user_conv
    ON chatbot_messages(user_id, conversation_id, created_at)
    """)

    # 8. Daily Quizzes Table (Tracks personalized daily quiz questions, answers, and scores)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_quizzes(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER,
        task_id INTEGER,
        day_number INTEGER NOT NULL,
        topic TEXT NOT NULL,
        role TEXT,
        difficulty TEXT DEFAULT 'Intermediate',
        questions_json TEXT NOT NULL,
        user_answers_json TEXT DEFAULT '{}',
        score_pct REAL DEFAULT 0.0,
        total_questions INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        wrong_answers INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
        FOREIGN KEY(task_id) REFERENCES study_tasks(id) ON DELETE SET NULL,
        UNIQUE(user_id, plan_id, day_number)
    )
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_daily_quizzes_user_plan
    ON daily_quizzes(user_id, plan_id, day_number)
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_daily_quizzes_status
    ON daily_quizzes(user_id, status)
    """)

    conn.commit()
    conn.close()

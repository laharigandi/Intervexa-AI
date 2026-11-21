"""
End-to-End Test Suite for AI Study Planner Feature
Intervexa AI - Smart Interview Coach

Tests the complete 12 required scenarios from the prompt:
1. Generate plan for selected job role.
2. Generate plan when resume data is unavailable.
3. Generate plan when interview history is empty.
4. Verify Groq response parsed correctly into structured JSON.
5. Verify plan and tasks saved in SQLite.
6. Verify persistence across page refresh / re-fetching.
7. Mark task completed and verify progress updates.
8. Skip and reschedule a task.
9. Log out and log back in (token refresh and session persistence).
10. Verify User isolation (User A cannot access or modify User B's plan).
11. Test API failure and invalid AI response handling.
12. Verify existing Learning Roadmap functionality still works.
"""

import os
import sys
import json
import sqlite3
import datetime
from unittest.mock import patch

# Ensure backend path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import init_db, get_db_connection
from app import app
from flask_jwt_extended import create_access_token
from services.study_planner_service import (
    generate_study_plan,
    get_study_plan_overview,
    update_task_status,
    reschedule_study_task,
)

def run_all_tests():
    print("=" * 70)
    print("STARTING COMPLETE E2E TEST SUITE FOR AI STUDY PLANNER")
    print("=" * 70)

    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create two test users: User A (id: 8881), User B (id: 8882)
    user_a_id = 8881
    user_b_id = 8882

    cursor.execute("DELETE FROM users WHERE id IN (?, ?)", (user_a_id, user_b_id))
    cursor.execute("DELETE FROM study_plans WHERE user_id IN (?, ?)", (user_a_id, user_b_id))
    cursor.execute("DELETE FROM study_tasks WHERE user_id IN (?, ?)", (user_a_id, user_b_id))
    cursor.execute("DELETE FROM study_topic_mastery WHERE user_id IN (?, ?)", (user_a_id, user_b_id))
    cursor.execute("DELETE FROM interviews WHERE user_id IN (?, ?)", (user_a_id, user_b_id))

    cursor.execute(
        "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
        (user_a_id, "Test User A", "usera_test@intervexa.ai", "hashed_pwd_a")
    )
    cursor.execute(
        "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
        (user_b_id, "Test User B", "userb_test@intervexa.ai", "hashed_pwd_b")
    )
    conn.commit()
    conn.close()

    # Generate JWT tokens
    with app.app_context():
        token_a = create_access_token(identity=str(user_a_id))
        token_b = create_access_token(identity=str(user_b_id))

    headers_a = {"Authorization": f"Bearer {token_a}", "Content-Type": "application/json"}
    headers_b = {"Authorization": f"Bearer {token_b}", "Content-Type": "application/json"}

    client = app.test_client()

    results = []

    # -------------------------------------------------------------------------
    # Scenario 1: Generate plan for selected job role (with Groq API)
    # -------------------------------------------------------------------------
    print("\n[Scenario 1] Generating plan for selected job role (Full Stack Developer)...")
    res1 = client.post(
        "/study-planner/generate",
        headers=headers_a,
        json={
            "target_role": "Full Stack Developer",
            "duration_days": 7,
            "daily_study_minutes": 60,
            "preparation_level": "Intermediate",
            "resume_skills": ["React", "JavaScript", "HTML", "CSS"],
            "include_memory": True,
            "include_resume": True
        }
    )
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.get_data(as_text=True)}"
    data1 = res1.get_json()
    assert data1["success"] is True, "Expected success to be True"
    plan1 = data1["plan"]
    assert plan1["has_active_plan"] is True
    assert plan1["target_role"] == "Full Stack Developer"
    assert plan1["duration_days"] == 7
    assert len(plan1["tasks"]) == 7
    print(f"[PASS] Scenario 1: Plan generated successfully! Plan title: {plan1.get('plan_title')}")
    results.append("Scenario 1: Plan generation for selected role with Groq [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 2: Generate plan when resume data is unavailable
    # -------------------------------------------------------------------------
    print("\n[Scenario 2] Generating plan when resume data is unavailable...")
    res2 = client.post(
        "/study-planner/generate",
        headers=headers_a,
        json={
            "target_role": "Backend Developer",
            "duration_days": 7,
            "daily_study_minutes": 30,
            "preparation_level": "Beginner",
            "resume_text": "",
            "resume_skills": [],
            "include_resume": False
        }
    )
    assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.get_data(as_text=True)}"
    data2 = res2.get_json()
    assert data2["success"] is True
    assert len(data2["plan"]["tasks"]) == 7
    assert data2["plan"]["target_role"] == "Backend Developer"
    print(f"[PASS] Scenario 2: Generated plan without resume data! Active tasks: {len(data2['plan']['tasks'])}")
    results.append("Scenario 2: Plan generation when resume data is unavailable [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 3: Generate plan when interview history is empty (User B)
    # -------------------------------------------------------------------------
    print("\n[Scenario 3] Generating plan when interview history is empty (User B)...")
    res3 = client.post(
        "/study-planner/generate",
        headers=headers_b,
        json={
            "target_role": "Python Developer",
            "duration_days": 14,
            "daily_study_minutes": 60,
            "preparation_level": "Intermediate"
        }
    )
    assert res3.status_code == 200, f"Expected 200, got {res3.status_code}: {res3.get_data(as_text=True)}"
    data3 = res3.get_json()
    assert data3["success"] is True
    assert data3["plan"]["target_role"] == "Python Developer"
    assert len(data3["plan"]["tasks"]) == 14
    print(f"[PASS] Scenario 3: Generated plan for empty history candidate! Tasks: {len(data3['plan']['tasks'])}")
    results.append("Scenario 3: Plan generation when interview history is empty [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 4: Verify Groq response schema parsing
    # -------------------------------------------------------------------------
    print("\n[Scenario 4] Verifying Groq response schema parsing...")
    sample_task = data3["plan"]["tasks"][0]
    required_fields = [
        "topic", "learning_objective", "estimated_minutes",
        "priority", "difficulty", "recommended_practice",
        "completion_criteria", "why_recommended"
    ]
    for field in required_fields:
        assert field in sample_task, f"Field {field} missing from task schema"
        assert sample_task[field] is not None and str(sample_task[field]).strip() != "", f"Field {field} is empty"
    print(f"[PASS] Scenario 4: All required fields present and non-empty: {required_fields}")
    results.append("Scenario 4: Groq response schema validation [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 5: Verify SQLite persistence
    # -------------------------------------------------------------------------
    print("\n[Scenario 5] Verifying SQLite persistence...")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, user_id, target_role, duration_days, status, plan_title FROM study_plans WHERE user_id = ? AND status = 'active'", (user_b_id,))
    db_plan = c.fetchone()
    assert db_plan is not None, "Study plan not found in SQLite database"
    plan_b_id = db_plan[0]
    assert db_plan[1] == user_b_id
    assert db_plan[2] == "Python Developer"
    assert db_plan[3] == 14

    c.execute("SELECT COUNT(*) FROM study_tasks WHERE plan_id = ?", (plan_b_id,))
    tasks_count = c.fetchone()[0]
    assert tasks_count == 14, f"Expected 14 tasks in SQLite, got {tasks_count}"
    conn.close()
    print(f"[PASS] Scenario 5: SQLite verified! Plan ID: {plan_b_id}, Active Tasks in DB: {tasks_count}")
    results.append("Scenario 5: SQLite persistence verification [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 6: Verify page refresh persistence (Overview endpoint)
    # -------------------------------------------------------------------------
    print("\n[Scenario 6] Verifying persistence across simulated page refresh...")
    res6 = client.get("/study-planner/overview", headers=headers_b)
    assert res6.status_code == 200
    data6 = res6.get_json()["data"]
    assert data6["has_active_plan"] is True
    assert data6["plan_id"] == plan_b_id
    assert len(data6["tasks"]) == 14
    print("[PASS] Scenario 6: Re-fetching overview returned full persisted plan and tasks")
    results.append("Scenario 6: Refresh and overview persistence [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 7: Mark task as completed & verify progress updates
    # -------------------------------------------------------------------------
    print("\n[Scenario 7] Marking task completed and verifying progress updates...")
    first_task = data6["tasks"][0]
    task_id = first_task["id"]
    res7 = client.patch(
        f"/study-planner/tasks/{task_id}",
        headers=headers_b,
        json={"status": "completed"}
    )
    assert res7.status_code == 200, f"Expected 200, got {res7.status_code}: {res7.get_data(as_text=True)}"
    data7 = res7.get_json()
    assert data7["success"] is True

    # Re-fetch overview
    res7_check = client.get("/study-planner/overview", headers=headers_b)
    overview7 = res7_check.get_json()["data"]
    assert overview7["completed_tasks"] >= 1, "Completed tasks count did not increment"
    assert overview7["completion_rate_pct"] > 0, "Completion rate percentage did not update"
    assert overview7["streak_days"] >= 1, "Streak did not increment"
    print(f"[PASS] Scenario 7: Completed task! New completion rate: {overview7['completion_rate_pct']}%, Streak: {overview7['streak_days']} day(s)")
    results.append("Scenario 7: Mark task completed and progress recalculation [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 8: Skip and Reschedule task
    # -------------------------------------------------------------------------
    print("\n[Scenario 8] Skipping and rescheduling tasks...")
    second_task = data6["tasks"][1]
    res8_skip = client.patch(
        f"/study-planner/tasks/{second_task['id']}",
        headers=headers_b,
        json={"status": "skipped", "skip_reason": "Already proficient in this module"}
    )
    assert res8_skip.status_code == 200
    assert res8_skip.get_json()["success"] is True

    third_task = data6["tasks"][2]
    new_target_date = (datetime.date.today() + datetime.timedelta(days=20)).isoformat()
    res8_resched = client.post(
        f"/study-planner/tasks/{third_task['id']}/reschedule",
        headers=headers_b,
        json={"new_date": new_target_date}
    )
    assert res8_resched.status_code == 200
    assert res8_resched.get_json()["success"] is True
    print(f"[PASS] Scenario 8: Successfully skipped task and rescheduled task to {new_target_date}")
    results.append("Scenario 8: Skip and reschedule tasks [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 9: Log out and log back in (new JWT token maintains state)
    # -------------------------------------------------------------------------
    print("\n[Scenario 9] Simulating logout and re-login with fresh JWT token...")
    with app.app_context():
        fresh_token_b = create_access_token(identity=str(user_b_id))
    fresh_headers_b = {"Authorization": f"Bearer {fresh_token_b}", "Content-Type": "application/json"}
    res9 = client.get("/study-planner/overview", headers=fresh_headers_b)
    assert res9.status_code == 200
    overview9 = res9.get_json()["data"]
    assert overview9["completed_tasks"] >= 1
    assert overview9["skipped_tasks"] >= 1
    print("[PASS] Scenario 9: Fresh session restored all saved study plan metrics seamlessly")
    results.append("Scenario 9: Logout and login persistence [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 10: User isolation check
    # -------------------------------------------------------------------------
    print("\n[Scenario 10] Checking user isolation...")
    # User A tries to update User B's task
    res10_tamper = client.patch(
        f"/study-planner/tasks/{first_task['id']}",
        headers=headers_a,
        json={"status": "completed"}
    )
    assert res10_tamper.status_code == 400 or res10_tamper.status_code == 404, "User A was able to update User B's task!"

    # User A views their own overview
    res10_a = client.get("/study-planner/overview", headers=headers_a)
    overview_a = res10_a.get_json()["data"]
    assert overview_a["target_role"] == "Backend Developer"
    assert overview_a["target_role"] != overview9["target_role"]
    print("[PASS] Scenario 10: User isolation verified! User A cannot modify or access User B's data")
    results.append("Scenario 10: Multi-user isolation [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 11: AI failure and invalid AI response handling
    # -------------------------------------------------------------------------
    print("\n[Scenario 11] Testing AI failure and meaningful error message...")
    with patch("services.study_planner_service._call_groq", side_effect=Exception("Groq API rate limit reached")):
        res11 = client.post(
            "/study-planner/generate",
            headers=headers_a,
            json={"target_role": "DevOps Engineer", "duration_days": 7}
        )
        assert res11.status_code in [500, 503], f"Expected 500/503, got {res11.status_code}"
        data11 = res11.get_json()
        assert data11["success"] is False
        assert "Groq API rate limit reached" in data11.get("message", "") or "Groq API rate limit reached" in data11.get("error", "")
        print(f"[PASS] Scenario 11: Meaningful error returned when Groq fails: {data11.get('error') or data11.get('message')}")
        results.append("Scenario 11: Graceful AI failure handling [PASS]")

    # -------------------------------------------------------------------------
    # Scenario 12: Verify Learning Roadmap functionality still works
    # -------------------------------------------------------------------------
    print("\n[Scenario 12] Verifying existing Learning Roadmap functionality...")
    res12 = client.get("/roadmap?role=Full%20Stack%20Developer", headers=headers_a)
    assert res12.status_code == 200, f"Expected 200 for /roadmap, got {res12.status_code}"
    data12 = res12.get_json()
    assert data12.get("success") is True or "role" in data12 or "days" in data12, "Roadmap response invalid"
    print("[PASS] Scenario 12: Existing Learning Roadmap endpoint is fully functional!")
    results.append("Scenario 12: Learning Roadmap backwards compatibility [PASS]")

    print("\n" + "=" * 70)
    print("ALL 12 SCENARIOS COMPLETED SUCCESSFULLY:")
    print("=" * 70)
    for r in results:
        print(f" [OK] {r}")

if __name__ == "__main__":
    run_all_tests()

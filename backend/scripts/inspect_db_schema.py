import sqlite3

conn = sqlite3.connect('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/interview_history.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print("Tables in interview_history.db:", tables)

for table in tables:
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [f"{r[1]} ({r[2]})" for r in cursor.fetchall()]
    print(f"\nTable '{table}':\n  " + ", ".join(cols))

import sqlite3

conn = sqlite3.connect('d:/Smart-Interview-Coach/Smart-Interview-Coach/backend/interview_history.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check user 1 statistics
cursor.execute('''
    SELECT COUNT(*) as total, AVG(avg_score) as average, MAX(avg_score) as best
    FROM interviews
    WHERE user_id = 1 AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
''')
row = cursor.fetchone()
print(f'User 1: Total: {row["total"]}, Average: {row["average"]}, Best: {row["best"]}')

# Check latest interview
cursor.execute('''
    SELECT id, role, avg_score, interview_mode, interview_type, created_at
    FROM interviews
    WHERE user_id = 1 AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
    ORDER BY created_at DESC LIMIT 1
''')
latest = cursor.fetchone()
if latest:
    print(f'Latest: {latest["role"]}, score: {latest["avg_score"]}, type: {latest["interview_type"] or latest["interview_mode"]}, date: {latest["created_at"]}')

# Check user 9 (0 interviews)
cursor.execute('''
    SELECT COUNT(*) as total, AVG(avg_score) as average, MAX(avg_score) as best
    FROM interviews
    WHERE user_id = 9 AND (status = 'completed' OR status IS NULL) AND avg_score IS NOT NULL
''')
row9 = cursor.fetchone()
print(f'User 9: Total: {row9["total"]}, Average: {row9["average"]}, Best: {row9["best"]}')

conn.close()

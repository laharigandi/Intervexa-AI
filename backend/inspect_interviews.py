import sqlite3
conn = sqlite3.connect('interview_history.db')
c = conn.cursor()
c.execute("SELECT DISTINCT status FROM interviews")
print("Distinct statuses:", c.fetchall())
c.execute("SELECT COUNT(*) FROM interviews WHERE status = 'completed' OR status IS NULL")
print("Completed count:", c.fetchone()[0])
conn.close()

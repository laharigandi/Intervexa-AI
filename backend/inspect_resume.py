with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '/resume' in l or 'ats' in l.lower() or 'match' in l.lower() or 'upload' in l.lower():
        print(f"L{i+1}: {l.strip()[:100]}")

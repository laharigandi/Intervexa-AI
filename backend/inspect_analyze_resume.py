with open('services/groq_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'def analyze_resume' in l:
        print(f"Found at line {i+1}")
        for j in range(i, min(i+100, len(lines))):
            print(f"L{j+1}: {lines[j]}", end='')
        break

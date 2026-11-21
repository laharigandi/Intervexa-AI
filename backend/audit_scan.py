import os
import re

files_to_scan = ['app.py']
services_dir = 'services'
for fname in sorted(os.listdir(services_dir)):
    if fname.endswith('.py'):
        files_to_scan.append(os.path.join(services_dir, fname))

patterns = [r'fallback', r'mock', r'dummy', r'fake', r'hardcode']

print(f"Scanning {len(files_to_scan)} files...")
for fpath in files_to_scan:
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    matches = []
    for idx, line in enumerate(lines, 1):
        for pat in patterns:
            if re.search(pat, line, re.IGNORECASE):
                stripped = line.strip()
                matches.append((idx, stripped[:120]))
                break
    if matches:
        filtered = []
        for idx, text in matches:
            if 'mock interview' in text.lower() and not any(p in text.lower() for p in ['fallback', 'dummy', 'fake', 'hardcode']):
                continue
            filtered.append((idx, text))
        if filtered:
            print(f"\n--- {fpath} ({len(filtered)} matches) ---")
            for idx, text in filtered:
                print(f"  L{idx}: {text}")

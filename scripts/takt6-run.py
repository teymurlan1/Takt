from pathlib import Path
p=Path('scripts/takt6-finalize.py')
s=p.read_text(encoding='utf-8')
s=s.replace('s=once(s,"]\\n];\\nconst initialized=new WeakMap();",', 's=once(s,"\\n];\\nconst initialized=new WeakMap();",')
p.write_text(s,encoding='utf-8')
exec(compile(s,str(p),'exec'))

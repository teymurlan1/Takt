from pathlib import Path
p=Path('scripts/takt6-finalize.py')
s=p.read_text(encoding='utf-8')
s=s.replace('s=once(s,"]\\n];\\nconst initialized=new WeakMap();",', 's=once(s,"\\n];\\nconst initialized=new WeakMap();",')
s=s.replace('s=once(s,"\\n];\\nconst initialized=new WeakMap();"," ]\\n,`CREATE TABLE'.replace(' ]',' ]'), 's=once(s,"\\n];\\nconst initialized=new WeakMap();",",\\n`CREATE TABLE') if False else s
# The original target was shortened from "]\n];" to "\n];"; shorten the replacement too.
s=s.replace('s=once(s,"\\n];\\nconst initialized=new WeakMap();","]\\n,`CREATE TABLE', 's=once(s,"\\n];\\nconst initialized=new WeakMap();",",\\n`CREATE TABLE')
s=s.replace("const meta=payload.takt;delete payload.takt;if(meta){const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(meta.booking).first();", "const meta=payload.takt;delete payload.takt;\\n if(meta){const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(meta.booking).first();")
p.write_text(s,encoding='utf-8')
exec(compile(s,str(p),'exec'))

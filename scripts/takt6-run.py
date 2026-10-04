from pathlib import Path
p=Path('scripts/takt6-finalize.py')
s=p.read_text(encoding='utf-8')
s=s.replace('s=once(s,"]\\n];\\nconst initialized=new WeakMap();",', 's=once(s,"\\n];\\nconst initialized=new WeakMap();",')
s=s.replace('s=once(s,"\\n];\\nconst initialized=new WeakMap();","]\\n,`CREATE TABLE', 's=once(s,"\\n];\\nconst initialized=new WeakMap();",",\\n`CREATE TABLE')
s=s.replace("const meta=payload.takt;delete payload.takt;if(meta){const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(meta.booking).first();", "const meta=payload.takt;delete payload.takt;\\n if(meta){const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(meta.booking).first();")
# Preserve newly queued move notices; only stale 24h reminder rows need eager deletion.
s=s.replace("db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL').bind(b.id+':%'),db.prepare('DELETE FROM booking_attendance WHERE booking_id=?').bind(b.id)", "db.prepare('DELETE FROM outbox WHERE id LIKE ? AND sent_at IS NULL AND attempts<5').bind(b.id+':reminder%'),db.prepare('DELETE FROM booking_attendance WHERE booking_id=?').bind(b.id)")
# Keep visit confirmation compact: yes/no first row, move+open second row when rescheduling is allowed.
s=s.replace("if(meta.event==='reminder'&&c.allow_reschedule)rows.push([{text:'🔄 Перенести',web_app:{url:make('move')}}]);rows.push([{text:'Открыть запись',style:'primary',web_app:{url:make()}}]);", "rows.push([...(meta.event==='reminder'&&c.allow_reschedule?[{text:'🔄 Перенести',web_app:{url:make('move')}}]:[]),{text:'Открыть запись',style:'primary',web_app:{url:make()}}]);")
p.write_text(s,encoding='utf-8')
exec(compile(s,str(p),'exec'))

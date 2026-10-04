from pathlib import Path
p=Path('src/v2.js')
s=p.read_text(encoding='utf-8')
old="`CREATE TABLE IF NOT EXISTS telegram_review_messages(booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(booking_id,chat_id))`\n];"
new="`CREATE TABLE IF NOT EXISTS telegram_review_messages(booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(booking_id,chat_id))`,\n`UPDATE specialist_options SET data=json_set(data,'$.horizon',90) WHERE COALESCE(json_extract(data,'$.horizon'),30)=30`\n];"
if s.count(old)!=1: raise SystemExit('schema anchor not found once')
p.write_text(s.replace(old,new,1),encoding='utf-8')

m=Path('migrations/0009_takt_v80.sql')
ms=m.read_text(encoding='utf-8')
line="\n-- Previous default was 30 days. Takt 8.0 moves specialists still on that default to 90 days; they can change it later.\nUPDATE specialist_options SET data=json_set(data,'$.horizon',90) WHERE COALESCE(json_extract(data,'$.horizon'),30)=30;\n"
if 'UPDATE specialist_options SET data=json_set' not in ms:
    m.write_text(ms.rstrip()+line,encoding='utf-8')
print('Applied Takt 8.0 90-day horizon migration')

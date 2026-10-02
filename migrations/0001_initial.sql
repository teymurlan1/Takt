PRAGMA foreign_keys = ON;
CREATE TABLE companies (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('beauty','cleaning','auto')),
 tagline TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 open_hour INTEGER NOT NULL DEFAULT 9, close_hour INTEGER NOT NULL DEFAULT 20,
 active INTEGER NOT NULL DEFAULT 1, CHECK(open_hour>=0 AND close_hour<=24 AND open_hour<close_hour)
);
CREATE TABLE services (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL,
 price INTEGER NOT NULL CHECK(price>=0), duration INTEGER NOT NULL CHECK(duration>=30 AND duration<=480 AND duration%30=0),
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE memberships (company_id TEXT NOT NULL REFERENCES companies(id), user_id TEXT NOT NULL, PRIMARY KEY(company_id,user_id));
CREATE TABLE bookings (
 id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), service_id TEXT NOT NULL REFERENCES services(id),
 user_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, price INTEGER NOT NULL, service_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','done','cancelled')),
 status_event TEXT, created_at INTEGER NOT NULL, request_key TEXT NOT NULL, UNIQUE(user_id,request_key)
);
CREATE INDEX bookings_company_time ON bookings(company_id,starts_at);
CREATE INDEX bookings_user ON bookings(user_id,starts_at);
CREATE TRIGGER no_booking_overlap BEFORE INSERT ON bookings
WHEN NEW.status IN ('pending','confirmed') AND EXISTS (
 SELECT 1 FROM bookings WHERE company_id=NEW.company_id AND status IN ('pending','confirmed')
 AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at
) BEGIN SELECT RAISE(ABORT,'SLOT_TAKEN'); END;
CREATE TABLE outbox (
 id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, text TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER, created_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO companies(id,name,category,tagline,address) VALUES
 ('nail','Студия Линия','beauty','Маникюр в вашем ритме','Санкт-Петербург · тестовая компания'),
 ('clean','Чистый день','cleaning','Порядок дома. Время для себя.','Санкт-Петербург · тестовая компания'),
 ('auto','Точка Мотор','auto','Забота о вашем автомобиле','Санкт-Петербург · тестовая компания');
INSERT INTO services(id,company_id,name,price,duration) VALUES
 ('nail-1','nail','Маникюр с покрытием',2400,90),('nail-2','nail','Маникюр без покрытия',1400,60),('nail-3','nail','Педикюр с покрытием',3200,120),
 ('clean-1','clean','Поддерживающая уборка',3500,180),('clean-2','clean','Генеральная уборка',6500,240),('clean-3','clean','Уборка после ремонта',8500,300),
 ('auto-1','auto','Диагностика автомобиля',1500,60),('auto-2','auto','Замена масла',1800,60),('auto-3','auto','Шиномонтаж',3000,90);

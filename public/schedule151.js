/* Takt 15.1: чистая логика календаря специалиста (проверяется тестами в Node). */
// Блок [starts_at, ends_at) относится к дню d, если день пересекается с блоком.
// Конец блока не включается: «выходной 10-го» заканчивается в 00:00 11-го и на 11-е не попадает.
export const blocksForDay=(blocks,d,dateOf)=>(blocks||[]).filter(b=>dateOf(b.starts_at)<=d&&dateOf(Math.max(b.starts_at,b.ends_at-1))>=d);

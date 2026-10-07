// Фиксированные «часы» для тестов, чтобы результат не зависел от времени суток запуска.
// 2026-10-08 09:00 UTC = 12:00 в Москве: далеко от полуночи и от тихих часов.
export const NOON_UTC=Date.UTC(2026,9,8,9,0,0);
export function freezeClock(ms=NOON_UTC){const real=Date.now;Date.now=()=>ms;return ()=>{Date.now=real}}

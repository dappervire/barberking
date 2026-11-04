const OPEN_MINUTES = 10 * 60;
const CLOSE_MINUTES = 21 * 60;
const SLOT_MINUTES = 30;
const BARBER_COUNT = 5;
const CANCEL_CUTOFF_MINUTES = 60;
const SHOP_TIMEZONE = process.env.BOOKING_TIMEZONE || 'Asia/Jakarta';

function toMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function toTimeString(totalMinutes) {
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function isOnSlotGrid(time) {
    return (toMinutes(time) - OPEN_MINUTES) % SLOT_MINUTES === 0;
}

function fitsBusinessHours(startMinutes, durationMinutes) {
    return startMinutes >= OPEN_MINUTES && startMinutes + durationMinutes <= CLOSE_MINUTES;
}

// Waktu server bisa UTC, jadi "sekarang" harus dihitung di zona waktu barbershop.
function nowInShop() {
    const [date, time] = new Date()
        .toLocaleString('sv-SE', { timeZone: SHOP_TIMEZONE, hourCycle: 'h23' })
        .split(' ');
    return { date, time };
}

function isBeforeCancelCutoff(date, time) {
    const now = nowInShop();
    const millisecondsLeft = Date.parse(`${date}T${time}Z`) - Date.parse(`${now.date}T${now.time}Z`);
    return millisecondsLeft >= CANCEL_CUTOFF_MINUTES * 60 * 1000;
}

function isInPast(date, time) {
    const now = nowInShop();
    return date < now.date || (date === now.date && time <= now.time.slice(0, 5));
}

// Jumlah barber yang kepakai paling tinggi selalu terjadi pas ada booking yang mulai,
// jadi cukup dicek di awal slot baru dan di setiap booking yang mulai selama slot itu.
function hasFreeBarber(existing, startMinutes, durationMinutes) {
    const endMinutes = startMinutes + durationMinutes;
    const checkpoints = [
        startMinutes,
        ...existing.filter((b) => b.start > startMinutes && b.start < endMinutes).map((b) => b.start),
    ];
    return checkpoints.every((point) => {
        const busy = existing.filter((b) => b.start <= point && point < b.end).length;
        return busy < BARBER_COUNT;
    });
}

function getDaySlots(date, durationMinutes, existing) {
    const slots = [];
    for (let start = OPEN_MINUTES; start < CLOSE_MINUTES; start += SLOT_MINUTES) {
        const time = toTimeString(start);
        slots.push({
            time,
            available: !isInPast(date, time)
                && fitsBusinessHours(start, durationMinutes)
                && hasFreeBarber(existing, start, durationMinutes),
        });
    }
    return slots;
}

module.exports = {
    SLOT_MINUTES,
    CANCEL_CUTOFF_MINUTES,
    closingTime: toTimeString(CLOSE_MINUTES),
    toMinutes,
    isOnSlotGrid,
    fitsBusinessHours,
    nowInShop,
    isBeforeCancelCutoff,
    isInPast,
    hasFreeBarber,
    getDaySlots,
};

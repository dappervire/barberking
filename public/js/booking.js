const CHOOSE_FIRST_MESSAGE = 'Pilih layanan dan tanggal dulu.';

const timePicker = createTimePicker('timePicker', CHOOSE_FIRST_MESSAGE);
const servicePicker = createServicePicker('servicePicker', refreshAvailability);
const datePicker = createDatePicker('datePicker', refreshAvailability);

const requiredPickers = [
    { picker: servicePicker, message: 'Pilih layanan dulu.' },
    { picker: datePicker, message: 'Pilih tanggal dulu.' },
    { picker: timePicker, message: 'Pilih jam dulu.' },
];

// Kalau pilihan diganti cepat, cuma jawaban dari permintaan terakhir yang dipakai.
let latestAvailabilityRequest = 0;

async function refreshAvailability() {
    const requestId = ++latestAvailabilityRequest;
    const serviceId = servicePicker.value;
    const date = datePicker.value;

    if (!serviceId || !date) {
        timePicker.showMessage(CHOOSE_FIRST_MESSAGE);
        return;
    }

    timePicker.showMessage('Memuat jam...');
    try {
        const response = await authFetch(`/bookings/availability?date=${date}&service_id=${serviceId}`);
        if (requestId !== latestAvailabilityRequest) return;
        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }
        const { slots } = await response.json();
        timePicker.setSlots(slots);
    } catch (error) {
        if (requestId !== latestAvailabilityRequest) return;
        console.error('Gagal load jam:', error);
        timePicker.showMessage('Gagal memuat jam. Coba pilih tanggal lagi.');
    }
}

async function loadServices(){
    try {
        const services = await loadServiceList();
        servicePicker.setServices(services);
    } catch (error){
        console.error('Gagal load layanan:', error)
        showToast('Gagal memuat daftar layanan. Coba muat ulang halaman.', 'error');
    }
}

document.getElementById('customerGreeting').textContent = `Halo, ${localStorage.getItem('customerName') || 'Pelanggan'}`;

const form = document.getElementById('bookingForm')

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const missing = requiredPickers.find(({ picker }) => !picker.value);
    if (missing) {
        missing.picker.markInvalid();
        showToast(missing.message, 'error');
        return;
    }

    const data = Object.fromEntries(new FormData(form));

    try {
        const response = await authFetch('/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showToast('Booking berhasil', 'success');
            requiredPickers.forEach(({ picker }) => picker.clear());
            refreshAvailability();
        } else if (response.status !== 401) {
            const result = await response.json().catch(() => ({}));
            showToast(result.error || 'Booking gagal. Coba lagi.', 'error');
            refreshAvailability();
        }
    } catch(error) {
        console.error('Error', error);
        showToast('Terjadi kesalahan koneksi.', 'error');
    }
});

loadServices();

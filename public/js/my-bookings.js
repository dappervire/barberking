const STATUS_LABELS = {
    pending: 'Menunggu konfirmasi',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
};

function formatBookingDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

function createStatusBadge(booking) {
    const badge = document.createElement('span');
    // Booking yang lewat tanpa pernah dikonfirmasi udah nggak nunggu apa-apa lagi.
    if (booking.status === 'pending' && booking.is_past) {
        badge.className = 'status status-past';
        badge.textContent = 'Sudah lewat';
    } else {
        badge.className = `status status-${booking.status}`;
        badge.textContent = STATUS_LABELS[booking.status] || booking.status;
    }
    return badge;
}

function createButton(className, label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

async function cancelBooking(id) {
    try {
        const response = await authFetch(`/bookings/${id}/cancel`, { method: 'POST' });
        if (response.status === 401) return;
        if (response.ok) {
            showToast('Booking dibatalkan', 'success');
        } else {
            const result = await response.json().catch(() => ({}));
            showToast(result.error || 'Gagal membatalkan booking.', 'error');
        }
        loadMyBookings();
    } catch (error) {
        console.error('Gagal membatalkan booking:', error);
        showToast('Terjadi kesalahan koneksi.', 'error');
    }
}

function renderCancelControls(container, booking) {
    container.innerHTML = '';
    container.appendChild(createButton('btn-reject', 'Batalkan', () => {
        container.innerHTML = '';

        const question = document.createElement('p');
        question.textContent = 'Yakin mau batalin booking ini?';
        container.appendChild(question);

        const confirm = createButton('btn-reject btn-confirm-cancel', 'Ya, batalkan', () => {
            confirm.disabled = true;
            keep.disabled = true;
            cancelBooking(booking.id);
        });
        const keep = createButton('btn-approve btn-keep-booking', 'Nggak jadi', () => {
            renderCancelControls(container, booking);
        });
        container.append(keep, confirm);
    }));
}

function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';

    const name = document.createElement('h3');
    name.textContent = booking.service_name;
    card.appendChild(name);

    const details = [
        `Tanggal: ${formatBookingDate(booking.booking_date)}`,
        `Jam: ${booking.booking_time.slice(0, 5)} (${booking.duration_minutes} menit)`,
        `Harga: ${formatRupiah(booking.service_price)}`,
    ];
    details.forEach((text) => {
        const line = document.createElement('p');
        line.textContent = text;
        card.appendChild(line);
    });

    const statusLine = document.createElement('p');
    statusLine.append('Status: ', createStatusBadge(booking));
    card.appendChild(statusLine);

    if (booking.can_cancel) {
        const controls = document.createElement('div');
        controls.className = 'cancel-controls';
        renderCancelControls(controls, booking);
        card.appendChild(controls);
    }

    return card;
}

function renderBookings(bookings) {
    const container = document.getElementById('bookingList');
    container.innerHTML = '';

    if (bookings.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Kamu belum punya booking.';
        container.appendChild(empty);
        return;
    }

    bookings.forEach((booking) => container.appendChild(createBookingCard(booking)));
}

async function loadMyBookings() {
    try {
        const response = await authFetch('/bookings/mine');
        if (response.status === 401) return;
        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }
        renderBookings(await response.json());
    } catch (error) {
        console.error('Gagal load booking:', error);
        showToast('Gagal memuat booking kamu. Coba muat ulang halaman.', 'error');
    }
}

loadMyBookings();

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/admin-login.html';
}

const PAGE_SIZE = 20;
let currentPage = 1;

async function loadBookings(){
    try {
        const response = await fetch(`/bookings?page=${currentPage}&limit=${PAGE_SIZE}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status === 401){
            showToast('Sesi habis. Silahkan login ulang.', 'error');
            localStorage.removeItem('token');
            window.location.href = '/admin-login.html';
            return;
        }
        if (!response.ok){
            showToast('Gagal load data.', 'error');
            return;
        }
        const bookings = await response.json();
        renderBookings(bookings);
        renderPagination(Number(response.headers.get('X-Total-Count')));
    } catch (error) {
        console.error('Error', error);
        showToast('Gagal load data.', 'error')
    }
}

function renderPagination(total) {
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    document.getElementById('pagination').hidden = totalPages === 1;
    document.getElementById('pageInfo').textContent = `Halaman ${currentPage} dari ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
}

function changePage(delta) {
    currentPage += delta;
    loadBookings();
    window.scrollTo(0, 0);
}

function renderBookings(bookings) {
    const container = document.getElementById('bookingList');
    container.innerHTML = '';
    if (bookings.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Belum ada booking.';
        container.appendChild(empty);
        return;
    }
    bookings.forEach(booking => {
        container.appendChild(createBookingCard(booking));
    });
}

// Data booking berasal dari form publik, jadi harus lewat textContent, jangan innerHTML.
function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';

    const name = document.createElement('h3');
    name.className = 'customer-name';
    name.textContent = booking.customer_name;
    card.appendChild(name);

    const details = [
        `HP: ${booking.customer_phone}`,
        `Layanan: ${booking.service_name} - ${formatRupiah(booking.service_price)}`,
        `Tanggal: ${booking.booking_date.split('T')[0]}`,
        `Jam: ${booking.booking_time.slice(0, 5)}`,
    ];
    details.forEach(text => {
        const line = document.createElement('p');
        line.textContent = text;
        card.appendChild(line);
    });

    const statusLine = document.createElement('p');
    const statusBadge = document.createElement('span');
    statusBadge.className = `status status-${booking.status}`;
    statusBadge.textContent = booking.status;
    statusLine.append('Status: ', statusBadge);
    card.appendChild(statusLine);

    if (booking.status === 'pending') {
        card.appendChild(createActionButton('btn-approve', 'Approve', booking.id, 'approved'));
        card.appendChild(createActionButton('btn-reject', 'Reject', booking.id, 'rejected'));
    }

    return card;
}

function createActionButton(className, label, id, status) {
    const button = document.createElement('button');
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', () => updateStatus(id, status));
    return button;
}

async function updateStatus(id, status) {
    try {
        const response = await fetch(`/bookings/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            showToast(`Booking ${status}`, 'success');
            loadBookings();
        } else {
            const result = await response.json().catch(() => ({}));
            showToast(result.error || 'Gagal update status.', 'error');
            loadBookings();
        }
    } catch (error){
        console.error('Error', error);
        showToast('Terjadi kesalahan koneksi', 'error');
    }
}

document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));

document.getElementById('logoutBtn').addEventListener('click', ()=> {
    localStorage.removeItem('token');
    window.location.href = '/admin-login.html';
});

loadBookings();
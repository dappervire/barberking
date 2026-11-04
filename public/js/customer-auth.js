const BOOKING_PAGE = '/booking.html';

if (localStorage.getItem('customerToken')) {
    window.location.replace(BOOKING_PAGE);
}

async function submitCustomerAuth(url, body) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) {
            localStorage.setItem('customerToken', result.token);
            localStorage.setItem('customerName', result.name);
            window.location.href = BOOKING_PAGE;
        } else {
            showToast(result.error || 'Terjadi kesalahan. Coba lagi.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Terjadi kesalahan koneksi.', 'error');
    }
}

const customerLoginForm = document.getElementById('customerLoginForm');
if (customerLoginForm) {
    customerLoginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        submitCustomerAuth('/auth/customer/login', Object.fromEntries(new FormData(customerLoginForm)));
    });
}

const customerRegisterForm = document.getElementById('customerRegisterForm');
if (customerRegisterForm) {
    customerRegisterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const { name, phone, password, password_confirm } = Object.fromEntries(new FormData(customerRegisterForm));
        if (password !== password_confirm) {
            showToast('Password dan ulangi password nggak sama.', 'error');
            return;
        }
        submitCustomerAuth('/auth/customer/register', { name, phone, password });
    });
}

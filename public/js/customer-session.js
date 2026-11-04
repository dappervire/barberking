const customerToken = localStorage.getItem('customerToken');
if (!customerToken) {
    window.location.replace('/customer-login.html');
}

function endCustomerSession() {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerName');
}

async function authFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${customerToken}` },
    });
    if (response.status === 401) {
        endCustomerSession();
        window.location.href = '/customer-login.html';
    }
    return response;
}

document.getElementById('customerLogout').addEventListener('click', () => {
    endCustomerSession();
    window.location.href = '/';
});

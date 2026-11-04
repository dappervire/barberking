document.querySelectorAll('.login-form input[type="password"]').forEach((input) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    wrapper.appendChild(toggle);

    function setVisible(visible) {
        input.type = visible ? 'text' : 'password';
        toggle.textContent = visible ? 'Sembunyikan' : 'Lihat';
        toggle.setAttribute('aria-pressed', String(visible));
    }

    toggle.addEventListener('click', () => setVisible(input.type === 'password'));
    // Dibalikin pas form dikirim, biar password nggak kesimpan di riwayat isian browser.
    input.form.addEventListener('submit', () => setVisible(false));

    setVisible(false);
});

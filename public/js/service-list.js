async function loadServiceList() {
    const response = await fetch('/services');
    if (!response.ok) {
        throw new Error(`Status ${response.status}`);
    }
    const services = await response.json();
    const list = document.getElementById('serviceList');

    services.forEach(service => {
        const item = document.createElement('li');

        const name = document.createElement('span');
        name.textContent = `${service.name} (${service.duration_minutes} menit)`;

        const price = document.createElement('span');
        price.className = 'service-price';
        price.textContent = formatRupiah(service.price);

        item.append(name, price);
        list.appendChild(item);
    });

    document.getElementById('serviceSection').hidden = services.length === 0;
    return services;
}

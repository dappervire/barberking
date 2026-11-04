// Popup bawaan browser (select, date, time) nggak bisa di-styling, jadi dibikin sendiri.
// Nilainya tetap disimpan di input hidden, jadi form dikirim dengan format yang sama.

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

let activePicker = null;

function pad(number) {
  return String(number).padStart(2, '0');
}

function toDateValue(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayValue() {
  const now = new Date();
  return toDateValue(now.getFullYear(), now.getMonth(), now.getDate());
}

function createOptionButton(className, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

function createPicker(rootId, { placeholder, render }) {
  const root = document.getElementById(rootId);
  const input = root.querySelector('input[type="hidden"]');
  const trigger = root.querySelector('.picker-trigger');
  const valueLabel = root.querySelector('.picker-value');
  const panel = root.querySelector('.picker-panel');

  const picker = {
    get value() {
      return input.value;
    },
    setValue(value, label) {
      input.value = value;
      valueLabel.textContent = label;
      valueLabel.classList.toggle('is-placeholder', !value);
      root.classList.remove('picker-invalid');
    },
    clear() {
      picker.setValue('', placeholder);
    },
    markInvalid() {
      root.classList.add('picker-invalid');
      trigger.focus();
    },
    refresh() {
      render(panel, picker);
    },
    open() {
      if (activePicker) activePicker.close();
      render(panel, picker);
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      activePicker = picker;

      // Kalau ruang di bawah nggak cukup, popup dibuka ke atas.
      panel.classList.remove('picker-panel-up');
      const triggerBox = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerBox.bottom;
      if (panel.offsetHeight > spaceBelow && triggerBox.top > spaceBelow) {
        panel.classList.add('picker-panel-up');
      }

      const target = panel.querySelector('.is-selected') || panel.querySelector('[data-focus-first]:not(:disabled)');
      if (target) target.focus();
    },
    close({ returnFocus = false } = {}) {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (activePicker === picker) activePicker = null;
      if (returnFocus) trigger.focus();
    },
  };

  trigger.addEventListener('click', () => {
    if (panel.hidden) picker.open();
    else picker.close();
  });

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      picker.close({ returnFocus: true });
      return;
    }
    moveFocusWithArrows(event, panel);
  });

  picker.clear();
  return picker;
}

function moveFocusWithArrows(event, panel) {
  const grid = event.target.closest('[data-columns]');
  if (!grid) return;

  const columns = Number(grid.dataset.columns);
  const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();

  const buttons = [...grid.querySelectorAll('button')];
  let index = buttons.indexOf(event.target) + step;
  while (buttons[index] && buttons[index].disabled) index += step;
  if (buttons[index]) buttons[index].focus();
}

// Klik di luar picker yang lagi kebuka bakal nutup popup-nya.
document.addEventListener('click', (event) => {
  if (!activePicker) return;
  const insidePicker = event.composedPath().some((element) => element.classList && element.classList.contains('picker'));
  if (!insidePicker) activePicker.close();
});

function createServicePicker(rootId, onChange) {
  let services = [];

  const picker = createPicker(rootId, {
    placeholder: 'Pilih layanan',
    render(panel, self) {
      panel.innerHTML = '';
      if (services.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'picker-note';
        empty.textContent = 'Layanan belum tersedia.';
        panel.appendChild(empty);
        return;
      }

      const list = document.createElement('div');
      list.className = 'picker-service-list';
      list.dataset.columns = '1';

      services.forEach((service, index) => {
        const button = createOptionButton('picker-service', '');
        if (index === 0) button.dataset.focusFirst = '';
        if (String(service.id) === self.value) button.classList.add('is-selected');

        const name = document.createElement('span');
        name.textContent = service.name;

        const meta = document.createElement('span');
        meta.className = 'picker-service-meta';
        meta.textContent = `${service.duration_minutes} menit · ${formatRupiah(service.price)}`;

        button.append(name, meta);
        button.addEventListener('click', () => {
          self.setValue(String(service.id), `${service.name} - ${formatRupiah(service.price)}`);
          self.close({ returnFocus: true });
          onChange();
        });
        list.appendChild(button);
      });
      panel.appendChild(list);
    },
  });

  picker.setServices = (loaded) => {
    services = loaded;
  };
  return picker;
}

function createDatePicker(rootId, onChange) {
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  function changeMonth(self, delta, panel) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    viewYear = next.getFullYear();
    viewMonth = next.getMonth();
    self.refresh();
    // Header digambar ulang, jadi fokus keyboard dibalikin ke tombol yang sama.
    panel.querySelector(`[data-nav="${delta}"]`).focus();
  }

  return createPicker(rootId, {
    placeholder: 'Pilih tanggal',
    render(panel, self) {
      panel.innerHTML = '';
      const today = new Date();
      const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

      const header = document.createElement('div');
      header.className = 'calendar-header';

      const previous = createOptionButton('calendar-nav', '‹');
      previous.dataset.nav = '-1';
      previous.setAttribute('aria-label', 'Bulan sebelumnya');
      previous.disabled = isCurrentMonth;
      previous.addEventListener('click', () => changeMonth(self, -1, panel));

      const title = document.createElement('span');
      title.className = 'calendar-title';
      title.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

      const next = createOptionButton('calendar-nav', '›');
      next.dataset.nav = '1';
      next.setAttribute('aria-label', 'Bulan berikutnya');
      next.addEventListener('click', () => changeMonth(self, 1, panel));

      header.append(previous, title, next);
      panel.appendChild(header);

      const weekdays = document.createElement('div');
      weekdays.className = 'calendar-weekdays';
      WEEKDAY_LABELS.forEach((label) => {
        const cell = document.createElement('span');
        cell.textContent = label;
        weekdays.appendChild(cell);
      });
      panel.appendChild(weekdays);

      const days = document.createElement('div');
      days.className = 'calendar-days';
      days.dataset.columns = '7';

      const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
      for (let i = 0; i < firstWeekday; i++) {
        days.appendChild(document.createElement('span'));
      }

      const todayDate = todayValue();
      const dayCount = new Date(viewYear, viewMonth + 1, 0).getDate();
      for (let day = 1; day <= dayCount; day++) {
        const value = toDateValue(viewYear, viewMonth, day);
        const button = createOptionButton('calendar-day', String(day));
        button.disabled = value < todayDate;
        if (value === todayDate) button.classList.add('is-today');
        if (value === self.value) button.classList.add('is-selected');
        if (!button.disabled) button.dataset.focusFirst = '';

        button.addEventListener('click', () => {
          const label = new Date(viewYear, viewMonth, day).toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          });
          self.setValue(value, label);
          self.close({ returnFocus: true });
          onChange();
        });
        days.appendChild(button);
      }
      panel.appendChild(days);
    },
  });
}

// Daftar jam dan statusnya datang dari server, jadi jam buka dan kapasitas cuma diatur di satu tempat.
function createTimePicker(rootId, initialMessage) {
  let slots = null;
  let message = initialMessage;

  const picker = createPicker(rootId, {
    placeholder: 'Pilih jam',
    render(panel, self) {
      panel.innerHTML = '';

      const hasOpenSlot = slots && slots.some((slot) => slot.available);
      if (!hasOpenSlot) {
        const note = document.createElement('p');
        note.className = 'picker-note';
        note.textContent = slots ? 'Jadwal di tanggal ini sudah penuh, pilih tanggal lain.' : message;
        panel.appendChild(note);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'time-slots';
      grid.dataset.columns = '4';

      slots.forEach((slot) => {
        const button = createOptionButton('time-slot', slot.time);
        button.disabled = !slot.available;
        if (slot.time === self.value) button.classList.add('is-selected');
        if (slot.available) button.dataset.focusFirst = '';
        button.addEventListener('click', () => {
          self.setValue(slot.time, slot.time);
          self.close({ returnFocus: true });
        });
        grid.appendChild(button);
      });
      panel.appendChild(grid);
    },
  });

  picker.showMessage = (nextMessage) => {
    slots = null;
    message = nextMessage;
    picker.refresh();
  };

  // Jam yang udah dipilih bisa jadi penuh setelah layanan atau tanggalnya diganti.
  picker.setSlots = (nextSlots) => {
    slots = nextSlots;
    const stillAvailable = nextSlots.some((slot) => slot.time === picker.value && slot.available);
    if (picker.value && !stillAvailable) picker.clear();
    picker.refresh();
  };

  return picker;
}

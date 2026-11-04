function formatRupiah(price) {
  return `Rp${Number(price).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

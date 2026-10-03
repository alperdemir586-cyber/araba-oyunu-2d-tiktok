// Görsel yükleme ve önbellek. Klasördeki dosyalar sunucunun /api/assets listesinden gelir.
export class Assets {
  constructor() {
    this.cache = new Map();
    this.list = { cars: [], backgrounds: [], ground: [], gifts: [], sounds: [] };
  }

  async refresh() {
    try {
      this.list = await fetch('/api/assets').then((r) => r.json());
    } catch {
      /* sunucu yoksa boş liste */
    }
    return this.list;
  }

  image(url) {
    if (!url) return null;
    let img = this.cache.get(url);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = url;
      this.cache.set(url, img);
    }
    return img;
  }

  // Araç klasöründeki dosya adı -> görsel
  carImage(file) {
    if (!file) return null;
    const entry = this.list.cars.find((c) => c.file === file);
    return entry ? this.image(entry.url) : null;
  }

  avatar(url) {
    return this.image(url);
  }
}

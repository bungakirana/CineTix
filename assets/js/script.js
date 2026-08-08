// ===== CINETIX APP LOGIC =====

const App = {
  currentPage: 'splash',
  selectedDate: 3,
  selectedTime: '14:00',
  selectedSeats: [],
  ticketPrice: 50000, // updated dynamically when user picks a time slot
  serviceFee: 4000,
  currentMovie: 'cinlock',
  currentGenre: 'semua',
  searchQuery: '',

  // GANTI ini dengan URL Web App dari Google Apps Script kamu
  // (yang diakhiri /exec, hasil copy dari tombol "Salin" di kotak Deployment)
  SPREADSHEET_URL: 'https://script.google.com/macros/s/AKfycbx5V2-BiozJClwXJP11RDSRKKv6x1F_9W6fEpKLm9MXA3J9EolDm7cIfB_05MzMguP3nA/exec',

  // Stack of previous pages, used by the topnav "back" button
  pageHistory: [],

  selectedCinemaName: '',
  selectedCinemaAddr: '',

  // Fallback poster shown whenever a real poster file fails to load
  // (missing file, wrong filename/extension, etc.) so the user sees a
  // clean placeholder instead of a broken-image icon.
  PLACEHOLDER_POSTER: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450'><rect width='100%25' height='100%25' fill='%2323232D'/><text x='50%25' y='50%25' font-size='60' fill='%238A8A97' text-anchor='middle' dy='.35em'>%F0%9F%8E%AC</text></svg>",

  // User session
  user: {
    name: 'Pengguna',
    email: '',
    provider: 'guest', // 'guest' | 'facebook' | 'email'
  },

  // Booked tickets storage
  bookedTickets: [],
  _lastTicket: null,
  _activeTicketIndex: null,

  movieTitles: {
    cinlock:    'CinLock – Love, Camera, Action!',
    pertaruhan: 'Pertaruhan – The Series',
    horor:      'Rumah Kita',
    komedi:     'Pak RT Naik Jabatan',
    scifi:      'Nebula: Titik Balik',
    thriller:   'Jejak Terakhir',
    drama:      'Pulang ke Rumah',
    animasi:    'Kancil dan Rimba Ajaib',
  },
  // FIX #1 (poster tidak muncul): nama file di sini sebelumnya tidak sama
  // dengan file poster asli yang dipakai di index.html (movie-card &
  // detail-poster), sehingga hanya CinLock & Pertaruhan yang kebetulan
  // cocok, 6 film lainnya 404. Disamakan persis dengan <img> di index.html.
  moviePosters: {
    cinlock:    'assets/img/cinlock1.jpeg',
    pertaruhan: 'assets/img/pertaruhan1.jpeg',
    horor:      'assets/img/rumah1.jpeg',
    komedi:     'assets/img/pakrt1.jpeg',
    scifi:      'assets/img/nebula1.jpeg',
    thriller:   'assets/img/jejak1.jpeg',
    drama:      'assets/img/pulang1.jpeg',
    animasi:    'assets/img/kancil1.jpeg',
  },
  movieIcons: { cinlock: '🎬', pertaruhan: '💥', horor: '👻', komedi: '🤣', scifi: '🚀', thriller: '🔎', drama: '🎭', animasi: '🐾' },

  // Map internal movie id -> detail page id
  movieDetailPageMap: {
    cinlock:    'movie-detail',
    pertaruhan: 'movie-detail-pertaruhan',
    horor:      'movie-detail-horor',
    komedi:     'movie-detail-komedi',
    scifi:      'movie-detail-scifi',
    thriller:   'movie-detail-thriller',
    drama:      'movie-detail-drama',
    animasi:    'movie-detail-animasi',
  },

  pages: [
    'splash','login','home',
    'movie-detail','movie-detail-pertaruhan','movie-detail-horor','movie-detail-komedi',
    'movie-detail-scifi','movie-detail-thriller','movie-detail-drama','movie-detail-animasi',
    'seat-select','order-summary','payment','success',
    'page-tiket','ticket-detail','page-akun'
  ],

  // Pages where the top navbar should be hidden
  navHiddenPages: ['splash', 'login'],

  // Pages that shouldn't be tracked in the back-button history stack
  // (payment/success are transactional flows we don't want to "go back" into)
  historyExcludedPages: ['splash', 'login', 'payment', 'success'],

  // Called via onerror="App.handleImgError(this)" on every poster <img>.
  // Swaps a broken/missing poster file for a neutral placeholder instead
  // of leaving the browser's broken-image icon on screen.
  handleImgError(img) {
    img.onerror = null; // prevent infinite loop if placeholder also fails
    img.src = this.PLACEHOLDER_POSTER;
  },

  navigate(pageId, opts = {}) {
    const { skipHistory } = opts;

    // Push the page we're leaving onto the history stack so the topnav
    // back button can return to it later.
    if (!skipHistory &&
        this.currentPage &&
        this.currentPage !== pageId &&
        !this.historyExcludedPages.includes(this.currentPage)) {
      this.pageHistory.push(this.currentPage);
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) {
      target.classList.add('active');
      this.currentPage = pageId;
      window.scrollTo(0, 0);
    }
    this.syncTopnav(pageId);

    // Whenever we land on a movie detail page, re-check which time slots
    // are already in the past relative to the current system clock.
    if (this.movieDetailPageMap && Object.values(this.movieDetailPageMap).includes(pageId)) {
      this.updatePastTimeSlots();
    }
  },

  // Go to the previous page tracked in the history stack (used by the
  // back arrow next to the CINETIX logo in the topnav).
  goBack() {
    if (this.pageHistory.length === 0) {
      this.navigate('home');
      return;
    }
    const prevPage = this.pageHistory.pop();
    this.navigate(prevPage, { skipHistory: true });
  },

  syncTopnav(pageId) {
    // Highlight matching nav item
    document.querySelectorAll('.topnav .nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId ||
        (item.dataset.page === 'home' && pageId === 'home'));
    });
  },

  init() {
    // Splash → Login after 2.2s
    setTimeout(() => this.navigate('login'), 2200);

    // Login form (email/password)
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('emailInput').value;
      const name = email.split('@')[0] || 'Pengguna';
      this.user = { name, email, provider: 'email' };
      this.enterApp();
    });

    // Social login buttons (Facebook only — buka modal custom untuk
    // menanyakan nama akun, menggantikan window.prompt() bawaan browser)
    document.querySelectorAll('.social-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.dataset.provider || 'facebook';
        if (provider === 'facebook') {
          this.openFacebookModal();
        }
      });
    });

    this.initFacebookModal();

    // Topnav back button (next to the CINETIX logo)
    const topnavBackBtn = document.getElementById('topnavBack');
    if (topnavBackBtn) {
      topnavBackBtn.addEventListener('click', () => this.goBack());
    }

    // ===== Genre filter chips (Home page) =====
    const homeFilterChips = document.querySelectorAll('#home .filter-chip');
    homeFilterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        homeFilterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentGenre = chip.dataset.genre || 'semua';
        this.applyMovieFilters();
      });
    });

    // Movie cards / hero CTA → correct detail page
    document.querySelectorAll('[data-nav="detail"]').forEach(card => {
      card.addEventListener('click', () => {
        const movie = card.dataset.movie;
        this.selectedTime = '';
        this.selectedCinemaName = '';
        this.selectedCinemaAddr = '';
        // FIX (tanggal tidak sesuai): sebelumnya this.selectedDate TIDAK
        // direset saat pindah ke film lain. Kalau user sebelumnya sempat
        // memilih tanggal lain (mis. 28 Agustus) di film A, lalu pindah ke
        // film B tanpa mengklik date-chip di film B, this.selectedDate
        // masih membawa nilai lama dari film A — padahal secara visual
        // date-chip default film B ("Rabu", data-date="3") yang aktif.
        // Akibatnya tanggal di Ringkasan Pemesanan / tiket bisa tidak
        // sesuai dengan yang terlihat dipilih user. Reset ke default (3)
        // di sini supaya selalu sinkron dengan date-chip aktif bawaan.
        this.selectedDate = 3;
        this.goToMovieDetail(movie);
      });
    });

    // Tab handler scoped per page
    document.querySelectorAll('.page').forEach(page => {
      page.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          page.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          page.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          const tabId = 'tab-' + btn.dataset.tab;
          const tabContent = page.querySelector('#' + tabId);
          if (tabContent) tabContent.classList.add('active');

          // Re-evaluate which time slots are already past whenever the
          // JADWAL tab becomes visible.
          if (btn.dataset.tab && btn.dataset.tab.startsWith('jadwal')) {
            this.updatePastTimeSlots();
          }
        });
      });
    });

    // Date chips
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.closest('.date-scroll').querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedDate = parseInt(chip.dataset.date);
      });
    });

    // Time slots — track which cinema block was clicked
    document.querySelectorAll('.time-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        // Jadwal yang sudah lewat tidak bisa dipilih (jaga-jaga jika
        // pointer-events CSS gagal ter-load, dsb.)
        if (slot.classList.contains('past-disabled')) return;

        const currentPageEl = document.getElementById(this.currentPage) ||
                              document.querySelector('.page.active');
        if (currentPageEl) {
          currentPageEl.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
        }
        slot.classList.add('selected');
        this.selectedTime = slot.textContent.trim();

        const cinemaBlock = slot.closest('.cinema-block');
        const showType = slot.closest('.show-type');
        if (cinemaBlock) {
          const nameEl = cinemaBlock.querySelector('.cinema-name');
          const addrEl = cinemaBlock.querySelector('.cinema-addr');
          this.selectedCinemaName = nameEl ? nameEl.textContent.trim() : '';
          this.selectedCinemaAddr = addrEl ? addrEl.textContent.trim() : '';
        }
        if (showType) {
          const priceEl = showType.querySelector('.show-type-price');
          if (priceEl) {
            const raw = priceEl.textContent.replace(/[^0-9]/g, '');
            this.ticketPrice = parseInt(raw) || 50000;
          }
        }

        // Langsung tampilkan tombol BELI TIKET tanpa perlu scroll manual.
        if (currentPageEl) {
          const btnBeli = currentPageEl.querySelector('.btn-beli');
          if (btnBeli) {
            btnBeli.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });

    // Beli Tiket button → seat select (or, kalau jadwal belum dipilih,
    // otomatis pindah ke tab JADWAL film yang bersangkutan)
    document.querySelectorAll('.btn-beli').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.movie) this.currentMovie = btn.dataset.movie;
        if (!this.selectedTime || !this.selectedCinemaName) {
          const page = btn.closest('.page');
          if (page) {
            const jadwalTabBtn = page.querySelector('.tab-btn[data-tab^="jadwal"]');
            if (jadwalTabBtn) {
              jadwalTabBtn.click();
              jadwalTabBtn.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
          return;
        }
        this.selectedSeats = [];
        this.renderSeatGrid();
        this.navigate('seat-select');
      });
    });

    // Seat back button — go back to correct movie detail
    document.querySelector('#seat-select .back-btn[data-back]').addEventListener('click', () => {
      this.navigate(this.movieDetailPageMap[this.currentMovie] || 'movie-detail');
    });

    // Seat selection → order summary
    document.getElementById('confirmSeats').addEventListener('click', () => {
      if (this.selectedSeats.length === 0) { alert('Pilih kursi terlebih dahulu!'); return; }
      this.renderOrderSummary();
      this.navigate('order-summary');
    });

    // Pay now → payment QR
    document.getElementById('bayarBtn').addEventListener('click', () => {
      this.navigate('payment');
      this.startPaymentTimer();
    });

    // Download PDF ticket (from success page)
    document.getElementById('downloadPdfBtn').addEventListener('click', () => this.downloadTicketPdf(this._lastTicket));

    // Download PDF ticket (from ticket detail / riwayat page)
    document.getElementById('tdDownloadPdfBtn').addEventListener('click', () => {
      this.downloadTicketPdf(this.bookedTickets[this._activeTicketIndex]);
    });

    // Generic back buttons (exclude seat-select's which is handled above)
    document.querySelectorAll('[data-back]').forEach(btn => {
      if (btn.closest('#seat-select')) return;
      btn.addEventListener('click', () => this.navigate(btn.dataset.back));
    });

    // ===== TOP NAV items =====
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page === 'home') {
          this.navigate('home');
        } else if (page === 'tiket') {
          this.renderTiketPage();
          this.navigate('page-tiket');
        } else if (page === 'akun') {
          this.renderAkunPage();
          this.navigate('page-akun');
        }
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Yakin mau keluar?')) {
        this.user = { name: 'Pengguna', email: '', provider: 'guest' };
        this.bookedTickets = [];
        this.pageHistory = [];
        document.querySelector('.app-shell').classList.remove('logged-in');
        this.navigate('login');
      }
    });

    // Akun menu items
    document.querySelectorAll('.akun-menu-item[data-menu]').forEach(item => {
      item.addEventListener('click', () => {
        const menu = item.dataset.menu;
        if (menu === 'tiket') { this.renderTiketPage(); this.navigate('page-tiket'); }
        else { alert(`${item.querySelector('.akun-menu-text').textContent} — segera hadir!`); }
      });
    });

    // ===== Search bar (Cari film / bioskop) =====
    // Filters the home movie grid live as the user types, and also
    // jumps to the Beranda page (in case the user is elsewhere) when
    // they start searching or press Enter.
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        if (this.currentPage !== 'home') this.navigate('home');
        this.applyMovieFilters();
      });
      searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.searchQuery = searchInput.value;
          if (this.currentPage !== 'home') this.navigate('home');
          this.applyMovieFilters();
        }
      });
    }

    // Cek jadwal yang sudah lewat waktu saat aplikasi pertama kali dimuat,
    // lalu perbarui setiap menit supaya selalu akurat mengikuti jam laptop.
    this.updatePastTimeSlots();
    setInterval(() => this.updatePastTimeSlots(), 60 * 1000);
  },

  // ===== MODAL LOGIN FACEBOOK =====
  // Menggantikan window.prompt() bawaan browser (yang muncul sebagai kotak
  // dialog polos bertuliskan "localhost says") dengan modal custom
  // bertema CineTix: ikon Facebook, judul, input nama akun, dan tombol
  // Batal / Lanjutkan. Modal disembunyikan/tampilkan lewat class "active"
  // supaya ada transisi fade + scale yang halus (lihat style.css).
  initFacebookModal() {
    const overlay = document.getElementById('fbLoginOverlay');
    const input = document.getElementById('fbNameInput');
    const closeBtn = document.getElementById('fbModalClose');
    const cancelBtn = document.getElementById('fbModalCancel');
    const confirmBtn = document.getElementById('fbModalConfirm');
    if (!overlay || !input || !confirmBtn) return;

    const confirm = () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        input.style.borderColor = 'var(--red)';
        return;
      }
      this.user = { name, email: '', provider: 'facebook' };
      this.closeFacebookModal();
      this.enterApp();
    };

    confirmBtn.addEventListener('click', confirm);
    closeBtn.addEventListener('click', () => this.closeFacebookModal());
    cancelBtn.addEventListener('click', () => this.closeFacebookModal());

    // Klik area gelap di luar kotak modal juga menutup modal
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.closeFacebookModal();
    });

    // Enter di input langsung lanjut, Esc menutup modal
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirm(); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        this.closeFacebookModal();
      }
    });

    // Reset warna border saat user mulai mengetik lagi
    input.addEventListener('input', () => { input.style.borderColor = ''; });
  },

  openFacebookModal() {
    const overlay = document.getElementById('fbLoginOverlay');
    const input = document.getElementById('fbNameInput');
    if (!overlay) return;
    if (input) { input.value = ''; input.style.borderColor = ''; }
    overlay.classList.add('active');
    setTimeout(() => input && input.focus(), 150);
  },

  closeFacebookModal() {
    const overlay = document.getElementById('fbLoginOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  goToMovieDetail(movie) {
    this.currentMovie = movie in this.movieDetailPageMap ? movie : 'cinlock';
    this.navigate(this.movieDetailPageMap[this.currentMovie] || 'movie-detail');
  },

  // Menandai (memblokir) jam tayang yang sudah terlewat dibandingkan jam
  // pada perangkat pengguna saat ini — sama seperti kursi yang sudah
  // dipesan: tidak bisa diklik dan tampilannya pudar/abu-abu.
  updatePastTimeSlots() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    document.querySelectorAll('.time-slot').forEach(slot => {
      const raw = slot.textContent.trim(); // format "HH:MM"
      const parts = raw.split(':');
      if (parts.length !== 2) return;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return;
      const slotMinutes = h * 60 + m;

      if (slotMinutes < nowMinutes) {
        slot.classList.add('past-disabled');
        slot.classList.remove('selected');
        if (this.selectedTime === raw) this.selectedTime = '';
      } else {
        slot.classList.remove('past-disabled');
      }
    });
  },

  // Filters the home movie grid by both the selected genre chip and the
  // search box text (movie title, genre text, or cinema name all match).
  applyMovieFilters() {
    const cards = document.querySelectorAll('#home .movie-card');
    const q = (this.searchQuery || '').trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const genre = card.dataset.genre;
      const matchesGenre = this.currentGenre === 'semua' || genre === this.currentGenre;

      const titleText = (card.querySelector('.movie-title-card')?.textContent || '').toLowerCase();
      const genreText = (card.querySelector('.movie-genre-card')?.textContent || '').toLowerCase();
      const matchesQuery = q === '' || titleText.includes(q) || genreText.includes(q);

      const show = matchesGenre && matchesQuery;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    const noResultsEl = document.getElementById('noResults');
    if (noResultsEl) {
      noResultsEl.style.display = visibleCount === 0 ? 'flex' : 'none';
    }
  },

  enterApp() {
    document.querySelector('.app-shell').classList.add('logged-in');
    this.renderAkunPage();
    this.pageHistory = [];
    this.navigate('home');
  },

  // ===== TIKET PAGE =====
  renderTiketPage() {
    const el = document.getElementById('tiketContent');
    if (this.bookedTickets.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎫</div>
          <div class="empty-title">Belum Ada Tiket</div>
          <div class="empty-sub">Kamu belum memesan tiket.<br>Yuk tonton film favoritmu sekarang!</div>
        </div>`;
    } else {
      el.innerHTML = `<div class="ticket-list">${
        this.bookedTickets.map((t, idx) => `
          <div class="ticket-item" data-idx="${idx}">
            <div class="ticket-item-top">
              <img src="${this.moviePosters[t.movie] || ''}" class="ticket-item-poster-img" alt="${this.movieTitles[t.movie] || t.movie}" onerror="App.handleImgError(this)">
              <div class="ticket-item-info">
                <div class="ticket-item-title">${this.movieTitles[t.movie] || t.movie}</div>
                <div class="ticket-item-cinema">${t.cinema || 'Bioskop CineTix'}</div>
                <div class="ticket-item-time">${t.date}, ${t.time}</div>
              </div>
            </div>
            <div class="ticket-item-bottom">
              <div class="ticket-item-seats">Kursi: <span>${t.seats}</span></div>
              <div class="ticket-badge">✓ AKTIF</div>
            </div>
          </div>`).join('')
      }</div>`;

      el.querySelectorAll('.ticket-item').forEach(item => {
        item.addEventListener('click', () => this.showTicketDetail(parseInt(item.dataset.idx, 10)));
      });
    }
  },

  // ===== TICKET DETAIL (riwayat + barcode) =====
  showTicketDetail(idx) {
    const t = this.bookedTickets[idx];
    if (!t) return;
    this._activeTicketIndex = idx;

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('tdBooker', this.user.name);
    setText('tdMovie', this.movieTitles[t.movie] || t.movie);
    setText('tdCinema', t.cinema || 'Bioskop CineTix');
    setText('tdDateTime', `${t.date}, ${t.time}`);
    setText('tdSeats', t.seats);
    setText('tdTotal', 'Rp. ' + t.total.toLocaleString('id-ID'));

    this.generateQR('tdQrCanvas', `${t.movie}-${t.seats}-${t.date}`);
    this.navigate('ticket-detail');
  },

  // ===== AKUN PAGE =====
  renderAkunPage() {
    const providerInfo = {
      guest:    { icon: '👤', text: 'Masuk sebagai Tamu' },
      email:    { icon: '✉️', text: 'Masuk dengan Email' },
      facebook: { icon: 'f',  text: 'Masuk dengan Facebook' },
    };
    const info = providerInfo[this.user.provider] || providerInfo['guest'];
    const initial = this.user.name.charAt(0).toUpperCase() || '👤';

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('akunAvatar', initial);
    setText('akunName', this.user.name);
    setText('akunEmail', this.user.email || '–');
    setText('akunProviderIcon', info.icon);
    setText('akunProviderText', info.text);
    setText('topnavAvatar', initial);
    setText('topnavUsername', 'Hi! ' + this.user.name);
  },

  renderSeatGrid() {
    const grid = document.getElementById('seatGrid');
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const cols = 10;
    const booked = ['B3','B4','C5','D2','D7','E3','E8','F1','F6'];

    grid.innerHTML = '';
    rows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';
      const label = document.createElement('div');
      label.className = 'row-label';
      label.textContent = row;
      rowEl.appendChild(label);
      for (let col = 1; col <= cols; col++) {
        if (col === 4) {
          const aisle = document.createElement('div');
          aisle.className = 'seat-aisle';
          rowEl.appendChild(aisle);
        }
        const seatId = row + col;
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.id = seatId;
        if (booked.includes(seatId)) {
          seat.classList.add('booked');
        } else {
          seat.addEventListener('click', () => this.toggleSeat(seat, seatId));
        }
        rowEl.appendChild(seat);
      }
      grid.appendChild(rowEl);
    });
    this.updateSeatSummary();
  },

  toggleSeat(el, id) {
    if (el.classList.contains('selected')) {
      el.classList.remove('selected');
      this.selectedSeats = this.selectedSeats.filter(s => s !== id);
    } else {
      if (this.selectedSeats.length >= 6) { alert('Maksimal 6 kursi!'); return; }
      el.classList.add('selected');
      this.selectedSeats.push(id);
    }
    this.updateSeatSummary();
  },

  updateSeatSummary() {
    const count = this.selectedSeats.length;
    const total = count * this.ticketPrice;
    document.getElementById('seatCountLabel').textContent = count + ' Kursi';
    document.getElementById('seatPriceLabel').textContent = count > 0 ? 'Rp. ' + total.toLocaleString('id-ID') : 'Pilih kursi';
    document.getElementById('confirmSeats').disabled = count === 0;

    const listEl = document.getElementById('seatChosenList');
    if (listEl) {
      listEl.innerHTML = this.selectedSeats.map(s => `<span>${s}</span>`).join('');
    }
  },

  renderOrderSummary() {
    const count = this.selectedSeats.length;
    const subtotal = count * this.ticketPrice;
    const total = subtotal + this.serviceFee;
    const seats = this.selectedSeats.join(', ');
    // Array tanggal ini disamakan persis dengan date-chip di index.html
    // (24-28 Agustus 2026). this.selectedDate (1-5) di-set dari
    // dataset.date pada date-chip yang diklik, dan direset ke 3 setiap
    // kali user membuka film baru (lihat listener [data-nav="detail"] di
    // init()) supaya selalu sinkron dengan chip yang tampak aktif.
    const dates = ['24 Agustus','25 Agustus','26 Agustus','27 Agustus','28 Agustus'];
    const days = ['Senin','Selasa','Rabu','Kamis','Jumat'];
    const idx = this.selectedDate - 1;

    document.getElementById('summarySeats').textContent = seats;
    document.getElementById('summaryCount').textContent = count + ' Tiket';
    // Tampilkan harga per kursi x jumlah kursi, bukan (subtotal) x jumlah kursi
    document.getElementById('summarySubtotal').textContent = 'Rp. ' + this.ticketPrice.toLocaleString('id-ID') + ' x' + count;
    document.getElementById('summaryService').textContent = 'Rp. ' + this.serviceFee.toLocaleString('id-ID');
    document.getElementById('summaryTotal').textContent = 'Rp. ' + total.toLocaleString('id-ID');
    document.getElementById('summaryDateTime').textContent = days[idx] + ', ' + dates[idx] + ' 2026, ' + this.selectedTime;

    const cinemaNamEl = document.getElementById('summaryCinemaName');
    if (cinemaNamEl) cinemaNamEl.textContent = this.selectedCinemaName || 'Bioskop CineTix';

    const summaryMovieTitleEl = document.getElementById('summaryMovieTitle');
    if (summaryMovieTitleEl) summaryMovieTitleEl.textContent = this.movieTitles[this.currentMovie] || this.currentMovie;

    const summaryPosterEl = document.getElementById('summaryPoster');
    if (summaryPosterEl) {
      summaryPosterEl.onerror = () => this.handleImgError(summaryPosterEl);
      summaryPosterEl.src = this.moviePosters[this.currentMovie] || 'assets/img/cinlock1.jpeg';
      summaryPosterEl.alt = this.movieTitles[this.currentMovie] || 'Film';
    }
  },

  startPaymentTimer() {
    let seconds = 120;
    const el = document.getElementById('payCountdown');
    const interval = setInterval(() => {
      seconds--;
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      if (el) el.textContent = m + ':' + s;
      if (seconds <= 0) { clearInterval(interval); this.navigate('home'); }
    }, 1000);

    this.generateQR('qrCanvas', `PAY-${this.currentMovie}-${this.selectedSeats.join('')}`);

    // Simulate payment success after 4 seconds
    setTimeout(() => {
      clearInterval(interval);
      const ticket = this.saveBookedTicket();
      this._lastTicket = ticket;
      this.navigate('success');
      this.renderSuccessTicket(ticket);
    }, 4000);
  },

  saveBookedTicket() {
    const dates = ['24 Agustus','25 Agustus','26 Agustus','27 Agustus','28 Agustus'];
    const days = ['Senin','Selasa','Rabu','Kamis','Jumat'];
    const idx = this.selectedDate - 1;
    const ticket = {
      movie: this.currentMovie,
      seats: this.selectedSeats.join(', '),
      date: days[idx] + ', ' + dates[idx] + ' 2026',
      time: this.selectedTime,
      total: (this.selectedSeats.length * this.ticketPrice + this.serviceFee),
      cinema: this.selectedCinemaName || 'Bioskop CineTix',
    };
    this.bookedTickets.push(ticket);

    // Kirim data booking ke database (PHP + MySQL) dan ke Google Spreadsheet.
    // Keduanya jalan sendiri-sendiri di belakang layar (tidak saling tunggu),
    // jadi walaupun salah satu gagal, tampilan tiket di website tetap normal.
    this.sendBookingToDatabase(ticket);
    this.sendBookingToSpreadsheet(ticket);

    return ticket;
  },

  // Kirim data booking ke database lewat PHP (api/save_booking.php)
  sendBookingToDatabase(ticket) {
    fetch('api/save_booking.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booker: this.user.name,
        movie: this.movieTitles[ticket.movie] || ticket.movie,
        cinema: ticket.cinema,
        date: ticket.date,
        time: ticket.time,
        seats: ticket.seats,
        seatCount: this.selectedSeats.length,
        total: ticket.total,
      }),
    })
      .then(res => res.json())
      .then(data => console.log('Booking tersimpan di database:', data))
      .catch(err => console.error('Gagal simpan booking ke database:', err));
  },

  // Kirim data booking ke Google Spreadsheet lewat Google Apps Script Web App
  sendBookingToSpreadsheet(ticket) {
    if (!this.SPREADSHEET_URL || this.SPREADSHEET_URL === 'TEMPEL_URL_WEB_APP_KAMU_DI_SINI') {
      console.warn('SPREADSHEET_URL belum diisi, lewati kirim ke spreadsheet.');
      return;
    }

    fetch(this.SPREADSHEET_URL, {
      method: 'POST',
      body: JSON.stringify({
        booker: this.user.name,
        movie: this.movieTitles[ticket.movie] || ticket.movie,
        cinema: ticket.cinema,
        date: ticket.date,
        time: ticket.time,
        seats: ticket.seats,
        seatCount: this.selectedSeats.length,
        total: ticket.total,
      }),
    })
      .then(res => res.json())
      .then(data => console.log('Booking tersimpan di spreadsheet:', data))
      .catch(err => console.error('Gagal simpan booking ke spreadsheet:', err));
  },

  // Simple hash used to seed the fake QR / barcode patterns so each ticket looks unique
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % 100000;
    }
    return hash;
  },

  generateQR(canvasId, seedStr) {
    const canvas = document.getElementById(canvasId || 'qrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const cellSize = 8;
    const cells = size / cellSize;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    const seed = seedStr ? this.hashCode(seedStr) : 42;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const hash = (i * 31 + j * 17 + seed) % 3;
        if (hash === 0) ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
    const drawSquare = (x, y) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, 56, 56);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 8, y + 8, 40, 40);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 16, y + 16, 24, 24);
    };
    drawSquare(0, 0);
    drawSquare(144, 0);
    drawSquare(0, 144);
  },

  renderSuccessTicket(ticket) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('ticketBooker', this.user.name);
    setText('ticketMovie', this.movieTitles[ticket.movie] || ticket.movie);
    setText('ticketSeats', ticket.seats);
    setText('ticketTotal', 'Rp. ' + ticket.total.toLocaleString('id-ID'));
    setText('ticketDateTime', `${ticket.date}, ${ticket.time}`);
    setText('ticketCinema', ticket.cinema || 'Bioskop CineTix');
    // Catatan: barcode/QR sengaja TIDAK ditampilkan di halaman "Pembayaran
    // Berhasil" ini. Barcode tetap tersedia di PDF (downloadTicketPdf) dan
    // di halaman "Tiket Saya" > detail tiket (lihat showTicketDetail / tdQrCanvas).
  },

  // Generates a simple barcode-style PNG (data URL) unique to the ticket, for embedding in the PDF
  generateBarcodeDataURL(text) {
    const canvas = document.createElement('canvas');
    const width = 240, height = 64;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000000';

    let seed = this.hashCode(text || 'CINETIX') || 1;
    let x = 4;
    while (x < width - 4) {
      seed = (seed * 9301 + 49297) % 233280;
      const barWidth = 1 + (seed % 4);
      if ((seed >> 3) % 2 === 0) {
        ctx.fillRect(x, 4, barWidth, height - 18);
      }
      x += barWidth + 1;
    }
    ctx.fillStyle = '#000000';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText((text || '').slice(0, 24).toUpperCase(), width / 2, height - 5);

    return canvas.toDataURL('image/png');
  },

  // ===== CETAK / UNDUH TIKET PDF (jsPDF) =====
  downloadTicketPdf(ticket) {
    if (!window.jspdf) {
      alert('Library PDF belum siap dimuat, coba lagi sebentar.');
      return;
    }
    ticket = ticket || this._lastTicket;
    if (!ticket) {
      alert('Data tiket tidak ditemukan.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [100, 180] });

    const movie = this.movieTitles[ticket.movie] || ticket.movie;
    const cinema = ticket.cinema || 'Bioskop CineTix';
    const seats = ticket.seats || '-';
    const total = ticket.total || 0;
    const jadwal = `${ticket.date}, ${ticket.time}`;
    const booker = this.user.name || 'Pengguna';

    // Header
    doc.setFillColor(230, 57, 70);
    doc.rect(0, 0, 100, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('CINETIX', 8, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('E-TICKET', 8, 21);

    // Body
    doc.setTextColor(20, 20, 20);
    let y = 38;
    const row = (label, value) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(label, 8, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(value, 84);
      doc.text(lines, 8, y + 6);
      y += 6 + (lines.length * 5.5) + 5;
    };

    row('Nama Pemesan', booker);
    row('Film', movie);
    row('Bioskop', cinema);
    row('Jadwal', jadwal);
    row('Kursi', seats);

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(8, y, 92, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Total Bayar', 8, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(230, 57, 70);
    doc.text('Rp. ' + total.toLocaleString('id-ID'), 8, y + 7);
    y += 16;

    // Barcode for scanning at the cinema
    const barcodeText = `${ticket.movie}-${seats}`.replace(/[,\s]+/g, '');
    const barcodeData = this.generateBarcodeDataURL(barcodeText);
    doc.addImage(barcodeData, 'PNG', 8, y, 84, 20);
    y += 26;

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('Tunjukkan barcode ini di bioskop untuk masuk studio.', 8, y);

    const fileName = `CineTix-Tiket-${ticket.movie}-${seats.replace(/,\s*/g, '').replace(/\s+/g, '') || 'ticket'}.pdf`;
    doc.save(fileName);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
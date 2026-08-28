/* SHOTBOX — logic bersama seluruh "halaman" (sekarang jadi 1 file, SPA)
   Data dioper antar-bagian lewat objek `appState` di memori (bukan lagi
   lewat URL query string, karena semua sudah jadi 1 index.html).

   CATATAN SOAL GAMBAR PAKET (BARU):
   Sebelumnya url gambar tiap paket disimpan di field `img` pada array
   CATALOG di file JS ini, lalu dipakai untuk membangun innerHTML kartu
   paket. SEKARANG kartu paket (termasuk tag <img>) sudah ditulis
   langsung di index.html, jadi array CATALOG di bawah ini TIDAK lagi
   punya field img. Saat tombol "Booking Sesi" diklik, gambar untuk
   halaman Data Pemesan diambil langsung dari elemen <img> yang ada di
   dalam kartu HTML tersebut (lihat initKatalog), bukan dari string di
   file JS ini. Kalau mau ganti foto paket, edit langsung atribut
   src="..." di index.html.

   CATATAN SOAL NAVIGASI:
   Semua "halaman" sudah digabung jadi satu index.html. Perpindahan antar
   bagian (login, daftar, katalog, booking, pembayaran, struk, tiket)
   dilakukan cukup dengan menukar class "active" pada section yang
   bersangkutan, TANPA mengubah URL sama sekali — jadi address bar akan
   selalu tampil bersih (mis. localhost/studio1) tanpa embel-embel #katalog dsb.

   CATATAN SOAL AKUN:
   Akun disimpan di localStorage (key "shotbox_users") berupa
   { nama, email, password }. Email dipakai sebagai ID unik akun
   (case-insensitive). Login memvalidasi email + password terhadap akun
   yang sudah terdaftar.

   CATATAN SOAL TIKET PER USER:
   Setiap tiket disimpan dengan field `owner` (diambil dari email akun
   yang sedang login). Saat "Tiket Saya" dibuka, hanya tiket milik email
   yang sedang login yang ditampilkan/dibaca dari localStorage.

   CATATAN SOAL PEMBAYARAN:
   Sekarang tiap metode pembayaran punya detail sendiri yang wajib
   ditampilkan sebelum tombol "Konfirmasi Pembayaran" bisa dipakai:
   - Transfer Bank BCA -> nomor Virtual Account otomatis (dummy, digenerate
     per transaksi) + tombol salin.
   - QRIS -> QR code (digenerate pakai library QRCode.js) berisi info
     merchant + nominal tagihan.
   - E-Wallet -> nomor e-wallet tujuan milik Shotbox (dummy tetap) +
     wajib isi nomor e-wallet pengirim (milik pembeli) sebelum konfirmasi. */

// Data teks & harga paket saja (TANPA url gambar — gambar ada di HTML).
// Array CATALOG = sumber data (nama, deskripsi, harga, unit) untuk ke-8
// paket studio. Tiap objek "id" di sini HARUS sama persis dengan
// data-id/data-book pada kartu paket di index.html, karena keduanya
// dicocokkan (CATALOG.find) di dalam function initKatalog() di bawah,
// saat tombol "Booking Sesi" pada kartu diklik.
const CATALOG = [
  { id:"self",       name:"Self Photo Studio",        desc:"15 menit/sesi • Include all soft file • 5 pilihan background", price:50000, unit:"sesi" },
  { id:"elevator",   name:"Elevator Photobooth",      desc:"15 menit/sesi • Konsep lift • Free print 2 strips",            price:30000, unit:"sesi" },
  { id:"vintage",    name:"Vintage Photobooth",       desc:"15 menit/sesi • Properti vintage • Free print 2 strips",       price:30000, unit:"sesi" },
  { id:"supermarket",name:"Supermarket Photobooth",   desc:"15 menit/sesi • Set supermarket • Free print 2 strips",        price:30000, unit:"sesi" },
  { id:"teddybear",  name:"Teddy Bear Photobooth",    desc:"15 menit/sesi • Properti teddy bear • Free print 2 strips",    price:30000, unit:"sesi" },
  { id:"retro",      name:"Vintage Retro Photobooth", desc:"15 menit/sesi • Set retro • Free print 2 strips",              price:30000, unit:"sesi" },
  { id:"highangle",  name:"High Angle Photobooth",    desc:"15 menit/sesi • Kamera sudut atas • Free print 2 strips",      price:30000, unit:"sesi" },
  { id:"curtain",    name:"Curtain Photobooth",       desc:"15 menit/sesi • Set backdrop tirai • Free print 2 strips",     price:35000, unit:"sesi" },
];

// Nomor tetap milik Shotbox (dummy, dipakai konsisten sebagai tujuan e-wallet).
const SHOTBOX_EWALLET_NUMBER = "0812-3456-7890";

// Menyimpan data yang sebelumnya dioper lewat URL (?item=...&nama=...) selama
// user masih di dalam 1 halaman index.html ini.
const appState = {
  user: "",       // nama lengkap (untuk ditampilkan, mis. "Halo, Sari")
  userEmail: "",  // email (dipakai sebagai ID unik akun & pemilik tiket)
  item: null,     // { id, name, desc, price, unit, img } — img diambil dari HTML
  booking: {},     // nama, hp, email, tanggal, jam, qty, total
  payment: {},     // metode, trx, va, ewalletTujuan, ewalletPengirim
};

const VALID_PAGES = ["login","daftar","katalog","booking","pembayaran","struk","tiket"];

function fmtRupiah(n){ return "Rp" + Math.round(n || 0).toLocaleString("id-ID"); }

// Normalisasi email jadi ID unik yang konsisten (lowercase + trim).
function ownerKey(email){
  return (email || "").trim().toLowerCase();
}

/* =========================================================
   AKUN (Daftar / Login) — SEKARANG disimpan di database MySQL
   lewat api/register.php dan api/login.php (bukan localStorage lagi).
========================================================= */
async function registerAccount(nama, email, password, konfirmasi){
  const res = await fetch("api/register.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama, email, password, konfirmasi })
  });
  return res.json(); // { success, user? , message? }
}

async function loginAccount(email, password){
  const res = await fetch("api/login.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return res.json(); // { success, user? , message? }
}

/* =========================================================
   TIKET — SEKARANG diambil dari database lewat api/tickets.php
   (dulu disimpan/dibaca dari localStorage, lihat renderTiket()
   di bagian "TIKET SAYA" untuk pemanggilannya).
========================================================= */

/* =========================================================
   NAVIGASI ANTAR BAGIAN (tanpa mengubah URL / hash sama sekali)
========================================================= */
function goTo(page, params){
  if(VALID_PAGES.indexOf(page) === -1) page = "login";

  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  const target = document.getElementById("sec-" + page);
  if(target) target.classList.add("active");
  window.scrollTo({ top:0, behavior:"instant" in window ? "instant" : "auto" });

  if(params && params.user){
    appState.user = params.user;
  }
  if(params && params.email){
    appState.userEmail = params.email;
  }

  if(page === "katalog") renderKatalog();
  if(page === "booking") renderBooking();
  if(page === "pembayaran") renderPembayaran();
  if(page === "struk") renderStruk();
  if(page === "tiket") renderTiket();
}

// Semua link nav (Paket, Tiket Saya, brand, "Daftar di sini", dsb) pakai atribut data-page
function initNav(){
  document.body.addEventListener("click", (e)=>{
    const backEl = e.target.closest("[data-back]");
    if(backEl){
      e.preventDefault();
      goBack(backEl.dataset.back);
      return;
    }
    const el = e.target.closest("[data-page]");
    if(!el) return;
    e.preventDefault();
    goTo(el.dataset.page);
  });
}

// Tombol "Kembali". Kalau tujuannya "login" (dari halaman katalog/dashboard),
// ini berfungsi sebagai logout: seluruh sesi & data di memori dikosongkan.
// Untuk tujuan lain (katalog <- booking, booking <- pembayaran), data yang
// sudah diisi user TIDAK dihapus supaya tidak perlu isi ulang dari awal.
function goBack(target){
  if(target === "login"){
    appState.user = "";
    appState.userEmail = "";
    appState.userId = null;
    appState.item = null;
    appState.booking = {};
    appState.payment = {};
  }
  goTo(target);
}

/* =========================================================
   BAGIAN LOGIN (Masuk)
========================================================= */
function initLogin(){
  const form = document.getElementById("login-form");
  if(!form) return;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const nama = document.getElementById("login-nama").value.trim();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.style.display = "none";

    if(!nama || !email || !password){
      errEl.textContent = "Nama, email, dan kata sandi wajib diisi.";
      errEl.style.display = "block";
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    let result;
    try{
      result = await loginAccount(email, password);
    }catch(err){
      submitBtn.disabled = false;
      errEl.textContent = "Tidak bisa menghubungi server. Pastikan Apache & MySQL di XAMPP sedang jalan.";
      errEl.style.display = "block";
      return;
    }
    submitBtn.disabled = false;

    if(!result.success){
      errEl.textContent = result.message || "Email atau kata sandi salah.";
      errEl.style.display = "block";
      return;
    }

    // Setiap kali submit form login, anggap ini sesi/akun baru:
    // reset semua state di memori supaya tidak ada "bekas" dari akun
    // sebelumnya (item terpilih, data booking, dsb).
    appState.user = result.user.nama;
    appState.userEmail = result.user.email;
    appState.userId = result.user.id;
    appState.item = null;
    appState.booking = {};
    appState.payment = {};

    form.reset();
    goTo("katalog", { user: result.user.nama, email: result.user.email });
  });
}

/* =========================================================
   BAGIAN DAFTAR AKUN (Registrasi)
========================================================= */
function initDaftar(){
  const form = document.getElementById("daftar-form");
  if(!form) return;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const nama = document.getElementById("daftar-nama").value.trim();
    const email = document.getElementById("daftar-email").value.trim();
    const password = document.getElementById("daftar-password").value;
    const konfirmasi = document.getElementById("daftar-konfirmasi").value;
    const errEl = document.getElementById("daftar-error");
    errEl.style.display = "none";

    // Validasi ringan di sisi browser dulu (biar terasa cepat responnya).
    // Validasi final tetap dicek ulang di register.php.
    if(!nama || !email || !password || !konfirmasi){
      errEl.textContent = "Semua kolom wajib diisi.";
      errEl.style.display = "block";
      return;
    }
    if(password.length < 6){
      errEl.textContent = "Kata sandi minimal 6 karakter.";
      errEl.style.display = "block";
      return;
    }
    if(password !== konfirmasi){
      errEl.textContent = "Konfirmasi kata sandi tidak cocok.";
      errEl.style.display = "block";
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    let result;
    try{
      result = await registerAccount(nama, email, password, konfirmasi);
    }catch(err){
      submitBtn.disabled = false;
      errEl.textContent = "Tidak bisa menghubungi server. Pastikan Apache & MySQL di XAMPP sedang jalan.";
      errEl.style.display = "block";
      return;
    }
    submitBtn.disabled = false;

    if(!result.success){
      errEl.textContent = result.message || "Gagal mendaftar.";
      errEl.style.display = "block";
      return;
    }

    // Langsung login otomatis setelah daftar berhasil, supaya user tidak
    // perlu isi form login lagi dari nol.
    appState.user = result.user.nama;
    appState.userEmail = result.user.email;
    appState.userId = result.user.id;
    appState.item = null;
    appState.booking = {};
    appState.payment = {};

    form.reset();
    goTo("katalog", { user: result.user.nama, email: result.user.email });
  });
}

/* =========================================================
   BAGIAN KATALOG (Paket Studio)
   Kartu paket (nama, deskripsi, harga, gambar) SUDAH statis di HTML.
   JS di sini HANYA: (1) menampilkan sapaan "Halo, ..." dan
   (2) menempelkan event klik ke tombol Booking Sesi yang sudah ada
   di HTML — termasuk MENGAMBIL gambar paket langsung dari elemen
   <img class="portfolio-img"> di dalam kartu yang diklik.
========================================================= */
function renderKatalog(){
  const userLabel = document.getElementById("user-label");
  if(userLabel) userLabel.textContent = appState.user ? ("Halo, " + appState.user) : "";
}

// Function initKatalog() = fungsi yang membaca klik tombol "Booking Sesi"
// pada tiap kartu paket di halaman Katalog, lalu mencocokkan id-nya ke
// array CATALOG di atas.
function initKatalog(){
  const grid = document.getElementById("catalog-grid");
  if(!grid) return;

  grid.querySelectorAll("[data-book]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.book;
      const data = CATALOG.find(i => i.id === id) || CATALOG[0];

      // Ambil gambar langsung dari HTML kartu paket ini (bukan dari JS).
      const row = btn.closest(".portfolio-row");
      const imgEl = row ? row.querySelector(".portfolio-img") : null;
      const imgSrc = imgEl ? imgEl.src : "";
      const imgAlt = imgEl ? imgEl.alt : data.name;

      const newItem = { ...data, img: imgSrc, imgAlt: imgAlt };

      // Kalau pilih paket yang beda dari sebelumnya, form booking dikosongkan
      // lagi. Kalau paketnya sama (mis. balik lagi dari halaman pembayaran
      // lewat "Booking Sesi" yang sama), data yang sudah diisi tetap dipakai.
      if(!appState.item || appState.item.id !== newItem.id){
        appState.booking = {};
      }
      appState.item = newItem;
      goTo("booking");
    });
  });
}

/* =========================================================
   BAGIAN DATA BOOKING (Isi Data Booking)
   <img id="sum-img"> tetap satu tag statis di HTML (src default
   kosong). Di sini srcnya hanya diisi ulang dengan gambar yang
   sudah diambil dari HTML katalog (appState.item.img), BUKAN
   url baru yang ditulis di file JS ini.
========================================================= */
function renderBooking(){
  const wrap = document.getElementById("booking-wrap");
  if(!wrap) return;
  const item = appState.item || { ...CATALOG[0], img:"", imgAlt:CATALOG[0].name };
  appState.item = item;

  document.getElementById("sum-img").src = item.img || "";
  document.getElementById("sum-img").alt = item.imgAlt || item.name;
  document.getElementById("sum-name").textContent = item.name;
  document.getElementById("sum-price").textContent = fmtRupiah(item.price) + " / " + item.unit;

  // Isi ulang form dari data yang sudah pernah diketik user sebelumnya
  // (mis. saat menekan tombol "Kembali" dari halaman Pembayaran), supaya
  // tidak perlu isi ulang dari nol. Kalau belum pernah isi apa-apa, nama &
  // email default diambil dari akun yang sedang login.
  const b = appState.booking || {};
  document.getElementById("booking-nama").value = b.nama || appState.user || "";
  document.getElementById("booking-hp").value = b.hp || "";
  document.getElementById("booking-email").value = b.email || appState.userEmail || "";
  document.getElementById("booking-tanggal").value = b.tanggal || "";
  document.getElementById("booking-jam").value = b.jam || "";

  const qtyInput = document.getElementById("booking-qty");
  const totalEl = document.getElementById("total-amount");
  const subEl = document.getElementById("sub-amount");
  qtyInput.value = b.qty || 1;

  function recalc(){
    const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
    const sub = item.price * qty;
    subEl.textContent = fmtRupiah(sub);
    totalEl.textContent = fmtRupiah(sub);
    return sub;
  }
  qtyInput.oninput = recalc;
  recalc();

  const errEl = document.getElementById("booking-error");
  errEl.style.display = "none";
}
function initBooking(){
  const form = document.getElementById("booking-form");
  if(!form) return;
  form.addEventListener("submit", e=>{
    e.preventDefault();
    const item = appState.item || CATALOG[0];
    const nama = document.getElementById("booking-nama").value.trim();
    const hp = document.getElementById("booking-hp").value.trim();
    const email = document.getElementById("booking-email").value.trim();
    const tanggal = document.getElementById("booking-tanggal").value;
    const jam = document.getElementById("booking-jam").value;
    const qty = Math.max(1, parseInt(document.getElementById("booking-qty").value || "1", 10));
    const errEl = document.getElementById("booking-error");
    if(!nama || !hp || !email || !tanggal || !jam){
      errEl.textContent = "Lengkapi semua data terlebih dahulu.";
      errEl.style.display = "block";
      return;
    }
    errEl.style.display = "none";
    const total = item.price * qty;
    appState.booking = { nama, hp, email, tanggal, jam, qty, total };
    goTo("pembayaran");
  });
}

/* =========================================================
   BAGIAN PEMBAYARAN
   Setiap metode (BCA / QRIS / E-Wallet) punya blok detail sendiri yang
   muncul begitu radio-nya dipilih, dan blok lain otomatis disembunyikan.
========================================================= */

// Bikin nomor Virtual Account BCA dummy tapi unik per transaksi.
function generateVA(){
  const digits = Date.now().toString().slice(-10);
  return "8808 " + digits.replace(/(\d{4})(\d{4})(\d{2})/, "$1 $2 $3");
}

// Bikin referensi QRIS dummy (bukan format ISO 20022 asli — untuk keperluan
// tampilan/demo saja) supaya QR yang digenerate unik per transaksi & nominal.
function generateQrisRef(){
  const item = appState.item || CATALOG[0];
  const b = appState.booking || {};
  return [
    "00020101",
    "SHOTBOX-STUDIO-FOTO",
    "ITEM:" + item.name,
    "TOTAL:" + (b.total || item.price),
    "REF:" + Date.now().toString(36).toUpperCase()
  ].join("|");
}

function renderQrisCode(){
  const el = document.getElementById("qris-code");
  if(!el || typeof QRCode === "undefined") return;
  el.innerHTML = "";
  new QRCode(el, {
    text: appState.payment.qrisRef,
    width: 180,
    height: 180,
    colorDark: "#262422",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

function showMethodDetail(method){
  const detailBca = document.getElementById("detail-bca");
  const detailQris = document.getElementById("detail-qris");
  const detailEwallet = document.getElementById("detail-ewallet");
  [detailBca, detailQris, detailEwallet].forEach(d => { if(d) d.style.display = "none"; });

  const b = appState.booking || {};
  const item = appState.item || CATALOG[0];

  if(method === "Transfer Bank BCA"){
    if(!appState.payment.va) appState.payment.va = generateVA();
    document.getElementById("bca-va-number").textContent = appState.payment.va;
    detailBca.style.display = "block";
  }

  if(method === "QRIS"){
    if(!appState.payment.qrisRef) appState.payment.qrisRef = generateQrisRef();
    document.getElementById("qris-amount").textContent = fmtRupiah(b.total || item.price);
    renderQrisCode();
    detailQris.style.display = "block";
  }

  if(method === "E-Wallet (GoPay/OVO/Dana)"){
    document.getElementById("ewallet-tujuan-number").textContent = SHOTBOX_EWALLET_NUMBER;
    appState.payment.ewalletTujuan = SHOTBOX_EWALLET_NUMBER;
    detailEwallet.style.display = "block";
  }
}

function renderPembayaran(){
  const wrap = document.getElementById("pay-wrap");
  if(!wrap) return;
  const item = appState.item || CATALOG[0];
  const b = appState.booking || {};

  document.getElementById("pay-item").textContent = item.name;
  document.getElementById("pay-detail").textContent = `${b.qty || 1} sesi`;
  document.getElementById("pay-total").textContent = fmtRupiah(b.total || item.price);

  // Reset pilihan metode & seluruh detail pembayaran setiap kali masuk
  // halaman ini (booking baru), supaya tidak nempel dari transaksi lama.
  appState.payment = {};
  document.querySelectorAll(".pay-method").forEach(m=>{
    m.classList.remove("selected");
    m.querySelector("input").checked = false;
  });
  ["detail-bca","detail-qris","detail-ewallet"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });
  const ewalletInput = document.getElementById("ewallet-pengirim");
  if(ewalletInput) ewalletInput.value = "";

  const errEl = document.getElementById("pay-error");
  errEl.style.display = "none";
}

function initPembayaran(){
  const wrap = document.getElementById("pay-wrap");
  if(!wrap) return;

  document.querySelectorAll(".pay-method").forEach(m=>{
    m.addEventListener("click", ()=>{
      document.querySelectorAll(".pay-method").forEach(x=>x.classList.remove("selected"));
      m.classList.add("selected");
      m.querySelector("input").checked = true;
      document.getElementById("pay-error").style.display = "none";
      showMethodDetail(m.querySelector("input").value);
    });
  });

  document.getElementById("copy-va-btn").addEventListener("click", ()=>{
    const number = (appState.payment.va || "").replace(/\s/g,"");
    copyToClipboard(number, "copy-va-btn", "Nomor Tersalin!");
  });

  document.getElementById("copy-ewallet-btn").addEventListener("click", ()=>{
    const number = (appState.payment.ewalletTujuan || SHOTBOX_EWALLET_NUMBER).replace(/-/g,"");
    copyToClipboard(number, "copy-ewallet-btn", "Nomor Tersalin!");
  });

  document.getElementById("confirm-pay-btn").addEventListener("click", async ()=>{
    const selected = document.querySelector(".pay-method input:checked");
    const errEl = document.getElementById("pay-error");

    if(!selected){
      errEl.textContent = "Pilih metode pembayaran terlebih dahulu.";
      errEl.style.display = "block";
      return;
    }

    const method = selected.value;

    // Khusus E-Wallet: nomor pengirim wajib diisi supaya pembayaran bisa
    // dicocokkan dengan transfer yang masuk.
    if(method === "E-Wallet (GoPay/OVO/Dana)"){
      const pengirim = document.getElementById("ewallet-pengirim").value.trim();
      if(!pengirim){
        errEl.textContent = "Isi nomor e-wallet kamu (pengirim) terlebih dahulu.";
        errEl.style.display = "block";
        return;
      }
      appState.payment.ewalletPengirim = pengirim;
    }

    errEl.style.display = "none";

    const item = appState.item || CATALOG[0];
    const b = appState.booking || {};

    // Data ini yang dikirim ke api/booking.php untuk di-INSERT ke tabel
    // bookings + payments sekaligus.
    const payload = {
      user_id: appState.userId,
      package_id: item.id,
      nama: b.nama, hp: b.hp, email: b.email,
      tanggal: b.tanggal, jam: b.jam, qty: b.qty, total: b.total,
      metode: method,
      va: appState.payment.va || null,
      ewallet_tujuan: appState.payment.ewalletTujuan || null,
      ewallet_pengirim: appState.payment.ewalletPengirim || null
    };

    const confirmBtn = document.getElementById("confirm-pay-btn");
    confirmBtn.disabled = true;

    let result;
    try{
      const res = await fetch("api/booking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      result = await res.json();
    }catch(err){
      confirmBtn.disabled = false;
      errEl.textContent = "Tidak bisa menghubungi server. Pastikan Apache & MySQL di XAMPP sedang jalan.";
      errEl.style.display = "block";
      return;
    }
    confirmBtn.disabled = false;

    if(!result.success){
      errEl.textContent = result.message || "Gagal menyimpan booking ke database.";
      errEl.style.display = "block";
      return;
    }

    // trx & booking_id sekarang datang dari database, bukan dibuat di browser.
    appState.payment = { ...appState.payment, metode: method, trx: result.trx, bookingId: result.booking_id };
    goTo("struk");
  });
}

// Helper salin ke clipboard + feedback singkat di tombolnya.
function copyToClipboard(text, btnId, feedbackText){
  if(!text) return;
  navigator.clipboard.writeText(text).then(()=>{
    const btn = document.getElementById(btnId);
    if(!btn) return;
    const original = btn.textContent;
    btn.textContent = feedbackText;
    btn.disabled = true;
    setTimeout(()=>{ btn.textContent = original; btn.disabled = false; }, 1500);
  });
}

/* =========================================================
   BAGIAN STRUK / BUKTI BOOKING
========================================================= */
function paymentRefLine(p){
  if(p.metode === "Transfer Bank BCA" && p.va) return `VA BCA: ${p.va}`;
  if(p.metode === "QRIS") return "Dibayar via scan QRIS";
  if(p.metode === "E-Wallet (GoPay/OVO/Dana)" && p.ewalletPengirim) return `Dari: ${p.ewalletPengirim} → Ke: ${p.ewalletTujuan || SHOTBOX_EWALLET_NUMBER}`;
  return "";
}

function renderStruk(){
  const wrap = document.getElementById("struk-wrap");
  if(!wrap) return;
  const item = appState.item || CATALOG[0];
  const b = appState.booking || {};
  const p = appState.payment || {};

  document.getElementById("st-trx").textContent = p.trx || "";
  document.getElementById("st-item").textContent = item.name;
  document.getElementById("st-nama").textContent = b.nama || "";
  document.getElementById("st-jadwal").textContent = `${b.tanggal || ""} • ${b.jam || ""}`;
  document.getElementById("st-detail").textContent = `${b.qty || 1} sesi`;
  document.getElementById("st-metode").textContent = p.metode || "";
  document.getElementById("st-total").textContent = fmtRupiah(b.total || item.price);
  document.getElementById("st-code").textContent = p.trx || "";

  // Booking & pembayaran sudah disimpan ke database saat tombol "Konfirmasi
  // Pembayaran" ditekan (lihat api/booking.php), jadi di halaman ini kita
  // TIDAK perlu menyimpan apa pun lagi — cukup menampilkan hasilnya.

  const barcodeEl = document.getElementById("barcode");
  if(window.JsBarcode && barcodeEl){
    barcodeEl.innerHTML = "";
    JsBarcode("#barcode", p.trx || "-", { format:"CODE128", width:2, height:60, displayValue:false, background:"transparent", lineColor:"#262422" });
  }
}
function initStruk(){
  const wrap = document.getElementById("struk-wrap");
  if(!wrap) return;

  document.getElementById("download-pdf").addEventListener("click", ()=>{
    const item = appState.item || CATALOG[0];
    const b = appState.booking || {};
    const p = appState.payment || {};

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:[320, 480] });
    doc.setFillColor(255,255,255);
    doc.rect(0,0,320,480,"F");
    doc.setTextColor(44,67,64);
    doc.setFontSize(17);
    doc.text("Shotbox", 160, 40, { align:"center" });
    doc.setTextColor(131,126,116);
    doc.setFontSize(10);
    doc.text("Bukti Booking Studio Foto", 160, 58, { align:"center" });
    doc.setDrawColor(210,205,195);
    doc.line(24,72,296,72);

    const lines = [
      ["No. Transaksi", p.trx],
      ["Paket", item.name],
      ["Pemesan", b.nama],
      ["No. HP", b.hp],
      ["Email", b.email],
      ["Jadwal Sesi", `${b.tanggal} ${b.jam}`],
      ["Jumlah Sesi", b.qty],
      ["Metode Bayar", p.metode],
      ["Total Bayar", fmtRupiah(b.total)],
    ];
    const ref = paymentRefLine(p);
    if(ref) lines.push(["Referensi", ref]);

    let y = 96;
    doc.setFontSize(10);
    lines.forEach(([label, val])=>{
      doc.setTextColor(131,126,116);
      doc.text(label, 24, y);
      doc.setTextColor(38,36,34);
      doc.text(String(val ?? ""), 296, y, { align:"right" });
      y += 22;
    });

    const svg = document.getElementById("barcode");
    if(svg && svg.innerHTML.trim() !== ""){
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);
      img.onload = function(){
        const canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 120;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,20,10,460,90);
        const pngUrl = canvas.toDataURL("image/png");
        doc.addImage(pngUrl, "PNG", 40, y+10, 240, 48);
        doc.setFontSize(9);
        doc.setTextColor(131,126,116);
        doc.text(p.trx || "", 160, y+70, { align:"center" });
        doc.save(`Booking-${p.trx}.pdf`);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      doc.save(`Booking-${p.trx}.pdf`);
    }
  });
}

/* =========================================================
   BAGIAN TIKET SAYA (Riwayat Booking)
========================================================= */
// Menyimpan hasil fetch terakhir supaya bisa dibuka detailnya saat diklik
// (perlu disimpan di luar renderTiket karena fetch-nya asynchronous).
let currentTickets = [];

async function renderTiket(){
  const list = document.getElementById("ticket-list");
  if(!list) return;
  const empty = document.getElementById("ticket-empty");

  if(!appState.userId){
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }

  let tickets = [];
  try{
    const res = await fetch("api/tickets.php?user_id=" + encodeURIComponent(appState.userId));
    const result = await res.json();
    tickets = result.tickets || [];
  }catch(err){
    // Gagal konek server (mis. XAMPP mati) — tampilkan seperti kosong saja.
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }

  currentTickets = tickets;

  if(tickets.length === 0){
    list.style.display = "none";
    empty.style.display = "block";
    return;
  }
  list.style.display = "flex";
  empty.style.display = "none";

  list.innerHTML = tickets.map((t,i) => `
    <button type="button" class="ticket-item" data-idx="${i}">
      <div class="ticket-item-main">
        <h4>${t.itemName}</h4>
        <p>${t.nama} • ${t.jadwal}</p>
      </div>
      <div class="ticket-item-side">
        <span class="ticket-code-mini">${t.trx}</span>
        <span class="ticket-arrow">›</span>
      </div>
    </button>
  `).join("");

  list.querySelectorAll(".ticket-item").forEach(btn=>{
    btn.addEventListener("click", ()=> openTicketDetail(currentTickets[+btn.dataset.idx]));
  });
}
function openTicketDetail(t){
  const overlay = document.getElementById("ticket-detail");
  document.getElementById("d-trx").textContent = t.trx;
  document.getElementById("d-item").textContent = t.itemName;
  document.getElementById("d-nama").textContent = t.nama;
  document.getElementById("d-jadwal").textContent = t.jadwal;
  document.getElementById("d-detail").textContent = t.refInfo ? `${t.detail} • ${t.refInfo}` : t.detail;
  document.getElementById("d-metode").textContent = t.metode;
  document.getElementById("d-total").textContent = fmtRupiah(t.total);
  document.getElementById("d-code").textContent = t.trx;
  overlay.style.display = "flex";
  const dBarcode = document.getElementById("d-barcode");
  if(window.JsBarcode && dBarcode){
    dBarcode.innerHTML = "";
    JsBarcode("#d-barcode", t.trx, { format:"CODE128", width:2, height:60, displayValue:false, background:"transparent", lineColor:"#262422" });
  }
}
function initTiket(){
  const overlay = document.getElementById("ticket-detail");
  if(!overlay) return;
  document.getElementById("close-detail").addEventListener("click", ()=>{
    overlay.style.display = "none";
  });
  overlay.addEventListener("click", (e)=>{
    if(e.target === overlay) overlay.style.display = "none";
  });
}

/* =========================================================
   INIT SEMUA BAGIAN SEKALI SAAT HALAMAN DIMUAT
========================================================= */
document.addEventListener("DOMContentLoaded", ()=>{
  initNav();
  initLogin();
  initDaftar();
  initKatalog();
  initBooking();
  initPembayaran();
  initStruk();
  initTiket();

  // Selalu mulai dari halaman login, URL tetap bersih tanpa hash.
  goTo("login");
});
# 🎭 SP-PPT — Sistem Penilaian & Manajemen Proyek Produksi Teater
### SMP Negeri 10 Samarinda — Kelas IX

Platform web terpadu untuk penilaian multi-peran, manajemen alur kerja produksi, presensi terkendali, jadwal, tenggat waktu (deadline) berbasis hitung mundur real-time, dan koordinasi teater siswa Kelas IX SMP Negeri 10 Samarinda.

---

## 📋 1. Tentang SP-PPT
SP-PPT dibangun untuk menjawab kompleksitas pembelajaran Seni Teater kelas IX. Produksi teater bukan sekadar pementasan hari-H di atas panggung, melainkan proses kolaborasi panjang: perencanaan, manajemen 7 divisi artistik & manajemen, latihan rutin, pembuatan properti, tata rias, tata busana, tata musik, dan evaluasi pasca produksi.

**Spesifikasi Lembaga:**
- **Sekolah:** SMP Negeri 10 Samarinda
- **Mata Pelajaran:** Seni Budaya (Seni Teater)
- **Tahun Ajaran:** 2025/2026
- **Pengampu:** Fikri Rahman, S.Pd.

---

## ✨ 2. Fitur Utama

### 🔐 Multi-Role Access Control (21 Peran)
- **Guru Pembina (Super Admin):** Pengawasan seluruh kelas, moderasi penilaian (bobot 50%), kunci/buka tahap penilaian.
- **Pimpinan Produksi (Pimprod):** Pemantauan progres 6 divisi, komando produksi, broadcast darurat, pembuatan sesi absensi pleno/lintas divisi, penyusunan LPJ.
- **Sekretaris:** Presensi harian, manajemen dokumen naskah, notulen rapat, kompilasi laporan.
- **Bendahara:** Kas produksi, RAB, pencatatan pengeluaran dan nota.
- **Sutradara:** Publikasi visi artistik, casting pemain, penilaian utama aktor, pembuatan absensi latihan *(peserta terkunci otomatis: Pemeran + Tata Musik)*.
- **Asisten Sutradara:** Prompt book 3x3 blocking panggung, cue sheet audio/lighting, catatan latihan harian.
- **Koordinator 6 Divisi (Perlengkapan, Pubdok, Panggung, Rias, Busana, Musik):** Pembagian tugas anggota, pembuatan absensi & jadwal internal *(peserta terkunci otomatis ke anggota divisinya)*, penilaian anggota.
- **Anggota Divisi & Pemain:** Unggah bukti tugas, konfirmasi kehadiran, penilaian rekan sejawat (peer assessment), latihan dialog 10 langkah, studio rekam vokal mandiri.

### 📊 Sistem Penilaian Multi-Penilai
- **Formula Bobot:**
  $$\text{Nilai Akhir} = (\text{Guru} \times 50\%) + (\text{Ketua/Pimprod} \times 30\%) + (\text{Rekan Sejawat} \times 20\%)$$
- **Skala 1-4 & Konversi 100:**
  - 1 = Kurang (40)
  - 2 = Cukup (60)
  - 3 = Baik (80)
  - 4 = Sangat Baik (100)
- **Komentar Wajib:** Otomatis wajib diisi jika nilai $\le 2$ (Kurang/Cukup) untuk pembinaan siswa.
- **Kriteria Khusus Pemain (6 Kriteria):** Hafalan Dialog (20%), Penjiwaan Karakter (25%), Proyeksi Suara & Intonasi (15%), Blocking & Movement (15%), Interaksi Panggung (15%), Kedisiplinan (10%).
- **Kriteria Umum Non-Pemain (5 Kriteria):** Kerja Sama Tim (25%), Tanggung Jawab (25%), Kehadiran & Disiplin (20%), Kreativitas (15%), Keahlian Teknis (15%).
- **Predikat Resmi:**
  - 90–100 = A (Mahir)
  - 80–89  = B (Kompeten)
  - 70–79  = C (Memenuhi Standar)
  - 60–69  = D (Perlu Perbaikan)
  - < 60   = E (Tidak Memenuhi)

### ⏱️ Sistem Deadline & Countdown Real-Time
- Penghitungan sisa waktu dinamis (*countdown timer*):
  - Normal (> 72 jam)
  - Warning / Kuning (24–72 jam)
  - Danger / Merah Berkedip (< 24 jam)
  - **OVERDUE** otomatis jika melewati batas waktu dan belum disetujui (`status != APPROVED`).
- Pengiriman bukti kerja (tautan Google Drive/foto + catatan progres).
- Verifikasi dan penilaian oleh guru/koordinator (Approved / Revision / In Progress).

### ✋ Presensi Terkendali
- Pencegahan sesi fiktif melalui hak pembuatan terkunci otomatis sesuai wewenang.
- Status kehadiran: Hadir, Izin, Sakit, Alpa.
- Siswa dapat melakukan check-in mandiri saat sesi dibuka.

### 🎭 Studio Teater Interaktif
- **3x3 Stage Blocking Grid:** Penataan visual letak aktor pada 9 zona panggung (*Upstage Left/Center/Right, Center Stage, Downstage*).
- **Perekam Audio Dialog:** Menggunakan HTML5 MediaRecorder API untuk evaluasi artikulasi dan intonasi vokal.
- **Naskah Digital:** Pembaca naskah lakon adaptasi folklor Kalimantan Timur *"Legenda Danau Lipan"*.
- **Timer Simulasi Quick Change & Dry Run:** Target pergantian busana < 2 menit, target pemasangan panggung 10 menit, strike panggung 5 menit.

### 📱 Komunikasi & Integrasi WhatsApp
- Direktori kerabat kerja dengan tautan chat WhatsApp otomatis (`wa.me`) berpesan salam pembuka terisi.
- Penerusan aduan siswa langsung ke WhatsApp Guru Pembina.

---

## 📂 3. Struktur Folder

```
sp-ppt/
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Pages CI/CD workflow
├── public/
│   ├── favicon.svg              # Logo vektor teater
│   └── manifest.webmanifest     # Konfigurasi PWA installable
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginModal.tsx   # Login multi-tab (Siswa, Guru, Admin) & registrasi
│   │   ├── common/
│   │   │   ├── Navbar.tsx       # Header, kelas switcher, role switcher simulasi
│   │   │   ├── Sidebar.tsx      # Navigasi samping & drawer mobile
│   │   │   └── Toast.tsx        # Sistem notifikasi toast
│   │   └── modules/
│   │       ├── DashboardModule.tsx     # Beranda terpadu per peran
│   │       ├── AssessmentModule.tsx    # Mesin penilaian multi-penilai & ekspor
│   │       ├── AttendanceModule.tsx    # Presensi digital terkunci per hak peran
│   │       ├── TaskDeadlineModule.tsx  # Checklist tugas & countdown deadline
│   │       ├── ScheduleModule.tsx      # Agenda kalender & konfirmasi hadir
│   │       ├── StructureModule.tsx     # Struktur 7 divisi & direktori WhatsApp
│   │       ├── StudioModule.tsx        # 3x3 blocking grid, naskah, perekam vokal
│   │       ├── BroadcastModule.tsx     # Pengumuman siaran massal
│   │       ├── DocumentModule.tsx      # Arsip proposal, naskah, LPJ, keuangan
│   │       ├── ComplaintModule.tsx     # Aduan, konseling, & forward ke WA guru
│   │       ├── GuideModule.tsx         # Panduan operasional & FAQ
│   │       └── SettingsModule.tsx      # Pengaturan bobot, profil, & reset data
│   ├── core/
│   │   ├── authContext.tsx      # State otentikasi & matriks wewenang peran
│   │   ├── constants.ts         # Konfigurasi warna, kriteria, & aset resmi
│   │   ├── firebase.ts          # Inisialisasi Firebase SDK & error handler
│   │   ├── seedData.ts          # Data awal produksi & akun demo SMPN 10
│   │   └── types.ts             # Definisi TypeScript komprehensif
│   ├── services/
│   │   └── firestoreService.ts  # CRUD Firestore dengan penanganan error
│   ├── App.tsx                  # Layout utama & modular router
│   ├── index.css                # Tailwind CSS v4 styling
│   └── main.tsx                 # Entry point aplikasi
├── firebase-blueprint.json      # Skema IR blueprint Firestore
├── firestore.rules              # Aturan keamanan Cloud Firestore
├── index.html                   # HTML entry point ber-metadata resmi
├── package.json
├── tsconfig.json
└── vite.config.ts               # Vite configuration (base: './' untuk GitHub Pages)
```

---

## 🚀 4. Instalasi & Menjalankan Aplikasi

### Kebutuhan Sistem:
- Node.js versi 18 atau 20+
- npm atau bun

### Langkah-langkah:
1. **Clone repositori:**
   ```bash
   git clone https://github.com/username/sp-ppt.git
   cd sp-ppt
   ```

2. **Instal dependensi:**
   ```bash
   npm install
   ```

3. **Jalankan development server:**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

4. **Kompilasi (Build Production):**
   ```bash
   npm run build
   ```

5. **Uji Pratinjau Build (Preview):**
   ```bash
   npm run preview
   ```

---

## 🌐 5. Deployment ke GitHub Pages

Proyek ini telah dikonfigurasi sepenuhnya untuk GitHub Pages:
- `vite.config.ts` menggunakan `base: './'` sehingga semua asset script dan style dimuat secara relatif tanpa error 404.
- Alur kerja GitHub Actions telah disediakan di `.github/workflows/deploy.yml`.
- Menggunakan state routing modular yang aman saat halaman di-refresh pada hosting statis seperti GitHub Pages.

### Cara Mengaktifkan di Repositori GitHub:
1. Push kode ke repositori GitHub:
   ```bash
   git add .
   git commit -m "feat: complete SP-PPT release"
   git push origin main
   ```
2. Buka **Settings** repositori di GitHub.
3. Masuk ke menu **Pages** di sebelah kiri.
4. Pada bagian **Build and deployment > Source**, pilih **GitHub Actions**.
5. Workflow akan otomatis melakukan build dan aplikasi dapat diakses di `https://<username>.github.io/<repo-name>/`.

---

## 🛡️ 6. Keamanan & Firestore Security Rules
Aturan keamanan diterapkan di `firestore.rules`:
- Pembatasan akses baca dan tulis berbasis UID akun terverifikasi.
- Larangan menilai diri sendiri (*anti self-assessment guard*).
- Penilaian hanya dapat diubah oleh Guru Pembina setelah status final dikunci.
- Pencegahan pemalsuan peran (*role spoofing guard*).

---

## 👥 7. Akun Demo untuk Pengujian Cepat
Gunakan pemilih peran cepat di navbar atas atau klik tombol 1-klik di modal login:
- **Guru Pembina:** `fikriya90@gmail.com` (Fikri Rahman, S.Pd.)
- **Pimpinan Produksi:** `pimprod.ix@smpn10.sch.id` (Ahmad Fauzan)
- **Sutradara:** `sutradara.ix@smpn10.sch.id` (Bima Satria)
- **Asisten Sutradara:** `asisten.ix@smpn10.sch.id` (Dinda Permata)
- **Pemeran Ratu Aji:** `ratu.aji@smpn10.sch.id` (Siti Nurhaliza)
- **Sekretaris:** `sekretaris.ix@smpn10.sch.id` (Nadia Az-Zahra)
- **Bendahara:** `bendahara.ix@smpn10.sch.id` (Kevin Aditya)
- **Koordinator Perlengkapan:** `kor.perlengkapan@smpn10.sch.id` (Rizky Mahendra)
- **Koordinator Tata Musik:** `kor.musik@smpn10.sch.id` (Bayu Wibisono)
- **Koordinator Tata Busana:** `kor.busana@smpn10.sch.id` (Alya Salsabila)

---
*SP-PPT © 2026 SMP Negeri 10 Samarinda. Hak cipta dilindungi undang-undang.*

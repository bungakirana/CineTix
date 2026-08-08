<?php
// =========================================================
// FILE KONEKSI KE DATABASE
// File ini tidak dipanggil langsung dari browser, tapi
// di-include oleh file PHP lain yang butuh akses database
// (misalnya get_movies.php)
// =========================================================

$host = "localhost";   // alamat server MySQL (di XAMPP selalu localhost)
$user = "root";        // username default XAMPP
$pass = "";            // password default XAMPP (kosong)
$dbname = "cinetix";   // nama database yang tadi kita import

// Bikin koneksi ke MySQL
$conn = new mysqli($host, $user, $pass, $dbname);

// Kalau koneksi gagal, hentikan dan tampilkan pesan error
if ($conn->connect_error) {
    die(json_encode([
        "success" => false,
        "message" => "Koneksi database gagal: " . $conn->connect_error
    ]));
}

// Set karakter UTF-8 biar teks Indonesia (é, dsb) tidak rusak
$conn->set_charset("utf8mb4");
?>
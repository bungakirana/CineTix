<?php
// =========================================================
// GET_MOVIES.PHP
// File ini BISA dibuka langsung dari browser untuk dites:
// http://localhost/cinetix/api/get_movies.php
//
// Fungsinya: ambil semua data film dari tabel 'movies',
// lalu keluarkan dalam format JSON supaya nanti bisa dibaca
// oleh JavaScript (script.js) pakai fetch().
// =========================================================

header("Content-Type: application/json");   // kasih tau browser: ini JSON, bukan HTML biasa
require "db_connect.php";                    // sambung ke database (file di atas)

// Ambil semua baris dari tabel movies
$result = $conn->query("SELECT * FROM movies");

$movies = [];  // array kosong buat nampung hasil

// Loop tiap baris hasil query, masukkan ke array $movies
while ($row = $result->fetch_assoc()) {
    $movies[] = $row;
}

// Keluarkan sebagai JSON, rapi (pretty print) biar gampang dibaca
echo json_encode([
    "success" => true,
    "data" => $movies
], JSON_PRETTY_PRINT);

$conn->close();
?>
<?php
// =========================================================
// SAVE_BOOKING.PHP
// File ini menerima data booking dari script.js (lewat fetch POST)
// lalu menyimpannya ke tabel 'bookings' di database.
// =========================================================

header("Content-Type: application/json");
require "db_connect.php";

// Ambil data yang dikirim dari JavaScript (format JSON)
$input = json_decode(file_get_contents("php://input"), true);

// Validasi sederhana: pastikan data penting ada
if (!$input || empty($input['movie']) || empty($input['seats'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Data booking tidak lengkap"]);
    exit;
}

// Ambil tiap nilai dari data yang dikirim, kasih nilai default kalau kosong
$booker  = $input['booker']  ?? 'Pengguna';
$movie   = $input['movie']   ?? '-';
$cinema  = $input['cinema']  ?? 'Bioskop CineTix';
$date    = $input['date']    ?? '-';
$time    = $input['time']    ?? '-';
$seats   = $input['seats']   ?? '-';
$count   = $input['seatCount'] ?? 1;
$total   = $input['total']   ?? 0;

// Query INSERT pakai prepared statement (lebih aman dari SQL injection)
$stmt = $conn->prepare(
    "INSERT INTO bookings (booker_name, movie_title, cinema_name, show_date, show_time, seats, seat_count, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid')"
);
$stmt->bind_param("ssssssii", $booker, $movie, $cinema, $date, $time, $seats, $count, $total);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Booking berhasil disimpan", "id" => $stmt->insert_id]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Gagal simpan: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
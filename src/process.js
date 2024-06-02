import { PDFDocument } from 'pdf-lib';
import { ec as EC } from 'elliptic';
import { blake2b } from 'blakejs';

const ec = new EC('p256');




document.addEventListener('DOMContentLoaded', async function () {
    const pdfInput = document.getElementById('pdfInput');
    const messageInput = document.getElementById('messageInput');
    const signPdfVisible = document.getElementById('signPdfVisible');
    const signPdfInvisible = document.getElementById('signPdfInvisible');
    const verifyPdfButton = document.getElementById('verifyPdf');
    console.log(document.getElementById('verifyPdf')); // Harus menampilkan elemen, bukan null

    const closeButton = document.querySelector('.close-button');
    if (closeButton) {
        closeButton.addEventListener('click', hidePopup);
    } else {
        console.error('Tombol close tidak ditemukan');
    }

    // Generate keys
    const keyPair = ec.genKeyPair();

    const container = document.getElementById('bubble-container');
    const maxBubbles = 15; // Maksimal jumlah gelembung yang diizinkan secara bersamaan
    let bubbleCount = 0; // Menghitung jumlah gelembung saat ini

    function createBubble() {
        if (bubbleCount >= maxBubbles) return; // Jangan buat gelembung baru jika batas tercapai

        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        bubble.style.left = `${Math.random() * 100}%`; // Posisi horizontal random
        bubble.style.width = `50px`; // Lebar kotak
        bubble.style.height = `50px`; // Tinggi kotak
        bubble.style.animationDuration = `${Math.random() * 4 + 1}s`; // Durasi animasi random

        container.appendChild(bubble);
        bubbleCount++; // Tambahkan ke hitungan gelembung

        bubble.addEventListener('animationend', function () {
            bubble.remove();
            bubbleCount--; // Kurangi hitungan gelembung saat dihapus
        });
    }


    setInterval(createBubble, 450);

    pdfInput.addEventListener('change', async function (event) {
        const file = event.target.files[0];
        if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pdfViewer = document.getElementById('pdfViewer');
            const pdfDataUri = await pdfDoc.saveAsBase64({ dataUri: true });
            pdfViewer.src = pdfDataUri;
            console.log('PDF berhasil dimuat dan ditampilkan.');
        } else {
            console.error('File yang diunggah bukan PDF.');
            showPopup("File yang diunggah bukan PDF.");
        }
    });

    if (signPdfVisible) {
        signPdfVisible.addEventListener('click', async function () {
            const message = messageInput.value;
            const signature = signData(keyPair, message);
            const now = new Date();
            const formattedDate = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`; // Format tanggal

            const file = pdfInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm() || pdfDoc.createForm();

            let signatureField;
            try {
                signatureField = form.getTextField('signatureField');
                showPopup("PDF Sudah Ada Tanda Tangan Didalamnya");
                return;
            } catch (error) {
                signatureField = form.createTextField('signatureField');
                signatureField.addToPage(pdfDoc.getPages()[0], { x: 50, y: 50, width: 100, height: 25 });
            }

            // Menyimpan tanda tangan dan timestamp
            signatureField.setText(`${signature} (Signed on ${formattedDate})`);
            console.log('Tanda tangan dan timestamp ditambahkan ke PDF.');

            const pdfBytes = await pdfDoc.save();
            download(pdfBytes, "signed_document.pdf", "application/pdf");
            showPopup(`PDF ditandatangani pada ${formattedDate} dan diunduh.`);
            downloadPublicKey(keyPair.getPublic('hex'));
        });
    }

    if (signPdfInvisible) {
        signPdfInvisible.addEventListener('click', async function () {
            const message = messageInput.value;
            const signature = signData(keyPair, message);
            const now = new Date();
            const formattedDate = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`; // Format tanggal

            const file = pdfInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm() || pdfDoc.createForm();

            let signatureField;
            try {
                signatureField = form.getTextField('signatureField');
                showPopup("PDF Sudah Ada Tanda Tangan Didalamnya");
                return;
            } catch (error) {
                signatureField = form.createTextField('signatureField');
                signatureField.addToPage(pdfDoc.getPages()[0], { x: 0, y: 0, width: 0.0001, height: 0.0001 });
            }

            // Menyimpan tanda tangan dan timestamp
            signatureField.setText(`${signature} (Signed on ${formattedDate})`);
            console.log('Tanda tangan dan timestamp ditambahkan ke PDF.');

            const pdfBytes = await pdfDoc.save();
            download(pdfBytes, "signed_document.pdf", "application/pdf");
            showPopup(`PDF ditandatangani pada ${formattedDate} dan diunduh.`);
            downloadPublicKey(keyPair.getPublic('hex'));
        });
    }

    if (verifyPdfButton) {
        verifyPdfButton.addEventListener('click', async function () {
            console.log("Verify Ditekan");
            const publicKeyFile = document.getElementById('publicKeyInput').files[0];
            if (!publicKeyFile) {
                showPopup("Silakan unggah kunci publik.");
                return;
            }
    
            const message = messageInput.value;
            const file = pdfInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
    
            // Ensure the PDF has a form
            const form = pdfDoc.getForm();
            if (!form) {
                console.error('PDF tidak memiliki form.');
                showPopup("PDF tidak memiliki form.");
                return;
            }
    
            // Try to retrieve the signature from the form field
            let signatureField;
            try {
                signatureField = form.getTextField('signatureField');
                const signatureText = signatureField.getText();
                const signatureParts = signatureText.split(' (Signed on ');
                const signature = signatureParts[0];
                const formattedDate = signatureParts[1].slice(0, -1); // Menghapus karakter ')' di akhir

                console.log('Tanda tangan dari anotasi PDF:', signature);
                console.log('Timestamp:', formattedDate);
                showPopup(`Tanda tangan ditemukan: ${signature}. Ditandatangani pada: ${formattedDate}`);

                // Inisialisasi FileReader
                const reader = new FileReader();
                reader.onload = async function (e) {
                    const publicKeyPEM = e.target.result;
                    const publicKeyHex = publicKeyPEM.replace('-----BEGIN PUBLIC KEY-----', '')
                        .replace('-----END PUBLIC KEY-----', '')
                        .replace(/\s+/g, ''); // Menghapus semua whitespace
    
                    console.log('Public Key Hex:', publicKeyHex); // Debug: Log kunci publik
    
                    const isValid = await verifySignature(publicKeyHex, signature, message);
                    if (isValid) {
                        console.log('Verifikasi tanda tangan berhasil, tanda tangan valid.');
                        showPopup(`Verifikasi tanda tangan berhasil, tanda tangan valid. Dengan Bukti Kepemilikan: ${message}, Ditandatangani pada: ${formattedDate}`);
                    } else {
                        console.log('Verifikasi tanda tangan gagal, tanda tangan tidak valid.');
                        showPopup("Verifikasi tanda tangan gagal, tanda tangan tidak valid.");
                    }
                };
                reader.readAsText(publicKeyFile);
            } catch (error) {
                console.error('Error:', error.message);
                showPopup("PDF tidak memiliki field tanda tangan yang diperlukan.");
            }
        });
    }

});

function signData(keyPair, data) {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hash = blake2b(encoded, null, 32);
    const signature = keyPair.sign(hash);
    return signature.toDER('hex');
}

function verifySignature(publicKeyHex, signatureHex, data) {
    try {
        const key = ec.keyFromPublic(publicKeyHex, 'hex');
        const encoder = new TextEncoder();
        const encoded = encoder.encode(data);
        const hash = blake2b(encoded, null, 32);
        const isValid = key.verify(hash, signatureHex);
        return isValid;
    } catch (error) {
        console.error('Error verifying signature:', error);
        showPopup("Error verifying signature:", error);
    }
}

function download(data, filename, type) {
    const file = new Blob([data], { type: type });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function downloadPublicKey(publicKeyHex) {
    const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyHex}\n-----END PUBLIC KEY-----`;
    const blob = new Blob([publicKeyPEM], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'publicKey.pem';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

// Function to show the popup
function showPopup(popupmessage) {
    document.getElementById('popup-message').textContent = popupmessage;
    document.getElementById('popup').style.display = 'flex';
    document.getElementById('popup').style.opacity = 0;
    setTimeout(() => {
        document.getElementById('popup').style.opacity = 1;
    }, 10); // Start transition after a short delay
}

// Function to hide the popup
function hidePopup() {
    document.getElementById('popup').style.opacity = 0;
    setTimeout(() => {
        document.getElementById('popup').style.display = 'none';
    }, 300); // Delay to allow opacity transition
}

// Close button event
document.querySelector('.close-button').addEventListener('click', hidePopup);
document.querySelector('.close-button').addEventListener('click', hidePopup);
document.querySelector('.close-button').addEventListener('click', hidePopup);
// --- 1. FIREBASE VERİTABANI BAĞLANTISI ---
const firebaseConfig = {
  apiKey: "AIzaSyBa5Qv1N3nJeiowJNmmvMBin9yCX2-AP4M",
  authDomain: "mandalin-suites.firebaseapp.com",
  projectId: "mandalin-suites",
  storageBucket: "mandalin-suites.firebasestorage.app",
  messagingSenderId: "191965011728",
  appId: "1:191965011728:web:a2030aff310a39cb528f95"
};

// Firebase'i Başlat
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Mobil Menü Toggle
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if(hamburger) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Scroll Animasyonları
const observerOptions = { threshold: 0.2 };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach((el) => {
    observer.observe(el);
});


// --- 2. VERİTABANINDAN DOLULUK BİLGİLERİNİ ALIP TAKVİMİ BAŞLATMA ---
const bookedDaysMap = {};
const fullyBookedDates = [];
let flatpickrInstance = null;

// Firebase'deki Onaylı Rezervasyonları Gerçek Zamanlı Dinle
db.collection('onayli_rezervasyonlar').onSnapshot((snapshot) => {
    // Haritayı sıfırla
    for (let key in bookedDaysMap) delete bookedDaysMap[key];
    fullyBookedDates.length = 0;

    snapshot.forEach(doc => {
        let booking = doc.data();
        let currentDate = new Date(booking.checkin);
        let endDate = new Date(booking.checkout);

        // Giriş gününden çıkış gününe kadar olan günleri say (Çıkış günü hariç)
        while (currentDate < endDate) {
            let dateStr = flatpickr.formatDate(currentDate, "Y-m-d");
            bookedDaysMap[dateStr] = (bookedDaysMap[dateStr] || 0) + 1;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    // 7 apartın tamamı dolu olan günleri tespit et
    for (const [dateStr, count] of Object.entries(bookedDaysMap)) {
        if (count >= 7) {
            fullyBookedDates.push(dateStr);
        }
    }

    // Takvimi güncelle veya yeniden başlat
    initOrUpdateCalendar();
});

function initOrUpdateCalendar() {
    const bookingInput = document.getElementById("booking-dates");
    if (!bookingInput) return;

    if (flatpickrInstance) {
        flatpickrInstance.set("disable", fullyBookedDates);
        flatpickrInstance.redraw();
    } else {
        flatpickrInstance = flatpickr("#booking-dates", {
            inline: true,        
            mode: "range",       
            minDate: "today",    
            dateFormat: "Y-m-d",
            locale: "tr",
            disable: fullyBookedDates, 
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                if (dayElem.dateObj >= new Date(new Date().setHours(0,0,0,0))) {
                    let dateString = flatpickr.formatDate(dayElem.dateObj, "Y-m-d");
                    let bookedCount = bookedDaysMap[dateString] || 0;

                    if (bookedCount >= 7) {
                        dayElem.classList.add("fully-booked"); 
                    } else {
                        dayElem.classList.add("available"); 
                    }
                }
            }
        });
    }
}


// --- DİL DEĞİŞTİRME MANTIĞI ---
const btnTr = document.getElementById('btn-tr');
const btnEn = document.getElementById('btn-en');
const elementsToTranslate = document.querySelectorAll('.lang');

if(btnEn && btnTr) {
    btnEn.addEventListener('click', () => {
        setLanguage('en');
        btnEn.classList.add('active');
        btnTr.classList.remove('active');
    });

    btnTr.addEventListener('click', () => {
        setLanguage('tr');
        btnTr.classList.add('active');
        btnEn.classList.remove('active');
    });
}

function setLanguage(lang) {
    elementsToTranslate.forEach(el => {
        if (lang === 'en') {
            el.textContent = el.getAttribute('data-en') || el.textContent;
            if(el.tagName === 'INPUT' && el.type === 'submit') {
                el.value = el.getAttribute('data-en');
            }
        } else {
            el.textContent = el.getAttribute('data-tr') || el.textContent;
             if(el.tagName === 'INPUT' && el.type === 'submit') {
                el.value = el.getAttribute('data-tr');
            }
        }
    });
}


// --- MİSAFİR YORUMLARI SLIDER ---
let slideIndex = 0;
let slideTimer;

function showSlides(index) {
    let slides = document.querySelectorAll('.review-slide');
    let dots = document.querySelectorAll('.dot');
    
    if (slides.length === 0) return; 

    if (index !== undefined) {
        slideIndex = index;
    } else {
        slideIndex++;
    }

    if (slideIndex >= slides.length) slideIndex = 0;
    if (slideIndex < 0) slideIndex = slides.length - 1;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[slideIndex].classList.add('active');
    dots[slideIndex].classList.add('active');

    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => showSlides(), 5000); 
}

window.currentSlide = function(index) {
    showSlides(index);
}

document.addEventListener('DOMContentLoaded', () => {
    showSlides(0);
});


// --- 3. REZERVASYON FORMU GÖNDERİMİ (TELEGRAM BİLDİRİMLİ) ---
const resForm = document.getElementById('reservation-form');
if (resForm) {
    resForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const fpInstance = document.getElementById('booking-dates')._flatpickr;
        const selectedDates = fpInstance.selectedDates;

        if (selectedDates.length !== 2) {
            alert("Lütfen takvim üzerinden hem giriş hem de çıkış tarihinizi seçiniz!");
            return;
        }

        const name = document.getElementById('booking-name').value; 
        const phone = document.getElementById('booking-phone').value;
        const email = document.getElementById('booking-email').value;

        const checkin = flatpickr.formatDate(selectedDates[0], "Y-m-d");
        const checkout = flatpickr.formatDate(selectedDates[1], "Y-m-d");
        const apart = "Genel İstek (Uygun Olan Oda Verilecek)"; 

        // 1. İŞLEM: Firebase'e Kaydet
        db.collection('rezervasyonlar').add({
            ad_soyad: name,
            telefon: phone,
            email: email,
            checkin: checkin,
            checkout: checkout,
            apart: apart,
            durum: "Beklemede",
            zaman: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {

            // --- 2. İŞLEM: TELEGRAM BOTUNA BİLDİRİM GÖNDER (YENİ EKLEME) ---
            const telegramToken = "8127794399:AAHp-gsZnH_V6CNbeN_N1Wml0Xmp1HKz-SI"; // Buraya BotFather'dan aldığın tokeni yapıştır
            const telegramChatId = "8846832477";   // Buraya userinfobot'tan aldığın ID'yi yapıştır
            
            // Telegram'a gidecek mesaj tasarımı (Emoji destekli)
            const telegramMessage = `🚨 *YENİ REZERVASYON İSTEĞİ!* 🚨\n\n` +
                                    `👤 *Müşteri:* ${name}\n` +
                                    `📅 *Giriş:* ${checkin}\n` +
                                    `📅 *Çıkış:* ${checkout}\n` +
                                    `📞 *Telefon:* ${phone}\n` +
                                    `✉️ *E-Posta:* ${email}\n\n` +
                                    `👉 _Lütfen admin panelinden onaylayın veya reddedin._`;

            // Telegram API'sine mesajı fırlatıyoruz
            fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: telegramMessage,
                    parse_mode: "Markdown" // Yazıların kalın/eğik çıkması için
                })
            })
            .then(() => console.log("Telegram bildirimi başarıyla gönderildi."))
            .catch(err => console.error("Telegram gönderme hatası:", err));


            // 3. İŞLEM: E-Posta Gönder (FormSubmit üzerinden)
            fetch("https://formsubmit.co/ajax/mandalinsuitesdatca@gmail.com", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    _subject: "Mandalin Suites - Yeni Rezervasyon İsteği!",
                    _template: "table",
                    "Müşteri Adı": name,
                    "Giriş Tarihi": checkin,
                    "Çıkış Tarihi": checkout,
                    "Telefonu": phone,
                    "E-Postası": email
                })
            })
            .then(response => response.json())
            .then(data => {
                alert("Rezervasyon isteğiniz başarıyla tesise iletilmiştir! En kısa sürede sizinle iletişime geçilecektir.");
                resForm.reset();
                fpInstance.clear();
            })
            .catch(error => {
                console.log("Mail gönderim hatası:", error);
                alert("İsteğiniz sisteme kaydedildi ancak mail sunucusunda bir gecikme yaşandı.");
            });

        }).catch((error) => {
            console.error("Veritabanı hatası: ", error);
            alert("Bir hata oluştu, lütfen daha sonra tekrar deneyin.");
        });
    });
}


// --- 4. YÖNETİCİ GİRİŞ İŞLEMLERİ (FIREBASE KORUMALI) ---
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('admin-login-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeModal = document.querySelector('.close-modal');
    const adminSubmit = document.getElementById('admin-submit');
    const modalContent = document.querySelector('.modal-content');

    // Ayrıca HTML'deki input id'lerinin "Kullanıcı Adı" değil "E-posta" olduğunu varsayıyoruz. 
    // Kullanıcı adı yerine admin@mandalinsuites.com ile giriş yapacağız.

    if(adminBtn && adminModal) {
        
        // Giriş butonuna basıldığında modalı aç
        adminBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            adminModal.style.display = 'flex';
        });

        // Çarpı butonuna basıldığında kapat
        closeModal.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            adminModal.style.display = 'none';
        });

        if (modalContent) {
            ['click', 'touchend', 'mousedown', 'mouseup'].forEach(evt => {
                modalContent.addEventListener(evt, (e) => {
                    e.stopPropagation(); 
                });
            });
        }

        adminModal.addEventListener('click', (e) => {
            if (e.target === adminModal) {
                e.preventDefault();
                e.stopPropagation();
                adminModal.style.display = 'none';
            }
        });

        // Giriş Yap butonuna tıklandığında (FİREBASE KONTROLÜ)
        adminSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            
            const email = document.getElementById('admin-user').value;
            const pass = document.getElementById('admin-pass').value;

            // Şifreyi kodda kontrol etmiyoruz! Google'a soruyoruz:
            firebase.auth().signInWithEmailAndPassword(email, pass)
                .then((userCredential) => {
                    // Şifre doğruysa Google onay verir
                    localStorage.setItem('mandalinAdmin', 'true');
                    window.location.href = 'admin.html';
                })
                .catch((error) => {
                    // Şifre yanlışsa hata fırlatır
                    alert('Hatalı e-posta veya şifre! Lütfen tekrar deneyin.');
                    console.error("Giriş hatası:", error.message);
                });
        });
    }
});
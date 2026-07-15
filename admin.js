// GÜVENLİK KONTROLÜ (Kalıcı Giriş / Beni Hatırla)
if (localStorage.getItem('mandalinAdmin') !== 'true') {
    alert("Yetkisiz erişim! Lütfen ana sayfadan giriş yapınız.");
    window.location.href = 'index.html';
}

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

// Global Değişkenler
const apartList = ["Apart 1", "Apart 2", "Apart 3", "Apart 4", "Apart 5", "Apart 6", "Apart 7"];
let globalApprovedList = []; // Veritabanından çekilen onaylı rezervasyonları burada tutacağız

// Sayfa Yüklendiğinde Verileri Gerçek Zamanlı Dinlemeye Başla
document.addEventListener('DOMContentLoaded', () => {
    listenToFirebase();
});

// --- 2. FIREBASE REALTIME DİNLEME ---
function listenToFirebase() {
    // A) Onaylı Rezervasyonları & Manuel Kilitleri Dinle
    db.collection('onayli_rezervasyonlar').onSnapshot((snapshot) => {
        globalApprovedList = [];
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id; // Belge kimliğini (ID) silme/güncelleme işlemleri için sakla
            globalApprovedList.push(data);
        });
        
        loadApprovedBookings(); // Tabloyu güncelle
        loadCalendars();        // Takvimleri güncelle ve renkleri yenile
    });

    // B) Gelen (Beklemede Olan) Rezervasyon İsteklerini Dinle
    db.collection('rezervasyonlar').where("durum", "==", "Beklemede")
      .onSnapshot((snapshot) => {
        let requests = [];
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;
            requests.push(data);
        });
        renderRequests(requests); // Gelen istek kutularını ekrana çiz
    });
}

// Bir günün dolu olup olmadığını kontrol eden yardımcı fonksiyon
function isDayBooked(apart, dateStr) {
    const dTime = new Date(dateStr).getTime();
    for (let b of globalApprovedList) {
        if (b.apart === apart) {
            let inTime = new Date(b.checkin).getTime();
            let outTime = new Date(b.checkout).getTime();
            if (dTime >= inTime && dTime < outTime) return true;
        }
    }
    return false;
}

// Bir günün dolu olup olmadığını ve kimin dolu olduğunu bulan fonksiyon
function getBookingForDay(apart, dateStr) {
    const dTime = new Date(dateStr).getTime();
    for (let b of globalApprovedList) {
        if (b.apart === apart) {
            let inTime = new Date(b.checkin).getTime();
            let outTime = new Date(b.checkout).getTime();
            // Giriş ile çıkış tarihi arasındaki TÜM GÜNLER (çıkış günü hariç) bu şarta uyar.
            // 5 günlük rezervasyonsa, 5 günün her biri için bu fonksiyon o müşteriyi döndürür.
            if (dTime >= inTime && dTime < outTime) return b;
        }
    }
    return null;
}

function isDayBooked(apart, dateStr) {
    return getBookingForDay(apart, dateStr) !== null;
}

// --- 3. 6 AYRI TAKVİMİ VE İŞLEM BUTONLARINI OLUŞTUR ---
function loadCalendars() {
    const container = document.getElementById('calendars-container');
    container.innerHTML = ''; 

    apartList.forEach((apartName, i) => {
        const inputId = `cal-input-${i}`;
        
        const box = document.createElement('div');
        box.className = 'cal-box';
        box.innerHTML = `
            <h3>${apartName}</h3>
            <input type="text" id="${inputId}" style="display:none;">
            <div class="cal-actions">
                <button class="btn-make-full" onclick="markAsFull('${apartName}', '${inputId}')"><i class="fas fa-lock"></i> Dolu Yap</button>
                <button class="btn-make-empty" onclick="markAsEmpty('${apartName}', '${inputId}')"><i class="fas fa-unlock"></i> Boşa Çevir</button>
            </div>
        `;
        container.appendChild(box);

        flatpickr(`#${inputId}`, {
            inline: true,
            mode: "multiple",
            dateFormat: "Y-m-d",
            locale: "tr",
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                let dateString = flatpickr.formatDate(dayElem.dateObj, "Y-m-d");
                
                // Eğer o gün (örneğin 5 günün 3. günü) doluysa, müşteriyi bul
                let booking = getBookingForDay(apartName, dateString);
                
                if (booking) {
                    dayElem.classList.add("admin-booked");
                    
                    // Veritabanındaki ismi al (Farklı formatlardaki kayıtları engellemek için)
                    let displayName = booking.ad_soyad || booking.name || "Dolu";
                    if (displayName === "🔒 Manuel Kapatıldı") displayName = "Dolu";
                    
                    // Sadece ilk ismi alalım (Kutuya daha şık sığması için, Örn: "Ahmet Yılmaz" -> "Ahmet")
                    let firstName = displayName.split(" ")[0]; 
                    
                    // Günün orijinal numarasını (Örn: 15) yakala
                    let dayNum = dayElem.innerHTML; 
                    
                    // KUTUNUN İÇİNİ YENİDEN İNŞA ET: Üstte numara, altta isim
                    dayElem.innerHTML = `
                        <span class="day-num">${dayNum}</span>
                        <span class="guest-name-label">${firstName}</span>
                    `;
                }
            }
        });
    });
}

// --- 4. SEÇİLİ GÜNLERİ DOLU YAP (İSİM SORMA ÖZELLİKLİ) ---
window.markAsFull = function(apartName, inputId) {
    const fp = document.getElementById(inputId)._flatpickr;
    const selected = fp.selectedDates;
    
    if (selected.length === 0) {
        alert("Lütfen takvim üzerinden doluya çevirmek istediğiniz günleri tıklayarak seçin.");
        return;
    }

    let guestName = prompt("Bu rezervasyon için bir isim veya not girin:\n(Boş bırakırsanız sadece 'Dolu' olarak işaretlenir)", "");
    
    if (guestName === null) return; 
    if (guestName.trim() === "") guestName = "🔒 Manuel Kapatıldı";

    const promises = [];
    selected.forEach(sd => {
        let dStr = flatpickr.formatDate(sd, "Y-m-d");
        
        if (!isDayBooked(apartName, dStr)) {
            let nextDay = new Date(sd);
            nextDay.setDate(nextDay.getDate() + 1);
            
            let promise = db.collection('onayli_rezervasyonlar').add({
                ad_soyad: guestName, 
                apart: apartName,
                checkin: dStr,
                checkout: flatpickr.formatDate(nextDay, "Y-m-d"),
                phone: "-",
                email: "-",
                zaman: firebase.firestore.FieldValue.serverTimestamp()
            });
            promises.push(promise);
        }
    });

    Promise.all(promises).then(() => {
        alert(`${apartName} için seçilen günler '${guestName}' adına kilitlendi.`);
    }).catch(err => {
        console.error("Kilit ekleme hatası:", err);
    });
}

// --- 5. SEÇİLİ GÜNLERİ BOŞA ÇEVİR (KİLİTLERİ KALDIR) ---
window.markAsEmpty = function(apartName, inputId) {
    const fp = document.getElementById(inputId)._flatpickr;
    const selected = fp.selectedDates;
    
    if (selected.length === 0) {
        alert("Lütfen takvim üzerinden boşa çıkarmak istediğiniz kırmızı günleri tıklayarak seçin.");
        return;
    }

    if(!confirm(`DİKKAT: Seçilen günlere denk gelen tüm rezervasyonlar (müşteri rezervasyonları dahil) ${apartName} için tamamen SİLİNECEKTİR. Onaylıyor musunuz?`)) {
        return;
    }

    const deletePromises = [];
    selected.forEach(sd => {
        let t = sd.getTime();
        
        globalApprovedList.forEach(b => {
            if (b.apart === apartName) {
                let inTime = new Date(b.checkin).getTime();
                let outTime = new Date(b.checkout).getTime();
                
                // Eğer seçilen gün bu rezervasyonun aralığına giriyorsa Firebase'den sil
                if (t >= inTime && t < outTime) {
                    let p = db.collection('onayli_rezervasyonlar').doc(b.id).delete();
                    deletePromises.push(p);
                }
            }
        });
    });

    Promise.all(deletePromises).then(() => {
        alert(`${apartName} için seçilen günlerdeki rezervasyonlar başarıyla kaldırıldı.`);
    }).catch(err => {
        console.error("Silme hatası: ", err);
    });
}

// --- 6. GELEN İSTEKLERİ EKRANA YAZDIR ---
function renderRequests(requests) {
    const requestsDiv = document.getElementById('incoming-requests');

    if (requests.length === 0) {
        requestsDiv.innerHTML = '<p style="color: #666; padding: 15px; background: #fff; border: 1px solid #ddd; border-radius: 6px;">Şu anda onay bekleyen yeni rezervasyon isteği yok.</p>';
        return;
    }

    requestsDiv.innerHTML = '';
    requests.forEach((req, index) => {
        const customerName = req.ad_soyad ? req.ad_soyad : 'Belirtilmemiş';
        
        let selectHtml = `<select id="assign-apart-${req.id}">`;
        apartList.forEach(ap => {
            selectHtml += `<option value="${ap}">${ap}</option>`;
        });
        selectHtml += `</select>`;

        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
            <div class="request-info">
                <strong>👤 ${customerName}</strong><br>
                📅 Giriş: <strong>${formatDate(req.checkin)}</strong> | Çıkış: <strong>${formatDate(req.checkout)}</strong><br>
                📞 Tel: ${req.phone || req.telefon} | ✉️ Mail: ${req.email}
            </div>
            <div class="request-actions">
                <label style="font-size:0.8rem; color:#555;">Apart Ata:</label>
                ${selectHtml}
                <button class="btn-approve" onclick="approveRequest('${req.id}', '${customerName}', '${req.checkin}', '${req.checkout}', '${req.phone || req.telefon}', '${req.email}')">✅ ONAYLA</button>
                <button class="btn-reject" onclick="deleteRequest('${req.id}')">❌ REDDET</button>
            </div>
        `;
        requestsDiv.appendChild(card);
    });
}

// --- 7. İSTEĞİ ONAYLA VE APARTA ATA ---
window.approveRequest = function(id, name, checkin, checkout, phone, email) {
    const selectedApart = document.getElementById(`assign-apart-${id}`).value;
    
    let isConflict = false;
    globalApprovedList.forEach(booking => {
        if (booking.apart === selectedApart) {
            if ((checkin >= booking.checkin && checkin < booking.checkout) || 
                (checkout > booking.checkin && checkout <= booking.checkout) ||
                (checkin <= booking.checkin && checkout >= booking.checkout)) {
                isConflict = true;
            }
        }
    });

    if (isConflict) {
        alert(`HATA! Seçtiğiniz '${selectedApart}' bu tarihlerde zaten dolu. Lütfen müşteriye başka bir apart atayın.`);
        return; 
    }

    // 1. Onaylılar koleksiyonuna ekle
    db.collection('onayli_rezervasyonlar').add({
        name: name,
        apart: selectedApart,
        checkin: checkin,
        checkout: checkout,
        phone: phone,
        email: email,
        zaman: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // 2. Gelen isteklerden bu talebi kaldır (veya durumunu Onaylandı yap)
        db.collection('rezervasyonlar').doc(id).delete().then(() => {
            alert(`Rezervasyon başarıyla onaylandı. Müşteri ${selectedApart}'a yerleştirildi!`);
        });
    }).catch(err => {
        console.error("Onaylama hatası:", err);
    });
}

// --- 8. İSTEĞİ SİL / REDDET ---
window.deleteRequest = function(id) {
    if(confirm('Bu rezervasyon isteğini tamamen silmek istediğinize emin misiniz?')) {
        db.collection('rezervasyonlar').doc(id).delete().then(() => {
            alert("İstek başarıyla silindi.");
        }).catch(err => {
            console.error("İstek silinirken hata oluştu:", err);
        });
    }
}

// --- 9. ONAYLANMIŞ REZERVASYON LİSTESİNİ GÖSTER ---
function loadApprovedBookings() {
    const tbody = document.getElementById('approved-bookings');
    tbody.innerHTML = '';
    
    if (globalApprovedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">Henüz dolu oda kaydı yok.</td></tr>';
        return;
    }

    globalApprovedList.forEach((book) => {
        const customerName = book.name ? book.name : 'Belirtilmemiş';
        const phoneData = book.phone !== "-" ? `<br>📞 ${book.phone}` : "";
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${book.apart}</strong></td>
            <td>👤 ${customerName} ${phoneData}</td>
            <td>${formatDate(book.checkin)}</td>
            <td>${formatDate(book.checkout)}</td>
            <td><button class="btn-reject" style="padding: 5px 10px;" onclick="deleteApproved('${book.id}')">Boşalt / İptal</button></td>
        `;
        tbody.appendChild(row);
    });
}

// --- 10. ONAYLI REZERVASYONU İPTAL ETME ---
window.deleteApproved = function(id) {
    if(confirm('Bu rezervasyonu iptal edip odayı tekrar BOŞA çıkarmak istiyor musunuz?')) {
        db.collection('onayli_rezervasyonlar').doc(id).delete().then(() => {
            alert("Rezervasyon başarıyla iptal edildi.");
        }).catch(err => {
            console.error("İptal hatası:", err);
        });
    }
}

// Tarih Formatlama yardımcı fonksiyonu
function formatDate(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}
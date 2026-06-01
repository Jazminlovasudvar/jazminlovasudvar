// =======================================================
// JÁZMIN LOVASUDVAR - INTEGRÁLT MECHANIKUS ADMIN LOGIKA
// =======================================================

const SUPABASE_URL = "https://ktzlczqhqnuluyuedhot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0emxjenFocW51bHV5dWVkaG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjgxMjEsImV4cCI6MjA5NDEwNDEyMX0.yfNCvcMbSIWcrmyInCQo-1LX7Z4w5kT5drNxe6kfBSk";

const BOOKINGS_API = SUPABASE_URL + "/rest/v1/bookings";
const HOLIDAYS_API = SUPABASE_URL + "/rest/v1/school_holidays";
const EDGE_URL = SUPABASE_URL + "/functions/v1/Send-email";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let adatok = [];
let authHeaders = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json"
};

// ── Inicializáció oldalbetöltéskor ──
document.addEventListener('DOMContentLoaded', async () => {
    // Kézi időpontválasztó legördülő generálása
    const select = document.getElementById('qTime');
    if (select) {
        for (let t = 480; t <= 1170; t += 30) {
            let h = Math.floor(t / 60).toString().padStart(2, '0');
            let m = (t % 60).toString().padStart(2, '0');
            let opt = document.createElement('option');
            opt.value = opt.innerText = `${h}:${m}`;
            select.appendChild(opt);
        }
    }
    
    if (document.getElementById('qDate')) {
        document.getElementById('qDate').valueAsDate = new Date();
    }

    // Enter billentyű figyelése jelszómezőn
    const passwordInput = document.getElementById('p');
    if (passwordInput) {
        passwordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') belep();
        });
    }

    // Kijelentkezés gomb feliratkozás
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = kijelentkezes;
    }

    // Supabase munkamenet (Session) ellenőrzése
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        authHeaders["Authorization"] = "Bearer " + session.access_token;
        mutassAdminPanelt();
    }
});

// ── Bejelentkezés Supabase Auth-hal ──
async function belep() {
    const email = document.getElementById('u').value.trim();
    const password = document.getElementById('p').value;
    const btn = document.querySelector('#loginBox button');
    
    if (!email || !password) return alert("Kérlek töltsd ki a mezőket!");
    
    btn.textContent = "Belépés...";
    btn.disabled = true;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        alert("❌ Hibás e-mail vagy jelszó!");
        btn.textContent = "BELÉPÉS";
        btn.disabled = false;
        return;
    }

    authHeaders["Authorization"] = "Bearer " + data.session.access_token;
    mutassAdminPanelt();
}

function mutassAdminPanelt() {
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    loadAllBookings();
    loadHolidays();
}

async function kijelentkezes(e) {
    if(e) e.preventDefault();
    await sb.auth.signOut();
    location.reload();
}

// ── Foglalások lekérése ──
async function loadAllBookings() {
    const tbody = document.getElementById('lista');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:30px;">⏳ Betöltés...</td></tr>';
    
    try {
        const resp = await fetch(BOOKINGS_API + "?order=date.desc,start_time.asc&select=*", { headers: authHeaders });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        adatok = await resp.json();
        renderTable(adatok);
    } catch(e) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="color:red;padding:20px;">Hiba a betöltéskor: ' + e.message + '</td></tr>';
        console.error(e);
    }
}

// ── Táblázat generálása rácsmentes zebra stílusban ──
function renderTable(d) {
    const tbody = document.getElementById('lista');
    if (!tbody) return;
    
    if (d.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:30px;">Nincs találat</td></tr>';
        return;
    }
    
    tbody.innerHTML = "";
    d.forEach(i => {
        const statusz = (i.status || "AKTÍV").toUpperCase();
        const isZarva = statusz === "ZÁRVA" || i.name === "ZÁRVA";
        const rowId = i.id || '-';
        
        const timeStr = i.start_time !== undefined
            ? String(Math.floor(i.start_time/60)).padStart(2,'0') + ':' + String(i.start_time%60).padStart(2,'0')
            : '';
        const calId = i.calendar_event_id || '';

        tbody.innerHTML += `
            <tr class="${statusz === 'LEMONDVA' ? 'sor-lemondva' : ''}">
                <td><strong>${i.date || ''}</strong></td>
                <td><strong>${isZarva ? 'Egész nap' : timeStr}</strong></td>
                <td><strong>${escapeHtml(i.name)}</strong>${i.phone ? '<br><span style="font-size:11px;color:#999">' + escapeHtml(i.phone) + '</span>' : ''}</td>
                <td style="font-size:12px">${i.email && i.email !== 'ADMIN' ? escapeHtml(i.email) : ''}</td>
                <td>${isZarva ? 'SZÜNNAP' : `<span class="service-badge" style="background:#e0f2f1; color:#004d40; padding:4px 8px; border-radius:4px; font-size:12px;">${escapeHtml(i.service || '—')}</span>`}</td>
                <td class="note-cell" title="${escapeHtml(i.note || '')}">${escapeHtml(i.note || '—')}</td>
                <td><span class="status-pill status-${isZarva ? 'zarva' : statusz.toLowerCase()}">${isZarva ? 'ZÁRVA' : statusz}</span></td>
                <td style="white-space:nowrap;">
                    ${statusz === 'AKTÍV' && !isZarva ?
                        `<button class="btn-orange" onclick="lemond('${rowId}','${escapeHtml(i.email || '')}','${(i.name||'').replace(/'/g,"\\'")}','${i.date}','${timeStr}','${escapeHtml(i.service)}','${calId}')">🌧 Eső</button>` : ''}
                    ${!isZarva ?
                        `<button class="btn-action-delete" onclick="torol('${rowId}','${calId}')">🗑 Törlés</button>` : ''}
                </td>
            </tr>`;
    });
}

// ── Dátumszűrés ──
function szures() {
    const nap = document.getElementById('szuro').value;
    renderTable(nap ? adatok.filter(x => x.date === nap) : adatok);
}

// ── Eső miatti lemondás menetrendje ──
async function lemond(bookingId, email, nev, datum, idopont, szolgi, calendarEventId) {
    if (!confirm("Biztosan lemondod és küldöd az e-mailt " + nev + " részére?")) return;

    try {
        const patchResp = await fetch(BOOKINGS_API + "?id=eq." + bookingId, {
            method: "PATCH",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify({ status: "LEMONDVA" })
        });
        if (!patchResp.ok) throw new Error("Supabase PATCH hiba!");

        // Google Naptár bejegyzés törlése a workeren keresztül
        if (calendarEventId) {
            try {
                await fetch("https://calendar-bot.jazminlovasudvar-gyongyos.workers.dev/", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: calendarEventId })
                });
            } catch(calErr) { console.warn("Naptár bot törlési hiba:", calErr); }
        }

        // Edge e-mail kiküldés lemondás típusra
        if (email && email !== 'ADMIN') {
            const [h, m] = idopont.split(':').map(Number);
            const startMin = h * 60 + m;
            await fetch(EDGE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
                body: JSON.stringify({ type: "cancellation", booking: { name: nev, email, date: datum, start_time: startMin } })
            });
            alert("✅ Sikeresen lemondva, értesítő e-mail elküldve és naptárból törölve!");
        } else {
            alert("✅ Sikeresen lemondva!");
        }
        loadAllBookings();
    } catch(e) {
        alert("❌ Hiba történt: " + e.message);
    }
}

// ── Rekord végleges törlése ──
async function torol(bookingId, calendarEventId) {
    if (!confirm("VÉGLEGESEN törlöd ezt a rekordot? Ez nem vonható vissza!")) return;
    try {
        const resp = await fetch(BOOKINGS_API + "?id=eq." + bookingId, {
            method: "DELETE",
            headers: authHeaders
        });

        if (!resp.ok) {
            // A Supabase/trigger hibaüzenetének kiolvasása
            let hibaUzenet = "Törlési hiba a Supabase-ben.";
            try {
                const errData = await resp.json();
                if (errData && errData.message) {
                    // Ha a trigger blokkolta (kiállított bizonylat)
                    if (errData.message.includes("kiállított") || errData.message.includes("active")) {
                        hibaUzenet = "❌ Ez a foglalás NEM törölhető, mert kiállított (aktív) bizonylat tartozik hozzá. Csak piszkozat (draft) állapotú foglalás törölhető.";
                    } else {
                        hibaUzenet = errData.message;
                    }
                }
            } catch(parseErr) { /* marad az alapértelmezett üzenet */ }
            throw new Error(hibaUzenet);
        }

        // Sikeres törlés esetén a naptár bejegyzés törlése
        if (calendarEventId) {
            try {
                await fetch("https://calendar-bot.jazminlovasudvar-gyongyos.workers.dev/", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: calendarEventId })
                });
            } catch(calErr) { console.warn("Naptár törlési hiba:", calErr); }
        }
        loadAllBookings();
    } catch(e) {
        alert(e.message);
    }
}

// ── Manuális rögzítés ──
async function manualRecord() {
    const name = document.getElementById('qName').value.trim();
    const date = document.getElementById('qDate').value;
    if (!name || !date) return alert("Név és dátum megadása kötelező!");

    const timeStr = document.getElementById('qTime').value;
    const startMin = parseInt(timeStr.split(':')[0])*60 + parseInt(timeStr.split(':')[1]);
    const payload = {
        date: date,
        start_time: startMin,
        end_time: startMin + 30,
        name: name,
        service: document.getElementById('qService').value,
        status: "AKTÍV",
        email: "admin@jazminlovasudvar.hu",
        phone: ""
    };

    try {
        const resp = await fetch(BOOKINGS_API, {
            method: "POST",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error("Sikertelen API rögzítés.");
        document.getElementById('qName').value = "";
        alert("✅ Időpont sikeresen rögzítve!");
        loadAllBookings();
    } catch(e) {
        alert("❌ Rögzítési hiba: " + e.message);
    }
}

// ── Egész nap lezárása ──
async function blockDay() {
    const date = document.getElementById('blockDate').value;
    if (!date) return alert("Válassz dátumot a lezáráshoz!");
    if (!confirm(date + " napot biztosan TELJESEN ZÁRVA jelzed?")) return;

    const payload = {
        date: date,
        name: "ZÁRVA",
        status: "ZÁRVA",
        start_time: 0,
        end_time: 1440,
        service: "SZÜNNAP",
        email: "admin@jazminlovasudvar.hu",
        phone: ""
    };

    try {
        const resp = await fetch(BOOKINGS_API, {
            method: "POST",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error("Hiba a lezárás elküldésekor.");
        alert("✅ " + date + " sikeresen lezárva!");
        loadAllBookings();
    } catch(e) {
        alert("❌ Hiba: " + e.message);
    }
}

// ── Iskolai szünetek kezelése ──
async function loadHolidays() {
    const lista = document.getElementById('szunetLista');
    try {
        const resp = await fetch(HOLIDAYS_API + "?order=date_from.asc&select=*", { headers: authHeaders });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const data = await resp.json();
        
        if (data.length === 0) {
            lista.innerHTML = '<p style="color:#999;font-size:13px;">Még nincs rögzített szünet.</p>';
            return;
        }
        lista.innerHTML = data.map(h => `
            <div class="szunet-item">
                <div>
                    <span class="szunet-name">${escapeHtml(h.name)}</span>
                    <span class="szunet-dates"> &nbsp;|&nbsp; ${h.date_from} – ${h.date_to}</span>
                </div>
                <button class="btn-delete-holiday" onclick="deleteHoliday('${h.id}')">🗑 Törlés</button>
            </div>
        `).join('');
    } catch(e) {
        lista.innerHTML = '<p style="color:red;font-size:13px;">Hiba a szünetek betöltésekor: ' + e.message + '</p>';
    }
}

async function addHoliday() {
    const name = document.getElementById('szunetNev').value.trim();
    const from = document.getElementById('szunetTol').value;
    const to   = document.getElementById('szunetIg').value;
    
    if (!name || !from || !to) return alert("Minden mező kitöltése kötelező!");
    if (from > to) return alert("A kezdő dátum nem lehet nagyobb a végdátumnál!");
    
    try {
        const resp = await fetch(HOLIDAYS_API, {
            method: "POST",
            headers: { ...authHeaders, "Prefer": "return=minimal" },
            body: JSON.stringify({ name, date_from: from, date_to: to })
        });
        if (!resp.ok) throw new Error("Mentési hiba.");
        document.getElementById('szunetNev').value = "";
        document.getElementById('szunetTol').value = "";
        document.getElementById('szunetIg').value = "";
        loadHolidays();
    } catch(e) {
        alert("❌ Mentési hiba: " + e.message);
    }
}

async function deleteHoliday(id) {
    if (!confirm("Biztosan törlöd ezt a szünetet?")) return;
    try {
        const resp = await fetch(HOLIDAYS_API + "?id=eq." + id, {
            method: "DELETE",
            headers: authHeaders
        });
        if (!resp.ok) throw new Error("Törlési hiba.");
        loadHolidays();
    } catch(e) {
        alert("❌ Törlési hiba: " + e.message);
    }
}

// ── Segédfüggvények ──
function escapeHtml(text) {
    if (!text) return '-';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>\"']/g, m => map[m]);
}
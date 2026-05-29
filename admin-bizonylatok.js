// ============================================
// ADMIN BIZONYLATOK - JAVÍTOTT RACE CONDITION FIX
// ============================================

//let bizonylatUser = null;  // Átnevezve currentUser-ről, hogy elkerüljük a globális névütközést (SyntaxError)
let allReceipts = [];
let filteredReceipts = [];
let isInitialized = false; // Védelmi flag a dupla inicializálás ellen
let toastTimer = null;     // Globális időzítő a toastokhoz

// Egységes kezelő az auth indításhoz
function handleBizonylatokAuth(user) {
    if (!user) return;
    if (isInitialized) return; // Ha már lefutott az init, nem engedjük újra
    
    console.log('👤 Bizonylatok Auth sikeres:', user.email);
    bizonylatUser = user;
    isInitialized = true;
    initBizonylatokPage();
}

// 1️⃣ Figyeljük a Supabase kliensből érkező közvetlen jelzést, ha az auth-system már kész van
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (typeof supabaseClient !== 'undefined') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                console.log('✅ Aktív session azonnal detektálva a bizonylatokon!');
                handleBizonylatokAuth(session.user);
                return;
            }
        }
    } catch (e) {
        console.log('Várakozás az authReady eseményre...');
    }
});

// 2️⃣ Ha még nem futott le, akkor az authReady esemény fogja berúgni
window.addEventListener('authReady', (event) => {
    console.log('🔓 authReady esemény megérkezett a bizonylatokhoz!');
    handleBizonylatokAuth(event.detail.user);
});

// ===== OLDAL INICIALIZÁLÁSA =====
async function initBizonylatokPage() {
    console.log('📊 Bizonylatok oldal betöltődése...');
    
    try {
        showToast('⏳ Bizonylatok betöltődnek...', '#e67e22');
        
        await loadBizonylatokData();
        
        renderBizonylatokTable(allReceipts);
        attachEventListeners();
        
        showToast('✅ Bizonylatok oldal betöltődött!', '#27ae60');
        
    } catch (err) {
        console.error('❌ Bizonylatok init hiba:', err);
        showToast('❌ Oldal inicializálása sikertelen!', '#c0392b');
        isInitialized = false; // Hiba esetén újrapróbálhatóvá tesszük szükség esetén
    }
}

// ===== ADATOK LEKÉRÉSE =====
async function loadBizonylatokData() {
    const { data, error } = await supabaseClient
        .from('receipts')
        .select('*')
        .order('receipt_date', { ascending: false });

    if (error) throw error;
    allReceipts = data || [];
}

// ===== TÁBLÁZAT RENDERELÉSE =====
function renderBizonylatokTable(data) {
    const tbody = document.getElementById('bizonylatTableBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#999; padding:30px;">Nincs találat a bizonylatokra.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => {
        return `
            <tr>
                <td><strong>${escapeHtml(r.receipt_number)}</strong></td>
                <td>${escapeHtml(r.customer_name)}</td>
                <td>📅 ${escapeHtml(r.receipt_date)}</td>
                <td><strong>${Number(r.amount).toLocaleString('hu-HU')} Ft</strong></td>
                <td><span class="badge method-${r.payment_method}">${r.payment_method === 'cash' ? '💵 Készpénz' : '💳 Utalás'}</span></td>
                <td>
                    <button class="action-btn btn-pdf" onclick="openPdfModal('${r.id}')">📄 PDF</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ===== EVENT LISTENERS =====
function attachEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.replaceWith(searchInput.cloneNode(true));
        const newSearchInput = document.getElementById('searchInput');
        
        newSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (!term) {
                renderBizonylatokTable(allReceipts);
            } else {
                const filtered = allReceipts.filter(r =>
                    (r.customer_name || '').toLowerCase().includes(term) ||
                    (r.receipt_number || '').toLowerCase().includes(term) ||
                    (r.description || '').toLowerCase().includes(term)
                );
                renderBizonylatokTable(filtered);
            }
        });
    }
}

// ===== HELPER: XSS VÉDELEM =====
function escapeHtml(text) {
    if (!text) return '-';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ===== HELPER: TOAST =====
function showToast(msg, bgColor = '#333') {
    try {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `position: fixed; bottom: 30px; right: 30px; padding: 16px 24px; border-radius: 12px; color: white; z-index: 2000; font-family: 'Poppins', sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: all 0.3s ease;`;
            document.body.appendChild(toast);
        }
        
        // Ha van futó időzítő, ütjük el, hogy ne zárja be idő előtt az új üzenetet
        if (toastTimer) clearTimeout(toastTimer);
        
        toast.textContent = msg;
        toast.style.background = bgColor;
        toast.style.display = 'block';
        
        toastTimer = setTimeout(() => { 
            toast.style.display = 'none'; 
        }, 4000);
    } catch (err) {
        console.error('Toast hiba:', err);
    }
}
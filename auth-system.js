// ═══════════════════════════════════════════════════════════
// 🔐 SUPABASE AUTH SYSTEM - SZÉNIOR PRODUCTION VERSION
// ═══════════════════════════════════════════════════════════
// Centralizált auth management, session handling, error handling
// Egy helyen van az összes config - könnyen maintainable!
// ═══════════════════════════════════════════════════════════

// ✅ SUPABASE KONFIGURÁLÁS (HELYES URL!)
const SUPABASE_URL = 'https://ktzlczqhqnuluyuedhot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0emxjenFocW51bHV5dWVkaG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjgxMjEsImV4cCI6MjA5NDEwNDEyMX0.yfNCvcMbSIWcrmyInCQo-1LX7Z4w5kT5drNxe6kfBSk';

// ✅ SUPABASE KLIENS INICIALIZÁLÁSA
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════════════════════
// GLOBÁLIS ÁLLAPOTOK (PRODUCTION READY)
// ═══════════════════════════════════════════════════════════

let currentUser = null;
let currentSession = null;
let isAdmin = false;

// ✅ GLOBÁLIS ELÉRÉHETŐSÉG (Race condition fix!)
window.currentUser = null;
window.isAdmin = false;
window.supabaseClient = supabaseClient;

// ═══════════════════════════════════════════════════════════
// 1️⃣ INICIALIZÁLÁS (DOMContentLoaded)
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Auth system inicializálása...');
    initAuthSystem();
});

// ═══════════════════════════════════════════════════════════
// 2️⃣ AUTH SYSTEM INICIALIZÁLÁSA
// ═══════════════════════════════════════════════════════════

async function initAuthSystem() {
    try {
        console.log('📋 Session lekérése...');
        
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Session check hiba:', sessionError.message);
            redirectToLogin();
            return;
        }

        if (!session) {
            console.log('⚠️ Nincs aktív session - redirect login-re');
            redirectToLogin();
            return;
        }

        // ✅ SESSION MEGVAN
        console.log('✅ Session létezik:', session.user.email);
        currentSession = session;
        currentUser = session.user;

        // ═══════════════════════════════════════════════════════════
        // 3️⃣ ADMIN JOGOSULTSÁG ELLENŐRZÉSE
        // ═══════════════════════════════════════════════════════════
        
        console.log('👑 Admin jogosultság ellenőrzése...');
        
        try {
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('is_admin, full_name')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                if (profileError.code === 'PGRST116' || profileError.code === '22P02') {
                    console.warn('⚠️ Profil nem létezik - automatikus felvétel...');
                    
                    const { data: newProfile, error: createError } = await supabaseClient
                        .from('profiles')
                        .insert([{
                            id: session.user.id,
                            email: session.user.email,
                            is_admin: false,
                            full_name: session.user.user_metadata?.full_name || session.user.email
                        }])
                        .select()
                        .single();

                    if (createError) {
                        console.error('❌ Profil létrehozási hiba:', createError.message);
                        showAuthToast('❌ Profil hiba!', '#c0392b');
                        await supabaseClient.auth.signOut();
                        redirectToLogin();
                        return;
                    }

                    console.warn('⚠️ Profil létrehozva, de NEM admin!');
                    showAuthToast('❌ Nincs admin jogosultságod!', '#c0392b');
                    await supabaseClient.auth.signOut();
                    redirectToLogin();
                    return;
                } else {
                    console.error('❌ Profil check hiba:', profileError.message);
                    showAuthToast('❌ Jogosultság hiba!', '#c0392b');
                    redirectToLogin();
                    return;
                }
            }

            if (!profile?.is_admin) {
                console.error('❌ Felhasználó nem admin!');
                showAuthToast('❌ Nincs admin jogosultságod!', '#c0392b');
                await supabaseClient.auth.signOut();
                redirectToLogin();
                return;
            }

            isAdmin = true;
            console.log('✅ Admin jogosultság JÓVÁHAGYVA!', profile.full_name || session.user.email);

        } catch (err) {
            console.error('❌ Admin check kritikus hiba:', err.message);
            showAuthToast('❌ Admin ellenőrzés hiba!', '#c0392b');
            redirectToLogin();
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // 4️⃣ LOGOUT GOMB HOZZÁADÁSA (ha van header)
        // ═══════════════════════════════════════════════════════════
        
        console.log('🔘 Logout gomb hozzáadása...');
        addLogoutButtonToHeader();

        // ═══════════════════════════════════════════════════════════
        // 5️⃣ GLOBÁLIS WINDOW ELÉRÉHETŐSÉG (Race condition fix!)
        // ═══════════════════════════════════════════════════════════
        
        window.currentUser = currentUser;
        window.isAdmin = isAdmin;

        // ═══════════════════════════════════════════════════════════
        // 6️⃣ AUTHREADY EVENT TRIGGERELÉSE
        // ═══════════════════════════════════════════════════════════
        
        console.log('🎉 AuthReady event triggerelése...');
        window.dispatchEvent(new CustomEvent('authReady', {
            detail: { 
                user: currentUser, 
                session: currentSession, 
                isAdmin: isAdmin 
            }
        }));

        console.log('✅ ✅ AUTH SYSTEM KÉSZ! Adatok betöltödhetnek!');

        // ═══════════════════════════════════════════════════════════
        // 7.5️⃣ INAKTIVITÁS-FIGYELŐ INDÍTÁSA (15 perc auto-logout)
        // ═══════════════════════════════════════════════════════════
        startInactivityWatcher();

        // ═══════════════════════════════════════════════════════════
        // 7️⃣ SESSION CHANGE LISTENER (logout detection)
        // ═══════════════════════════════════════════════════════════
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                console.log('🔓 Felhasználó kijelentkezve - redirect login-re');
                redirectToLogin();
            }
        });

    } catch (err) {
        console.error('❌ Auth system kritikus hiba:', err.message);
        showAuthToast('❌ Auth rendszer hiba!', '#c0392b');
        redirectToLogin();
    }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNKCIÓK
// ═══════════════════════════════════════════════════════════

/**
 * Logout gomb hozzáadása a headerhez
 */
function addLogoutButtonToHeader() {
    try {
        const adminNav = document.querySelector('.admin-nav');
        if (!adminNav) {
            console.warn('⚠️ .admin-nav nem található - logout gomb skip');
            return;
        }

        // Ha már van logout gomb, skip
        if (adminNav.querySelector('.logout-btn')) {
            return;
        }

        // Logout gomb létrehozása
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'logout-btn';
        logoutBtn.textContent = '🔓 Kijelentkezés';
        logoutBtn.style.cssText = `
            background: #c0392b;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
            margin-left: auto;
        `;
        
        logoutBtn.addEventListener('mouseover', () => {
            logoutBtn.style.background = '#a93226';
        });
        
        logoutBtn.addEventListener('mouseout', () => {
            logoutBtn.style.background = '#c0392b';
        });
        
        logoutBtn.addEventListener('click', async () => {
            await handleLogout();
        });

        adminNav.appendChild(logoutBtn);
        console.log('✅ Logout gomb hozzáadva');

    } catch (err) {
        console.error('⚠️ Logout gomb hozzáadás hiba:', err.message);
    }
}

/**
 * Kijelentkezés kezelése
 */
async function handleLogout() {
    try {
        console.log('🔓 Kijelentkezés folyamatban...');
        
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            console.error('❌ Kijelentkezés hiba:', error.message);
            showAuthToast('❌ Kijelentkezés hiba!', '#c0392b');
            return;
        }

        console.log('✅ Kijelentkezés sikeres');
        showAuthToast('✅ Kijelentkeztél!', '#27ae60');

        // Megkérdezzük, hova menjen: vissza a weboldalra vagy a login-oldalra
        setTimeout(() => {
            const goToSite = confirm(
                'Sikeresen kijelentkeztél! 👋\n\n' +
                'Vissza szeretnél térni a weboldalra?\n\n' +
                'OK – Weboldal főoldala\n' +
                'Mégse – Bejelentkezési oldal'
            );
            if (goToSite) {
                window.location.href = 'index.html';
            } else {
                redirectToLogin();
            }
        }, 400);

    } catch (err) {
        console.error('❌ Kijelentkezés kritikus hiba:', err.message);
        redirectToLogin();
    }
}

/**
 * Redirect az admin-login.html oldalra
 */
function redirectToLogin() {
    console.log('↪️ Átirányítás login oldalra...');
    window.location.href = 'admin-login.html';
}

// ═══════════════════════════════════════════════════════════
// ⏱️ INAKTIVITÁS-FIGYELŐ – 15 PERC UTÁN AUTO-LOGOUT
// ═══════════════════════════════════════════════════════════

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;   // 15 perc
let inactivityTimer = null;

/**
 * Inaktivitási időzítő (újra)indítása.
 * Minden felhasználói aktivitás meghívja – nullázza a 15 perces órát.
 */
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    // Az utolsó aktivitás időbélyege – több fül közti szinkronhoz
    try {
        localStorage.setItem('admin_last_activity', Date.now().toString());
    } catch (e) { /* localStorage nem elérhető – nem kritikus */ }

    inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
}

/**
 * Auto-logout inaktivitás miatt.
 */
async function handleInactivityLogout() {
    console.log('⏱️ 15 perc inaktivitás – automatikus kijelentkezés');
    try {
        // Jelzés a login oldalnak, hogy miért dobtuk ki
        try { sessionStorage.setItem('logout_reason', 'inactivity'); } catch (e) {}
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('⚠️ Auto-logout hiba:', err.message);
    }
    // A signOut a SIGNED_OUT eseményen át redirectel, de biztos, ami biztos:
    redirectToLogin();
}

/**
 * Inaktivitás-figyelő indítása: aktivitás-események + több fül szinkron.
 */
function startInactivityWatcher() {
    console.log('⏱️ Inaktivitás-figyelő indítása (15 perc)...');

    // Felhasználói aktivitás eseményei
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => {
        window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Több fül közti szinkron: ha az egyik fülön volt aktivitás,
    // a többi fül is nullázza a saját óráját.
    window.addEventListener('storage', (e) => {
        if (e.key === 'admin_last_activity') {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(handleInactivityLogout, INACTIVITY_LIMIT_MS);
        }
    });

    // Ha a felhasználó visszatér egy másik fülről/ablakból, ellenőrizzük,
    // nem telt-e le közben a 15 perc.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            try {
                const last = parseInt(localStorage.getItem('admin_last_activity') || '0', 10);
                if (last && (Date.now() - last) >= INACTIVITY_LIMIT_MS) {
                    handleInactivityLogout();
                    return;
                }
            } catch (e) { /* nem kritikus */ }
            resetInactivityTimer();
        }
    });

    // Az óra elindítása
    resetInactivityTimer();
}

/**
 * Toast notifikáció
 */
function showAuthToast(msg, bgColor = '#333') {
    try {
        let toast = document.getElementById('authToast');
        
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'authToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 16px 24px;
                border-radius: 12px;
                color: white;
                z-index: 10000;
                font-family: 'Poppins', sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = msg;
        toast.style.background = bgColor;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);

    } catch (err) {
        console.error('Toast hiba:', err);
    }
}

/**
 * Protected Fetch - automatikus auth header
 */
async function protectedFetch(url, options = {}) {
    try {
        if (!currentSession) {
            throw new Error('Nincs aktív session!');
        }

        const headers = {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

    } catch (err) {
        console.error('🔐 Protected fetch hiba:', err.message);
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════
// EXPORT (ha szükséges egyéb JS-ből)
// ═══════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        supabaseClient,
        currentUser,
        isAdmin,
        protectedFetch,
        handleLogout
    };
}

console.log('✅ Auth system script betöltödött!');

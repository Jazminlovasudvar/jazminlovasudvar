// _worker.js
// Ezt a fájlt a többi HTML fájl MELLÉ kell feltölteni, a mappa gyökerébe
// (ugyanabba a mappába, ahol az index.html, admin.html stb. van).
//
// Amit csinál:
//   - /tudastar/valami-cikk-slug  → lekéri a cikket a Supabase-ből, és
//     szerver-oldalon (Google számára is látható, kész HTML-ként) megjeleníti
//   - MINDEN MÁS kérés → változatlanul továbbmegy a meglévő statikus fájlokhoz
//     (index.html, foglalas.html, admin.html, stb. – ezek egyáltalán nem változnak)
//
// FONTOS BIZTONSÁGI MEGJEGYZÉS:
// Ha bármi hiba lenne ebben a fájlban, a "return env.ASSETS.fetch(request)" sor
// biztosítja, hogy minden más kérés (a foglalási rendszer is) továbbra is
// pontosan úgy működjön, mint most – ez a fájl csak a /tudastar/ útvonalakat
// "fogja el", semmi mást nem érint.

const SUPABASE_URL = "https://ktzlczqhqnuluyuedhot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0emxjenFocW51bHV5dWVkaG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjgxMjEsImV4cCI6MjA5NDEwNDEyMX0.yfNCvcMbSIWcrmyInCQo-1LX7Z4w5kT5drNxe6kfBSk";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Csak a /tudastar/valami útvonalakat kezeljük külön – minden más érintetlen marad.
        const match = url.pathname.match(/^\/tudastar\/([a-z0-9-]+)\/?$/);
        if (!match) {
            return env.ASSETS.fetch(request);
        }

        const slug = match[1];

        try {
            const resp = await fetch(
                `${SUPABASE_URL}/rest/v1/news?slug=eq.${encodeURIComponent(slug)}&select=*`,
                { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
            );
            const rows = await resp.json();
            const article = rows[0];

            if (!article) {
                // Ha nincs ilyen cikk, adjuk vissza a normál 404-et (a meglévő fájlokból, ha van ilyen)
                return env.ASSETS.fetch(request);
            }

            const images = (article.images && article.images.length) ? article.images : (article.image_url ? [article.image_url] : []);
            const heroImg = images[0] || "";
            const galleryImgs = images.slice(1);
            const dateStr = new Date(article.created_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
            const plainText = article.content.replace(/<[^>]+>/g, ' ').slice(0, 155).trim();

            const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(article.title)} – Jázmin Lovasudvar Tudástár</title>
<meta name="description" content="${escapeHtml(plainText)}">
<link rel="canonical" href="https://jazminlovasudvar.hu/tudastar/${escapeHtml(article.slug)}">
<meta property="og:title" content="${escapeHtml(article.title)}">
<meta property="og:description" content="${escapeHtml(plainText)}">
${heroImg ? `<meta property="og:image" content="${escapeHtml(heroImg)}">` : ''}
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
<style>
:root { --dark-green:#2e7d32; --bg-cream:#faf8f5; }
* { box-sizing: border-box; margin:0; padding:0; }
body { font-family:'Poppins',sans-serif; background:var(--bg-cream); color:#2c3e50; }
.wrap { max-width: 760px; margin: 0 auto; padding: 40px 6% 80px; }
.back-link { display:inline-block; margin-bottom: 24px; color: var(--dark-green); text-decoration:none; font-weight:600; font-size:14px; }
.hero { width:100%; border-radius:16px; overflow:hidden; margin-bottom: 28px; background:#eee; }
.hero img { width:100%; display:block; }
.meta { font-size:13px; color:#999; margin-bottom:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
.meta .cat { color: var(--dark-green); }
h1 { font-family:'Montserrat',sans-serif; font-size:32px; font-weight:800; color:#2c3e50; margin-bottom:24px; letter-spacing:-0.5px; }
.content { font-size:16px; line-height:1.9; color:#3a3a3a; }
.content p { margin-bottom: 16px; }
.gallery { display:flex; gap:12px; margin: 28px 0; flex-wrap:wrap; }
.gallery img { width: 140px; height: 140px; object-fit: cover; border-radius: 12px; }
@media (max-width:600px){ h1{font-size:26px;} }
</style>
</head>
<body>
<div class="wrap">
    <a class="back-link" href="/index.html#tudastar">← Vissza a Tudástárba</a>
    ${heroImg ? `<div class="hero"><img src="${escapeHtml(heroImg)}" alt="${escapeHtml(article.title)}"></div>` : ''}
    <div class="meta">${dateStr} • <span class="cat">${escapeHtml(article.category || 'Általános')}</span></div>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="content">${article.content}</div>
    ${galleryImgs.length ? `<div class="gallery">${galleryImgs.map(u => `<img src="${escapeHtml(u)}" alt="">`).join('')}</div>` : ''}
</div>
</body>
</html>`;

            return new Response(html, { headers: { "content-type": "text/html; charset=UTF-8" } });

        } catch (e) {
            // Bármilyen hiba esetén essünk vissza a normál statikus kiszolgálásra –
            // így egy Supabase-hiba sem tudja elrontani a többi oldalt.
            return env.ASSETS.fetch(request);
        }
    }
};

function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

'use strict';
const LEVELS = {
  5: ['Çok uygun', '--l5'], 4: ['Uygun', '--l4'], 3: ['Koşullu', '--l3'], 2: ['Zor', '--l2'], 1: ['Uygun değil', '--l1']
};
const GHS = {
  '01': 'Patlayıcı', '02': 'Alevlenir', '03': 'Yükseltgen', '04': 'Basınçlı gaz', '05': 'Aşındırıcı', '06': 'Akut toksik',
  '07': 'Zararlı, tahriş edici', '08': 'Sağlık tehlikesi', '09': 'Çevre tehlikesi'
};
const H = {
  H224: 'Aşırı alevlenir sıvı ve buhar', H225: 'Kolay alevlenir sıvı ve buhar', H226: 'Alevlenir sıvı ve buhar', H272: 'Yangını şiddetlendirebilir, yükseltgen',
  H260: 'Suyla temasında kendiliğinden tutuşabilen alevlenir gazlar çıkarır', H290: 'Metalleri aşındırabilir', H300: 'Yutulursa öldürücüdür', H301: 'Yutulursa toksiktir', H302: 'Yutulursa zararlıdır',
  H304: 'Yutulur ve solunum yoluna girerse öldürücü olabilir', H310: 'Deriyle temasında öldürücüdür', H311: 'Deriyle temasında toksiktir', H312: 'Deriyle temasında zararlıdır',
  H314: 'Ciddi cilt yanıklarına ve göz hasarına yol açar', H315: 'Cilt tahrişine yol açar', H317: 'Alerjik cilt reaksiyonuna yol açabilir',
  H318: 'Ciddi göz hasarına yol açar', H319: 'Ciddi göz tahrişine yol açar', H330: 'Solunursa öldürücüdür', H331: 'Solunursa toksiktir',
  H332: 'Solunursa zararlıdır', H334: 'Solunduğunda alerji, astım belirtileri veya solunum güçlüğüne yol açabilir', H335: 'Solunum yollarında tahrişe yol açabilir', H336: 'Uyuşukluk veya baş dönmesine yol açabilir',
  H340: 'Genetik bozukluklara yol açabilir', H341: 'Genetik bozukluklara yol açma şüphesi var', H350: 'Kansere yol açabilir', H350i: 'Solunduğunda kansere yol açabilir',
  H351: 'Kansere yol açma şüphesi var', H360D: 'Doğmamış çocukta hasara yol açabilir', H360FD: 'Üremeye ve doğmamış çocuğa zarar verebilir', H361f: 'Üremeye zarar verme şüphesi var', H360Df: 'Doğmamış çocukta hasara yol açabilir, üremeyi etkileme şüphesi var',
  H361d: 'Doğmamış çocukta hasara yol açma şüphesi var', H370: 'Organlarda hasara yol açar', H372: 'Uzun süreli veya tekrarlı maruziyette organlarda hasara yol açar',
  H373: 'Uzun süreli veya tekrarlı maruziyette organlarda hasara yol açabilir', H400: 'Sucul yaşam için çok toksiktir',
  H410: 'Sucul yaşam için çok toksiktir, etkisi uzun sürer', H411: 'Sucul yaşam için toksiktir, etkisi uzun sürer', H412: 'Sucul yaşam için zararlıdır, etkisi uzun sürer'
};

const CFG = window.APP_CONFIG || {};
const DEFAULT_NAME = CFG.name || 'Uygulama Adı';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const low = s => String(s ?? '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const fmt = f => esc(f).replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');
const payload = c => 'KIMYA:' + c.cas;
const lvl = c => LEVELS[c.l] ? c.l : 1;
const levelVar = l => `var(${LEVELS[l][1]})`;
const say = (text, cls = '') => { $('status').className = cls; $('status').textContent = text; };

let C = [], base = [], current = null, filter = 0, editing = null, confirming = null;
let onlineToken = 0, temp = null;
let fs = null, auth = null, adminUser = null, dbEmpty = false, view = 'list', appName = DEFAULT_NAME;

/* CAS numbers end in a check digit, so a misread code is caught before lookup. */
function casValid(cas) {
  if (!/^\d{2,7}-\d{2}-\d$/.test(cas)) return false;
  const d = cas.replace(/-/g, '');
  const body = d.slice(0, -1).split('').reverse();
  return body.reduce((t, x, i) => t + (i + 1) * Number(x), 0) % 10 === Number(d.slice(-1));
}

function lookup(text) {
  const raw = String(text).trim();
  const m = raw.match(/\b\d{2,7}-\d{2}-\d\b/);
  if (m) {
    const c = C.find(x => x.cas === m[0]);
    return c ? { c } : { cas: m[0], valid: casValid(m[0]) };
  }
  const t = low(raw).replace(/^kimya:/, '');
  if (!t) return {};
  const c = C.find(x => low(x.n) === t || low(x.f) === t) ||
            C.find(x => low(x.n + ' ' + x.s).includes(t));
  return c ? { c } : { raw };
}

const matches = t => C.filter(c => !t || low([c.n, c.s, c.f, c.cas].join(' ')).includes(t));

function drawQR(canvas, text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), s = 4;
  canvas.width = canvas.height = n * s;
  const x = canvas.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, n * s, n * s); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(c * s, r * s, s, s);
}

function fact(title, value, cls = '', style = '') {
  return value ? `<div class="${cls}"><h3>${title}</h3><p style="${style}">${esc(value)}</p></div>` : '';
}

function show(c) {
  current = c;
  const l = lvl(c), g = (c.g || []).filter(k => GHS[k]), h = c.h || [];
  const seg = [1,2,3,4,5].map(i => `<u class="${i <= l ? 'on' : ''}"></u>`).join('');
  const pics = g.length || h.length
    ? `<div class="ghs">${g.map(k => `<div class="pic"><div><b>${k}</b></div>${GHS[k]}</div>`).join('')}</div>
       <ul class="hz">${h.map(k => `<li><code>${esc(k)}</code><span>${esc(H[k] || c.hx?.[k] || 'Açıklama için Güvenlik Bilgi Formuna bakın')}</span></li>`).join('')}</ul>`
    : `<p class="safe">Bu madde için tehlike sınıfı girilmemiş.</p>`;
  const unsaved = !C.includes(c);
  const note = c.auto ? `<p class="auto">${unsaved ? 'Bu madde listede kayıtlı değil. ' : ''}Bilgiler PubChem’den otomatik alındı, uygunluk seviyesi tahminidir. Güvenlik Bilgi Formuyla kontrol edin.</p>
    ${unsaved && adminUser ? '<button type="button" class="btn small" id="saveOnline">Listeye kaydet</button>' : ''}` : '';
  $('sheet').className = 'panel sheet';
  $('sheet').innerHTML = note + `
    <div class="head">
      <div>
        <p class="formula">${fmt(c.f)}</p>
        <p class="name">${esc(c.n)}</p>
        ${c.s ? `<p class="syn">${esc(c.s)}</p>` : ''}
      </div>
      <span class="cas">CAS ${esc(c.cas)}</span>
    </div>
    <div class="gauge" style="--c:${levelVar(l)}">
      <div class="top"><strong>${LEVELS[l][0]}</strong><span>Seviye ${l}/5</span></div>
      <div class="seg" role="img" aria-label="Geri dönüşüm uygunluğu 5 üzerinden ${l}">${seg}</div>
      <p>${esc(c.y)}</p>
    </div>
    <div class="facts">
      ${fact('Geri kazanım yöntemi', c.m)}
      ${fact('Muhtemel atık kodu', c.w, '', 'font-family:var(--mono)')}
      ${fact('Depolama', c.st)}
      ${fact('Temastan kaçın', c.av, 'warn')}
      ${fact('İlk yardım', c.a)}
    </div>
    <div><h3>Tehlike bilgisi (GHS)</h3>${pics}</div>
    <div class="foot"><canvas class="qr" id="qr" aria-label="${esc(c.n)} kare kodu"></canvas>
      <div><h3>Bu maddenin kare kodu</h3><p>Etikete bas veya başka bir ekrandan okutarak dene. İçerik: <code>${esc(payload(c))}</code></p></div>
    </div>`;
  drawQR($('qr'), payload(c));
  $('saveOnline')?.addEventListener('click', () => saveOnline(c));
  renderList();
}

const clean = o => JSON.parse(JSON.stringify(o));
async function saveOnline(c) {
  const b = $('saveOnline'); b.disabled = true;
  try { await fs.collection('chemicals').doc(c.cas).set(clean(c)); say(`${c.n} listeye kaydedildi.`, 'ok'); }
  catch (err) { say(dbFail(err), 'err'); b.disabled = false; }
}

/* Not in the list: ask PubChem before showing the miss. */
async function onlineResolve(q, title, body, prefill) {
  const token = ++onlineToken;
  if (!window.Online || !navigator.onLine) return showMissing(title, body, prefill);
  say('Listede yok, internette aranıyor…');
  current = null;
  $('sheet').className = 'panel sheet';
  $('sheet').innerHTML = '<p class="none">PubChem kimya veritabanında aranıyor…</p>';
  try {
    const c = await Online.fetchChem(q);
    if (token !== onlineToken) return;
    if (c) {
      const saved = C.find(x => x.cas === c.cas);
      if (saved) { show(saved); say('Bulundu: ' + saved.n, 'ok'); }
      else { temp = c; show(c); say(`İnternetten bulundu: ${c.n}`, 'ok'); }
      return;
    }
    say('İnternette de bulunamadı.', 'err');
    showMissing(title, body + '<p>PubChem’de de bulunamadı. Maddenin İngilizce adını veya CAS numarasını deneyin.</p>', prefill);
  } catch {
    if (token !== onlineToken) return;
    say('İnternette aranamadı. Bağlantınızı kontrol edip yeniden deneyin.', 'err');
    showMissing(title, body, prefill);
  }
}

/* body is built by callers from esc()'d values only. prefill opens the add form for a signed-in admin. */
function showMissing(title, body, prefill) {
  current = null;
  const canAdd = adminUser && prefill;
  $('sheet').className = 'panel sheet miss';
  $('sheet').innerHTML = `<h3>${esc(title)}</h3>${body}${canAdd ? '<button type="button" class="btn small" id="addMissing">Yeni madde olarak ekle</button>' : ''}`;
  if (canAdd) $('addMissing').addEventListener('click', () => { openDrawer('admin'); openEditor(null, prefill); });
  renderList();
}

function jumpToSheet() {
  if (window.matchMedia('(max-width: 859px)').matches) $('sheet').scrollIntoView({ block: 'start' });
}

function resolve(text, viaScan) {
  const r = lookup(text);
  onlineToken++;
  if (r.c) {
    say((viaScan ? 'Kod okundu: ' : 'Bulundu: ') + r.c.n, 'ok');
    show(r.c);
    if (viaScan) jumpToSheet();
  } else if (r.cas) {
    if (r.valid) return onlineResolve(r.cas, 'Madde listede yok',
      `<p><b>${esc(r.cas)}</b> geçerli bir CAS numarası, ancak bu maddenin kaydı yok. Üreticinin Güvenlik Bilgi Formuna bakın.</p>`, { cas: r.cas });
    say('CAS numarası geçersiz.', 'err');
    showMissing('CAS numarası geçersiz', `<p><b>${esc(r.cas)}</b> kontrol basamağı tutmuyor. Kodu yeniden okutun veya etiketteki numarayı elle yazın.</p>`, null);
  } else if (r.raw) {
    const body = `<p>Aranan: <b>${esc(r.raw)}</b>. Ad, formül veya CAS numarasıyla yeniden deneyin.</p>`;
    if (viaScan) { say('Kod okundu, ama madde tanınmadı.', 'err'); return showMissing('Madde bulunamadı', body, null); }
    return onlineResolve(r.raw, 'Madde bulunamadı', body, { n: r.raw });
  }
}

const rowHTML = c => {
  const l = lvl(c);
  return `<button type="button" class="row" data-cas="${esc(c.cas)}" ${current === c ? 'aria-current="true"' : ''}>
    <span><b>${esc(c.n)}</b><small>${esc(c.cas)}</small></span>
    <span class="badge" style="--c:${levelVar(l)}"><span class="dot"></span>${l}/5</span>
  </button>`;
};

function renderHits() {
  const t = low($('q').value);
  $('hits').hidden = !t;
  if (!t) return;
  const rows = matches(t).slice(0, 6);
  $('hits').innerHTML = rows.length ? rows.map(rowHTML).join('') : '<p class="none">Eşleşen madde yok. Enter ile tam aramayı deneyin.</p>';
}

function renderList() {
  $('mCount').textContent = C.length || '';
  const rows = matches(low($('lq').value)).filter(c => !filter || lvl(c) === filter);
  if (view === 'list') $('dTitle').textContent = `Kayıtlı maddeler (${rows.length})`;
  $('list').innerHTML = rows.length ? rows.map(rowHTML).join('') :
    `<p class="none">${C.length ? 'Bu aramayla eşleşen madde yok.' : 'Henüz kayıtlı madde yok.'}</p>`;
  renderHits();
  renderAdmin();
}

function renderChips() {
  const opts = [[0, 'Tümü'], ...[5,4,3,2,1].map(l => [l, LEVELS[l][0]])];
  $('chips').innerHTML = opts.map(([l, t]) => `<button type="button" class="chip" data-l="${l}" aria-pressed="${l === filter}">
    ${l ? `<span class="dot" style="--c:${levelVar(l)}"></span>` : ''}${t}</button>`).join('');
}

/* ---------- QR from a still image ---------- */
async function decodeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    for (const target of [1400, 900, 500, big]) {
      const k = Math.min(1, target / big);
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
      if (hit && hit.data) return hit.data;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

async function scanFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return say('Lütfen bir fotoğraf veya görsel seçin.', 'err');
  say('Kod okunuyor…');
  try {
    const text = await decodeImage(file);
    if (text) resolve(text, true);
    else say('Kare kod bulunamadı. Kodu kadraja ortalayıp net bir fotoğraf çekin.', 'err');
  } catch { say('Görsel açılamadı. Başka bir fotoğraf deneyin.', 'err'); }
}

/* ---------- live camera ---------- */
let stream = null, scanTimer = null;
const scanCanvas = document.createElement('canvas');

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return say('Bu tarayıcı canlı kamerayı desteklemiyor. Galeriden kare kod seçin.', 'err');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  } catch (e) {
    return say(e.name === 'NotAllowedError'
      ? 'Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya galeriden kare kod seçin.'
      : 'Kamera açılamadı. Galeriden kare kod seçebilirsiniz.', 'err');
  }
  const v = $('video');
  v.srcObject = stream; v.hidden = false;
  $('finderText').hidden = true; $('finder').classList.add('live');
  $('camBtn').textContent = 'Kamerayı kapat';
  say('Kare kodu çerçeveye getirin.');
  await v.play().catch(() => {});
  const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  const tick = async () => {
    if (!stream) return;
    let text = null;
    if (v.readyState >= 2 && v.videoWidth) {
      try {
        if (detector) text = (await detector.detect(v))[0]?.rawValue || null;
        else {
          const k = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
          scanCanvas.width = v.videoWidth * k; scanCanvas.height = v.videoHeight * k;
          const x = scanCanvas.getContext('2d', { willReadFrequently: true });
          x.drawImage(v, 0, 0, scanCanvas.width, scanCanvas.height);
          const d = x.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          text = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' })?.data || null;
        }
      } catch { /* a frame that fails to read is skipped */ }
    }
    if (text) {
      stopCamera();
      navigator.vibrate?.(80);
      resolve(text, true);
    } else if (stream) scanTimer = setTimeout(tick, 160);
  };
  tick();
}

function stopCamera() {
  clearTimeout(scanTimer);
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  $('video').srcObject = null; $('video').hidden = true;
  $('finderText').hidden = false; $('finder').classList.remove('live');
  $('camBtn').textContent = 'Kare kodu okut';
}

/* ---------- label photo: on-device OCR ---------- */
const plain = s => String(s ?? '').toLocaleLowerCase('tr')
  .replace(/[çğıöşüâîû]/g, c => ({ ç:'c', ğ:'g', ı:'i', ö:'o', ş:'s', ü:'u', â:'a', î:'i', û:'u' }[c]))
  .replace(/%\s*\d+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function lev(a, b) {
  let p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const r = [i];
    for (let j = 1; j <= b.length; j++) r[j] = Math.min(p[j] + 1, r[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = r;
  }
  return p[b.length];
}

const GENERIC = /\b(cozelti|cozeltisi|pentahidrat|glasiyal)\b/g;
function termsOf(c) {
  const names = [c.n, ...String(c.s || '').split(',')].map(t => plain(t).replace(GENERIC, ' ').replace(/\s+/g, ' ').trim());
  const f = String(c.f || '').split('·')[0];
  return [...new Set([...names.filter(t => t.length >= 4), ...(f.length >= 4 ? [plain(f)] : [])])];
}

/* Returns {cas} for a code found on the label, or scored candidates. Only exact hits may open by themselves. */
function matchText(text) {
  const cases = [...String(text).matchAll(/\d{2,7}\s?-\s?\d{2}\s?-\s?\d(?!\d)/g)].map(m => m[0].replace(/\s/g, '')).filter(casValid);
  for (const cas of cases) { const c = C.find(x => x.cas === cas); if (c) return { exact: c, why: 'CAS' }; }
  const words = plain(text).split(' ').filter(Boolean);
  const scored = [];
  for (const c of C) {
    let best = null;
    for (const term of termsOf(c)) {
      const k = term.split(' ').length;
      for (let i = 0; i + k <= words.length; i++) {
        const w = words.slice(i, i + k).join(' ');
        if (Math.abs(w.length - term.length) > 2) continue;
        const allow = term.length <= 4 ? 0 : term.length <= 8 ? 1 : 2;
        const d = lev(w, term);
        if (d <= allow && (!best || d < best.d || (d === best.d && term.length > best.len))) best = { c, d, len: term.length };
      }
    }
    if (best) scored.push(best);
  }
  scored.sort((a, b) => a.d - b.d || b.len - a.len);
  const exact = scored.filter(s => s.d === 0);
  return { exact: exact.length === 1 ? exact[0].c : null, list: scored.slice(0, 5).map(s => s.c), cas: cases[0] };
}

let ocrWorker = null;
function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
}
async function getWorker() {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract) await loadScript('lib/tess/tesseract.min.js');
  const dir = new URL('lib/tess/', location.href).href;
  ocrWorker = await Tesseract.createWorker('tur', 1, {
    workerPath: dir + 'worker.min.js', corePath: dir, langPath: dir, gzip: true, workerBlobURL: false,
    logger: m => {
      if (m.status === 'recognizing text') say(`Etiket okunuyor… %${Math.round(m.progress * 100)}`);
      else if (m.status.startsWith('loading')) say('Okuyucu hazırlanıyor. İlk kullanımda biraz sürebilir…');
    }
  });
  return ocrWorker;
}

/* Downscale and flatten phone photos: OCR is faster and steadier at this size. */
async function prepare(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d');
    x.filter = 'grayscale(1) contrast(1.25)';
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

let ocrBusy = false;
async function ocrSearch(file) {
  if (!file || ocrBusy) return;
  ocrBusy = true;
  stopCamera();
  say('Okuyucu hazırlanıyor…');
  try {
    const canvas = await prepare(file);
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    const text = (data.text || '').trim();
    const r = matchText(text);
    if (r.exact) {
      show(r.exact);
      say(`Etiketten bulundu: ${r.exact.n}. Şişedeki adla karşılaştırın.`, 'ok');
    } else if (r.list?.length) {
      current = null;
      say('Birden fazla madde olabilir. Doğru olanı seçin.');
      $('sheet').className = 'panel sheet miss';
      $('sheet').innerHTML = `<h3>Bunu mu demek istediniz?</h3><div class="list" id="cands">${r.list.map(rowHTML).join('')}</div>
        <h3>Etiketten okunan yazı</h3><pre class="read">${esc(text.slice(0, 400))}</pre>`;
      renderList();
    } else if (r.cas) {
      onlineResolve(r.cas, 'Madde listede yok', `<p>Etiketteki CAS numarası: <b>${esc(r.cas)}</b>.</p>`, { cas: r.cas });
    } else {
      say(text ? 'Yazı okundu, ama kayıtlı madde bulunamadı.' : 'Etikette yazı okunamadı.', 'err');
      showMissing(text ? 'Madde bulunamadı' : 'Yazı okunamadı',
        text ? `<p>Etiketteki ad listede yok veya net okunamadı. Daha yakından çekin ya da adı arama kutusuna yazın.</p><pre class="read">${esc(text.slice(0, 400))}</pre>`
             : '<p>Etiketi düz tutup iyi ışıkta, yazı ekranı dolduracak kadar yakından çekin.</p>',
        r.cas ? { cas: r.cas } : null);
    }
    jumpToSheet();
  } catch (e) {
    console.error(e);
    ocrWorker = null;
    say('Etiket okunamadı. İlk kullanımda internet gerekir, bağlantınızı kontrol edip yeniden deneyin.', 'err');
  } finally { ocrBusy = false; }
}

/* ---------- drawer ---------- */
function setView(v) {
  view = v;
  const signedIn = !!adminUser;
  $('vList').hidden = v !== 'list';
  $('vInstall').hidden = v !== 'install';
  $('vSetup').hidden = !(v === 'admin' && !fs);
  $('vLogin').hidden = !(v === 'admin' && fs && !signedIn);
  $('vAdmin').hidden = !(v === 'admin' && fs && signedIn);
  $('dTitle').textContent = v === 'admin' ? 'Yönetici paneli' : v === 'install' ? 'Telefona yükle' : 'Kayıtlı maddeler';
  renderList();
}
function openDrawer(v) {
  $('menu').hidden = true; $('dots').setAttribute('aria-expanded', 'false');
  stopCamera();
  setView(v);
  if (!$('drawer').open) $('drawer').showModal();
}

/* ---------- admin ---------- */
function renderAdmin() {
  if (view !== 'admin' || !adminUser) return;
  const missing = dbEmpty ? base : base.filter(b => !C.some(c => c.cas === b.cas));
  $('aSeed').hidden = !missing.length || !$('ed').hidden;
  $('aSeed').textContent = dbEmpty ? `${base.length} maddeyi veritabanına yükle` : `${missing.length} yeni hazır maddeyi veritabanına ekle`;
  $('aNew').hidden = dbEmpty; $('imp').hidden = dbEmpty || !$('ed').hidden;
  if (dbEmpty) { $('admList').innerHTML = '<p class="none">Veritabanı boş. Önce hazır maddeleri yükleyin, sonra ekleme ve silme yapabilirsiniz.</p>'; return; }
  $('admList').innerHTML = `<h3 style="margin-block:12px 4px">Kayıtlı maddeler (${C.length})</h3>` + (C.map(c => `
    <div class="adm"><span><b>${esc(c.n)}</b><small>${esc(c.cas)}</small></span>
      <span class="actions">${confirming === c.cas
        ? `<button type="button" class="btn danger small" data-del="${esc(c.cas)}">Sil</button><button type="button" class="btn alt small" data-nodel="1">Vazgeç</button>`
        : `<button type="button" class="btn alt small" data-edit="${esc(c.cas)}">Düzenle</button><button type="button" class="btn alt small" data-ask="${esc(c.cas)}">Kaldır</button>`}
      </span></div>`).join('') || '<p class="none">Henüz madde yok. Yeni madde ekleyerek başlayın.</p>');
}

function adminMsg(text, err) { $('aMsg').textContent = text; $('aMsg').classList.toggle('err', !!err); }
const dbFail = e => e?.code === 'permission-denied'
  ? 'Bu hesabın yönetici yetkisi yok. Firestore kurallarındaki hesap kimliğini kontrol edin.'
  : 'Kaydedilemedi. Bağlantınızı kontrol edip yeniden deneyin.';

function openEditor(c, pre = {}) {
  editing = c;
  const v = c || pre;
  $('edTitle').textContent = c ? `${c.n} düzenleniyor` : 'Yeni madde';
  $('fN').value = v.n || ''; $('fS').value = v.s || ''; $('fF').value = v.f || ''; $('fC').value = v.cas || '';
  $('fC').readOnly = !!c;
  $('fL').value = String(v.l || 3); $('fW').value = v.w || ''; $('fY').value = v.y || ''; $('fM').value = v.m || '';
  $('fSt').value = v.st || ''; $('fAv').value = v.av || ''; $('fA').value = v.a || ''; $('fH').value = (v.h || []).join(', ');
  document.querySelectorAll('#fG input').forEach(i => { i.checked = (v.g || []).includes(i.value); });
  $('edMsg').textContent = ''; $('edMsg').classList.remove('err');
  $('ed').hidden = false; $('admList').hidden = true;
  $('fN').focus();
}
function closeEditor() { $('ed').hidden = true; $('admList').hidden = false; editing = null; renderAdmin(); }

let importing = false;
async function importList(e) {
  e.preventDefault();
  if (importing) return;
  const lines = [...new Set($('impText').value.split('\n').map(x => x.trim()).filter(Boolean))].slice(0, 50);
  if (!lines.length) return;
  const log = $('impLog'); log.hidden = false; log.textContent = '';
  const out = t => { log.textContent += t + '\n'; log.scrollTop = log.scrollHeight; };
  importing = true; $('impBtn').disabled = true;
  let added = 0;
  for (const [i, line] of lines.entries()) {
    const known = lookup(line).c;
    if (known) { out(`${line}: zaten kayıtlı (${known.n})`); continue; }
    $('impBtn').textContent = `Aranıyor ${i + 1}/${lines.length}`;
    try {
      const c = await Online.fetchChem(line);
      if (!c) { out(`${line}: bulunamadı`); continue; }
      if (C.some(x => x.cas === c.cas)) { out(`${line}: zaten kayıtlı (${c.cas})`); continue; }
      await fs.collection('chemicals').doc(c.cas).set(clean(c));
      added++; out(`${line}: eklendi, ${c.n}, seviye ${c.l}/5 (tahmini)`);
    } catch (err) {
      if (err?.code === 'permission-denied') { out(dbFail(err)); break; }
      out(`${line}: hata, ${err?.code === 'busy' ? 'PubChem meşgul, sonra yeniden deneyin' : 'bağlantı sorunu'}`);
    }
  }
  out(`Bitti: ${added} madde eklendi.`);
  importing = false; $('impBtn').disabled = false; $('impBtn').textContent = 'Bul ve ekle';
}

async function saveChem(e) {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const cas = v('fC'), m = $('edMsg');
  const fail = t => { m.textContent = t; m.classList.add('err'); };
  if (!v('fN')) return fail('Madde adını yazın.');
  if (!v('fF')) return fail('Formülü yazın.');
  if (!casValid(cas)) return fail('CAS numarası geçersiz. Kontrol basamağını da inceleyin (örnek: 67-64-1).');
  if (!editing && C.some(c => c.cas === cas)) return fail('Bu CAS numarası zaten kayıtlı.');
  if (!v('fY')) return fail('Uygunluk açıklamasını yazın.');
  const doc = {
    cas, n: v('fN'), s: v('fS'), f: v('fF'), l: Number($('fL').value), y: v('fY'), m: v('fM'), w: v('fW'),
    st: v('fSt'), av: v('fAv'), a: v('fA'),
    g: [...document.querySelectorAll('#fG input:checked')].map(i => i.value),
    h: v('fH').split(/[,\s]+/).filter(Boolean)
  };
  $('edSave').disabled = true;
  try {
    await fs.collection('chemicals').doc(cas).set(doc);
    closeEditor();
    adminMsg(`${doc.n} kaydedildi.`);
  } catch (err) { fail(dbFail(err)); }
  finally { $('edSave').disabled = false; }
}

async function removeChem(cas) {
  const c = C.find(x => x.cas === cas);
  try {
    await fs.collection('chemicals').doc(cas).delete();
    confirming = null;
    adminMsg(`${c ? c.n : cas} kaldırıldı.`);
  } catch (err) { adminMsg(dbFail(err), true); }
}

async function seed() {
  $('aSeed').disabled = true;
  try {
    const todo = dbEmpty ? base : base.filter(b => !C.some(c => c.cas === b.cas));
    const b = fs.batch();
    todo.forEach(c => b.set(fs.collection('chemicals').doc(c.cas), c));
    await b.commit();
    adminMsg(`${todo.length} madde veritabanına eklendi.`);
  } catch (err) { adminMsg(dbFail(err), true); }
  finally { $('aSeed').disabled = false; }
}

async function saveName(e) {
  e.preventDefault();
  const name = $('aName').value.trim();
  if (!name) return;
  try { await fs.doc('settings/app').set({ name }); adminMsg('Uygulama adı kaydedildi.'); }
  catch (err) { adminMsg(dbFail(err), true); }
}

function setName(name) {
  appName = name || DEFAULT_NAME;
  $('appName').textContent = appName; document.title = appName;
  if (document.activeElement !== $('aName')) $('aName').value = appName;
}

const LOGIN_ERR = {
  'auth/invalid-credential': 'E-posta veya şifre yanlış.', 'auth/wrong-password': 'E-posta veya şifre yanlış.',
  'auth/user-not-found': 'E-posta veya şifre yanlış.', 'auth/invalid-email': 'E-posta adresini kontrol edin.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra yeniden deneyin.',
  'auth/network-request-failed': 'İnternet bağlantınızı kontrol edin.'
};
async function login(e) {
  e.preventDefault();
  $('lMsg').textContent = ''; $('lBtn').disabled = true;
  try {
    await auth.signInWithEmailAndPassword($('lEmail').value.trim(), $('lPass').value);
    $('lPass').value = '';
  } catch (err) { $('lMsg').textContent = LOGIN_ERR[err.code] || 'Giriş yapılamadı. Yeniden deneyin.'; }
  finally { $('lBtn').disabled = false; }
}

/* ---------- data ---------- */
function useList(list) {
  const prev = current && current.cas;
  C = [...list].sort((a, b) => String(a.n).localeCompare(String(b.n), 'tr'));
  const same = prev && C.find(c => c.cas === prev);
  if (same) show(same);
  else if (prev && temp && temp.cas === prev) show(temp);
  else if (prev) { if (C[0]) show(C[0]); }
  else if (!$('sheet').classList.contains('miss')) {
    if (C.length) { show(C.find(c => c.cas === '67-64-1') || C[0]); say('Örnek olarak ' + current.n.toLocaleLowerCase('tr') + ' açık.'); }
    else { $('sheet').innerHTML = '<p class="none">Henüz kayıtlı madde yok. Yönetici madde eklediğinde burada görünecek.</p>'; say(''); }
  }
  renderList();
}

function firebaseReady() {
  const f = CFG.firebase;
  return !!(f && f.apiKey && f.projectId && window.firebase);
}

async function start() {
  renderChips();
  $('fL').innerHTML = [5,4,3,2,1].map(l => `<option value="${l}">${l} · ${LEVELS[l][0]}</option>`).join('');
  $('fG').innerHTML = Object.entries(GHS).map(([k, t]) => `<label><input type="checkbox" value="${k}">${k} ${t}</label>`).join('');
  setName(DEFAULT_NAME);

  try { base = await (await fetch('chemicals.json')).json(); }
  catch { say('Madde listesi yüklenemedi. Bağlantınızı kontrol edin.', 'err'); }
  useList(base);

  if (firebaseReady()) {
    firebase.initializeApp(CFG.firebase);
    fs = firebase.firestore();
    auth = firebase.auth();
    fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    fs.collection('chemicals').onSnapshot(snap => {
      if (snap.empty && snap.metadata.fromCache) return;
      dbEmpty = snap.empty;
      useList(snap.empty ? base : snap.docs.map(d => ({ ...d.data(), cas: d.id })));
    }, () => {});
    fs.doc('settings/app').onSnapshot(d => setName(d.data()?.name), () => {});
    auth.onAuthStateChanged(u => {
      adminUser = u;
      if (view === 'admin') setView('admin');
      if (current) show(current);
    });
  }
  showInstallItem();
}

/* ---------- install ---------- */
let installEvent = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function showInstallItem() { $('mInstall').hidden = standalone(); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => { installEvent = null; $('mInstall').hidden = true; });
async function install() {
  if (!installEvent) return openDrawer('install');
  $('menu').hidden = true;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
}

/* ---------- events ---------- */
$('camBtn').addEventListener('click', () => stream ? (stopCamera(), say('')) : startCamera());
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
$('gal').addEventListener('change', e => { scanFile(e.target.files[0]); e.target.value = ''; });
$('prod').addEventListener('change', e => { ocrSearch(e.target.files[0]); e.target.value = ''; });
$('f').addEventListener('submit', e => { e.preventDefault(); resolve($('q').value, false); $('q').value = ''; renderHits(); });
$('q').addEventListener('input', renderHits);
$('hits').addEventListener('click', e => {
  const b = e.target.closest('.row'); if (!b) return;
  resolve(b.dataset.cas, false); $('q').value = ''; renderHits(); jumpToSheet();
});
$('sheet').addEventListener('click', e => {
  const b = e.target.closest('#cands .row'); if (b) resolve(b.dataset.cas, false);
});
$('dots').addEventListener('click', e => {
  e.stopPropagation();
  const m = $('menu'); m.hidden = !m.hidden;
  $('dots').setAttribute('aria-expanded', String(!m.hidden));
});
document.addEventListener('click', e => { if (!e.target.closest('#menu')) { $('menu').hidden = true; $('dots').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('menu').hidden = true; });
$('mList').addEventListener('click', () => openDrawer('list'));
$('mAdmin').addEventListener('click', () => openDrawer('admin'));
$('mInstall').addEventListener('click', install);
$('dClose').addEventListener('click', () => $('drawer').close());
$('drawer').addEventListener('click', e => { if (e.target === $('drawer')) $('drawer').close(); });
$('lq').addEventListener('input', renderList);
$('list').addEventListener('click', e => {
  const b = e.target.closest('.row'); if (!b) return;
  $('drawer').close(); resolve(b.dataset.cas, false); jumpToSheet();
});
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  filter = Number(b.dataset.l); renderChips(); renderList();
});
$('vLogin').addEventListener('submit', login);
$('aNew').addEventListener('click', () => openEditor(null));
$('aSeed').addEventListener('click', seed);
$('imp').addEventListener('submit', importList);
$('aOut').addEventListener('click', () => auth.signOut());
$('edCancel').addEventListener('click', closeEditor);
$('ed').addEventListener('submit', saveChem);
$('nameForm').addEventListener('submit', saveName);
$('admList').addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.edit) openEditor(C.find(c => c.cas === d.edit));
  if (d.ask) { confirming = d.ask; renderAdmin(); }
  if (d.nodel) { confirming = null; renderAdmin(); }
  if (d.del) removeChem(d.del);
});
const fin = $('finder');
fin.addEventListener('dragover', e => { e.preventDefault(); fin.classList.add('drag'); });
fin.addEventListener('dragleave', () => fin.classList.remove('drag'));
fin.addEventListener('drop', e => { e.preventDefault(); fin.classList.remove('drag'); scanFile(e.dataTransfer.files[0]); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
start();

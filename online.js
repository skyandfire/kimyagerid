'use strict';
/* PubChem lookup: name or CAS -> a chemical record in the app's format.
   Hazard data comes from PubChem; the recycling level is estimated from it and marked auto: true. */
(() => {
  const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
  const VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound';

  // Common Turkish words -> English, so "sodyum karbonat" can be found. PubChem only knows English names.
  const TR = {
    asit: 'acid', 'asidi': 'acid', klorür: 'chloride', klorur: 'chloride', sülfat: 'sulfate', sulfat: 'sulfate', nitrat: 'nitrate',
    nitrit: 'nitrite', hidroksit: 'hydroxide', oksit: 'oxide', dioksit: 'dioxide', karbonat: 'carbonate', bikarbonat: 'bicarbonate',
    fosfat: 'phosphate', asetat: 'acetate', sülfür: 'sulfide', permanganat: 'permanganate', siyanür: 'cyanide', bromür: 'bromide',
    iyodür: 'iodide', florür: 'fluoride', hipoklorit: 'hypochlorite', peroksit: 'peroxide', sodyum: 'sodium', potasyum: 'potassium',
    kalsiyum: 'calcium', magnezyum: 'magnesium', alüminyum: 'aluminum', demir: 'iron', bakır: 'copper', çinko: 'zinc', gümüş: 'silver',
    kurşun: 'lead', civa: 'mercury', amonyum: 'ammonium', amonyak: 'ammonia', lityum: 'lithium', baryum: 'barium', nikel: 'nickel',
    kobalt: 'cobalt', krom: 'chromium', mangan: 'manganese', hidrojen: 'hydrogen', klor: 'chlorine', brom: 'bromine', iyot: 'iodine',
    hidroklorik: 'hydrochloric', sülfürik: 'sulfuric', sulfurik: 'sulfuric', nitrik: 'nitric', asetik: 'acetic', fosforik: 'phosphoric',
    sitrik: 'citric', formik: 'formic', oksalik: 'oxalic', borik: 'boric', laktik: 'lactic', aseton: 'acetone', benzen: 'benzene',
    toluen: 'toluene', ksilen: 'xylene', gliserin: 'glycerol', gliserol: 'glycerol', üre: 'urea', glikoz: 'glucose', sakaroz: 'sucrose',
    nişasta: 'starch', fenol: 'phenol', eter: 'ether', heksan: 'hexane', kloroform: 'chloroform', formaldehit: 'formaldehyde',
    'tuz': 'sodium chloride', 'kezzap': 'nitric acid', 'göztaşı': 'copper sulfate', 'karbonat': 'carbonate', 'kireç': 'calcium hydroxide'
  };
  const toEnglish = q => q.toLocaleLowerCase('tr').split(/\s+/).map(w => TR[w] || w).join(' ');

  function casValid(cas) {
    if (!/^\d{2,7}-\d{2}-\d$/.test(cas)) return false;
    const d = cas.replace(/-/g, '');
    return d.slice(0, -1).split('').reverse().reduce((t, x, i) => t + (i + 1) * +x, 0) % 10 === +d.slice(-1);
  }

  // PubChem asks for at most 5 requests per second; stay well under it.
  let last = 0;
  async function get(url) {
    const wait = last + 250 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.status === 404) return null;
      if (!r.ok) throw Object.assign(new Error('http ' + r.status), { code: r.status === 503 ? 'busy' : 'http' });
      return await r.json();
    } catch (e) {
      if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { code: 'timeout' });
      if (e.code) throw e;
      throw Object.assign(new Error('network'), { code: 'network' });
    } finally { clearTimeout(t); }
  }

  const cidFor = async q => (await get(`${BASE}/compound/name/${encodeURIComponent(q)}/cids/JSON`))?.IdentifierList?.CID?.[0] || null;

  // Collects every Information item in a PUG View record, in document order.
  function infos(node, out = []) {
    if (Array.isArray(node)) node.forEach(n => infos(n, out));
    else if (node && typeof node === 'object') {
      if (Array.isArray(node.Information)) out.push(...node.Information);
      if (node.Section) infos(node.Section, out);
      if (node.Record) infos(node.Record, out);
    }
    return out;
  }

  async function hazards(cid) {
    const json = await get(`${VIEW}/${cid}/JSON?heading=GHS%20Classification`);
    const all = infos(json);
    // Use the first source for each item; later sources often repeat or disagree.
    const pic = all.find(i => /pictogram/i.test(i.Name || ''));
    const hz = all.find(i => /hazard statements/i.test(i.Name || ''));
    const g = new Set(), h = [], hx = {};
    for (const s of pic?.Value?.StringWithMarkup || [])
      for (const m of s.Markup || []) { const k = String(m.URL || '').match(/GHS0?(\d)/); if (k) g.add('0' + k[1]); }
    for (const s of hz?.Value?.StringWithMarkup || []) {
      const m = String(s.String || '').match(/^(H\d{3}[A-Za-z]*)(?:\+H\d{3}[A-Za-z]*)*\s*(?:\(([\d.]+)%\))?\s*:?\s*([^[]*)/);
      if (!m) continue;
      if (m[2] && Number(m[2]) < 50) continue;   // reported by fewer than half of the notifiers
      if (!h.includes(m[1])) { h.push(m[1]); if (m[3]) hx[m[1]] = m[3].trim(); }
    }
    return { g: [...g].sort(), h, hx };
  }

  const TEXT = {
    metal: { l: 2, y: 'Ağır metal içerir. Metal yalnızca lisanslı geri kazanım tesislerinde alınabilir, kanalizasyona verilmez.', m: 'Lisanslı metal geri kazanımı', st: 'Kilitli dolapta, sızdırmaz kapta.', av: 'Asitler ve güçlü yükseltgenler. Ayrıntı için Güvenlik Bilgi Formuna bakın.', a: 'Hemen 112’yi ara. Ulusal Zehir Danışma Merkezi: 114.' },
    toxic: { l: 1, y: 'Çok zehirli veya kanserojen. Geri kazanılması yerine kontrollü bertaraf edilir.', m: 'Yetkili firmaya teslim, yakma', st: 'Kilitli dolapta, diğer maddelerden ayrı.', av: 'Ayrıntı için Güvenlik Bilgi Formuna bakın.', a: 'Hemen 112’yi ara. Ulusal Zehir Danışma Merkezi: 114.' },
    oxid: { l: 1, y: 'Yükseltgendir. Kullanımda tükenir, geri kazanılmaz.', m: 'Lisanslı firmaya teslim', st: 'Serin ve kuru yerde, yanıcı ve organik maddelerden ayrı.', av: 'Yanıcı maddeler, organik maddeler, indirgenler.', a: 'Bulaşan yeri bol suyla yıka. Gerekirse tıbbi yardım al.' },
    reactive: { l: 1, y: 'Kararsız veya suyla tepkimeye girer. Geri kazanım güvenli değildir.', m: 'Yetkili firmaya teslim', st: 'Kuru ve serin yerde, sıkı kapalı kapta.', av: 'Su, nem ve ısı. Ayrıntı için Güvenlik Bilgi Formuna bakın.', a: 'Hemen 112’yi ara.' },
    solvent: { l: 4, y: 'Organik çözücü. Kirlenmemiş atığı damıtılarak yeniden kullanılabilir.', m: 'Damıtma', st: 'Serin, havalandırılan yanıcı madde dolabında, ısı ve kıvılcımdan uzakta.', av: 'Güçlü yükseltgenler, açık alev.', a: 'Kişiyi temiz havaya çıkar. Göz veya ciltle temas ettiyse bol suyla yıka.' },
    solventTox: { l: 3, y: 'Organik çözücü, ancak sağlık tehlikesi var. Damıtma ancak kapalı sistemde yapılır.', m: 'Kapalı sistemde damıtma', st: 'Serin, havalandırılan yanıcı madde dolabında.', av: 'Güçlü yükseltgenler, açık alev.', a: 'Kişiyi temiz havaya çıkar. Belirti varsa tıbbi yardım al.' },
    corr: { l: 3, y: 'Aşındırıcı. Temiz atığı rejenere edilebilir veya nötralizasyonda kullanılabilir.', m: 'Rejenerasyon veya nötralizasyon', st: 'İkincil kap içinde, asitler ve bazlar ayrı.', av: 'Asitler ile bazları ve metalleri bir arada tutma.', a: 'En az 15 dakika bol suyla yıka. Hemen tıbbi yardım al.' },
    plain: { l: 3, y: 'Tehlikeli olarak sınıflandırılmamış. Saf ve temiz ise yeniden kullanılabilir.', m: 'Yeniden kullanım', st: 'Kuru yerde, kapalı kapta.', av: 'Ayrıntı için Güvenlik Bilgi Formuna bakın.', a: 'Gözle temasta suyla yıka.' },
    other: { l: 3, y: 'Tehlikeli madde. Geri kazanım, atığın saflığına bağlıdır.', m: 'Lisanslı firmaya danış', st: 'Kapalı kapta, uyumsuz maddelerden ayrı.', av: 'Ayrıntı için Güvenlik Bilgi Formuna bakın.', a: 'Bulaşan yeri bol suyla yıka. Belirti varsa tıbbi yardım al.' }
  };

  function estimate(f, h, g) {
    const has = (...k) => h.some(x => k.some(p => x.startsWith(p)));
    if (/(Hg|Pb|Cd|As|Tl|Cr|Ni|Co|Ba|Sb)(?![a-z])/.test(f)) return 'metal';
    if (has('H300', 'H310', 'H330', 'H340', 'H350', 'H360')) return 'toxic';
    if (has('H271', 'H272') || g.includes('03')) return 'oxid';
    if (has('H200', 'H201', 'H202', 'H203', 'H240', 'H241', 'H242', 'H250', 'H260', 'H261')) return 'reactive';
    if (/C(?![a-z])/.test(f) && /H/.test(f) && has('H224', 'H225', 'H226', 'H228'))
      return has('H301', 'H311', 'H331', 'H341', 'H351', 'H361', 'H370', 'H372') ? 'solventTox' : 'solvent';
    if (has('H314', 'H290')) return 'corr';
    return h.length ? 'other' : 'plain';
  }

  const cap = s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);

  /* Returns a record, or null when PubChem has no compound with a CAS number for this query. Throws {code} on network errors. */
  async function fetchChem(query) {
    const q = String(query).trim();
    if (!q) return null;
    let cid = await cidFor(q), viaTr = false;
    const en = toEnglish(q);
    if (!cid && en !== q.toLocaleLowerCase('tr')) { cid = await cidFor(en); viaTr = !!cid; }
    if (!cid) return null;
    const props = (await get(`${BASE}/compound/cid/${cid}/property/MolecularFormula,Title/JSON`))?.PropertyTable?.Properties?.[0] || {};
    const syn = (await get(`${BASE}/compound/cid/${cid}/synonyms/JSON`))?.InformationList?.Information?.[0]?.Synonym || [];
    const cas = (casValid(q) && syn.includes(q)) ? q : syn.find(casValid);
    if (!cas) return null;
    const { g, h, hx } = await hazards(cid);
    const f = String(props.MolecularFormula || '');
    const t = TEXT[estimate(f, h, g)];
    const title = String(props.Title || q);
    return {
      cas, n: viaTr ? cap(q) : cap(title), s: viaTr ? title : '', f,
      l: t.l, y: t.y, m: t.m, w: '', st: t.st, av: t.av, a: t.a,
      g, h, hx, src: 'PubChem', cid, auto: true
    };
  }

  window.Online = { fetchChem, estimate };
})();

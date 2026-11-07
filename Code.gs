/**
 * Cikkfeldolgozó: központi Apps Script háttér
 *
 * Egy központi Google táblázathoz kötve fut (pl. "Cikkfeldolgozó projektek").
 * A központi táblázat "Projektek" lapja tartja nyilván a projekteket:
 *   projektkulcs | projekt neve | táblázat | aktív | jelszó-hash | létrehozva
 * Minden projekt adatai külön Google táblázatban vannak (Review, Empirikus, Kodok lap).
 *
 * Belépés: projektkulcs + közös jelszó. A jelszó csak hash-elve tárolódik.
 * Sikeres belépés után a böngésző egy aláírt, időkorlátos belépési kulcsot kap.
 * Jelszócsere után a korábbi belépési kulcsok érvénytelenek.
 *
 * Használat: a táblázatban a "Cikkfeldolgozó" menü (új projekt, jelszócsere, ellenőrzés).
 */

// A GitHub Pages oldal címe, perjellel a végén. Csak a menüben kiírt meghívó linkhez kell.
// Példa: 'https://csarnold8011.github.io/cikkfeldolgozo/'
const OLDAL_URL = '';

const BELEPES_NAP = 14;   // ennyi napig érvényes egy belépés
const HIBA_LIMIT = 10;    // ennyi hibás jelszó után ideiglenes zárolás projektenként
const HIBA_PERC = 15;     // a zárolás hossza percben
const HASH_KOR = 500;     // a jelszó-hash ismétlésszáma

const ADMIN_LAP = 'Projektek';
const ADMIN_FEJ = ['projektkulcs', 'projekt neve', 'táblázat', 'aktív', 'jelszó-hash', 'létrehozva'];
const LAPOK = { A: 'Review', B: 'Empirikus', KODOK: 'Kodok' };
const META = ['id', 'Feldolgozó', 'Létrehozva', 'Módosítva', 'Utoljára módosította'];
const KOD_FEJLEC = ['kategoria', 'kod', 'leiras', 'hozzaadta', 'datum'];

/* ===================== Beállítás és menü ===================== */

/** Egyszer futtasd le a szerkesztőből: engedélyeket kér, létrehozza a Projektek lapot. */
function elsoBeallitas() {
  adminLap();
  titok();
  Logger.log('Kész. Töltsd újra a táblázatot: megjelenik a Cikkfeldolgozó menü.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Cikkfeldolgozó')
    .addItem('Új projekt létrehozása', 'ujProjekt')
    .addItem('Jelszó beállítása vagy cseréje', 'jelszoBeallitas')
    .addSeparator()
    .addItem('Projektek ellenőrzése', 'projektekEllenorzese')
    .addToUi();
}

function ujProjekt() {
  const ui = SpreadsheetApp.getUi();
  const kulcsBe = kerdez(ui, 'Új projekt (1/3)',
    'Projektkulcs: rövid azonosító angol nagybetűkkel, számokkal, kötőjellel (pl. FMCG-ML). Ez kerül a linkbe.');
  if (kulcsBe === null) return;
  const kulcs = normKulcs(kulcsBe);
  if (!kulcsJo(kulcs)) { ui.alert('A projektkulcs 2-32 karakter lehet: angol nagybetű, szám, kötőjel, aláhúzás.'); return; }
  if (projektKeres(kulcs)) { ui.alert('Ilyen projektkulcs már létezik.'); return; }

  const nev = kerdez(ui, 'Új projekt (2/3)', 'A projekt neve (pl. Kovács Anna PhD, ML-alapú kereslet-előrejelzés).');
  if (nev === null) return;

  const jelszo = kerdez(ui, 'Új projekt (3/3)',
    'Közös jelszó a projekthez, legalább 8 karakter. A táblázatba csak titkosított (hash) formában kerül.');
  if (jelszo === null) return;
  if (jelszo.length < 8) { ui.alert('A jelszó legalább 8 karakter legyen. A projekt nem jött létre.'); return; }

  const uj = SpreadsheetApp.create('Cikkfeldolgozó: ' + (nev || kulcs));
  projektLapok(uj);

  const sh = adminLap();
  const fej = fejlec(sh);
  const sor = sh.getLastRow() + 1;
  const ert = {
    'projektkulcs': kulcs,
    'projekt neve': nev,
    'táblázat': uj.getUrl(),
    'aktív': true,
    'jelszó-hash': hashJelszo(jelszo),
    'létrehozva': most()
  };
  sh.getRange(sor, 1, 1, fej.length).setValues([fej.map(function (h) { return h in ert ? ert[h] : ''; })]);
  sh.getRange(sor, fej.indexOf('aktív') + 1).insertCheckboxes().check();

  ui.alert('A projekt létrejött',
    'Meghívó link a hallgatóknak:\n' + meghivoLink(kulcs) +
    '\n\nA jelszót külön csatornán add át (ne a linkkel egy üzenetben).' +
    '\n\nA projekt adatai ebben a táblázatban lesznek (a Drive gyökérmappájába került, áthelyezheted):\n' + uj.getUrl(),
    ui.ButtonSet.OK);
}

function jelszoBeallitas() {
  const ui = SpreadsheetApp.getUi();
  const kulcsBe = kerdez(ui, 'Jelszó beállítása (1/2)', 'Melyik projekt? Add meg a projektkulcsot.');
  if (kulcsBe === null) return;
  const p = projektKeres(normKulcs(kulcsBe));
  if (!p) { ui.alert('Nincs ilyen projektkulcs a Projektek lapon.'); return; }
  const jelszo = kerdez(ui, 'Jelszó beállítása (2/2)', 'Az új közös jelszó (legalább 8 karakter).');
  if (jelszo === null) return;
  if (jelszo.length < 8) { ui.alert('A jelszó legalább 8 karakter legyen. Nem változott semmi.'); return; }
  const sh = adminLap();
  sh.getRange(p.sor, fejlec(sh).indexOf('jelszó-hash') + 1).setValue(hashJelszo(jelszo));
  ui.alert('Kész. A projekt korábbi belépései érvénytelenné váltak, mindenkinek az új jelszóval kell belépnie.');
}

function projektekEllenorzese() {
  const ui = SpreadsheetApp.getUi();
  const lista = projektek();
  if (!lista.length) { ui.alert('Még nincs projekt. Használd az Új projekt létrehozása menüpontot.'); return; }
  const sorok = lista.map(function (p) {
    const hibak = [];
    if (!kulcsJo(p.kulcs)) hibak.push('a kulcs formátuma hibás');
    if (!p.hash) hibak.push('nincs jelszó (Jelszó beállítása menü)');
    if (!p.ssId) hibak.push('nincs táblázat megadva');
    else {
      try { SpreadsheetApp.openById(p.ssId); } catch (e) { hibak.push('a táblázat nem nyitható meg'); }
    }
    if (!p.aktiv) hibak.push('kikapcsolva');
    return p.kulcs + ': ' + (hibak.length ? hibak.join(', ') : 'rendben') + '\n   ' + meghivoLink(p.kulcs);
  });
  ui.alert('Projektek', sorok.join('\n\n'), ui.ButtonSet.OK);
}

function kerdez(ui, cim, szoveg) {
  const r = ui.prompt(cim, szoveg, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return r.getResponseText().trim();
}

function meghivoLink(kulcs) {
  return (OLDAL_URL || '[a GitHub Pages oldal címe]/') + '?p=' + encodeURIComponent(kulcs);
}

/* ===================== Webalkalmazás ===================== */

function doGet() {
  return valasz({ ok: true, uzenet: 'A Cikkfeldolgozó szervere működik.', ido: most() });
}

function doPost(e) {
  let b;
  try {
    b = JSON.parse(e.postData.contents);
  } catch (err) {
    return valasz({ ok: false, error: 'A kérés nem értelmezhető.' });
  }
  try {
    if (b.action === 'login') return valasz(belepes(b));

    const p = belepesEllenoriz(b.token);
    let ss;
    try { ss = SpreadsheetApp.openById(p.ssId); }
    catch (err) { return valasz({ ok: false, error: 'A projekt táblázata nem érhető el. Szólj a projekt gazdájának.' }); }

    if (b.action === 'getAll') {
      return valasz({
        ok: true,
        projekt: { kulcs: p.kulcs, nev: p.nev },
        records: { A: olvas(ss, LAPOK.A), B: olvas(ss, LAPOK.B) },
        codes: olvas(ss, LAPOK.KODOK),
        ido: most()
      });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (b.action === 'saveRecord') return valasz(mentRekord(ss, b.record));
      if (b.action === 'addCode') return valasz(ujKod(ss, b.code));
    } finally {
      lock.releaseLock();
    }
    return valasz({ ok: false, error: 'Ismeretlen művelet.' });
  } catch (err) {
    if (err && err.auth) return valasz({ ok: false, code: 'AUTH', error: err.message });
    return valasz({ ok: false, error: String((err && err.message) || err) });
  }
}

function valasz(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== Belépés ===================== */

function belepes(b) {
  const kulcs = normKulcs(b.projekt);
  const jelszo = String(b.jelszo || '');
  if (!kulcs || !jelszo) return { ok: false, error: 'Add meg a projektkulcsot és a jelszót.' };

  const cache = CacheService.getScriptCache();
  const ck = 'hiba_' + kulcs.slice(0, 40);
  const n = Number(cache.get(ck) || 0);
  if (n >= HIBA_LIMIT) {
    return { ok: false, error: 'Túl sok sikertelen próbálkozás. Próbáld újra ' + HIBA_PERC + ' perc múlva.' };
  }

  const p = projektKeres(kulcs);
  const jo = !!(p && p.aktiv && p.hash && jelszoEllenoriz(jelszo, p.hash));
  if (!jo) {
    cache.put(ck, String(n + 1), HIBA_PERC * 60);
    Utilities.sleep(700);
    return { ok: false, error: 'Hibás projektkulcs vagy jelszó.' };
  }
  cache.remove(ck);
  if (!p.ssId) return { ok: false, error: 'A projekthez még nincs táblázat rendelve. Szólj a projekt gazdájának.' };

  const t = belepesiKulcs(p);
  return { ok: true, token: t.token, lejar: t.lejar, projekt: { kulcs: p.kulcs, nev: p.nev } };
}

function belepesiKulcs(p) {
  const lejar = Date.now() + BELEPES_NAP * 24 * 3600 * 1000;
  const adat = p.kulcs + '|' + lejar;
  return { token: Utilities.base64EncodeWebSafe(adat) + '.' + alairas(adat, p.hash), lejar: lejar };
}

// Az aláírásba a jelszó-hash vége is belekerül, így jelszócserekor minden régi belépés érvénytelen lesz.
function alairas(adat, hash) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(adat + '|' + String(hash).slice(-24), titok()));
}

function belepesEllenoriz(token) {
  const t = String(token || '').split('.');
  if (t.length !== 2) throw authHiba('Jelentkezz be.');
  let adat;
  try {
    adat = Utilities.newBlob(Utilities.base64DecodeWebSafe(t[0])).getDataAsString();
  } catch (e) {
    throw authHiba('Érvénytelen belépés, jelentkezz be újra.');
  }
  const r = adat.split('|');
  const p = projektKeres(r[0]);
  if (!p || !p.aktiv || !p.hash) throw authHiba('A projekt nem érhető el. Szólj a projekt gazdájának.');
  if (!egyenlo(alairas(adat, p.hash), t[1])) throw authHiba('A belépés már nem érvényes (például jelszócsere miatt). Jelentkezz be újra.');
  if (!(Number(r[1]) > Date.now())) throw authHiba('A belépés lejárt, jelentkezz be újra.');
  return p;
}

function authHiba(uzenet) {
  const e = new Error(uzenet);
  e.auth = true;
  return e;
}

function titok() {
  const pr = PropertiesService.getScriptProperties();
  let t = pr.getProperty('TITOK');
  if (!t) {
    t = Utilities.getUuid() + Utilities.getUuid();
    pr.setProperty('TITOK', t);
  }
  return t;
}

/* ===================== Jelszó-hash ===================== */

function hex(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function hashJelszo(jelszo, so, kor) {
  so = so || Utilities.getUuid().replace(/-/g, '');
  kor = kor || HASH_KOR;
  let h = String(jelszo);
  for (let i = 0; i < kor; i++) {
    h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, so + ':' + h, Utilities.Charset.UTF_8));
  }
  return 'v1$' + kor + '$' + so + '$' + h;
}

function jelszoEllenoriz(jelszo, tarolt) {
  const r = String(tarolt).split('$');
  if (r.length !== 4 || r[0] !== 'v1' || !(Number(r[1]) > 0)) return false;
  return egyenlo(hashJelszo(jelszo, r[2], Number(r[1])), String(tarolt));
}

function egyenlo(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ===================== Projektek ===================== */

function normKulcs(s) {
  return String(s || '').trim().toUpperCase();
}

function kulcsJo(k) {
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(k);
}

function tablazatId(v) {
  const s = String(v || '').trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}

function adminLap() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ADMIN_LAP);
  if (!sh) {
    const lapok = ss.getSheets();
    sh = (lapok.length === 1 && lapok[0].getLastRow() === 0) ? lapok[0].setName(ADMIN_LAP) : ss.insertSheet(ADMIN_LAP);
  }
  fejlecBiztosit(sh, ADMIN_FEJ);
  return sh;
}

function projektek() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ADMIN_LAP);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const fej = v[0].map(String);
  const o = function (n) { return fej.indexOf(n); };
  return v.slice(1).map(function (s, j) {
    const aktiv = s[o('aktív')];
    return {
      sor: j + 2,
      kulcs: normKulcs(s[o('projektkulcs')]),
      nev: String(s[o('projekt neve')] || ''),
      ssId: tablazatId(s[o('táblázat')]),
      aktiv: !(aktiv === false || /^(nem|false|0|hamis)$/i.test(String(aktiv).trim())),
      hash: String(s[o('jelszó-hash')] || '').trim()
    };
  }).filter(function (p) { return p.kulcs; });
}

function projektKeres(kulcs) {
  const k = normKulcs(kulcs);
  if (!k) return null;
  return projektek().filter(function (p) { return p.kulcs === k; })[0] || null;
}

/* ===================== Projekttáblázat ===================== */

function most() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}

function lap(ss, nev) {
  return ss.getSheetByName(nev) || ss.insertSheet(nev);
}

function projektLapok(ss) {
  const lapok = ss.getSheets();
  if (lapok.length === 1 && lapok[0].getLastRow() === 0 && !ss.getSheetByName(LAPOK.A)) lapok[0].setName(LAPOK.A);
  fejlecBiztosit(lap(ss, LAPOK.A), META);
  fejlecBiztosit(lap(ss, LAPOK.B), META);
  fejlecBiztosit(lap(ss, LAPOK.KODOK), KOD_FEJLEC);
}

function fejlec(sh) {
  const n = sh.getLastColumn();
  return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
}

function fejlecBiztosit(sh, kulcsok) {
  const fej = fejlec(sh);
  const hianyzo = kulcsok.filter(function (k) { return fej.indexOf(k) < 0; });
  if (hianyzo.length) {
    sh.getRange(1, fej.length + 1, 1, hianyzo.length).setValues([hianyzo]);
    sh.getRange(1, 1, 1, fej.length + hianyzo.length).setFontWeight('bold').setBackground('#e8efe9');
    sh.setFrozenRows(1);
  }
  return fej.concat(hianyzo);
}

function olvas(ss, nev) {
  const sh = ss.getSheetByName(nev);
  if (!sh || sh.getLastRow() < 2) return [];
  const ert = sh.getDataRange().getValues();
  const fej = ert[0].map(String);
  return ert.slice(1)
    .filter(function (s) { return s.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (s) {
      const o = {};
      fej.forEach(function (h, i) {
        if (!h) return;
        const v = s[i];
        o[h] = v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : v;
      });
      return o;
    });
}

function tisztit(v) {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join(', ') : String(v);
  if (s.charAt(0) === '=') s = "'" + s; // ne fusson le képletként
  return s.slice(0, 49000);
}

/** Rekord mentése: ha az id már létezik, frissíti a sort, különben új sort ír. */
function mentRekord(ss, rec) {
  if (!rec || (rec.type !== 'A' && rec.type !== 'B')) return { ok: false, error: 'Ismeretlen sablontípus.' };
  if (!rec.id) return { ok: false, error: 'Hiányzó azonosító.' };
  const mezok = rec.fields || {};
  const sh = lap(ss, LAPOK[rec.type]);
  const fej = fejlecBiztosit(sh, META.concat(Object.keys(mezok)));
  const ido = most();
  const idOszlop = fej.indexOf('id') + 1;

  let sor = -1;
  const utolso = sh.getLastRow();
  if (utolso > 1) {
    const ids = sh.getRange(2, idOszlop, utolso - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(rec.id)) { sor = i + 2; break; }
    }
  }
  const regi = sor > 0 ? sh.getRange(sor, 1, 1, fej.length).getValues()[0] : null;

  const ujSor = fej.map(function (h, i) {
    if (h === 'id') return String(rec.id);
    if (h === 'Feldolgozó') return regi && regi[i] ? regi[i] : tisztit(rec.user);
    if (h === 'Létrehozva') return regi && regi[i] ? regi[i] : ido;
    if (h === 'Módosítva') return ido;
    if (h === 'Utoljára módosította') return tisztit(rec.user);
    if (Object.prototype.hasOwnProperty.call(mezok, h)) return tisztit(mezok[h]);
    return regi ? regi[i] : '';
  });

  const tart = sh.getRange(sor > 0 ? sor : utolso + 1, 1, 1, fej.length);
  tart.setNumberFormat('@');
  tart.setValues([ujSor]);
  return { ok: true, id: String(rec.id), modositva: ido };
}

/** Új kód felvétele egy kategóriába (ismétlődést nem ír be kétszer). */
function ujKod(ss, k) {
  if (!k || !k.kategoria || !k.kod) return { ok: false, error: 'Hiányzó kategória vagy kód.' };
  const kod = String(k.kod).trim().toUpperCase().replace(/,/g, ' ').slice(0, 24);
  const sh = lap(ss, LAPOK.KODOK);
  const fej = fejlecBiztosit(sh, KOD_FEJLEC);
  const van = olvas(ss, LAPOK.KODOK).some(function (r) {
    return r.kategoria === k.kategoria && String(r.kod).toUpperCase() === kod;
  });
  if (van) return { ok: true, duplikalt: true, kod: kod };
  const ert = {
    kategoria: tisztit(k.kategoria),
    kod: tisztit(kod),
    leiras: tisztit(k.leiras || ''),
    hozzaadta: tisztit(k.hozzaadta || ''),
    datum: most()
  };
  const tart = sh.getRange(sh.getLastRow() + 1, 1, 1, fej.length);
  tart.setNumberFormat('@');
  tart.setValues([fej.map(function (h) { return h in ert ? ert[h] : ''; })]);
  return { ok: true, kod: kod };
}

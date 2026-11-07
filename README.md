# Cikkfeldolgozó

Szakirodalmi feldolgozó sablonok PhD-hallgatóknak a gépi tanulás alapú kereslet-előrejelzés (FMCG) témához. Két sablon van: **A** a review cikkekhez, **B** az empirikus cikkekhez. A sablon blokkonként vezet végig, minden mezőnél súgóval. A kódlisták bővíthetők, és minden feldolgozás egy közös Google táblázatba kerül, ahol mindenki látja a többiek munkáját.

A belépés **projektkulccsal** és **jelszóval** történik. Egy projekt egy hallgatóé, és minden projekt adatai külön Google táblázatban vannak. A hallgató a feldolgozott cikkeit a „Feldolgozott cikkek” fülön Excel- vagy CSV-táblázatként is letöltheti, az oszlopokat ő választja ki.

## Fájlok

| Fájl | Mire való |
| --- | --- |
| `index.html` | Az alkalmazás, ezt nyitják meg a hallgatók (GitHub Pages). |
| `config.js` | Egyetlen beállítás: az Apps Script webalkalmazás címe. |
| `apps-script/Code.gs` | A szerveroldali kód. Ezt a Google táblázat Apps Script szerkesztőjébe kell másolni, a GitHubon csak tárolásra van. |

## Telepítés (egyszer, kb. 15 perc)

### 1. Központi táblázat és Apps Script

1. Hozz létre egy új Google táblázatot, például **Cikkfeldolgozó projektek** néven. Ez lesz a projektek nyilvántartása. A hallgatók ezt soha nem látják.
2. A táblázatban: **Bővítmények → Apps Script**.
3. Töröld a szerkesztőben lévő mintakódot, és másold be az `apps-script/Code.gs` teljes tartalmát.
4. A fájl elején az `OLDAL_URL` sorba írd be a GitHub-oldal címét (lásd 2. lépés), például `'https://csarnold8011.github.io/cikkfeldolgozo/'`. Ez csak ahhoz kell, hogy a menü kész meghívó linket írjon ki. Ráérsz később is.
5. Mentés (Ctrl+S).
6. A felső függvényválasztóban válaszd az **elsoBeallitas** függvényt, és kattints a **Futtatás** gombra. Engedélyezd a hozzáférést a saját fiókoddal (a „Google nem ellenőrizte ezt az alkalmazást” ablakban: Speciális → Ugrás a projekthez). Ekkor létrejön a **Projektek** lap.
7. **Üzembe helyezés → Új üzembe helyezés**. A típusnál (fogaskerék ikon) válaszd a **Webalkalmazás** lehetőséget.
   * Végrehajtás mint: **Én**
   * Hozzáféréssel rendelkezik: **Bárki**
8. Kattints az **Üzembe helyezés** gombra, és másold ki a **webalkalmazás URL-jét** (`https://script.google.com/macros/s/.../exec`).

A „Bárki” hozzáférés azt jelenti, hogy a hallgatóknak nem kell Google-fiókkal belépniük. A táblázatokat ők nem látják, csak a jelszóval védett alkalmazáson keresztül írnak beléjük.

### 2. GitHub Pages

1. Hozz létre egy új **nyilvános** repót, például `cikkfeldolgozo` néven.
2. Töltsd fel az `index.html`, a `config.js` és az `apps-script` mappát (Add file → Upload files).
3. Szerkeszd a `config.js` fájlt a GitHubon (ceruza ikon), és illeszd be az 1. lépés végén kapott URL-t:
   ```js
   window.CF_CONFIG = {
     apiUrl: 'https://script.google.com/macros/s/.../exec'
   };
   ```
4. **Settings → Pages**: Source: *Deploy from a branch*, Branch: *main*, mappa: */ (root)*. Mentés.
5. Egy-két perc múlva elérhető: `https://csarnold8011.github.io/cikkfeldolgozo/`

### 3. Első projekt

1. Töltsd újra a központi táblázatot. Megjelenik a **Cikkfeldolgozó** menü.
2. **Cikkfeldolgozó → Új projekt létrehozása**. Három kérdés jön:
   * projektkulcs (pl. `FMCG-ML`; angol nagybetű, szám, kötőjel),
   * a projekt neve (pl. *Kovács Anna PhD, ML-alapú kereslet-előrejelzés*),
   * közös jelszó (legalább 8 karakter).
3. A script létrehozza a projekt saját táblázatát (Review, Empirikus, Kodok lappal), és kiírja a meghívó linket:
   `https://csarnold8011.github.io/cikkfeldolgozo/?p=FMCG-ML`
4. A linket és a jelszót **külön üzenetben** küldd el a hallgatónak. Belépéskor a projektkulcs a linkből kitöltődik, neki csak a jelszót és a nevét kell beírnia.

Tipp: próbáld ki egyszer te magad is a linket, és ments el egy tesztcikket. Utána a projekt táblázatában töröld a teszt sort.

## Napi kezelés

| Teendő | Hogyan |
| --- | --- |
| Új projekt | Cikkfeldolgozó menü → Új projekt létrehozása |
| Jelszócsere | Cikkfeldolgozó menü → Jelszó beállítása vagy cseréje. A régi belépések azonnal érvénytelenek, mindenkinek újra be kell lépnie. |
| Projekt ideiglenes lezárása | A Projektek lapon az **aktív** jelölőnégyzet kikapcsolása. Visszakapcsolva újra működik. |
| Meglévő táblázat bekötése | A Projektek lapon új sor: kulcs, név, a **táblázat** oszlopba a táblázat linkje, aktív bepipálva. Utána: Jelszó beállítása. |
| Állapot ellenőrzése | Cikkfeldolgozó menü → Projektek ellenőrzése |
| Elemzés Excelben | A hallgató az oldalon: Feldolgozott cikkek → Letöltés táblázatként (oszlopválasztással). Te a projekt táblázatából is letöltheted: Fájl → Letöltés → Microsoft Excel. |
| A szintézismátrix alaposzlopai | Az `index.html` fájlban, a `MATRIX` résznél. |
| Hibás vagy felesleges kód törlése | A projekt táblázatának **Kodok** lapján töröld a sort. Az alapkódok az `index.html` fájlban vannak (`DEFAULT_CODES`). |
| Rekord javítása vagy törlése | Közvetlenül a projekt táblázatában. Az **id** oszlopot ne módosítsd. |
| A Code.gs módosítása után | Üzembe helyezés → Üzembe helyezések kezelése → ceruza → Verzió: **Új verzió** → Üzembe helyezés. Így az URL nem változik. |
| A sablon (mezők, súgók) módosítása | Az `index.html` fájlban, a `TPL` résznél. Egy meglévő mező nevét ne nevezd át, mert az a táblázat oszlopneve is; új mező nyugodtan felvehető, a táblázatban új oszlop lesz belőle. |

## Biztonság röviden

* A jelszó a táblázatba csak sózott, többszörösen hash-elt formában kerül, olvashatóan sehol nincs tárolva.
* Belépés után a böngésző egy aláírt belépési kulcsot kap, ami két hétig érvényes. Jelszócserekor vagy a projekt kikapcsolásakor azonnal érvénytelenné válik.
* Tíz hibás jelszó után a projekt belépése 15 percre zárolódik.
* A GitHubon lévő kód nyilvános, de titkot nem tartalmaz. Az Apps Script URL ismerete jelszó nélkül nem ad hozzáférést az adatokhoz.
* Ez a védelmi szint egy szakirodalmi jegyzetanyaghoz megfelelő. Személyes vagy érzékeny adat tárolására nem ajánlott.
* A projekt jelszavát csak a hallgató és te ismeritek. Ha te is javítasz egy feldolgozást az oldalon, a táblázat **Utoljára módosította** oszlopa ezt mutatja, a Google táblázat verzióelőzményei pedig minden korábbi állapotot megőriznek.
* Az Excel-letöltéshez az oldal a SheetJS könyvtárat tölti be a cdnjs.cloudflare.com címről. Ha ez valahol blokkolva van, a CSV-letöltés akkor is működik.

## Hibaelhárítás

* **„Az oldal még nincs beállítva”**: a `config.js` fájlban üres az `apiUrl`.
* **„A szerver nem a várt választ adta”**: az üzembe helyezésnél a hozzáférés nem *Bárki*, vagy a `config.js`-ben rossz az URL. Az URL-t böngészőben megnyitva ezt kell látni: `{"ok":true,"uzenet":"A Cikkfeldolgozó szervere működik." ...}`
* **„Hibás projektkulcs vagy jelszó”** helyes adatokkal: a projektnek nincs jelszava, vagy nincs bepipálva az aktív oszlop (Projektek ellenőrzése menü).
* **„A projekt táblázata nem érhető el”**: a táblázat oszlopban lévő link vagy azonosító hibás, vagy a táblázatot törölték.

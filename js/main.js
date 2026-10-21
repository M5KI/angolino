/* L'Angolino: Speisekarte, Öffnungszeiten und Stimmen aus data/*.json, dazu Video, Navigation, Lightbox.
   Ohne JavaScript bleiben Kontakt, Öffnungszeiten und das erste Zitat aus dem HTML stehen. */
(() => {
"use strict";

const $ = s => document.querySelector(s);
const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Seitenwurzel aus der Lage dieses Skripts, damit Daten und Video auch unter /it/ gefunden werden
const BASIS = new URL("..", document.currentScript.src);
const IT = document.documentElement.lang === "it";
const T = IT ? {
  tage: ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"],
  ruhetag: "Chiuso", zeit: (a, b) => `${a} – ${b}`, offen: b => `Aperto oggi fino alle ${b}`,
  zu: (wann, a) => `Chiuso · ${wann} dalle ${a}`, heute: "oggi", morgen: "domani",
  bewertungen: n => `${n} recensioni su Google`, quelle: "su Google", bewertung: i => `Recensione ${i}`,
  kopieren: "Copia numero", kopiert: "Copiato", markiert: "Selezionato", pause: "Metti in pausa il video", spielen: "Riproduci il video",
  fehler: "Non è stato possibile caricare il menù. Ricarica la pagina oppure chiama lo +49 8561 900 1109.",
} : {
  tage: null,
  ruhetag: "Ruhetag", zeit: (a, b) => `${a} bis ${b} Uhr`, offen: b => `Heute geöffnet bis ${b} Uhr`,
  zu: (wann, a) => `Geschlossen · ${wann} ab ${a} Uhr`, heute: "heute", morgen: "morgen",
  bewertungen: n => `${n} Bewertungen auf Google`, quelle: "auf Google", bewertung: i => `Bewertung ${i}`,
  kopieren: "Nummer kopieren", kopiert: "Kopiert", markiert: "Markiert", pause: "Video anhalten", spielen: "Video abspielen",
  fehler: "Die Speisekarte konnte nicht geladen werden. Bitte die Seite neu laden oder unter +49 8561 900 1109 anrufen.",
};
const it = (obj, feld) => (IT && obj[feld + "_it"]) || obj[feld];  // italienisches Feld, sonst das deutsche
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const ladeJSON = name => fetch(new URL(`data/${name}.json`, BASIS)).then(r => { if (!r.ok) throw new Error(`${name}.json: ${r.status}`); return r.json(); });
const zuStunden = t => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
const fmt = h => { const m = Math.round((h % 1) * 60); return String(Math.floor(h)).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };

// Speisekarte (ARIA-Tabs: Pfeiltasten, Pos1/Ende, nur der aktive Tab ist per Tab-Taste erreichbar)
function speisekarte(karte) {
  const tabs = $("#tabs"), panel = $("#menuPanel"), kat = karte.kategorien;
  if (karte.stand) $("#menuStand").textContent = it(karte, "stand");
  tabs.innerHTML = kat.map((k, i) =>
    `<button type="button" role="tab" id="tab-${i}" aria-controls="menuPanel" aria-selected="false" tabindex="-1">${esc(k.name)}</button>`).join("");
  const knoepfe = [...tabs.children];
  function zeige(i, fokus) {
    knoepfe.forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    panel.setAttribute("aria-labelledby", knoepfe[i].id);
    panel.innerHTML = kat[i].gruppen.map(g => `<div class="group"><h3>${esc(it(g, "titel"))}</h3>${g.hinweis ? `<p>${esc(it(g, "hinweis"))}</p>` : ""}</div>` +
      g.gerichte.map(d => `<div class="dish"><div class="n">${esc(it(d, "name"))}${d.allergene ? `<sup>${esc(d.allergene)}</sup>` : ""}</div><div class="p">${esc(d.preis)} €</div>${d.beschreibung ? `<div class="d">${esc(it(d, "beschreibung"))}</div>` : ""}</div>`).join("")).join("");
    if (fokus) knoepfe[i].focus();
  }
  tabs.addEventListener("click", e => { const b = e.target.closest('[role="tab"]'); if (b) zeige(knoepfe.indexOf(b)); });
  tabs.addEventListener("keydown", e => {
    const i = knoepfe.indexOf(document.activeElement);
    const ziel = {ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: knoepfe.length - 1}[e.key];
    if (i < 0 || ziel === undefined) return;
    e.preventDefault();
    zeige((ziel + knoepfe.length) % knoepfe.length, true);
  });
  zeige(Math.max(0, kat.findIndex(k => k.name === karte.standardKategorie)));
}

// Öffnungszeiten + Live-Status, immer in der Zeit des Bistros (Europe/Berlin), egal wo der Besucher ist
function oeffnungszeiten(daten) {
  const tage = daten.tage.map((t, i) => ({tag: T.tage ? T.tage[i] : t.tag, zeit: t.von && t.bis ? [zuStunden(t.von), zuStunden(t.bis)] : null}));
  const teile = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: daten.zeitzone || "Europe/Berlin",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).formatToParts(new Date()).map(p => [p.type, p.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(teile.weekday), h = +teile.hour + teile.minute / 60;
  $("#hours").innerHTML = "<tbody>" + tage.map(({tag, zeit}, i) =>
    `<tr class="${i === wd ? "today" : ""}"><td>${esc(tag)}</td><td>${zeit ? T.zeit(fmt(zeit[0]), fmt(zeit[1])) : T.ruhetag}</td></tr>`).join("") + "</tbody>";
  const st = $("#status"), tx = $("#statusText"), heute = tage[wd].zeit;
  if (heute && h >= heute[0] && h < heute[1]) { tx.textContent = T.offen(fmt(heute[1])); return; }
  st.classList.add("closed");
  for (let k = 0; k < 8; k++) {
    const j = (wd + k) % 7, z = tage[j].zeit;
    if (!z || (k === 0 && h >= z[0])) continue;
    tx.textContent = T.zu(k === 0 ? T.heute : k === 1 ? T.morgen : IT ? tage[j].tag.toLowerCase() : tage[j].tag, fmt(z[0]));
    return;
  }
}

// Stimmen: Zitate rotieren alle 6,5 s; ein Klick auf einen Punkt hält die Rotation an
function stimmen(daten) {
  $("#score").textContent = daten.sterne;
  $("#scoreCount").textContent = T.bewertungen(daten.anzahl);
  const zitate = daten.zitate, box = $("#quote"), qText = $("#qText"), qName = $("#qName"), qDots = $("#qDots");
  let qi = 0, qt;
  qDots.innerHTML = zitate.map((_, i) => `<button type="button" aria-label="${T.bewertung(i + 1)}"></button>`).join("");
  const setze = i => { qText.textContent = "„" + zitate[i].text + "“"; qName.textContent = zitate[i].name + " " + T.quelle; };
  function zeige(i) {
    qi = i; qText.style.opacity = 0;
    setTimeout(() => { setze(i); qText.style.opacity = 1; }, 250);
    [...qDots.children].forEach((d, j) => d.setAttribute("aria-current", String(i === j)));
  }
  qDots.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    clearInterval(qt); box.setAttribute("aria-live", "polite");  // Vorlesen erst, wenn der Besucher selbst wählt
    zeige([...qDots.children].indexOf(b));
  });
  setze(0); qDots.children[0].setAttribute("aria-current", "true");
  if (ruhig) box.setAttribute("aria-live", "polite");
  else qt = setInterval(() => zeige((qi + 1) % zitate.length), 6500);
}

Promise.allSettled([
  ladeJSON("speisekarte").then(speisekarte).catch(e => {
    $("#menuPanel").innerHTML = `<p class="note">${T.fehler}</p>`;
    throw e;
  }),
  ladeJSON("oeffnungszeiten").then(oeffnungszeiten),
  ladeJSON("bewertungen").then(stimmen),
]).then(r => r.filter(x => x.status === "rejected").forEach(x => console.error(x.reason)));

// Telefonnummer kopieren
const copy = $("#copy");
copy.hidden = false;
copy.onclick = async () => {
  const nummer = $("#num").textContent.trim();
  try { await navigator.clipboard.writeText(nummer); copy.textContent = T.kopiert; }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("#num")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = T.markiert; }
  setTimeout(() => copy.textContent = T.kopieren, 2000);
};

// Hero-Video: Quellen erst nach dem Seitenaufbau setzen, im Datensparmodus nur das Poster zeigen
const vid = $("#vid"), vt = $("#vidToggle"), hero = $(".hero"), poster = $(".hero .poster");
if (navigator.connection && navigator.connection.saveData) {
  vid.remove();
} else {
  let angehalten = ruhig;  // vom Besucher oder per prefers-reduced-motion angehalten
  const knopf = () => {
    vt.textContent = vid.paused ? "▶" : "❚❚";
    vt.setAttribute("aria-label", vid.paused ? T.spielen : T.pause);
  };
  const starte = () => {
    const basis = new URL("assets/hero-loop" + (matchMedia("(max-width: 700px)").matches ? "-mobil" : ""), BASIS).href;
    vid.innerHTML = `<source src="${basis}.webm" type="video/webm"><source src="${basis}.mp4" type="video/mp4">`;
    if (poster.currentSrc) vid.poster = poster.currentSrc;
    if (ruhig) vid.removeAttribute("autoplay");
    vid.hidden = false;
    vid.load();
    if (ruhig) knopf(); else vid.play().catch(knopf);
    vt.hidden = false;
    // außerhalb des Sichtbereichs pausieren, spart Akku und Rechenzeit
    new IntersectionObserver(([e]) => { if (!angehalten) e.isIntersecting ? vid.play().catch(knopf) : vid.pause(); }).observe(hero);
    ambient();
  };
  // Breite Monitore (breiter als 2:1): Das Video ist dort schmaler als der Hero (siehe CSS), die Seiten füllt ein
  // winziges, per CSS stark weichgezeichnetes Abbild desselben Videos, ca. 12 Bilder pro Sekunde, nur während es läuft
  const breit = matchMedia("(min-aspect-ratio: 2/1)");
  const leinwand = Object.assign(document.createElement("canvas"), {className: "ambient", width: 64, height: 36});
  leinwand.setAttribute("aria-hidden", "true");
  const ctx = leinwand.getContext("2d");
  let zuletzt = 0;
  const zeichne = () => {
    if (vid.readyState >= 2) ctx.drawImage(vid, 0, 0, 64, 36);
    else if (poster.complete && poster.naturalWidth) ctx.drawImage(poster, 0, 0, 64, 36);
  };
  const schleife = t => {
    if (!leinwand.isConnected || vid.paused) return;
    if (t - zuletzt > 80) { zeichne(); zuletzt = t; }
    requestAnimationFrame(schleife);
  };
  const ambient = () => {
    if (!breit.matches) { leinwand.remove(); return; }
    if (!leinwand.isConnected) vid.before(leinwand);
    zeichne();
    requestAnimationFrame(schleife);
  };
  breit.addEventListener("change", () => { if (!vid.hidden) ambient(); });
  ["loadeddata", "seeked", "pause"].forEach(ereignis => vid.addEventListener(ereignis, () => { if (leinwand.isConnected) zeichne(); }));
  vid.addEventListener("play", () => { if (leinwand.isConnected) requestAnimationFrame(schleife); });
  vid.addEventListener("play", knopf);
  vid.addEventListener("pause", knopf);
  vt.onclick = () => { angehalten = !vid.paused; angehalten ? vid.pause() : vid.play().catch(knopf); };
  document.readyState === "complete" ? starte() : addEventListener("load", starte, {once: true});
}

// Navigation: ab 60 % der Fensterhöhe Creme mit rotem Logo
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("solid", scrollY > innerHeight * .6);
addEventListener("scroll", onScroll, {passive: true});
onScroll();

// Abschnitte beim Hereinscrollen einblenden (.wipe: Porträt mit Wisch-Animation wie das Logo im Hero)
if ("IntersectionObserver" in window && !ruhig) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove("pre"); io.unobserve(e.target); } }), {rootMargin: "0px 0px -8% 0px"});
  document.querySelectorAll(".reveal, .wipe").forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("pre"); io.observe(el); } });
}

// La storia: rote Linie wächst beim Scrollen durch die Zeitleiste, "36" zählt beim Hereinscrollen hoch
const zeitleiste = $("#timeline");
if (zeitleiste && !ruhig) {
  const stationen = [...zeitleiste.querySelectorAll(".station")];
  let geplant = false;
  const linie = () => {
    geplant = false;
    const r = zeitleiste.getBoundingClientRect(), marke = innerHeight * .6;
    zeitleiste.style.setProperty("--fortschritt", Math.min(1, Math.max(0, (marke - r.top) / r.height)).toFixed(3));
    stationen.forEach(s => s.classList.toggle("erreicht", s.getBoundingClientRect().top < marke));
  };
  zeitleiste.classList.add("live");
  linie();
  addEventListener("scroll", () => { if (!geplant) { geplant = true; requestAnimationFrame(linie); } }, {passive: true});
  addEventListener("resize", linie);
}
document.querySelectorAll("[data-zaehlen]").forEach(el => {
  if (ruhig || !("IntersectionObserver" in window) || el.getBoundingClientRect().top < innerHeight) return;
  const ziel = +el.dataset.zaehlen;
  el.textContent = "0";
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const t0 = performance.now();
    const schritt = t => { const p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(ziel * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(schritt); };
    requestAnimationFrame(schritt);
  }, {threshold: .6});
  io.observe(el);
});

// Galerie-Lightbox: Esc schließt, Fokus bleibt im Dialog und kehrt danach zum Bild zurück
const lb = $("#lb"), lbImg = $("#lbImg"), lbClose = $("#lbClose"), aussen = [nav, $("main"), $("footer")];
let ausloeser = null;
$("#mosaic").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  ausloeser = b;
  lbImg.src = b.dataset.src; lbImg.alt = b.querySelector("img").alt;
  lb.hidden = false; aussen.forEach(el => el.inert = true);
  lbClose.focus();
});
function schliesse() {
  if (lb.hidden) return;
  lb.hidden = true; aussen.forEach(el => el.inert = false);
  if (ausloeser) ausloeser.focus();
}
lbClose.onclick = schliesse;
lb.addEventListener("click", e => { if (e.target === lb) schliesse(); });
document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "Escape") schliesse();
  else if (e.key === "Tab") { e.preventDefault(); lbClose.focus(); }
});
})();

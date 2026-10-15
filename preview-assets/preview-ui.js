/* Preview-only UI for Decodables: language chip picker driving the hidden #langPick
   (value + "change"); short lock labels. No reading, dictation, mic or grading logic touched. */
(function () {
  "use strict";
  function langPicker() {
    var sel = document.getElementById("langPick");
    if (!sel || !sel.options.length) return false;
    if (document.querySelector(".pv-lang")) return true;
    sel.classList.add("pv-hidden-control");
    var wrap = document.createElement("div"); wrap.className = "pv-lang";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "pv-lang-btn";
    var pop = document.createElement("div"); pop.className = "pv-lang-pop"; pop.hidden = true;
    function label() { btn.textContent = "🌐 " + ((sel.options[sel.selectedIndex] || {}).textContent || ""); }
    Array.prototype.forEach.call(sel.options, function (o) {
      var c = document.createElement("button"); c.type = "button";
      c.className = "pv-lang-chip" + (o.value === sel.value ? " is-on" : "");
      c.textContent = o.textContent;
      c.onclick = function () {
        sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true }));
        pop.querySelectorAll(".pv-lang-chip").forEach(function (x) { x.classList.toggle("is-on", x === c); });
        label(); pop.hidden = true;
      };
      pop.appendChild(c);
    });
    btn.onclick = function () { pop.hidden = !pop.hidden; };
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) pop.hidden = true; });
    label(); wrap.appendChild(btn); wrap.appendChild(pop);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    return true;
  }
  function tidyCards() {
    document.querySelectorAll("#libList .card:not([data-pv])").forEach(function (c) {
      c.setAttribute("data-pv", "1");
      var f = c.querySelector(".card-flag");
      if (!f) return;
      var t = f.textContent.trim();
      if (/^🔒/.test(t)) { f.setAttribute("title", t); f.classList.add("pv-flag-lock"); }
      else if (/^Next/.test(t)) f.classList.add("pv-flag-next");
      else f.classList.add("pv-flag-done");
    });
  }
  /* no brand marks on preview: "MRJ Decodables" -> "Decodables" (display text only) */
  var bt = document.getElementById("bookTitle");
  function unbrand() { if (bt && /^MRJ\s+/.test(bt.textContent)) bt.textContent = bt.textContent.replace(/^MRJ\s+/, ""); }
  if (bt) { unbrand(); new MutationObserver(unbrand).observe(bt, { childList: true, characterData: true, subtree: true }); }
  var lib = document.getElementById("libList");
  if (lib) new MutationObserver(tidyCards).observe(lib, { childList: true });
  var n = 0;
  (function wait() { tidyCards(); if (!langPicker() && n++ < 100) setTimeout(wait, 100); })();
})();

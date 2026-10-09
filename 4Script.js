(function () {
  "use strict";

  var RULES_KEY = "4proto-rules";
  var WATCH_KEY = "4proto-watch";
  var PERSIST_KEY = "4proto-persist";
  var MEME_FLAGS = ["po", "ca"];

  function persistOn() {
    try {
      return localStorage.getItem(PERSIST_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function store() {
    try {
      return persistOn() ? localStorage : sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function load(key, fallback) {
    try {
      var s = store();
      var raw = s && s.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      var s = store();
      if (s) s.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function wipe(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {}
  }

  function setPersist(on) {
    var rules = load(RULES_KEY, []);
    var watch = load(WATCH_KEY, []);
    wipe(RULES_KEY);
    wipe(WATCH_KEY);
    try {
      localStorage.setItem(PERSIST_KEY, on ? "1" : "0");
    } catch (e) {}
    save(RULES_KEY, rules);
    save(WATCH_KEY, watch);
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  function option(select, value, label) {
    var o = el("option", "", label);
    o.value = value;
    select.appendChild(o);
  }

  var allPosts = [].slice.call(document.querySelectorAll(".op, .little"));
  var replies = [].slice.call(document.querySelectorAll(".little"));
  var thread = document.querySelector("main[data-thread]");

  function idOf(post) {
    var tag = post.querySelector(".idthingy");
    return tag ? tag.textContent.trim() : "";
  }

  var idPosts = allPosts.filter(function (p) {
    return idOf(p);
  });

  idPosts.forEach(function (p) {
    var name = p.querySelector(".Anon");
    if (name) name.classList.add("clicky");
  });

  var anonCount = el("div", "anoncount");
  anonCount.hidden = true;
  document.body.appendChild(anonCount);

  var currentId = null;
  var currentPost = null;

  function samePosts() {
    return idPosts.filter(function (p) {
      return idOf(p) === currentId && p.offsetParent !== null;
    });
  }

  function anonClear() {
    idPosts.forEach(function (p) {
      p.classList.remove("sameanon", "thisanon");
    });
    anonCount.hidden = true;
    currentId = null;
    currentPost = null;
  }

  function anonShow(post) {
    idPosts.forEach(function (p) {
      p.classList.remove("thisanon");
    });
    currentPost = post;
    post.classList.add("thisanon");
    var list = samePosts();
    anonCount.textContent =
      list.indexOf(post) + 1 + " of " + list.length + " posts by this ID";
    anonCount.hidden = false;
  }

  function anonSelect(post) {
    anonClear();
    currentId = idOf(post);
    samePosts().forEach(function (p) {
      p.classList.add("sameanon");
    });
    anonShow(post);
  }

  function anonJump(step) {
    if (!currentId) return;
    var list = samePosts();
    if (!list.length) return;
    var i = list.indexOf(currentPost);
    var next = list[(i + step + list.length) % list.length];
    anonShow(next);
    next.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.addEventListener("click", function (e) {
    var name = e.target.closest(".Anon");
    if (!name) return;
    var post = name.closest(".op, .little");
    if (post && idOf(post)) anonSelect(post);
  });

  document.addEventListener("keydown", function (e) {
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "n") anonJump(1);
    else if (e.key === "p") anonJump(-1);
    else if (e.key === "Escape") anonClear();
  });

  var filterCounter = null;

  function flagOf(post) {
    var img = post.querySelector("img.flag");
    if (!img) return "";
    return (img.getAttribute("src") || "")
      .split("/")
      .pop()
      .replace(/\.[^.]+$/, "")
      .toLowerCase();
  }

  function bodyOf(post) {
    var parts = [].slice.call(post.querySelectorAll(".mega span:not(.quote)"));
    return parts
      .map(function (s) {
        return s.textContent;
      })
      .join(" ");
  }

  function matches(rule, post) {
    var v = rule.value.trim();
    if (!v) return false;
    if (rule.type === "flag") {
      return (
        v
          .toLowerCase()
          .split(",")
          .map(function (s) {
            return s.trim();
          })
          .indexOf(flagOf(post)) !== -1
      );
    }
    if (rule.type === "id") {
      return idOf(post).toLowerCase() === v.toLowerCase();
    }
    if (rule.type === "regex") {
      try {
        return new RegExp(v, "i").test(bodyOf(post));
      } catch (e) {
        return false;
      }
    }
    return bodyOf(post).toLowerCase().indexOf(v.toLowerCase()) !== -1;
  }

  function applyFilters() {
    var rules = load(RULES_KEY, []).filter(function (r) {
      return r.on;
    });

    [].forEach.call(document.querySelectorAll(".foldy"), function (n) {
      n.remove();
    });

    var hidden = 0;
    var groups = [];
    var group = null;

    replies.forEach(function (post) {
      post.classList.remove("gone", "folded", "peek", "glow");

      var state = "";
      rules.forEach(function (r) {
        if (!matches(r, post)) return;
        if (r.action === "hide") state = "hide";
        else if (r.action === "collapse" && state !== "hide")
          state = "collapse";
        else if (r.action === "highlight" && !state) state = "highlight";
      });

      if (state === "hide") {
        post.classList.add("gone");
        hidden++;
      } else if (state === "highlight") {
        post.classList.add("glow");
        group = null;
      } else if (state === "collapse") {
        post.classList.add("folded");
        hidden++;
        if (!group) {
          group = { posts: [], fold: el("div", "foldy") };
          post.parentNode.insertBefore(group.fold, post);
          groups.push(group);
        }
        group.posts.push(post);
      } else {
        group = null;
      }
    });

    groups.forEach(function (g) {
      var open = false;
      function paint() {
        var n = g.posts.length;
        g.fold.textContent =
          "[" + (open ? "-" : "+") + "] " + n + (n === 1 ? " post hidden" : " posts hidden");
        g.posts.forEach(function (p) {
          p.classList.toggle("peek", open);
        });
      }
      g.fold.addEventListener("click", function () {
        open = !open;
        paint();
      });
      paint();
    });

    if (filterCounter) {
      filterCounter.textContent =
        hidden + (hidden === 1 ? " post" : " posts") + " hidden by filter";
    }
  }

  var panel = el("div", "stuffbox");
  panel.hidden = true;
  document.body.appendChild(panel);

  var watchLink = null;

  function watchIndex(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  function currentStatus() {
    var h = document.querySelector(".op .helth");
    return h ? h.textContent.trim() : "";
  }

  function currentTitle() {
    var t = document.querySelector(".op .master");
    return t ? t.textContent.trim().slice(0, 60) : document.title;
  }

  function updateWatchLink() {
    if (!watchLink) return;
    var n = load(WATCH_KEY, []).length;
    watchLink.textContent = "[Watchlist" + (n ? " (" + n + ")" : "") + "]";
  }

  var newReplies = 0;
  if (thread) {
    var w0 = load(WATCH_KEY, []);
    var i0 = watchIndex(w0, thread.dataset.thread);
    if (i0 !== -1) {
      newReplies = Math.max(0, replies.length - w0[i0].replies);
      w0[i0].replies = replies.length;
      w0[i0].status = currentStatus();
      save(WATCH_KEY, w0);
    }
  }

  function renderFilter(rules) {
    panel.appendChild(el("h3", "", "Filter"));

    var type = el("select");
    option(type, "word", "Word / phrase");
    option(type, "flag", "Flag (e.g. po,ca)");
    option(type, "id", "ID");
    option(type, "regex", "Regex (advanced)");

    var value = el("input");
    value.type = "text";
    value.placeholder = "value";

    var action = el("select");
    option(action, "hide", "Hide");
    option(action, "collapse", "Collapse");
    option(action, "highlight", "Highlight");

    var add = el("button", "", "Add");
    add.type = "button";
    add.addEventListener("click", function () {
      if (!value.value.trim()) return;
      rules.push({
        type: type.value,
        value: value.value.trim(),
        action: action.value,
        on: true,
      });
      save(RULES_KEY, rules);
      render();
    });

    var row = el("div", "stuffline");
    row.append(type, value, action, add);
    panel.appendChild(row);

    var meme = el("button", "", "Memeflags: " + MEME_FLAGS.join(", "));
    meme.type = "button";
    meme.addEventListener("click", function () {
      rules.push({
        type: "flag",
        value: MEME_FLAGS.join(","),
        action: action.value,
        on: true,
      });
      save(RULES_KEY, rules);
      render();
    });
    var memeRow = el("div", "stuffline");
    memeRow.appendChild(meme);
    panel.appendChild(memeRow);

    rules.forEach(function (r, i) {
      var line = el("div", "stuffline");
      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = r.on;
      cb.addEventListener("change", function () {
        r.on = cb.checked;
        save(RULES_KEY, rules);
        applyFilters();
      });
      var label = el("span", "", r.action + " | " + r.type + ": " + r.value);
      var del = el("button", "", "x");
      del.type = "button";
      del.addEventListener("click", function () {
        rules.splice(i, 1);
        save(RULES_KEY, rules);
        render();
      });
      line.append(cb, label, del);
      panel.appendChild(line);
    });

    filterCounter = el("div", "smolnote", "");
    panel.appendChild(filterCounter);

    var clearRules = el("button", "", "Clear filters");
    clearRules.type = "button";
    clearRules.addEventListener("click", function () {
      wipe(RULES_KEY);
      render();
    });
    panel.appendChild(clearRules);
  }

  function renderWatch(watch) {
    panel.appendChild(el("h3", "", "Watchlist"));

    if (newReplies > 0) {
      panel.appendChild(
        el("div", "newstuff", newReplies + " new replies since your last visit"),
      );
    }

    if (thread) {
      var tid = thread.dataset.thread;
      var idx = watchIndex(watch, tid);
      var wbtn = el(
        "button",
        "",
        idx === -1 ? "Watch this thread" : "Unwatch this thread",
      );
      wbtn.type = "button";
      wbtn.addEventListener("click", function () {
        if (idx === -1) {
          watch.push({
            id: tid,
            title: currentTitle(),
            href: location.pathname.split("/").pop() || location.href,
            replies: replies.length,
            status: currentStatus(),
          });
        } else {
          watch.splice(idx, 1);
        }
        save(WATCH_KEY, watch);
        render();
        updateWatchLink();
      });
      panel.appendChild(wbtn);
    }

    if (!watch.length) {
      panel.appendChild(el("div", "smolnote", "No threads watched yet."));
    }

    watch.forEach(function (w) {
      var line = el("div", "stuffline");
      var a = el("a", "", w.title);
      a.href = w.href;
      var info = (w.status ? w.status + " | " : "") + w.replies + " replies";
      line.append(a, el("span", "smolnote", info));
      panel.appendChild(line);
    });

    var clearWatch = el("button", "", "Clear watchlist");
    clearWatch.type = "button";
    clearWatch.addEventListener("click", function () {
      wipe(WATCH_KEY);
      render();
      updateWatchLink();
    });
    panel.appendChild(clearWatch);
  }

  function render() {
    panel.textContent = "";
    filterCounter = null;

    if (idPosts.length) renderFilter(load(RULES_KEY, []));
    renderWatch(load(WATCH_KEY, []));

    panel.appendChild(
      el("div", "smolnote", "Saved only on this device, no account needed."),
    );
    var label = el("label");
    var pcb = el("input");
    pcb.type = "checkbox";
    pcb.checked = persistOn();
    pcb.addEventListener("change", function () {
      setPersist(pcb.checked);
      render();
    });
    label.append(pcb, " Keep after closing the browser");
    panel.appendChild(label);

    applyFilters();
  }

  var bar = document.querySelector(".clickables");
  if (bar) {
    function addLink(text) {
      var a = el("a", "", text);
      a.href = "#";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        panel.hidden = !panel.hidden;
      });
      bar.appendChild(document.createTextNode(" "));
      bar.appendChild(a);
      return a;
    }

    if (idPosts.length) addLink("[Filter]");
    watchLink = addLink("[Watchlist]");
  }

  render();
  updateWatchLink();
  if (newReplies > 0) panel.hidden = false;
})();
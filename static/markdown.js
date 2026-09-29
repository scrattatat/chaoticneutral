// Small Obsidian-flavoured Markdown renderer. Covers what session notes need:
// frontmatter, headings, lists (nested, tasks), quotes/callouts, code, tables,
// **bold**, *italic*, ~~strike~~, ==highlight==, `code`, [links](), [[wikilinks]], #tags.
(function () {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function inline(text) {
    // Stash code spans and URLs so emphasis rules can't mangle them.
    const stash = [];
    const hold = (html) => { stash.push(html); return `\u0000${stash.length - 1}\u0000`; };
    let s = text.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, label, url) =>
      `[${label}]` + hold(`(${esc(url)})`));
    s = esc(s);
    s = s
      .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="wikilink" title="$1">$2</span>')
      .replace(/!?\[\[([^\]]+)\]\]/g, '<span class="wikilink">$1</span>')
      .replace(/\[([^\]]+)\]\u0000(\d+)\u0000/g, (_, label, i) =>
        `<a href="${stash[+i].slice(1, -1)}" target="_blank" rel="noopener">${label}</a>`)
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/(^|\W)_(?!\s)(.+?)_(?!\w)/g, "$1<em>$2</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/==(.+?)==/g, "<mark>$1</mark>")
      .replace(/(^|\s)#([A-Za-z][\w/-]*)/g, '$1<span class="tag">#$2</span>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
  }

  function frontmatter(lines) {
    if (lines[0] !== "---") return { html: "", rest: lines };
    const end = lines.indexOf("---", 1);
    if (end === -1) return { html: "", rest: lines };
    const rows = [];
    let lastKey = null;
    for (const line of lines.slice(1, end)) {
      const m = line.match(/^([\w-]+):\s*(.*)$/);
      if (m) { rows.push([m[1], m[2]]); lastKey = rows.length - 1; }
      else if (/^\s*-\s+/.test(line) && lastKey !== null) {
        rows[lastKey][1] += (rows[lastKey][1] ? ", " : "") + line.replace(/^\s*-\s+/, "");
      }
    }
    const body = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v.replace(/^\[|\]$/g, ""))}</td></tr>`).join("");
    return { html: rows.length ? `<table class="props">${body}</table>` : "", rest: lines.slice(end + 1) };
  }

  function list(lines, i) {
    // Parses a (possibly nested) list starting at lines[i]. Returns [html, nextIndex].
    const baseIndent = lines[i].match(/^\s*/)[0].length;
    const ordered = /^\s*\d+[.)]\s/.test(lines[i]);
    let html = ordered ? "<ol>" : "<ul>";
    while (i < lines.length) {
      const line = lines[i];
      const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (!m) break;
      const indent = m[1].length;
      if (indent < baseIndent) break;
      if (indent > baseIndent) {
        const [sub, next] = list(lines, i);
        html = html.replace(/<\/li>$/, sub + "</li>");
        i = next;
        continue;
      }
      let content = m[3];
      const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
      if (task) {
        const done = task[1] !== " ";
        content = `<input type="checkbox" disabled ${done ? "checked" : ""}> <span class="${done ? "done" : ""}">${inline(task[2])}</span>`;
        html += `<li class="task">${content}</li>`;
      } else {
        html += `<li>${inline(content)}</li>`;
      }
      i++;
    }
    return [html + (ordered ? "</ol>" : "</ul>"), i];
  }

  function render(src) {
    let lines = src.replace(/\r\n?/g, "\n").split("\n");
    const fm = frontmatter(lines);
    lines = fm.rest;
    let out = fm.html;
    let para = [];
    const flush = () => { if (para.length) { out += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };

    for (let i = 0; i < lines.length; ) {
      const line = lines[i];
      let m;
      if (!line.trim()) { flush(); i++; continue; }

      if ((m = line.match(/^```(\w*)/))) {
        flush();
        const code = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
        i++;
        out += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
        continue;
      }
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        flush();
        out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
        i++; continue;
      }
      if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line.trim())) {
        flush(); out += "<hr>"; i++; continue;
      }
      if (line.startsWith(">")) {
        flush();
        const q = [];
        while (i < lines.length && lines[i].startsWith(">")) q.push(lines[i++].replace(/^>\s?/, ""));
        const callout = q[0] && q[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        if (callout) {
          const kind = callout[1].toLowerCase();
          const title = callout[2] || callout[1][0].toUpperCase() + callout[1].slice(1).toLowerCase();
          out += `<div class="callout callout-${esc(kind)}"><div class="callout-title">${inline(title)}</div>${render(q.slice(1).join("\n"))}</div>`;
        } else {
          out += `<blockquote>${render(q.join("\n"))}</blockquote>`;
        }
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        flush();
        const [html, next] = list(lines, i);
        out += html; i = next; continue;
      }
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = cells(line);
        i += 2;
        let body = "";
        while (i < lines.length && lines[i].includes("|")) {
          body += "<tr>" + cells(lines[i++]).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
        }
        out += `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
        continue;
      }
      para.push(line);
      i++;
    }
    flush();
    return out;
  }

  window.renderMarkdown = render;
})();

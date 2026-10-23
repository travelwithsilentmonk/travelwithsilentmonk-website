// Hangouts and community strips. Needs SITE_CONFIG.supabaseUrl/supabaseKey (see supabase-hangouts.sql).
(function () {
  const cfg = window.SITE_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey);
  const LINK_OK = /^https:\/\/(chat\.whatsapp\.com|t\.me|signal\.group|discord\.gg)\//;
  const TYPES = { stay: 'Stay', food: 'Food spot', nightlife: 'Club / nightlife', hidden: 'Hidden place', tip: 'Traveller tip' };
  const card = 'background:#fff;color:#171717;border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:12px 0;';
  const btn = 'background:#1a5d3a;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-size:15px;cursor:pointer;display:inline-block;text-decoration:none;';
  const field = 'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin:4px 0 12px;font-family:inherit;';
  let client = null, session = null;

  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }
  function when(iso) { return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  async function rest(path) {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + path, { headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + cfg.supabaseKey } });
    if (!r.ok) throw new Error('request failed');
    return r.json();
  }
  async function upcoming(country, limit) {
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    let q = 'hangouts?select=id,host_name,country,city,title,starts_at,place,description,max_people&status=eq.approved&starts_at=gte.' + encodeURIComponent(since) + '&order=starts_at.asc&limit=' + (limit || 50);
    if (country) q += '&country=eq.' + encodeURIComponent(country);
    return rest(q);
  }
  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  async function connect() {
    if (client) return;
    await loadSdk();
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const s = await client.auth.getSession(); session = s.data.session;
    client.auth.onAuthStateChange((_e, sess) => { session = sess; });
  }
  function firstName() {
    const m = (session && session.user.user_metadata) || {};
    return String(m.full_name || m.name || 'Traveller').trim().split(/\s+/)[0].slice(0, 40) || 'Traveller';
  }

  function hangoutCard(h, opts) {
    opts = opts || {};
    const holder = el('div', { style: 'margin-top:8px;' });
    const meta = h.city + ', ' + h.country + ' · ' + when(h.starts_at);
    const kids = [
      el('strong', { text: h.title }),
      el('div', { style: 'font-size:14px;color:#1a5d3a;margin:3px 0;', text: meta }),
      el('div', { style: 'font-size:13px;color:#666;', text: 'Meeting point: ' + h.place + (h.max_people ? ' · up to ' + h.max_people + ' people' : '') + ' · hosted by ' + h.host_name }),
      el('p', { style: 'margin:8px 0 0;white-space:pre-wrap;', text: h.description }),
      holder
    ];
    if (opts.join) {
      holder.appendChild(el('button', { style: btn, text: 'Join the group chat', onclick: async () => {
        if (!session) { holder.replaceChildren(el('span', { text: 'Please sign in to see the group link. ' }), el('button', { style: btn, text: 'Sign in with Google', onclick: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } }) })); return; }
        const { data } = await client.from('hangout_links').select('group_link').eq('hangout_id', h.id).maybeSingle();
        if (data && LINK_OK.test(data.group_link)) holder.replaceChildren(el('a', { href: data.group_link, target: '_blank', rel: 'noopener noreferrer', style: btn, text: 'Open the group chat' }), el('span', { style: 'font-size:12px;color:#888;margin-left:10px;', text: 'Meet in public places and stay safe.' }));
        else holder.replaceChildren(el('span', { text: 'The group link is not available.' }));
      } }));
      holder.appendChild(el('button', { style: 'background:none;border:0;color:#888;font-size:13px;cursor:pointer;text-decoration:underline;margin-left:14px;', text: 'Report', onclick: async () => {
        if (!session) { alert('Please sign in to report a hangout, or email us from the About & Contact page.'); return; }
        const reason = prompt('What is wrong with this hangout? (optional)') || '';
        const { error } = await client.from('hangout_reports').insert({ hangout_id: h.id, user_id: session.user.id, reason: reason.slice(0, 300) });
        alert(error ? 'Could not send the report. Please email us instead.' : 'Thanks, we will review it.');
      } }));
    }
    return el('div', { id: 'h-' + h.id, style: card }, kids);
  }

  const SAFETY = 'Meet in public places, tell someone where you are going, and leave if you feel uncomfortable. Hangouts are organised by their hosts, not by TravelWithSilentMonk.';

  function formUi(countries, defaultCountry, onDone) {
    const wrap = el('div', { style: card });
    const sel = el('select', { style: field }, countries.map(c => el('option', { value: c, text: c })));
    if (defaultCountry) sel.value = defaultCountry;
    const city = el('input', { style: field, placeholder: 'City or town', maxlength: '80' });
    const title = el('input', { style: field, placeholder: 'Title, e.g. Sunset drinks and dinner for solo travellers', maxlength: '80' });
    const dt = el('input', { style: field, type: 'datetime-local' });
    const place = el('input', { style: field, placeholder: 'Public meeting point, e.g. hostel common room or a named cafe', maxlength: '120' });
    const desc = el('textarea', { style: field + 'min-height:90px;', placeholder: 'What is the plan? (20 to 500 characters). No phone numbers or private addresses.', maxlength: '500' });
    const max = el('input', { style: field, type: 'number', min: '2', max: '50', placeholder: 'Maximum people (optional)' });
    const link = el('input', { style: field, placeholder: 'Group chat link (WhatsApp, Telegram, Signal or Discord invite)', maxlength: '300' });
    const agree = el('input', { type: 'checkbox' });
    const msg = el('p', { style: 'margin:10px 0 0;font-size:14px;' });
    const go = el('button', { style: btn, text: 'Submit for review', onclick: async () => {
      msg.textContent = '';
      const when_ = new Date(dt.value);
      if (!city.value.trim() || title.value.trim().length < 5 || place.value.trim().length < 3 || desc.value.trim().length < 20 || !dt.value) { msg.textContent = 'Please fill in every field (title 5+ characters, description 20+ characters).'; return; }
      if (isNaN(when_) || when_ <= new Date()) { msg.textContent = 'Please choose a date and time in the future.'; return; }
      if (!LINK_OK.test(link.value.trim())) { msg.textContent = 'The group link must be a WhatsApp, Telegram, Signal or Discord invite link starting with https://.'; return; }
      if (!agree.checked) { msg.textContent = 'Please confirm the box above.'; return; }
      go.disabled = true;
      const ins = await client.from('hangouts').insert({
        user_id: session.user.id, host_name: firstName(), country: sel.value, city: city.value.trim(), title: title.value.trim(),
        starts_at: when_.toISOString(), place: place.value.trim(), description: desc.value.trim(), max_people: max.value ? Number(max.value) : null
      }).select('id').single();
      if (ins.error) { go.disabled = false; msg.textContent = 'Could not save your hangout (you can post up to 3 a day, and the date must be within 120 days).'; return; }
      const lk = await client.from('hangout_links').insert({ hangout_id: ins.data.id, group_link: link.value.trim() });
      if (lk.error) { await client.from('hangouts').delete().eq('id', ins.data.id); go.disabled = false; msg.textContent = 'Could not save the group link. Please check it and try again.'; return; }
      wrap.replaceChildren(el('p', { text: 'Thank you! Your hangout will appear after we review it.' }));
      onDone && onDone();
    } });
    const label = el('label', { style: 'font-size:14px;display:block;margin-bottom:12px;' }, [agree, ' I am 18 or over, I will host this in a public place, and I agree to the ', el('a', { href: 'terms.html', target: '_blank', text: 'Terms', style: 'text-decoration:underline;' }), '.']);
    [el('h3', { text: 'Plan a hangout', style: 'margin:0 0 6px;' }), el('p', { text: SAFETY, style: 'font-size:13px;color:#666;margin-bottom:12px;' }), sel, city, title, dt, place, desc, max, link, label, go, msg].forEach(n => wrap.appendChild(n));
    return wrap;
  }

  // Full hangouts page.
  async function mountPage(root, countries) {
    if (!enabled) { root.appendChild(el('div', { style: card }, [el('p', { text: 'Hangouts are coming soon: travellers posting plans to meet up, by country, city and date.' })])); return; }
    root.appendChild(el('p', { text: 'Loading hangouts...' }));
    try { await connect(); } catch (e) { root.replaceChildren(el('p', { text: 'Hangouts could not load. Please try again later.' })); return; }
    const params = new URLSearchParams(location.search);
    let filter = params.get('country') || '';
    let seq = 0;
    async function draw() {
      const mine = ++seq;
      const sel = el('select', { style: field + 'max-width:320px;', onchange: e => { filter = e.target.value; draw(); } }, [el('option', { value: '', text: 'All countries' })].concat(countries.map(c => el('option', { value: c, text: c }))));
      sel.value = filter;
      let rows = [], failed = false;
      try { rows = await upcoming(filter, 50); } catch (e) { failed = true; }
      if (mine !== seq) return;
      const nodes = [el('p', { style: 'font-size:13px;color:#666;', text: SAFETY + ' Times are shown in your device\'s time zone.' }), sel];
      if (failed) nodes.push(el('p', { text: 'Hangouts could not load. Please try again later.' }));
      else if (!rows.length) nodes.push(el('p', { text: 'No upcoming hangouts yet. Be the first to plan one.', style: 'margin:10px 0;' }));
      else rows.forEach(h => nodes.push(hangoutCard(h, { join: true })));
      if (session) nodes.push(formUi(countries, filter, () => {}));
      else nodes.push(el('div', { style: card }, [
        el('p', { text: 'Sign in with Google to plan a hangout or join a group chat. Only your first name is shown.' }),
        el('button', { style: btn + 'margin-top:10px;', text: 'Sign in with Google', onclick: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } }) })
      ]));
      nodes.push(el('p', { style: 'font-size:13px;color:#888;margin-top:14px;' }, ['Hangouts are reviewed before they appear. See our ', el('a', { href: 'terms.html', text: 'Terms', style: 'text-decoration:underline;' }), ' and ', el('a', { href: 'privacy.html', text: 'Privacy Policy', style: 'text-decoration:underline;' }), '.']));
      root.replaceChildren(...nodes);
      if (location.hash.startsWith('#h-')) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }
    draw();
  }

  // Short list inside a country page.
  async function mountCountry(root, country) {
    if (!enabled) return;
    root.replaceChildren(el('h3', { text: 'Upcoming hangouts in ' + country, style: 'margin:0 0 6px;' }));
    let rows = [];
    try { rows = await upcoming(country, 5); } catch (e) { root.replaceChildren(); return; }
    if (!rows.length) root.appendChild(el('p', { text: 'No upcoming hangouts yet.', style: 'margin:6px 0;' }));
    rows.forEach(h => { const c = hangoutCard(h, {}); c.appendChild(el('a', { href: 'hangouts.html?country=' + encodeURIComponent(country) + '#h-' + h.id, text: 'See details and join', style: 'color:#1a5d3a;text-decoration:underline;font-size:14px;display:inline-block;margin-top:8px;' })); root.appendChild(c); });
    root.appendChild(el('p', { style: 'margin:8px 0 18px;' }, [el('a', { href: 'hangouts.html?country=' + encodeURIComponent(country), text: 'Plan a hangout or see all hangouts', style: 'color:#1a5d3a;text-decoration:underline;' })]));
  }

  // Homepage strip: next hangouts and latest tips.
  async function mountStrip(root) {
    if (!enabled) return;
    let hs = [], ts = [];
    try { hs = await upcoming('', 4); } catch (e) {}
    try { ts = await rest('tips?select=id,created_at,display_name,city,country,type,place,rating,body&status=eq.approved&order=created_at.desc&limit=4'); } catch (e) {}
    const box = (title, kids, linkText, href) => el('div', { style: 'flex:1 1 320px;min-width:0;' }, [el('h3', { text: title, style: 'margin-bottom:6px;' })].concat(kids, [el('a', { href, text: linkText, style: 'color:#4caf6d;text-decoration:underline;' })]));
    const small = 'background:#fff;color:#171717;border-radius:12px;padding:12px 14px;margin:8px 0;font-size:14px;';
    const hk = hs.length ? hs.map(h => el('div', { style: small }, [el('strong', { text: h.title }), el('div', { style: 'color:#1a5d3a;', text: h.city + ', ' + h.country + ' · ' + when(h.starts_at) })])) : [el('p', { text: 'No upcoming hangouts yet. Plan the first one.', style: 'margin:8px 0;' })];
    const tk = ts.length ? ts.map(t => el('div', { style: small }, [el('strong', { text: t.place }), el('div', { style: 'color:#666;', text: (TYPES[t.type] || 'Tip') + ' · ' + t.city + ', ' + t.country }), el('div', { text: t.body.length > 110 ? t.body.slice(0, 110) + '…' : t.body, style: 'margin-top:4px;' })])) : [el('p', { text: 'No tips yet. Share yours on any country page.', style: 'margin:8px 0;' })];
    root.replaceChildren(el('div', { style: 'display:flex;gap:30px;flex-wrap:wrap;' }, [box('Next hangouts', hk, 'See all hangouts →', 'hangouts.html'), box('Latest traveller tips', tk, 'Browse destinations →', 'index.html#destinations')]));
    root.parentElement.style.display = 'block';
  }
  window.Hangouts = { mountPage, mountCountry, mountStrip };
})();

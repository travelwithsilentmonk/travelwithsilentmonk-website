// Community tips for country pages. Needs SITE_CONFIG.supabaseUrl and supabaseKey (see supabase-setup.sql).
(function () {
  const TYPES = { stay: 'Stay', food: 'Food spot', nightlife: 'Club / nightlife', hidden: 'Hidden place', tip: 'Traveller tip' };
  const cfg = window.SITE_CONFIG || {};
  let client = null, session = null, loaded = false;

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
  const card = 'background:#fff;color:#171717;border:1px solid #e5e5e5;border-radius:12px;padding:16px;margin:12px 0;';
  const btn = 'background:#1a5d3a;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-size:15px;cursor:pointer;';
  const field = 'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;margin:4px 0 12px;font-family:inherit;';

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  function stars(n) { return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : ''; }

  function renderTip(t) {
    const when = new Date(t.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    const head = el('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;' }, [
      el('strong', { text: t.place }),
      el('span', { text: stars(t.rating), style: 'color:#d99a00;' })
    ]);
    const meta = el('div', { style: 'font-size:13px;color:#666;margin:2px 0 8px;', text: (TYPES[t.type] || 'Tip') + ' · ' + t.city + ' · by ' + t.display_name + ' · ' + when });
    const rep = el('button', { style: 'background:none;border:0;color:#888;font-size:13px;cursor:pointer;text-decoration:underline;padding:0;', text: 'Report', onclick: () => report(t.id) });
    return el('div', { style: card }, [head, meta, el('p', { text: t.body, style: 'margin:0 0 8px;white-space:pre-wrap;' }), rep]);
  }

  async function report(id) {
    if (!session) { alert('Please sign in to report a post, or email us from the About & Contact page.'); return; }
    const reason = prompt('What is wrong with this post? (optional)') || '';
    const { error } = await client.from('reports').insert({ tip_id: id, user_id: session.user.id, reason: reason.slice(0, 300) });
    alert(error ? 'Could not send the report. Please email us instead.' : 'Thanks, we will review it.');
  }

  function formUi(country, onDone) {
    const wrap = el('div', { style: card });
    const sel = el('select', { style: field }, Object.keys(TYPES).map(k => el('option', { value: k, text: TYPES[k] })));
    const city = el('input', { style: field, placeholder: 'City or town', maxlength: '80' });
    const place = el('input', { style: field, placeholder: 'Name of the place', maxlength: '100' });
    const rate = el('select', { style: field }, [el('option', { value: '', text: 'Rating (optional)' })].concat([5, 4, 3, 2, 1].map(n => el('option', { value: String(n), text: stars(n) }))));
    const body = el('textarea', { style: field + 'min-height:110px;', placeholder: 'Your own experience, in your own words (20 to 700 characters). No phone numbers or private details.', maxlength: '700' });
    const agree = el('input', { type: 'checkbox', id: 'cmAgree' });
    const msg = el('p', { style: 'margin:10px 0 0;font-size:14px;' });
    const go = el('button', { style: btn, text: 'Submit for review', onclick: async () => {
      msg.textContent = '';
      if (!city.value.trim() || place.value.trim().length < 2 || body.value.trim().length < 20) { msg.textContent = 'Please fill in the city, place and a review of at least 20 characters.'; return; }
      if (!agree.checked) { msg.textContent = 'Please confirm the box above.'; return; }
      go.disabled = true;
      const meta = session.user.user_metadata || {};
      const first = String(meta.full_name || meta.name || 'Traveller').trim().split(/\s+/)[0].slice(0, 40) || 'Traveller';
      const { error } = await client.from('tips').insert({
        user_id: session.user.id, display_name: first, country, city: city.value.trim(), type: sel.value,
        place: place.value.trim(), rating: rate.value ? Number(rate.value) : null, body: body.value.trim()
      });
      go.disabled = false;
      if (error) { msg.textContent = 'Could not save your tip (you can post up to 5 a day). Please try again later.'; return; }
      wrap.replaceChildren(el('p', { text: 'Thank you! Your tip will appear after we review it.' }));
      onDone && onDone();
    } });
    const label = el('label', { style: 'font-size:14px;display:block;margin-bottom:12px;' }, [agree, ' I am 18 or over, this is my own honest experience, and I agree to the ', el('a', { href: 'terms.html', target: '_blank', text: 'Terms', style: 'text-decoration:underline;' }), '.']);
    [el('h3', { text: 'Share a tip about ' + country, style: 'margin:0 0 10px;' }), sel, city, place, rate, body, label, go, msg].forEach(n => wrap.appendChild(n));
    return wrap;
  }

  async function init(country) {
    const root = document.getElementById('communityContent');
    if (!root || loaded) return; loaded = true;
    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      root.appendChild(el('div', { style: card }, [
        el('p', { text: 'Community tips are coming soon: traveller reviews of stays, food spots, hidden places and more.' }),
        el('p', { style: 'margin-top:8px;' }, ['Meanwhile, join the ', el('a', { href: 'https://chat.whatsapp.com/C3p3SAuVMl3CoI6VROSWdT?s=cl&p=a&mlu=4&ilr=4', target: '_blank', rel: 'noopener', text: 'WhatsApp Community', style: 'text-decoration:underline;' }), '.'])
      ]));
      return;
    }
    root.appendChild(el('p', { text: 'Loading community tips...' }));
    try { await loadSdk(); } catch (e) { root.replaceChildren(el('p', { text: 'Community tips could not load. Please try again later.' })); return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const s = await client.auth.getSession(); session = s.data.session;
    client.auth.onAuthStateChange((_e, sess) => { session = sess; });

    let drawSeq = 0;
    async function draw(filter) {
      const mine = ++drawSeq;
      const bar = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;' });
      [['', 'All']].concat(Object.entries(TYPES)).forEach(([k, v]) => bar.appendChild(el('button', { text: v, style: 'border:1px solid #1a5d3a;border-radius:999px;padding:6px 14px;cursor:pointer;background:' + (filter === k ? '#1a5d3a;color:#fff' : '#fff;color:#1a5d3a'), onclick: () => draw(k) })));
      let q = client.from('tips').select('id,created_at,display_name,city,type,place,rating,body').eq('country', country).eq('status', 'approved').order('created_at', { ascending: false }).limit(50);
      if (filter) q = q.eq('type', filter);
      const { data, error } = await q;
      if (mine !== drawSeq) return; // a newer redraw has started; drop this stale one
      const nodes = [bar];
      if (error) nodes.push(el('p', { text: 'Community tips could not load. Please try again later.' }));
      else if (!data.length) nodes.push(el('p', { text: 'No tips here yet. Be the first to share a stay, food spot or hidden place.', style: 'margin:10px 0;' }));
      else data.forEach(t => nodes.push(renderTip(t)));
      if (session) nodes.push(formUi(country, () => {}));
      else nodes.push(el('div', { style: card }, [
        el('p', { text: 'Sign in with Google to share your own tip. Only your first name is shown.' }),
        el('button', { style: btn + 'margin-top:10px;', text: 'Sign in with Google', onclick: () => client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } }) })
      ]));
      nodes.push(el('p', { style: 'font-size:13px;color:#888;margin-top:14px;' }, ['Posts are reviewed before they appear. See our ', el('a', { href: 'terms.html', text: 'Terms', style: 'text-decoration:underline;' }), ' and ', el('a', { href: 'privacy.html', text: 'Privacy Policy', style: 'text-decoration:underline;' }), '.']));
      root.replaceChildren(...nodes);
    }
    draw('');
  }
  window.Community = { init };
})();

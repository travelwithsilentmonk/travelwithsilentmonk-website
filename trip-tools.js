// "Book & Get Around" tab and Budget calculator for country pages.
// Reads window.PARTNERS_DATA and window.BUDGET_DATA (see partners-data.js, budget-data.js).
(function () {
    const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const CAT = {
        flights: 'Flights', trains: 'Trains', buses: 'Buses', ferries: 'Ferries', rides: 'Rides & local transport',
        hotels: 'Hotels & hostels', tours: 'Tours & activities', local: 'Local operators', esim: 'SIM / eSIM', insurance: 'Travel insurance'
    };
    const CAT_ORDER = ['flights', 'trains', 'buses', 'ferries', 'rides', 'local', 'hotels', 'tours', 'esim', 'insurance'];
    const RATES = { USD: 1, INR: 94.5, EUR: 0.89 };
    const SYM = { USD: '$', INR: '₹', EUR: '€' };

    function showTab(name) {
        const btn = document.querySelector('#tabsNav .tab-btn[data-tab="' + name + '"]');
        if (btn) { btn.click(); window.scrollTo({ top: document.getElementById('tabsNav').offsetTop - 10, behavior: 'smooth' }); }
    }

    /* ---------- Book & Get Around ---------- */
    function renderBooking(country) {
        const all = window.PARTNERS_DATA || {};
        const own = all[country] || {};
        const def = all._default || {};
        const cats = Object.assign({}, def.categories || {}, own.categories || {});
        const keys = CAT_ORDER.filter(k => cats[k] && cats[k].length);
        const box = document.getElementById('bookContent');
        if (!box || !keys.length) return false;
        let hasAff = false;
        const rank = list => list.map((p, i) => [p, i]).sort((a, b) => (b[0].pick ? 1 : 0) - (a[0].pick ? 1 : 0) || a[1] - b[1]).map(x => x[0]).slice(0, 3);
        const html = keys.map(k => `
            <h3 style="margin:30px 0 14px;font-size:20px;">${esc(CAT[k])} <span style="font-size:14px;font-weight:600;color:#2d6a4f;">· Top ${Math.min(3, cats[k].length)} by SilentMonk</span></h3>
            <div class="cards three-col">${rank(cats[k]).map((p, i) => {
                const href = p.aff || p.url; if (p.aff) hasAff = true;
                const badge = i === 0 ? '#1 Top pick' : '#' + (i + 1);
                return `<article class="card coming-soon-card">
                    <span style="display:inline-block;background:${i === 0 ? '#2d6a4f' : '#555'};color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;margin-bottom:8px;">${badge}</span>
                    <h3>${esc(p.name)}</h3>
                    <p>${esc(p.why)}</p>
                    ${p.suits ? `<p style="opacity:.75;font-size:14px;margin-top:6px;">Good for: ${esc(p.suits)}</p>` : ''}
                    <a href="${esc(href)}" class="card-link" target="_blank" rel="${p.aff ? 'sponsored ' : ''}noopener" style="color:#4caf6d;">${p.aff ? 'Book now' : 'Visit site'} →</a>
                    ${p.video ? `<a href="${esc(p.video)}" class="card-link" target="_blank" rel="noopener" style="color:#4caf6d;margin-left:14px;">▶ Watch our video</a>` : ''}
                </article>`;
            }).join('')}</div>`).join('');
        const tips = (own.tips || []).length ? `<h3 style="margin:30px 0 10px;font-size:20px;">Booking tips for ${esc(country)}</h3><ul style="padding-left:20px;line-height:1.7;">${own.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
        const note = hasAff
            ? 'Some links on this page are affiliate links: if you book through them we may earn a commission at no extra cost to you. We list apps because they work well for travellers, not because of the commission.'
            : 'We list apps that work well for travellers in this country. Prices, routes and availability change, so check each app before you book.';
        box.innerHTML = tips + html + `<p style="margin-top:30px;font-size:14px;opacity:.75;">${esc(note)}</p>`;
        return true;
    }

    /* ---------- Budget calculator ---------- */
    function renderBudget(country, guideData) {
        const b = (window.BUDGET_DATA || {})[country];
        const box = document.getElementById('budgetContent');
        if (!b || !box) return false;
        const btn = document.getElementById('budgetTabBtn');
        if (btn) btn.style.display = 'inline-block';
        const cities = b.cities.map(c => c.name);
        const trips = Object.keys(b.presets).sort((x, y) => x - y);
        const st = { style: 'mid', n: 2, trip: trips.includes('7') ? '7' : trips[0], mode: 'cheapest', act: 'normal', cur: 'USD', nights: {} };
        try { const c = localStorage.getItem('twsm_currency'); if (RATES[c]) st.cur = c; } catch (e) {}

        function applyPreset() {
            st.nights = {}; cities.forEach(c => st.nights[c] = 0);
            (b.presets[st.trip] || []).forEach(([c, n]) => { if (c in st.nights) st.nights[c] = n; });
        }
        function order() {
            const first = (b.presets[st.trip] || []).map(p => p[0]).filter(c => cities.includes(c));
            return first.concat(cities.filter(c => !first.includes(c)));
        }
        function findRoute(a, z) { return (b.routes || []).find(r => (r.from === a && r.to === z) || (r.from === z && r.to === a)); }
        function pickMode(r) {
            const m = r.modes || {}; const avail = Object.keys(m).filter(k => m[k] && m[k].usd != null);
            if (!avail.length) return null;
            if (st.mode !== 'cheapest' && m[st.mode] && m[st.mode].usd != null) return st.mode;
            return avail.sort((x, y) => m[x].usd - m[y].usd)[0];
        }
        function calc() {
            const actMult = { low: 0.5, normal: 1, many: 1.6 }[st.act];
            const stayMult = st.n === 1 && st.style !== 'budget' ? 1.4 : 1;
            const sel = order().filter(c => st.nights[c] > 0);
            const t = { stay: 0, food: 0, local: 0, activities: 0, between: 0, arrival: 0 };
            let days = 0;
            sel.forEach(c => {
                const d = b.cities.find(x => x.name === c).daily[st.style]; const n = st.nights[c]; days += n;
                t.stay += d.stay * stayMult * n; t.food += d.food * n; t.local += d.local * n; t.activities += d.activities * actMult * n;
            });
            const legs = [];
            for (let i = 0; i < sel.length - 1; i++) {
                const r = findRoute(sel[i], sel[i + 1]);
                if (!r) { legs.push({ from: sel[i], to: sel[i + 1] }); continue; }
                const m = pickMode(r); if (!m) { legs.push({ from: sel[i], to: sel[i + 1] }); continue; }
                legs.push({ from: sel[i], to: sel[i + 1], mode: m, usd: r.modes[m].usd, hours: r.modes[m].hours });
                t.between += r.modes[m].usd;
            }
            t.arrival = sel.length ? (b.arrival || 0) : 0;
            Object.keys(t).forEach(k => t[k] *= st.n);
            const total = Object.values(t).reduce((a, v) => a + v, 0);
            return { t, total, days, legs, sel };
        }
        function money(usd) {
            const v = usd * RATES[st.cur];
            const step = v >= 100000 ? 1000 : v >= 10000 ? 500 : v >= 1000 ? 50 : v >= 200 ? 10 : 5;
            return SYM[st.cur] + (Math.round(v / step) * step).toLocaleString(st.cur === 'INR' ? 'en-IN' : 'en-US');
        }
        const panel = 'background:#1a1a1a;border:1px solid #2c2c2c;border-radius:12px;padding:20px;';
        const inp = 'padding:8px 10px;border-radius:6px;border:1px solid #444;background:#111;color:#fff;font-size:15px;';
        const lab = 'display:block;font-size:13px;opacity:.8;margin-bottom:4px;';

        function draw() {
            const r = calc();
            const lo = r.total * 0.85, hi = r.total * 1.25;
            const pp = r.days && st.n ? r.total / (r.days * st.n) : 0;
            const rows = order().map(c => `<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #2c2c2c;"><span>${esc(c)}</span><span><input type="number" min="0" max="30" value="${st.nights[c]}" data-city="${esc(c)}" style="${inp}width:70px;"> nights</span></label>`).join('');
            const labels = { stay: 'Stay', food: 'Food', local: 'Local transport', activities: 'Activities', between: 'Between cities', arrival: 'Visa, SIM & transfers' };
            const bars = Object.keys(labels).filter(k => r.t[k] > 0).map(k => {
                const pct = Math.round(r.t[k] / r.total * 100);
                return `<div style="margin:8px 0;"><div style="display:flex;justify-content:space-between;font-size:14px;"><span>${labels[k]}</span><span>${money(r.t[k])} (${pct}%)</span></div><div style="background:#2c2c2c;border-radius:4px;height:8px;"><div style="width:${pct}%;background:#4caf6d;height:8px;border-radius:4px;"></div></div></div>`;
            }).join('');
            const legs = r.legs.map(l => l.mode
                ? `<li>${esc(l.from)} → ${esc(l.to)}: ${esc(l.mode)}, about ${money(l.usd)} per person${l.hours ? ', ~' + esc(l.hours) + ' h' : ''}</li>`
                : `<li>${esc(l.from)} → ${esc(l.to)}: fare not priced yet, add it yourself</li>`).join('');
            const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${v}" ${v == cur ? 'selected' : ''}>${t}</option>`).join('');
            box.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
              <div style="${panel}">
                <h3 style="margin-bottom:14px;">Your trip</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                  <div><span style="${lab}">Trip length</span><select id="bTrip" style="${inp}width:100%;">${opt(trips.map(t => [t, t + ' days']), st.trip)}</select></div>
                  <div><span style="${lab}">Travellers</span><input id="bN" type="number" min="1" max="10" value="${st.n}" style="${inp}width:100%;"></div>
                  <div><span style="${lab}">Travel style</span><select id="bStyle" style="${inp}width:100%;">${opt([['budget', 'Budget'], ['mid', 'Mid-range'], ['comfort', 'Comfort']], st.style)}</select></div>
                  <div><span style="${lab}">Activities</span><select id="bAct" style="${inp}width:100%;">${opt([['low', 'Few'], ['normal', 'Normal'], ['many', 'Many']], st.act)}</select></div>
                  <div><span style="${lab}">Between cities</span><select id="bMode" style="${inp}width:100%;">${opt([['cheapest', 'Cheapest'], ['bus', 'Bus'], ['train', 'Train'], ['flight', 'Flight']], st.mode)}</select></div>
                  <div><span style="${lab}">Show prices in</span><select id="bCur" style="${inp}width:100%;">${opt([['USD', 'US dollars'], ['INR', 'Indian rupees'], ['EUR', 'Euros']], st.cur)}</select></div>
                </div>
                <p style="${lab}">Places and nights (change them to fit your plan)</p>${rows}
              </div>
              <div style="${panel}">
                <h3 style="margin-bottom:6px;">Estimated total</h3>
                <p style="font-size:34px;font-weight:800;color:#4caf6d;line-height:1.2;">${r.total ? money(lo) + ' – ' + money(hi) : '—'}</p>
                <p style="opacity:.8;margin-bottom:14px;">${r.total ? `for ${st.n} traveller${st.n > 1 ? 's' : ''}, ${r.days} nights · about ${money(pp)} per person per day` : 'Add at least one night in a city.'}</p>
                ${bars}
                ${legs ? `<h4 style="margin:16px 0 6px;">Getting between places</h4><ul style="padding-left:18px;line-height:1.6;font-size:14px;">${legs}</ul>` : ''}
                <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
                  <button class="tab-btn" id="bBook" style="display:inline-block;">Book this route →</button>
                  <button class="tab-btn" id="bHotels" style="display:inline-block;">Check hotels →</button>
                  <button class="tab-btn" id="bPrint" style="display:inline-block;">🖨 Save as PDF</button>
                </div>
              </div>
            </div>
            <p style="margin-top:18px;font-size:14px;line-height:1.6;opacity:.85;">${esc(r.total ? `A ${r.days}-night ${({ budget: 'budget', mid: 'mid-range', comfort: 'comfort' })[st.style]} trip to ${country} costs roughly ${money(lo)}–${money(hi)} for ${st.n} traveller${st.n > 1 ? 's' : ''}.` : '')} Prices are estimates in US dollars per person from sources checked in ${esc(b.checked)} (confidence: ${esc(b.confidence || 'medium')}), shown as a range because real costs vary by season. ${esc(b.currency_note || '')} ${st.cur !== 'USD' ? 'Currency conversion is approximate.' : ''} Flights to ${esc(country)} are not included.</p>`;
            const q = id => document.getElementById(id);
            q('bTrip').onchange = e => { st.trip = e.target.value; applyPreset(); draw(); };
            q('bN').onchange = e => { st.n = Math.max(1, Math.min(10, +e.target.value || 1)); draw(); };
            q('bStyle').onchange = e => { st.style = e.target.value; draw(); };
            q('bAct').onchange = e => { st.act = e.target.value; draw(); };
            q('bMode').onchange = e => { st.mode = e.target.value; draw(); };
            q('bCur').onchange = e => { st.cur = e.target.value; try { localStorage.setItem('twsm_currency', st.cur); } catch (x) {} draw(); };
            box.querySelectorAll('[data-city]').forEach(i => i.onchange = e => { st.nights[e.target.dataset.city] = Math.max(0, Math.min(30, +e.target.value || 0)); draw(); });
            q('bBook').onclick = () => showTab('book');
            q('bHotels').onclick = () => showTab('book');
            q('bPrint').onclick = () => { document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none'); document.getElementById('tab-budget').style.display = 'block'; window.print(); };
        }
        applyPreset();
        draw();
        return true;
    }

    window.TripTools = {
        init(country, guideData) {
            renderBooking(country);
            renderBudget(country, guideData);
        }
    };
})();

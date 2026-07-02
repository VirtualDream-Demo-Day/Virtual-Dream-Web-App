(function createStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      top:${Math.random()*100}%;
      left:${Math.random()*100}%;
      --dur:${Math.random()*4+2}s;
      --op:${Math.random()*0.8+0.2};
      animation-delay:${Math.random()*6}s;
    `;
    container.appendChild(s);
  }
})();

// ─── API ───────────────────────────────────────────────────────────────────
const RAG_BASE = 'https://virtual-dream-rag.onrender.com';

// ─── Estado ────────────────────────────────────────────────────────────────
let selectedVertente = 'jung';

document.querySelectorAll('.chip[data-vertente]').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.chip[data-vertente]').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    selectedVertente = this.dataset.vertente;
  });
});

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'diary') renderDiary();
  if (id === 'graph') buildGraph();
}

// ─── Loading ───────────────────────────────────────────────────────────────
const loadingMessages = [
  'Consultando os astros...',
  'Decifrando os símbolos oníricos...',
  'Navegando pelo inconsciente...',
  'Revelando os mistérios do sonho...'
];
let loadingInterval;

function startLoading() {
  document.getElementById('loading').classList.add('show');
  document.getElementById('btn-interpret').disabled = true;
  document.getElementById('result-card').classList.remove('show');
  document.getElementById('error-msg').classList.remove('show');
  let msgIdx = 0;
  loadingInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    document.getElementById('loading-text').textContent = loadingMessages[msgIdx];
  }, 2200);
}

function stopLoading() {
  clearInterval(loadingInterval);
  document.getElementById('loading').classList.remove('show');
  document.getElementById('btn-interpret').disabled = false;
}

// ─── Interpretar ───────────────────────────────────────────────────────────
async function interpretDream() {
  const input = document.getElementById('dream-input').value.trim();
  if (!input || input.length < 20) {
    showError('Descreva seu sonho com mais detalhes para uma interpretação precisa.');
    return;
  }

  startLoading();

  try {
    const res = await fetch(`${RAG_BASE}/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dream: input,
        vertente: selectedVertente,
        length: 'short'
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Erro ${res.status}`);
    }

    const result = await res.json();
    stopLoading();

    // Campo "interpretation" conforme schema do RAG service
    document.getElementById('result-text').textContent = result.interpretation;

    const vertenteSymbol = { jung: '🔮', freud: '🛋️', esoterismo: '🌙' };
    document.getElementById('result-symbol').textContent = vertenteSymbol[selectedVertente] || '🌙';

    const tags = extractTags(input);
    document.getElementById('result-meta').innerHTML =
      tags.map(t => `<span class="meta-tag">${t}</span>`).join('');

    document.getElementById('result-card').classList.add('show');
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    window.lastInterpretation = {
      dream: input,
      vertente: selectedVertente,
      result: result.interpretation,
      image_url: null,
      date: new Date()
    };

    // Imagem em background
    fetch(`${RAG_BASE}/generate_image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dream: input, interpretation: result.interpretation })
    }).then(r => r.ok ? r.json() : null).then(imgData => {
      if (imgData?.image_url) {
        const imgEl = document.getElementById('dream-image');
        imgEl.src = imgData.image_url;
        imgEl.onload = () => {
          document.getElementById('dream-image-container').classList.add('show');
          if (window.lastInterpretation) window.lastInterpretation.image_url = imgData.image_url;
        };
      }
    }).catch(() => {});

    // Tags semânticas em background
    fetch(`${RAG_BASE}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dream: input, interpretation: result.interpretation })
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tags?.length) {
        if (window.lastInterpretation) window.lastInterpretation.semantic_tags = data.tags;
        renderSemanticTags(data.tags);
      }
    }).catch(() => {});

  } catch (err) {
    stopLoading();
    showError('Não foi possível conectar ao oráculo. Verifique sua conexão e tente novamente.');
    console.error(err);
  }
}

function extractTags(text) {
  const keywords = [
    ['voar','✈️ Voo'], ['água','💧 Água'], ['mar','🌊 Mar'], ['rio','💧 Rio'],
    ['casa','🏠 Casa'], ['morte','☠️ Transformação'], ['morrer','☠️ Transformação'],
    ['fogo','🔥 Fogo'], ['luz','✨ Luz'], ['escuro','🌑 Sombra'],
    ['perseguição','⚡ Perseguição'], ['criança','👶 Criança'],
    ['animal','🐾 Animal'], ['queda','🌊 Queda'], ['amor','💜 Amor'],
    ['monstro','👾 Sombra'], ['floresta','🌿 Natureza'], ['céu','☁️ Transcendência']
  ];
  const found = [];
  const lower = text.toLowerCase();
  for (const [kw, label] of keywords) {
    if (lower.includes(kw) && !found.includes(label)) found.push(label);
    if (found.length >= 4) break;
  }
  const vertenteTag = { jung: '🔮 Junguiana', freud: '🛋️ Freudiana', esoterismo: '🌙 Esotérica' };
  found.push(vertenteTag[selectedVertente] || '🔮 Junguiana');
  return found.slice(0, 5);
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.add('show');
}

function saveDream() {
  if (!window.lastInterpretation) return;
  const dreams = JSON.parse(localStorage.getItem('morpheus-dreams') || '[]');
  dreams.unshift(window.lastInterpretation);
  localStorage.setItem('morpheus-dreams', JSON.stringify(dreams.slice(0, 50)));

  const btn = document.querySelector('.btn-save');
  btn.textContent = '✓ SALVO NO DIÁRIO';
  btn.style.borderColor = 'rgba(123,94,167,0.5)';
  btn.style.color = 'var(--silver)';
  setTimeout(() => {
    btn.textContent = '◈ SALVAR NO DIÁRIO ◈';
    btn.style.borderColor = '';
    btn.style.color = '';
  }, 2500);
}

function renderSemanticTags(tags) {
  const meta = document.getElementById('result-meta');
  const existing = Array.from(meta.querySelectorAll('.meta-tag')).map(el => el.textContent);
  tags.forEach(tag => {
    if (!existing.includes(tag)) {
      const span = document.createElement('span');
      span.className = 'meta-tag';
      span.textContent = tag;
      meta.appendChild(span);
    }
  });
}

function buildGraph() {
  const dreams = JSON.parse(localStorage.getItem('morpheus-dreams') || '[]')
    .filter(d => d.semantic_tags?.length);

  const empty = document.getElementById('graph-empty');
  const canvas = document.getElementById('dream-graph');

  if (dreams.length < 2) {
    empty.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  canvas.style.display = 'block';

  const W = canvas.parentElement.clientWidth - 32;
  const H = Math.min(W * 1.1, window.innerHeight * 0.65);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const nodes = dreams.map((d, i) => {
    const date = new Date(d.date);
    const label = date.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    return { id: i, label, tags: d.semantic_tags, dream: d.dream, x: 0, y: 0, vx: 0, vy: 0 };
  });

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter(t => nodes[j].tags.includes(t));
      if (shared.length > 0) edges.push({ a: i, b: j, shared, weight: shared.length });
    }
  }

  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    n.x = W / 2 + Math.cos(angle) * W * 0.3;
    n.y = H / 2 + Math.sin(angle) * H * 0.3;
  });

  function simulate() {
    for (let iter = 0; iter < 120; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const force = 2800 / (dist * dist);
          nodes[i].vx -= force * dx / dist;
          nodes[i].vy -= force * dy / dist;
          nodes[j].vx += force * dx / dist;
          nodes[j].vy += force * dy / dist;
        }
      }
      edges.forEach(e => {
        const a = nodes[e.a], b = nodes[e.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const ideal = 120;
        const force = (dist - ideal) * 0.04;
        a.vx += force * dx / dist; a.vy += force * dy / dist;
        b.vx -= force * dx / dist; b.vy -= force * dy / dist;
      });
      nodes.forEach(n => {
        n.vx += (W/2 - n.x) * 0.008;
        n.vy += (H/2 - n.y) * 0.008;
      });
      const pad = 40;
      nodes.forEach(n => {
        n.x = Math.max(pad, Math.min(W - pad, n.x + n.vx));
        n.y = Math.max(pad, Math.min(H - pad, n.y + n.vy));
        n.vx *= 0.7; n.vy *= 0.7;
      });
    }
  }
  simulate();

  function draw(hoveredEdge, hoveredNode) {
    ctx.clearRect(0, 0, W, H);

    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      const isHov = hoveredEdge === e;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHov ? 'rgba(212,168,66,0.9)' : `rgba(123,94,167,${0.15 + e.weight * 0.15})`;
      ctx.lineWidth = isHov ? 2 : e.weight;
      ctx.stroke();

      if (isHov) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const label = e.shared.join(', ');
        ctx.font = '11px Lato, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10,8,18,0.85)';
        ctx.fillRect(mx - tw/2 - 6, my - 16, tw + 12, 22);
        ctx.fillStyle = '#d4a842';
        ctx.textAlign = 'center';
        ctx.fillText(label, mx, my);
      }
    });

    nodes.forEach((n, i) => {
      const isHov = hoveredNode === n;
      const r = isHov ? 22 : 18;
      const grd = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, r);
      grd.addColorStop(0, isHov ? 'rgba(212,168,66,0.9)' : 'rgba(123,94,167,0.8)');
      grd.addColorStop(1, isHov ? 'rgba(212,168,66,0.2)' : 'rgba(26,19,48,0.6)');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = isHov ? 'rgba(212,168,66,0.8)' : 'rgba(200,191,224,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `bold 10px Lato, sans-serif`;
      ctx.fillStyle = isHov ? '#d4a842' : 'rgba(232,226,244,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y + r + 13);

      if (isHov) {
        const preview = n.dream.slice(0, 50) + '…';
        ctx.font = '10px Lato, sans-serif';
        const tw = ctx.measureText(preview).width;
        ctx.fillStyle = 'rgba(10,8,18,0.85)';
        ctx.fillRect(n.x - tw/2 - 6, n.y - r - 28, tw + 12, 20);
        ctx.fillStyle = '#e8e2f4';
        ctx.fillText(preview, n.x, n.y - r - 13);
      }
    });
  }

  draw(null, null);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * (W / rect.width), y: (src.clientY - rect.top) * (H / rect.height) };
  }

  function findHovered(px, py) {
    let hNode = null, hEdge = null;
    nodes.forEach(n => { if (Math.hypot(px - n.x, py - n.y) < 24) hNode = n; });
    if (!hNode) {
      edges.forEach(e => {
        const a = nodes[e.a], b = nodes[e.b];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const t = Math.max(0, Math.min(1, ((px-a.x)*(b.x-a.x)+(py-a.y)*(b.y-a.y))/(len*len)));
        const d = Math.hypot(px - (a.x + t*(b.x-a.x)), py - (a.y + t*(b.y-a.y)));
        if (d < 12) hEdge = e;
      });
    }
    return { hNode, hEdge };
  }

  canvas.onmousemove = canvas.ontouchmove = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const { hNode, hEdge } = findHovered(x, y);
    canvas.style.cursor = (hNode || hEdge) ? 'pointer' : 'default';
    draw(hEdge, hNode);
  };
  canvas.onmouseleave = () => draw(null, null);
}

function renderDiary() {
  const list = document.getElementById('diary-list');
  const dreams = JSON.parse(localStorage.getItem('morpheus-dreams') || '[]');
  if (!dreams.length) {
    list.innerHTML = `<div class="diary-empty">
      <div class="diary-empty-icon">🌙</div>
      <div class="diary-empty-text">Seu diário dos sonhos aguarda<br>as primeiras memórias oníricas...</div>
    </div>`;
    return;
  }
  const vertenteIcon = { jung: '🔮', freud: '🛋️', esoterismo: '🌙' };
  list.innerHTML = dreams.map((d, i) => {
    const date = new Date(d.date);
    const formatted = date.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    return `<div class="dream-entry" onclick="showEntry(${i})">
      <div class="entry-date">${formatted.toUpperCase()}</div>
      <div class="entry-preview">${d.dream}</div>
      <div class="entry-vertente">${vertenteIcon[d.vertente] || '🌙'}</div>
    </div>`;
  }).join('');
}

function showEntry(i) {
  const dreams = JSON.parse(localStorage.getItem('morpheus-dreams') || '[]');
  const d = dreams[i];
  if (!d) return;
  window.lastInterpretation = d;
  document.getElementById('dream-input').value = d.dream;
  selectedVertente = d.vertente ?? 'jung';

  document.querySelectorAll('.chip[data-vertente]').forEach(b => {
    b.classList.toggle('selected', b.dataset.vertente === selectedVertente);
  });

  const imgContainer = document.getElementById('dream-image-container');
  if (d.image_url) {
    const imgEl = document.getElementById('dream-image');
    imgEl.src = d.image_url;
    imgEl.onload = () => imgContainer.classList.add('show');
  } else {
    imgContainer.classList.remove('show');
  }
  document.getElementById('result-text').textContent = d.result;
  const vertenteSymbol = { jung: '🔮', freud: '🛋️', esoterismo: '🌙' };
  document.getElementById('result-symbol').textContent = vertenteSymbol[d.vertente] || '🌙';
  document.getElementById('result-meta').innerHTML = '';
  document.getElementById('result-card').classList.add('show');
  showPage('interpret', document.querySelector('.bnav-btn'));
}
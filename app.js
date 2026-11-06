// Pautas — sorteador de assuntos. Dados em pautas.json; o resto fica no localStorage.

const CHAVES = { salvos: "pautas.salvos", meus: "pautas.meus", vistos: "pautas.vistos", tempos: "pautas.tempos" };

function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo privado: segue sem guardar */ }
}

const $ = (id) => document.getElementById(id);
const el = {
  cartao: $("cartao"), tema: $("c-tema"), titulo: $("c-titulo"),
  restantes: $("c-restantes"), salvar: $("b-salvar"),
  girar: $("b-girar"), pesquisar: $("b-pesquisar"), falar: $("b-falar"),
  timer: $("timer"), tFase: $("t-fase"), tRelogio: $("t-relogio"), tBarra: $("t-barra"), tAcoes: $("t-acoes"),
  nMeus: $("n-meus"), nSalvos: $("n-salvos"), lMeus: $("l-meus"), lSalvos: $("l-salvos"),
  fMeus: $("f-meus"), iMeu: $("i-meu"), rodape: $("rodape"),
};

const estado = {
  config: { tempo_pesquisa_minutos: 10, tempo_fala_minutos: 1 },
  padrao: { pesquisa: 600, fala: 60 },  // segundos, vindos do pautas.json
  tempos: null,                          // segundos em uso (padrão ou o que a pessoa salvou)
  temas: [],
  todos: [],                       // [{chave, titulo, tema}]
  atual: null,
  girando: false,
  salvos: ler(CHAVES.salvos, []),  // [{chave, titulo, tema}]
  meus: ler(CHAVES.meus, []),      // [{id, titulo}]
  vistos: new Set(ler(CHAVES.vistos, [])),
};

/* ---------- dados ---------- */

async function iniciar() {
  try {
    const resp = await fetch("pautas.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(resp.status);
    const dados = await resp.json();
    Object.assign(estado.config, dados.configuracao || {});
    estado.temas = dados.temas;
    estado.todos = dados.temas.flatMap((t) =>
      t.topicos.map((p) => ({ chave: `${t.id}-${p.id}`, titulo: p.titulo, tema: t.nome }))
    );
  } catch (erro) {
    el.titulo.textContent = "Não consegui ler o pautas.json. Abra o site por um servidor local (veja o README).";
    el.girar.disabled = true;
    console.error(erro);
    return;
  }

  estado.padrao = {
    pesquisa: Math.round(estado.config.tempo_pesquisa_minutos * 60),
    fala: Math.round(estado.config.tempo_fala_minutos * 60),
  };
  const salvos = ler(CHAVES.tempos, null);
  estado.tempos = validos(salvos) ? salvos : { ...estado.padrao };
  aplicarTempos();
  el.rodape.textContent = `${estado.todos.length} assuntos em ${estado.temas.length} temas · seus salvos e temas ficam neste navegador`;

  desenharMeus();
  desenharSalvos();
  atualizarRestantes();
}

function meusComoPautas() {
  return estado.meus.map((m) => ({ chave: `m-${m.id}`, titulo: m.titulo, tema: "Meus temas" }));
}

// Sorteia entre todos os assuntos do JSON mais os escritos em "Meus temas".
function conjunto() {
  return estado.todos.concat(meusComoPautas());
}

function atualizarRestantes() {
  const lista = conjunto();
  const faltam = lista.filter((p) => !estado.vistos.has(p.chave)).length;
  el.restantes.textContent = lista.length ? `${faltam} de ${lista.length} ainda não sorteados` : "";
}

/* ---------- sorteio ---------- */

function sortear() {
  if (estado.girando || timer.rodando) return;
  const lista = conjunto();
  if (!lista.length) return;

  let disponiveis = lista.filter((p) => !estado.vistos.has(p.chave) && p.chave !== estado.atual?.chave);
  if (!disponiveis.length) {
    // passou por todos: recomeça, sem repetir o atual
    lista.forEach((p) => estado.vistos.delete(p.chave));
    disponiveis = lista.filter((p) => p.chave !== estado.atual?.chave);
    if (!disponiveis.length) disponiveis = lista;
  }
  const escolhida = disponiveis[Math.floor(Math.random() * disponiveis.length)];

  fecharTimer();
  const semAnimacao = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (semAnimacao) return revelar(escolhida);

  estado.girando = true;
  el.girar.disabled = el.pesquisar.disabled = el.falar.disabled = true;
  el.cartao.classList.remove("revelado");
  el.cartao.classList.add("girando");
  let passos = 0;
  const giro = setInterval(() => {
    const p = lista[Math.floor(Math.random() * lista.length)];
    el.tema.textContent = p.tema;
    el.titulo.textContent = p.titulo;
    if (++passos >= 14) { clearInterval(giro); revelar(escolhida); }
  }, 60);
}

function revelar(pauta) {
  estado.girando = false;
  estado.atual = pauta;
  estado.vistos.add(pauta.chave);
  gravar(CHAVES.vistos, [...estado.vistos]);

  el.cartao.classList.remove("girando", "revelado");
  void el.cartao.offsetWidth; // reinicia a animação
  el.cartao.classList.add("revelado");
  el.tema.textContent = pauta.tema;
  el.titulo.textContent = pauta.titulo;
  el.girar.disabled = false;
  el.girar.textContent = "Girar de novo";
  el.pesquisar.disabled = el.falar.disabled = false;
  el.salvar.hidden = false;
  atualizarBotaoSalvar();
  atualizarRestantes();
}

/* ---------- salvos ---------- */

const estaSalva = (chave) => estado.salvos.some((s) => s.chave === chave);

function alternarSalvo(pauta) {
  if (estaSalva(pauta.chave)) estado.salvos = estado.salvos.filter((s) => s.chave !== pauta.chave);
  else estado.salvos.unshift({ chave: pauta.chave, titulo: pauta.titulo, tema: pauta.tema });
  gravar(CHAVES.salvos, estado.salvos);
  atualizarBotaoSalvar();
  desenharSalvos();
}

function atualizarBotaoSalvar() {
  const salva = estado.atual && estaSalva(estado.atual.chave);
  el.salvar.setAttribute("aria-pressed", String(!!salva));
  el.salvar.textContent = salva ? "♥ salva" : "♡ salvar";
}

function desenharSalvos() {
  el.nSalvos.textContent = estado.salvos.length || "";
  if (!estado.salvos.length) {
    el.lSalvos.replaceChildren(vazio("Nenhuma pauta salva ainda. Toque em ♡ salvar depois de girar."));
    return;
  }
  el.lSalvos.replaceChildren(...estado.salvos.map((s) =>
    item(s.titulo, s.tema, [
      ["Usar", () => { usarPauta(s); }],
      ["Remover", () => { alternarSalvo(s); }],
    ])
  ));
}

function usarPauta(pauta) {
  fecharTimer();
  mostrarAba("sortear");
  revelar(pauta);
}

/* ---------- meus temas ---------- */

function desenharMeus() {
  el.nMeus.textContent = estado.meus.length || "";
  if (!estado.meus.length) {
    el.lMeus.replaceChildren(vazio("Você ainda não escreveu nenhum tema."));
    return;
  }
  el.lMeus.replaceChildren(...estado.meus.map((m) =>
    item(m.titulo, null, [
      ["Usar", () => usarPauta({ chave: `m-${m.id}`, titulo: m.titulo, tema: "Meus temas" })],
      ["Remover", () => {
        estado.meus = estado.meus.filter((x) => x.id !== m.id);
        gravar(CHAVES.meus, estado.meus);
        desenharMeus(); atualizarRestantes();
      }],
    ])
  ));
}

el.fMeus.addEventListener("submit", (e) => {
  e.preventDefault();
  const linhas = el.iMeu.value.split("\n").map((l) => l.trim()).filter(Boolean);
  const existentes = new Set(estado.meus.map((m) => m.titulo.toLowerCase()));
  for (const titulo of linhas) {
    if (existentes.has(titulo.toLowerCase())) continue;
    existentes.add(titulo.toLowerCase());
    estado.meus.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), titulo: titulo.slice(0, 140) });
  }
  gravar(CHAVES.meus, estado.meus);
  el.iMeu.value = "";
  desenharMeus(); atualizarRestantes();
});

el.iMeu.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.fMeus.requestSubmit(); }
});

/* ---------- itens de lista ---------- */

function item(titulo, tema, acoes) {
  const li = document.createElement("li");
  const texto = document.createElement("div");
  texto.className = "texto";
  if (tema) { const s = document.createElement("small"); s.textContent = tema; texto.append(s); }
  texto.append(titulo);
  li.append(texto);
  for (const [rotulo, acao] of acoes) {
    const b = document.createElement("button");
    b.className = "icone";
    b.textContent = rotulo;
    b.addEventListener("click", acao);
    li.append(b);
  }
  return li;
}

function vazio(msg) {
  const li = document.createElement("li");
  li.className = "vazio";
  li.textContent = msg;
  return li;
}

/* ---------- ajuste de tempos ---------- */

const MIN_SEG = 5, MAX_SEG = 120 * 60;

function validos(t) {
  return t && [t.pesquisa, t.fala].every((s) => Number.isFinite(s) && s >= MIN_SEG && s <= MAX_SEG);
}

// 900 -> "15 min", 90 -> "1 min 30 s", 45 -> "45 s"
function formatarTempo(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

function aplicarTempos() {
  const { pesquisa, fala } = estado.tempos;
  $("lema-p").textContent = $("lbl-p").textContent = formatarTempo(pesquisa);
  $("lema-f").textContent = $("lbl-f").textContent = formatarTempo(fala);
  $("p-min").value = Math.floor(pesquisa / 60); $("p-seg").value = pesquisa % 60;
  $("f-min").value = Math.floor(fala / 60);     $("f-seg").value = fala % 60;
}

function lerCampo(id) {
  const n = Number($(id).value || 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : NaN;
}

function avisarTempos(msg, erro = false) {
  const p = $("tempos-msg");
  p.textContent = msg;
  p.classList.toggle("erro", erro);
}

$("f-tempos").addEventListener("submit", (e) => {
  e.preventDefault();
  const novo = {
    pesquisa: lerCampo("p-min") * 60 + lerCampo("p-seg"),
    fala: lerCampo("f-min") * 60 + lerCampo("f-seg"),
  };
  if ([lerCampo("p-seg"), lerCampo("f-seg")].some((s) => s > 59)) return avisarTempos("Os segundos vão de 0 a 59.", true);
  if (!validos(novo)) return avisarTempos("Cada tempo precisa ficar entre 5 segundos e 120 minutos.", true);
  estado.tempos = novo;
  gravar(CHAVES.tempos, novo);
  aplicarTempos();
  avisarTempos(`Salvo: pesquisa de ${formatarTempo(novo.pesquisa)}, fala de ${formatarTempo(novo.fala)}.`
    + (timer.rodando ? " Vale a partir do próximo cronômetro." : ""));
});

$("b-padrao").addEventListener("click", () => {
  estado.tempos = { ...estado.padrao };
  try { localStorage.removeItem(CHAVES.tempos); } catch { /* sem storage */ }
  aplicarTempos();
  avisarTempos(`Voltou ao padrão: pesquisa de ${formatarTempo(estado.padrao.pesquisa)}, fala de ${formatarTempo(estado.padrao.fala)}.`);
});

/* ---------- cronômetro ---------- */

const timer = { fase: null, total: 0, fim: 0, restante: 0, pausado: false, rodando: false, id: null };
const tituloOriginal = document.title;

function iniciarTimer(fase) {
  const ms = estado.tempos[fase] * 1000;
  clearInterval(timer.id);
  Object.assign(timer, { fase, total: ms, restante: ms, pausado: false, rodando: true });
  timer.fim = Date.now() + timer.total;
  el.timer.hidden = false;
  el.timer.classList.remove("acabou");
  el.tFase.textContent = fase === "pesquisa" ? "🔬 Pesquisando" : "🎙 Falando";
  el.girar.disabled = el.pesquisar.disabled = el.falar.disabled = true;
  acoesTimer();
  tique();
  timer.id = setInterval(tique, 250);
}

function tique() {
  if (!timer.pausado) timer.restante = Math.max(0, timer.fim - Date.now());
  const seg = Math.ceil(timer.restante / 1000);
  const texto = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  el.tRelogio.textContent = texto;
  el.tBarra.style.width = `${(1 - timer.restante / timer.total) * 100}%`;
  document.title = `${texto} · ${timer.fase === "pesquisa" ? "Pesquisando" : "Falando"}`;
  if (timer.restante <= 0) terminarTimer();
}

function pausarOuContinuar() {
  if (timer.pausado) { timer.fim = Date.now() + timer.restante; timer.pausado = false; }
  else timer.pausado = true;
  acoesTimer();
}

function terminarTimer() {
  clearInterval(timer.id);
  timer.rodando = false;
  document.title = tituloOriginal;
  el.timer.classList.add("acabou");
  bip();
  if (timer.fase === "pesquisa") {
    el.tFase.textContent = "Tempo de pesquisa acabou";
    acoesTimer([["🎙 Começar a falar", () => iniciarTimer("fala"), true], ["Fechar", fecharTimer]]);
  } else {
    el.tFase.textContent = "Pronto! Mandou bem.";
    acoesTimer([["Girar outra", () => { fecharTimer(); sortear(); }, true], ["Fechar", fecharTimer]]);
  }
}

function fecharTimer() {
  clearInterval(timer.id);
  timer.rodando = false;
  document.title = tituloOriginal;
  el.timer.hidden = true;
  el.girar.disabled = false;
  el.pesquisar.disabled = el.falar.disabled = !estado.atual;
}

function acoesTimer(botoes) {
  botoes ??= [
    [timer.pausado ? "▶ Continuar" : "❚❚ Pausar", pausarOuContinuar],
    ["Encerrar", fecharTimer],
  ];
  el.tAcoes.replaceChildren(...botoes.map(([rotulo, acao, primario]) => {
    const b = document.createElement("button");
    b.className = `btn pequeno${primario ? " primario" : ""}`;
    b.textContent = rotulo;
    b.addEventListener("click", acao);
    return b;
  }));
}

function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* sem áudio, sem problema */ }
}

/* ---------- abas ---------- */

function mostrarAba(nome) {
  document.querySelectorAll(".aba-btn").forEach((b) => {
    if (b.dataset.aba === nome) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  document.querySelectorAll(".aba").forEach((s) => { s.hidden = s.id !== `aba-${nome}`; });
}

document.querySelectorAll(".aba-btn").forEach((b) => b.addEventListener("click", () => mostrarAba(b.dataset.aba)));

/* ---------- eventos ---------- */

el.girar.addEventListener("click", sortear);
el.pesquisar.addEventListener("click", () => iniciarTimer("pesquisa"));
el.falar.addEventListener("click", () => iniciarTimer("fala"));
el.salvar.addEventListener("click", () => estado.atual && alternarSalvo(estado.atual));

document.addEventListener("keydown", (e) => {
  const digitando = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (e.code === "Space" && !digitando && !$("aba-sortear").hidden && document.activeElement?.tagName !== "BUTTON") {
    e.preventDefault();
    sortear();
  }
});

iniciar();

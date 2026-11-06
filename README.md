# Pautas

Sorteador de assuntos: gira um tópico, pesquisa 10 min, fala 1 min.

Sem banco de dados. Os assuntos ficam em `pautas.json`. Salvos e "Meus temas" ficam no `localStorage` do navegador.

## Rodar

O navegador não deixa o site ler o `pautas.json` abrindo o `index.html` direto (file://). Use um servidor local:

```bash
python -m http.server 5173
```

Depois abra http://localhost:5173.

## Editar os assuntos

Edite `pautas.json`. Cada tema tem `id`, `nome` e `topicos` (`id`, `titulo`). Os tempos ficam em `configuracao`.
O par `id do tema` + `id do tópico` identifica a pauta salva, então não reaproveite ids.

## Publicar

É um site estático: suba a pasta na Vercel, Netlify ou GitHub Pages, sem build.

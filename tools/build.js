// いち日写真館HPの組み立て。src/*.html(元の文章)から、公開用のHTMLをリポジトリ直下に作る。
// 使い方: (このフォルダの外で) npm i @babel/core @babel/preset-react react@18.3.1 react-dom@18.3.1
//        NODE_PATH=<node_modulesの場所> node tools/build.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToString } = require('react-dom/server');
const ROOT = path.join(__dirname, '..');
const PROD = {
  react: '<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" integrity="sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z" crossorigin="anonymous"></script>',
  dom: '<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" integrity="sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1" crossorigin="anonymous"></script>',
};
const preset = require.resolve('@babel/preset-react');
let ok = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.endsWith('.html'))) {
  let s = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  const m = s.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
  if (!m) { console.log('skip', f); continue; }
  const code = babel.transformSync(m[1], { presets: [[preset, { runtime: 'classic' }]], sourceType: 'script', compact: false, comments: false }).code;
  // サーバー側で一度だけ組み立てて、本文を取り出す
  let element = null;
  const stubEl = { style: {}, classList: { add(){}, remove(){} }, addEventListener(){}, value: '' };
  const ctx = {
    React, console, setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    ReactDOM: { createRoot: () => ({ render: (el) => { element = el; } }) },
    document: { getElementById: () => stubEl, querySelector: () => null, querySelectorAll: () => [], documentElement: stubEl, body: stubEl, addEventListener(){} },
    location: { hash: '', pathname: '/' + f, href: 'https://hitoandhito.com/' + f },
    navigator: { userAgent: '' }, Date, Math, JSON, Intl,
  };
  ctx.window = ctx; ctx.window.addEventListener = () => {}; ctx.window.removeEventListener = () => {};
  ctx.window.scrollY = 0; ctx.window.innerWidth = 1200; ctx.window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
  vm.runInNewContext(code, ctx, { filename: f });
  if (!element) throw new Error('no render in ' + f);
  const html = renderToString(element);
  s = s.replace(/<script src="https:\/\/unpkg\.com\/react@18\.3\.1\/umd\/react\.development\.js"[^>]*><\/script>/, PROD.react)
       .replace(/<script src="https:\/\/unpkg\.com\/react-dom@18\.3\.1\/umd\/react-dom\.development\.js"[^>]*><\/script>/, PROD.dom)
       .replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone[^>]*><\/script>\n?/, '')
       .replace('<div id="root"></div>', '<div id="root">' + html + '</div>')
       .replace(m[0], () => '<script>\n' + code + '\n</script>');
  if (s.includes('text/babel') || s.includes('react.development')) throw new Error('leftover in ' + f);
  s = s.replace(/^(<!DOCTYPE html>\s*\n?)/i, '$1<!-- このファイルは tools/build.js で src/' + f + ' から作っています。直すときは src/ を直してください -->\n');
  fs.writeFileSync(path.join(ROOT, f), s);
  ok++;
}
console.log('built', ok, 'pages');

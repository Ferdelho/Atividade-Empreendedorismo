/* =========================================================
   qr.js — gerador de QR Code sem dependências.
   Modo byte (UTF-8), correção de erros nível M, versões 1 a 10
   (até 213 caracteres). Uso:  QR.svg("texto")  ->  string <svg>
   ========================================================= */
(function (global) {
  'use strict';

  // [bytes de correção por bloco, nº blocos G1, dados por bloco G1, nº blocos G2, dados por bloco G2]
  var TABLE = [null,
    [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var MAX_VERSION = 10;

  /* ---------- Aritmética em GF(256) e Reed-Solomon ---------- */
  var EXP = [], LOG = [];
  (function () {
    var x = 1, i;
    for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(n) {
    var g = [1], i, j;
    for (i = 0; i < n; i++) {
      var next = [];
      for (j = 0; j <= g.length; j++) next.push(0);
      for (j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
      g = next;
    }
    return g;
  }
  function rsRemainder(data, gen) {
    var n = gen.length - 1, rem = [], i;
    for (i = 0; i < n; i++) rem.push(0);
    data.forEach(function (b) {
      var f = b ^ rem.shift();
      rem.push(0);
      for (var k = 0; k < n; k++) rem[k] ^= gmul(gen[k + 1], f);
    });
    return rem;
  }

  /* ---------- Máscaras e penalidades ---------- */
  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; },
    function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }
  ];

  function penalty(m, size) {
    var p = 0, a, b, x, y, dark = 0;
    for (var dir = 0; dir < 2; dir++) {
      for (a = 0; a < size; a++) {
        var str = '', run = 1;
        for (b = 0; b < size; b++) str += (dir ? m[b][a] : m[a][b]) ? '1' : '0';
        for (b = 1; b < size; b++) {
          if (str[b] === str[b - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
        for (b = 0; b + 11 <= size; b++) {
          var s = str.substr(b, 11);
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      }
    }
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
    }
    var total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }

  /* ---------- Construção da matriz ---------- */
  function matrix(text) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text)));
    var v, info, capCw, i, j;

    for (v = 1; v <= MAX_VERSION; v++) {
      info = TABLE[v];
      capCw = info[1] * info[2] + info[3] * info[4];
      if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= capCw * 8) break;
    }
    if (v > MAX_VERSION) throw new Error('Texto longo demais para o QR Code (máximo de 213 bytes).');

    // 1) Fluxo de bits: modo byte + tamanho + dados + terminador + preenchimento
    var bits = [];
    function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, capCw * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < capCw * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);

    var data = [];
    for (i = 0; i < bits.length; i += 8) {
      var by = 0;
      for (j = 0; j < 8; j++) by = (by << 1) | bits[i + j];
      data.push(by);
    }

    // 2) Blocos + Reed-Solomon + intercalação
    var ecLen = info[0], gen = rsGenerator(ecLen), blocks = [], pos = 0;
    for (var bi = 0; bi < info[1] + info[3]; bi++) {
      var len = bi < info[1] ? info[2] : info[4];
      var d = data.slice(pos, pos + len);
      pos += len;
      blocks.push({ d: d, e: rsRemainder(d, gen) });
    }
    var codewords = [], maxLen = info[3] ? info[4] : info[2];
    for (i = 0; i < maxLen; i++) blocks.forEach(function (b) { if (i < b.d.length) codewords.push(b.d[i]); });
    for (i = 0; i < ecLen; i++) blocks.forEach(function (b) { codewords.push(b.e[i]); });

    // 3) Padrões de função
    var size = 17 + 4 * v, mod = [], fn = [], y, x;
    for (y = 0; y < size; y++) {
      mod.push([]); fn.push([]);
      for (x = 0; x < size; x++) { mod[y].push(false); fn[y].push(false); }
    }
    function setF(px, py, dark) { mod[py][px] = dark; fn[py][px] = true; }

    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    });
    var ap = ALIGN[v], na = ap.length;
    for (var a = 0; a < na; a++) {
      for (var b = 0; b < na; b++) {
        if ((a === 0 && b === 0) || (a === 0 && b === na - 1) || (a === na - 1 && b === 0)) continue;
        for (var ey = -2; ey <= 2; ey++) {
          for (var ex = -2; ex <= 2; ex++) setF(ap[a] + ex, ap[b] + ey, Math.max(Math.abs(ex), Math.abs(ey)) !== 1);
        }
      }
    }

    // Informação de formato (nível M = 00) e versão
    function drawFormat(m, mask) {
      var d = mask, rem = d, k;
      for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var f = ((d << 10) | rem) ^ 0x5412;
      function bit(n) { return ((f >>> n) & 1) === 1; }
      for (k = 0; k <= 5; k++) m[k][8] = bit(k);
      m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
      for (k = 9; k < 15; k++) m[8][14 - k] = bit(k);
      for (k = 0; k < 8; k++) m[8][size - 1 - k] = bit(k);
      for (k = 8; k < 15; k++) m[size - 15 + k][8] = bit(k);
      m[size - 8][8] = true;
    }
    drawFormat(mod, 0);
    markFormatAreas();
    function markFormatAreas() {
      var k;
      for (k = 0; k < 9; k++) { fn[k][8] = true; fn[8][k] = true; }
      for (k = 0; k < 8; k++) { fn[8][size - 1 - k] = true; fn[size - 1 - k][8] = true; }
      fn[size - 8][8] = true;
    }
    if (v >= 7) {
      var vr = v, vi;
      for (vi = 0; vi < 12; vi++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
      var vbits = (v << 12) | vr;
      for (vi = 0; vi < 18; vi++) {
        var bt = ((vbits >>> vi) & 1) === 1, pa = size - 11 + (vi % 3), pb = Math.floor(vi / 3);
        setF(pa, pb, bt); setF(pb, pa, bt);
      }
    }

    // 4) Posiciona os dados em zigue-zague
    var n = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var cx = right - jj, upward = ((right + 1) & 2) === 0, cy = upward ? size - 1 - vert : vert;
          if (!fn[cy][cx] && n < total) {
            mod[cy][cx] = ((codewords[n >>> 3] >>> (7 - (n & 7))) & 1) === 1;
            n++;
          }
        }
      }
    }

    // 5) Escolhe a máscara de menor penalidade
    var best = null, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var cand = [];
      for (y = 0; y < size; y++) {
        cand.push([]);
        for (x = 0; x < size; x++) cand[y].push(mod[y][x] !== (!fn[y][x] && MASKS[mk](y, x)));
      }
      drawFormat(cand, mk);
      var score = penalty(cand, size);
      if (score < bestScore) { bestScore = score; best = cand; }
    }
    return best;
  }

  /* ---------- Saída em SVG (com borda branca de 4 módulos) ---------- */
  function svg(text, label) {
    var m = matrix(text), size = m.length, border = 4, d = [];
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) if (m[y][x]) d.push('M' + (x + border) + ',' + (y + border) + 'h1v1h-1z');
    }
    var dim = size + border * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="' + (label || 'QR Code') + '">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
      '<path fill="#000" d="' + d.join('') + '"/></svg>';
  }

  global.QR = { svg: svg, matrix: matrix };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.QR;
})(typeof window !== 'undefined' ? window : globalThis);

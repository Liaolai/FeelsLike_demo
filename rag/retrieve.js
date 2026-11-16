/* ══════════════════════════════════════════════════════════════════════════
   FeelsLike RAG · KB-A 检索器（唯一检索实现；浏览器 + Node 通用，零依赖）

   设计决定（有意收敛，避免重蹈「合成个人 / LLM 空转」）：
     1. 只做 KB-A。KB-B 耦合卡需要真实个人样本，缺失时构造会变成自指闭环，故不构建。
     2. 输出「证据包」而非生成文本；generation_slot 恒为 null，G 是可替换槽位。
     3. PersonalContext 只承载用户本次场景与自报，绝不读取合成评分历史。
     4. 硬门控在检索层机器化：title-only 禁供数字、projected 强制标注、
        红线词后检、覆盖外如实说证据不足。
     5. 68 条规模不用向量库/运行时 embedding：确定性打分，可复现、可审计。

   浏览器接入（不修改 simulator/index.html 即可用；file:// 下无需 fetch）：
     <script src="rag/retrieve.js"></script>
     <script src="rag/kb_v1.js"></script>
     <script>
       const rag = FeelsLikeRAG.load(window.FEELSLIKE_KB);
       const pack = rag.retrieve({chain:'decision', question:'...', place:'西湖'});
     </script>
   Node：
     const RAG = require('./retrieve.js');
     const rag = RAG.load(require('./kb_v1.json'));
     node rag/cli.js --q "..." --chain decision
     node rag/selftest.js
   ══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FeelsLikeRAG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_SCORE = 4;
  var MIN_MATCH = 2;
  var FIELD_WEIGHTS = [
    ['plain_zh', 3], ['mechanism_zh', 2], ['title', 2], ['tags', 3], ['chain', 1], ['region', 1],
  ];

  function tokens(s) {
    var raw = String(s == null ? '' : s).toLowerCase();
    var out = [];
    (raw.match(/[a-z0-9]+/g) || []).forEach(function (w) { if (w.length > 1) out.push(w); });
    (raw.match(/[\u4e00-\u9fa5]+/g) || []).forEach(function (seg) {
      if (seg.length === 1) { out.push(seg); return; }
      for (var i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
    });
    return out;
  }

  function uniq(a) {
    var seen = {}, out = [];
    a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }

  function scoreCard(card, qTokens, ctx) {
    var score = 0, matched = [];
    FIELD_WEIGHTS.forEach(function (fw) {
      var v = card[fw[0]];
      if (Array.isArray(v)) v = v.join(' ');
      var counts = {};
      tokens(v).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      qTokens.forEach(function (q) {
        var c = counts[q] || 0;
        if (c) { score += fw[1] * (1 + Math.log(c)); matched.push(q); }
      });
    });
    if (ctx.chain && card.chain_slug === ctx.chain) score += 2;
    if (card.verification_level === 'fulltext') score += 1.5;
    else if (card.verification_level === 'abstract') score += 0.8;
    if (card.numbers_allowed) score += 0.3;
    if (card.ocean_line && !ctx.ocean) score *= 0.5;
    return { score: score, matched: uniq(matched) };
  }

  function projectCard(c, sc) {
    return {
      id: c.id,
      cite: '[' + c.id + ']',
      kind: c.kind,
      chain: c.chain,
      chain_slug: c.chain_slug,
      title: c.title,
      journal: c.journal,
      year: c.year,
      doi: c.doi,
      url: c.url,
      region: c.region,
      verification_level: c.verification_level,
      effect: c.effect,
      effect_label: (c.effect.type === 'projected' || c.effect.type === 'mixed') ? '（含预测，不得写为已发生）' : '',
      numbers: c.numbers_allowed ? (c.numbers || []) : [],
      numbers_allowed: c.numbers_allowed,
      plain_zh: c.plain_zh,
      plain_zh_kind: 'pitch_claim_not_evidence',
      mechanism_zh: c.mechanism_zh,
      red_lines: c.red_lines || [],
      score: Math.round(sc.score * 100) / 100,
      matched: sc.matched.slice(0, 10),
    };
  }

  function redlineCheck(text, terms) {
    var t = String(text || '');
    return (terms || []).filter(function (term) { return t.indexOf(term) >= 0; });
  }

  function load(kb) {
    if (!kb || !Array.isArray(kb.cards)) throw new Error('invalid kb: cards[] required');
    var cards = kb.cards.filter(function (c) { return c.kind === 'literature'; });
    var redlines = kb.redlines || [];
    var negative = kb.negative_space || [];
    var terms = kb.redline_terms || [];

    return {
      version: kb.version,
      cardCount: cards.length,

      /* PersonalContext：只接收本次场景与用户自报，不接受合成评分历史 */
      retrieve: function (ctx, opts) {
        ctx = ctx || {};
        opts = opts || {};
        var topK = opts.topK || 5;
        var allowProjected = ctx.allowProjected !== false;
        var qTokens = uniq(tokens(
          [ctx.question, ctx.place, ctx.season, ctx.tod, ctx.activity, ctx.contextHint].join(' ')
        ));

        var pool = cards.filter(function (c) {
          if (!allowProjected && (c.effect.type === 'projected' || c.effect.type === 'mixed')) return false;
          return true;
        });

        var scored = pool.map(function (c) {
          var sc = scoreCard(c, qTokens, ctx);
          return { card: c, sc: sc };
        }).sort(function (a, b) { return b.sc.score - a.sc.score; });

        var best = scored[0];
        var hit = scored.filter(function (x) {
          return x.sc.score >= MIN_SCORE && x.sc.matched.length >= MIN_MATCH;
        });
        var coverage = hit.length > 0;

        // 结构化路由：同链高分卡无条件作为锚点（方案 §5.2 的「耦合卡锚点」在 KB-A 内的等价实现）
        var anchors = [];
        if (ctx.chain) {
          anchors = scored.filter(function (x) {
            return x.card.chain_slug === ctx.chain && x.sc.score >= MIN_SCORE;
          }).slice(0, 2).map(function (x) { return projectCard(x.card, x.sc); });
        }

        var picked = [], seen = {};
        anchors.forEach(function (a) { picked.push(a); seen[a.id] = 1; });
        hit.slice(0, topK).forEach(function (x) {
          if (!seen[x.card.id]) { picked.push(projectCard(x.card, x.sc)); seen[x.card.id] = 1; }
        });
        picked = picked.slice(0, topK + anchors.length);

        // 覆盖外：不编造结论，只给不带数字的通用机制 + 负空间
        if (!coverage) {
          var usable = scored.filter(function (x) {
            return x.card.verification_level !== 'title-only';
          });
          var sameChain = ctx.chain ? usable.filter(function (x) {
            return x.card.chain_slug === ctx.chain;
          }) : [];
          var generic = (sameChain.length ? sameChain : usable).slice(0, 2).map(function (x) {
            var p = projectCard(x.card, x.sc);
            p.numbers = [];
            p.plain_zh = null;           // 不带任何可能含数字的结论
            p.mechanism_zh = null;
            return p;
          });
          return {
            version: kb.version,
            coverage: false,
            reason: '该条件组合证据不足：检索未达到可引用阈值，只返回出处，不生成耦合结论。',
            ctx_echo: echo(ctx),
            anchors: [], cards: generic,
            redlines: redlines,
            negative_space: negative,
            redline_flags: redlineCheck(ctx.question, terms),
            best_score: best ? Math.round(best.sc.score * 100) / 100 : 0,
            generation_slot: null,
            disclaimer: '证据包由确定性检索产生；未接入生成模型，不构成解释或建议。',
          };
        }

        return {
          version: kb.version,
          coverage: true,
          reason: '已命中可引用证据；每个数字可追溯到卡 id 与 DOI。',
          ctx_echo: echo(ctx),
          anchors: anchors,
          cards: picked,
          redlines: redlines,
          negative_space: [],
          redline_flags: redlineCheck(ctx.question, terms),
          best_score: Math.round(best.sc.score * 100) / 100,
          generation_slot: null,
          disclaimer: '证据包由确定性检索产生；未接入生成模型，不构成解释或建议。'
                      + ' verification_level 与 effect.type 为自动判定，未经人工复核。',
        };
      },

      redlineCheck: function (text) { return redlineCheck(text, terms); },
      tokens: tokens,
    };
  }

  function echo(ctx) {
    return {
      chain: ctx.chain || null, place: ctx.place || null, season: ctx.season || null,
      tod: ctx.tod || null, activity: ctx.activity || null, feelScore: ctx.feelScore == null ? null : ctx.feelScore,
      question: ctx.question || null,
    };
  }

  /* 受控拼装：不是 LLM 生成。title-only 卡只给标题与出处，绝不输出结论或数字。 */
  function formatEvidencePack(r) {
    var out = [];
    out.push('【证据状态】' + (r.coverage ? '已命中证据' : r.reason));
    if (!r.coverage) {
      out.push('【可查出处】');
      (r.cards || []).forEach(function (c) { out.push('  [' + c.id + '] ' + c.title + ' — ' + c.url); });
      out.push('【负空间 / 还缺什么】');
      (r.negative_space || []).forEach(function (g) { out.push('  ' + g.id + ' ' + g.gap + '（' + g.source + '）'); });
    } else {
      out.push('【证据卡】');
      (r.cards || []).forEach(function (c) {
        if (!c.numbers_allowed) {
          out.push('  [' + c.id + '] ' + c.title + '（题录级核验，未读摘要，不提供结论或数字） — ' + c.url);
        } else {
          // 只输出已核验发现（key_finding_zh），不输出 pitch 话术
          var ev = c.mechanism_zh || c.title;
          if (ev.length > 160) ev = ev.slice(0, 160) + '…';
          out.push('  [' + c.id + '] ' + ev + c.effect_label + ' — ' + c.url);
        }
      });
    }
    if (r.redline_flags && r.redline_flags.length) {
      out.push('【红线告警】命中：' + r.redline_flags.join('、'));
    }
    out.push('【引用红线】');
    (r.redlines || []).forEach(function (x) { out.push('  ' + x.id + ' ' + x.title + '：' + x.rule); });
    out.push('【生成槽位】未接入（generation_slot = null）；本输出不是解释或建议。');
    return out.join('\n');
  }

  return {
    version: 'rag_v1',
    load: load,
    formatEvidencePack: formatEvidencePack,
    tokens: tokens,
    constants: { MIN_SCORE: MIN_SCORE, MIN_MATCH: MIN_MATCH },
  };
});

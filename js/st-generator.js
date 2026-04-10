/* Score Trainer — Hand Generator
 *
 * Archetype weight table, v2a/v2b generators, and calibration loop.
 * Depends on st-core.js, st-waits.js, and st-builder.js.
 */
(function (ST) {
  'use strict';

  // ---- Imports ------------------------------------------------------------
  var tile = ST.tile;
  var pickWeighted = ST.pickWeighted;
  var BankError = ST.BankError;
  var makeTileBank = ST.makeTileBank;
  var bankCount = ST.bankCount;
  var bankTake = ST.bankTake;
  var markAkadora = ST.markAkadora;
  var drawIndicators = ST.drawIndicators;
  var pickHonba = ST.pickHonba;
  var pickRoundWind = ST.pickRoundWind;
  var pickSeatWind = ST.pickSeatWind;
  var makeSituation = ST.makeSituation;
  var validateSituation = ST.validateSituation;
  var pickWaitShape = ST.pickWaitShape;
  var instantiateWaitShape = ST.instantiateWaitShape;
  var fillRemainingSets = ST.fillRemainingSets;

  // ----- Piece 2a: Plain concealed riichi ----------------------------------

  function generateHandV2a() {
    var shape = pickWaitShape();
    var bank = makeTileBank();
    var inst = instantiateWaitShape(shape, bank);
    var fill = fillRemainingSets(bank, inst.setsRemaining, inst.needsPair);
    var closed = inst.placedTiles.concat(fill);
    markAkadora(closed, inst.winningTile);
    var dora = drawIndicators(bank, 1);
    var ura  = drawIndicators(bank, 1);
    var winType = Math.random() < 0.5 ? 'tsumo' : 'ron';
    var s = makeSituation({
      handShape: 'standard', roundWind: pickRoundWind(), seatWind: pickSeatWind(),
      honba: pickHonba(), closedTiles: closed, calls: [],
      winningTile: inst.winningTile, winType: winType,
      riichi: true, doraIndicators: dora, uraIndicators: ura, waitShape: shape,
    });
    validateSituation(s);
    return s;
  }

  // ----- Archetype table ---------------------------------------------------

  var ARCHETYPES = [
    { name: 'riichi-plain',    weight: 25, build: function (b)    { return ST.buildRiichiPlain(b); } },
    { name: 'pinfu',           weight: 18, build: function (b, c) { return ST.buildPinfu(b, c); } },
    { name: 'tanyao-closed',   weight: 8,  build: function (b, c) { return ST.buildTanyao(b, c, true); } },
    { name: 'tanyao-open',     weight: 8,  build: function (b, c) { return ST.buildTanyao(b, c, false); } },
    { name: 'yakuhai',         weight: 10, build: function (b, c) { return ST.buildYakuhai(b, c); } },
    { name: 'honitsu-closed',  weight: 3,  build: function (b, c) { return ST.buildHonitsu(b, c, true); } },
    { name: 'honitsu-open',    weight: 3,  build: function (b, c) { return ST.buildHonitsu(b, c, false); } },
    { name: 'chinitsu-closed', weight: 2,  build: function (b, c) { return ST.buildChinitsu(b, c, true); } },
    { name: 'chinitsu-open',   weight: 1,  build: function (b, c) { return ST.buildChinitsu(b, c, false); } },
    { name: 'toitoi',          weight: 3,  build: function (b)    { return ST.buildToitoi(b); } },
    { name: 'chiitoitsu',      weight: 3,  build: function (b)    { return ST.buildChiitoitsu(b); } },
    { name: 'kokushi',         weight: 1,  build: function (b)    { return ST.buildKokushi(b); } },
    { name: 'iipeikou',        weight: 4,  build: function (b)    { return ST.buildIipeikou(b); } },
    { name: 'sanshoku',        weight: 3,  build: function (b)    { return ST.buildSanshoku(b); } },
    { name: 'ittsuu',          weight: 2,  build: function (b)    { return ST.buildIttsuu(b); } },
    { name: 'chanta',          weight: 2,  build: function (b, c) { return ST.buildChanta(b, c, false); } },
    { name: 'junchan',         weight: 1,  build: function (b, c) { return ST.buildChanta(b, c, true); } },
    { name: 'yakuman',         weight: 1,  build: function (b)    { return ST.buildYakuman(b); } },
  ];

  // ----- Main 2b generator -------------------------------------------------

  function generateHandV2b() {
    var roundWind = pickRoundWind();
    var seatWind = pickSeatWind();
    var ctx = { roundWind: roundWind, seatWind: seatWind };
    var archetype = pickWeighted(ARCHETYPES);
    var bank = makeTileBank();
    var result = archetype.build(bank, ctx);

    // Optional: promote a pon call to open kan (~8 %)
    if (Math.random() < 0.08) {
      for (var ci = 0; ci < result.calls.length; ci++) {
        if (result.calls[ci].type === 'pon') {
          var t = result.calls[ci].tiles[0];
          if (bankCount(bank, t.suit, t.value) >= 1) {
            bankTake(bank, t.suit, t.value, 1);
            result.calls[ci] = {
              type: 'kan',
              tiles: result.calls[ci].tiles.concat([tile(t.suit, t.value, false)])
            };
            break;
          }
        }
      }
    }

    markAkadora(result.closedTiles, result.winningTile);
    var numKans = 0;
    for (var ki = 0; ki < result.calls.length; ki++) {
      if (result.calls[ki].type === 'kan' || result.calls[ki].type === 'ankan') numKans++;
    }
    var dora = drawIndicators(bank, 1 + numKans);
    var ura = result.riichi ? drawIndicators(bank, 1 + numKans) : [];

    var s = makeSituation({
      handShape: result.handShape || 'standard',
      roundWind: roundWind, seatWind: seatWind, honba: pickHonba(),
      closedTiles: result.closedTiles, calls: result.calls,
      winningTile: result.winningTile, winType: result.winType,
      riichi: result.riichi,
      doraIndicators: dora, uraIndicators: ura,
      waitShape: result.waitShape || null,
    });
    s.archetype = archetype.name;
    validateSituation(s);
    return s;
  }

  // ----- Top-level generator -----------------------------------------------

  function generateHandRaw() {
    var lastErr = null;
    for (var i = 0; i < 10; i++) {
      try { return generateHandV2b(); }
      catch (e) {
        lastErr = e;
        if (!(e instanceof BankError) && e.name !== 'BankError') throw e;
      }
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('generateHandV2b failed 10x, falling back to v2a. Last error:', lastErr);
    }
    return generateHandV2a();
  }

  // ----- Piece 4: Calibration loop ------------------------------------------
  // Generate hands until one scores.  Attach the scoring result so the UI
  // can display yaku / han / fu / payment without re-computing.

  function generateHand() {
    for (var attempt = 0; attempt < 30; attempt++) {
      var s = generateHandRaw();
      var result = ST.scoreHand(s);
      if (result && result.yaku.length > 0) {
        s.scoring = result;
        return s;
      }
    }
    // Last resort — return whatever we got, even if unscorable
    var fallback = generateHandRaw();
    fallback.scoring = ST.scoreHand(fallback);
    return fallback;
  }

  // ----- Test harness ------------------------------------------------------

  function testGenerator(n) {
    n = n || 1000;
    var ok = 0, fail = 0;
    var byCat = {}, byArch = {};
    var errors = [];
    for (var i = 0; i < n; i++) {
      try {
        var s = generateHand();
        ok++;
        var cat = s.waitShape ? s.waitShape.category : '(none)';
        byCat[cat] = (byCat[cat] || 0) + 1;
        var arch = s.archetype || 'unknown';
        byArch[arch] = (byArch[arch] || 0) + 1;
      } catch (e) {
        fail++;
        if (errors.length < 5) errors.push(e.message || String(e));
      }
    }
    var lines = ['n=' + n + ' ok=' + ok + ' fail=' + fail];
    lines.push('-- archetypes:');
    var archKeys = Object.keys(byArch).sort(function (a, b) { return byArch[b] - byArch[a]; });
    for (var ak = 0; ak < archKeys.length; ak++) {
      lines.push('  ' + archKeys[ak] + ': ' + (byArch[archKeys[ak]] / ok * 100).toFixed(1) + '%');
    }
    lines.push('-- wait shapes:');
    var catKeys = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    for (var ck = 0; ck < catKeys.length; ck++) {
      lines.push('  ' + catKeys[ck] + ': ' + (byCat[catKeys[ck]] / ok * 100).toFixed(1) + '%');
    }
    if (errors.length) {
      lines.push('first errors:');
      for (var ei = 0; ei < errors.length; ei++) lines.push('  ' + errors[ei]);
    }
    return lines.join('\n');
  }

  // ----- Exports -----------------------------------------------------------

  ST.ARCHETYPES = ARCHETYPES;
  ST.generateHandV2a = generateHandV2a;
  ST.generateHandV2b = generateHandV2b;
  ST.generateHand = generateHand;
  ST.testGenerator = testGenerator;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));

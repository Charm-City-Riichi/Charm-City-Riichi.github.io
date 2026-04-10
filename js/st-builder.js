/* Score Trainer — Constrained Builders & Archetype Builders
 *
 * Low-level hand construction helpers (trySequence, tryTriplet, etc.)
 * and all archetype-specific builders (buildPinfu, buildTanyao, etc.).
 * Depends on st-core.js and st-waits.js.
 */
(function (ST) {
  'use strict';

  // ---- Imports ------------------------------------------------------------
  var tile = ST.tile;
  var SUITS_NUMBERED = ST.SUITS_NUMBERED;
  var WIND_TO_Z = ST.WIND_TO_Z;
  var shuffleInPlace = ST.shuffleInPlace;
  var pickOne = ST.pickOne;
  var pickWeighted = ST.pickWeighted;
  var BankError = ST.BankError;
  var bankCount = ST.bankCount;
  var bankTake = ST.bankTake;
  var fillRemainingSets = ST.fillRemainingSets;
  var pickWaitShape = ST.pickWaitShape;
  var instantiateWaitShape = ST.instantiateWaitShape;

  // ----- Constrained builders ----------------------------------------------

  function trySequence(bank, suits, minStart, maxStart) {
    if (minStart === undefined) minStart = 1;
    if (maxStart === undefined) maxStart = 7;
    if (minStart > maxStart) return null;
    var ss = shuffleInPlace((suits || SUITS_NUMBERED).filter(function (s) { return s !== 'z'; }));
    for (var si = 0; si < ss.length; si++) {
      var starts = [];
      for (var v = minStart; v <= maxStart; v++) starts.push(v);
      shuffleInPlace(starts);
      for (var vi = 0; vi < starts.length; vi++) {
        var s = starts[vi];
        if (bankCount(bank, ss[si], s) > 0
            && bankCount(bank, ss[si], s + 1) > 0
            && bankCount(bank, ss[si], s + 2) > 0) {
          bankTake(bank, ss[si], s, 1);
          bankTake(bank, ss[si], s + 1, 1);
          bankTake(bank, ss[si], s + 2, 1);
          return { type: 'seq', tiles: [
            tile(ss[si], s, false), tile(ss[si], s + 1, false), tile(ss[si], s + 2, false)
          ]};
        }
      }
    }
    return null;
  }

  function tryTriplet(bank, suits, values) {
    var keys = [];
    for (var k in bank) {
      if (bank[k] < 3) continue;
      var s = k[0], v = parseInt(k.substring(1), 10);
      if (suits && suits.indexOf(s) === -1) continue;
      if (values && values.indexOf(v) === -1) continue;
      keys.push(k);
    }
    if (keys.length === 0) return null;
    var key = pickOne(keys);
    var s2 = key[0], v2 = parseInt(key.substring(1), 10);
    bankTake(bank, s2, v2, 3);
    return { type: 'trip', tiles: [tile(s2, v2, false), tile(s2, v2, false), tile(s2, v2, false)] };
  }

  function tryPair(bank, suits, values, excludeKeys) {
    var keys = [];
    for (var k in bank) {
      if (bank[k] < 2) continue;
      var s = k[0], v = parseInt(k.substring(1), 10);
      if (suits && suits.indexOf(s) === -1) continue;
      if (values && values.indexOf(v) === -1) continue;
      if (excludeKeys && excludeKeys.indexOf(k) !== -1) continue;
      keys.push(k);
    }
    if (keys.length === 0) return null;
    var key = pickOne(keys);
    var s2 = key[0], v2 = parseInt(key.substring(1), 10);
    bankTake(bank, s2, v2, 2);
    return [tile(s2, v2, false), tile(s2, v2, false)];
  }

  function buildSets(bank, count, seqChance, suits, valRange) {
    var sets = [];
    for (var i = 0; i < count; i++) {
      var set = null;
      for (var att = 0; att < 40; att++) {
        var minS = valRange ? Math.max(1, valRange[0]) : 1;
        var maxS = valRange ? Math.min(7, valRange[1] - 2) : 7;
        var vals = null;
        if (valRange) {
          vals = [];
          for (var vv = valRange[0]; vv <= valRange[1]; vv++) vals.push(vv);
        }
        if (Math.random() < seqChance) {
          set = trySequence(bank, suits, minS, maxS);
          if (!set) set = tryTriplet(bank, suits, vals);
        } else {
          set = tryTriplet(bank, suits, vals);
          if (!set) set = trySequence(bank, suits, minS, maxS);
        }
        if (set) break;
      }
      if (!set) throw new BankError('buildSets: slot ' + i);
      sets.push(set);
    }
    return sets;
  }

  function setsToTiles(sets) {
    var out = [];
    for (var i = 0; i < sets.length; i++) {
      for (var j = 0; j < sets[i].tiles.length; j++) out.push(sets[i].tiles[j]);
    }
    return out;
  }

  function setToCall(set) {
    return { type: set.type === 'seq' ? 'chi' : 'pon', tiles: set.tiles };
  }

  function unwinTile(sets, pair) {
    var options = [];
    for (var i = 0; i < sets.length; i++) {
      if (sets[i].type === 'seq') {
        var a = sets[i].tiles[0].value;
        options.push({ src: 'set', idx: i, pos: 0, wait: a <= 6 ? 'ryanmen' : 'penchan' });
        options.push({ src: 'set', idx: i, pos: 2, wait: a >= 2 ? 'ryanmen' : 'penchan' });
        options.push({ src: 'set', idx: i, pos: 1, wait: 'kanchan' });
      } else if (sets[i].type === 'trip') {
        options.push({ src: 'set', idx: i, pos: 0, wait: 'shanpon' });
      }
    }
    if (pair && pair.length === 2) {
      options.push({ src: 'pair', wait: 'tanki' });
    }
    if (options.length === 0) throw new BankError('unwinTile: no options');
    var choice = pickOne(options);
    var winningTile;
    if (choice.src === 'set') {
      winningTile = tile(
        sets[choice.idx].tiles[choice.pos].suit,
        sets[choice.idx].tiles[choice.pos].value, false
      );
      var remaining = [];
      for (var j = 0; j < sets[choice.idx].tiles.length; j++) {
        if (j !== choice.pos) remaining.push(sets[choice.idx].tiles[j]);
      }
      sets[choice.idx] = { type: sets[choice.idx].type, tiles: remaining };
    } else {
      winningTile = tile(pair[0].suit, pair[0].value, false);
      pair.splice(0, 1);
    }
    var closedTiles = setsToTiles(sets);
    for (var pi = 0; pi < pair.length; pi++) closedTiles.push(pair[pi]);
    return { closedTiles: closedTiles, winningTile: winningTile, waitType: choice.wait };
  }

  function finishHand(sets, pair, closed, numCalls, riichiChance) {
    if (closed) {
      var r = unwinTile(sets, pair);
      return {
        closedTiles: r.closedTiles, calls: [],
        winningTile: r.winningTile,
        winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
        riichi: Math.random() < (riichiChance !== undefined ? riichiChance : 1),
      };
    }
    if (numCalls === undefined) numCalls = 1 + Math.floor(Math.random() * 2);
    numCalls = Math.min(numCalls, sets.length);
    var indices = [];
    for (var i = 0; i < sets.length; i++) indices.push(i);
    shuffleInPlace(indices);
    var callMap = {};
    for (var ci = 0; ci < numCalls; ci++) callMap[indices[ci]] = true;
    var calls = [], closedSets = [];
    for (var si = 0; si < sets.length; si++) {
      if (callMap[si]) calls.push(setToCall(sets[si]));
      else closedSets.push(sets[si]);
    }
    var r2 = unwinTile(closedSets, pair);
    return {
      closedTiles: r2.closedTiles, calls: calls,
      winningTile: r2.winningTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: false,
    };
  }

  // ----- Archetype builders ------------------------------------------------

  function buildRiichiPlain(bank) {
    var shape = pickWaitShape();
    var inst = instantiateWaitShape(shape, bank);
    var fill = fillRemainingSets(bank, inst.setsRemaining, inst.needsPair);
    return {
      handShape: 'standard',
      closedTiles: inst.placedTiles.concat(fill), calls: [],
      winningTile: inst.winningTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: true, waitShape: shape,
    };
  }

  function buildPinfu(bank, ctx) {
    var WAIT_SHAPES = ST.WAIT_SHAPES;
    var ryanmenShapes = [];
    for (var i = 0; i < WAIT_SHAPES.length; i++) {
      if (WAIT_SHAPES[i].category === 'ryanmen') ryanmenShapes.push(WAIT_SHAPES[i]);
    }
    var shape = pickWeighted(ryanmenShapes);
    var inst = instantiateWaitShape(shape, bank);
    var seqs = [];
    for (var s = 0; s < inst.setsRemaining; s++) {
      var seq = trySequence(bank, SUITS_NUMBERED);
      if (!seq) throw new BankError('Pinfu: no sequence for slot ' + s);
      seqs.push(seq);
    }
    var yakuhaiZ = [5, 6, 7];
    yakuhaiZ.push(WIND_TO_Z[ctx.roundWind]);
    if (WIND_TO_Z[ctx.seatWind] !== WIND_TO_Z[ctx.roundWind]) {
      yakuhaiZ.push(WIND_TO_Z[ctx.seatWind]);
    }
    var excl = [];
    for (var ez = 0; ez < yakuhaiZ.length; ez++) excl.push('z' + yakuhaiZ[ez]);
    var pair = tryPair(bank, null, null, excl);
    if (!pair) throw new BankError('Pinfu: no non-yakuhai pair');
    return {
      handShape: 'standard',
      closedTiles: inst.placedTiles.concat(setsToTiles(seqs)).concat(pair),
      calls: [], winningTile: inst.winningTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: Math.random() < 0.85, waitShape: shape,
    };
  }

  function buildTanyao(bank, ctx, closed) {
    var sets = buildSets(bank, 4, 0.65, SUITS_NUMBERED, [2, 8]);
    var pair = tryPair(bank, SUITS_NUMBERED, [2, 3, 4, 5, 6, 7, 8], null);
    if (!pair) throw new BankError('Tanyao: no pair');
    var h = finishHand(sets, pair, closed, 0, closed ? 0.85 : 0);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildYakuhai(bank, ctx) {
    var opts = [5, 6, 7];
    var rw = WIND_TO_Z[ctx.roundWind], sw = WIND_TO_Z[ctx.seatWind];
    if (opts.indexOf(rw) === -1) opts.push(rw);
    if (opts.indexOf(sw) === -1) opts.push(sw);
    shuffleInPlace(opts);
    var yakuVal = null;
    for (var yi = 0; yi < opts.length; yi++) {
      if (bankCount(bank, 'z', opts[yi]) >= 3) { yakuVal = opts[yi]; break; }
    }
    if (yakuVal === null) throw new BankError('Yakuhai: none available');
    bankTake(bank, 'z', yakuVal, 3);
    var ponCall = { type: 'pon', tiles: [
      tile('z', yakuVal, false), tile('z', yakuVal, false), tile('z', yakuVal, false)
    ]};
    var sets = buildSets(bank, 3, 0.6, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Yakuhai: no pair');
    var extra = Math.floor(Math.random() * 2);
    var h = finishHand(sets, pair, false, extra);
    h.calls.unshift(ponCall);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildHonitsu(bank, ctx, closed) {
    var suit = pickOne(SUITS_NUMBERED);
    var sets = buildSets(bank, 4, 0.5, [suit, 'z'], null);
    var pair = tryPair(bank, [suit, 'z'], null, null);
    if (!pair) throw new BankError('Honitsu: no pair');
    var h = finishHand(sets, pair, closed, 0, closed ? 0.60 : 0);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildChinitsu(bank, ctx, closed) {
    var suit = pickOne(SUITS_NUMBERED);
    var sets = buildSets(bank, 4, 0.7, [suit], null);
    var pair = tryPair(bank, [suit], null, null);
    if (!pair) throw new BankError('Chinitsu: no pair');
    var h = finishHand(sets, pair, closed, 0, closed ? 0.30 : 0);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildToitoi(bank) {
    var sets = buildSets(bank, 4, 0.0, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Toitoi: no pair');
    var numCalls = 2 + Math.floor(Math.random() * 2);
    var h = finishHand(sets, pair, false, numCalls);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildIipeikou(bank) {
    var suit = pickOne(SUITS_NUMBERED);
    var start = 1 + Math.floor(Math.random() * 7);
    if (bankCount(bank, suit, start) < 2
        || bankCount(bank, suit, start + 1) < 2
        || bankCount(bank, suit, start + 2) < 2) {
      throw new BankError('Iipeikou: not enough tiles');
    }
    bankTake(bank, suit, start, 2);
    bankTake(bank, suit, start + 1, 2);
    bankTake(bank, suit, start + 2, 2);
    var iiSeqs = [
      { type: 'seq', tiles: [tile(suit, start, false), tile(suit, start + 1, false), tile(suit, start + 2, false)] },
      { type: 'seq', tiles: [tile(suit, start, false), tile(suit, start + 1, false), tile(suit, start + 2, false)] },
    ];
    var more = buildSets(bank, 2, 0.6, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Iipeikou: no pair');
    var all = iiSeqs.concat(more);
    var r = unwinTile(all, pair);
    return {
      handShape: 'standard', closedTiles: r.closedTiles, calls: [],
      winningTile: r.winningTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: Math.random() < 0.85, waitShape: null,
    };
  }

  function buildSanshoku(bank) {
    var start = 1 + Math.floor(Math.random() * 7);
    var sanSets = [];
    for (var si = 0; si < SUITS_NUMBERED.length; si++) {
      var s = SUITS_NUMBERED[si];
      if (bankCount(bank, s, start) < 1
          || bankCount(bank, s, start + 1) < 1
          || bankCount(bank, s, start + 2) < 1) {
        throw new BankError('Sanshoku: not enough ' + s + start);
      }
      bankTake(bank, s, start, 1);
      bankTake(bank, s, start + 1, 1);
      bankTake(bank, s, start + 2, 1);
      sanSets.push({ type: 'seq', tiles: [
        tile(s, start, false), tile(s, start + 1, false), tile(s, start + 2, false)
      ]});
    }
    var more = buildSets(bank, 1, 0.6, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Sanshoku: no pair');
    var all = sanSets.concat(more);
    var closed = Math.random() < 0.6;
    var h = finishHand(all, pair, closed, closed ? 0 : 1);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildIttsuu(bank) {
    var suit = pickOne(SUITS_NUMBERED);
    for (var v = 1; v <= 9; v++) {
      if (bankCount(bank, suit, v) < 1) throw new BankError('Ittsuu: not enough ' + suit + v);
      bankTake(bank, suit, v, 1);
    }
    var ittSets = [
      { type: 'seq', tiles: [tile(suit,1,false), tile(suit,2,false), tile(suit,3,false)] },
      { type: 'seq', tiles: [tile(suit,4,false), tile(suit,5,false), tile(suit,6,false)] },
      { type: 'seq', tiles: [tile(suit,7,false), tile(suit,8,false), tile(suit,9,false)] },
    ];
    var more = buildSets(bank, 1, 0.6, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Ittsuu: no pair');
    var all = ittSets.concat(more);
    var closed = Math.random() < 0.6;
    var h = finishHand(all, pair, closed, closed ? 0 : 1);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildChanta(bank, ctx, junchan) {
    var sets = [];
    for (var i = 0; i < 4; i++) {
      var set = null;
      for (var att = 0; att < 40; att++) {
        var roll = Math.random();
        if (roll < 0.5) {
          var seqStart = Math.random() < 0.5 ? 1 : 7;
          set = trySequence(bank, SUITS_NUMBERED, seqStart, seqStart);
        } else if (!junchan && roll < 0.75) {
          set = tryTriplet(bank, ['z'], null);
        } else {
          set = tryTriplet(bank, SUITS_NUMBERED, [1, 9]);
        }
        if (set) break;
      }
      if (!set) throw new BankError((junchan ? 'Junchan' : 'Chanta') + ': set ' + i);
      sets.push(set);
    }
    var pair;
    if (junchan) {
      pair = tryPair(bank, SUITS_NUMBERED, [1, 9], null);
    } else {
      var pk = [];
      for (var k in bank) {
        if (bank[k] < 2) continue;
        var ps = k[0], pv = parseInt(k.substring(1), 10);
        if (ps === 'z' || pv === 1 || pv === 9) pk.push(k);
      }
      if (pk.length === 0) throw new BankError('Chanta: no valid pair');
      var chosen = pickOne(pk);
      var cs = chosen[0], cv = parseInt(chosen.substring(1), 10);
      bankTake(bank, cs, cv, 2);
      pair = [tile(cs, cv, false), tile(cs, cv, false)];
    }
    if (!pair) throw new BankError((junchan ? 'Junchan' : 'Chanta') + ': no pair');
    var closed = Math.random() < 0.5;
    var nc = closed ? 0 : (1 + Math.floor(Math.random() * 2));
    var h = finishHand(sets, pair, closed, nc);
    h.handShape = 'standard'; h.waitShape = null;
    return h;
  }

  function buildChiitoitsu(bank) {
    var pairs = [];
    var usedKeys = [];
    for (var i = 0; i < 7; i++) {
      var keys = [];
      for (var k in bank) {
        if (bank[k] >= 2 && usedKeys.indexOf(k) === -1) keys.push(k);
      }
      if (keys.length === 0) throw new BankError('Chiitoitsu: not enough pairs');
      var key = pickOne(keys);
      usedKeys.push(key);
      var s = key[0], v = parseInt(key.substring(1), 10);
      bankTake(bank, s, v, 2);
      pairs.push({ suit: s, value: v });
    }
    var winIdx = Math.floor(Math.random() * 7);
    var closed = [];
    for (var pi = 0; pi < 7; pi++) {
      if (pi === winIdx) {
        closed.push(tile(pairs[pi].suit, pairs[pi].value, false));
      } else {
        closed.push(tile(pairs[pi].suit, pairs[pi].value, false));
        closed.push(tile(pairs[pi].suit, pairs[pi].value, false));
      }
    }
    return {
      handShape: 'chiitoitsu', closedTiles: closed, calls: [],
      winningTile: tile(pairs[winIdx].suit, pairs[winIdx].value, false),
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: Math.random() < 0.6, waitShape: null,
    };
  }

  function buildKokushi(bank) {
    var kTiles = [
      {s:'m',v:1},{s:'m',v:9},{s:'p',v:1},{s:'p',v:9},
      {s:'s',v:1},{s:'s',v:9},
      {s:'z',v:1},{s:'z',v:2},{s:'z',v:3},{s:'z',v:4},
      {s:'z',v:5},{s:'z',v:6},{s:'z',v:7},
    ];
    for (var i = 0; i < kTiles.length; i++) bankTake(bank, kTiles[i].s, kTiles[i].v, 1);
    var dupIdx = Math.floor(Math.random() * kTiles.length);
    bankTake(bank, kTiles[dupIdx].s, kTiles[dupIdx].v, 1);
    var allTiles = [];
    for (var j = 0; j < kTiles.length; j++) allTiles.push(tile(kTiles[j].s, kTiles[j].v, false));
    allTiles.push(tile(kTiles[dupIdx].s, kTiles[dupIdx].v, false));
    var winIdx = Math.floor(Math.random() * allTiles.length);
    var winTile = allTiles[winIdx];
    allTiles.splice(winIdx, 1);
    return {
      handShape: 'kokushi', closedTiles: allTiles, calls: [],
      winningTile: winTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: Math.random() < 0.5, waitShape: null,
    };
  }

  // ----- Yakuman sub-builders ----------------------------------------------

  function buildSuuankou(bank) {
    var sets = [];
    for (var i = 0; i < 4; i++) {
      var trip = tryTriplet(bank, null, null);
      if (!trip) throw new BankError('Suuankou: not enough triplets');
      sets.push(trip);
    }
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Suuankou: no pair');
    var r = unwinTile(sets, pair);
    return {
      handShape: 'standard', closedTiles: r.closedTiles, calls: [],
      winningTile: r.winningTile,
      winType: r.waitType === 'shanpon' ? 'tsumo' : (Math.random() < 0.5 ? 'tsumo' : 'ron'),
      riichi: false, waitShape: null,
    };
  }

  function buildDaisangen(bank) {
    var dSets = [];
    for (var d = 5; d <= 7; d++) {
      if (bankCount(bank, 'z', d) < 3) throw new BankError('Daisangen: not enough ' + d + 'z');
      bankTake(bank, 'z', d, 3);
      dSets.push({ type: 'trip', tiles: [tile('z',d,false), tile('z',d,false), tile('z',d,false)] });
    }
    var more = buildSets(bank, 1, 0.6, null, null);
    var pair = tryPair(bank, null, null, null);
    if (!pair) throw new BankError('Daisangen: no pair');
    var all = dSets.concat(more);
    var closed = Math.random() < 0.3;
    var h = finishHand(all, pair, closed, closed ? 0 : 2);
    h.handShape = 'standard'; h.waitShape = null;
    if (closed) h.riichi = false;
    return h;
  }

  function buildTsuuiisou(bank) {
    var sets = [];
    for (var i = 0; i < 4; i++) {
      var trip = tryTriplet(bank, ['z'], null);
      if (!trip) throw new BankError('Tsuuiisou: not enough honor triplets');
      sets.push(trip);
    }
    var pair = tryPair(bank, ['z'], null, null);
    if (!pair) throw new BankError('Tsuuiisou: no pair');
    var closed = Math.random() < 0.4;
    var h = finishHand(sets, pair, closed, closed ? 0 : 2);
    h.handShape = 'standard'; h.waitShape = null;
    if (closed) h.riichi = false;
    return h;
  }

  function buildChinroutou(bank) {
    var sets = [];
    for (var i = 0; i < 4; i++) {
      var trip = tryTriplet(bank, SUITS_NUMBERED, [1, 9]);
      if (!trip) throw new BankError('Chinroutou: not enough terminal triplets');
      sets.push(trip);
    }
    var pair = tryPair(bank, SUITS_NUMBERED, [1, 9], null);
    if (!pair) throw new BankError('Chinroutou: no pair');
    var closed = Math.random() < 0.4;
    var h = finishHand(sets, pair, closed, closed ? 0 : 2);
    h.handShape = 'standard'; h.waitShape = null;
    if (closed) h.riichi = false;
    return h;
  }

  function buildRyuuiisou(bank) {
    var GREEN = [{s:'s',v:2},{s:'s',v:3},{s:'s',v:4},{s:'s',v:6},{s:'s',v:8},{s:'z',v:6}];
    var sets = [];
    for (var i = 0; i < 4; i++) {
      var set = null;
      for (var att = 0; att < 40; att++) {
        if (Math.random() < 0.4) {
          set = trySequence(bank, ['s'], 2, 2);
        } else {
          var avail = [];
          for (var g = 0; g < GREEN.length; g++) {
            if (bankCount(bank, GREEN[g].s, GREEN[g].v) >= 3) avail.push(GREEN[g]);
          }
          if (avail.length > 0) {
            var pick = pickOne(avail);
            bankTake(bank, pick.s, pick.v, 3);
            set = { type: 'trip', tiles: [
              tile(pick.s,pick.v,false), tile(pick.s,pick.v,false), tile(pick.s,pick.v,false)
            ]};
          }
        }
        if (set) break;
      }
      if (!set) throw new BankError('Ryuuiisou: set ' + i);
      sets.push(set);
    }
    var avail2 = [];
    for (var g2 = 0; g2 < GREEN.length; g2++) {
      if (bankCount(bank, GREEN[g2].s, GREEN[g2].v) >= 2) avail2.push(GREEN[g2]);
    }
    if (avail2.length === 0) throw new BankError('Ryuuiisou: no pair');
    var pp = pickOne(avail2);
    bankTake(bank, pp.s, pp.v, 2);
    var pair = [tile(pp.s, pp.v, false), tile(pp.s, pp.v, false)];
    var closed = Math.random() < 0.3;
    var h = finishHand(sets, pair, closed, closed ? 0 : 2);
    h.handShape = 'standard'; h.waitShape = null;
    if (closed) h.riichi = false;
    return h;
  }

  function buildChuuren(bank) {
    var suit = pickOne(SUITS_NUMBERED);
    bankTake(bank, suit, 1, 3);
    for (var v = 2; v <= 8; v++) bankTake(bank, suit, v, 1);
    bankTake(bank, suit, 9, 3);
    var extraVals = [];
    for (var ev = 1; ev <= 9; ev++) {
      if (bankCount(bank, suit, ev) > 0) extraVals.push(ev);
    }
    if (extraVals.length === 0) throw new BankError('Chuuren: no extra tile');
    var extra = pickOne(extraVals);
    bankTake(bank, suit, extra, 1);
    var allTiles = [];
    for (var v2 = 1; v2 <= 9; v2++) {
      var cnt = (v2 === 1 || v2 === 9) ? 3 : 1;
      if (v2 === extra) cnt++;
      for (var c = 0; c < cnt; c++) allTiles.push(tile(suit, v2, false));
    }
    var winIdx = Math.floor(Math.random() * allTiles.length);
    var winTile = allTiles[winIdx];
    allTiles.splice(winIdx, 1);
    return {
      handShape: 'standard', closedTiles: allTiles, calls: [],
      winningTile: winTile,
      winType: Math.random() < 0.5 ? 'tsumo' : 'ron',
      riichi: false, waitShape: null,
    };
  }

  function buildYakuman(bank) {
    var types = shuffleInPlace(
      ['suuankou','daisangen','tsuuiisou','chinroutou','ryuuiisou','chuuren']
    );
    for (var ti = 0; ti < types.length; ti++) {
      try {
        switch (types[ti]) {
          case 'suuankou':  return buildSuuankou(bank);
          case 'daisangen': return buildDaisangen(bank);
          case 'tsuuiisou': return buildTsuuiisou(bank);
          case 'chinroutou':return buildChinroutou(bank);
          case 'ryuuiisou': return buildRyuuiisou(bank);
          case 'chuuren':   return buildChuuren(bank);
        }
      } catch (e) { if (!(e instanceof BankError)) throw e; }
    }
    throw new BankError('Yakuman: all sub-types failed');
  }

  // ----- Exports -----------------------------------------------------------

  ST.trySequence = trySequence;
  ST.tryTriplet = tryTriplet;
  ST.tryPair = tryPair;
  ST.buildSets = buildSets;
  ST.setsToTiles = setsToTiles;
  ST.setToCall = setToCall;
  ST.unwinTile = unwinTile;
  ST.finishHand = finishHand;
  ST.buildRiichiPlain = buildRiichiPlain;
  ST.buildPinfu = buildPinfu;
  ST.buildTanyao = buildTanyao;
  ST.buildYakuhai = buildYakuhai;
  ST.buildHonitsu = buildHonitsu;
  ST.buildChinitsu = buildChinitsu;
  ST.buildToitoi = buildToitoi;
  ST.buildIipeikou = buildIipeikou;
  ST.buildSanshoku = buildSanshoku;
  ST.buildIttsuu = buildIttsuu;
  ST.buildChanta = buildChanta;
  ST.buildChiitoitsu = buildChiitoitsu;
  ST.buildKokushi = buildKokushi;
  ST.buildYakuman = buildYakuman;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));

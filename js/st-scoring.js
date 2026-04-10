/* Score Trainer — Yaku Checker & Scoring (Piece 3)
 *
 * Given a complete hand situation, determines all valid yaku, computes fu
 * and han, and calculates the final score (base points and payments).
 *
 * Depends on st-core.js.
 * Entry point: scoreHand(situation)
 */
(function (ST) {
  'use strict';

  var SUITS_NUMBERED = ST.SUITS_NUMBERED;
  var WIND_TO_Z = ST.WIND_TO_Z;
  var compareTiles = ST.compareTiles;

  // ----- Tile classification helpers ---------------------------------------

  var ALL_TILE_KEYS = (function () {
    var keys = [];
    for (var si = 0; si < SUITS_NUMBERED.length; si++) {
      for (var v = 1; v <= 9; v++) keys.push(SUITS_NUMBERED[si] + v);
    }
    for (var h = 1; h <= 7; h++) keys.push('z' + h);
    return keys;
  })();

  function isTerminalOrHonor(suit, value) {
    return suit === 'z' || value === 1 || value === 9;
  }

  function isTerminal(suit, value) {
    return suit !== 'z' && (value === 1 || value === 9);
  }

  function isHandClosed(calls) {
    for (var i = 0; i < calls.length; i++) {
      if (calls[i].type !== 'ankan') return false;
    }
    return true;
  }

  function getAllHandTiles(situation) {
    var all = situation.closedTiles.concat([situation.winningTile]);
    for (var i = 0; i < situation.calls.length; i++) {
      all = all.concat(situation.calls[i].tiles);
    }
    return all;
  }

  // ----- Dora helpers ------------------------------------------------------

  function doraValue(indicator) {
    if (indicator.suit === 'z') {
      if (indicator.value <= 4) return { suit: 'z', value: (indicator.value % 4) + 1 };
      return { suit: 'z', value: indicator.value === 7 ? 5 : indicator.value + 1 };
    }
    return { suit: indicator.suit, value: (indicator.value % 9) + 1 };
  }

  function countDora(allTiles, indicators) {
    var count = 0;
    for (var i = 0; i < indicators.length; i++) {
      var d = doraValue(indicators[i]);
      for (var j = 0; j < allTiles.length; j++) {
        if (allTiles[j].suit === d.suit && allTiles[j].value === d.value) count++;
      }
    }
    return count;
  }

  function countRedFives(allTiles) {
    var count = 0;
    for (var i = 0; i < allTiles.length; i++) {
      if (allTiles[i].red) count++;
    }
    return count;
  }

  // ----- Hand decomposition ------------------------------------------------

  function tileCounts(tiles) {
    var c = {};
    for (var i = 0; i < tiles.length; i++) {
      var k = tiles[i].suit + tiles[i].value;
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }

  function findGroups(counts, numGroups, startIdx) {
    if (numGroups === 0) {
      for (var i = startIdx; i < ALL_TILE_KEYS.length; i++) {
        if ((counts[ALL_TILE_KEYS[i]] || 0) > 0) return [];
      }
      return [[]];
    }
    while (startIdx < ALL_TILE_KEYS.length && (counts[ALL_TILE_KEYS[startIdx]] || 0) === 0) startIdx++;
    if (startIdx >= ALL_TILE_KEYS.length) return [];

    var key = ALL_TILE_KEYS[startIdx];
    var suit = key[0], value = parseInt(key.substring(1), 10);
    var results = [];

    if (counts[key] >= 3) {
      counts[key] -= 3;
      var sub = findGroups(counts, numGroups - 1, startIdx);
      for (var a = 0; a < sub.length; a++) {
        results.push([{ type: 'trip', suit: suit, value: value }].concat(sub[a]));
      }
      counts[key] += 3;
    }

    if (suit !== 'z' && value <= 7) {
      var k2 = suit + (value + 1), k3 = suit + (value + 2);
      if (counts[key] >= 1 && (counts[k2] || 0) >= 1 && (counts[k3] || 0) >= 1) {
        counts[key]--; counts[k2]--; counts[k3]--;
        var sub2 = findGroups(counts, numGroups - 1, startIdx);
        for (var b = 0; b < sub2.length; b++) {
          results.push([{ type: 'seq', suit: suit, value: value }].concat(sub2[b]));
        }
        counts[key]++; counts[k2]++; counts[k3]++;
      }
    }

    return results;
  }

  function decompSig(d) {
    var parts = [];
    for (var i = 0; i < d.groups.length; i++) {
      parts.push(d.groups[i].type[0] + d.groups[i].suit + d.groups[i].value);
    }
    parts.sort();
    parts.push('P' + d.pair.suit + d.pair.value);
    return parts.join(',');
  }

  function decomposeStandard(tiles, numGroups) {
    var counts = tileCounts(tiles);
    var results = [], seen = {};

    for (var ki = 0; ki < ALL_TILE_KEYS.length; ki++) {
      var key = ALL_TILE_KEYS[ki];
      if ((counts[key] || 0) < 2) continue;
      counts[key] -= 2;
      var suit = key[0], value = parseInt(key.substring(1), 10);
      var groups = findGroups(counts, numGroups, 0);
      for (var gi = 0; gi < groups.length; gi++) {
        var d = { groups: groups[gi], pair: { suit: suit, value: value } };
        var sig = decompSig(d);
        if (!seen[sig]) {
          seen[sig] = true;
          results.push(d);
        }
      }
      counts[key] += 2;
    }
    return results;
  }

  // ----- Wait type determination -------------------------------------------

  function determineWaits(decomp, winTile) {
    var ws = winTile.suit, wv = winTile.value;
    var results = [];

    if (decomp.pair.suit === ws && decomp.pair.value === wv) {
      results.push({ waitType: 'tanki', groupIdx: -1 });
    }

    for (var i = 0; i < decomp.groups.length; i++) {
      var g = decomp.groups[i];
      if (g.type === 'trip' && g.suit === ws && g.value === wv) {
        results.push({ waitType: 'shanpon', groupIdx: i });
      }
      if (g.type === 'seq' && g.suit === ws) {
        if (wv === g.value) {
          results.push({ waitType: g.value >= 7 ? 'penchan' : 'ryanmen', groupIdx: i });
        } else if (wv === g.value + 1) {
          results.push({ waitType: 'kanchan', groupIdx: i });
        } else if (wv === g.value + 2) {
          results.push({ waitType: g.value <= 1 ? 'penchan' : 'ryanmen', groupIdx: i });
        }
      }
    }
    return results;
  }

  // ----- Group merging -----------------------------------------------------

  function buildAllGroups(decomp, calls) {
    var all = [];
    for (var i = 0; i < decomp.groups.length; i++) {
      all.push({
        type: decomp.groups[i].type, suit: decomp.groups[i].suit,
        value: decomp.groups[i].value, fromCall: false, callType: null
      });
    }
    for (var ci = 0; ci < calls.length; ci++) {
      var ct = calls[ci].tiles.slice().sort(compareTiles);
      if (calls[ci].type === 'chi') {
        all.push({ type: 'seq', suit: ct[0].suit, value: ct[0].value,
                    fromCall: true, callType: 'chi' });
      } else {
        all.push({ type: 'trip', suit: ct[0].suit, value: ct[0].value,
                    fromCall: true, callType: calls[ci].type });
      }
    }
    return all;
  }

  // ----- Yaku sub-checks ---------------------------------------------------

  function countConcealedTrips(allGroups, ronOpenIdx) {
    var count = 0;
    for (var i = 0; i < allGroups.length; i++) {
      if (allGroups[i].type !== 'trip') continue;
      if (allGroups[i].fromCall) {
        if (allGroups[i].callType === 'ankan') count++;
      } else {
        if (i !== ronOpenIdx) count++;
      }
    }
    return count;
  }

  function checkSanshoku(allGroups) {
    var byStart = {};
    for (var i = 0; i < allGroups.length; i++) {
      if (allGroups[i].type !== 'seq') continue;
      var k = String(allGroups[i].value);
      if (!byStart[k]) byStart[k] = {};
      byStart[k][allGroups[i].suit] = true;
    }
    for (var k2 in byStart) {
      if (byStart[k2].m && byStart[k2].p && byStart[k2].s) return true;
    }
    return false;
  }

  function checkIttsuu(allGroups) {
    var bySuit = {};
    for (var i = 0; i < allGroups.length; i++) {
      if (allGroups[i].type !== 'seq') continue;
      var s = allGroups[i].suit;
      if (!bySuit[s]) bySuit[s] = {};
      bySuit[s][allGroups[i].value] = true;
    }
    for (var s2 in bySuit) {
      if (bySuit[s2][1] && bySuit[s2][4] && bySuit[s2][7]) return true;
    }
    return false;
  }

  function checkChantaJunchan(allGroups, pair) {
    var hasSeq = false, hasHonor = false;
    for (var i = 0; i < allGroups.length; i++) {
      var g = allGroups[i];
      if (g.type === 'seq') {
        hasSeq = true;
        if (g.value !== 1 && g.value !== 7) return null;
      } else {
        if (!isTerminalOrHonor(g.suit, g.value)) return null;
        if (g.suit === 'z') hasHonor = true;
      }
    }
    if (!isTerminalOrHonor(pair.suit, pair.value)) return null;
    if (pair.suit === 'z') hasHonor = true;
    if (!hasSeq) return null;
    return hasHonor ? 'chanta' : 'junchan';
  }

  function checkFlush(allTiles) {
    var suits = {}, hasHonor = false;
    for (var i = 0; i < allTiles.length; i++) {
      if (allTiles[i].suit === 'z') hasHonor = true;
      else suits[allTiles[i].suit] = true;
    }
    if (Object.keys(suits).length !== 1) return null;
    return hasHonor ? 'honitsu' : 'chinitsu';
  }

  function checkChuuren(allTiles) {
    if (allTiles.length !== 14) return false;
    var suit = null;
    for (var i = 0; i < allTiles.length; i++) {
      if (allTiles[i].suit === 'z') return false;
      if (!suit) suit = allTiles[i].suit;
      else if (allTiles[i].suit !== suit) return false;
    }
    var vc = {};
    for (var j = 0; j < allTiles.length; j++) {
      vc[allTiles[j].value] = (vc[allTiles[j].value] || 0) + 1;
    }
    if ((vc[1] || 0) < 3 || (vc[9] || 0) < 3) return false;
    for (var v = 2; v <= 8; v++) {
      if ((vc[v] || 0) < 1) return false;
    }
    return true;
  }

  function isKokushiHand(allTiles) {
    if (allTiles.length !== 14) return false;
    var required = { m1:1, m9:1, p1:1, p9:1, s1:1, s9:1,
                     z1:1, z2:1, z3:1, z4:1, z5:1, z6:1, z7:1 };
    var counts = tileCounts(allTiles);
    var hasDup = false;
    for (var k in required) {
      var c = counts[k] || 0;
      if (c === 0) return false;
      if (c === 2) { if (hasDup) return false; hasDup = true; }
      else if (c !== 1) return false;
    }
    for (var k2 in counts) {
      if (!(k2 in required)) return false;
    }
    return hasDup;
  }

  function findChiitoitsuPairs(allTiles) {
    if (allTiles.length !== 14) return null;
    var counts = tileCounts(allTiles);
    var pairs = [];
    for (var k in counts) {
      if (counts[k] !== 2) return null;
      pairs.push(k);
    }
    return pairs.length === 7 ? pairs : null;
  }

  // ----- Standard yaku check -----------------------------------------------

  function checkYakuStandard(situation, decomp, waitInfo, allGroups, allTiles, ronOpenIdx) {
    var yaku = [];
    var isClosed = isHandClosed(situation.calls);
    var noCalls = situation.calls.length === 0;
    var hasPinfu = false;

    // -- Yakuman --

    var concealedTrips = countConcealedTrips(allGroups, ronOpenIdx);
    if (concealedTrips === 4) {
      yaku.push({ name: 'suuankou', han: 0, yakuman: true });
    }

    var dragonTrips = 0, windTrips = 0;
    for (var gi = 0; gi < allGroups.length; gi++) {
      if (allGroups[gi].type === 'trip' && allGroups[gi].suit === 'z') {
        if (allGroups[gi].value >= 5) dragonTrips++;
        if (allGroups[gi].value <= 4) windTrips++;
      }
    }
    if (dragonTrips === 3) yaku.push({ name: 'daisangen', han: 0, yakuman: true });

    if (windTrips === 4) {
      yaku.push({ name: 'daisuushii', han: 0, yakuman: true });
    } else if (windTrips === 3 && decomp.pair.suit === 'z' && decomp.pair.value <= 4) {
      yaku.push({ name: 'shousuushii', han: 0, yakuman: true });
    }

    var allHonors = true, allTerminals = true;
    for (var ti = 0; ti < allTiles.length; ti++) {
      if (allTiles[ti].suit !== 'z') allHonors = false;
      if (!isTerminal(allTiles[ti].suit, allTiles[ti].value)) allTerminals = false;
    }
    if (allHonors) yaku.push({ name: 'tsuuiisou', han: 0, yakuman: true });
    if (allTerminals) yaku.push({ name: 'chinroutou', han: 0, yakuman: true });

    var GREEN_SET = { s2:1, s3:1, s4:1, s6:1, s8:1, z6:1 };
    var allGreen = true;
    for (var gri = 0; gri < allTiles.length; gri++) {
      if (!GREEN_SET[allTiles[gri].suit + allTiles[gri].value]) { allGreen = false; break; }
    }
    if (allGreen) yaku.push({ name: 'ryuuiisou', han: 0, yakuman: true });

    if (noCalls && checkChuuren(allTiles)) {
      yaku.push({ name: 'chuuren', han: 0, yakuman: true });
    }

    if (yaku.length > 0) return { yaku: yaku, hasPinfu: false };

    // -- Regular yaku --

    if (situation.riichi) yaku.push({ name: 'riichi', han: 1 });
    if (situation.riichi && situation.ippatsu) yaku.push({ name: 'ippatsu', han: 1 });
    if (isClosed && situation.winType === 'tsumo') yaku.push({ name: 'menzen-tsumo', han: 1 });

    var allSimples = true;
    for (var si = 0; si < allTiles.length; si++) {
      if (isTerminalOrHonor(allTiles[si].suit, allTiles[si].value)) { allSimples = false; break; }
    }
    if (allSimples) yaku.push({ name: 'tanyao', han: 1 });

    // Pinfu
    if (noCalls && isClosed) {
      var allSeq = true;
      for (var pi = 0; pi < decomp.groups.length; pi++) {
        if (decomp.groups[pi].type !== 'seq') { allSeq = false; break; }
      }
      if (allSeq) {
        var ps = decomp.pair.suit, pv = decomp.pair.value;
        var yakPair = false;
        if (ps === 'z') {
          if (pv >= 5) yakPair = true;
          if (pv === WIND_TO_Z[situation.roundWind]) yakPair = true;
          if (pv === WIND_TO_Z[situation.seatWind]) yakPair = true;
        }
        if (!yakPair && waitInfo.waitType === 'ryanmen') {
          yaku.push({ name: 'pinfu', han: 1 });
          hasPinfu = true;
        }
      }
    }

    // Iipeikou / Ryanpeikou
    if (isClosed) {
      var seqSigs = {};
      for (var ipi = 0; ipi < decomp.groups.length; ipi++) {
        if (decomp.groups[ipi].type === 'seq') {
          var isig = decomp.groups[ipi].suit + decomp.groups[ipi].value;
          seqSigs[isig] = (seqSigs[isig] || 0) + 1;
        }
      }
      var totalDupPairs = 0;
      for (var isk in seqSigs) {
        totalDupPairs += Math.floor(seqSigs[isk] / 2);
      }
      if (totalDupPairs >= 2) yaku.push({ name: 'ryanpeikou', han: 3 });
      else if (totalDupPairs === 1) yaku.push({ name: 'iipeikou', han: 1 });
    }

    // Yakuhai
    var roundZ = WIND_TO_Z[situation.roundWind];
    var seatZ = WIND_TO_Z[situation.seatWind];
    for (var yi = 0; yi < allGroups.length; yi++) {
      if (allGroups[yi].type !== 'trip' || allGroups[yi].suit !== 'z') continue;
      var zv = allGroups[yi].value;
      if (zv === 5) yaku.push({ name: 'haku', han: 1 });
      if (zv === 6) yaku.push({ name: 'hatsu', han: 1 });
      if (zv === 7) yaku.push({ name: 'chun', han: 1 });
      if (zv === roundZ) yaku.push({ name: 'round-wind', han: 1 });
      if (zv === seatZ) yaku.push({ name: 'seat-wind', han: 1 });
    }

    // Toitoi
    var allTrips = true;
    for (var tti = 0; tti < allGroups.length; tti++) {
      if (allGroups[tti].type !== 'trip') { allTrips = false; break; }
    }
    if (allTrips) yaku.push({ name: 'toitoi', han: 2 });

    // Sanankou
    if (concealedTrips === 3) yaku.push({ name: 'sanankou', han: 2 });

    // Sanshoku
    if (checkSanshoku(allGroups)) yaku.push({ name: 'sanshoku', han: isClosed ? 2 : 1 });

    // Ittsuu
    if (checkIttsuu(allGroups)) yaku.push({ name: 'ittsuu', han: isClosed ? 2 : 1 });

    // Chanta / Junchan
    var cj = checkChantaJunchan(allGroups, decomp.pair);
    if (cj === 'junchan') yaku.push({ name: 'junchan', han: isClosed ? 3 : 2 });
    else if (cj === 'chanta') yaku.push({ name: 'chanta', han: isClosed ? 2 : 1 });

    // Honroutou
    var allToH = true;
    for (var hri = 0; hri < allTiles.length; hri++) {
      if (!isTerminalOrHonor(allTiles[hri].suit, allTiles[hri].value)) { allToH = false; break; }
    }
    if (allToH) yaku.push({ name: 'honroutou', han: 2 });

    // Shousangen
    if (dragonTrips === 2 && decomp.pair.suit === 'z' && decomp.pair.value >= 5) {
      yaku.push({ name: 'shousangen', han: 2 });
    }

    // Honitsu / Chinitsu
    var flush = checkFlush(allTiles);
    if (flush === 'chinitsu') yaku.push({ name: 'chinitsu', han: isClosed ? 6 : 5 });
    else if (flush === 'honitsu') yaku.push({ name: 'honitsu', han: isClosed ? 3 : 2 });

    return { yaku: yaku, hasPinfu: hasPinfu };
  }

  // ----- Chiitoitsu yaku check ---------------------------------------------

  function checkYakuChiitoitsu(situation, allTiles) {
    var allHonors = true;
    for (var hi = 0; hi < allTiles.length; hi++) {
      if (allTiles[hi].suit !== 'z') { allHonors = false; break; }
    }
    if (allHonors) return { yaku: [{ name: 'tsuuiisou', han: 0, yakuman: true }], hasPinfu: false };

    var yaku = [{ name: 'chiitoitsu', han: 2 }];
    if (situation.riichi) yaku.push({ name: 'riichi', han: 1 });
    if (situation.riichi && situation.ippatsu) yaku.push({ name: 'ippatsu', han: 1 });
    if (situation.winType === 'tsumo') yaku.push({ name: 'menzen-tsumo', han: 1 });

    var allSimples = true;
    for (var si = 0; si < allTiles.length; si++) {
      if (isTerminalOrHonor(allTiles[si].suit, allTiles[si].value)) { allSimples = false; break; }
    }
    if (allSimples) yaku.push({ name: 'tanyao', han: 1 });

    var allToH = true;
    for (var hri = 0; hri < allTiles.length; hri++) {
      if (!isTerminalOrHonor(allTiles[hri].suit, allTiles[hri].value)) { allToH = false; break; }
    }
    if (allToH) yaku.push({ name: 'honroutou', han: 2 });

    var flush = checkFlush(allTiles);
    if (flush === 'chinitsu') yaku.push({ name: 'chinitsu', han: 6 });
    else if (flush === 'honitsu') yaku.push({ name: 'honitsu', han: 3 });

    return { yaku: yaku, hasPinfu: false };
  }

  // ----- Fu computation ----------------------------------------------------

  function computeFu(situation, decomp, waitType, allGroups, hasPinfu, ronOpenIdx) {
    if (hasPinfu && situation.winType === 'tsumo') return 20;

    var isClosed = isHandClosed(situation.calls);
    var fu = 20;

    if (isClosed && situation.winType === 'ron') fu += 10;
    if (situation.winType === 'tsumo') fu += 2;
    if (waitType === 'kanchan' || waitType === 'penchan' || waitType === 'tanki') fu += 2;

    // Pair fu
    var ps = decomp.pair.suit, pv = decomp.pair.value;
    if (ps === 'z') {
      if (pv >= 5) fu += 2;
      if (pv === WIND_TO_Z[situation.roundWind]) fu += 2;
      if (pv === WIND_TO_Z[situation.seatWind]) fu += 2;
    }

    // Group fu
    for (var i = 0; i < allGroups.length; i++) {
      var g = allGroups[i];
      if (g.type !== 'trip') continue;

      var toH = isTerminalOrHonor(g.suit, g.value);
      var base = toH ? 4 : 2;

      var concealed;
      if (g.fromCall) {
        concealed = g.callType === 'ankan';
      } else {
        concealed = (i !== ronOpenIdx);
      }
      if (concealed) base *= 2;

      var isKan = g.fromCall && (g.callType === 'daiminkan' || g.callType === 'shouminkan' || g.callType === 'ankan');
      if (isKan) base *= 4;

      fu += base;
    }

    fu = Math.ceil(fu / 10) * 10;
    if (!isClosed && fu < 30) fu = 30;
    return fu;
  }

  // ----- Score computation -------------------------------------------------

  function computeBasePoints(han, fu) {
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    if (han >= 5) return 2000;
    return Math.min(fu * Math.pow(2, han + 2), 2000);
  }

  function computePayments(basePoints, isDealer, winType) {
    if (isDealer) {
      if (winType === 'tsumo') {
        var each = Math.ceil(basePoints * 2 / 100) * 100;
        return { total: each * 3, all: each };
      }
      var ronTotal = Math.ceil(basePoints * 6 / 100) * 100;
      return { total: ronTotal };
    }
    if (winType === 'tsumo') {
      var fromDealer = Math.ceil(basePoints * 2 / 100) * 100;
      var fromNonDealer = Math.ceil(basePoints * 1 / 100) * 100;
      return { total: fromDealer + fromNonDealer * 2, dealer: fromDealer, nonDealer: fromNonDealer };
    }
    var ronTotal2 = Math.ceil(basePoints * 4 / 100) * 100;
    return { total: ronTotal2 };
  }

  function getLevel(han, fu, isYakuman) {
    if (isYakuman) return 'yakuman';
    if (han >= 13) return 'kazoe-yakuman';
    if (han >= 11) return 'sanbaiman';
    if (han >= 8) return 'baiman';
    if (han >= 6) return 'haneman';
    if (han >= 5) return 'mangan';
    if (fu * Math.pow(2, han + 2) >= 2000) return 'mangan';
    return null;
  }

  // ----- Main scoring entry point ------------------------------------------

  function scoreHand(situation) {
    var allTiles = getAllHandTiles(situation);
    var isClosed = isHandClosed(situation.calls);
    var isDealer = situation.seatWind === 'E';
    var candidates = [];

    // --- Kokushi ---
    if (isClosed && situation.calls.length === 0 && isKokushiHand(allTiles)) {
      var kokScore = computePayments(8000, isDealer, situation.winType);
      candidates.push({
        yaku: [{ name: 'kokushi', han: 0, yakuman: true }],
        fu: 0, han: 0, yakuman: true, score: kokScore,
        waitType: 'kokushi'
      });
    }

    // --- Chiitoitsu ---
    if (isClosed && situation.calls.length === 0) {
      var pairs = findChiitoitsuPairs(allTiles);
      if (pairs) {
        var cResult = checkYakuChiitoitsu(situation, allTiles);
        var cIsYM = cResult.yaku.length > 0 && cResult.yaku[0].yakuman;
        if (cIsYM) {
          var cYMScore = computePayments(8000, isDealer, situation.winType);
          candidates.push({ yaku: cResult.yaku, fu: 0, han: 0, yakuman: true, score: cYMScore, waitType: 'tanki' });
        } else {
          var cHan = 0;
          for (var cy = 0; cy < cResult.yaku.length; cy++) cHan += cResult.yaku[cy].han;
          var cDora = countDora(allTiles, situation.doraIndicators);
          var cUra = situation.riichi ? countDora(allTiles, situation.uraIndicators) : 0;
          var cRed = countRedFives(allTiles);
          var cTotalHan = cHan + cDora + cUra + cRed;
          var cDoraY = [];
          if (cDora > 0) cDoraY.push({ name: 'dora', han: cDora });
          if (cUra > 0) cDoraY.push({ name: 'ura-dora', han: cUra });
          if (cRed > 0) cDoraY.push({ name: 'aka-dora', han: cRed });
          var cBase = computeBasePoints(cTotalHan, 25);
          var cScore = computePayments(cBase, isDealer, situation.winType);
          candidates.push({
            yaku: cResult.yaku.concat(cDoraY),
            fu: 25, han: cTotalHan, yakuman: false, score: cScore,
            waitType: 'tanki'
          });
        }
      }
    }

    // --- Standard decompositions ---
    var closedTiles = situation.closedTiles.concat([situation.winningTile]);
    var numClosedGroups = 4 - situation.calls.length;
    var decomps = decomposeStandard(closedTiles, numClosedGroups);

    for (var di = 0; di < decomps.length; di++) {
      var decomp = decomps[di];
      var allGroups = buildAllGroups(decomp, situation.calls);
      var waits = determineWaits(decomp, situation.winningTile);

      for (var wi = 0; wi < waits.length; wi++) {
        var w = waits[wi];
        var ronOpenIdx = -1;
        if (w.waitType === 'shanpon' && situation.winType === 'ron' && w.groupIdx >= 0) {
          ronOpenIdx = w.groupIdx;
        }

        var result = checkYakuStandard(situation, decomp, w, allGroups, allTiles, ronOpenIdx);
        if (result.yaku.length === 0) continue;

        var isYM = result.yaku[0].yakuman;
        if (isYM) {
          var ymBase = 8000 * result.yaku.length;
          var ymScore = computePayments(ymBase, isDealer, situation.winType);
          candidates.push({ yaku: result.yaku, fu: 0, han: 0, yakuman: true, score: ymScore, waitType: w.waitType });
        } else {
          var yakuHan = 0;
          for (var yhi = 0; yhi < result.yaku.length; yhi++) yakuHan += result.yaku[yhi].han;
          var sDora = countDora(allTiles, situation.doraIndicators);
          var sUra = situation.riichi ? countDora(allTiles, situation.uraIndicators) : 0;
          var sRed = countRedFives(allTiles);
          var sTotalHan = yakuHan + sDora + sUra + sRed;
          var sDoraY = [];
          if (sDora > 0) sDoraY.push({ name: 'dora', han: sDora });
          if (sUra > 0) sDoraY.push({ name: 'ura-dora', han: sUra });
          if (sRed > 0) sDoraY.push({ name: 'aka-dora', han: sRed });
          var sFu = computeFu(situation, decomp, w.waitType, allGroups, result.hasPinfu, ronOpenIdx);
          var sBase = computeBasePoints(sTotalHan, sFu);
          var sScore = computePayments(sBase, isDealer, situation.winType);
          candidates.push({
            yaku: result.yaku.concat(sDoraY),
            fu: sFu, han: sTotalHan, yakuman: false, score: sScore,
            waitType: w.waitType
          });
        }
      }
    }

    // Pick best candidate by total score
    var best = null;
    for (var bi = 0; bi < candidates.length; bi++) {
      var c = candidates[bi];
      if (!best || c.score.total > best.score.total) best = c;
    }
    if (!best) return null;

    best.honba = situation.honba;
    best.honbaBonus = situation.honba * 300;
    best.totalWithHonba = best.score.total + best.honbaBonus;
    best.isDealer = isDealer;
    best.level = getLevel(best.han, best.fu, best.yakuman);
    return best;
  }

  // ----- Test harness ------------------------------------------------------

  function testScorer(n) {
    n = n || 500;
    var ok = 0, noScore = 0, errors = [];
    var yakuCounts = {}, levelCounts = {};
    for (var i = 0; i < n; i++) {
      try {
        var s = ST.generateHand();
        var result = scoreHand(s);
        if (!result) { noScore++; continue; }
        ok++;
        for (var yi = 0; yi < result.yaku.length; yi++) {
          var name = result.yaku[yi].name;
          yakuCounts[name] = (yakuCounts[name] || 0) + 1;
        }
        var lv = result.level || (result.han + '/' + result.fu);
        levelCounts[lv] = (levelCounts[lv] || 0) + 1;
      } catch (e) {
        if (errors.length < 5) errors.push(e.message || String(e));
      }
    }
    var lines = ['n=' + n + '  scored=' + ok + '  noScore=' + noScore + '  errors=' + errors.length];
    lines.push('-- yaku frequency:');
    var keys = Object.keys(yakuCounts).sort(function (a, b) { return yakuCounts[b] - yakuCounts[a]; });
    for (var ki = 0; ki < keys.length; ki++) {
      lines.push('  ' + keys[ki] + ': ' + (yakuCounts[keys[ki]] / ok * 100).toFixed(1) + '%');
    }
    lines.push('-- scoring levels:');
    var lvKeys = Object.keys(levelCounts).sort(function (a, b) { return levelCounts[b] - levelCounts[a]; });
    for (var li = 0; li < lvKeys.length; li++) {
      lines.push('  ' + lvKeys[li] + ': ' + (levelCounts[lvKeys[li]] / ok * 100).toFixed(1) + '%');
    }
    if (errors.length) {
      lines.push('first errors:');
      for (var ei = 0; ei < errors.length; ei++) lines.push('  ' + errors[ei]);
    }
    return lines.join('\n');
  }

  // ----- Exports -----------------------------------------------------------

  ST.scoreHand = scoreHand;
  ST.doraValue = doraValue;
  ST.decomposeStandard = decomposeStandard;
  ST.testScorer = testScorer;

})(window.ScoreTrainer || (window.ScoreTrainer = {}));

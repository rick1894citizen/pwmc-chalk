/**
 * statsCalculator.js
 * Aggregates player statistics across matches using the SMD official method:
 * - Incomplete/pending fixtures and 0-0 unplayed games are ignored
 * - 3-Dart Season Averages are leg-weighted:
 *     Season Avg = (Sum of [Match Avg * Total Match Legs]) / Total Match Legs
 * - Clean stat parsing for Tons (100+), 180s, Least Darts (LD), and Highest Finish (HF)
 * - Win Rates formatted to 1 decimal place
 */

export function isSamePlayer(a, b) {
  if (!a || !b) return false;
  const sa = String(a).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const sb = String(b).toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (sa === sb) return true;
  const aliases = [
    ["stebell", "stevenbell"],
    ["stevebell", "stevenbell"],
    ["rickfox", "richardfox"],
    ["danielkendrick", "dannykendrick"],
    ["bazoconnor", "barryoconnor"]
  ];
  return aliases.some(pair => (sa === pair[0] && sb === pair[1]) || (sa === pair[1] && sb === pair[0]));
}

export function canonicalPlayerName(name) {
  if (!name) return "";
  const s = String(name).trim();
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean === "stebell" || clean === "stevebell" || clean === "stevenbell") return "Steven Bell";
  if (clean === "rickfox" || clean === "richardfox") return "Rick Fox";
  if (clean === "danielkendrick" || clean === "dannykendrick") return "Danny Kendrick";
  if (clean === "bazoconnor" || clean === "barryoconnor") return "Baz O'Connor";
  return s;
}

export function calculatePlayerStats(matchesData = []) {
  const statsMap = {};

  (matchesData || []).forEach((match) => {
    // 1. Ignore incomplete / pending fixtures
    if (!match || match.isCompleted === false || match.completed === false || match.pending === true) {
      return;
    }

    match.games?.forEach((game) => {
      const homeLegs = Number(game.homeScore || 0);
      const awayLegs = Number(game.awayScore || 0);

      // Skip unplayed 0-0 games
      if (homeLegs === 0 && awayLegs === 0 && !game.homeWinner && !game.awayWinner) {
        return;
      }

      // Helper to process a player leg appearance
      const processPlayer = (rawPlayerName, oppTeam, oppPlayer, won, legsFor, legsAgainst, stats) => {
        if (!rawPlayerName || rawPlayerName === "-") return;
        const playerName = canonicalPlayerName(rawPlayerName);

        if (!statsMap[playerName]) {
          statsMap[playerName] = {
            player: playerName,
            played: 0,
            won: 0,
            lost: 0,
            legsFor: 0,
            legsAgainst: 0,
            tons: 0,
            max180s: 0,
            leastDarts: null,
            highestFinish: 0,
            weightedAvgSum: 0,
            totalLegsPlayed: 0,
            f9Sum: 0,
            f9Count: 0,
            matches: []
          };
        }

        const p = statsMap[playerName];
        p.played += 1;
        if (won) p.won += 1;
        else p.lost += 1;

        const numLegsFor = Number(legsFor || 0);
        const numLegsAgainst = Number(legsAgainst || 0);
        p.legsFor += numLegsFor;
        p.legsAgainst += numLegsAgainst;

        // Clean numeric stats aggregation
        if (stats?.tons && stats.tons !== "-") {
          const t = Number(stats.tons);
          if (!Number.isNaN(t) && t > 0) p.tons += t;
        }

        if (stats?.max && stats.max !== "-") {
          const m = Number(stats.max);
          if (!Number.isNaN(m) && m > 0) p.max180s += m;
        }

        // Least Darts (LD): minimum numeric value greater than 0 across winning legs
        if (won && stats?.ld && stats.ld !== "-") {
          const ldVal = Number(stats.ld);
          if (!Number.isNaN(ldVal) && ldVal > 0) {
            p.leastDarts = p.leastDarts ? Math.min(p.leastDarts, ldVal) : ldVal;
          }
        }

        // Highest Finish (HF): maximum numeric checkout value across all legs
        if (stats?.hf && stats.hf !== "-") {
          const hfVal = Number(stats.hf);
          if (!Number.isNaN(hfVal) && hfVal > 0) {
            p.highestFinish = Math.max(p.highestFinish, hfVal);
          }
        }

        // Leg-Weighted Season Average
        const matchLegs = numLegsFor + numLegsAgainst;
        if (stats?.avg && stats.avg !== "-") {
          const avgVal = Number(stats.avg);
          if (!Number.isNaN(avgVal) && avgVal > 0 && matchLegs > 0) {
            p.weightedAvgSum += avgVal * matchLegs;
            p.totalLegsPlayed += matchLegs;
          }
        }

        if (stats?.f9 && stats.f9 !== "-") {
          const f9Val = Number(stats.f9);
          if (!Number.isNaN(f9Val) && f9Val > 0) {
            p.f9Sum += f9Val;
            p.f9Count += 1;
          }
        }

        p.matches.push({
          matchId: match.id,
          date: match.date,
          venue: match.venue,
          matchType: match.matchType,
          opponentTeam: oppTeam,
          opponentPlayer: oppPlayer,
          score: `${legsFor} - ${legsAgainst}`,
          result: won ? "W" : "L",
          legsFor: numLegsFor,
          legsAgainst: numLegsAgainst,
          avg: Number(stats?.avg || 0),
          stats
        });
      };

      const isHomePartington = match.homeTeam === "Partington WMC";
      const isAwayPartington = match.awayTeam === "Partington WMC";

      if (isHomePartington) {
        processPlayer(
          game.homePlayer, 
          match.awayTeam,
          game.awayPlayer,
          game.homeWinner, 
          game.homeScore, 
          game.awayScore, 
          game.homeStats
        );
      } else if (isAwayPartington) {
        processPlayer(
          game.awayPlayer, 
          match.homeTeam,
          game.homePlayer,
          !game.homeWinner, 
          game.awayScore, 
          game.homeScore, 
          game.awayStats
        );
      }
    });
  });

  return Object.values(statsMap).map((player) => {
    const totalLegs = player.legsFor + player.legsAgainst;

    // Replace simple average with leg-weighted average:
    let weightedSum = 0;
    let totalLegsCount = 0;

    const playerMatches = player.matches || [];
    playerMatches.forEach(match => {
      const matchLegs = (Number(match.legsFor || 0) + Number(match.legsAgainst || 0)) || (Number(match.score?.split('-')[0] || 0) + Number(match.score?.split('-')[1] || 0));
      const matchAvg = Number(match.stats?.avg || match.avg || 0);
      
      if (matchLegs > 0 && matchAvg > 0) {
        weightedSum += matchAvg * matchLegs;
        totalLegsCount += matchLegs;
      }
    });

    const computedAverage = totalLegsCount > 0 
      ? (weightedSum / totalLegsCount).toFixed(2) 
      : '0.00';

    return {
      ...player,
      winPct: player.played > 0 ? Number(((player.won / player.played) * 100).toFixed(1)) : 0,
      legsPct: totalLegs > 0 ? Number(((player.legsFor / totalLegs) * 100).toFixed(1)) : 0,
      avg: Number(computedAverage),
      avgStr: computedAverage,
      f9Avg: player.f9Count > 0 ? Number((player.f9Sum / player.f9Count).toFixed(2)) : "-",
      wins: player.won,
      legsW: player.legsFor,
      legsL: player.legsAgainst,
      max180: player.max180s,
      ld: player.leastDarts || 0,
      hf: player.highestFinish || 0
    };
  }).sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won;
    if (b.legsW !== a.legsW) return b.legsW - a.legsW;
    if (b.avg !== a.avg) return b.avg - a.avg;
    return (a.ld || 99) - (b.ld || 99);
  });
}

export function getSquadStats(matchesData) {
  return calculatePlayerStats(matchesData);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculatePlayerStats,
    getSquadStats,
    canonicalPlayerName,
    isSamePlayer
  };
}

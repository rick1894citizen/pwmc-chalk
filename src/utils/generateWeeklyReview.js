/**
 * generateWeeklyReview.js
 * Generates automated match review insights and structured summaries for completed fixtures.
 */

export function generateWeeklyReview(match) {
  if (!match) return null;

  if (match.review) {
    return match.review;
  }

  const homeTeam = match.homeTeam || "Home";
  const awayTeam = match.awayTeam || "Away";
  const venue = match.venue || "";
  const date = match.date || "";

  let homeScore = Number(match.homeScore || 0);
  let awayScore = Number(match.awayScore || 0);
  const playerStatsList = [];

  // Determine if passed fixture is from MATCHES_DATA or runtime fixture object (S.viewing / S.fx)
  const isMatchData = !!match.games && match.games[0] && typeof match.games[0].homePlayer !== "undefined";

  if (isMatchData) {
    (match.games || []).forEach((g) => {
      const hScore = Number(g.homeScore || 0);
      const aScore = Number(g.awayScore || 0);
      if (hScore === 0 && aScore === 0 && !g.homeWinner && !g.awayWinner) return;

      if (g.homePlayer && g.homePlayer !== "-") {
        playerStatsList.push({
          name: g.homePlayer,
          team: homeTeam,
          opp: g.awayPlayer,
          oppTeam: awayTeam,
          won: g.homeWinner ?? (hScore > aScore),
          legsWon: hScore,
          legsLost: aScore,
          avg: Number(g.homeStats?.avg || 0),
          tons: (g.homeStats?.tons && g.homeStats.tons !== "-") ? Number(g.homeStats.tons) : 0,
          max180: (g.homeStats?.max && g.homeStats.max !== "-") ? Number(g.homeStats.max) : 0,
          ld: (g.homeStats?.ld && g.homeStats.ld !== "-") ? Number(g.homeStats.ld) : null,
          hf: (g.homeStats?.hf && g.homeStats.hf !== "-") ? Number(g.homeStats.hf) : null
        });
      }

      if (g.awayPlayer && g.awayPlayer !== "-") {
        playerStatsList.push({
          name: g.awayPlayer,
          team: awayTeam,
          opp: g.homePlayer,
          oppTeam: homeTeam,
          won: !g.homeWinner && (aScore > hScore || g.homeWinner === false),
          legsWon: aScore,
          legsLost: hScore,
          avg: Number(g.awayStats?.avg || 0),
          tons: (g.awayStats?.tons && g.awayStats.tons !== "-") ? Number(g.awayStats.tons) : 0,
          max180: (g.awayStats?.max && g.awayStats.max !== "-") ? Number(g.awayStats.max) : 0,
          ld: (g.awayStats?.ld && g.awayStats.ld !== "-") ? Number(g.awayStats.ld) : null,
          hf: (g.awayStats?.hf && g.awayStats.hf !== "-") ? Number(g.awayStats.hf) : null
        });
      }
    });
  } else if (match.games && Array.isArray(match.games)) {
    // Runtime fixture format
    let calcHome = 0;
    let calcAway = 0;

    match.games.forEach((g) => {
      const isDoubles = g.kind === "doubles";
      const hWon = (g.legs || []).filter(l => l.won === "home").length;
      const aWon = (g.legs || []).filter(l => l.won === "away").length;

      if (!isDoubles) {
        if (g.won === "home" || hWon > aWon) calcHome++;
        else if (g.won === "away" || aWon > hWon) calcAway++;
      }

      const getPlayerStatsFromLegs = (names, side, oppNames, oppSide) => {
        if (!names || !names.length) return;
        const pName = names.join(" & ");
        let darts = 0, points = 0, tons = 0, max180 = 0, hf = 0, bestLeg = null;

        (g.legs || []).forEach(leg => {
          (leg.visits || []).forEach(v => {
            if (v.side === side) {
              darts += v.darts || 0;
              if (!v.bust) points += (v.score || 0);
              if (v.score === 180) max180++;
              else if (v.score >= 100) tons++;
              if (v.checkout && v.checkout > hf) hf = v.checkout;
            }
          });
          if (leg.won === side && leg.winDarts) {
            if (bestLeg === null || leg.winDarts < bestLeg) bestLeg = leg.winDarts;
          }
        });

        const avg = darts > 0 ? (points / darts) * 3 : 0;
        playerStatsList.push({
          name: pName,
          team: side === "home" ? homeTeam : awayTeam,
          opp: oppNames ? oppNames.join(" & ") : "",
          oppTeam: side === "home" ? awayTeam : homeTeam,
          won: (side === "home" ? hWon > aWon : aWon > hWon),
          legsWon: side === "home" ? hWon : aWon,
          legsLost: side === "home" ? aWon : hWon,
          avg: Number(avg.toFixed(2)),
          tons,
          max180,
          ld: bestLeg,
          hf: hf > 0 ? hf : null
        });
      };

      getPlayerStatsFromLegs(g.home, "home", g.away, "away");
      getPlayerStatsFromLegs(g.away, "away", g.home, "home");
    });

    if (homeScore === 0 && awayScore === 0 && (calcHome > 0 || calcAway > 0)) {
      homeScore = calcHome;
      awayScore = calcAway;
    }
  }

  // 1. Man of the Match (MOTM): Player with highest 3-dart average in fixture
  const validAvgPlayers = playerStatsList.filter(p => p.avg > 0);
  validAvgPlayers.sort((a, b) => b.avg - a.avg);
  const motmPlayer = validAvgPlayers[0] || { name: "-", avg: 0, legsWon: 0 };

  // 2. High Checkout
  const validOuts = playerStatsList.filter(p => p.hf && p.hf > 0).sort((a, b) => b.hf - a.hf);
  const highCheckout = validOuts[0] 
    ? { player: validOuts[0].name, checkout: validOuts[0].hf, team: validOuts[0].team } 
    : { player: "-", checkout: 0 };

  // 3. Crucial Leg / Best Performance: Shortest winning leg (LD)
  const validLD = playerStatsList.filter(p => p.won && p.ld && p.ld > 0).sort((a, b) => a.ld - b.ld);
  const shortestLeg = validLD[0] 
    ? { player: validLD[0].name, darts: validLD[0].ld, team: validLD[0].team } 
    : null;

  // 4. Team Highlights (Partington WMC focus)
  const isHomePWMC = homeTeam.toLowerCase().includes("partington");
  const isAwayPWMC = awayTeam.toLowerCase().includes("partington");
  const pwmcTeam = isHomePWMC ? homeTeam : (isAwayPWMC ? awayTeam : homeTeam);
  const oppTeam = isHomePWMC ? awayTeam : homeTeam;
  const pwmcScore = isHomePWMC ? homeScore : (isAwayPWMC ? awayScore : homeScore);
  const oppScore = isHomePWMC ? awayScore : (isAwayPWMC ? homeScore : awayScore);

  const pwmcPlayers = playerStatsList.filter(p => p.team === pwmcTeam);
  const teamTons = (pwmcPlayers.length ? pwmcPlayers : playerStatsList).reduce((sum, p) => sum + (p.tons || 0), 0);
  const team180s = (pwmcPlayers.length ? pwmcPlayers : playerStatsList).reduce((sum, p) => sum + (p.max180 || 0), 0);

  // 5. Headline construction
  let headline = "";
  if (isHomePWMC || isAwayPWMC) {
    if (pwmcScore > oppScore) {
      headline = isAwayPWMC 
        ? `PWMC Secure ${pwmcScore}-${oppScore} Victory at ${oppTeam}`
        : `PWMC Power to ${pwmcScore}-${oppScore} Home Win vs ${oppTeam}`;
    } else if (pwmcScore === oppScore) {
      headline = `PWMC Battle to Hard-Fought ${pwmcScore}-${oppScore} Draw against ${oppTeam}`;
    } else {
      headline = `PWMC Suffer Tough ${pwmcScore}-${oppScore} Defeat against ${oppTeam}`;
    }
  } else {
    headline = `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
  }

  // 6. Summary Bullet Points (3 key match takeaways)
  const bullets = [];
  
  // Bullet 1: Scoreline & outcome context
  if (isHomePWMC || isAwayPWMC) {
    const pwmcWonTies = pwmcPlayers.filter(p => p.won).length;
    const totalTies = pwmcPlayers.length || 7;
    if (pwmcScore > oppScore) {
      bullets.push(`Partington WMC sealed an impressive ${pwmcScore}-${oppScore} victory over ${oppTeam}${venue ? ` at ${venue}` : ""}, taking ${pwmcWonTies} of ${totalTies} individual ties.`);
    } else if (pwmcScore === oppScore) {
      bullets.push(`Points were shared in a competitive ${pwmcScore}-${oppScore} draw with ${oppTeam}${venue ? ` at ${venue}` : ""}.`);
    } else {
      bullets.push(`Partington WMC were edged out ${pwmcScore}-${oppScore} in a closely contested battle against ${oppTeam}.`);
    }
  } else {
    bullets.push(`${homeTeam} faced ${awayTeam} resulting in a final scoreline of ${homeScore}-${awayScore}.`);
  }

  // Bullet 2: Man of the Match spotlight
  if (motmPlayer.avg > 0) {
    bullets.push(`Man of the Match honours go to ${motmPlayer.name} with an outstanding ${motmPlayer.avg.toFixed(2)} 3-dart average (${motmPlayer.legsWon}-${motmPlayer.legsLost || 0} legs).`);
  } else {
    bullets.push(`Standout team performances propelled the lineup across singles games.`);
  }

  // Bullet 3: Firepower and key milestones
  const featParts = [];
  if (teamTons > 0) featParts.push(`${teamTons}x 100+ tons`);
  if (team180s > 0) featParts.push(`${team180s}x 180 maximum${team180s > 1 ? "s" : ""}`);
  if (highCheckout.checkout > 0) featParts.push(`a match-high ${highCheckout.checkout} checkout by ${highCheckout.player}`);
  if (shortestLeg) featParts.push(`a blistering ${shortestLeg.darts}-dart leg from ${shortestLeg.player}`);

  if (featParts.length) {
    bullets.push(`Team firepower included ${featParts.join(", ")}.`);
  } else {
    bullets.push(`Solid leg management and clinical finishing rounded out the fixture.`);
  }

  return {
    headline,
    motm: {
      player: motmPlayer.name,
      name: motmPlayer.name,
      avg: motmPlayer.avg,
      legsWon: motmPlayer.legsWon
    },
    highCheckout: {
      player: highCheckout.player,
      checkout: highCheckout.checkout
    },
    crucialLeg: shortestLeg ? {
      player: shortestLeg.player,
      darts: shortestLeg.darts
    } : null,
    teamHighlights: {
      tons: teamTons,
      max180s: team180s,
      highCheckout: highCheckout.checkout
    },
    summaryBulletPoints: bullets
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateWeeklyReview
  };
}

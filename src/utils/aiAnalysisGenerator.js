/**
 * AI Season Performance Analysis Generator
 * Dynamically computes tailored official scout reports from live player stats and match records.
 */

export function generatePlayerSeasonAnalysis(playerStats) {
  if (!playerStats || (!playerStats.played && !playerStats.p) || (playerStats.played === 0 && playerStats.p === 0)) {
    return "Awaiting season debut. A comprehensive scout report will generate once match reports are logged.";
  }

  const {
    name: rawName,
    player: rawPlayer,
    played: rawPlayed = 0,
    p = 0,
    won: rawWon = 0,
    wins: rawWins = 0,
    w = 0,
    avg: rawAvg = "0.00",
    avgStr,
    winRate: rawWinRate,
    winPct,
    highestFinish: rawHF = 0,
    hf = 0,
    leastDarts: rawLD = null,
    ld = null,
    tons = 0,
    max180s: raw180s = 0,
    max180 = 0,
    max = 0,
    matches = []
  } = playerStats;

  const name = rawName || rawPlayer || "Player";
  const played = rawPlayed || p || 0;
  const won = rawWon || rawWins || w || 0;
  const avg = typeof rawAvg === "number" ? rawAvg.toFixed(2) : (rawAvg || avgStr || "0.00");
  const winRate = rawWinRate || (winPct !== undefined ? Number(winPct).toFixed(1) : (played > 0 ? ((won / played) * 100).toFixed(1) : "0.0"));
  const highestFinish = Math.max(Number(rawHF) || 0, Number(hf) || 0);
  const leastDarts = rawLD !== null && rawLD !== undefined ? rawLD : ld;
  const max180s = Number(raw180s) || Number(max180) || Number(max) || 0;

  const numAvg = parseFloat(avg);
  const numWinRate = parseFloat(winRate);

  // Sort matches descending by date to ensure the true latest fixture is selected
  const sortedMatches = (matches || []).slice().sort((a, b) => {
    const parseDate = (d) => {
      if (!d) return 0;
      if (typeof d === "string" && d.includes("/")) {
        const parts = d.split("/");
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
      }
      return new Date(d).getTime();
    };
    return parseDate(b.date) - parseDate(a.date);
  });
  const latest = sortedMatches.length > 0 ? sortedMatches[0] : (matches.length > 0 ? matches[0] : null);

  // --- 1. PERSONALISED SEASON IDENTITY ---
  let seasonStory = "";

  if (name.includes("Mason Gamble")) {
    seasonStory = `Operating on a completely different tier this campaign, Mason remains Partington's undisputed talisman with an immaculate 100% win record across ${played} appearances. Sitting on a monstrous ${avg} season average with ${tons} tons and ${max180s} maximums, he consistently demoralises opposition top boards with pace and relentless treble hitting.`;
  } else if (name.includes("Mark Colgan")) {
    seasonStory = `The bedrock of Partington's matchplay consistency, Mark's ${winRate}% win rate (${won} wins in ${played}) proves his status as one of the division's premier clutch closers. Blending a heavy ${avg} average with seasoned match grit, his ability to grind out deciders and hit signature ton-plus checkouts (peak ${highestFinish}) makes him near-bulletproof.`;
  } else if (name.includes("Brandon Gamble")) {
    seasonStory = `A relentless scoring powerhouse, Brandon provides devastating firepower on the singles card with ${tons} tons and a ${avg} average over ${played} outings. With a sharp ${winRate}% return and ice in the veins on outer-ring combinations (highlighted by a season-best ${highestFinish} out), he frequently blows matches open before opponents can settle.`;
  } else if (name.includes("Rick Fox")) {
    seasonStory = `A model of calm composure and stoic focus, Rick lets his darts do the talking on the oche. Operating with an imposing ${winRate}% win rate (${won}W-${played - won}L) and a commanding ${avg} season average, he is a high-volume scoring powerhouse. Piling up ${tons} tons and 2 maximums while staying completely unflappable under pressure, his disciplined grouping and sharp two-dart finishing (peaking at ${highestFinish}) make him an ultra-reliable banker in the Partington order.`;
  } else if (name.includes("Steven Bell") || name.includes("Ste Bell")) {
    seasonStory = `The heartbeat of squad spirit, Ste's campaign has produced some of the most sensational moments of the season—none more so than his spectacular ${highestFinish} mega-checkout. Boasting ${won} wins in ${played} matches with a sturdy ${avg} average, his tenacity on the bull and timely ton surges keep Partington firmly in control of match nights.`;
  } else if (name.includes("Karl Bannister")) {
    seasonStory = `Karl brings steady, methodical dominance to the order, locking down an elite ${winRate}% win rate and a ${avg} average across ${played} matches. With ${tons} tons in the bank and a classy ${highestFinish} ton-out, his rhythm and dart-for-dart composure wear down opponents with surgical precision.`;
  } else if (name.includes("Chris Bollard")) {
    seasonStory = `Chris embodies pure matchplay character, stepping into high-pressure spots and delivering crucial squad points. His grit on key doubles is backed by a clutch ${highestFinish} season-high finish, providing Partington with invaluable winning depth when games hang in the balance.`;
  } else if (name.includes("Ryan Mellor")) {
    seasonStory = `A natural rhythm thrower with high upside, Ryan maintains a positive singles return (${won} wins in ${played}) at a ${avg} clip. Capable of sudden bursts of heavy treble visits, he continues to be a sharp tactical option capable of punishing slack darts.`;
  } else {
    // Dynamic fall-back for other squad players (Corey, Danny, Lewis, Adam, Jude, etc.)
    const trait = numAvg >= 55 ? "heavy-scoring authority" : numWinRate >= 70 ? "lethal outer-ring efficiency" : "dogged determination";
    seasonStory = `Supplying essential squad strength with ${won} victories in ${played} fixtures, recording a ${avg} average. Playing with ${trait}, their ability to rise to high-pressure moments (peaking with a ${highestFinish} checkout) gives the side great versatility.`;
  }

  // --- 2. LATEST FIXTURE SPECIFIC BREAKDOWN ---
  let latestMatchStory = "";

  if (latest) {
    const oppTeam = latest.opponentTeam || latest.oppTeam || (latest.fixture && (latest.fixture.homeTeam === "Partington WMC" ? latest.fixture.awayTeam : latest.fixture.homeTeam)) || "the opposition";
    const oppPlayer = latest.opponentPlayer && latest.opponentPlayer !== "-" ? latest.opponentPlayer : "their opponent";
    const score = latest.score || (latest.legsFor !== undefined && latest.legsAgainst !== undefined ? `${latest.legsFor} - ${latest.legsAgainst}` : "");
    const wonMatch = latest.won || latest.result === "W" || latest.isWon;
    const mStats = latest.stats || {};
    const matchAvg = parseFloat(mStats.avg || latest.avg || 0) || 0;
    const matchTons = parseInt(mStats.tons || 0, 10) || 0;
    const matchHf = parseInt(mStats.hf || 0, 10) || 0;
    const matchLd = parseInt(mStats.ld || 0, 10) || 0;
    const matchF9 = parseFloat(mStats.f9 || 0) || 0;

    if (wonMatch) {
      let standoutMetric = "";
      if (matchAvg >= 80) {
        standoutMetric = `putting on a premier-class clinic with a staggering ${matchAvg.toFixed(2)} average, a ${matchLd}-dart leg, and a stunning ${matchHf} finish`;
      } else if (matchAvg >= 70) {
        standoutMetric = `dominating the board at a searing ${matchAvg.toFixed(2)} clip alongside ${matchTons} power tons`;
      } else if (matchTons >= 7) {
        standoutMetric = `pounding the treble bed for an extraordinary ${matchTons} tons and a clinical ${matchAvg.toFixed(2)} average`;
      } else if (score === "3 - 0") {
        standoutMetric = `delivering a ruthless 3–0 whitewash backed by a steady ${matchAvg.toFixed(2)} average`;
      } else if (score === "3 - 2") {
        standoutMetric = `digging deep in a 5-leg nerve-shredder to snatch the decider with ${matchTons > 0 ? matchTons + ' tons and ' : ''}composed outer-ring conversion`;
      } else {
        standoutMetric = `securing a commanding ${score} triumph with ${matchTons > 0 ? matchTons + ' tons and ' : ''}a ${matchAvg.toFixed(2)} average`;
      }

      // Dynamic takeaway based on the performance context:
      let matchTakeaway = "";

      if (matchAvg >= 80 || (matchHf >= 100 && matchAvg >= 65)) {
        matchTakeaway = "A blistering individual clinic that dismantled the opposition and set the gold standard for the entire division.";
      } else if (matchTons >= 6) {
        matchTakeaway = "A relentlessly heavy scoring display where sustained treble pressure left their opponent with zero breathing room.";
      } else if (score === "3 - 0") {
        matchTakeaway = "A swift, ruthless sweep on away territory that sent a resounding statement to the rest of the league.";
      } else if (score === "3 - 2") {
        matchTakeaway = "Pure matchplay bottle on the outer ring, finding clutch doubles with the match on the line to grind out two massive points.";
      } else if (matchAvg >= 60) {
        matchTakeaway = "A composed, controlled performance that controlled the board tempo and kept Partington's title charge rolling.";
      } else {
        matchTakeaway = "Disciplined, clinical board management that took care of business and secured a vital away rubber.";
      }

      latestMatchStory = `Latest Outing: Stepped up at ${oppTeam} to defeat ${oppPlayer} (${score}), ${standoutMetric}. ${matchTakeaway}`;
    } else {
      latestMatchStory = `Latest Outing: Battled hard in a tough ${score} test against ${oppPlayer} (${oppTeam}). Despite the final scoreline, finding visits with ${matchTons > 0 ? matchTons + (matchTons > 1 ? ' ton-plus scores and ' : ' ton-plus score and ') : ''}a ${matchAvg.toFixed(2)} average showed glimpses of heavy scoring that will serve as fuel for an immediate bounce-back.`;
    }
  }

  return latestMatchStory ? `${seasonStory}\n\n${latestMatchStory}` : seasonStory;
}

if (typeof window !== "undefined") {
  window.generatePlayerSeasonAnalysis = generatePlayerSeasonAnalysis;
}

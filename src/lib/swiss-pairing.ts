import type { Player, Pairing, Round, GameResult } from './types';

interface ScoreGroup {
  score: number;
  players: Player[];
}

function getScore(playerId: string, rounds: Round[]): number {
  let score = 0;
  for (const round of rounds) {
    if (round.byePlayer === playerId) {
      score += 1;
      continue;
    }
    for (const pairing of round.pairings) {
      if (pairing.white === playerId) {
        if (pairing.result === '1-0') score += 1;
        else if (pairing.result === '0.5-0.5') score += 0.5;
      } else if (pairing.black === playerId) {
        if (pairing.result === '0-1') score += 1;
        else if (pairing.result === '0.5-0.5') score += 0.5;
      }
    }
  }
  return score;
}

function havePlayed(playerA: string, playerB: string, rounds: Round[]): boolean {
  for (const round of rounds) {
    for (const pairing of round.pairings) {
      if (
        (pairing.white === playerA && pairing.black === playerB) ||
        (pairing.white === playerB && pairing.black === playerA)
      ) {
        return true;
      }
    }
  }
  return false;
}

function getColorHistory(playerId: string, rounds: Round[]): ('w' | 'b' | 'bye')[] {
  const history: ('w' | 'b' | 'bye')[] = [];
  for (const round of rounds) {
    if (round.byePlayer === playerId) {
      history.push('bye');
      continue;
    }
    let found = false;
    for (const pairing of round.pairings) {
      if (pairing.white === playerId) {
        history.push('w');
        found = true;
        break;
      }
      if (pairing.black === playerId) {
        history.push('b');
        found = true;
        break;
      }
    }
    if (!found) history.push('bye');
  }
  return history;
}

function desiredColor(history: ('w' | 'b' | 'bye')[]): 'w' | 'b' {
  let wCount = 0;
  let bCount = 0;
  for (const c of history) {
    if (c === 'w') wCount++;
    else if (c === 'b') bCount++;
  }
  const last = history[history.length - 1];
  if (last === 'w') return 'b';
  if (last === 'b') return 'w';
  if (wCount <= bCount) return 'w';
  return 'b';
}

function hasThreeSameInRow(history: ('w' | 'b' | 'bye')[], newColor: 'w' | 'b'): boolean {
  const relevant = history.filter(c => c !== 'bye').slice(-2);
  if (relevant.length < 2) return false;
  return relevant[0] === newColor && relevant[1] === newColor;
}

function makePairing(
  playerA: Player,
  playerB: Player,
  rounds: Round[],
  tableNumber: number,
): Pairing {
  const historyA = getColorHistory(playerA.id, rounds);
  const historyB = getColorHistory(playerB.id, rounds);

  const aWantsW = desiredColor(historyA) === 'w';
  const bWantsW = desiredColor(historyB) === 'w';

  let white: string;
  let black: string;

  if (aWantsW && !bWantsW) {
    white = playerA.id;
    black = playerB.id;
  } else if (!aWantsW && bWantsW) {
    white = playerB.id;
    black = playerA.id;
  } else {
    const totalW_a = historyA.filter(c => c === 'w').length;
    const totalW_b = historyB.filter(c => c === 'w').length;
    if (totalW_a <= totalW_b) {
      white = playerA.id;
      black = playerB.id;
    } else {
      white = playerB.id;
      black = playerA.id;
    }
  }

  const newA = historyA[historyA.length - 1] === 'bye' ? desiredColor(historyA) : (white === playerA.id ? 'w' : 'b');
  const newB = historyB[historyB.length - 1] === 'bye' ? desiredColor(historyB) : (black === playerB.id ? 'b' : 'w');

  if (
    hasThreeSameInRow(historyA, newA) ||
    hasThreeSameInRow(historyB, newB)
  ) {
    white = playerB.id;
    black = playerA.id;
  }

  return { white, black, result: null, tableNumber };
}

function buildScoreGroups(players: Player[], rounds: Round[]): ScoreGroup[] {
  const scored = players.map(p => ({
    player: p,
    score: getScore(p.id, rounds),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.player.rating - a.player.rating;
  });

  const groups: ScoreGroup[] = [];
  for (const entry of scored) {
    const last = groups[groups.length - 1];
    if (last && last.score === entry.score) {
      last.players.push(entry.player);
    } else {
      groups.push({ score: entry.score, players: [entry.player] });
    }
  }

  return groups;
}

function pairScoreGroup(
  players: Player[],
  rounds: Round[],
  startTable: number,
): { pairings: Pairing[]; unpaired: Player[]; table: number } {
  const pairings: Pairing[] = [];
  let table = startTable;
  const remaining = [...players];
  const unpaired: Player[] = [];

  while (remaining.length >= 2) {
    const top = remaining.shift()!;

    let found = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!havePlayed(top.id, remaining[i].id, rounds)) {
        pairings.push(makePairing(top, remaining[i], rounds, table));
        remaining.splice(i, 1);
        table++;
        found = true;
        break;
      }
    }

    if (!found) {
      const partner = remaining.shift()!;
      pairings.push(makePairing(top, partner, rounds, table));
      table++;
    }
  }

  if (remaining.length === 1) {
    unpaired.push(remaining[0]);
  }

  return { pairings, unpaired, table };
}

function findBestByePlayer(players: Player[], rounds: Round[]): Player | null {
  const scored = players.map(p => ({
    player: p,
    score: getScore(p.id, rounds),
    hadBye: rounds.some(r => r.byePlayer === p.id),
  }));

  scored.sort((a, b) => {
    if (a.hadBye !== b.hadBye) return a.hadBye ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return b.player.rating - a.player.rating;
  });

  if (scored.length > 0 && !scored[0].hadBye) {
    return scored[0].player;
  }
  if (scored.length > 0) {
    return scored[0].player;
  }
  return null;
}

export function generateFirstRound(players: Player[]): Round {
  const sorted = [...players].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.seed - b.seed;
  });

  const half = Math.ceil(sorted.length / 2);
  const topHalf = sorted.slice(0, half);
  const bottomHalf = sorted.slice(half);

  const pairings: Pairing[] = [];
  let table = 1;
  let byePlayer: string | undefined;

  while (topHalf.length > 0 && bottomHalf.length > 0) {
    const a = topHalf.shift()!;
    const b = bottomHalf.shift()!;
    const white = pairings.length % 2 === 0 ? a : b;
    const black = pairings.length % 2 === 0 ? b : a;
    pairings.push({ white: white.id, black: black.id, result: null, tableNumber: table });
    table++;
  }

  const leftovers = [...topHalf, ...bottomHalf];
  while (leftovers.length >= 2) {
    const a = leftovers.shift()!;
    const b = leftovers.shift()!;
    pairings.push({ white: a.id, black: b.id, result: null, tableNumber: table });
    table++;
  }

  if (leftovers.length === 1) {
    byePlayer = leftovers[0].id;
  }

  return { roundNumber: 1, pairings, ...(byePlayer ? { byePlayer } : {}) };
}

export function generateNextRound(
  players: Player[],
  rounds: Round[],
): Round {
  const roundNumber = rounds.length + 1;
  const scoreGroups = buildScoreGroups(players, rounds);
  const allPairings: Pairing[] = [];
  let table = 1;
  let carryOver: Player[] = [];

  for (const group of scoreGroups) {
    const groupPlayers = [...group.players, ...carryOver];
    const result = pairScoreGroup(groupPlayers, rounds, table);
    allPairings.push(...result.pairings);
    table = result.table;
    carryOver = result.unpaired;
  }

  let byePlayer: string | undefined;
  if (carryOver.length === 1) {
    byePlayer = carryOver[0].id;
  } else if (carryOver.length > 1) {
    const result = pairScoreGroup(carryOver, rounds, table);
    allPairings.push(...result.pairings);
    if (result.unpaired.length === 1) {
      byePlayer = result.unpaired[0].id;
    }
  }

  const allPairedIds = new Set<string>();
  for (const p of allPairings) {
    allPairedIds.add(p.white);
    allPairedIds.add(p.black);
  }
  const unpairedPlayers = players.filter(p => !allPairedIds.has(p.id) && p.id !== byePlayer);

  if (unpairedPlayers.length > 0) {
    if (!byePlayer) {
      const byeCandidate = findBestByePlayer(unpairedPlayers, rounds);
      if (byeCandidate) {
        byePlayer = byeCandidate.id;
      }
    }
  }

  return { roundNumber, pairings: allPairings, ...(byePlayer ? { byePlayer } : {}) };
}

export function getAllPlayerScores(players: Player[], rounds: Round[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const player of players) {
    scores.set(player.id, getScore(player.id, rounds));
  }
  return scores;
}

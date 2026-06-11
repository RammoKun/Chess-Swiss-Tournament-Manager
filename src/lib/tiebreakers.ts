import type { Player, Round, PlayerStanding } from './types';

function calculateScore(playerId: string, rounds: Round[]): number {
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

function calculateBuchholz(playerId: string, players: Player[], rounds: Round[]): number {
  let sum = 0;
  let opponentCount = 0;
  for (const round of rounds) {
    if (round.byePlayer === playerId) continue;
    for (const pairing of round.pairings) {
      let opponentId: string | null = null;
      if (pairing.white === playerId) opponentId = pairing.black;
      else if (pairing.black === playerId) opponentId = pairing.white;
      if (opponentId) {
        sum += calculateScore(opponentId, rounds);
        opponentCount++;
      }
    }
  }
  return opponentCount > 0 ? sum : 0;
}

function calculateSonnebornBerger(playerId: string, rounds: Round[]): number {
  let sum = 0;
  for (const round of rounds) {
    if (round.byePlayer === playerId) continue;
    for (const pairing of round.pairings) {
      let opponentId: string | null = null;
      let isWhite = false;
      if (pairing.white === playerId) {
        opponentId = pairing.black;
        isWhite = true;
      } else if (pairing.black === playerId) {
        opponentId = pairing.white;
        isWhite = false;
      }
      if (opponentId && pairing.result) {
        const opponentScore = calculateScore(opponentId, rounds);
        if (isWhite) {
          if (pairing.result === '1-0') sum += opponentScore;
          else if (pairing.result === '0.5-0.5') sum += opponentScore * 0.5;
        } else {
          if (pairing.result === '0-1') sum += opponentScore;
          else if (pairing.result === '0.5-0.5') sum += opponentScore * 0.5;
        }
      }
    }
  }
  return sum;
}

export function getPlayerStandings(players: Player[], rounds: Round[]): PlayerStanding[] {
  const standings: PlayerStanding[] = players.map(player => {
    const score = calculateScore(player.id, rounds);
    const buchholz = calculateBuchholz(player.id, players, rounds);
    const sb = calculateSonnebornBerger(player.id, rounds);

    let wins = 0;
    let draws = 0;
    let losses = 0;

    for (const round of rounds) {
      if (round.byePlayer === player.id) {
        wins++;
        continue;
      }
      for (const pairing of round.pairings) {
        if (pairing.white === player.id) {
          if (pairing.result === '1-0') wins++;
          else if (pairing.result === '0.5-0.5') draws++;
          else if (pairing.result === '0-1') losses++;
        } else if (pairing.black === player.id) {
          if (pairing.result === '0-1') wins++;
          else if (pairing.result === '0.5-0.5') draws++;
          else if (pairing.result === '1-0') losses++;
        }
      }
    }

    return { player, rank: 0, score, buchholz, sonnebornBerger: sb, wins, draws, losses };
  });

  standings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
    return a.player.rating - b.player.rating;
  });

  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return standings;
}

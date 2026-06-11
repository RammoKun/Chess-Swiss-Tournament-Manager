export interface Player {
  id: string;
  name: string;
  rating: number;
  initialRating: number;
  seed: number;
  colorHistory: ('w' | 'b' | 'bye')[];
}

export type GameResult = '1-0' | '0-1' | '0.5-0.5' | null;

export interface Pairing {
  white: string;
  black: string;
  result: GameResult;
  tableNumber: number;
  whiteEloChange?: number;
  blackEloChange?: number;
}

export interface Round {
  roundNumber: number;
  pairings: Pairing[];
  byePlayer?: string;
}

export type TournamentStatus = 'setup' | 'active' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  ownerId: string;
  status: TournamentStatus;
  numberOfRounds: number;
  currentRound: number;
  players: Player[];
  rounds: Round[];
  createdAt: number;
}

export interface PlayerStanding {
  player: Player;
  rank: number;
  score: number;
  buchholz: number;
  sonnebornBerger: number;
  wins: number;
  draws: number;
  losses: number;
}

import type { Player, PlayerStanding } from '../../lib/types';

interface Props {
  standings: PlayerStanding[];
  players: Player[];
}

function getResultIcon(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

export default function Standings({ standings, players }: Props) {
  const maxScore = Math.max(...standings.map((s) => s.score), 1);

  if (standings.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-canvas p-8 text-center shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
        <p className="text-sm text-mute">No standings yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {standings.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[2, 1, 3].map((rank) => {
            const s = standings.find((st) => st.rank === rank);
            if (!s) return null;
            const color = rank === 1 ? 'bg-draw-soft border-draw/30' : 'bg-canvas-soft border-hairline';
            const scale = rank === 1 ? 'scale-105' : 'scale-100';
            return (
              <div
                key={rank}
                class={`rounded-lg border p-4 text-center ${color} ${scale}`}
              >
                <div className="text-2xl">{getResultIcon(rank)}</div>
                <div className="mt-1 text-sm font-medium text-ink">{s.player.name}</div>
                <div className="text-lg font-bold text-ink">{s.score}</div>
                <div className="text-xs text-mute">pts</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-canvas-soft text-left text-xs font-medium text-mute">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-center w-12">Pts</th>
              <th className="px-3 py-2 text-center w-10">W</th>
              <th className="px-3 py-2 text-center w-10">D</th>
              <th className="px-3 py-2 text-center w-10">L</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Buchholz</th>
              <th className="hidden px-3 py-2 text-right md:table-cell">SB</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const totalGames = s.wins + s.draws + s.losses || 1;
              const winPct = Math.round((s.wins / totalGames) * 100);
              const drawPct = Math.round((s.draws / totalGames) * 100);
              const lossPct = Math.round((s.losses / totalGames) * 100);
              const scoreBarPct = maxScore > 0 ? (s.score / maxScore) * 100 : 0;

              return (
                <tr
                  key={s.player.id}
                  className="border-b border-hairline last:border-0 transition-colors hover:bg-canvas-soft"
                >
                  <td className="px-3 py-3 text-center">
                    {s.rank <= 3 ? (
                      <span className="text-lg">{getResultIcon(s.rank)}</span>
                    ) : (
                      <span className="text-mute text-xs">{s.rank}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft text-xs font-medium text-body">
                        {s.player.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium text-ink">{s.player.name}</span>
                      <span className="text-xs text-mute">({s.player.rating})</span>
                    </div>
                    <div className="mt-1.5 flex h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-canvas-soft">
                      <div
                        className="bg-win transition-all duration-500"
                        style={{ width: `${winPct}%` }}
                      />
                      <div
                        className="bg-draw transition-all duration-500"
                        style={{ width: `${drawPct}%` }}
                      />
                      <div
                        className="bg-loss transition-all duration-500"
                        style={{ width: `${lossPct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold">{s.score}</span>
                      <div className="mt-1 h-1 w-8 overflow-hidden rounded-full bg-canvas-soft">
                        <div
                          className="h-full rounded-full bg-ink transition-all duration-500"
                          style={{ width: `${scoreBarPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-win">{s.wins}</td>
                  <td className="px-3 py-3 text-center text-draw">{s.draws}</td>
                  <td className="px-3 py-3 text-center text-loss">{s.losses}</td>
                  <td className="hidden px-3 py-3 text-right text-body sm:table-cell">
                    {s.buchholz.toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-body md:table-cell">
                    {s.sonnebornBerger.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

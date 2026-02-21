import type { ContestData, Golfer, Player } from './types';

const GOLFERS: Golfer[] = [
  { id: 1, name: "Scottie Scheffler", total: -11, thru: "F" },
  { id: 2, name: "Xander Schauffele", total: -7, thru: "F" },
  { id: 3, name: "Rory McIlroy", total: -6, thru: "F" },
  { id: 4, name: "Collin Morikawa", total: -5, thru: "16" },
  { id: 5, name: "Max Homa", total: -4, thru: "F" },
  { id: 6, name: "Ludvig Åberg", total: -4, thru: "14" },
  { id: 7, name: "Viktor Hovland", total: -3, thru: "F" },
  { id: 8, name: "Patrick Cantlay", total: -2, thru: "F" },
  { id: 9, name: "Jon Rahm", total: -2, thru: "17" },
  { id: 10, name: "Justin Thomas", total: -1, thru: "F" },
  { id: 11, name: "Jordan Spieth", total: -1, thru: "15" },
  { id: 12, name: "Wyndham Clark", total: 0, thru: "F" },
  { id: 13, name: "Sahith Theegala", total: 0, thru: "F" },
  { id: 14, name: "Tommy Fleetwood", total: 1, thru: "F" },
  { id: 15, name: "Matt Fitzpatrick", total: 1, thru: "13" },
  { id: 16, name: "Tony Finau", total: 2, thru: "F" },
  { id: 17, name: "Sam Burns", total: 2, thru: "F" },
  { id: 18, name: "Hideki Matsuyama", total: 3, thru: "F" },
  { id: 19, name: "Jason Day", total: 4, thru: "F" },
  { id: 20, name: "Keegan Bradley", total: 5, thru: "F" },
  { id: 21, name: "Adam Scott", total: 6, thru: "CUT" },
  { id: 22, name: "Rickie Fowler", total: 7, thru: "CUT" },
  { id: 23, name: "Dustin Johnson", total: -3, thru: "F" },
  { id: 24, name: "Brooks Koepka", total: -2, thru: "16" },
  { id: 25, name: "Cameron Smith", total: -1, thru: "F" },
  { id: 26, name: "Bryson DeChambeau", total: 0, thru: "14" },
  { id: 27, name: "Tyrrell Hatton", total: 1, thru: "F" },
  { id: 28, name: "Shane Lowry", total: 2, thru: "F" },
  { id: 29, name: "Brian Harman", total: 3, thru: "F" },
  { id: 30, name: "Cameron Young", total: 4, thru: "CUT" },
];

const PLAYERS: Omit<Player, 'lineup'>[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Charlie" },
  { id: 4, name: "David" },
  { id: 5, name: "Eve" },
  { id: 6, name: "Frank" },
  { id: 7, name: "Grace" },
  { id: 8, name: "Heidi" },
  { id: 9, name: "Ivan" },
  { id: 10, name: "Judy" },
  { id: 11, name: "Mallory" },
  { id: 12, name: "Niaj" },
  { id: 13, name: "Olivia" },
  { id: 14, name: "Peggy" },
  { id: 15, name: "Quentin" },
  { id: 16, name: "Rupert" },
  { id: 17, name: "Sybil" },
  { id: 18, name: "Trent" },
  { id: 19, name: "Umar" },
  { id: 20, name: "Victor" },
];

// Function to generate a random lineup for a player
const generateLineup = (): Golfer[] => {
  const shuffled = [...GOLFERS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6);
};

export const initialContestData: ContestData = {
  golfers: GOLFERS,
  players: PLAYERS.map(player => ({
    ...player,
    lineup: generateLineup(),
  })),
};

// Function to simulate live data refresh
export const refreshContestData = (currentData: ContestData): ContestData => {
  const newGolfers = currentData.golfers.map(golfer => {
    // Only update scores for players still on the course
    if (golfer.thru !== "F" && golfer.thru !== "CUT") {
      const currentHole = parseInt(golfer.thru, 10);
      if (!isNaN(currentHole)) {
        // Chance to stay on the same hole or move to the next
        if (Math.random() > 0.4) {
           const scoreChange = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
           const newTotal = golfer.total + scoreChange;
           const newHole = currentHole + 1;
           return {
             ...golfer,
             total: newTotal,
             thru: newHole > 18 ? "F" : String(newHole),
           };
        }
      }
    }
    return golfer;
  });

  // Re-map players to lineups with updated golfer data
  const newPlayers = currentData.players.map(player => ({
    ...player,
    lineup: player.lineup.map(lineupGolfer => 
      newGolfers.find(g => g.id === lineupGolfer.id) || lineupGolfer
    )
  }));
  
  return { golfers: newGolfers, players: newPlayers };
};

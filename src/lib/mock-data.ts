import type { ContestData, Golfer, Player } from './types';

const GOLFERS: Golfer[] = [
  { id: 1, name: "Scottie Scheffler", total: -11, thru: "F", position: "1", fantasyPoints: 120.5, ownership: 25.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_46046.png", r1: "66(-6)", r2: "68(-4)", r3: "68(-4)" },
  { id: 2, name: "Xander Schauffele", total: -7, thru: "F", position: "T2", fantasyPoints: 95.0, ownership: 18.2, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_48081.png", r1: "68(-4)", r2: "70(-2)", r3: "69(-3)" },
  { id: 3, name: "Rory McIlroy", total: -6, thru: "F", position: "T2", fantasyPoints: 90.5, ownership: 22.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_28237.png", r1: "70(-2)", r2: "67(-5)", r3: "71(-1)" },
  { id: 4, name: "Collin Morikawa", total: -5, thru: "16", position: "T4", fantasyPoints: 85.0, ownership: 10.84, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_51364.png", r1: "68(-3)", r2: "69(-2)", r3: "1:20 PM EST" },
  { id: 5, name: "Max Homa", total: -4, thru: "F", position: "T4", fantasyPoints: 82.0, ownership: 12.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_39977.png", r1: "69(-3)", r2: "70(-2)", r3: "71(-1)" },
  { id: 6, name: "Ludvig Åberg", total: -4, thru: "14", position: "6", fantasyPoints: 78.5, ownership: 15.3, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_57252.png", r1: "71(-1)", r2: "69(-3)", r3: "2:00 PM EST" },
  { id: 7, name: "Viktor Hovland", total: -3, thru: "F", position: "7", fantasyPoints: 75.0, ownership: 19.8, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_46717.png", r1: "72(E)", r2: "68(-4)", r3: "71(-1)" },
  { id: 8, name: "Patrick Cantlay", total: -2, thru: "F", position: "T8", fantasyPoints: 72.5, ownership: 14.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_35532.png", r1: "70(-2)", r2: "72(E)", r3: "70(-2)" },
  { id: 9, name: "Jon Rahm", total: -2, thru: "17", position: "T8", fantasyPoints: 70.0, ownership: 21.0, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_39994.png", r1: "73(+1)", r2: "67(-5)", r3: "1:40 PM EST" },
  { id: 10, name: "Justin Thomas", total: -1, thru: "F", position: "10", fantasyPoints: 68.0, ownership: 11.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_33448.png", r1: "72(E)", r2: "70(-2)", r3: "71(-1)" },
  { id: 11, name: "Jordan Spieth", total: -1, thru: "15", position: "T11", fantasyPoints: 66.5, ownership: 13.2, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_34046.png", r1: "71(-1)", r2: "70(-2)", r3: "1:50 PM EST" },
  { id: 12, name: "Wyndham Clark", total: 0, thru: "F", position: "T11", fantasyPoints: 65.0, ownership: 8.8, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_52370.png", r1: "73(+1)", r2: "69(-3)", r3: "72(E)" },
  { id: 13, name: "Sahith Theegala", total: 0, thru: "F", position: "T13", fantasyPoints: 63.5, ownership: 7.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_55489.png", r1: "71(-1)", r2: "71(-1)", r3: "72(E)" },
  { id: 14, name: "Tommy Fleetwood", total: 1, thru: "F", position: "T13", fantasyPoints: 62.0, ownership: 9.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_30911.png", r1: "72(E)", r2: "71(-1)", r3: "72(E)" },
  { id: 15, name: "Matt Fitzpatrick", total: 1, thru: "13", position: "T15", fantasyPoints: 54.5, ownership: 21.69, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_40095.png", r1: "69(-2)", r2: "66(-5)", r3: "2:15 PM EST" },
  { id: 16, name: "Tony Finau", total: 2, thru: "F", position: "T15", fantasyPoints: 58.0, ownership: 10.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_29725.png", r1: "73(+1)", r2: "70(-2)", r3: "73(+1)" },
  { id: 17, name: "Sam Burns", total: 2, thru: "F", position: "T17", fantasyPoints: 56.5, ownership: 6.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_51634.png", r1: "70(-2)", r2: "74(+2)", r3: "72(E)" },
  { id: 18, name: "Hideki Matsuyama", total: 3, thru: "F", position: "T17", fantasyPoints: 55.0, ownership: 11.8, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_32839.png", r1: "74(+2)", r2: "70(-2)", r3: "73(+1)" },
  { id: 19, name: "Jason Day", total: 4, thru: "F", position: "19", fantasyPoints: 52.0, ownership: 7.8, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_27942.png", r1: "75(+3)", r2: "69(-3)", r3: "74(+2)" },
  { id: 20, name: "Keegan Bradley", total: 5, thru: "F", position: "20", fantasyPoints: 50.0, ownership: 4.2, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_33449.png", r1: "76(+4)", r2: "70(-2)", r3: "73(+1)" },
  { id: 21, name: "Adam Scott", total: 6, thru: "CUT", position: "CUT", fantasyPoints: 0, ownership: 5.5, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_24502.png", r1: "75(+3)", r2: "75(+3)", r3: "-" },
  { id: 22, name: "Rickie Fowler", total: 7, thru: "CUT", position: "CUT", fantasyPoints: 0, ownership: 6.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_32102.png", r1: "76(+4)", r2: "75(+3)", r3: "-" },
  { id: 23, name: "Dustin Johnson", total: -3, thru: "F", position: "T23", fantasyPoints: 43.0, ownership: 10.84, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_30925.png", r1: "68(-3)", r2: "69(-2)", r3: "1:20 PM EST" },
  { id: 24, name: "Brooks Koepka", total: -2, thru: "16", position: "T24", fantasyPoints: 35.0, ownership: 17.47, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_36674.png", r1: "68(-3)", r2: "72(+1)", r3: "12:20 PM EST" },
  { id: 25, name: "Cameron Smith", total: -1, thru: "F", position: "T25", fantasyPoints: 43.0, ownership: 4.22, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_39970.png", r1: "73(+2)", r2: "68(-3)", r3: "11:25 AM EST" },
  { id: 26, name: "Bryson DeChambeau", total: 0, thru: "14", position: "T26", fantasyPoints: 54.5, ownership: 21.69, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_47959.png", r1: "69(-2)", r2: "66(-5)", r3: "2:15 PM EST" },
  { id: 27, name: "Tyrrell Hatton", total: 1, thru: "F", position: "T27", fantasyPoints: 37.0, ownership: 10.84, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_33444.png", r1: "68(-3)", r2: "71(E)", r3: "12:50 PM EST" },
  { id: 28, name: "Shane Lowry", total: 2, thru: "F", position: "T28", fantasyPoints: 29.5, ownership: 24.10, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_33204.png", r1: "70(-1)", r2: "72(+1)", r3: "11:05 AM EST" },
  { id: 29, name: "Brian Harman", total: 3, thru: "F", position: "T29", fantasyPoints: 37.0, ownership: 10.84, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_27642.png", r1: "68(-3)", r2: "71(E)", r3: "12:50 PM EST" },
  { id: 30, name: "Cameron Young", total: 4, thru: "CUT", position: "CUT", fantasyPoints: 0, ownership: 9.1, imageUrl: "https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_240,q_auto,w_240/headshots_57451.png", r1: "76(+4)", r2: "73(+1)", r3: "-" },
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
           const fantasyPointsChange = (Math.random() * 5) - 2;
           const newFantasyPoints = Math.max(0, golfer.fantasyPoints + fantasyPointsChange);
           return {
             ...golfer,
             total: newTotal,
             thru: newHole > 18 ? "F" : String(newHole),
             fantasyPoints: newFantasyPoints,
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

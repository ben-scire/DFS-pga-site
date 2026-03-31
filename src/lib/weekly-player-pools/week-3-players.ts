import type { PlayerPoolGolfer } from '@/lib/lineup-builder-types';

const DEFAULT_HEADSHOT = 'https://placehold.co/80x80/png';

function makeGolfer(golferId: string, name: string): PlayerPoolGolfer {
  return {
    golferId,
    name,
    salary: 8000,
    position: 'G',
    headshotUrl: DEFAULT_HEADSHOT,
    isActive: true,
  };
}

export const WEEK_3_PLAYERS_POOL: PlayerPoolGolfer[] = [
  makeGolfer('w3-aaron-rai', 'Aaron Rai'),
  makeGolfer('w3-adam-scott', 'Adam Scott'),
  makeGolfer('w3-akshay-bhatia', 'Akshay Bhatia'),
  makeGolfer('w3-alex-noren', 'Alex Noren'),
  makeGolfer('w3-brooks-koepka', 'Brooks Koepka'),
  makeGolfer('w3-bud-cauley', 'Bud Cauley'),
  makeGolfer('w3-cameron-young', 'Cameron Young'),
  makeGolfer('w3-chris-gotterup', 'Chris Gotterup'),
  makeGolfer('w3-collin-morikawa', 'Collin Morikawa'),
  makeGolfer('w3-corey-conners', 'Corey Conners'),
  makeGolfer('w3-daniel-berger', 'Daniel Berger'),
  makeGolfer('w3-hideki-matsuyama', 'Hideki Matsuyama'),
  makeGolfer('w3-jacob-bridgeman', 'Jacob Bridgeman'),
  makeGolfer('w3-jake-knapp', 'Jake Knapp'),
  makeGolfer('w3-joel-dahmen', 'Joel Dahmen'),
  makeGolfer('w3-jordan-spieth', 'Jordan Spieth'),
  makeGolfer('w3-justin-rose', 'Justin Rose'),
  makeGolfer('w3-keegan-bradley', 'Keegan Bradley'),
  makeGolfer('w3-kurt-kitayama', 'Kurt Kitayama'),
  makeGolfer('w3-ludvig-aberg', 'Ludvig Aberg'),
  makeGolfer('w3-maverick-mcnealy', 'Maverick McNealy'),
  makeGolfer('w3-max-mcgreevy', 'Max McGreevy'),
  makeGolfer('w3-michael-thorbjornsen', 'Michael Thorbjornsen'),
  makeGolfer('w3-min-woo-lee', 'Min Woo Lee'),
  makeGolfer('w3-nicolai-hojgaard', 'Nicolai Hojgaard'),
  makeGolfer('w3-nicolas-echavarria', 'Nicolas Echavarria'),
  makeGolfer('w3-patrick-cantlay', 'Patrick Cantlay'),
  makeGolfer('w3-rickie-fowler', 'Rickie Fowler'),
  makeGolfer('w3-russell-henley', 'Russell Henley'),
  makeGolfer('w3-ryan-fox', 'Ryan Fox'),
  makeGolfer('w3-sahith-theegala', 'Sahith Theegala'),
  makeGolfer('w3-scottie-scheffler', 'Scottie Scheffler'),
  makeGolfer('w3-sepp-straka', 'Sepp Straka'),
  makeGolfer('w3-si-woo-kim', 'Si Woo Kim'),
  makeGolfer('w3-tom-hoge', 'Tom Hoge'),
  makeGolfer('w3-tommy-fleetwood', 'Tommy Fleetwood'),
  makeGolfer('w3-tony-finau', 'Tony Finau'),
  makeGolfer('w3-viktor-hovland', 'Viktor Hovland'),
  makeGolfer('w3-xander-schauffele', 'Xander Schauffele'),
];

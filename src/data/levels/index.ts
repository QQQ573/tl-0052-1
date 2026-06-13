import mcdonalds from './mcdonalds.json';
import kfc from './kfc.json';
import wallace from './wallace.json';

export const levels = [mcdonalds, kfc, wallace];

export type Item = {
  id: string;
  name: string;
  color: string;
  shape: string;
};

export type Order = {
  id: string;
  name: string;
  steps: string[];
  exclusions: string[];
};

export type Level = {
  id: string;
  name: string;
  brand: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  totalOrders: number;
  timeLimit: number;
  items: Item[];
  distractors: Item[];
  orders: Order[];
};

export const getLevelById = (id: string): Level | undefined => {
  return levels.find(l => l.id === id);
};

export const getItemById = (level: Level, itemId: string): Item | undefined => {
  return [...level.items, ...level.distractors].find(i => i.id === itemId);
};

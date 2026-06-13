import type { Level, Order, Item } from '@/data/levels';

export type GameState = 'menu' | 'playing' | 'paused' | 'levelComplete' | 'gameOver';

export type DraggedItem = {
  id: string;
  itemId: string;
  item: Item;
  sprite: Phaser.GameObjects.Container;
  originalX: number;
  originalY: number;
};

export type PlacedItem = {
  itemId: string;
  item: Item;
  stepIndex: number;
  timestamp: number;
};

export type OrderResult = {
  order: Order;
  correct: boolean;
  timeTaken: number;
  mistakes: number;
  errorSteps: string[];
  remade: boolean;
};

export type LevelResult = {
  level: Level | { id: string; name: string; primaryColor: string; secondaryColor: string; bgColor: string; totalOrders: number; timeLimit: number; items: Item[]; distractors: Item[] };
  completed: boolean;
  totalScore: number;
  qualityScore: number;
  totalTime: number;
  avgAssemblyTime: number;
  ordersCompleted: number;
  orderResults: OrderResult[];
  errorStepCounts: Record<string, number>;
  stars: number;
};

export type GameEvents = {
  'order-start': (order: Order) => void;
  'item-placed': (itemId: string, stepIndex: number) => void;
  'wrong-placement': (itemId: string, expected: string, stepIndex: number) => void;
  'correct-placement': (itemId: string, stepIndex: number) => void;
  'order-complete': (result: OrderResult) => void;
  'order-remake': () => void;
  'time-warning': () => void;
  'level-complete': (result: LevelResult) => void;
  'game-over': () => void;
};

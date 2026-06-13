import type { Level, Order, Item } from '@/data/levels';
import type { GameState, OrderResult, LevelResult, PlacedItem, GameEvents } from '@/types/game';

export class GameStateManager {
  private level: Level;
  private state: GameState = 'menu';
  private currentOrderIndex: number = 0;
  private currentOrder: Order | null = null;
  private currentStepIndex: number = 0;
  private placedItems: PlacedItem[] = [];
  private consecutiveMistakes: number = 0;
  private totalMistakes: number = 0;
  private qualityScore: number = 100;
  private timeRemaining: number = 0;
  private orderStartTime: number = 0;
  private orderResults: OrderResult[] = [];
  private errorStepCounts: Record<string, number> = {};
  private currentOrderMistakes: number = 0;
  private currentOrderErrorSteps: string[] = [];
  private isRemaking: boolean = false;
  private timeWarningTriggered: boolean = false;
  private bgmSpeed: number = 1;

  private eventListeners: Map<keyof GameEvents, Function[]> = new Map();

  constructor(level: Level) {
    this.level = level;
    this.timeRemaining = level.timeLimit;
  }

  on<T extends keyof GameEvents>(event: T, callback: GameEvents[T]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as Function);
  }

  off<T extends keyof GameEvents>(event: T, callback: GameEvents[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback as Function);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit<T extends keyof GameEvents>(event: T, ...args: Parameters<GameEvents[T]>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  startLevel(): void {
    this.state = 'playing';
    this.startNextOrder();
  }

  private startNextOrder(): void {
    if (this.currentOrderIndex >= this.level.totalOrders) {
      this.completeLevel();
      return;
    }

    const orderPool = this.level.orders;
    this.currentOrder = orderPool[this.currentOrderIndex % orderPool.length];
    this.currentStepIndex = 0;
    this.placedItems = [];
    this.consecutiveMistakes = 0;
    this.currentOrderMistakes = 0;
    this.currentOrderErrorSteps = [];
    this.isRemaking = false;
    this.orderStartTime = Date.now();
    this.timeWarningTriggered = false;

    this.emit('order-start', this.currentOrder);
  }

  placeItem(itemId: string, item: Item): 'correct' | 'wrong' | 'remake' {
    if (!this.currentOrder || this.state !== 'playing') {
      return 'wrong';
    }

    const expectedStep = this.currentOrder.steps[this.currentStepIndex];

    if (itemId === expectedStep) {
      this.handleCorrectPlacement(itemId, item);
      return 'correct';
    } else {
      return this.handleWrongPlacement(itemId, expectedStep, item);
    }
  }

  private handleCorrectPlacement(itemId: string, item: Item): void {
    this.consecutiveMistakes = 0;
    this.placedItems.push({
      itemId,
      item,
      stepIndex: this.currentStepIndex,
      timestamp: Date.now()
    });
    this.currentStepIndex++;

    this.emit('correct-placement', itemId, this.currentStepIndex - 1);
    this.emit('item-placed', itemId, this.currentStepIndex - 1);

    if (this.currentStepIndex >= this.currentOrder!.steps.length) {
      this.completeCurrentOrder();
    }
  }

  private handleWrongPlacement(itemId: string, expected: string, _item: Item): 'wrong' | 'remake' {
    this.consecutiveMistakes++;
    this.totalMistakes++;
    this.currentOrderMistakes++;
    this.currentOrderErrorSteps.push(itemId);

    this.qualityScore = Math.max(0, this.qualityScore - 5);

    const key = `${expected}_before_${itemId}`;
    this.errorStepCounts[key] = (this.errorStepCounts[key] || 0) + 1;

    this.emit('wrong-placement', itemId, expected, this.currentStepIndex);

    if (this.consecutiveMistakes >= 3) {
      this.remakeCurrentOrder();
      return 'remake';
    }

    return 'wrong';
  }

  private remakeCurrentOrder(): void {
    if (!this.currentOrder) return;

    this.isRemaking = true;
    this.currentStepIndex = 0;
    this.placedItems = [];
    this.consecutiveMistakes = 0;

    this.emit('order-remake');
  }

  private completeCurrentOrder(): void {
    if (!this.currentOrder) return;

    const timeTaken = (Date.now() - this.orderStartTime) / 1000;

    const result: OrderResult = {
      order: this.currentOrder,
      correct: this.currentOrderMistakes === 0,
      timeTaken,
      mistakes: this.currentOrderMistakes,
      errorSteps: [...this.currentOrderErrorSteps],
      remade: this.isRemaking
    };

    this.orderResults.push(result);
    this.emit('order-complete', result);

    this.currentOrderIndex++;
    this.startNextOrder();
  }

  updateTime(delta: number): void {
    if (this.state !== 'playing') return;

    this.timeRemaining -= delta;

    if (this.timeRemaining <= 30 && !this.timeWarningTriggered) {
      this.timeWarningTriggered = true;
      this.bgmSpeed = 1.5;
      this.emit('time-warning');
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.gameOver();
    }
  }

  private completeLevel(): void {
    this.state = 'levelComplete';
    const totalTime = this.level.timeLimit - this.timeRemaining;
    const avgAssemblyTime = this.orderResults.length > 0
      ? this.orderResults.reduce((sum, r) => sum + r.timeTaken, 0) / this.orderResults.length
      : 0;

    const stars = this.calculateStars();

    const result: LevelResult = {
      level: this.level,
      completed: true,
      totalScore: this.calculateTotalScore(),
      qualityScore: this.qualityScore,
      totalTime,
      avgAssemblyTime,
      ordersCompleted: this.orderResults.length,
      orderResults: [...this.orderResults],
      errorStepCounts: { ...this.errorStepCounts },
      stars
    };

    this.emit('level-complete', result);
  }

  private calculateStars(): number {
    if (this.qualityScore >= 90) return 3;
    if (this.qualityScore >= 70) return 2;
    if (this.qualityScore >= 50) return 1;
    return 0;
  }

  private calculateTotalScore(): number {
    const baseScore = this.orderResults.length * 100;
    const qualityBonus = this.qualityScore;
    const timeBonus = Math.max(0, Math.floor(this.timeRemaining / 10) * 5);
    return baseScore + qualityBonus + timeBonus;
  }

  private gameOver(): void {
    this.state = 'gameOver';
    this.emit('game-over');
  }

  pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  getState(): GameState {
    return this.state;
  }

  getLevel(): Level {
    return this.level;
  }

  getCurrentOrder(): Order | null {
    return this.currentOrder;
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  getQualityScore(): number {
    return this.qualityScore;
  }

  getCurrentOrderIndex(): number {
    return this.currentOrderIndex;
  }

  getTotalOrders(): number {
    return this.level.totalOrders;
  }

  getBgmSpeed(): number {
    return this.bgmSpeed;
  }

  getPlacedItems(): PlacedItem[] {
    return [...this.placedItems];
  }

  getConsecutiveMistakes(): number {
    return this.consecutiveMistakes;
  }
}

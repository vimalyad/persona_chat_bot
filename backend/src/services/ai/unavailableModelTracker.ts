export class UnavailableModelTracker {
  private readonly unavailableUntil = new Map<string, number>();

  isUnavailable(modelId: string) {
    const until = this.unavailableUntil.get(modelId);
    if (!until) return false;

    if (Date.now() >= until) {
      this.unavailableUntil.delete(modelId);
      return false;
    }

    return true;
  }

  markUnavailable(modelId: string, durationMs: number) {
    if (!modelId) return;

    const currentUntil = this.unavailableUntil.get(modelId) || 0;
    this.unavailableUntil.set(
      modelId,
      Math.max(currentUntil, Date.now() + durationMs),
    );
  }

  clear(modelId: string) {
    this.unavailableUntil.delete(modelId);
  }
}

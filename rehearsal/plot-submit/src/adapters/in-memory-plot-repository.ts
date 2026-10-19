import type { Plot } from '../domain/plot'
import type { PlotRepository } from '../ports/plot-repository'

export class InMemoryPlotRepository implements PlotRepository {
  private readonly byId = new Map<string, Plot>()

  async findById(id: string): Promise<Plot | null> {
    return this.byId.get(id) ?? null
  }

  async findByIdempotencyKey(key: string): Promise<Plot | null> {
    for (const plot of this.byId.values()) {
      if (plot.idempotencyKey === key) return plot
    }
    return null
  }

  async save(plot: Plot): Promise<void> {
    this.byId.set(plot.id, plot)
  }

  async all(): Promise<readonly Plot[]> {
    return [...this.byId.values()]
  }
}

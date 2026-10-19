import type { Plot } from '../domain/plot'

export interface PlotRepository {
  findById(id: string): Promise<Plot | null>
  findByIdempotencyKey(key: string): Promise<Plot | null>
  save(plot: Plot): Promise<void>
}

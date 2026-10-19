import {
  FixedClock,
  InMemoryCheckpointer,
  InMemoryKnowledgeBase,
  InMemoryMonitor,
  InMemoryPlotStore,
  SeqIds,
  StubModelGateway,
  StubPestDetector,
} from '../src/adapters/in-memory'
import { createToolGateway } from '../src/application/tool-gateway'
import type { AgriQaDeps } from '../src/application/ask-farm-question'

export interface WorldOptions {
  pestConfidence?: number
  modelFailures?: number
}

export function makeWorld(options: WorldOptions = {}) {
  const plots = new InMemoryPlotStore()
  plots.seed({
    id: 'plot-1',
    ownerUid: 'farmer-001',
    groupName: '3组',
    areaMu: 5,
    crop: '茶',
  })

  const knowledge = new InMemoryKnowledgeBase([
    {
      id: 'kb-1',
      title: '茶树叶片发黄',
      content: '茶树叶片发黄常见于缺氮或湿害，先排水并观察新叶。',
      score: 0,
    },
    {
      id: 'kb-2',
      title: '茶园虫害防治',
      content: '茶小绿叶蝉可用黄板诱杀，严重时请咨询农技员。',
      score: 0,
    },
  ])
  const pest = new StubPestDetector(options.pestConfidence ?? 0.9)
  const model = new StubModelGateway({
    failuresRemaining: options.modelFailures ?? 0,
  })
  const checkpointer = new InMemoryCheckpointer()
  const monitor = new InMemoryMonitor()
  const clock = new FixedClock()
  const ids = new SeqIds()
  const tools = createToolGateway({ plots, knowledge, pest, monitor, clock, ids })

  const deps: AgriQaDeps = {
    tools,
    models: model,
    checkpointer,
    monitor,
    clock,
    ids,
  }

  return {
    deps,
    plots,
    knowledge,
    pest,
    model,
    checkpointer,
    monitor,
    clock,
    ids,
  }
}

export function farmerInput(overrides: Record<string, unknown> = {}) {
  return {
    threadId: 'thread-0001',
    userId: 'farmer-001',
    plotId: 'plot-1',
    question: '我家3组的茶树叶发黄怎么办？',
    traceId: 'trace-0001',
    ...overrides,
  }
}

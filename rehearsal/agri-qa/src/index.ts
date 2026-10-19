import {
  FixedClock,
  InMemoryCheckpointer,
  InMemoryKnowledgeBase,
  InMemoryMonitor,
  InMemoryPlotStore,
  SeqIds,
  StubModelGateway,
  StubPestDetector,
} from './adapters/in-memory'
import { askFarmQuestion } from './application/ask-farm-question'
import { createToolGateway } from './application/tool-gateway'

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
])

const monitor = new InMemoryMonitor()
const clock = new FixedClock()
const ids = new SeqIds()
const tools = createToolGateway({
  plots,
  knowledge,
  pest: new StubPestDetector(0.9),
  monitor,
  clock,
  ids,
})

const result = await askFarmQuestion(
  {
    threadId: 'demo-thread-0001',
    userId: 'farmer-001',
    plotId: 'plot-1',
    question: '我家3组的茶树叶发黄怎么办？',
    traceId: 'demo-trace-0001',
  },
  {
    tools,
    models: new StubModelGateway(),
    checkpointer: new InMemoryCheckpointer(),
    monitor,
    clock,
    ids,
  }
)

console.log(JSON.stringify(result, null, 2))
console.log('--- monitor events ---')
console.log(JSON.stringify(await monitor.all(), null, 2))

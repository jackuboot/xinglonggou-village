/**
 * 会话 Actor：同一 thread 串行执行，不同 thread 互不影响。
 * 这是长驻运行时“单写者、邮箱串行”的最小模拟。
 */
export class SessionActor {
  private tail: Promise<void> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task)
    this.tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export class SessionRegistry {
  private readonly actors = new Map<string, SessionActor>()

  run<T>(threadId: string, task: () => Promise<T>): Promise<T> {
    let actor = this.actors.get(threadId)
    if (!actor) {
      actor = new SessionActor()
      this.actors.set(threadId, actor)
    }
    return actor.run(task)
  }
}

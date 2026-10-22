export type Goal = {
  n: string
  group: string
  title: string
  isWarn: boolean
  isDone: boolean
  tag: string
  deadline: string
  updated: string
  idleDays: number
}

export type Watch = {
  name: string
  isWarn: boolean
  text: string
  full: string
  updated: string
  idleDays: number
}

export type Upcoming = { date: string; days: number; text: string }

export type Snapshot = {
  goals: Goal[]
  events: Upcoming[]
  watches: Watch[]
  loadedAt: number
  error: string
}

declare module 'claude-code' {
  interface PluginState {
    'todo-pane': { snapshot: Snapshot }
  }
}

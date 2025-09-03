import Dexie, { Table } from 'dexie'

export interface Visit {
  id?: number
  url: string
  domain: string
  startTime: number
  endTime: number
  duration: number
}

class Database extends Dexie {
  visits!: Table<Visit>

  constructor() {
    super('GeminiTimeTracker')
    this.version(1).stores({
      visits: '++id, url, domain, startTime, endTime, duration',
    })
  }
}

export const db = new Database()

export const addVisit = async (visit: Omit<Visit, 'id'>) => {
  return await db.visits.add(visit)
}

export const getVisitsByDate = async (date: Date) => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  return await db.visits
    .where('startTime')
    .between(startOfDay.getTime(), endOfDay.getTime())
    .toArray()
}

export const getVisitsByDomain = async (domain: string, date: Date) => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  
  return await db.visits
    .where('domain')
    .equals(domain)
    .and(visit => visit.startTime >= startOfDay.getTime() && visit.startTime <= endOfDay.getTime())
    .toArray()
}

export const getTodayStats = async () => {
  const today = new Date()
  const visits = await getVisitsByDate(today)
  
  const domainStats: Record<string, number> = {}
  
  visits.forEach(visit => {
    if (domainStats[visit.domain]) {
      domainStats[visit.domain] += visit.duration
    } else {
      domainStats[visit.domain] = visit.duration
    }
  })
  
  return Object.entries(domainStats)
    .map(([domain, duration]) => ({ domain, duration }))
    .sort((a, b) => b.duration - a.duration)
}

export const clearAllData = async () => {
  return await db.visits.clear()
}
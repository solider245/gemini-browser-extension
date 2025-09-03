// Database class for IndexedDB operations
class Database {
  private db: IDBDatabase | null = null
  private readonly dbName = 'GeminiTimeTracker'
  private readonly version = 1

  constructor() {
    this.init()
  }

  private init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('visits')) {
          const store = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true })
          store.createIndex('url', 'url', { unique: false })
          store.createIndex('domain', 'domain', { unique: false })
          store.createIndex('startTime', 'startTime', { unique: false })
        }
      }
    })
  }

  async getVisitsByDate(date: Date): Promise<Visit[]> {
    if (!this.db) await this.init()
    
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visits'], 'readonly')
      const store = transaction.objectStore('visits')
      const index = store.index('startTime')
      const request = index.openCursor(IDBKeyRange.bound(startOfDay.getTime(), endOfDay.getTime()))
      
      const results: Visit[] = []
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visits'], 'readwrite')
      const store = transaction.objectStore('visits')
      const request = store.clear()
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

interface Visit {
  id?: number
  url: string
  domain: string
  startTime: number
  endTime: number
  duration: number
}

const db = new Database()

const getTodayStats = async (): Promise<Array<{ domain: string; duration: number }>> => {
  const today = new Date()
  const visits = await db.getVisitsByDate(today)
  
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

const clearAllData = async (): Promise<void> => {
  return await db.clearAllData()
}

const formatTime = (milliseconds: number): string => {
  const totalMinutes = Math.floor(milliseconds / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

const renderWebsiteList = (stats: Array<{ domain: string; duration: number }>) => {
  const websiteList = document.getElementById('websiteList')
  
  if (!websiteList) return
  
  if (stats.length === 0) {
    websiteList.innerHTML = `
      <div class="empty-state">
        <p>🌟 今天还没有浏览记录</p>
        <p>开始浏览网页后，这里会显示统计信息</p>
      </div>
    `
    return
  }
  
  websiteList.innerHTML = stats
    .map(item => `
      <div class="website-item">
        <span class="website-domain" title="${item.domain}">${item.domain}</span>
        <span class="website-time">${formatTime(item.duration)}</span>
      </div>
    `)
    .join('')
}

const updateStats = async () => {
  try {
    const stats = await getTodayStats()
    const totalTime = stats.reduce((sum, item) => sum + item.duration, 0)
    
    const totalTimeElement = document.getElementById('totalTime')
    const siteCountElement = document.getElementById('siteCount')
    
    if (totalTimeElement) {
      totalTimeElement.textContent = formatTime(totalTime)
    }
    
    if (siteCountElement) {
      siteCountElement.textContent = `${stats.length}个`
    }
    
    renderWebsiteList(stats)
  } catch (error) {
    console.error('Error updating stats:', error)
  }
}

const initializePopup = async () => {
  const currentDateElement = document.getElementById('currentDate')
  const refreshBtn = document.getElementById('refreshBtn')
  const clearBtn = document.getElementById('clearBtn')
  
  if (currentDateElement) {
    currentDateElement.textContent = formatDate(new Date())
  }
  
  await updateStats()
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', updateStats)
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('确定要清除所有浏览数据吗？此操作不可恢复。')) {
        try {
          await clearAllData()
          await updateStats()
          alert('数据已清除')
        } catch (error) {
          console.error('Error clearing data:', error)
          alert('清除数据失败')
        }
      }
    })
  }
}

document.addEventListener('DOMContentLoaded', initializePopup)
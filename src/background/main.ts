// Database class for IndexedDB operations using Dexie.js style interface
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

  async addVisit(visit: Omit<Visit, 'id'>): Promise<number> {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['visits'], 'readwrite')
      const store = transaction.objectStore('visits')
      const request = store.add(visit)
      
      request.onsuccess = () => resolve(request.result as number)
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

interface TabState {
  startTime: number
  url: string
  domain: string
}

const db = new Database()
const tabStates: Record<number, TabState> = {}
let activeTabId: number | null = null
let isActive = true

const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return url
  }
}

const saveCurrentTabTime = async (tabId: number) => {
  const tabState = tabStates[tabId]
  if (tabState) {
    const endTime = Date.now()
    const duration = endTime - tabState.startTime
    
    if (duration > 1000) {
      await db.addVisit({
        url: tabState.url,
        domain: tabState.domain,
        startTime: tabState.startTime,
        endTime,
        duration
      })
    }
    
    delete tabStates[tabId]
  }
}

const onTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
  if (!isActive) return
  
  if (activeTabId !== null && activeTabId !== activeInfo.tabId) {
    await saveCurrentTabTime(activeTabId)
  }
  
  activeTabId = activeInfo.tabId
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && tab.url.startsWith('http')) {
      tabStates[activeInfo.tabId] = {
        startTime: Date.now(),
        url: tab.url,
        domain: getDomainFromUrl(tab.url)
      }
    }
  } catch (error) {
    console.error('Error getting tab info:', error)
  }
}

const onTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => {
  if (!isActive) return
  
  if (changeInfo.url && tab.url && tab.url.startsWith('http')) {
    if (tabStates[tabId]) {
      await saveCurrentTabTime(tabId)
    }
    
    if (tab.active) {
      tabStates[tabId] = {
        startTime: Date.now(),
        url: tab.url,
        domain: getDomainFromUrl(tab.url)
      }
      activeTabId = tabId
    }
  }
}

const onWindowFocusChanged = async (windowId: number) => {
  isActive = windowId !== chrome.windows.WINDOW_ID_NONE
  
  if (!isActive && activeTabId !== null) {
    await saveCurrentTabTime(activeTabId)
  }
}

const onTabRemoved = async (tabId: number) => {
  await saveCurrentTabTime(tabId)
  if (activeTabId === tabId) {
    activeTabId = null
  }
}

chrome.tabs.onActivated.addListener(onTabActivated)
chrome.tabs.onUpdated.addListener(onTabUpdated)
chrome.windows.onFocusChanged.addListener(onWindowFocusChanged)
chrome.tabs.onRemoved.addListener(onTabRemoved)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini Time Tracker installed')
})

chrome.runtime.onStartup.addListener(() => {
  console.log('Gemini Time Tracker started')
})

const cleanup = async () => {
  if (activeTabId !== null) {
    await saveCurrentTabTime(activeTabId)
  }
  
  for (const tabId of Object.keys(tabStates)) {
    await saveCurrentTabTime(parseInt(tabId))
  }
}

chrome.runtime.onSuspend.addListener(() => {
  cleanup()
})

export {}
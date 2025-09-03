import { addVisit } from '../db/database'

interface TabState {
  startTime: number
  url: string
  domain: string
}

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
      await addVisit({
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
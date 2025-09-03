import { getTodayStats, clearAllData } from '../db/database'

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
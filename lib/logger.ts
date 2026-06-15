/**
 * Secure Logger Utility
 * - Strips logs in production build to prevent data leakage via console
 * - Maintains logs in development for debugging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private isDev: boolean

  constructor() {
    this.isDev = process.env.NODE_ENV === 'development'
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.isDev) return

    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    
    if (level === 'error') {
      console.error(prefix, message, data || '')
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '')
    } else if (level === 'debug') {
      console.log(prefix, message, data || '')
    } else {
      console.log(prefix, message, data || '')
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data)
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data)
  }

  error(message: string, error?: Error | any) {
    this.log('error', message, error)
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data)
  }
}

export const logger = new Logger()
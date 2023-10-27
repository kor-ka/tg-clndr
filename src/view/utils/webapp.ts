import { Deffered } from "../../utils/deffered"

export let WebApp: any = undefined

export let __DEV__ = false

// TODO: add withWebApp wrapper

if (typeof window !== "undefined") {
    __DEV__ = window.location.hostname.indexOf("localhost") >= 0 || window.location.search.endsWith("_dev_=true")
    WebApp = (window as any).Telegram.WebApp
}
export const showAlert = (message: string) => {
    if (__DEV__) {
        window.alert(message)
    } else {
        WebApp?.showAlert(message)
    }
}

export const showConfirm = (message: string, callback: (confirmed: boolean) => void) => {
    if (__DEV__) {
        callback(window.confirm(message))
    } else {
        WebApp?.showConfirm(message, callback)

    }
}

export const reqestWriteAccess = () => {
    return new Promise<boolean>(resolve => {
        WebApp?.requestWriteAccess((granted: boolean) => {
            resolve(granted)
        })
    })
}

export const setItem = (key: string, value: string) => {
    return new Promise<boolean>((resolve, reject) => {
        if (WebApp) {
            WebApp.CloudStorage.setItem(key, value, (error: string | null, stored?: boolean) => {
                if (error) {
                    reject(new Error(error))
                } else {
                    resolve(!!stored)
                }
            })
        } else {
            reject(new Error('WebApp is undefined'))
        }
    })
}

export const getItem = (key: string) => {
    return new Promise<string | undefined>((resolve, reject) => {
        if (WebApp) {
            WebApp.CloudStorage.getItem(key, (error: string | null, value?: string) => {
                if (error) {
                    reject(new Error(error))
                } else {
                    resolve(value)
                }
            })
        } else {
            reject(new Error('WebApp is undefined'))
        }
    })
}

export const expand = () => {
    if (WebApp) {
        WebApp.expand()
    }
}

export const isAndroid = () => {
    if (WebApp) {
        return WebApp.platform === 'android'
    }
}

export const webAppReady = new Deffered()

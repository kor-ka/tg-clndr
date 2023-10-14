export let __DEV__ = false
export let WebApp: any = undefined
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

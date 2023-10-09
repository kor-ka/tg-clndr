export const getSSRReadyPath = () => {
    if (typeof window !== "undefined") {
        return window.location.pathname
    }
    return ''
}
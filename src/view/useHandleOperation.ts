import React from "react";
import { WebApp, showAlert } from "./utils/webapp";
export const useHandleOperation = () => {

    const [loading, setLoading] = React.useState(false);

    const callback = React.useCallback(<T,>(operation: () => Promise<T>, onComplete?: () => void) => {
        if (loading) {
            return Promise.reject(new Error("operation already in progress"))
        }
        setLoading(true);
        return operation().then((res: T) => {
            WebApp?.HapticFeedback.notificationOccurred("success");
            if (onComplete) {
                onComplete()
            }
            return res
        })
            .catch(e => {
                WebApp?.HapticFeedback.notificationOccurred("error");
                if (e instanceof Error) {
                    showAlert(e.message);
                } else {
                    console.error(e)
                }
            })
            .finally(() => setLoading(false));
    }, [loading])

    return [callback, loading] as const
}
import React from "react";
import { WebApp, __DEV__ } from "../../utils/webapp";

export const ClosingConfirmationController = React.memo(() => {
    React.useEffect(() => {
        WebApp?.enableClosingConfirmation();
        return () => {
            WebApp?.disableClosingConfirmation();
        }
    }, [])
    return null
})
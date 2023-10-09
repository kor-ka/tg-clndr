import React, { useCallback } from "react";
import { getSSRReadyPath } from "../../utils/navigation/getSSRReadyPath";
import { useSSRReadyNavigate } from "../../utils/navigation/useSSRReadyNavigate";
import { WebApp, __DEV__ } from "../../utils/webapp";

export const BackButtonController = React.memo(() => {
    const nav = useSSRReadyNavigate()
    const bb = React.useMemo(() => WebApp?.BackButton, [])
    const goBack = useCallback(() => nav(-1), [])

    const canGoBack = getSSRReadyPath() !== '/tg/'

    React.useEffect(() => {
        if (canGoBack) {
            bb.show()
        } else {
            bb.hide()
        }
    }, [canGoBack])

    React.useEffect(() => {
        console.log(bb)
        bb.onClick(goBack)
        return () => {
            bb.offClick(goBack)
        }
    }, [bb])

    return (canGoBack && __DEV__) ? <button style={{ position: 'absolute', top: 0, left: 0 }} onClick={goBack}>{"< back"}</button> : null
})
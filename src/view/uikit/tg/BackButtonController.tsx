import React, { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getSSRReadyPath } from "../../utils/navigation/getSSRReadyPath";
import { useSSRReadyNavigate } from "../../utils/navigation/useSSRReadyNavigate";
import { WebApp, __DEV__ } from "../../utils/webapp";

export const BackButtonController = React.memo(({ canGoBack: canGoBackProp, goBack: goBackProp }: { canGoBack?: boolean, goBack?: () => void }) => {
    const nav = useSSRReadyNavigate()
    const bb = React.useMemo(() => WebApp?.BackButton, [])
    const goBack = useCallback(() => goBackProp ? goBackProp() : nav(-1), [goBackProp])

    const canGoBack = canGoBackProp || (getSSRReadyPath() !== '/tg/')

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
    }, [bb, goBack])

    return (canGoBack && __DEV__) ? <button style={{ position: 'fixed', zIndex: 3, top: 0, left: 0 }} onClick={goBack}>{"< back"}</button> : null
})